import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Info, 
  Trash2, 
  Tags, 
  Ruler, 
  X, 
  Plus, 
  Smartphone, 
  ShieldCheck, 
  LogIn, 
  LogOut, 
  Database, 
  Download, 
  Upload,
  Wifi,
  WifiOff,
  Activity,
  RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useInventory } from '../context/InventoryContext';
import { useAuth } from '../context/AuthContext';
import { PWAInstallButton } from '../components/PWAInstallButton';
import { BackupManagerModal } from '../components/BackupManagerModal';
import { getDocFromServer, doc } from 'firebase/firestore';
import { db } from '../firebase';

interface ManageListModalProps {
  title: string;
  items: string[];
  onAdd: (item: string) => void;
  onRemove: (item: string) => void;
  onClose: () => void;
  renderExtraActions?: (item: string) => React.ReactNode;
}

function ManageListModal({ title, items, onAdd, onRemove, onClose, renderExtraActions }: ManageListModalProps) {
  const [newValue, setNewValue] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newValue.trim()) {
      onAdd(newValue.trim());
      setNewValue('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-t-[2rem] sm:rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col max-h-[80vh] sm:max-h-[90vh] animate-in slide-in-from-bottom-8 sm:slide-in-from-bottom-4 duration-300">
        <div className="w-full flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-12 h-1.5 bg-slate-200 rounded-full"></div>
        </div>

        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white">
          <h2 className="text-xl font-bold text-slate-800 tracking-tight">{title}</h2>
          <button 
            type="button"
            onClick={onClose}
            className="p-2.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex-1 space-y-2">
          {items.length === 0 && (
            <p className="text-center text-sm text-slate-500 py-4">No hay elementos.</p>
          )}
          {items.map(item => (
            <div key={item} className="flex items-center justify-between bg-slate-50 p-3 rounded-2xl border border-slate-100">
              <span className="font-bold text-slate-800 text-sm">{item}</span>
              <div className="flex items-center gap-1">
                {renderExtraActions && renderExtraActions(item)}
                <button
                  type="button"
                  onClick={() => onRemove(item)}
                  className="min-w-[40px] min-h-[40px] flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 active:scale-95 rounded-xl transition-colors cursor-pointer"
                  title="Eliminar"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="p-4 bg-white border-t border-slate-100">
          <div className="flex gap-2">
            <input
              type="text"
              value={newValue}
              onChange={e => setNewValue(e.target.value)}
              placeholder={`Añadir nuevo...`}
              className="flex-1 px-4 py-3 min-h-[48px] bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-base sm:text-sm"
            />
            <button
              type="submit"
              disabled={!newValue.trim()}
              className="min-h-[48px] min-w-[48px] bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white p-3 rounded-2xl transition-all flex items-center justify-center cursor-pointer active:scale-95"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DatabaseConnectionStatus() {
  const [status, setStatus] = useState<'bien' | 'interferencia' | 'desconectado' | 'comprobando'>('comprobando');
  const [lastChecked, setLastChecked] = useState<Date>(new Date());

  const checkConnection = async () => {
    setStatus('comprobando');
    
    if (!navigator.onLine) {
      setStatus('desconectado');
      setLastChecked(new Date());
      return;
    }

    const startTime = Date.now();
    try {
      // Intenta obtener un documento del servidor
      await getDocFromServer(doc(db, 'settings', 'global'));
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      if (duration > 2500) {
        setStatus('interferencia');
      } else {
        setStatus('bien');
      }
    } catch (error) {
      setStatus('desconectado');
    }
    setLastChecked(new Date());
  };

  useEffect(() => {
    checkConnection();
    const interval = setInterval(checkConnection, 5 * 60 * 1000); // Cada 5 mins

    // También re-verificar cuando recuperamos conexión a internet
    window.addEventListener('online', checkConnection);
    window.addEventListener('offline', checkConnection);

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', checkConnection);
      window.removeEventListener('offline', checkConnection);
    };
  }, []);

  let statusConfig = {
    icon: <Activity className="w-5 h-5 text-slate-400 animate-pulse" />,
    text: 'Comprobando conexión...',
    textColor: 'text-slate-600',
    bgColor: 'bg-slate-50 border-slate-200'
  };

  if (status === 'bien') {
    statusConfig = {
      icon: <Wifi className="w-5 h-5 text-emerald-500" />,
      text: 'Conectado (Estable)',
      textColor: 'text-emerald-700',
      bgColor: 'bg-emerald-50 border-emerald-100'
    };
  } else if (status === 'interferencia') {
    statusConfig = {
      icon: <Wifi className="w-5 h-5 text-amber-500" />,
      text: 'Conectado (Interferencia / Lento)',
      textColor: 'text-amber-700',
      bgColor: 'bg-amber-50 border-amber-100'
    };
  } else if (status === 'desconectado') {
    statusConfig = {
      icon: <WifiOff className="w-5 h-5 text-red-500" />,
      text: 'Sin Conexión a Base de Datos',
      textColor: 'text-red-700',
      bgColor: 'bg-red-50 border-red-100'
    };
  }

  return (
    <div className={`p-4 rounded-3xl border ${statusConfig.bgColor} flex items-center justify-between transition-colors`}>
      <div className="flex items-center gap-4">
        <div className="bg-white p-2.5 rounded-2xl shadow-sm">
          {statusConfig.icon}
        </div>
        <div>
          <h3 className={`text-sm font-bold ${statusConfig.textColor}`}>
            {statusConfig.text}
          </h3>
          <p className="text-xs font-medium text-slate-500 mt-0.5">
            Última comprobación: {lastChecked.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
          </p>
        </div>
      </div>
      
      <button 
        onClick={checkConnection}
        disabled={status === 'comprobando'}
        className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-xl transition-all cursor-pointer active:scale-95 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
        title="Verificar conexión ahora"
      >
        <RefreshCw className={`w-4 h-4 ${status === 'comprobando' ? 'animate-spin text-indigo-500' : ''}`} />
      </button>
    </div>
  );
}

export function Settings() {
  const { 
    clearInventory, categories, sizes, addCategory, removeCategory, addSize, removeSize,
    categorySizes, addCategorySize, removeCategorySize
  } = useInventory();
  const { user, isAdmin, logout } = useAuth();
  
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isSizeModalOpen, setIsSizeModalOpen] = useState(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [selectedCategoryForSizes, setSelectedCategoryForSizes] = useState<string | null>(null);

  return (
    <div className="max-w-lg mx-auto space-y-5 animate-in fade-in duration-200">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-black text-slate-900 tracking-tight">Ajustes</h2>
        <span className="text-xs font-bold text-slate-400 bg-white border border-slate-200/80 px-2.5 py-1 rounded-xl">
          v1.0 PWA
        </span>
      </div>

      {/* Connection Status Widget */}
      <DatabaseConnectionStatus />

      {/* Backup and Restore Card */}
      <div className="bg-white rounded-3xl p-5 shadow-[0_2px_12px_rgba(0,0,0,0.02)] border border-slate-100/80 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-50 text-indigo-600">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900">Copia de Seguridad (Backup)</h3>
              <p className="text-xs text-slate-500 font-medium">
                Estructura de base de datos y registros en formato JSON
              </p>
            </div>
          </div>
          <span className="text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
            JSON
          </span>
        </div>

        <p className="text-xs text-slate-500 leading-relaxed">
          Descarga un respaldo completo con la estructura formal de tablas (prendas, clientes, ventas, categorías y tallas) o restaura una copia anterior.
        </p>

        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={() => setIsBackupModalOpen(true)}
            id="btn-open-backup-modal"
            className="flex-1 min-h-[44px] flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold text-xs px-4 py-2.5 rounded-2xl transition-all cursor-pointer select-none active:scale-95 shadow-2xs"
          >
            <Database className="w-4 h-4" />
            <span>Gestionar Backup (Exportar / Importar)</span>
          </button>
        </div>
      </div>
      
      <div className="bg-white rounded-3xl p-2 shadow-[0_2px_12px_rgba(0,0,0,0.02)] border border-slate-100/60 space-y-1">
        <button 
          onClick={() => setIsCategoryModalOpen(true)}
          className="w-full min-h-[56px] p-4 flex items-center gap-4 text-slate-700 hover:bg-slate-50 active:bg-slate-100 transition-all rounded-2xl group cursor-pointer"
        >
          <div className="bg-slate-50 group-hover:bg-indigo-50 p-3 rounded-2xl transition-colors text-slate-400 group-hover:text-indigo-600">
            <Tags className="w-5 h-5"/>
          </div>
          <div className="text-left flex-1">
            <p className="font-bold text-sm text-slate-800">Gestionar Categorías</p>
            <p className="text-xs text-slate-500 font-medium mt-0.5">{categories.length} categorías registradas</p>
          </div>
        </button>

        <button 
          onClick={() => setIsSizeModalOpen(true)}
          className="w-full min-h-[56px] p-4 flex items-center gap-4 text-slate-700 hover:bg-slate-50 active:bg-slate-100 transition-all rounded-2xl group cursor-pointer border-t border-slate-50"
        >
          <div className="bg-slate-50 group-hover:bg-indigo-50 p-3 rounded-2xl transition-colors text-slate-400 group-hover:text-indigo-600">
            <Ruler className="w-5 h-5"/>
          </div>
          <div className="text-left flex-1">
            <p className="font-bold text-sm text-slate-800">Gestionar Tallas</p>
            <p className="text-xs text-slate-500 font-medium mt-0.5">{sizes.length} tallas registradas</p>
          </div>
        </button>
      </div>

      <div className="bg-white rounded-3xl p-2 shadow-[0_2px_12px_rgba(0,0,0,0.02)] border border-slate-100/60">
        <div className="min-h-[56px] p-4 border-b border-slate-50 flex items-center gap-4 text-slate-700">
          <div className="bg-slate-50 p-3 rounded-2xl">
            <Info className="w-5 h-5 text-slate-400"/>
          </div>
          <div>
            <p className="font-bold text-sm text-slate-800">Modo de Funcionamiento</p>
            <p className="text-xs text-slate-500 font-medium mt-0.5">Sincronización en tiempo real con Firebase en la nube</p>
          </div>
        </div>
        <button 
          onClick={() => { 
            if(window.confirm('¿Estás seguro de que deseas borrar todo el inventario? Esta acción no se puede deshacer.')) {
              clearInventory();
            }
          }} 
          className="w-full min-h-[56px] p-4 flex items-center gap-4 text-red-600 hover:bg-red-50 active:bg-red-100 transition-all rounded-2xl group cursor-pointer"
        >
          <div className="bg-red-50 group-hover:bg-white p-3 rounded-2xl transition-colors">
            <Trash2 className="w-5 h-5"/>
          </div>
          <div className="text-left flex-1">
            <p className="font-bold text-sm">Borrar Base de Datos</p>
            <p className="text-xs text-red-400 font-medium mt-0.5">Eliminará todos los productos y reiniciará la app</p>
          </div>
        </button>
      </div>

      {isCategoryModalOpen && (
        <ManageListModal 
          title="Categorías" 
          items={categories} 
          onAdd={addCategory} 
          onRemove={removeCategory} 
          onClose={() => setIsCategoryModalOpen(false)} 
          renderExtraActions={(item) => (
            <button
              type="button"
              onClick={() => {
                setIsCategoryModalOpen(false);
                setSelectedCategoryForSizes(item);
              }}
              className="px-3 py-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-colors cursor-pointer"
              title={`Tallas para ${item}`}
            >
              Tallas
            </button>
          )}
        />
      )}

      {selectedCategoryForSizes && (
        <ManageListModal 
          title={`Tallas: ${selectedCategoryForSizes}`} 
          items={categorySizes[selectedCategoryForSizes] || []} 
          onAdd={(size) => addCategorySize(selectedCategoryForSizes, size)} 
          onRemove={(size) => removeCategorySize(selectedCategoryForSizes, size)} 
          onClose={() => {
            setSelectedCategoryForSizes(null);
            setIsCategoryModalOpen(true); // Return to categories modal
          }} 
        />
      )}

      {isSizeModalOpen && (
        <ManageListModal 
          title="Tallas" 
          items={sizes} 
          onAdd={addSize} 
          onRemove={removeSize} 
          onClose={() => setIsSizeModalOpen(false)} 
        />
      )}

      {/* Backup and Restore Modal */}
      <BackupManagerModal 
        isOpen={isBackupModalOpen} 
        onClose={() => setIsBackupModalOpen(false)} 
      />
    </div>
  );
}
