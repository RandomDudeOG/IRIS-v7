import { useEffect, useState } from "react";
import { motion } from "motion/react";

const BOOT_SEQUENCE = [
  "INITIALIZING KERNEL...",
  "MOUNTING FILE SYSTEM...",
  "LOADING BIOMETRIC MODULES...",
  "CONNECTING TO NEURAL NET...",
  "CALIBRATING SENSORS...",
  "SYSTEM READY."
];

export default function LoadingScreen({ onComplete }: { onComplete: () => void }) {
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    let delay = 0;
    BOOT_SEQUENCE.forEach((step, index) => {
      delay += Math.random() * 500 + 300;
      setTimeout(() => {
        setLogs((prev) => [...prev, `> ${step}`]);
        if (index === BOOT_SEQUENCE.length - 1) {
          setTimeout(onComplete, 800);
        }
      }, delay);
    });
  }, [onComplete]);

  return (
    <div className="fixed inset-0 bg-iris-black flex flex-col items-center justify-center font-mono text-iris-cyan p-8 z-50">
      <div className="w-full max-w-md border border-iris-cyan/30 p-4 rounded bg-black/50 backdrop-blur-sm">
        <div className="flex justify-between items-center mb-4 border-b border-iris-cyan/30 pb-2">
          <span className="text-xs font-bold tracking-widest">IRIS_OS v1.0</span>
          <div className="flex gap-1">
            <div className="w-2 h-2 bg-iris-cyan rounded-full animate-pulse"></div>
            <div className="w-2 h-2 bg-iris-cyan/50 rounded-full"></div>
            <div className="w-2 h-2 bg-iris-cyan/20 rounded-full"></div>
          </div>
        </div>
        
        <div className="h-48 overflow-y-auto font-mono text-sm space-y-1">
          {logs.map((log, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="text-iris-cyan/80"
            >
              {log}
            </motion.div>
          ))}
          <div className="animate-pulse">_</div>
        </div>
      </div>
    </div>
  );
}
