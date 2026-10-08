import React, { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { LogOut, LogIn, Loader2, Zap, Sparkles, HardDriveDownload, Trash2, X, Clock, CheckCircle2, DownloadCloud } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { useDownload } from "@/lib/DownloadContext";
import { useTranslation } from "@/hooks/useTranslation";

interface PathsResponse {
  paths: {
    fivemPath: string;
  };
}

export default function NavbarActions() {
  const { user, login, logout, isLoading, error } = useAuth();
  const { downloads, isDownloading, isPopoverOpen, setIsPopoverOpen, cancelDownload } = useDownload();
  const { t } = useTranslation();
  
  const [downloadItems, setDownloadItems] = useState<any[]>([]);

  const fetchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchHistory = useCallback(async () => {
    try {
      const data = await apiFetch<any[]>(`/user/downloads?t=${Date.now()}`);
      setDownloadItems(data || []);
    } catch (err) {
      console.error("Failed to fetch download history:", err);
    }
  }, []);

  // Debounced: rapid events collapse into one call after 300ms
  const fetchHistoryDebounced = useCallback(() => {
    if (fetchDebounceRef.current) clearTimeout(fetchDebounceRef.current);
    fetchDebounceRef.current = setTimeout(() => fetchHistory(), 300);
  }, [fetchHistory]);

  const handleUninstallLocal = async (id: string, type: string, itemName: string, files?: string[]) => {
    const electron = (window as any).electron;
    
    const confirmMessage = type === "version" 
      ? "هل أنت متأكد أنك تريد حذف هذا الإصدار؟ سيتم مسح ملفات citizen, plugins, mods."
      : type === "plugin"
      ? `هل أنت متأكد أنك تريد حذف بلاجن ${itemName ?? ""}؟ سيتم إزالة الملفات من مجلد plugins.`
      : "هل أنت متأكد أنك تريد حذف هذا المود؟ سيتم إزالة ملفات المود من مجلد اللعبة.";

    if (!window.confirm(confirmMessage)) return;

    try {
      if (type === "version") {
        if (user?.settings?.fivemDir && electron && electron.deleteModFolders) {
           await electron.deleteModFolders({ fivemPath: user.settings.fivemDir }).catch((e: any) => console.warn("deleteModFolders failed", e));
        }
      }
      
      if (electron && electron.uninstallMod) {
        await electron.uninstallMod({ id, files, fivemPath: user?.settings?.fivemDir }).catch((e: any) => console.warn("uninstallMod failed", e));
      }

      await apiFetch(`/user/downloads/${id}`, { method: "DELETE" });
      await fetchHistory();
      window.dispatchEvent(new Event("force-refresh-mods"));
    } catch (err) {
      console.error("Uninstallation failed:", err);
    }
  };

  useEffect(() => {
    if (user) fetchHistory();
    
    const handleRefresh = () => {
      if (user) fetchHistoryDebounced();
    };

    window.addEventListener("force-refresh-mods", handleRefresh);
    return () => window.removeEventListener("force-refresh-mods", handleRefresh);
  }, [user]);

  const handleL1 = async () => {
    try {
      const res = await apiFetch<PathsResponse>("/paths");
      const electron = window.electron;
      if (!electron?.launchFiveMFlow) {
        alert("L1 launch is only available in the desktop app.");
        return;
      }
      await electron.launchFiveMFlow({
        fivemPath: `${res.paths.fivemPath}\\FiveM.exe`,
        toolPath: `${res.paths.fivemPath}\\FiveM.app\\citizen\\platform-0000\\gr.exe`,
        input: "1"
      });
    } catch (err) {
      console.error("L1 launch failed:", err);
      alert(`FiveM launch failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleReshade = async () => {
    try {
      const res = await apiFetch<PathsResponse>("/paths");
      if ((window as any).electron?.Reshade) {
        await (window as any).electron.Reshade({
          fivemPath: res.paths.fivemPath
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const activeDownloadsList = Object.values(downloads);
  const totalActive = activeDownloadsList.length;

  return (
    <div className="xl:flex flex-row items-center gap-3 hidden">
      {user && (
        <div className="flex items-center gap-2 mr-2">
          <Button
            onClick={handleReshade}
            variant="ghost"
            className="rounded-full w-10 h-10 p-0 bg-white/5 border border-white/10 text-emerald-400 hover:text-emerald-300 hover:bg-white/10 transition-all group"
            title="ReShade"
          >
            <Sparkles size={18} className="group-hover:scale-110 transition-transform" />
          </Button>
          
          <Button
            onClick={handleL1}
            variant="ghost"
            className="rounded-full flex items-center gap-2 px-4 h-10 bg-white/5 border border-white/10 text-primary hover:bg-white/10 transition-all group"
          >
            <Zap size={16} className="group-hover:animate-pulse" />
            <span className="font-black text-[10px] uppercase tracking-wider">Pure Mode (L1)</span>
          </Button>
        </div>
      )}

      {error ? (
        <Button variant="destructive" className="rounded-full flex items-center gap-2 text-[10px]" disabled>
          <span className="font-bold">{error}</span>
        </Button>
      ) : isLoading ? (
        <Button className="rounded-full bg-primary/50 text-primary-foreground flex items-center gap-2 h-10 px-4" disabled>
          <Loader2 className="animate-spin" size={18} />
          <span className="font-bold text-[10px]">...</span>
        </Button>
      ) : user ? (
        <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-full pr-4 pl-1 p-1 h-10">
          <img 
            src={`https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`} 
            className="w-8 h-8 rounded-full border border-white/10" 
            alt="Avatar" 
            onError={(e) => e.currentTarget.style.display = 'none'}
          />
          <span className="text-white text-xs font-bold">{user.username}</span>
          <button onClick={logout} className="ml-1 text-white/40 hover:text-red-400 transition-colors" title="Logout">
            <LogOut size={16} />
          </button>
        </div>
      ) : (
        <Button onClick={login} className="rounded-full flex items-center gap-2 px-6 h-10 font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20 hover:-translate-y-0.5 transition-all">
          <LogIn size={18} />
          <span className="text-[12px]">{t.login}</span>
        </Button>
      )}

      <div className="relative">
        <Button
          onClick={() => {
            if (!isPopoverOpen) fetchHistory();
            setIsPopoverOpen(!isPopoverOpen);
          }}
          variant="ghost"
          className={`rounded-full w-10 h-10 p-0 bg-white/5 border border-white/10 transition-all group ${isPopoverOpen ? 'bg-primary/20 text-primary border-primary/30' : 'text-white hover:text-primary hover:bg-white/10'}`}
          title="Download Tracker"
        >
          {isDownloading ? (
            <div className="relative flex items-center justify-center">
              <DownloadCloud size={18} className="text-primary animate-bounce" />
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-black text-[8px] font-black rounded-full flex items-center justify-center">
                {totalActive}
              </div>
            </div>
          ) : (
            <HardDriveDownload size={18} className="group-hover:scale-110 transition-transform" />
          )}
          {downloadItems.length > 0 && !isDownloading && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-white/10 text-white/60 text-[9px] font-black rounded-full flex items-center justify-center border border-white/10">
              {downloadItems.length}
            </span>
          )}
        </Button>

        {isPopoverOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsPopoverOpen(false)} />
            <div className="absolute top-[calc(100%+12px)] right-0 w-80 bg-[#0a0a0a]/95 backdrop-blur-3xl border border-white/10 rounded-3xl p-4 shadow-2xl z-50 animate-in fade-in slide-in-from-top-2 origin-top-right">
              
              {/* Active Downloads Section */}
              {activeDownloadsList.length > 0 && (
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-3 px-2">
                    <h4 className="text-white/50 font-black text-[10px] uppercase tracking-widest">Active Processes</h4>
                    <div className="px-2 py-0.5 bg-primary/20 text-primary text-[9px] font-black rounded-full uppercase">
                      {activeDownloadsList.filter(d => d.status !== 'finished').length} Pending
                    </div>
                  </div>
                  <div className="flex flex-col gap-3">
                    {activeDownloadsList.map(dl => (
                      <div key={dl.downloadId} className="bg-white/5 border border-white/5 rounded-2xl p-3 relative overflow-hidden group">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex flex-col">
                            <span className="text-white font-bold text-xs truncate max-w-[180px]">{dl.modName}</span>
                            <span className="text-[9px] uppercase font-black tracking-tighter text-primary/60">
                              {dl.status === 'downloading' ? 'Downloading Files...' : dl.status === 'installing' ? 'Installing to FiveM...' : dl.status === 'finished' ? 'Success' : dl.status === 'queued' ? 'Waiting in Queue...' : 'Failed'}
                            </span>
                          </div>
                          {dl.status === 'finished' ? (
                             <CheckCircle2 size={14} className="text-emerald-400" />
                          ) : (
                            <button onClick={() => cancelDownload(dl.downloadId)} className="text-white/20 hover:text-red-500 transition-colors">
                              <X size={14} />
                            </button>
                          )}
                        </div>

                        {dl.status !== 'finished' && dl.status !== 'queued' && (
                          <>
                            <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden mb-1.5">
                              <div 
                                className="h-full bg-primary transition-all duration-500" 
                                style={{ width: `${dl.progress}%` }}
                              />
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-[8px] font-bold text-white/30 tabular-nums">
                                {dl.progress}% • {(dl.downloadedBytes / (1024 * 1024)).toFixed(1)}MB
                              </span>
                              <div className="flex items-center gap-1">
                                <Zap size={8} className="text-primary/40" />
                                <span className="text-[8px] font-bold text-primary/40">{(dl.speed / (1024 * 1024)).toFixed(2)} MB/s</span>
                              </div>
                            </div>
                          </>
                        )}
                        
                        {dl.status === 'queued' && (
                          <div className="flex items-center gap-2 text-white/20">
                            <Clock size={10} />
                            <span className="text-[9px] font-bold">Waiting for other tasks...</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* History Section */}
              <div className="flex items-center justify-between mb-3 px-2">
                <h4 className="text-white/50 font-black text-[10px] uppercase tracking-widest">Recently Installed</h4>
                <div className="px-2 py-0.5 bg-white/5 text-white/40 text-[9px] font-black rounded-full">
                  {downloadItems.length}
                </div>
              </div>
              
              <div className="flex flex-col gap-2 max-h-[250px] overflow-y-auto no-scrollbar pr-1">
                {downloadItems.length === 0 ? (
                  <div className="text-center py-6 text-white/20 text-[10px] font-medium italic">No items installed yet.</div>
                ) : (
                  downloadItems.map(item => (
                    <div key={item.id} className="flex justify-between items-center bg-white/5 border border-white/5 hover:border-white/10 hover:bg-white/10 rounded-2xl p-3 transition-colors group">
                      <div className="flex flex-col min-w-0 flex-1 px-1">
                        <span className="text-white font-bold text-xs truncate">{item.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-white/40 text-[8px] uppercase font-black tracking-widest">{item.type}</span>
                          <span className="text-primary/40 text-[8px] font-black uppercase">v.{item.version.slice(0, 8)}</span>
                        </div>
                      </div>
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleUninstallLocal(item.id, item.type, item.name, item.files); }}
                        className="p-2 shrink-0 text-white/20 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-all"
                        title="Uninstall"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
