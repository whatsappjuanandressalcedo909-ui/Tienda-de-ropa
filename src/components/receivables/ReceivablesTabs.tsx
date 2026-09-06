import React from 'react';

export type FilterTab = 'pending' | 'overdue' | 'today' | 'this-week' | 'upcoming' | 'paid';

interface ReceivablesTabsProps {
  activeTab: FilterTab;
  onTabChange: (tab: FilterTab) => void;
  pendingCount: number;
  overdueCount: number;
  dueTodayCount: number;
  dueThisWeekCount: number;
}

export function ReceivablesTabs({
  activeTab,
  onTabChange,
  pendingCount,
  overdueCount,
  dueTodayCount,
  dueThisWeekCount,
}: ReceivablesTabsProps) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-200/80 no-scrollbar -mx-3.5 px-3.5 sm:mx-0 sm:px-0">
      <button
        type="button"
        onClick={() => onTabChange('pending')}
        className={`min-h-[44px] px-4 py-2.5 rounded-2xl text-xs font-bold whitespace-nowrap transition-all active:scale-95 cursor-pointer flex items-center gap-2 ${
          activeTab === 'pending'
            ? 'bg-slate-900 text-white shadow-sm'
            : 'text-slate-600 hover:text-slate-900 bg-white border border-slate-200/80 hover:bg-slate-50'
        }`}
      >
        Todas las Pendientes
        <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${
          activeTab === 'pending' ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-700'
        }`}>
          {pendingCount}
        </span>
      </button>

      <button
        type="button"
        onClick={() => onTabChange('overdue')}
        className={`min-h-[44px] px-4 py-2.5 rounded-2xl text-xs font-bold whitespace-nowrap transition-all active:scale-95 cursor-pointer flex items-center gap-2 ${
          activeTab === 'overdue'
            ? 'bg-rose-600 text-white shadow-sm'
            : 'text-rose-700 bg-rose-50 hover:bg-rose-100/80 border border-rose-200/60'
        }`}
      >
        🚨 En Mora (Vencidas)
        {overdueCount > 0 && (
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-white text-rose-700 font-black shadow-2xs">
            {overdueCount}
          </span>
        )}
      </button>

      <button
        type="button"
        onClick={() => onTabChange('today')}
        className={`min-h-[44px] px-4 py-2.5 rounded-2xl text-xs font-bold whitespace-nowrap transition-all active:scale-95 cursor-pointer flex items-center gap-2 ${
          activeTab === 'today'
            ? 'bg-amber-600 text-white shadow-sm'
            : 'text-amber-800 bg-amber-50 hover:bg-amber-100/80 border border-amber-200/60'
        }`}
      >
        Vencen Hoy
        {dueTodayCount > 0 && (
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-200/80 text-amber-900 font-bold">
            {dueTodayCount}
          </span>
        )}
      </button>

      <button
        type="button"
        onClick={() => onTabChange('this-week')}
        className={`min-h-[44px] px-4 py-2.5 rounded-2xl text-xs font-bold whitespace-nowrap transition-all active:scale-95 cursor-pointer flex items-center gap-2 ${
          activeTab === 'this-week'
            ? 'bg-indigo-600 text-white shadow-sm'
            : 'text-slate-600 hover:text-slate-900 bg-white border border-slate-200/80 hover:bg-slate-50'
        }`}
      >
        Esta Semana ({dueThisWeekCount})
      </button>

      <button
        type="button"
        onClick={() => onTabChange('upcoming')}
        className={`min-h-[44px] px-4 py-2.5 rounded-2xl text-xs font-bold whitespace-nowrap transition-all active:scale-95 cursor-pointer ${
          activeTab === 'upcoming'
            ? 'bg-slate-900 text-white shadow-sm'
            : 'text-slate-600 hover:text-slate-900 bg-white border border-slate-200/80 hover:bg-slate-50'
        }`}
      >
        Futuras
      </button>

      <button
        type="button"
        onClick={() => onTabChange('paid')}
        className={`min-h-[44px] px-4 py-2.5 rounded-2xl text-xs font-bold whitespace-nowrap transition-all active:scale-95 cursor-pointer ${
          activeTab === 'paid'
            ? 'bg-emerald-700 text-white shadow-sm'
            : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-200/60'
        }`}
      >
        Pagadas
      </button>
    </div>
  );
}
