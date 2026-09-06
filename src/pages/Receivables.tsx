import React, { useState, useMemo } from 'react';
import { 
  CreditCard, Search, Calendar, Clock, AlertCircle, CheckCircle2, 
  MessageSquare, DollarSign, Receipt, Filter, ArrowUpRight, ArrowDownRight,
  TrendingDown, ShieldAlert, Sparkles, User, Phone, Check, Copy, ExternalLink,
  ChevronRight, RefreshCw, SlidersHorizontal, ArrowUpDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useInventory } from '../context/InventoryContext';
import { Sale, Installment, Customer } from '../types';
import { 
  formatCurrency, 
  getSaleInstallments,
  getInstallmentPaidAmount,
  getInstallmentRemainingAmount,
  getInstallmentSummary,
  getDueDateDetails,
  createWhatsAppReminderMessage 
} from '../utils';
import { InstallmentPaymentModal } from '../components/InstallmentPaymentModal';
import { InstallmentReceipt } from '../components/InstallmentReceipt';
import { useNavigate } from 'react-router-dom';

interface InstallmentRowItem {
  sale: Sale;
  installment: Installment;
  paidAmount: number;
  remainingAmount: number;
  dueInfo: ReturnType<typeof getDueDateDetails>;
  totalSalePending: number;
  totalSaleInstallments: number;
}

type FilterTab = 'pending' | 'overdue' | 'today' | 'this-week' | 'upcoming' | 'paid';
type SortOption = 'urgent' | 'amount-desc' | 'customer-asc' | 'date-desc';

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
};

export function Receivables() {
  const { sales, customers, isLoading } = useInventory();
  const navigate = useNavigate();

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
      if (activeTab === 'upcoming' && (isPaid || item.dueInfo.diffDays <= 7)) return false;
      if (activeTab === 'paid' && !isPaid) return false;

      // Search filter (customer name, phone, or sale id)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const custName = (item.sale.customerName || '').toLowerCase();
        const custPhone = (item.sale.customerPhone || '').toLowerCase();
        const saleId = item.sale.id.toLowerCase();
        const matches = custName.includes(q) || custPhone.includes(q) || saleId.includes(q);
        if (!matches) return false;
      }

      return true;
    });

    // Sorting
    filtered.sort((a, b) => {
      if (sortBy === 'urgent') {
        // Overdue first (most overdue), then today, then upcoming
        return a.dueInfo.diffDays - b.dueInfo.diffDays;
      }
      if (sortBy === 'amount-desc') {
        return b.remainingAmount - a.remainingAmount;
      }
      if (sortBy === 'customer-asc') {
        return (a.sale.customerName || '').localeCompare(b.sale.customerName || '');
      }
      if (sortBy === 'date-desc') {
        return new Date(b.sale.date).getTime() - new Date(a.sale.date).getTime();
      }
      return 0;
    });

    return filtered;
  }, [allInstallmentItems, activeTab, searchQuery, sortBy]);

  // Handle WhatsApp Reminder
  const handleSendReminder = (item: InstallmentRowItem) => {
    const message = createWhatsAppReminderMessage({
      customerName: item.sale.customerName,
      installmentNumber: item.installment.number,
      totalInstallments: item.totalSaleInstallments,
      installmentAmount: item.installment.amount,
      paidAmount: item.paidAmount,
      installmentRemaining: item.remainingAmount,
      totalPendingDebt: item.totalSalePending,
      dueDateStr: item.installment.dueDate,
      storeName: 'la tienda',
    });

    const cleanPhone = item.sale.customerPhone?.replace(/\D/g, '');
    const url = cleanPhone 
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;

    window.open(url, '_blank');
    showToast(`Recordatorio preparado para ${item.sale.customerName || 'el cliente'}`);
  };

  // Copy Reminder Message to Clipboard
  const handleCopyMessage = (item: InstallmentRowItem) => {
    const message = createWhatsAppReminderMessage({
      customerName: item.sale.customerName,
      installmentNumber: item.installment.number,
      totalInstallments: item.totalSaleInstallments,
      installmentAmount: item.installment.amount,
      paidAmount: item.paidAmount,
      installmentRemaining: item.remainingAmount,
      totalPendingDebt: item.totalSalePending,
      dueDateStr: item.installment.dueDate,
      storeName: 'la tienda',
    });

    navigator.clipboard.writeText(message);
    showToast('Mensaje de recordatorio copiado al portapapeles');
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            Cartera y Cobranzas
            <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-bold">
              {metrics.pendingCount} cuotas activas
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Seguimiento de cuotas, alertas de mora, abonos parciales y recordatorios automáticos
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/sales')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/80 transition-colors cursor-pointer"
          >
            <Receipt className="w-4 h-4 text-indigo-600" />
            Nueva Venta a Crédito
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
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
            {formatCurrency(metrics.totalPortfolioPending)}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            {metrics.pendingCount} cuotas por cobrar
          </p>
        </div>

        {/* En Mora (Vencidas) */}
        <div className={`p-4 rounded-2xl border shadow-xs transition-colors ${
          metrics.overdueCount > 0 
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
            {formatCurrency(metrics.totalOverdue)}
          </div>
          <p className="text-[11px] text-rose-600/80 font-medium mt-1">
            {metrics.overdueCount === 0 ? 'Sin cuotas vencidas 🎉' : `${metrics.overdueCount} cuotas requieren cobro`}
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
            {formatCurrency(metrics.totalDueThisWeek)}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            {metrics.dueThisWeekCount} cuotas por vencer
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
            {formatCurrency(metrics.totalPaidCollected)}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Total pagado en créditos
          </p>
        </div>
      </div>

      {/* Tabs Filter Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-200/80 no-scrollbar -mx-3.5 px-3.5 sm:mx-0 sm:px-0">
        <button
          type="button"
          onClick={() => setActiveTab('pending')}
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
            {metrics.pendingCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('overdue')}
          className={`min-h-[44px] px-4 py-2.5 rounded-2xl text-xs font-bold whitespace-nowrap transition-all active:scale-95 cursor-pointer flex items-center gap-2 ${
            activeTab === 'overdue'
              ? 'bg-rose-600 text-white shadow-sm'
              : 'text-rose-700 bg-rose-50 hover:bg-rose-100/80 border border-rose-200/60'
          }`}
        >
          🚨 En Mora (Vencidas)
          {metrics.overdueCount > 0 && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-white text-rose-700 font-black shadow-2xs">
              {metrics.overdueCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('today')}
          className={`min-h-[44px] px-4 py-2.5 rounded-2xl text-xs font-bold whitespace-nowrap transition-all active:scale-95 cursor-pointer flex items-center gap-2 ${
            activeTab === 'today'
              ? 'bg-amber-600 text-white shadow-sm'
              : 'text-amber-800 bg-amber-50 hover:bg-amber-100/80 border border-amber-200/60'
          }`}
        >
          Vencen Hoy
          {metrics.dueTodayCount > 0 && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-200/80 text-amber-900 font-bold">
              {metrics.dueTodayCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('this-week')}
          className={`min-h-[44px] px-4 py-2.5 rounded-2xl text-xs font-bold whitespace-nowrap transition-all active:scale-95 cursor-pointer flex items-center gap-2 ${
            activeTab === 'this-week'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 bg-white border border-slate-200/80 hover:bg-slate-50'
          }`}
        >
          Esta Semana ({metrics.dueThisWeekCount})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('upcoming')}
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
          onClick={() => setActiveTab('paid')}
          className={`min-h-[44px] px-4 py-2.5 rounded-2xl text-xs font-bold whitespace-nowrap transition-all active:scale-95 cursor-pointer ${
            activeTab === 'paid'
              ? 'bg-emerald-700 text-white shadow-sm'
              : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-200/60'
          }`}
        >
          Pagadas
        </button>
      </div>

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
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center"
          >
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
          </motion.div>
        ) : (
          <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-3">
            {displayedItems.map(item => {
              const isFullyPaid = item.remainingAmount <= 0.01;
              const percentPaid = item.installment.amount > 0 
                ? Math.min(100, Math.round((item.paidAmount / item.installment.amount) * 100))
                : 100;
              const hasPartialPayment = item.paidAmount > 0 && !isFullyPaid;

              return (
                <motion.div 
                  key={`${item.sale.id}-${item.installment.number}`}
                  variants={itemVariants}
                  layoutId={`installment-${item.sale.id}-${item.installment.number}`}
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
                          onClick={() => setSelectedSaleForReceipt(item.sale)}
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

                {/* Action Buttons Toolbar - Optimized for Mobile Thumb Navigation */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-2 border-t border-slate-100">
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* WhatsApp Reminder Button */}
                    {!isFullyPaid && (
                      <div className="inline-flex items-stretch rounded-2xl shadow-2xs border border-emerald-300/80 bg-emerald-50 overflow-hidden flex-1 sm:flex-initial">
                        <button
                          type="button"
                          onClick={() => handleSendReminder(item)}
                          className="min-h-[44px] px-3.5 py-2.5 text-xs font-extrabold text-emerald-800 hover:bg-emerald-100/90 active:bg-emerald-200 transition-all cursor-pointer flex items-center justify-center gap-2 flex-1 sm:flex-initial select-none"
                          title="Enviar recordatorio automático por WhatsApp"
                        >
                          <MessageSquare className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>Recordar Pago</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCopyMessage(item)}
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
                      onClick={() => setSelectedSaleForReceipt(item.sale)}
                      className="min-h-[44px] px-3.5 py-2.5 rounded-2xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200/90 active:bg-slate-300 transition-all cursor-pointer flex items-center justify-center gap-2 select-none flex-1 sm:flex-initial"
                    >
                      <Receipt className="w-4 h-4 text-slate-500 shrink-0" />
                      <span>Ver Tirilla</span>
                    </button>
                  </div>

                  {/* Payment Button - Prominent touch target on Mobile */}
                  <div className="flex items-stretch sm:items-center gap-2 sm:ml-auto">
                    {!isFullyPaid ? (
                      <button
                        type="button"
                        onClick={() => setPaymentModalData({ sale: item.sale, installment: item.installment })}
                        className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-extrabold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 shadow-md shadow-indigo-600/20 transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-98 select-none"
                      >
                        <DollarSign className="w-4 h-4" />
                        <span>Abonar / Pagar</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setPaymentModalData({ sale: item.sale, installment: item.installment })}
                        className="w-full sm:w-auto min-h-[44px] px-4 py-2.5 rounded-2xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 transition-all cursor-pointer flex items-center justify-center gap-1.5 select-none"
                        title="Ver detalles o historial de abonos"
                      >
                        <span>Ver Abonos</span>
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
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
