import React from 'react';
import { Sale, Installment } from '../../types';
import { formatCurrency, getDueDateDetails } from '../../utils';
import { 
  Clock, Calendar, AlertCircle, CheckCircle2, MessageSquare, 
  Copy, Receipt, DollarSign 
} from 'lucide-react';

export interface InstallmentRowItem {
  sale: Sale;
  installment: Installment;
  paidAmount: number;
  remainingAmount: number;
  dueInfo: ReturnType<typeof getDueDateDetails>;
  totalSalePending: number;
  totalSaleInstallments: number;
}

interface ReceivableCardProps {
  key?: string;
  item: InstallmentRowItem;
  onSendReminder: (item: InstallmentRowItem) => void;
  onCopyMessage: (item: InstallmentRowItem) => void;
  onViewReceipt: (sale: Sale) => void;
  onOpenPayment: (sale: Sale, installment: Installment) => void;
}

export function ReceivableCard({
  item,
  onSendReminder,
  onCopyMessage,
  onViewReceipt,
  onOpenPayment,
}: ReceivableCardProps) {
  const isFullyPaid = item.remainingAmount <= 0.01;
  const percentPaid = item.installment.amount > 0 
    ? Math.min(100, Math.round((item.paidAmount / item.installment.amount) * 100))
    : 100;
  const hasPartialPayment = item.paidAmount > 0 && !isFullyPaid;

  return (
    <div 
      className={`bg-white rounded-2xl border transition-all p-4 sm:p-5 shadow-2xs hover:shadow-xs space-y-3.5 ${
        item.dueInfo.isOverdue && !isFullyPaid 
          ? 'border-rose-200/90 bg-rose-50/15' 
          : item.dueInfo.isToday && !isFullyPaid
          ? 'border-amber-200/90 bg-amber-50/15'
          : isFullyPaid
          ? 'border-slate-200/70 bg-slate-50/30 opacity-80'
          : 'border-slate-200/90'
      }`}
    >
      {/* Header Row: Customer Info & Status Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-start sm:items-center gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
            isFullyPaid 
              ? 'bg-emerald-100 text-emerald-800' 
              : item.dueInfo.isOverdue 
              ? 'bg-rose-100 text-rose-800' 
              : item.dueInfo.isToday
              ? 'bg-amber-100 text-amber-800'
              : 'bg-indigo-50 text-indigo-700'
          }`}>
            #{item.installment.number}
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold text-slate-900">
                {item.sale.customerName || 'Cliente sin nombre'}
              </span>
              {item.sale.customerPhone && (
                <span className="text-xs text-slate-500 font-mono">
                  • {item.sale.customerPhone}
                </span>
              )}
            </div>
            
            <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5 flex-wrap">
              <button
                type="button"
                onClick={() => onViewReceipt(item.sale)}
                className="font-mono font-semibold text-indigo-600 hover:text-indigo-800 hover:underline inline-flex items-center gap-0.5 cursor-pointer"
                title="Ver tirilla de la compra"
              >
                Factura #{item.sale.id.slice(0, 6).toUpperCase()}
              </button>
              <span>• Venta del {new Date(item.sale.date).toLocaleDateString()}</span>
              <span>• Cuota {item.installment.number} de {item.totalSaleInstallments}</span>
            </div>
          </div>
        </div>

        {/* Due date badge */}
        <div>
          {isFullyPaid ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Pagada completamente
            </span>
          ) : item.dueInfo.isOverdue ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
              <Clock className="w-3.5 h-3.5 text-rose-600" />
              {item.dueInfo.statusLabel} ({item.dueInfo.shortFormattedDate})
            </span>
          ) : item.dueInfo.isToday ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
              <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
              Vence hoy ({item.dueInfo.shortFormattedDate})
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              {item.dueInfo.statusLabel} ({item.dueInfo.shortFormattedDate})
            </span>
          )}
        </div>
      </div>

      {/* Financial Details Box */}
      <div className="bg-slate-50/90 rounded-xl p-3 border border-slate-200/70 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4 sm:gap-6 flex-wrap">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Valor Cuota
            </span>
            <span className="font-mono font-bold text-xs sm:text-sm text-slate-800">
              {formatCurrency(item.installment.amount)}
            </span>
          </div>

          <div>
            <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">
              Abonado
            </span>
            <span className="font-mono font-bold text-xs sm:text-sm text-emerald-700">
              {formatCurrency(item.paidAmount)}
            </span>
          </div>

          <div>
            <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block">
              Saldo Por Cobrar
            </span>
            <span className={`font-mono font-black text-sm sm:text-base ${
              isFullyPaid ? 'text-emerald-700' : 'text-amber-800'
            }`}>
              {formatCurrency(item.remainingAmount)}
            </span>
          </div>
        </div>

        {/* Partial progress bar */}
        {hasPartialPayment && (
          <div className="w-full sm:w-48 space-y-1">
            <div className="flex justify-between text-[10px] font-bold text-slate-500">
              <span>Abonado: {percentPaid}%</span>
              <span className="text-amber-700">Resta: {formatCurrency(item.remainingAmount)}</span>
            </div>
            <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
              <div 
                className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                style={{ width: `${percentPaid}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-2 border-t border-slate-100">
        <div className="flex items-center gap-2 flex-wrap">
          {/* WhatsApp Reminder Button */}
          {!isFullyPaid && (
            <div className="inline-flex items-stretch rounded-2xl shadow-2xs border border-emerald-300/80 bg-emerald-50 overflow-hidden flex-1 sm:flex-initial">
              <button
                type="button"
                onClick={() => onSendReminder(item)}
                className="min-h-[44px] px-3.5 py-2.5 text-xs font-extrabold text-emerald-800 hover:bg-emerald-100/90 active:bg-emerald-200 transition-all cursor-pointer flex items-center justify-center gap-2 flex-1 sm:flex-initial select-none"
                title="Enviar recordatorio automático por WhatsApp"
              >
                <MessageSquare className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Recordar Pago</span>
              </button>
              <button
                type="button"
                onClick={() => onCopyMessage(item)}
                className="min-h-[44px] min-w-[44px] px-2.5 flex items-center justify-center hover:bg-emerald-100/90 active:bg-emerald-200 text-emerald-700 border-l border-emerald-300/70 transition-all cursor-pointer select-none"
                title="Copiar texto del recordatorio"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* View Receipt Button */}
          <button
            type="button"
            onClick={() => onViewReceipt(item.sale)}
            className="min-h-[44px] px-3.5 py-2.5 rounded-2xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200/90 active:bg-slate-300 transition-all cursor-pointer flex items-center justify-center gap-2 select-none flex-1 sm:flex-initial"
          >
            <Receipt className="w-4 h-4 text-slate-500 shrink-0" />
            <span>Ver Tirilla</span>
          </button>
        </div>

        {/* Payment Button */}
        <div className="flex items-stretch sm:items-center gap-2 sm:ml-auto">
          {!isFullyPaid ? (
            <button
              type="button"
              onClick={() => onOpenPayment(item.sale, item.installment)}
              className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-extrabold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 shadow-md shadow-indigo-600/20 transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-98 select-none"
            >
              <DollarSign className="w-4 h-4" />
              <span>Abonar / Pagar</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onOpenPayment(item.sale, item.installment)}
              className="w-full sm:w-auto min-h-[44px] px-4 py-2.5 rounded-2xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 transition-all cursor-pointer flex items-center justify-center gap-1.5 select-none"
              title="Ver detalles o historial de abonos"
            >
              <span>Ver Abonos</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
