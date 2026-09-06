import React from 'react';
import { Sale } from '../../types';
import { formatCurrency } from '../../utils';
import { AlertTriangle } from 'lucide-react';

interface CancelSaleModalProps {
  sale: Sale | null;
  onClose: () => void;
  onConfirmCancel: (saleId: string) => void;
}

export function CancelSaleModal({ sale, onClose, onConfirmCancel }: CancelSaleModalProps) {
  if (!sale) return null;

  return (
    <div 
      id="modal-confirm-cancel-sale"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200"
    >
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden p-6 animate-in zoom-in-95 duration-200 border border-slate-100">
        <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-red-50 text-red-600 rounded-2xl">
          <AlertTriangle className="w-6 h-6" />
        </div>

        <h3 className="text-lg font-bold text-center text-slate-900 mb-2">
          ¿Deseas anular esta venta?
        </h3>

        <p className="text-xs text-center text-slate-500 mb-4 leading-relaxed">
          Estás a punto de anular la <strong className="text-slate-700">Factura #{sale.id.slice(0, 6).toUpperCase()}</strong> por un valor de <strong className="text-indigo-600">{formatCurrency(sale.total)}</strong>.
        </p>

        <div className="bg-amber-50 border border-amber-200/60 rounded-2xl p-3 mb-5 text-[11px] text-amber-800 font-medium">
          Al confirmar, los productos se devolverán automáticamente al stock del inventario.
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            id="btn-confirm-cancel-no"
            type="button"
            onClick={onClose}
            className="w-full py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-xl transition-colors cursor-pointer"
          >
            No, volver
          </button>

          <button
            id="btn-confirm-cancel-si"
            type="button"
            onClick={() => {
              onConfirmCancel(sale.id);
              onClose();
            }}
            className="w-full py-3 px-4 bg-red-600 hover:bg-red-700 text-white font-bold text-sm rounded-xl transition-colors shadow-lg shadow-red-600/20 cursor-pointer"
          >
            Sí, anular
          </button>
        </div>
      </div>
    </div>
  );
}
