import React, { useState, useEffect } from 'react';
import { 
  Cloud, CloudOff, RefreshCw, CheckCircle2, Clock, 
  AlertCircle, Trash2, X, Database, ArrowUpCircle, Wifi, WifiOff 
} from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { SyncAction } from '../types';
import { getAllSyncActions, clearAllSyncActions } from '../utils/syncQueue';

interface SyncQueueModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SyncQueueModal({ isOpen, onClose }: SyncQueueModalProps) {
  const { pendingSyncCount, isSyncing, syncNow, isOnline } = useInventory();
  const [actions, setActions] = useState<SyncAction[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(false);

  const loadActions = async () => {
    setIsLoadingList(true);
    try {
      const list = await getAllSyncActions();
      setActions(list);
    } catch (err) {
      console.error('Error loading sync actions:', err);
    } finally {
      setIsLoadingList(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadActions();
    }
  }, [isOpen, pendingSyncCount, isSyncing]);

  if (!isOpen) return null;

  const handleClearQueue = async () => {
    if (window.confirm('¿Seguro que deseas vaciar la cola de sincronización? Las acciones locales no enviadas a Firebase se descartarán.')) {
      await clearAllSyncActions();
      await loadActions();
    }
  };

  const getActionBadge = (type: string) => {
    switch (type) {
      case 'SAVE_CUSTOMER':
      case 'DELETE_CUSTOMER':
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">Cliente</span>;
      case 'ADD_SALE':
      case 'CANCEL_SALE':
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">Venta</span>;
      case 'SAVE_PRODUCT':
      case 'DELETE_PRODUCT':
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">Producto</span>;
      case 'UPDATE_INSTALLMENTS':
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">Cuotas</span>;
      default:
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">Ajustes</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] border border-slate-200/80"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-2xl ${isOnline ? 'bg-indigo-50 text-indigo-600' : 'bg-amber-50 text-amber-600'}`}>
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                Cola de Sincronización
                {pendingSyncCount > 0 && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 font-extrabold">
                    {pendingSyncCount} {pendingSyncCount === 1 ? 'pendiente' : 'pendientes'}
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                {isOnline ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span className="text-emerald-700 font-semibold">En línea (conectado a Firebase)</span>
                  </>
                ) : (
                  <>
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                    <span className="text-amber-700 font-semibold">Sin conexión (guardando en IndexedDB)</span>
                  </>
                )}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
            title="Cerrar ventana"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {/* Status Alert */}
          {!isOnline && (
            <div className="bg-amber-50 border border-amber-200/80 rounded-2xl p-3.5 flex items-start gap-3">
              <WifiOff className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-900 space-y-1">
                <p className="font-bold">Modo fuera de línea activo</p>
                <p className="text-amber-800 leading-relaxed">
                  Cualquier cliente nuevo, venta o producto creado ahora se almacenará de manera segura en tu navegador (IndexedDB) y se enviará automáticamente a Firebase en cuanto se restablezca la conexión a internet.
                </p>
              </div>
            </div>
          )}

          {isOnline && pendingSyncCount > 0 && (
            <div className="bg-indigo-50 border border-indigo-200/80 rounded-2xl p-3.5 flex items-start gap-3">
              <ArrowUpCircle className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
              <div className="text-xs text-indigo-900 space-y-1">
                <p className="font-bold">Acciones pendientes listas para sincronizar</p>
                <p className="text-indigo-800 leading-relaxed">
                  Hay {pendingSyncCount} operación(es) realizadas sin conexión que se están enviando a Firebase.
                </p>
              </div>
            </div>
          )}

          {/* Action List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-500 px-1">
              <span>Registro de operaciones ({actions.length})</span>
              {actions.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearQueue}
                  className="text-rose-600 hover:text-rose-700 flex items-center gap-1 text-[11px] font-semibold hover:underline cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                  Vaciar cola
                </button>
              )}
            </div>

            {isLoadingList ? (
              <div className="p-8 text-center text-slate-400">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
                <p className="text-xs font-semibold">Consultando IndexedDB...</p>
              </div>
            ) : actions.length === 0 ? (
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-8 text-center space-y-2">
                <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-bold text-slate-900">¡Todo sincronizado con Firebase!</h4>
                <p className="text-xs text-slate-500 max-w-xs mx-auto">
                  No hay acciones pendientes en la cola local de IndexedDB. Tus datos están completamente al día con la nube.
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {actions.map((act) => (
                  <div 
                    key={act.id}
                    className="p-3 bg-white border border-slate-200/90 rounded-2xl flex flex-col gap-1.5 shadow-2xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {getActionBadge(act.type)}
                        <span className="text-xs font-bold text-slate-900">
                          {act.description}
                        </span>
                      </div>
                      
                      <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                        act.status === 'syncing'
                          ? 'bg-blue-100 text-blue-700 animate-pulse'
                          : act.status === 'failed'
                          ? 'bg-rose-100 text-rose-700'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {act.status === 'syncing' ? 'Sincronizando...' : act.status === 'failed' ? `Reintento #${act.attempts}` : 'En cola'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(act.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                      {act.lastError && (
                        <span className="text-rose-600 text-[10px] font-semibold truncate max-w-[200px]" title={act.lastError}>
                          {act.lastError}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer Toolbar */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={loadActions}
            disabled={isLoadingList}
            className="px-3 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200/80 active:bg-slate-300 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingList ? 'animate-spin' : ''}`} />
            Refrescar
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-200/70 transition-colors cursor-pointer"
            >
              Cerrar
            </button>

            <button
              type="button"
              onClick={() => syncNow()}
              disabled={!isOnline || isSyncing || pendingSyncCount === 0}
              className="px-4 py-2.5 rounded-xl text-xs font-extrabold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 transition-all flex items-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-95"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Sincronizando...' : 'Sincronizar ahora'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
