import React from 'react';
import { formatCurrency } from '../../utils';
import { CreditCard, ShieldAlert, Clock, Calendar, CheckCircle2 } from 'lucide-react';

interface ReceivablesKPIsProps {
  totalPortfolioPending: number;
  pendingCount: number;
  totalOverdue: number;
  overdueCount: number;
  totalDueThisWeek: number;
  dueThisWeekCount: number;
  totalPaidCollected: number;
}

export function ReceivablesKPIs({
  totalPortfolioPending,
  pendingCount,
  totalOverdue,
  overdueCount,
  totalDueThisWeek,
  dueThisWeekCount,
  totalPaidCollected,
}: ReceivablesKPIsProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {/* Total Cartera */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs relative overflow-hidden">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Cartera Total</span>
          <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
            <CreditCard className="w-4 h-4" />
          </div>
        </div>
        <div className="text-lg sm:text-2xl font-mono font-bold text-slate-900">
          {formatCurrency(totalPortfolioPending)}
        </div>
        <p className="text-[11px] text-slate-400 mt-1">
          {pendingCount} cuotas por cobrar
        </p>
      </div>

      {/* En Mora (Vencidas) */}
      <div className={`p-4 rounded-2xl border shadow-xs transition-colors ${
        overdueCount > 0 
          ? 'bg-rose-50/70 border-rose-200 text-rose-950' 
          : 'bg-white border-slate-200/80 text-slate-900'
      }`}>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] font-bold text-rose-600 uppercase tracking-wider flex items-center gap-1">
            <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
            En Mora (Vencidas)
          </span>
          <div className="p-1.5 bg-rose-100 text-rose-700 rounded-lg">
            <Clock className="w-4 h-4" />
          </div>
        </div>
        <div className="text-lg sm:text-2xl font-mono font-bold text-rose-700">
          {formatCurrency(totalOverdue)}
        </div>
        <p className="text-[11px] text-rose-600/80 font-medium mt-1">
          {overdueCount === 0 ? 'Sin cuotas vencidas 🎉' : `${overdueCount} cuotas requieren cobro`}
        </p>
      </div>

      {/* Vencen esta Semana */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">Próximos 7 Días</span>
          <div className="p-1.5 bg-amber-50 text-amber-600 rounded-lg">
            <Calendar className="w-4 h-4" />
          </div>
        </div>
        <div className="text-lg sm:text-2xl font-mono font-bold text-amber-700">
          {formatCurrency(totalDueThisWeek)}
        </div>
        <p className="text-[11px] text-slate-400 mt-1">
          {dueThisWeekCount} cuotas por vencer
        </p>
      </div>

      {/* Total Recaudado */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Abonos Recaudados</span>
          <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>
        <div className="text-lg sm:text-2xl font-mono font-bold text-emerald-700">
          {formatCurrency(totalPaidCollected)}
        </div>
        <p className="text-[11px] text-slate-400 mt-1">
          Total pagado en créditos
        </p>
      </div>
    </div>
  );
}
