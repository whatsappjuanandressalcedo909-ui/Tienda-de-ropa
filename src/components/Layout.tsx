import React, { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate, Link } from 'react-router-dom';
import { Package, ShoppingCart, Settings, Plus, Users, CreditCard, ShieldCheck, LogOut, Database, RefreshCw, WifiOff } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useInventory } from '../context/InventoryContext';
import { useAuth } from '../context/AuthContext';
import { PWAInstallButton } from './PWAInstallButton';
import { OfflineIndicator } from './OfflineIndicator';
import { SyncQueueModal } from './SyncQueueModal';

export function Layout() {
  const { sales, pendingSyncCount, isSyncing, isOnline } = useInventory();
  const { user, isAdmin, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const isFormOpen = location.pathname.includes('/product/');
  const isInventory = location.pathname === '/';

  // Count overdue installments for badge notification
  const overdueCount = React.useMemo(() => {
    let count = 0;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    sales.forEach(sale => {
      if (sale.status === 'completed' && sale.installmentList) {
        sale.installmentList.forEach(inst => {
          const isPending = inst.status === 'pending' && (inst.paidAmount === undefined || inst.paidAmount < inst.amount - 0.01);
          if (isPending) {
            const due = new Date(inst.dueDate);
            const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime();
            if (dueDay < today) {
              count++;
            }
          }
        });
      }
    });
    return count;
  }, [sales]);

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-24 md:pb-8 selection:bg-indigo-100 flex flex-col md:flex-row">
      {/* 
        DESKTOP SIDEBAR 
        We hide the top bar on desktop and use a sleek sidebar for better wide-screen distribution.
      */}
      <aside className="hidden md:flex flex-col w-64 bg-white/85 backdrop-blur-2xl border-r border-slate-200/60 fixed top-0 bottom-0 left-0 z-40">
        <div className="p-6 flex items-center gap-3 border-b border-slate-100/80">
          <div className="bg-indigo-600 p-2.5 rounded-2xl shadow-xs">
            <Package className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight leading-none">
            MAISOFT
          </h1>
        </div>
        
        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          {[
            { to: "/", icon: Package, label: "Productos", exact: true },
            { to: "/sales", icon: ShoppingCart, label: "Ventas" },
            { to: "/receivables", icon: CreditCard, label: "Cartera", badge: overdueCount },
            { to: "/customers", icon: Users, label: "Clientes" },
            { to: "/settings", icon: Settings, label: "Ajustes" }
          ].map((item) => (
            <NavLink 
              key={item.to}
              to={item.to}
              end={item.exact}
              className={({isActive}) => `flex items-center gap-3 px-3.5 py-3 rounded-2xl font-bold transition-all relative ${
                isActive ? 'text-indigo-600 bg-indigo-50/80' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              {({isActive}) => (
                <>
                  <item.icon className={`w-5 h-5 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                  <span className="flex-1">{item.label}</span>
                  {item.badge && item.badge > 0 && (
                    <span className="bg-rose-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full shadow-xs">
                      {item.badge}
                    </span>
                  )}
                  {isActive && (
                    <motion.div 
                      layoutId="desktop-active-indicator"
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-indigo-600 rounded-r-full"
                    />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-100/80 space-y-2">
          {/* Sync Queue Status Button */}
          <button
            type="button"
            onClick={() => setIsSyncModalOpen(true)}
            className={`w-full flex items-center justify-between p-2.5 rounded-2xl border transition-all cursor-pointer select-none text-left ${
              !isOnline 
                ? 'bg-amber-50/80 border-amber-200/80 text-amber-900 hover:bg-amber-100/80' 
                : pendingSyncCount > 0 
                ? 'bg-indigo-50/80 border-indigo-200/80 text-indigo-900 hover:bg-indigo-100/80'
                : 'bg-slate-50 border-slate-100 text-slate-600 hover:bg-slate-100'
            }`}
            title="Ver cola de sincronización IndexedDB"
          >
            <div className="flex items-center gap-2">
              <Database className={`w-4 h-4 ${!isOnline ? 'text-amber-600' : pendingSyncCount > 0 ? 'text-indigo-600' : 'text-slate-400'}`} />
              <div className="flex flex-col">
                <span className="text-[11px] font-bold leading-tight">
                  {!isOnline ? 'Modo Offline' : isSyncing ? 'Sincronizando...' : 'IndexedDB Sync'}
                </span>
                <span className="text-[9px] text-slate-400 leading-tight">
                  {pendingSyncCount > 0 ? `${pendingSyncCount} en cola` : 'Al día con Firebase'}
                </span>
              </div>
            </div>

            {pendingSyncCount > 0 ? (
              <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-full bg-amber-500 text-white animate-pulse">
                {pendingSyncCount}
              </span>
            ) : (
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            )}
          </button>

          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span className="text-xs font-bold text-emerald-900">Gerencia</span>
            </div>
            <button
              onClick={() => logout()}
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all cursor-pointer"
              title="Cerrar sesión"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* 
        MOBILE TOP BAR
      */}
      <header className="md:hidden bg-white/85 backdrop-blur-xl border-b border-slate-200/60 sticky top-0 z-30">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="bg-indigo-600 p-2 rounded-xl shadow-xs">
              <Package className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-base font-black text-slate-900 tracking-tight leading-none">
                MAISOFT
              </h1>
              <span className="text-[9px] font-bold text-indigo-600 tracking-wider uppercase block">
                Sistema
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Mobile Sync Queue trigger */}
            <button
              type="button"
              onClick={() => setIsSyncModalOpen(true)}
              className={`relative w-8 h-8 flex items-center justify-center rounded-xl border transition-transform active:scale-95 cursor-pointer ${
                !isOnline
                  ? 'bg-amber-50 border-amber-300 text-amber-700'
                  : pendingSyncCount > 0
                  ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                  : 'bg-slate-50 border-slate-200 text-slate-500'
              }`}
              title="Cola de sincronización"
            >
              {!isOnline ? (
                <WifiOff className="w-4 h-4" />
              ) : isSyncing ? (
                <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" />
              ) : (
                <Database className="w-4 h-4" />
              )}
              {pendingSyncCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-amber-500 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center border-2 border-white shadow-2xs">
                  {pendingSyncCount}
                </span>
              )}
            </button>

            <Link 
              to="/login/admin"
              className="w-8 h-8 flex items-center justify-center bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-xl active:scale-95 transition-transform"
            >
              <ShieldCheck className="w-4 h-4" />
            </Link>
            <button
              onClick={() => logout()}
              className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors active:scale-95"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* 
        MAIN CONTENT AREA
        Renders routes immediately without blocking exit animations or opacity lag.
      */}
      <main className="flex-1 md:ml-64 max-w-5xl mx-auto w-full px-3.5 sm:px-6 lg:px-8 py-4 sm:py-6 overflow-x-hidden">
        <Outlet />
      </main>

      {/* Touch-Friendly Ergonomic Bottom Navigation Bar for Mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-2xl border-t border-slate-200/80 z-40 pb-safe shadow-[0_-4px_20px_rgba(0,0,0,0.04)]">
        <div className="flex justify-around items-center h-[70px] px-2 max-w-md mx-auto">
          {[
            { to: "/", icon: Package, label: "Inicio", exact: true },
            { to: "/sales", icon: ShoppingCart, label: "Ventas" },
            { to: "/receivables", icon: CreditCard, label: "Cartera", badge: overdueCount },
            { to: "/customers", icon: Users, label: "Clientes" },
            { to: "/settings", icon: Settings, label: "Ajustes" }
          ].map((item) => (
            <NavLink 
              key={item.to}
              to={item.to}
              end={item.exact}
              className="relative flex flex-col items-center justify-center min-w-[56px] min-h-[52px] py-1 px-1 rounded-2xl transition-all active:scale-90 select-none z-10"
            >
              {({isActive}) => (
                <>
                  {/* Animated background pill for active state */}
                  {isActive && (
                    <motion.div 
                      layoutId="mobile-active-indicator"
                      className="absolute inset-0 bg-indigo-50/80 rounded-2xl -z-10"
                      transition={{ type: "spring", stiffness: 350, damping: 30 }}
                    />
                  )}
                  
                  <div className="relative">
                    <item.icon className={`w-5 h-5 mb-1 transition-colors ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                    {item.badge && item.badge > 0 && (
                      <span className="absolute -top-1.5 -right-2 bg-rose-500 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center border-2 border-white shadow-2xs">
                        {item.badge > 9 ? '9+' : item.badge}
                      </span>
                    )}
                  </div>
                  <span className={`text-[10px] leading-tight font-bold transition-colors ${isActive ? 'text-indigo-700' : 'text-slate-500'}`}>
                    {item.label}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>

      {/* Ergonomic Floating Action Button on Inventory */}
      {isInventory && (
        <motion.button
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => navigate('/product/new')}
          className="md:hidden fixed bottom-[88px] right-4 w-14 h-14 bg-indigo-600 text-white rounded-2xl shadow-[0_8px_25px_rgba(79,70,229,0.4)] flex items-center justify-center z-30 cursor-pointer"
          aria-label="Añadir Producto"
        >
          <Plus className="w-7 h-7" />
        </motion.button>
      )}

      {/* Offline Alert for Mobile PWA */}
      <OfflineIndicator onOpenSyncModal={() => setIsSyncModalOpen(true)} />

      {/* Sync Queue Modal */}
      <SyncQueueModal 
        isOpen={isSyncModalOpen} 
        onClose={() => setIsSyncModalOpen(false)} 
      />
    </div>
  );
}
