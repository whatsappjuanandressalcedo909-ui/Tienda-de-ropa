import React, { useState, useMemo } from 'react';
import { Customer, Sale } from '../../types';
import { formatCurrency, getInstallmentSummary } from '../../utils';
import { 
  Receipt, 
  X, 
  FileText, 
  ShoppingBag, 
  ChevronDown, 
  CheckCircle2, 
  Clock, 
  MessageSquare, 
  Download, 
  Plus 
} from 'lucide-react';
import { InstallmentReceipt } from '../InstallmentReceipt';

interface CustomerHistoryModalProps {
  customer: Customer | null;
  sales: Sale[];
  onClose: () => void;
  onNavigateToNewSale: (customerId: string) => void;
  onExportPDF: (customer: Customer) => void;
  isExportingPDF: boolean;
  onSendSaleReminder: (sale: Sale) => void;
}

export function CustomerHistoryModal({
  customer,
  sales,
  onClose,
  onNavigateToNewSale,
  onExportPDF,
  isExportingPDF,
  onSendSaleReminder
}: CustomerHistoryModalProps) {
  const [selectedSaleIdForReceipt, setSelectedSaleIdForReceipt] = useState<string | null>(null);
  const [showHistoryCards, setShowHistoryCards] = useState(false);

  const customerSalesHistory = useMemo(() => {
    if (!customer) return [];
    return sales
      .filter(s => s.customerId === customer.id)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [sales, customer]);

  if (!customer) return null;

  return (
    <div 
      id="modal-customer-history"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200"
    >
      <div className="bg-white rounded-t-[2rem] sm:rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh] animate-in slide-in-from-bottom-8 sm:slide-in-from-bottom-4 duration-300 border border-slate-100">
        <div className="w-full flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-12 h-1.5 bg-slate-200 rounded-full"></div>
        </div>

        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {selectedSaleIdForReceipt ? 'Tirilla de Cuotas & Pagos' : 'Historial de Compras'}
              </h3>
              <p className="text-xs text-slate-500">
                {customer.firstName} {customer.lastName}
                {customer.phone ? ` • ${customer.phone}` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button 
              type="button"
              onClick={() => onExportPDF(customer)}
              disabled={isExportingPDF}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/80 transition-colors cursor-pointer disabled:opacity-50"
              title="Exportar y compartir resumen de ventas y cuotas en PDF"
            >
              <FileText className="w-3.5 h-3.5 text-indigo-600" />
              <span className="hidden sm:inline">{isExportingPDF ? 'Generando...' : 'Exportar PDF'}</span>
              <span className="sm:hidden">PDF</span>
            </button>

            <button 
              type="button"
              onClick={() => {
                onClose();
                setSelectedSaleIdForReceipt(null);
              }}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
          {/* IF A SALE IS SELECTED: DISPLAY THE INSTALLMENT RECEIPT */}
          {selectedSaleIdForReceipt ? (() => {
            const activeSale = sales.find(s => s.id === selectedSaleIdForReceipt) || customerSalesHistory.find(s => s.id === selectedSaleIdForReceipt);
            if (!activeSale) {
              return (
                <div className="text-center py-8">
                  <p className="text-xs text-slate-500">No se encontró la compra seleccionada.</p>
                  <button
                    type="button"
                    onClick={() => setSelectedSaleIdForReceipt(null)}
                    className="mt-2 text-xs font-bold text-indigo-600 underline"
                  >
                    Volver al listado
                  </button>
                </div>
              );
            }

            return (
              <div className="space-y-3">
                {/* Quick navigation if customer has multiple purchases */}
                {customerSalesHistory.length > 1 && (
                  <div className="flex items-center gap-2 overflow-x-auto pb-1.5 no-print">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">
                      Cambiar compra:
                    </span>
                    {customerSalesHistory.map(s => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setSelectedSaleIdForReceipt(s.id)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold whitespace-nowrap transition-colors cursor-pointer ${s.id === activeSale.id ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}
                      >
                        #{s.id.slice(0, 6).toUpperCase()} ({formatCurrency(s.total)})
                      </button>
                    ))}
                  </div>
                )}

                <InstallmentReceipt 
                  sale={activeSale} 
                  onBack={() => setSelectedSaleIdForReceipt(null)}
                  showBackButton={true}
                />
              </div>
            );
          })() : (
            /* PURCHASES LIST VIEW WITH SUMMARY */
            <div className="space-y-4">
              {/* Financial overview banner */}
              {customerSalesHistory.length > 0 && (() => {
                const completedSales = customerSalesHistory.filter(s => s.status === 'completed');
                const totalSpent = completedSales.reduce((acc, s) => acc + s.total, 0);
                let totalPaid = 0;
                let totalPending = 0;
                completedSales.forEach(s => {
                  const summ = getInstallmentSummary(s);
                  totalPaid += summ.totalPaid;
                  totalPending += summ.totalPending;
                });

                return (
                  <div className="space-y-3">
                    <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 text-xs grid grid-cols-3 gap-2 text-center">
                      <div className="p-2 rounded-xl bg-white border border-slate-100">
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Total Compras</span>
                        <span className="font-mono font-bold text-slate-800 text-xs sm:text-sm">{formatCurrency(totalSpent)}</span>
                      </div>
                      <div className="p-2 rounded-xl bg-white border border-slate-100">
                        <span className="text-[10px] font-bold text-emerald-600 uppercase block">Total Pagado</span>
                        <span className="font-mono font-bold text-emerald-700 text-xs sm:text-sm">{formatCurrency(totalPaid)}</span>
                      </div>
                      <div className="p-2 rounded-xl bg-white border border-slate-100">
                        <span className="text-[10px] font-bold text-amber-600 uppercase block">Por Pagar</span>
                        <span className="font-mono font-bold text-amber-700 text-xs sm:text-sm">{formatCurrency(totalPending)}</span>
                      </div>
                    </div>

                    {/* PDF Export Banner Card */}
                    <div className="bg-gradient-to-r from-indigo-50/70 via-white to-amber-50/70 border border-indigo-100/90 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-2 shadow-xs">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-xs">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-slate-900">Estado de Cuenta y Cuotas en PDF</h4>
                          <p className="text-[11px] text-slate-500">Documento formal con balance, abonos y cuotas pendientes</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onExportPDF(customer)}
                        disabled={isExportingPDF}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-all shadow-sm cursor-pointer disabled:opacity-50 ml-auto"
                      >
                        <Download className="w-3.5 h-3.5" />
                        {isExportingPDF ? 'Generando...' : 'Descargar / Compartir PDF'}
                      </button>
                    </div>
                  </div>
                );
              })()}

              {customerSalesHistory.length === 0 ? (
                <div className="text-center py-10">
                  <ShoppingBag className="mx-auto h-10 w-10 text-slate-300 mb-2" />
                  <p className="text-sm font-semibold text-slate-700">Sin compras registradas</p>
                  <p className="text-xs text-slate-400 mt-1 mb-4">Este cliente todavía no ha realizado compras.</p>
                  <button
                    onClick={() => {
                      const custId = customer.id;
                      onClose();
                      setSelectedSaleIdForReceipt(null);
                      onNavigateToNewSale(custId);
                    }}
                    className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-indigo-700 transition-colors cursor-pointer"
                  >
                    Crear Venta para este Cliente
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <button
                    onClick={() => setShowHistoryCards(!showHistoryCards)}
                    className="w-full flex items-center justify-between p-3.5 bg-slate-50 hover:bg-slate-100 rounded-2xl border border-slate-200/80 transition-colors cursor-pointer text-slate-700"
                  >
                    <span className="text-sm font-bold flex items-center gap-2">
                      <ShoppingBag className="w-4 h-4 text-slate-400" />
                      {showHistoryCards ? 'Ocultar historial de compras' : 'Ver historial de compras'}
                    </span>
                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showHistoryCards ? 'rotate-180' : ''}`} />
                  </button>

                  {showHistoryCards && (
                    <div className="space-y-3 pt-2 animate-in fade-in slide-in-from-top-2 duration-200">
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wide px-1">
                        Selecciona una compra para ver su tirilla de cuotas:
                      </p>
                      {customerSalesHistory.map(sale => {
                        const summary = getInstallmentSummary(sale);
                        const percent = sale.total > 0 ? Math.round((summary.totalPaid / sale.total) * 100) : 100;

                        return (
                          <div 
                            key={sale.id} 
                            onClick={() => setSelectedSaleIdForReceipt(sale.id)}
                            className={`p-4 rounded-2xl border transition-all cursor-pointer hover:shadow-md hover:border-indigo-200 ${sale.status === 'cancelled' ? 'bg-red-50/40 border-red-100 opacity-75' : 'bg-white border-slate-200/90'}`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-bold font-mono text-slate-800">
                                  Factura #{sale.id.slice(0, 6).toUpperCase()}
                                </span>
                                {sale.status === 'cancelled' ? (
                                  <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase">
                                    Anulada
                                  </span>
                                ) : (
                                  <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase">
                                    Completada
                                  </span>
                                )}
                                {sale.paymentMethod && (
                                  <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full text-[10px] font-bold">
                                    {sale.paymentMethod === 'credit' ? `Crédito (${sale.installments || summary.totalCount}m)` : 'Contado'}
                                  </span>
                                )}
                              </div>
                              <span className={`font-black text-sm font-mono ${sale.status === 'cancelled' ? 'text-slate-400 line-through' : 'text-indigo-600'}`}>
                                {formatCurrency(sale.total)}
                              </span>
                            </div>

                            {/* Installments Mini Summary */}
                            {sale.status === 'completed' && (
                              <div className="my-2.5 p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs space-y-2">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-1.5">
                                    {summary.isFullyPaid ? (
                                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                        Al día: {summary.paidCount} de {summary.totalCount} cuotas pagadas
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800">
                                        <Clock className="w-3.5 h-3.5 text-amber-600" />
                                        {summary.paidCount} pagada{summary.paidCount !== 1 ? 's' : ''} • {summary.pendingCount} por pagar
                                      </span>
                                    )}
                                  </div>
                                  <span className="font-mono font-bold text-xs text-slate-700">
                                    {summary.totalPending > 0 ? (
                                      <span className="text-amber-700">Por pagar: {formatCurrency(summary.totalPending)}</span>
                                    ) : (
                                      <span className="text-emerald-700">Totalmente pagado</span>
                                    )}
                                  </span>
                                </div>

                                <div className="w-full bg-slate-200/70 rounded-full h-1.5 overflow-hidden">
                                  <div 
                                    className={`h-full ${summary.isFullyPaid ? 'bg-emerald-500' : 'bg-indigo-600'}`}
                                    style={{ width: `${percent}%` }}
                                  ></div>
                                </div>
                              </div>
                            )}

                            {/* Items preview */}
                            <div className="space-y-1 my-2">
                              {sale.items?.slice(0, 3).map((it, idx) => (
                                <div key={idx} className="flex justify-between text-xs text-slate-600">
                                  <span>{it.quantity}x {it.productName}</span>
                                  <span className="font-mono font-medium text-slate-800">{formatCurrency(it.subtotal)}</span>
                                </div>
                              ))}
                              {sale.items && sale.items.length > 3 && (
                                <p className="text-[10px] text-slate-400 font-medium italic">
                                  +{sale.items.length - 3} artículo(s) más
                                </p>
                              )}
                            </div>

                            <div className="flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-100 pt-2 mt-2 gap-2 flex-wrap">
                              <span>{new Date(sale.date).toLocaleString()}</span>
                              <div className="flex items-center gap-2">
                                {summary.totalPending > 0 && sale.status === 'completed' && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onSendSaleReminder(sale);
                                    }}
                                    className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg border border-emerald-200 transition-colors cursor-pointer"
                                    title="Recordar pago por WhatsApp"
                                  >
                                    <MessageSquare className="w-3 h-3 text-emerald-600" />
                                    Recordar Pago
                                  </button>
                                )}
                                <span className="text-indigo-600 font-bold flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                                  Ver Tirilla →
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center no-print">
          <button
            type="button"
            onClick={() => {
              onClose();
              setSelectedSaleIdForReceipt(null);
            }}
            className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            Cerrar
          </button>
          <button
            type="button"
            onClick={() => {
              const custId = customer.id;
              onClose();
              setSelectedSaleIdForReceipt(null);
              onNavigateToNewSale(custId);
            }}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            Nueva Venta
          </button>
        </div>
      </div>
    </div>
  );
}
