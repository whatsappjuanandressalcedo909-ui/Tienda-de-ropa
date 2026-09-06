import React from 'react';
import { Sale } from '../../types';
import { formatCurrency, getInstallmentSummary } from '../../utils';
import { User, Phone, MessageSquare, Receipt } from 'lucide-react';

interface SaleListItemProps {
  key?: string;
  sale: Sale;
  onSendReminder: (sale: Sale) => void;
  onViewReceipt: (sale: Sale) => void;
  onCancelSale: (sale: Sale) => void;
}

export function SaleListItem({
  sale,
  onSendReminder,
  onViewReceipt,
  onCancelSale,
}: SaleListItemProps) {
  const summ = getInstallmentSummary(sale);

  return (
    <div className={`p-4 sm:p-5 rounded-3xl border transition-all ${sale.status === 'cancelled' ? 'bg-red-50/40 border-red-100 opacity-75' : 'bg-white border-slate-100/80 shadow-[0_2px_12px_rgba(0,0,0,0.02)]'}`}>
      <div className="flex justify-between items-start mb-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs font-bold text-slate-900">
              #{sale.id.slice(0, 6).toUpperCase()}
            </span>
            {sale.status === 'cancelled' ? (
              <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider">
                Anulada
              </span>
            ) : (
              <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider">
                Completada
              </span>
            )}
            {sale.paymentMethod && (
              <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[10px] uppercase font-bold">
                {sale.paymentMethod === 'credit' ? `Crédito (${sale.installments} meses)` : 'Contado'}
              </span>
            )}
          </div>

          {/* Customer Info Badge */}
          {sale.customerName ? (
            <div className="flex items-center gap-1.5 mt-1 text-xs text-indigo-600 font-semibold">
              <User className="w-3.5 h-3.5" />
              <span>Cliente: <strong>{sale.customerName}</strong></span>
              {sale.customerEmail && (
                <span className="text-slate-400 font-normal">({sale.customerEmail})</span>
              )}
            </div>
          ) : (
            <p className="text-[11px] text-slate-400 mt-1">Cliente Ocasional</p>
          )}

          <p className="text-xs font-medium text-slate-500 mt-1 flex items-center gap-2">
            <span>{new Date(sale.date).toLocaleString()}</span>
            {sale.customerPhone && (
              <span className="text-emerald-600 font-bold flex items-center gap-1">
                <Phone className="w-3 h-3" /> {sale.customerPhone}
              </span>
            )}
          </p>
        </div>

        <div className="text-right">
          <p className={`font-black text-lg ${sale.status === 'cancelled' ? 'text-slate-400 line-through' : 'text-indigo-600'}`}>
            {formatCurrency(sale.total)}
          </p>
        </div>
      </div>
      
      <div className="space-y-1.5 mb-4">
        {sale.items?.map((item, idx) => (
          <div key={idx} className="flex justify-between text-xs text-slate-600">
            <span>{item.quantity}x {item.productName}</span>
            <span className="text-slate-900 font-medium">{formatCurrency(item.subtotal)}</span>
          </div>
        ))}
        {!sale.items && (
          <div className="flex justify-between text-xs text-slate-600">
            <span>{(sale as any).quantity}x {(sale as any).productName}</span>
            <span className="text-slate-900 font-medium">{formatCurrency(sale.total)}</span>
          </div>
        )}
      </div>

      {sale.status === 'completed' && (
        <div className="flex flex-wrap items-center justify-between pt-2.5 border-t border-slate-50 gap-2">
          <div className="text-[11px] text-slate-500 font-medium">
            {sale.paymentMethod === 'credit' ? (
              summ.isFullyPaid ? (
                <span className="text-emerald-700 font-bold">✓ {summ.totalCount}/{summ.totalCount} cuotas pagadas</span>
              ) : (
                <span className="text-amber-800 font-bold">{summ.paidCount}/{summ.totalCount} pagadas (Por pagar: {formatCurrency(summ.totalPending)})</span>
              )
            ) : (
              <span className="text-emerald-700 font-bold">✓ Pagado al contado</span>
            )}
          </div>

          <div className="flex items-center gap-2 ml-auto flex-wrap w-full sm:w-auto pt-1 sm:pt-0">
            {sale.paymentMethod === 'credit' && !summ.isFullyPaid && (
              <button 
                type="button"
                onClick={() => onSendReminder(sale)}
                className="min-h-[44px] flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-200 px-3.5 py-2.5 rounded-2xl transition-all cursor-pointer border border-emerald-300 shadow-2xs active:scale-95 select-none"
                title="Enviar recordatorio de pago por WhatsApp"
              >
                <MessageSquare className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Recordar Pago</span>
              </button>
            )}

            <button 
              type="button"
              onClick={() => onViewReceipt(sale)}
              className="min-h-[44px] flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 text-xs font-bold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 active:bg-indigo-200 px-3.5 py-2.5 rounded-2xl transition-all cursor-pointer border border-indigo-200 active:scale-95 select-none"
            >
              <Receipt className="w-4 h-4 text-indigo-600 shrink-0" />
              <span>Ver Tirilla</span>
            </button>

            <button 
              id={`btn-cancel-sale-${sale.id}`}
              onClick={() => onCancelSale(sale)}
              className="min-h-[44px] text-xs font-bold text-red-500 hover:text-red-700 hover:bg-red-50 active:bg-red-100 px-3 py-2 rounded-2xl transition-all cursor-pointer select-none"
            >
              Anular Venta
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
