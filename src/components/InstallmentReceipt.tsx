import React, { useState } from 'react';
import { 
  CheckCircle2, Clock, Calendar, Phone, MessageSquare, 
  Printer, ArrowLeft, ShieldCheck, AlertCircle, ShoppingCart, FileText, DollarSign, RotateCcw
} from 'lucide-react';
import { Sale, Installment } from '../types';
import { 
  formatCurrency, 
  getInstallmentSummary,
  getInstallmentPaidAmount,
  getInstallmentRemainingAmount,
  getDueDateDetails,
  createWhatsAppReminderMessage
} from '../utils';
import { useInventory } from '../context/InventoryContext';
import { generateSaleReceiptPDF } from '../utils/pdfGenerator';
import { InstallmentPaymentModal } from './InstallmentPaymentModal';

interface InstallmentReceiptProps {
  sale: Sale;
  onBack?: () => void;
  onClose?: () => void;
  showBackButton?: boolean;
}

export function InstallmentReceipt({ sale, onBack, onClose, showBackButton = true }: InstallmentReceiptProps) {
  const { toggleInstallmentPayment, resetInstallmentPayment } = useInventory();
  const [selectedInstallmentForPayment, setSelectedInstallmentForPayment] = useState<Installment | null>(null);
  
  const summary = getInstallmentSummary(sale);
  const { installments, paidList, pendingList, totalPaid, totalPending, isFullyPaid, paidCount, pendingCount, totalCount } = summary;

  const percentPaid = sale.total > 0 ? Math.min(100, Math.round((totalPaid / sale.total) * 100)) : 100;

  const handleShareWhatsApp = () => {
    const phone = sale.customerPhone?.replace(/\D/g, '');
    let text = `🧾 *TIRILLA DE ESTADO DE CUOTAS*\n`;
    text += `═════════════════════════\n`;
    text += `*Factura:* #${sale.id.slice(0, 6).toUpperCase()}\n`;
    text += `*Fecha de Venta:* ${new Date(sale.date).toLocaleDateString()}\n`;
    if (sale.customerName) {
      text += `*Cliente:* ${sale.customerName}\n`;
    }
    text += `*Monto Total:* ${formatCurrency(sale.total)}\n`;
    text += `*Forma de Pago:* ${sale.paymentMethod === 'credit' ? `Crédito (${sale.installments || totalCount} cuotas)` : 'Contado'}\n`;
    text += `═════════════════════════\n\n`;

    text += `📋 *RESUMEN DE CUOTAS:*\n`;
    text += `✅ Pagadas: ${paidCount} de ${totalCount} (${formatCurrency(totalPaid)})\n`;
    text += `⏳ Por Pagar: ${pendingCount} de ${totalCount} (${formatCurrency(totalPending)})\n`;
    text += `Progreso: ${percentPaid}%\n\n`;

    text += `──────── CUOTAS PAGADAS ────────\n`;
    if (paidList.length === 0) {
      text += `(Sin cuotas pagadas aún)\n`;
    } else {
      paidList.forEach(inst => {
        const paid = getInstallmentPaidAmount(inst);
        const paidStr = inst.paidDate ? ` [Pagada: ${new Date(inst.paidDate).toLocaleDateString()}]` : '';
        text += `✓ Cuota ${inst.number}/${totalCount}: ${formatCurrency(paid)}${paidStr}\n`;
      });
    }

    text += `\n──────── CUOTAS POR PAGAR ────────\n`;
    if (pendingList.length === 0) {
      text += `🎉 ¡Crédito totalmente cancelado!\n`;
    } else {
      pendingList.forEach(inst => {
        const dueStr = inst.dueDate ? ` (Vence: ${new Date(inst.dueDate).toLocaleDateString()})` : '';
        const paid = getInstallmentPaidAmount(inst);
        const remaining = getInstallmentRemainingAmount(inst);
        let line = `⏳ Cuota ${inst.number}/${totalCount}: ${formatCurrency(inst.amount)}${dueStr}`;
        if (paid > 0) {
          line += ` [Abonado: ${formatCurrency(paid)} - Saldo: ${formatCurrency(remaining)}]`;
        }
        text += `${line}\n`;
      });
    }

    text += `\n═════════════════════════\n`;
    text += `*SALDO TOTAL PENDIENTE: ${formatCurrency(totalPending)}*\n`;
    if (isFullyPaid) {
      text += `*ESTADO: PAZ Y SALVO ✅*\n`;
    } else {
      text += `*ESTADO: PENDIENTE DE PAGO ⏳*\n`;
    }
    text += `═════════════════════════\n`;
    text += `¡Gracias por tu confianza!`;

    const url = phone 
      ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const handleSendSingleReminder = (inst: Installment) => {
    const paid = getInstallmentPaidAmount(inst);
    const remaining = getInstallmentRemainingAmount(inst);
    const msg = createWhatsAppReminderMessage({
      customerName: sale.customerName,
      installmentNumber: inst.number,
      totalInstallments: totalCount,
      installmentAmount: inst.amount,
      paidAmount: paid,
      installmentRemaining: remaining,
      totalPendingDebt: totalPending,
      dueDateStr: inst.dueDate,
      storeName: 'la tienda',
    });

    const phone = sale.customerPhone?.replace(/\D/g, '');
    const url = phone 
      ? `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = () => {
    const doc = generateSaleReceiptPDF(sale);
    doc.save(`Tirilla_Factura_${sale.id.slice(0, 6).toUpperCase()}.pdf`);
  };

  return (
    <div className="space-y-4">
      {/* Top action bar */}
      <div className="flex items-center justify-between no-print flex-wrap gap-2">
        {showBackButton && onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-xl transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Volver a Compras
          </button>
        ) : <div />}

        <div className="flex items-center gap-2">
          {sale.customerPhone && (
            <button
              type="button"
              onClick={handleShareWhatsApp}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors cursor-pointer"
              title="Compartir tirilla por WhatsApp"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Enviar Tirilla
            </button>
          )}

          <button
            type="button"
            onClick={handleDownloadPDF}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition-colors cursor-pointer"
            title="Descargar Tirilla en PDF"
          >
            <FileText className="w-3.5 h-3.5" />
            PDF
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 shadow-sm transition-colors cursor-pointer"
            title="Imprimir tirilla"
          >
            <Printer className="w-3.5 h-3.5" />
            Imprimir
          </button>
        </div>
      </div>

      {/* THE TIRILLA (THERMAL RECEIPT PAPER STYLE) */}
      <div className="relative bg-white border border-slate-200/90 rounded-2xl shadow-md overflow-hidden print:shadow-none print:border-none">
        {/* Decorative receipt tear edge top */}
        <div className="h-2 bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 border-b border-dashed border-slate-300 flex justify-between px-2 overflow-hidden">
          {Array.from({ length: 24 }).map((_, i) => (
            <div key={i} className="w-1.5 h-1.5 bg-slate-100 rotate-45 transform -translate-y-1"></div>
          ))}
        </div>

        <div className="p-5 sm:p-6 space-y-4">
          {/* Header */}
          <div className="text-center pb-3 border-b border-dashed border-slate-300">
            <div className="inline-flex items-center justify-center p-2 rounded-2xl bg-indigo-50 text-indigo-700 mb-2">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <h3 className="text-base font-black tracking-tight text-slate-900 uppercase">
              Tirilla de Cuotas & Pagos
            </h3>
            <p className="text-[11px] font-mono text-slate-500 uppercase tracking-wider mt-0.5">
              Factura #{sale.id.slice(0, 8).toUpperCase()}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              Fecha: {new Date(sale.date).toLocaleString()}
            </p>
          </div>

          {/* Customer & Sale Metadata */}
          <div className="bg-slate-50/90 rounded-xl p-3 text-xs space-y-1.5 border border-slate-100 font-mono">
            <div className="flex justify-between">
              <span className="text-slate-500">Cliente:</span>
              <span className="font-bold text-slate-800 text-right">{sale.customerName || 'Cliente Ocasional'}</span>
            </div>
            {sale.customerEmail && (
              <div className="flex justify-between">
                <span className="text-slate-500">Correo:</span>
                <span className="text-slate-700 text-right truncate max-w-[200px]">{sale.customerEmail}</span>
              </div>
            )}
            {sale.customerPhone && (
              <div className="flex justify-between">
                <span className="text-slate-500">Teléfono:</span>
                <span className="font-bold text-emerald-600 text-right">{sale.customerPhone}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-slate-200 pt-1 mt-1">
              <span className="text-slate-500">Modalidad:</span>
              <span className="font-bold text-indigo-700">
                {sale.paymentMethod === 'credit' ? `Crédito (${totalCount} Cuotas)` : 'Pago de Contado'}
              </span>
            </div>
          </div>

          {/* Purchased Items preview */}
          {sale.items && sale.items.length > 0 && (
            <div className="text-xs space-y-1.5 pt-1 border-b border-dashed border-slate-300 pb-3">
              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Artículos:</p>
              {sale.items.map((it, idx) => (
                <div key={idx} className="flex justify-between text-slate-600">
                  <span>{it.quantity}x {it.productName}</span>
                  <span className="font-mono font-medium text-slate-900">{formatCurrency(it.subtotal)}</span>
                </div>
              ))}
              <div className="flex justify-between text-xs font-bold text-slate-900 pt-1.5 border-t border-slate-200">
                <span>TOTAL VENTA:</span>
                <span className="font-mono text-sm text-indigo-600">{formatCurrency(sale.total)}</span>
              </div>
            </div>
          )}

          {/* Cuotas Financial Status Overview */}
          <div className="bg-indigo-50/70 border border-indigo-100 rounded-2xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-indigo-950 uppercase tracking-wide">
                Estado del Crédito
              </span>
              {isFullyPaid ? (
                <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                  <ShieldCheck className="w-3 h-3" /> Paz y Salvo
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                  <Clock className="w-3 h-3" /> Saldo Activo
                </span>
              )}
            </div>

            {/* Progress bar */}
            <div>
              <div className="flex justify-between text-[11px] font-semibold text-slate-600 mb-1">
                <span>Progreso ({paidCount} de {totalCount} cuotas pagadas)</span>
                <span className="font-mono font-bold text-indigo-700">{percentPaid}%</span>
              </div>
              <div className="w-full bg-slate-200/80 rounded-full h-2 overflow-hidden">
                <div 
                  className={`h-full transition-all duration-500 ${isFullyPaid ? 'bg-emerald-500' : 'bg-indigo-600'}`}
                  style={{ width: `${percentPaid}%` }}
                ></div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-indigo-100/80 text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-emerald-700 block">Total Pagado:</span>
                <span className="font-mono font-black text-sm text-emerald-800">{formatCurrency(totalPaid)}</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-amber-700 block">Por Pagar:</span>
                <span className="font-mono font-black text-sm text-amber-800">{formatCurrency(totalPending)}</span>
              </div>
            </div>
          </div>

          {/* SECTION: CUOTAS PAGADAS */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Cuotas Pagadas ({paidCount})
              </h4>
              <span className="text-[11px] font-mono font-bold text-emerald-700">{formatCurrency(totalPaid)}</span>
            </div>

            {paidList.length === 0 ? (
              <div className="p-3 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center text-xs text-slate-400">
                Aún no se han registrado cuotas pagadas en esta compra.
              </div>
            ) : (
              <div className="space-y-1.5">
                {paidList.map(inst => (
                  <div 
                    key={inst.number}
                    className="flex items-center justify-between p-2.5 bg-emerald-50/50 border border-emerald-100 rounded-xl text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-[10px]">
                        ✓
                      </div>
                      <div>
                        <p className="font-bold text-slate-800">
                          Cuota {inst.number} de {totalCount}
                        </p>
                        <p className="text-[10px] text-emerald-700 flex items-center gap-1">
                          <Calendar className="w-2.5 h-2.5" />
                          Pagada: {inst.paidDate ? new Date(inst.paidDate).toLocaleDateString() : 'Registrada'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <span className="font-mono font-black text-xs text-emerald-800">
                        {formatCurrency(inst.amount)}
                      </span>
                      {sale.status === 'completed' && (
                        <button
                          type="button"
                          onClick={() => toggleInstallmentPayment(sale.id, inst.number)}
                          title="Cambiar a pendiente"
                          className="no-print text-[10px] font-semibold text-slate-400 hover:text-amber-600 hover:bg-amber-50 px-1.5 py-0.5 rounded transition-colors cursor-pointer"
                        >
                          Revertir
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SECTION: CUOTAS POR PAGAR */}
          <div className="space-y-2 pt-2 border-t border-dashed border-slate-300">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-amber-600" />
                Cuotas Por Pagar ({pendingCount})
              </h4>
              <span className="text-[11px] font-mono font-bold text-amber-700">{formatCurrency(totalPending)}</span>
            </div>

            {pendingList.length === 0 ? (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-center text-xs text-emerald-800 font-medium flex items-center justify-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                ¡Todas las cuotas de esta compra están al día y pagadas!
              </div>
            ) : (
              <div className="space-y-2.5">
                {pendingList.map(inst => {
                  const paid = getInstallmentPaidAmount(inst);
                  const remaining = getInstallmentRemainingAmount(inst);
                  const dueInfo = getDueDateDetails(inst.dueDate);
                  const hasPartial = paid > 0;

                  return (
                    <div 
                      key={inst.number}
                      className="p-3 bg-amber-50/50 border border-amber-200/80 rounded-xl gap-2 text-xs space-y-2"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-[10px]">
                            {inst.number}
                          </div>
                          <div>
                            <p className="font-bold text-slate-800">
                              Cuota {inst.number} de {totalCount}
                            </p>
                            <p className={`text-[10px] flex items-center gap-1 font-medium ${
                              dueInfo.isOverdue ? 'text-rose-600 font-bold' : dueInfo.isToday ? 'text-amber-700 font-bold' : 'text-amber-800'
                            }`}>
                              <Calendar className="w-2.5 h-2.5" />
                              {dueInfo.statusLabel} ({dueInfo.shortFormattedDate})
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-3">
                          <div className="text-right">
                            {hasPartial && (
                              <span className="text-[10px] text-slate-400 block line-through">
                                {formatCurrency(inst.amount)}
                              </span>
                            )}
                            <span className="font-mono font-black text-sm text-amber-900">
                              {formatCurrency(remaining)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* If partial payment was made */}
                      {hasPartial && (
                        <div className="bg-white/80 p-2 rounded-lg border border-amber-200/60 text-[11px] flex items-center justify-between">
                          <span className="text-emerald-700 font-medium">
                            Abonado: <strong>{formatCurrency(paid)}</strong>
                          </span>
                          <span className="text-amber-800 font-bold">
                            Saldo: <strong>{formatCurrency(remaining)}</strong>
                          </span>
                        </div>
                      )}

                      {/* Action buttons inside receipt */}
                      {sale.status === 'completed' && (
                        <div className="no-print pt-1 flex items-center justify-between gap-2 border-t border-amber-100">
                          <button
                            type="button"
                            onClick={() => handleSendSingleReminder(inst)}
                            className="text-[11px] font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg border border-emerald-200 transition-colors cursor-pointer inline-flex items-center gap-1.5"
                            title="Recordar pago de esta cuota por WhatsApp"
                          >
                            <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                            Recordar Pago
                          </button>

                          <button
                            type="button"
                            onClick={() => setSelectedInstallmentForPayment(inst)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] px-3 py-1 rounded-lg transition-colors shadow-xs cursor-pointer flex items-center gap-1 ml-auto"
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            Abonar / Pagar
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Receipt Stamp / Final Summary Total */}
          <div className="pt-3 border-t-2 border-slate-900 text-xs space-y-1 font-mono">
            <div className="flex justify-between font-bold text-slate-600">
              <span>VALOR TOTAL VENTA:</span>
              <span>{formatCurrency(sale.total)}</span>
            </div>
            <div className="flex justify-between font-bold text-emerald-700">
              <span>TOTAL PAGADO ACUMULADO:</span>
              <span>{formatCurrency(totalPaid)}</span>
            </div>
            <div className="flex justify-between font-black text-sm text-slate-900 border-t border-slate-200 pt-1.5 mt-1.5">
              <span>SALDO RESTANTE POR PAGAR:</span>
              <span className={totalPending > 0 ? 'text-amber-700 font-black text-base' : 'text-emerald-700'}>
                {formatCurrency(totalPending)}
              </span>
            </div>

            {/* Official seal badge */}
            <div className="pt-4 flex justify-center">
              {isFullyPaid ? (
                <div className="border-2 border-dashed border-emerald-600 text-emerald-700 px-4 py-1.5 rounded-xl uppercase font-black text-xs tracking-widest text-center rotate-[-2deg]">
                  ★★★ PAZ Y SALVO - PAGADO AL 100% ★★★
                </div>
              ) : (
                <div className="border-2 border-dashed border-amber-600 text-amber-800 px-4 py-1.5 rounded-xl uppercase font-black text-xs tracking-widest text-center rotate-[-1deg]">
                  CRÉDITO ACTIVO - {pendingCount} CUOTA(S) PENDIENTE(S)
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Decorative receipt tear edge bottom */}
        <div className="h-2 bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 border-t border-dashed border-slate-300 flex justify-between px-2 overflow-hidden">
          {Array.from({ length: 24 }).map((_, i) => (
            <div key={i} className="w-1.5 h-1.5 bg-slate-100 rotate-45 transform translate-y-1"></div>
          ))}
        </div>
      </div>

      {/* Partial / Full payment modal */}
      {selectedInstallmentForPayment && (
        <InstallmentPaymentModal
          sale={sale}
          installment={selectedInstallmentForPayment}
          isOpen={true}
          onClose={() => setSelectedInstallmentForPayment(null)}
        />
      )}
    </div>
  );
}
