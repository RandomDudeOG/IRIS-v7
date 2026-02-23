import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Mic, MicOff, Settings as SettingsIcon, Command, Terminal } from "lucide-react";
import * as faceapi from "face-api.js";

import LoadingScreen from "./components/LoadingScreen";
import FaceAuthenticator from "./components/FaceAuthenticator";
import VoiceVisualizer from "./components/VoiceVisualizer";
import ToolHud from "./components/ToolHud";
import ActionPanel from "./components/ActionPanel";
import Settings from "./components/Settings";
import ErrorOverlay from "./components/ErrorOverlay";

import { irisBrain } from "./services/iris-brain";
import { irisStore } from "./storage/local";
import { ApiKey } from "./types";

type AppState = "BOOTING" | "LOCKED" | "IDLE" | "LISTENING" | "THINKING" | "SPEAKING" | "ERROR";

const MODEL_URL = "https://justadudewhohacks.github.io/face-api.js/models";

export default function App() {
  const [appState, setAppState] = useState<AppState>("BOOTING");
  const [audioLevel, setAudioLevel] = useState(0);
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [micEnabled, setMicEnabled] = useState(false);
  
  // New State for updated components
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [soundsEnabled, setSoundsEnabled] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [referenceDescriptors, setReferenceDescriptors] = useState<faceapi.LabeledFaceDescriptors[]>([]);

  const [transcription, setTranscription] = useState<{ text: string; source: "USER" | "AI" }[]>([]);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Event Listeners for Brain
    const handleStateChange = (state: string) => {
      if (state === "DISCONNECTED") {
        setMicEnabled(false);
      } else if (["IDLE", "LISTENING", "THINKING", "SPEAKING"].includes(state)) {
        setAppState(state as AppState);
      }
    };

    const handleAudioLevel = (level: number) => {
      setAudioLevel(level);
    };

    const handleToolCall = (toolName: string) => {
      setActiveTool(toolName);
      setTimeout(() => setActiveTool(null), 3000);
    };

    const handleTranscription = (entry: { text: string; source: "USER" | "AI" }) => {
        setTranscription(prev => [...prev, entry]);
    };

    const handleError = (err: any) => {
      console.error("Brain Error:", err);
      setError(err.message || "Unknown Neural Net Error");
    };

    irisBrain.on("stateChange", handleStateChange);
    irisBrain.on("audioLevel", handleAudioLevel);
    irisBrain.on("toolCall", handleToolCall);
    irisBrain.on("transcription", handleTranscription);
    irisBrain.on("error", handleError);

    // Load Face Models
    const loadModels = async () => {
        try {
            await Promise.all([
                faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
                faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
                faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
            ]);
            // Load faces from storage
            const faces = irisStore.getFaces();
            const descriptors = faces.map(f => new faceapi.LabeledFaceDescriptors(f.label, [f.descriptor]));
            setReferenceDescriptors(descriptors);
        } catch (e) {
            console.error("Failed to load models", e);
        }
    };
    loadModels();

    return () => {
      irisBrain.off("stateChange", handleStateChange);
      irisBrain.off("audioLevel", handleAudioLevel);
      irisBrain.off("toolCall", handleToolCall);
      irisBrain.off("transcription", handleTranscription);
      irisBrain.off("error", handleError);
    };
  }, []);

  // Auto-scroll logs
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [transcription]);

  const handleBootComplete = () => {
    setAppState("LOCKED");
  };

  const handleUnlock = () => {
    setAppState("IDLE");
    irisStore.log("SYSTEM UNLOCKED");
    // Stop camera after unlock to save resources
    stopCamera();
  };

  const toggleMic = async () => {
    if (micEnabled) {
      irisBrain.disconnect();
      setMicEnabled(false);
      setAppState("IDLE");
    } else {
      try {
        await irisBrain.connect();
        setMicEnabled(true);
      } catch (e) {
        setError("FAILED TO CONNECT TO NEURAL NET");
      }
    }
  };

  const startCamera = async () => {
      try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: {} });
          if (videoRef.current) {
              videoRef.current.srcObject = stream;
              videoRef.current.play();
          }
          setIsCameraActive(true);
      } catch (e) {
          console.error("Camera failed", e);
          setError("CAMERA ACCESS DENIED");
      }
  };

  const stopCamera = () => {
      if (videoRef.current && videoRef.current.srcObject) {
          const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
          tracks.forEach(t => t.stop());
          videoRef.current.srcObject = null;
      }
      setIsCameraActive(false);
  };

  const captureFrame = (): string | null => {
      if (!videoRef.current) return null;
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.drawImage(videoRef.current, 0, 0);
      return canvas.toDataURL('image/jpeg').split(',')[1];
  };

  // Settings Handlers
  const handleAddKey = (name: string, value: string) => {
      const newKey: ApiKey = { id: Date.now().toString(), name, value };
      setApiKeys(prev => [...prev, newKey]);
      // In real app, save to secure storage
  };

  const handleRemoveKey = (id: string) => {
      setApiKeys(prev => prev.filter(k => k.id !== id));
  };

  if (error) {
    return <ErrorOverlay message={error} onRetry={() => { setError(null); setAppState("BOOTING"); }} />;
  }

  return (
    <div className="h-screen w-screen bg-iris-black text-iris-cyan font-mono overflow-hidden relative selection:bg-iris-cyan selection:text-black">
      
      {/* Hidden Video Element for Face Auth */}
      <video ref={videoRef} className="hidden" muted playsInline />

      {/* Background Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(0,240,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,240,255,0.03)_1px,transparent_1px)] bg-[size:50px_50px] pointer-events-none"></div>

      <AnimatePresence mode="wait">
        {appState === "BOOTING" && (
          <LoadingScreen onComplete={handleBootComplete} />
        )}

        {appState === "LOCKED" && (
          <FaceAuthenticator 
            isCameraActive={isCameraActive}
            captureFrame={captureFrame}
            onRequestCamera={startCamera}
            onAuthenticated={handleUnlock}
            onError={(msg) => console.error(msg)}
            referenceDescriptors={referenceDescriptors}
          />
        )}

        {["IDLE", "LISTENING", "THINKING", "SPEAKING"].includes(appState) && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="relative h-full flex flex-col"
          >
            {/* Header */}
            <header className="flex justify-between items-center p-6 border-b border-iris-cyan/10 bg-black/20 backdrop-blur-sm z-20">
              <div className="flex items-center gap-4">
                <div className="w-3 h-3 bg-iris-cyan rounded-full animate-pulse shadow-[0_0_10px_#00F0FF]"></div>
                <span className="font-display font-bold tracking-[0.2em] text-lg">IRIS_OS</span>
              </div>
              <div className="flex gap-4">
                <button 
                  onClick={() => setShowActions(true)}
                  className="p-2 hover:bg-iris-cyan/10 rounded transition-colors border border-transparent hover:border-iris-cyan/30"
                >
                  <Command size={20} />
                </button>
                <button 
                  onClick={() => setShowSettings(true)}
                  className="p-2 hover:bg-iris-cyan/10 rounded transition-colors border border-transparent hover:border-iris-cyan/30"
                >
                  <SettingsIcon size={20} />
                </button>
              </div>
            </header>

            {/* Main Visualizer Area */}
            <main className="flex-1 relative flex items-center justify-center">
              <div className="w-[800px] h-[800px] relative">
                <VoiceVisualizer 
                    isActive={appState !== "LOCKED" && appState !== "BOOTING"}
                    isSpeaking={appState === "SPEAKING"}
                    audioLevel={audioLevel}
                />
              </div>
              
              {/* Tool HUD */}
              <ToolHud toolName={activeTool} />
            </main>

            {/* Status Text & Logs */}
            <div className="absolute bottom-24 left-6 right-6 h-48 pointer-events-none flex flex-col justify-end items-center text-center pb-4 gap-4">
               {/* Transcription Log */}
               <div 
                  ref={logRef}
                  className="w-full max-w-2xl max-h-32 overflow-y-auto custom-scrollbar pointer-events-auto space-y-2 px-4"
               >
                  {transcription.map((t, i) => (
                      <motion.div 
                        key={i}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`text-xs font-mono tracking-wide ${t.source === 'AI' ? 'text-iris-cyan text-left' : 'text-slate-400 text-right'}`}
                      >
                          <span className="opacity-50 text-[10px] mr-2">[{t.source}]</span>
                          {t.text}
                      </motion.div>
                  ))}
               </div>

               <AnimatePresence>
                 {appState === "LISTENING" && (
                   <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="text-iris-cyan/50 text-sm tracking-widest uppercase"
                   >
                     Listening...
                   </motion.div>
                 )}
                 {appState === "THINKING" && (
                   <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="text-iris-amber text-sm tracking-widest uppercase"
                   >
                     Processing...
                   </motion.div>
                 )}
               </AnimatePresence>
            </div>

            {/* Command Deck */}
            <footer className="p-6 border-t border-iris-cyan/10 bg-black/40 backdrop-blur-md z-20">
              <div className="max-w-3xl mx-auto flex items-center gap-4">
                <div className="flex-1 bg-black/50 border border-iris-cyan/20 rounded px-4 py-3 flex items-center gap-3">
                  <Terminal size={16} className="text-iris-cyan/50" />
                  <input 
                    type="text" 
                    placeholder="ENTER COMMAND..." 
                    className="bg-transparent border-none outline-none text-iris-cyan placeholder-iris-cyan/20 w-full font-mono text-sm tracking-wider"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        (e.target as HTMLInputElement).value = "";
                      }
                    }}
                  />
                </div>
                
                <button 
                  onClick={toggleMic}
                  className={`p-4 rounded-full border transition-all duration-300 ${
                    micEnabled 
                      ? "bg-iris-cyan text-black border-iris-cyan shadow-[0_0_20px_rgba(0,240,255,0.4)]" 
                      : "bg-transparent text-iris-cyan border-iris-cyan/30 hover:border-iris-cyan hover:bg-iris-cyan/10"
                  }`}
                >
                  {micEnabled ? <Mic size={24} /> : <MicOff size={24} />}
                </button>
              </div>
            </footer>

            {/* Overlays */}
            <AnimatePresence>
              {showSettings && (
                  <Settings 
                    onClose={() => setShowSettings(false)}
                    apiKeys={apiKeys}
                    onAddKey={handleAddKey}
                    onRemoveKey={handleRemoveKey}
                    soundsEnabled={soundsEnabled}
                    onToggleSounds={() => setSoundsEnabled(!soundsEnabled)}
                    isCameraActive={isCameraActive}
                    onToggleCamera={() => isCameraActive ? stopCamera() : startCamera()}
                  />
              )}
              {showActions && <ActionPanel onClose={() => setShowActions(false)} />}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
