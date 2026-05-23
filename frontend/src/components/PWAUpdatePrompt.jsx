import { useRegisterSW } from "virtual:pwa-register/react";
import { Button } from "./ui/button";
import { RefreshCw, WifiOff } from "lucide-react";

const PWAUpdatePrompt = () => {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError(err) {
      console.error("SW registration error:", err);
    },
  });

  const dismiss = () => {
    setOfflineReady(false);
    setNeedRefresh(false);
  };

  if (!needRefresh && !offlineReady) return null;

  return (
    <div
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 max-w-md w-[calc(100%-2rem)] bg-card border rounded-xl shadow-lg p-4 flex items-center gap-3"
      role="status"
      aria-live="polite"
      data-testid="pwa-update-prompt"
    >
      {needRefresh ? (
        <>
          <RefreshCw className="h-5 w-5 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Yeni sürüm hazır</p>
            <p className="text-xs text-muted-foreground">Yenile diyince son sürüm yüklenir.</p>
          </div>
          <Button size="sm" onClick={() => updateServiceWorker(true)} data-testid="pwa-reload">
            Yenile
          </Button>
          <Button size="sm" variant="ghost" onClick={dismiss} data-testid="pwa-dismiss">
            Sonra
          </Button>
        </>
      ) : (
        <>
          <WifiOff className="h-5 w-5 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Çevrimdışı kullanıma hazır</p>
            <p className="text-xs text-muted-foreground">İnternet kesilse bile uygulama açılır.</p>
          </div>
          <Button size="sm" variant="ghost" onClick={dismiss} data-testid="pwa-dismiss">
            Tamam
          </Button>
        </>
      )}
    </div>
  );
};

export default PWAUpdatePrompt;
