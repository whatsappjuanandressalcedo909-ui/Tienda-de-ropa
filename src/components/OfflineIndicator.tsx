import React, { useEffect, useState, useRef } from 'react';
import { WifiOff, Wifi, RefreshCw, CheckCircle2, Database } from 'lucide-react';
import { useInventory } from '../context/InventoryContext';

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

interface OfflineIndicatorProps {
  onOpenSyncModal?: () => void;
}

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({ onOpenSyncModal }) => {
  const isOnline = useOnlineStatus();
  const { pendingSyncCount, isSyncing } = useInventory();
  
  const [wasOffline, setWasOffline] = useState(false);
  const [showReconnectedBanner, setShowReconnectedBanner] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isOnline) {
      setWasOffline(true);
      setShowReconnectedBanner(false);
      if (timerRef.current) clearTimeout(timerRef.current);
    } else if (wasOffline && isOnline) {
      // Just reconnected
      setShowReconnectedBanner(true);
      timerRef.current = setTimeout(() => {
        setShowReconnectedBanner(false);
        setWasOffline(false);
      }, 5000);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isOnline, wasOffline]);

  // If online and not showing the temporary reconnection banner, do not render
  if (isOnline && !showReconnectedBanner && !isSyncing) {
    return null;
  }

  // State 1: Reconnected & Syncing
  if (isOnline && isSyncing) {
    return (
      <div 
        onClick={onOpenSyncModal}
        className="fixed bottom-20 left-4 right-4 md:left-auto md:right-4 md:bottom-6 z-50 flex items-center justify-center gap-2.5 rounded-2xl bg-indigo-600/95 backdrop-blur-md px-4 py-2.5 text-xs font-bold text-white shadow-xl animate-in slide-in-from-bottom-4 duration-300 cursor-pointer hover:bg-indigo-700 transition-all border border-indigo-400/40"
      >
        <RefreshCw className="w-4 h-4 shrink-0 animate-spin text-white" />
        <span>Conectado — Sincronizando {pendingSyncCount} acción(es) con Firebase...</span>
      </div>
    );
  }

  // State 2: Just Reconnected and all synced
  if (isOnline && showReconnectedBanner) {
    return (
      <div 
        onClick={onOpenSyncModal}
        className="fixed bottom-20 left-4 right-4 md:left-auto md:right-4 md:bottom-6 z-50 flex items-center justify-center gap-2.5 rounded-2xl bg-emerald-600/95 backdrop-blur-md px-4 py-2.5 text-xs font-bold text-white shadow-xl animate-in slide-in-from-bottom-4 duration-300 cursor-pointer border border-emerald-400/40"
      >
        <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-200" />
        <span>¡Conexión restablecida! Todo sincronizado con Firebase</span>
      </div>
    );
  }

  // State 3: Offline mode
  return (
    <div 
      onClick={onOpenSyncModal}
      className="fixed bottom-20 left-4 right-4 md:left-auto md:right-4 md:bottom-6 z-50 flex items-center justify-center gap-2.5 rounded-2xl bg-amber-600/95 backdrop-blur-md px-4 py-2.5 text-xs font-bold text-white shadow-xl animate-in slide-in-from-bottom-4 duration-300 cursor-pointer hover:bg-amber-700 transition-all border border-amber-400/40"
      title="Clic para ver la cola de sincronización"
    >
      <WifiOff className="w-4 h-4 shrink-0 animate-pulse text-amber-200" />
      <span>
        {pendingSyncCount > 0
          ? `Sin conexión — ${pendingSyncCount} acción(es) en cola de IndexedDB`
          : 'Modo sin conexión — PWA activa con datos locales'}
      </span>
      {pendingSyncCount > 0 && (
        <span className="ml-1 bg-white/20 text-white px-1.5 py-0.5 rounded-md text-[10px] font-black">
          Ver cola
        </span>
      )}
    </div>
  );
};
