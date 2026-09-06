import React, { useState, useMemo } from 'react';
import { 
  CreditCard, Search, CheckCircle2, Receipt, RefreshCw 
} from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { Sale, Installment } from '../types';
import { 
  getSaleInstallments,
  getInstallmentPaidAmount,
  getInstallmentRemainingAmount,
  getInstallmentSummary,
  getDueDateDetails,
  createWhatsAppReminderMessage 
} from '../utils';
import { InstallmentPaymentModal } from '../components/InstallmentPaymentModal';
import { InstallmentReceipt } from '../components/InstallmentReceipt';
import { ReceivableCard, InstallmentRowItem } from '../components/receivables/ReceivableCard';
import { ReceivablesKPIs } from '../components/receivables/ReceivablesKPIs';
import { ReceivablesTabs, FilterTab } from '../components/receivables/ReceivablesTabs';

type SortOption = 'urgent' | 'amount-desc' | 'customer-asc' | 'date-desc';

export function Receivables() {
  const { sales, isLoading } = useInventory();

  // Filters & State
  const [activeTab, setActiveTab] = useState<FilterTab>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('urgent');
  
  // Modals
  const [paymentModalData, setPaymentModalData] = useState<{ sale: Sale; installment: Installment } | null>(null);
  const [selectedSaleForReceipt, setSelectedSaleForReceipt] = useState<Sale | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Extract all credit installments across completed sales
  const allInstallmentItems: InstallmentRowItem[] = useMemo(() => {
    const rows: InstallmentRowItem[] = [];

    // Consider completed sales that are credit or have installments
    const creditSales = sales.filter(s => s.status === 'completed' && (s.paymentMethod === 'credit' || (s.installments && s.installments > 1)));

    creditSales.forEach(sale => {
      const installments = getSaleInstallments(sale);
      const summary = getInstallmentSummary(sale);

      installments.forEach(inst => {
        const paid = getInstallmentPaidAmount(inst);
        const remaining = getInstallmentRemainingAmount(inst);
        const dueInfo = getDueDateDetails(inst.dueDate);

        rows.push({
          sale,
          installment: inst,
          paidAmount: paid,
          remainingAmount: remaining,
          dueInfo,
          totalSalePending: summary.totalPending,
          totalSaleInstallments: installments.length,
        });
      });
    });

    return rows;
  }, [sales]);

  // Financial KPIs
  const metrics = useMemo(() => {
    let totalPortfolioPending = 0;
    let totalOverdue = 0;
    let overdueCount = 0;
    let totalDueToday = 0;
    let dueTodayCount = 0;
    let totalDueThisWeek = 0;
    let dueThisWeekCount = 0;
    let totalPaidCollected = 0;
    let pendingCount = 0;

    allInstallmentItems.forEach(item => {
      totalPaidCollected += item.paidAmount;

      if (item.remainingAmount > 0.01) {
        totalPortfolioPending += item.remainingAmount;
        pendingCount++;

        if (item.dueInfo.isOverdue) {
          totalOverdue += item.remainingAmount;
          overdueCount++;
        }

        if (item.dueInfo.isToday) {
          totalDueToday += item.remainingAmount;
          dueTodayCount++;
        }

        if (item.dueInfo.isThisWeek) {
          totalDueThisWeek += item.remainingAmount;
          dueThisWeekCount++;
        }
      }
    });

    return {
      totalPortfolioPending,
      totalOverdue,
      overdueCount,
      totalDueToday,
      dueTodayCount,
      totalDueThisWeek,
      dueThisWeekCount,
      totalPaidCollected,
      pendingCount,
    };
  }, [allInstallmentItems]);

  // Filtered and Sorted Rows
  const displayedItems = useMemo(() => {
    let filtered = allInstallmentItems.filter(item => {
      const isPaid = item.remainingAmount <= 0.01;

      // Tab filter
      if (activeTab === 'pending' && isPaid) return false;
      if (activeTab === 'overdue' && (isPaid || !item.dueInfo.isOverdue)) return false;
      if (activeTab === 'today' && (isPaid || !item.dueInfo.isToday)) return false;
      if (activeTab === 'this-week' && (isPaid || !item.dueInfo.isThisWeek)) return false;
      if (activeTab === 'upcoming' && (isPaid || item.dueInfo.isOverdue || item.dueInfo.isToday || item.dueInfo.isThisWeek)) return false;
      if (activeTab === 'paid' && !isPaid) return false;

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesCustomer = item.sale.customerName?.toLowerCase().includes(q) || false;
        const matchesPhone = item.sale.customerPhone?.includes(q) || false;
        const matchesSaleId = item.sale.id.toLowerCase().includes(q);

        if (!matchesCustomer && !matchesPhone && !matchesSaleId) {
          return false;
        }
      }

      return true;
    });

    // Sorting
    filtered.sort((a, b) => {
      if (sortBy === 'urgent') {
        const aPaid = a.remainingAmount <= 0.01;
        const bPaid = b.remainingAmount <= 0.01;
        if (aPaid && !bPaid) return 1;
        if (!aPaid && bPaid) return -1;
        return a.dueInfo.diffDays - b.dueInfo.diffDays;
      }
      if (sortBy === 'amount-desc') {
        return b.remainingAmount - a.remainingAmount;
      }
      if (sortBy === 'customer-asc') {
        const nameA = a.sale.customerName || '';
        const nameB = b.sale.customerName || '';
        return nameA.localeCompare(nameB);
      }
      if (sortBy === 'date-desc') {
        return new Date(b.sale.date).getTime() - new Date(a.sale.date).getTime();
      }
      return 0;
    });

    return filtered;
  }, [allInstallmentItems, activeTab, searchQuery, sortBy]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  const handleSendReminder = (item: InstallmentRowItem) => {
    const phone = item.sale.customerPhone;
    if (!phone) {
      alert('Esta venta no tiene un número de teléfono/WhatsApp asociado.');
      return;
    }

    const message = createWhatsAppReminderMessage({
      customerName: item.sale.customerName || 'Cliente',
      installmentNumber: item.installment.number,
      totalInstallments: item.totalSaleInstallments,
      installmentAmount: item.installment.amount,
      paidAmount: item.paidAmount,
      installmentRemaining: item.remainingAmount,
      totalPendingDebt: item.totalSalePending,
      dueDateStr: item.installment.dueDate,
    });

    const cleanPhone = phone.replace(/\D/g, '');
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const handleCopyMessage = (item: InstallmentRowItem) => {
    const message = createWhatsAppReminderMessage({
      customerName: item.sale.customerName || 'Cliente',
      installmentNumber: item.installment.number,
      totalInstallments: item.totalSaleInstallments,
      installmentAmount: item.installment.amount,
      paidAmount: item.paidAmount,
      installmentRemaining: item.remainingAmount,
      totalPendingDebt: item.totalSalePending,
      dueDateStr: item.installment.dueDate,
    });

    navigator.clipboard.writeText(message);
    showToast('Mensaje de recordatorio copiado al portapapeles');
  };

  return (
    <div className="space-y-6">
      {/* Top Title Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <CreditCard className="w-6 h-6 text-indigo-600" />
            Cuentas por Cobrar
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Control de créditos, cuotas pendientes, fechas de vencimiento y cobranza
          </p>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <ReceivablesKPIs
        totalPortfolioPending={metrics.totalPortfolioPending}
        pendingCount={metrics.pendingCount}
        totalOverdue={metrics.totalOverdue}
        overdueCount={metrics.overdueCount}
        totalDueThisWeek={metrics.totalDueThisWeek}
        dueThisWeekCount={metrics.dueThisWeekCount}
        totalPaidCollected={metrics.totalPaidCollected}
      />

      {/* Tabs Filter Bar */}
      <ReceivablesTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
        pendingCount={metrics.pendingCount}
        overdueCount={metrics.overdueCount}
        dueTodayCount={metrics.dueTodayCount}
        dueThisWeekCount={metrics.dueThisWeekCount}
      />

      {/* Search & Sort Controls */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por cliente, teléfono o # factura..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-3 min-h-[48px] bg-white border border-slate-200/90 rounded-2xl text-base sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs placeholder:text-slate-400"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative w-full sm:w-auto">
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as SortOption)}
              className="w-full sm:w-auto bg-white border border-slate-200/90 rounded-2xl px-4 py-3 min-h-[48px] text-base sm:text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-2xs"
            >
              <option value="urgent">Ordenar por urgencia (vencidas primero)</option>
              <option value="amount-desc">Mayor saldo pendiente</option>
              <option value="customer-asc">Cliente (A - Z)</option>
              <option value="date-desc">Ventas más recientes</option>
            </select>
          </div>
        </div>
      </div>

      {/* List of Installment Cards */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.02)] animate-pulse">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-slate-100 shrink-0"></div>
                    <div className="space-y-2">
                       <div className="h-4 bg-slate-100 rounded-full w-24"></div>
                       <div className="h-3 bg-slate-100 rounded-full w-32"></div>
                    </div>
                  </div>
                  <div className="h-6 bg-slate-100 rounded-full w-20"></div>
                </div>
                <div className="flex justify-between items-end border-t border-slate-50 pt-3">
                  <div className="space-y-2">
                     <div className="h-3 bg-slate-100 rounded-full w-16"></div>
                     <div className="h-3 bg-slate-100 rounded-full w-24"></div>
                  </div>
                  <div className="h-8 bg-slate-100 rounded-full w-32"></div>
                </div>
              </div>
            ))}
          </div>
        ) : displayedItems.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center animate-in fade-in duration-200">
            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-400">
              <CreditCard className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">No se encontraron cuotas</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {searchQuery 
                ? 'No hay registros que coincidan con la búsqueda ingresada.' 
                : activeTab === 'overdue'
                ? '¡Excelente noticia! No tienes ninguna cuota vencida en mora.'
                : 'No hay cuotas en este filtro actualmente.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3 animate-in fade-in duration-200">
            {displayedItems.map(item => (
              <ReceivableCard
                key={`${item.sale.id}-${item.installment.number}`}
                item={item}
                onSendReminder={handleSendReminder}
                onCopyMessage={handleCopyMessage}
                onViewReceipt={(sale) => setSelectedSaleForReceipt(sale)}
                onOpenPayment={(sale, inst) => setPaymentModalData({ sale, installment: inst })}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modal: Partial / Full Payment */}
      {paymentModalData && (
        <InstallmentPaymentModal
          sale={paymentModalData.sale}
          installment={paymentModalData.installment}
          isOpen={true}
          onClose={() => setPaymentModalData(null)}
          onSuccess={() => {
            showToast('Pago/abono actualizado con éxito');
          }}
        />
      )}

      {/* Modal: Sale Receipt & Thermal Ticket */}
      {selectedSaleForReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-2 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[92vh]">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Receipt className="w-4 h-4 text-indigo-600" />
                Tirilla de Venta #{selectedSaleForReceipt.id.slice(0, 6).toUpperCase()}
              </h3>
              <button
                type="button"
                onClick={() => setSelectedSaleForReceipt(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1">
              <InstallmentReceipt
                sale={selectedSaleForReceipt}
                showBackButton={false}
              />
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 text-xs font-bold animate-in fade-in slide-in-from-bottom-4 duration-200 border border-slate-700/60 backdrop-blur-sm">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
