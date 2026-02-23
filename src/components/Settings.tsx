import React, { useState, useEffect, useRef } from 'react';
import { ApiKey } from '../types';
import { generateUUID } from '../utils/audio';
import { irisStore as IrisStorage } from '../storage/local';
import { SavedFace, ServiceAccountCreds } from '../storage/types';
import { analyzeFace } from '../utils/faces';
import { DriveClient } from '../storage/drive';

interface SettingsProps {
  apiKeys: ApiKey[];
  onAddKey: (name: string, value: string) => void;
  onRemoveKey: (id: string) => void;
  onClose: () => void;
  soundsEnabled: boolean;
  onToggleSounds: () => void;
  isCameraActive: boolean;
  onToggleCamera: () => void;
}

// Safe Env Accessor
const getEnvKey = () => {
  try {
    return process.env.GEMINI_API_KEY || "";
  } catch (e) {
    return "";
  }
};

const Settings: React.FC<SettingsProps> = ({ 
  apiKeys = [], // Default to empty array to prevent crash
  onAddKey, 
  onRemoveKey, 
  onClose, 
  soundsEnabled, 
  onToggleSounds,
  isCameraActive,
  onToggleCamera
}) => {
  // New State for Master Key
  const [masterKey, setMasterKey] = useState('');
  
  const [newName, setNewName] = useState('');
  const [newValue, setNewValue] = useState('');
  const [savedFaces, setSavedFaces] = useState<SavedFace[]>([]);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  
  // Cloud State
  const [cloudMode, setCloudMode] = useState<'BACKEND' | 'SIMULATED'>('SIMULATED');
  const [backendUrl, setBackendUrl] = useState('http://localhost:3000');
  const [cloudStatus, setCloudStatus] = useState('OFFLINE');
  const [serviceAccountEmail, setServiceAccountEmail] = useState('');
  const [rootFolderId, setRootFolderId] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSavedFaces(IrisStorage.getFaces());
    setMasterKey(IrisStorage.getMasterKey()); // Load master key
    
    const cfg = IrisStorage.getCloudConfig();
    
    // 1. Initial State from Storage
    if (cfg.enabled) {
        setCloudMode(cfg.mode);
        if (cfg.backendUrl) setBackendUrl(cfg.backendUrl);
        if (cfg.rootFolderId) setRootFolderId(cfg.rootFolderId);
        
        if (cfg.mode === 'SIMULATED' && cfg.serviceAccount) {
            setCloudStatus('LINKED (SIM)');
            setServiceAccountEmail(cfg.serviceAccount.client_email);
        } else if (cfg.mode === 'BACKEND') {
            setCloudStatus('CONFIGURED');
        }
    }
  }, []);

  const handleMasterKeyChange = (val: string) => {
    setMasterKey(val);
    IrisStorage.saveMasterKey(val);
  };

  const handleRootFolderChange = (val: string) => {
      setRootFolderId(val);
      IrisStorage.updateCloudConfig({ rootFolderId: val });
  };

  const handleJsonUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (event) => {
          try {
              const text = event.target?.result as string;
              const json = JSON.parse(text);
              if (!json.client_email || !json.private_key) {
                  alert("Invalid JSON Key.");
                  return;
              }

              const creds: ServiceAccountCreds = {
                  client_email: json.client_email,
                  private_key: json.private_key,
                  project_id: json.project_id
              };

              setCloudStatus('CONNECTING...');
              setServiceAccountEmail(creds.client_email);

              // Configure Simulator
              DriveClient.configure({ mode: 'SIMULATED', serviceAccount: creds, rootFolderId });
              const success = await DriveClient.init();

              if (success) {
                  setCloudStatus('ONLINE (SIM)');
                  IrisStorage.updateCloudConfig({ enabled: true, mode: 'SIMULATED', serviceAccount: creds, rootFolderId });
                  await IrisStorage.syncWithCloud();
              } else {
                  setCloudStatus('ERROR');
                  alert("Could not connect to Drive. Check permissions.");
              }

          } catch (err) {
              console.error(err);
              setCloudStatus("PARSE ERROR");
          }
      };
      reader.readAsText(file);
  };

  const connectBackend = async () => {
      setCloudStatus('PINGING...');
      DriveClient.configure({ mode: 'BACKEND', backendUrl, rootFolderId });
      const success = await DriveClient.init();
      if(success) {
          setCloudStatus('ONLINE (API)');
          IrisStorage.updateCloudConfig({ enabled: true, mode: 'BACKEND', backendUrl, rootFolderId });
          await IrisStorage.syncWithCloud();
      } else {
          setCloudStatus('OFFLINE');
      }
  };

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const MAX_DIM = 600; 
          if (width > height) { if (width > MAX_DIM) { height *= MAX_DIM / width; width = MAX_DIM; } } else { if (height > MAX_DIM) { width *= MAX_DIM / height; height = MAX_DIM; } }
          canvas.width = width; canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.7).split('base64,')[1]);
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsProcessingImage(true);
    try {
        const base64 = await compressImage(file);
        const newFace = await analyzeFace(base64);
        // Pass base64 image to storage
        const storedFace = IrisStorage.addFace(newFace.label, newFace.descriptor, base64); 
        setSavedFaces(prev => [...prev, storedFace]);
    } catch (err) {
        alert("Face detection failed.");
    } finally {
        setIsProcessingImage(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeFace = (id: string) => {
      IrisStorage.removeFace(id);
      setSavedFaces(prev => prev.filter(f => f.id !== id));
  };

  const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if(newName && newValue) { onAddKey(newName, newValue); setNewName(''); setNewValue(''); }
  };

  const envKey = getEnvKey();
  const hasEnvKey = envKey.length > 0;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="w-full max-w-lg bg-slate-900 border border-cyan-500/30 rounded-xl overflow-hidden shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar">
        <div className="p-6 border-b border-cyan-500/20 flex justify-between items-center sticky top-0 bg-slate-900 z-10">
          <h2 className="font-display text-lg text-cyan-400 tracking-wider uppercase">Modular Matrix</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>

        <div className="p-6 space-y-6">

          {/* MASTER KEY CONFIG */}
          <div className="p-4 bg-rose-950/20 border border-rose-500/20 rounded-xl space-y-3">
             <div className="flex justify-between items-center">
                <h3 className="text-[10px] font-display text-rose-400 uppercase tracking-widest">GEMINI API KEY (REQUIRED)</h3>
                {hasEnvKey ? (
                    <span className="text-[8px] font-mono bg-green-900/40 text-green-400 px-2 py-0.5 rounded tracking-widest uppercase">ENV LOADED</span>
                ) : (
                    <span className="text-[8px] font-mono bg-yellow-900/40 text-yellow-400 px-2 py-0.5 rounded tracking-widest uppercase">MANUAL ENTRY</span>
                )}
             </div>
             <input 
                type="password" 
                value={masterKey}
                onChange={(e) => handleMasterKeyChange(e.target.value)}
                placeholder={hasEnvKey ? "Key loaded from environment (.env)" : "Paste your Gemini API Key here..."}
                className="w-full bg-slate-950 border border-rose-900/50 rounded px-3 py-2 text-[10px] text-rose-100 font-mono focus:border-rose-500 focus:outline-none placeholder-slate-600"
             />
          </div>

          {/* CLOUD STORAGE (FIX FOR QUOTA ERROR) */}
          <div className="p-4 bg-cyan-950/20 border border-cyan-500/10 rounded-xl space-y-3">
             <div className="flex justify-between items-center">
                <h3 className="text-[10px] font-display text-cyan-400 uppercase tracking-widest">Biometric Storage Link</h3>
                <span className={`text-[8px] font-mono uppercase tracking-widest px-2 py-0.5 rounded ${cloudStatus.startsWith('ONLINE') || cloudStatus.includes('LINKED') ? 'bg-cyan-500/20 text-cyan-400' : 'bg-red-500/20 text-red-500'}`}>
                    {cloudStatus}
                </span>
             </div>
             
             {/* Toggle Mode */}
             <div className="flex gap-2 text-[9px] font-mono">
                 <button 
                   onClick={() => setCloudMode('SIMULATED')} 
                   className={`flex-1 py-1 rounded border ${cloudMode === 'SIMULATED' ? 'bg-cyan-500/20 border-cyan-500 text-cyan-400' : 'border-slate-700 text-slate-500'}`}
                 >
                   DEV: LOCAL SIMULATION
                 </button>
                 <button 
                   onClick={() => setCloudMode('BACKEND')} 
                   className={`flex-1 py-1 rounded border ${cloudMode === 'BACKEND' ? 'bg-cyan-500/20 border-cyan-500 text-cyan-400' : 'border-slate-700 text-slate-500'}`}
                 >
                   PROD: BACKEND API
                 </button>
             </div>

             {/* SHARED FOLDER ID INPUT (THE FIX) */}
             <div className="space-y-1 pt-2 border-t border-cyan-900/30">
                 <label className="text-[9px] font-display text-slate-400 uppercase">Google Drive Root Folder ID (Shared)</label>
                 <input 
                    type="text" 
                    value={rootFolderId}
                    onChange={(e) => handleRootFolderChange(e.target.value)}
                    placeholder="e.g. 1A2b3C..."
                    className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-[10px] text-cyan-50 font-mono"
                 />
                 <p className="text-[8px] text-slate-500 leading-tight">
                    Required if you get "No Storage Quota" errors. Create a folder in your Drive, 
                    share it with 
                    <span className="text-cyan-600 px-1">{serviceAccountEmail || 'the service account'}</span>, 
                    and paste the Folder ID here.
                 </p>
             </div>

             {/* Mode Content */}
             {cloudMode === 'SIMULATED' ? (
                 <div className="space-y-2 pt-2">
                     <p className="text-[9px] text-slate-500">Upload 'service-account.json' to simulate backend logic in-browser.</p>
                     {serviceAccountEmail && <div className="text-[9px] text-cyan-500 font-mono">{serviceAccountEmail}</div>}
                     <button 
                        onClick={() => jsonInputRef.current?.click()}
                        className="w-full bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 rounded px-3 py-2 text-[9px] uppercase tracking-widest"
                     >
                        Select JSON Key File
                     </button>
                     <input type="file" ref={jsonInputRef} accept=".json" className="hidden" onChange={handleJsonUpload} />
                 </div>
             ) : (
                 <div className="space-y-2 pt-2">
                     <div className="flex gap-2">
                         <input 
                            type="text" 
                            value={backendUrl}
                            onChange={(e) => setBackendUrl(e.target.value)}
                            className="flex-1 bg-slate-800 border border-slate-700 rounded px-3 py-1 text-[10px] text-cyan-50 font-mono"
                            placeholder="http://localhost:3000"
                         />
                         <button 
                            onClick={connectBackend}
                            className="bg-cyan-600/20 hover:bg-cyan-600/40 text-cyan-400 border border-cyan-500/30 rounded px-3 text-[9px] uppercase"
                         >
                            Connect
                         </button>
                     </div>
                 </div>
             )}
          </div>

          {/* Biometric Grid */}
          <div className="p-4 bg-slate-950/40 border border-slate-800 rounded-xl space-y-4">
             <div className="flex justify-between items-center">
                <span className="text-[10px] font-display text-cyan-400/80 uppercase tracking-widest">Biometric Database</span>
                <div className={`px-2 py-1 rounded text-[8px] font-bold tracking-widest uppercase ${savedFaces.length > 0 ? 'bg-cyan-900/30 text-cyan-400 border border-cyan-500/30' : 'bg-slate-800 text-slate-500'}`}>
                  {savedFaces.length} RECORDS
                </div>
             </div>
             <div className="grid grid-cols-4 gap-2">
                 {savedFaces.map((face) => (
                     <div key={face.id} className="relative group aspect-square rounded-lg overflow-hidden border border-slate-700 bg-slate-900">
                         <img src={`data:image/jpeg;base64,${face.image}`} alt="Face" className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" />
                         <button 
                            onClick={() => removeFace(face.id)}
                            className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-all text-rose-500"
                         >
                             <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                         </button>
                     </div>
                 ))}
                 <button 
                    onClick={() => !isProcessingImage && fileInputRef.current?.click()}
                    className="aspect-square flex flex-col items-center justify-center border border-dashed border-slate-700 rounded-lg hover:border-cyan-500/50 hover:bg-cyan-950/20 transition-all group disabled:opacity-50"
                    disabled={isProcessingImage}
                 >
                     {isProcessingImage ? (
                        <div className="w-5 h-5 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
                     ) : (
                        <svg className="w-6 h-6 text-slate-600 group-hover:text-cyan-400 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                     )}
                 </button>
                 <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} />
             </div>
          </div>
          
           <div className="flex items-center justify-between p-4 bg-slate-950/40 border border-slate-800 rounded-xl">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-display text-cyan-400/80 uppercase tracking-widest">Acoustic Feedback</span>
            </div>
            <button 
              onClick={onToggleSounds}
              className={`w-12 h-5 rounded-full relative transition-all duration-300 border ${soundsEnabled ? 'bg-cyan-500/20 border-cyan-500/40' : 'bg-slate-800 border-slate-700'}`}
            >
              <div className={`absolute top-0.5 h-3.5 w-3.5 rounded-full transition-all duration-300 ${soundsEnabled ? 'right-1 bg-cyan-400' : 'left-1 bg-slate-600'}`}></div>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
             <h3 className="text-[10px] font-display text-slate-500 uppercase tracking-widest px-1">External API Connectors</h3>
            <div className="grid grid-cols-2 gap-4">
              <input type="text" placeholder="Service (e.g. Spotify)" className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-[10px] text-cyan-50" value={newName} onChange={(e) => setNewName(e.target.value)} />
              <input type="password" placeholder="Key / Token" className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-[10px] text-cyan-50" value={newValue} onChange={(e) => setNewValue(e.target.value)} />
            </div>
            <button type="submit" className="w-full bg-cyan-600/10 hover:bg-cyan-500/20 border border-cyan-500/20 text-cyan-400 font-display py-2 rounded-lg text-[9px] uppercase">Add Connector</button>
          </form>

           <div className="space-y-3 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
            {apiKeys.map((key) => (
              <div key={key.id} className="flex items-center justify-between p-3 bg-slate-800/30 border border-slate-700/30 rounded-lg group">
                <div className="flex items-center gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-cyan-500/50 animate-pulse"></div>
                  <div><p className="text-[10px] font-medium text-slate-300 uppercase">{key.name}</p></div>
                </div>
                <button onClick={() => onRemoveKey(key.id)} className="text-red-500/40 hover:text-red-400">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                </button>
              </div>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
};

export default Settings;
