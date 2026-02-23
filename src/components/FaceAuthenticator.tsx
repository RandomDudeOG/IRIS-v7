import React, { useState, useEffect, useRef } from 'react';
import * as faceapi from 'face-api.js';
import { IRISSounds } from '../utils/audio';
import { MASTER_PASSCODE } from '../utils/faces';

interface FaceAuthenticatorProps {
  isCameraActive: boolean;
  captureFrame: () => string | null;
  onRequestCamera: () => void;
  onAuthenticated: () => void;
  onError: (msg: string) => void;
  referenceDescriptors: faceapi.LabeledFaceDescriptors[];
}

const FaceAuthenticator: React.FC<FaceAuthenticatorProps> = ({ 
  isCameraActive, 
  captureFrame, 
  onRequestCamera,
  onAuthenticated, 
  onError,
  referenceDescriptors
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusText, setStatusText] = useState("SECURE TERMINAL LOCKED");
  const [passcodeInput, setPasscodeInput] = useState('');
  
  // Refs to prevent memory leaks or race conditions during async ops
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    
    // Initial status check
    if (referenceDescriptors.length === 0) {
        setStatusText("NO BIOMETRIC DATA - USE PASSCODE");
    } else if (!isCameraActive) {
        setStatusText("OPTICAL SENSORS OFFLINE");
    } else {
        setStatusText("READY FOR SCAN");
    }

    return () => { isMounted.current = false; };
  }, [referenceDescriptors.length, isCameraActive]);

  const handlePasscodeSubmit = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
        if (passcodeInput === MASTER_PASSCODE) {
            console.log("[IRIS-AUTH] Master passcode accepted.");
            IRISSounds.play('click');
            setStatusText("ACCESS GRANTED");
            setTimeout(onAuthenticated, 800);
        } else {
             console.warn("[IRIS-AUTH] Invalid passcode attempt.");
             IRISSounds.play('error');
             setPasscodeInput('');
             setStatusText("INVALID ACCESS CODE");
        }
    }
  };

  const handleScan = async () => {
    if (isProcessing) return;
    
    // 1. Validation
    if (!isCameraActive) {
        IRISSounds.play('error');
        setStatusText("OPTICAL SENSORS OFFLINE");
        return;
    }

    if (referenceDescriptors.length === 0) {
        // Fallback for no data
        IRISSounds.play('error');
        setStatusText("DB EMPTY - MANUAL OVERRIDE REQ.");
        return;
    }

    const currentFrameBase64 = captureFrame();
    if (!currentFrameBase64) {
        IRISSounds.play('error');
        setStatusText("FRAME CAPTURE ERROR (VIDEO INIT)");
        return;
    }

    // 2. Processing
    setIsProcessing(true);
    setStatusText("COMPARING BIOMETRIC SIGNATURES...");
    IRISSounds.play('boot');

    try {
        const img = await faceapi.fetchImage(`data:image/jpeg;base64,${currentFrameBase64}`);
        
        // Use TinyFaceDetectorOptions to match initialization in faces.ts
        const detection = await faceapi.detectSingleFace(img, new faceapi.TinyFaceDetectorOptions())
            .withFaceLandmarks()
            .withFaceDescriptor();

        if (detection) {
            const faceMatcher = new faceapi.FaceMatcher(referenceDescriptors, 0.6); // 0.6 is strictness
            const match = faceMatcher.findBestMatch(detection.descriptor);

            console.log("[IRIS-AUTH] Match Result:", match.toString());

            if (match.label !== 'unknown') {
                IRISSounds.play('click');
                if (isMounted.current) setStatusText(`IDENTITY CONFIRMED`);
                setTimeout(onAuthenticated, 800);
            } else {
                IRISSounds.play('error');
                if (isMounted.current) {
                    setStatusText("ACCESS DENIED");
                    onError("Identity mismatch");
                }
            }
        } else {
            console.warn("[IRIS-AUTH] No face detected in probe frame.");
            IRISSounds.play('error');
            if (isMounted.current) setStatusText("NO FACE DETECTED");
        }
    } catch (e) {
        console.error("[IRIS-AUTH] Scan Error:", e);
        IRISSounds.play('error');
        if (isMounted.current) setStatusText("PROCESSING FAULT");
    } finally {
        if(isMounted.current) setIsProcessing(false);
    }
  };

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center z-[100] pointer-events-auto gap-8">
      {/* Bio Scanner */}
      <div className="w-64 h-64 md:w-80 md:h-80 border-2 border-rose-500/50 rounded-full flex flex-col items-center justify-center relative bg-black/40 backdrop-blur-sm shadow-[0_0_50px_rgba(244,63,94,0.2)]">
          {/* Animated Rings */}
          <div className="absolute inset-0 border border-rose-500/20 rounded-full animate-[spin_4s_linear_infinite]"></div>
          <div className="absolute inset-4 border border-rose-500/20 rounded-full animate-[spin_3s_linear_infinite_reverse]"></div>
          
          <div className="text-rose-500 font-display text-xs tracking-[0.3em] uppercase mb-4 animate-pulse">Retinal Scan</div>
          
          {!isCameraActive ? (
            <button 
                onClick={onRequestCamera}
                className="px-6 py-2 bg-cyan-500/10 border border-cyan-500 text-cyan-500 rounded font-mono text-[10px] tracking-widest uppercase hover:bg-cyan-500/20 active:scale-95 transition-all cursor-pointer z-50 animate-pulse shadow-[0_0_15px_rgba(34,211,238,0.2)]"
            >
                ACTIVATE SENSORS
            </button>
          ) : (
            <button 
                onClick={handleScan}
                disabled={isProcessing || referenceDescriptors.length === 0}
                className="px-6 py-2 bg-rose-500/10 border border-rose-500 text-rose-500 rounded font-mono text-[10px] tracking-widest uppercase hover:bg-rose-500/20 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer z-50"
            >
                {isProcessing ? 'SCANNING...' : (referenceDescriptors.length === 0 ? 'DB EMPTY' : 'INITIATE UNLOCK')}
            </button>
          )}
          
          <div className="text-[8px] text-rose-400 mt-2 font-mono uppercase tracking-wider text-center px-4 min-h-[12px]">
            {statusText}
          </div>
      </div>

      {/* Manual Override */}
      <div className="w-48">
          <input 
            type="password"
            value={passcodeInput}
            onChange={(e) => setPasscodeInput(e.target.value)}
            onKeyDown={handlePasscodeSubmit}
            placeholder="ENTER PASSCODE"
            className="w-full bg-black/60 border-b border-rose-500/50 text-center text-rose-500 font-mono tracking-[0.2em] py-2 focus:outline-none focus:border-rose-500 placeholder-rose-900/50 text-xs"
          />
      </div>
    </div>
  );
};

export default FaceAuthenticator;
