import React from 'react';
import { Customer } from '../../types';
import { formatCurrency } from '../../utils';
import { 
  ChevronRight, 
  Mail, 
  Phone, 
  Edit2, 
  Trash2, 
  Calendar, 
  Clock, 
  MessageSquare, 
  Receipt, 
  FileText, 
  ShoppingBag 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface CustomerListItemProps {
  key?: string;
  customer: Customer;
  isExpanded: boolean;
  onToggleExpand: () => void;
  stats: { totalSpent: number; purchaseCount: number; lastPurchaseDate?: string };
  creditStats?: { totalPendingDebt: number; pendingCount: number; activeCredits: number };
  onEdit: (customer: Customer) => void;
  onDelete: (customer: Customer) => void;
  onOpenHistory: (customer: Customer) => void;
  onExportPDF: (customer: Customer) => void;
  isExportingPDF: boolean;
  onNavigateToNewSale: (customerId: string) => void;
}

export function CustomerListItem({
  customer,
  isExpanded,
  onToggleExpand,
  stats,
  creditStats,
  onEdit,
  onDelete,
  onOpenHistory,
  onExportPDF,
  isExportingPDF,
  onNavigateToNewSale,
}: CustomerListItemProps) {
  const initials = `${customer.firstName?.[0] || ''}${customer.lastName?.[0] || ''}`.toUpperCase() || 'C';

  return (
    <div 
      className={`bg-white rounded-3xl border transition-all overflow-hidden ${isExpanded ? 'border-indigo-200/80 shadow-[0_4px_20px_rgba(79,70,229,0.06)]' : 'border-slate-100/80 hover:border-slate-200/80 shadow-[0_2px_12px_rgba(0,0,0,0.02)]'}`}
    >
      <div 
        onClick={onToggleExpand}
        className="p-4 sm:p-5 flex items-center justify-between cursor-pointer select-none"
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white font-bold flex items-center justify-center text-sm shadow-sm shrink-0">
            {initials}
          </div>
          <div className="flex flex-col">
            <h3 className="font-bold text-base text-slate-900 leading-tight">
              {customer.firstName} {customer.lastName}
            </h3>
            {!isExpanded && (
              <div className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                {customer.phone || customer.email || 'Sin datos de contacto'}
              </div>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Debts indicator when collapsed */}
          {!isExpanded && creditStats && creditStats.totalPendingDebt > 0 && (
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-sm" title="Tiene deuda pendiente" />
          )}
          <div className={`p-1.5 sm:p-2 rounded-xl text-slate-400 transition-transform duration-300 ${isExpanded ? 'rotate-90 bg-slate-100' : 'bg-slate-50'}`}>
            <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
        </div>
      </div>

      {/* Expanded Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="px-4 sm:px-5 pb-5 space-y-4 border-t border-slate-50 pt-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    {customer.email}
                  </span>
                  {customer.phone && (
                    <span className="flex items-center gap-1 font-medium text-slate-600">
                      <Phone className="w-3.5 h-3.5 text-emerald-500" />
                      {customer.phone}
                    </span>
                  )}
                </div>

                {/* Actions (Edit / Delete) */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    title="Editar cliente"
                    onClick={(e) => { e.stopPropagation(); onEdit(customer); }}
                    className="min-w-[36px] min-h-[36px] flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 active:bg-indigo-100 rounded-xl transition-colors cursor-pointer"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    title="Eliminar cliente"
                    onClick={(e) => { e.stopPropagation(); onDelete(customer); }}
                    className="min-w-[36px] min-h-[36px] flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 active:bg-red-100 rounded-xl transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Metrics Bar */}
              <div className="bg-slate-50/80 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-2 border border-slate-100 text-xs">
                <div className="flex items-center gap-4">
                  <div>
                    <span className="text-slate-400 font-medium">Compras: </span>
                    <span className="font-bold text-slate-800">{stats.purchaseCount}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-medium">Total gastado: </span>
                    <span className="font-bold text-indigo-600">{formatCurrency(stats.totalSpent)}</span>
                  </div>
                </div>

                {stats.lastPurchaseDate && (
                  <div className="text-[11px] text-slate-400 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    Última compra: {new Date(stats.lastPurchaseDate).toLocaleDateString()}
                  </div>
                )}
              </div>

              {/* Credit & Installment Status Badge if any */}
              {creditStats && creditStats.totalPendingDebt > 0 && (
                <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-amber-50/90 border border-amber-200/80 text-xs text-amber-900">
                  <div className="flex items-center gap-1.5 font-bold">
                    <Clock className="w-3.5 h-3.5 text-amber-600" />
                    <span>Saldo por pagar: {formatCurrency(creditStats.totalPendingDebt)}</span>
                  </div>
                  <span className="text-[11px] font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                    {creditStats.pendingCount} cuota{creditStats.pendingCount > 1 ? 's' : ''} pendiente{creditStats.pendingCount > 1 ? 's' : ''}
                  </span>
                </div>
              )}

              {/* Footer Actions */}
              <div className="flex flex-wrap items-center justify-between pt-1 gap-2">
                <div className="flex flex-wrap items-center gap-2 flex-1">
                  {customer.phone && (
                    <a
                      href={`https://wa.me/${customer.phone.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="min-h-[44px] inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-200 border border-emerald-200 transition-all active:scale-95 select-none"
                    >
                      <MessageSquare className="w-4 h-4 text-emerald-600" />
                      WhatsApp
                    </a>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenHistory(customer);
                    }}
                    className="min-h-[44px] inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 transition-all cursor-pointer active:scale-95 select-none"
                  >
                    <Receipt className="w-4 h-4 text-slate-500" />
                    Ver Compras ({stats.purchaseCount})
                  </button>

                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onExportPDF(customer); }}
                    disabled={isExportingPDF}
                    className="min-h-[44px] inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 active:bg-indigo-200 border border-indigo-200 transition-all cursor-pointer disabled:opacity-50 active:scale-95 select-none"
                    title="Exportar y compartir resumen de ventas y cuotas en PDF"
                  >
                    <FileText className="w-4 h-4 text-indigo-600" />
                    PDF
                  </button>
                </div>

                <button
                  onClick={(e) => { e.stopPropagation(); onNavigateToNewSale(customer.id); }}
                  className="min-h-[44px] inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-2xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 transition-all cursor-pointer active:scale-95 select-none ml-auto"
                >
                  <ShoppingBag className="w-4 h-4" />
                  Nueva Venta
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
