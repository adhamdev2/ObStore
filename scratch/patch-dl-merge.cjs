const fs = require('fs');

let c = fs.readFileSync('app/lib/DownloadContext.tsx', 'utf8');

c = c.replace(
  `    const flushPending = () => {
      rafId = null;
      setDownloads(prev => ({ ...prev, ...pendingRef.current }));
      pendingRef.current = {};
    };`,
  `    const flushPending = () => {
      rafId = null;
      setDownloads(prev => {
        const next = { ...prev };
        for (const [id, update] of Object.entries(pendingRef.current)) {
          next[id] = { ...next[id], ...update };
        }
        return next;
      });
      pendingRef.current = {};
    };`
);

// Also remove the destructive defaults in pendingRef assignment so we don't overwrite good data with undefined/0
c = c.replace(
  `        const progress = Math.floor(data.progress || 0);
        pendingRef.current[data.downloadId] = {
          ...pendingRef.current[data.downloadId],
          downloadId: data.downloadId,
          modName: data.modName || "Downloading...",
          progress,
          status: data.status || 'downloading',
          speed: data.speed || 0,
          downloadedBytes: data.downloadedBytes || 0,
          totalBytes: data.totalBytes || 0,
          chunks: data.chunks || 1,
        };`,
  `        pendingRef.current[data.downloadId] = {
          ...pendingRef.current[data.downloadId],
          ...data,
          progress: Math.floor(data.progress || 0),
        };
        // Remove undefined values to avoid overwriting existing valid state with undefined
        Object.keys(pendingRef.current[data.downloadId]).forEach(key => {
          if (pendingRef.current[data.downloadId][key] === undefined) {
            delete pendingRef.current[data.downloadId][key];
          }
        });`
);

fs.writeFileSync('app/lib/DownloadContext.tsx', c, 'utf8');
console.log('Patched DownloadContext');
