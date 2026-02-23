import { AlertTriangle, RefreshCcw } from "lucide-react";
import { motion } from "motion/react";

interface ErrorOverlayProps {
  message: string;
  onRetry: () => void;
}

export default function ErrorOverlay({ message, onRetry }: ErrorOverlayProps) {
  return (
    <div className="fixed inset-0 bg-red-950/90 backdrop-blur-md flex items-center justify-center z-[100] p-8 font-mono text-iris-rose">
      <motion.div 
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        className="max-w-md w-full text-center space-y-6 border border-iris-rose p-8 bg-black/50 shadow-[0_0_50px_rgba(255,0,85,0.2)]"
      >
        <AlertTriangle className="w-16 h-16 mx-auto animate-pulse" />
        
        <div className="space-y-2">
          <h1 className="text-2xl font-display font-bold tracking-widest">CRITICAL FAILURE</h1>
          <p className="text-sm opacity-80 uppercase tracking-wider">{message}</p>
        </div>

        <div className="h-px w-full bg-iris-rose/30" />

        <button
          onClick={onRetry}
          className="px-8 py-3 border border-iris-rose hover:bg-iris-rose hover:text-black transition-colors uppercase tracking-widest text-sm font-bold flex items-center gap-2 mx-auto"
        >
          <RefreshCcw size={16} /> Reboot System
        </button>
      </motion.div>
    </div>
  );
}
