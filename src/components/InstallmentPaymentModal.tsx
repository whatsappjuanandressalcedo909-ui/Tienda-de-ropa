import React, { useState } from 'react';
import { 
  DollarSign, CheckCircle2, Clock, X, AlertCircle, 
  RotateCcw, History, ArrowRight, Wallet, Check 
} from 'lucide-react';
import { Sale, Installment } from '../types';
import { 
  formatCurrency, 
  getInstallmentPaidAmount, 
  getInstallmentRemainingAmount,
  getDueDateDetails 
} from '../utils';
import { useInventory } from '../context/InventoryContext';

interface InstallmentPaymentModalProps {
  sale: Sale;
  installment: Installment;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function InstallmentPaymentModal({
  sale,
  installment,
  isOpen,
  onClose,
  onSuccess,
}: InstallmentPaymentModalProps) {
  const { recordInstallmentPayment, toggleInstallmentPayment, resetInstallmentPayment } = useInventory();

  const currentPaid = getInstallmentPaidAmount(installment);
  const remaining = getInstallmentRemainingAmount(installment);
  const dueInfo = getDueDateDetails(installment.dueDate);

  // Mode: 'partial' | 'full'
  const [paymentType, setPaymentType] = useState<'partial' | 'full'>('partial');
  const [customAmountStr, setCustomAmountStr] = useState<string>(
    remaining > 0 ? Math.round(remaining / 2).toString() : ''
  );
  const [paymentNote, setPaymentNote] = useState<string>('');
  const [showHistory, setShowHistory] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const parsedAmount = parseFloat(customAmountStr) || 0;
  const newRemainingAfterPayment = Math.max(0, remaining - parsedAmount);
  const willFullyPay = parsedAmount >= remaining - 0.01;

  const handleQuickPercent = (percent: number) => {
    const calc = Math.round(remaining * percent);
    setCustomAmountStr(calc.toString());
    setErrorMsg(null);
  };

  const handleRecordPayment = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const amountToApply = paymentType === 'full' ? remaining : parsedAmount;

    if (amountToApply <= 0) {
      setErrorMsg('Por favor ingresa un monto válido mayor a $0.');
      return;
    }

    if (amountToApply > remaining) {
      setErrorMsg(`El abono no puede superar el saldo restante (${formatCurrency(remaining)}).`);
      return;
    }

    recordInstallmentPayment(
      sale.id, 
      installment.number, 
      amountToApply, 
      paymentNote || (paymentType === 'full' ? 'Pago completo de cuota' : 'Abono parcial')
    );

    if (onSuccess) onSuccess();
    onClose();
  };

  const handleReset = () => {
    if (window.confirm('¿Deseas restablecer todos los abonos de esta cuota y marcarla como pendiente?')) {
      resetInstallmentPayment(sale.id, installment.number);
      if (onSuccess) onSuccess();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-t-[2rem] sm:rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[92vh] border border-slate-100 animate-in slide-in-from-bottom-6 duration-200">
        
        {/* Drag handle for mobile */}
        <div className="w-full flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-12 h-1.5 bg-slate-200 rounded-full"></div>
        </div>

        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-2xl">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Registrar Cobro / Abono
              </h3>
              <p className="text-xs text-slate-500">
                Cuota #{installment.number} de {sale.installments || 1} • Factura #{sale.id.slice(0, 6).toUpperCase()}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-5">
          
          {/* Customer & Status Bar */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Cliente</span>
                <span className="text-xs font-bold text-slate-900">{sale.customerName || 'Cliente General'}</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Vencimiento</span>
                <span className={`text-xs font-bold inline-flex items-center gap-1 ${
                  dueInfo.isOverdue ? 'text-rose-600' : dueInfo.isToday ? 'text-amber-600' : 'text-slate-700'
                }`}>
                  <Clock className="w-3 h-3" />
                  {dueInfo.statusLabel} ({dueInfo.shortFormattedDate})
                </span>
              </div>
            </div>

            {/* Balances Grid */}
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200/70 text-center">
              <div className="bg-white p-2 rounded-xl border border-slate-100 shadow-2xs">
                <span className="text-[10px] font-semibold text-slate-400 block">Total Cuota</span>
                <span className="text-xs sm:text-sm font-mono font-bold text-slate-800">{formatCurrency(installment.amount)}</span>
              </div>
              <div className="bg-white p-2 rounded-xl border border-slate-100 shadow-2xs">
                <span className="text-[10px] font-semibold text-emerald-600 block">Abonado</span>
                <span className="text-xs sm:text-sm font-mono font-bold text-emerald-700">{formatCurrency(currentPaid)}</span>
              </div>
              <div className="bg-white p-2 rounded-xl border border-slate-100 shadow-2xs">
                <span className="text-[10px] font-semibold text-amber-600 block">Por Cobrar</span>
                <span className="text-xs sm:text-sm font-mono font-bold text-amber-700">{formatCurrency(remaining)}</span>
              </div>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleRecordPayment} className="space-y-4">
            {/* Payment Type Switcher */}
            <div className="grid grid-cols-2 p-1.5 bg-slate-100 rounded-2xl gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setPaymentType('partial');
                  if (parsedAmount <= 0 || parsedAmount > remaining) {
                    setCustomAmountStr(Math.round(remaining / 2).toString());
                  }
                  setErrorMsg(null);
                }}
                className={`min-h-[44px] py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center justify-center text-center ${
                  paymentType === 'partial' 
                    ? 'bg-white text-indigo-700 shadow-sm' 
                    : 'text-slate-600 hover:text-slate-900 active:scale-98'
                }`}
              >
                Abono Parcial
              </button>

              <button
                type="button"
                onClick={() => {
                  setPaymentType('full');
                  setCustomAmountStr(remaining.toString());
                  setErrorMsg(null);
                }}
                className={`min-h-[44px] py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center justify-center text-center ${
                  paymentType === 'full' 
                    ? 'bg-emerald-600 text-white shadow-sm' 
                    : 'text-slate-600 hover:text-slate-900 active:scale-98'
                }`}
              >
                Pago Completo ({formatCurrency(remaining)})
              </button>
            </div>

            {/* Partial Amount Input & Quick Buttons */}
            {paymentType === 'partial' ? (
              <div className="space-y-2.5">
                <label className="block text-xs font-bold text-slate-700">
                  Monto que abona el cliente
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 font-mono font-bold text-base">
                    $
                  </div>
                  <input
                    type="number"
                    min="1"
                    max={remaining}
                    step="100"
                    required
                    value={customAmountStr}
                    onChange={e => {
                      setCustomAmountStr(e.target.value);
                      setErrorMsg(null);
                    }}
                    placeholder={`Máximo ${remaining}`}
                    className="w-full pl-9 pr-4 py-3 min-h-[48px] bg-white border border-slate-300 rounded-2xl text-base sm:text-sm font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                {/* Quick percentages */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">
                    Atajos:
                  </span>
                  <button
                    type="button"
                    onClick={() => handleQuickPercent(0.25)}
                    className="min-h-[40px] px-3.5 py-2 text-xs font-bold bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 rounded-xl transition-all active:scale-95 cursor-pointer"
                  >
                    25% ({formatCurrency(Math.round(remaining * 0.25))})
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickPercent(0.5)}
                    className="min-h-[40px] px-3.5 py-2 text-xs font-bold bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 rounded-xl transition-all active:scale-95 cursor-pointer"
                  >
                    50% ({formatCurrency(Math.round(remaining * 0.5))})
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickPercent(1)}
                    className="min-h-[40px] px-3.5 py-2 text-xs font-bold bg-indigo-50 hover:bg-indigo-100 active:bg-indigo-200 text-indigo-700 rounded-xl transition-all active:scale-95 cursor-pointer"
                  >
                    100% ({formatCurrency(remaining)})
                  </button>
                </div>

                {/* Real-time Calculation Card */}
                {parsedAmount > 0 && (
                  <div className={`p-3.5 rounded-2xl text-xs border transition-colors ${
                    willFullyPay 
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900' 
                      : 'bg-indigo-50/70 border-indigo-100 text-indigo-950'
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">Nuevo saldo restante de esta cuota:</span>
                      <span className="font-mono font-bold text-sm">
                        {formatCurrency(newRemainingAfterPayment)}
                      </span>
                    </div>
                    {willFullyPay && (
                      <p className="text-xs font-bold text-emerald-700 mt-1 flex items-center gap-1.5">
                        <Check className="w-4 h-4" />
                        ¡Con este pago la cuota quedará 100% saldada!
                      </p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              /* Full payment confirmation notice */
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-900 space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Liquidación Total de Cuota #{installment.number}
                </p>
                <p className="text-emerald-700 text-xs">
                  Se registrará el pago completo por <strong>{formatCurrency(remaining)}</strong> y la cuota quedará marcada como pagada.
                </p>
              </div>
            )}

            {/* Note / Method input */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Detalle del pago / Método (Opcional)
              </label>
              <input
                type="text"
                value={paymentNote}
                onChange={e => setPaymentNote(e.target.value)}
                placeholder="Ej: Transferencia Nequi, Efectivo en caja, Daviplata..."
                className="w-full px-4 py-3 min-h-[48px] bg-white border border-slate-300 rounded-2xl text-base sm:text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="pt-2 flex items-center justify-between gap-2.5">
              {installment.paymentHistory && installment.paymentHistory.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowHistory(!showHistory)}
                  className="min-h-[44px] inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 active:scale-95 transition-all cursor-pointer select-none"
                >
                  <History className="w-4 h-4" />
                  <span>{showHistory ? 'Ocultar' : `Historial (${installment.paymentHistory.length})`}</span>
                </button>
              )}

              <div className="flex items-center gap-2 ml-auto w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-[44px] px-4 py-2.5 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 rounded-2xl text-xs sm:text-sm font-bold transition-all cursor-pointer active:scale-95 select-none"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="min-h-[44px] px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-2xl text-xs sm:text-sm font-bold transition-all shadow-md shadow-indigo-600/20 cursor-pointer flex items-center justify-center gap-2 active:scale-95 select-none flex-1 sm:flex-initial"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {paymentType === 'full' 
                      ? `Confirmar Pago (${formatCurrency(remaining)})`
                      : `Registrar Abono (${formatCurrency(parsedAmount)})`
                    }
                  </span>
                </button>
              </div>
            </div>
          </form>

          {/* Payment History Section (if requested or already has history) */}
          {(showHistory || (installment.paymentHistory && installment.paymentHistory.length > 0 && currentPaid > 0)) && (
            <div className="pt-3 border-t border-slate-200/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5 text-slate-500" />
                  Abonos registrados en esta cuota
                </span>
                <button
                  type="button"
                  onClick={handleReset}
                  className="text-[11px] font-bold text-rose-600 hover:text-rose-700 hover:underline inline-flex items-center gap-1 cursor-pointer"
                  title="Reiniciar abonos y volver cuota a pendiente"
                >
                  <RotateCcw className="w-3 h-3" />
                  Revertir todos los abonos
                </button>
              </div>

              {installment.paymentHistory && installment.paymentHistory.length > 0 ? (
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {installment.paymentHistory.map((rec, index) => (
                    <div 
                      key={rec.id || index}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200/70 text-xs"
                    >
                      <div>
                        <span className="font-mono font-bold text-emerald-700">+{formatCurrency(rec.amount)}</span>
                        {rec.note && (
                          <span className="text-slate-600 text-[11px] block">{rec.note}</span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400">
                        {new Date(rec.date).toLocaleDateString()} {new Date(rec.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-2.5 bg-slate-50 rounded-xl text-center text-xs text-slate-400">
                  Sin historial individual de transacciones.
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
