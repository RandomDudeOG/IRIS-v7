import { useState } from "react";
import type { FormEvent } from "react";
import { FolderPlus, FilePlus, X } from "lucide-react";
import { motion } from "motion/react";

export default function ActionPanel({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<"FILE" | "FOLDER">("FILE");
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [status, setStatus] = useState<"IDLE" | "LOADING" | "SUCCESS" | "ERROR">("IDLE");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setStatus("LOADING");

    try {
      const endpoint = mode === "FILE" ? "/api/actions/create-file" : "/api/actions/create-folder";
      const body = mode === "FILE" ? { name, content } : { name };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error("Action failed");

      setStatus("SUCCESS");
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err) {
      setStatus("ERROR");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-iris-black border border-iris-cyan w-full max-w-lg p-6 rounded-xl shadow-[0_0_50px_rgba(0,240,255,0.1)] font-mono"
      >
        <div className="flex justify-between items-center mb-6 border-b border-iris-cyan/20 pb-4">
          <h2 className="text-xl text-iris-cyan font-display tracking-widest">SYSTEM ACTIONS</h2>
          <button onClick={onClose} className="text-iris-cyan/50 hover:text-iris-cyan">
            <X />
          </button>
        </div>

        <div className="flex gap-4 mb-6">
          <button
            onClick={() => setMode("FILE")}
            className={`flex-1 py-3 border ${mode === "FILE" ? "bg-iris-cyan text-black border-iris-cyan" : "border-iris-cyan/30 text-iris-cyan/50"} transition-all uppercase tracking-widest text-sm font-bold flex items-center justify-center gap-2`}
          >
            <FilePlus size={16} /> Create File
          </button>
          <button
            onClick={() => setMode("FOLDER")}
            className={`flex-1 py-3 border ${mode === "FOLDER" ? "bg-iris-cyan text-black border-iris-cyan" : "border-iris-cyan/30 text-iris-cyan/50"} transition-all uppercase tracking-widest text-sm font-bold flex items-center justify-center gap-2`}
          >
            <FolderPlus size={16} /> Create Folder
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-iris-cyan/50 mb-1 uppercase tracking-widest">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-black/50 border border-iris-cyan/30 p-3 text-iris-cyan focus:outline-none focus:border-iris-cyan transition-colors"
              placeholder={mode === "FILE" ? "example.txt" : "New Folder"}
              required
            />
          </div>

          {mode === "FILE" && (
            <div>
              <label className="block text-xs text-iris-cyan/50 mb-1 uppercase tracking-widest">Content</label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full h-32 bg-black/50 border border-iris-cyan/30 p-3 text-iris-cyan focus:outline-none focus:border-iris-cyan transition-colors font-mono text-sm"
                placeholder="File content..."
              />
            </div>
          )}

          <div className="pt-4">
            <button
              type="submit"
              disabled={status === "LOADING"}
              className="w-full py-4 bg-iris-cyan/10 border border-iris-cyan text-iris-cyan hover:bg-iris-cyan hover:text-black transition-all uppercase tracking-[0.2em] font-bold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {status === "LOADING" ? "EXECUTING..." : status === "SUCCESS" ? "COMPLETE" : status === "ERROR" ? "FAILED" : "EXECUTE"}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
