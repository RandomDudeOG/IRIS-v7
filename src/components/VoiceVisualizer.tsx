import React, { useEffect, useRef } from 'react';

interface VoiceVisualizerProps {
  isActive: boolean;
  isSpeaking: boolean;
  audioLevel: number;
}

const VoiceVisualizer: React.FC<VoiceVisualizerProps> = ({ isActive, isSpeaking, audioLevel }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scaleRef = useRef(1);
  const smoothedLevelRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    let animationFrameId: number;
    let time = 0;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      
      // Smooth audio level
      smoothedLevelRef.current += (audioLevel - smoothedLevelRef.current) * 0.2;
      const level = smoothedLevelRef.current;

      const baseScale = isSpeaking ? 1.2 : (isActive ? 1.0 : 0.85);
      // React to audio level
      const dynamicScale = baseScale + (level * 0.5); 
      
      scaleRef.current += (dynamicScale - scaleRef.current) * 0.1;
      
      const pulseSpeed = isSpeaking ? 0.25 : 0.06;
      // Use level for pulse intensity if speaking, otherwise idle pulse
      const pulseIntensity = isSpeaking ? (10 + level * 50) : 6;
      const pulse = Math.sin(time * pulseSpeed) * pulseIntensity;
      
      const baseRadius = (110 + pulse) * scaleRef.current;
      
      const cyan = isSpeaking ? '#f43f5e' : '#22d3ee';
      const bloomColor = isSpeaking ? 'rgba(244, 63, 94,' : 'rgba(34, 211, 238,';

      if (!isActive) ctx.globalAlpha = 0.25;

      // --- 1. DEEP AMBIENT BLOOM ---
      if (isActive) {
        ctx.save();
        const bloomR = baseRadius * 2.8;
        const bloomGrad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, bloomR);
        bloomGrad.addColorStop(0, `${bloomColor} 0.18)`);
        bloomGrad.addColorStop(0.5, `${bloomColor} 0.04)`);
        bloomGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = bloomGrad;
        ctx.beginPath();
        ctx.arc(centerX, centerY, bloomR, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // --- 2. ROTATING HUD RINGS ---
      const drawHUDCircle = (r: number, rotation: number, dash: number[] | null, color: string, width: number = 1) => {
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(rotation);
        ctx.beginPath();
        ctx.arc(0, 0, r * scaleRef.current, 0, Math.PI * 2);
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        if (dash) ctx.setLineDash(dash);
        ctx.stroke();
        ctx.restore();
      };

      // Outer rings
      drawHUDCircle(baseRadius + 60, time * 0.003, [1, 25], `${cyan}44`);
      drawHUDCircle(baseRadius + 80, -time * 0.001, [150, 40], `${cyan}11`, 2);
      drawHUDCircle(baseRadius + 120, time * 0.005, [2, 10], `${cyan}22`);

      // --- 3. DYNAMIC SENSOR ARCS ---
      const drawArcs = (rotation: number, r: number, count: number, angle: number) => {
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(rotation);
        ctx.strokeStyle = cyan;
        ctx.lineWidth = 1.5;
        for (let i = 0; i < count; i++) {
          ctx.beginPath();
          ctx.arc(0, 0, r * scaleRef.current, i * (Math.PI * 2 / count), i * (Math.PI * 2 / count) + angle);
          ctx.stroke();
        }
        ctx.restore();
      };

      drawArcs(time * 0.01, baseRadius + 30, 4, 0.4);
      drawArcs(-time * 0.008, baseRadius + 45, 8, 0.1);

      // --- 4. CENTER HUD CROSSHAIR ---
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(time * 0.005);
      ctx.strokeStyle = cyan;
      ctx.lineWidth = 1;
      const bracketSize = 120 * scaleRef.current;
      const bracketLen = 25 * scaleRef.current;
      for (let i = 0; i < 4; i++) {
        ctx.rotate(Math.PI / 2);
        ctx.beginPath();
        ctx.moveTo(bracketSize - bracketLen, bracketSize);
        ctx.lineTo(bracketSize, bracketSize);
        ctx.lineTo(bracketSize, bracketSize - bracketLen);
        ctx.stroke();
      }
      ctx.restore();

      // --- 5. THE CORE ---
      const coreR = 15 * scaleRef.current;
      const coreGrad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, coreR * 3);
      coreGrad.addColorStop(0, cyan);
      coreGrad.addColorStop(1, 'transparent');
      
      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.arc(centerX, centerY, coreR * 3, 0, Math.PI * 2);
      ctx.fill();

      // Inner solid core
      ctx.fillStyle = cyan;
      ctx.beginPath();
      ctx.arc(centerX, centerY, coreR, 0, Math.PI * 2);
      ctx.fill();

      // Core pulsing lines
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(-time * 0.02);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-coreR * 0.6, 0);
      ctx.lineTo(coreR * 0.6, 0);
      ctx.stroke();
      ctx.restore();

      time += 1;
      animationFrameId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationFrameId);
  }, [isActive, isSpeaking, audioLevel]);

  return (
    <div className="relative w-full h-full flex items-center justify-center pointer-events-none transition-all duration-1000">
      <canvas 
        ref={canvasRef} 
        width={1000} 
        height={1000} 
        className="w-full h-full object-contain filter drop-shadow-[0_0_50px_rgba(34,211,238,0.3)]"
      />
      
      <div className={`absolute flex flex-col items-center justify-center transition-all duration-1000 ${isActive ? 'opacity-100 scale-100' : 'opacity-10 scale-90'}`}>
        <div className="relative group">
             <span className={`text-cyan-400 font-display text-[28px] md:text-[36px] tracking-[1.4em] transition-all duration-700 font-bold select-none ${isSpeaking ? 'scale-110 drop-shadow-[0_0_30px_rgba(244,63,94,1)] text-rose-500' : 'drop-shadow-[0_0_15px_rgba(34,211,238,0.8)]'}`}>IRIS</span>
        </div>
        <div className="flex gap-10 mt-6 overflow-hidden">
            <span className={`text-[8px] font-mono tracking-[0.8em] uppercase transition-all duration-500 border-b border-white/5 pb-1 ${isSpeaking ? 'text-rose-400' : 'text-cyan-400/40'}`}>Grid_Locked</span>
            <span className={`text-[8px] font-mono tracking-[0.8em] uppercase transition-all duration-500 border-b border-white/5 pb-1 ${isSpeaking ? 'text-rose-500' : 'text-cyan-400/40'}`}>Neural_Uplink</span>
        </div>
      </div>
    </div>
  );
};

export default VoiceVisualizer;
