import { motion, AnimatePresence } from "motion/react";
import { Terminal, Database, FileText, Folder } from "lucide-react";

export default function ToolHud({ toolName }: { toolName: string | null }) {
  return (
    <AnimatePresence>
      {toolName && (
        <motion.div
          initial={{ x: 300, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 300, opacity: 0 }}
          className="fixed right-8 top-24 w-64 bg-black/80 border border-iris-cyan/30 backdrop-blur-md p-4 rounded-lg shadow-lg z-40 font-mono"
        >
          <div className="flex items-center gap-2 mb-2 border-b border-iris-cyan/20 pb-2">
            <Terminal className="w-4 h-4 text-iris-cyan" />
            <span className="text-xs font-bold text-iris-cyan tracking-widest">SYSTEM_OP</span>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-iris-cyan/80">
              {toolName.includes("file") ? <FileText className="w-5 h-5" /> : 
               toolName.includes("folder") ? <Folder className="w-5 h-5" /> : 
               <Database className="w-5 h-5" />}
              <span className="text-sm uppercase">{toolName.replace(/_/g, " ")}</span>
            </div>
            
            <div className="h-1 w-full bg-iris-cyan/10 rounded overflow-hidden">
              <motion.div 
                className="h-full bg-iris-cyan"
                animate={{ x: ["-100%", "100%"] }}
                transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
              />
            </div>
            
            <div className="text-[10px] text-iris-cyan/50 font-mono">
              EXECUTING REMOTE PROCEDURE...
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
