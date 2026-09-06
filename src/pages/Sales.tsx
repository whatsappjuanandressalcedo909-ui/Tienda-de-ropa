import React, { useState, useMemo, useEffect } from 'react';
import { 
  ShoppingBag, Receipt, Filter, ShoppingCart, Search 
} from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { formatCurrency, getInstallmentSummary, getWhatsAppReminderUrl } from '../utils';
import { Sale } from '../types';
import { useSearchParams } from 'react-router-dom';
import { InstallmentReceipt } from '../components/InstallmentReceipt';
import { NewSaleModal } from '../components/sales/NewSaleModal';
import { SaleListItem } from '../components/sales/SaleListItem';
import { CancelSaleModal } from '../components/sales/CancelSaleModal';

type DateFilter = 'all' | 'today' | 'week' | 'month';

export function Sales() {
  const { sales, inventory, customers, saveCustomer, addSale, cancelSale, hasMoreSales, loadMoreSales, isLoading } = useInventory();
  const [searchParams] = useSearchParams();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [customerFilter, setCustomerFilter] = useState<string>('all');
  const [saleSearchQuery, setSaleSearchQuery] = useState('');
  const [saleToCancel, setSaleToCancel] = useState<Sale | null>(null);
  const [saleForReceipt, setSaleForReceipt] = useState<Sale | null>(null);
  const [preselectedCustomerId, setPreselectedCustomerId] = useState<string | undefined>(undefined);

  // Auto-open modal with customer pre-selected if navigated from Customers page
  useEffect(() => {
    const custId = searchParams.get('customerId');
    if (custId) {
      setPreselectedCustomerId(custId);
      setIsModalOpen(true);
    }
  }, [searchParams]);

  // Filters logic
  const filteredSales = useMemo(() => {
    const now = new Date();
    const q = saleSearchQuery.toLowerCase().trim();

    return sales.filter(sale => {
      // Date filter
      const saleDate = new Date(sale.date);
      if (dateFilter === 'today') {
        if (saleDate.toDateString() !== now.toDateString()) return false;
      } else if (dateFilter === 'week') {
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        startOfWeek.setHours(0, 0, 0, 0);
        if (saleDate < startOfWeek) return false;
      } else if (dateFilter === 'month') {
        if (saleDate.getMonth() !== now.getMonth() || saleDate.getFullYear() !== now.getFullYear()) {
          return false;
        }
      }

      // Customer filter
      if (customerFilter !== 'all' && sale.customerId !== customerFilter) {
        return false;
      }

      // Search query filter (Invoice ID, customer name, customer email, products)
      if (q) {
        const matchesInvoice = sale.id.toLowerCase().includes(q);
        const matchesCustomer = sale.customerName?.toLowerCase().includes(q) || 
                                sale.customerEmail?.toLowerCase().includes(q) ||
                                sale.customerPhone?.toLowerCase().includes(q);
        const matchesProducts = sale.items?.some(it => it.productName.toLowerCase().includes(q));
        if (!matchesInvoice && !matchesCustomer && !matchesProducts) {
          return false;
        }
      }

      return true;
    });
  }, [sales, dateFilter, customerFilter, saleSearchQuery]);

  const totalRevenue = useMemo(() => {
    return filteredSales
      .filter(s => s.status === 'completed')
      .reduce((acc, sale) => acc + sale.total, 0);
  }, [filteredSales]);

  const handleSendSaleReminder = (sale: Sale) => {
    const summary = getInstallmentSummary(sale);
    const nextPending = summary.pendingList[0];
    if (!nextPending) return;

    const url = getWhatsAppReminderUrl({
      phone: sale.customerPhone,
      customerName: sale.customerName || 'Cliente',
      installmentAmount: nextPending.amount,
      installmentRemaining: nextPending.amount - (nextPending.paidAmount || 0),
      totalPendingDebt: summary.totalPending,
      dueDateStr: nextPending.dueDate,
    });

    window.open(url, '_blank');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">Ventas</h2>
        <button
          id="btn-new-sale"
          onClick={() => {
            setPreselectedCustomerId(undefined);
            setIsModalOpen(true);
          }}
          className="min-h-[44px] flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all shadow-sm cursor-pointer select-none active:scale-95"
        >
          <ShoppingCart className="w-4 h-4" />
          Nueva Venta
        </button>
      </div>

      {/* Filters bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Date Filter Pills */}
        <div className="bg-white p-1.5 rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.02)] border border-slate-100 flex items-center overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-1 min-w-max">
            <Filter className="w-4 h-4 text-slate-400 ml-2 mr-1" />
            <button onClick={() => setDateFilter('today')} className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 ${dateFilter === 'today' ? 'bg-indigo-50 text-indigo-700 font-extrabold' : 'text-slate-600 hover:bg-slate-50'}`}>Hoy</button>
            <button onClick={() => setDateFilter('week')} className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 ${dateFilter === 'week' ? 'bg-indigo-50 text-indigo-700 font-extrabold' : 'text-slate-600 hover:bg-slate-50'}`}>Esta semana</button>
            <button onClick={() => setDateFilter('month')} className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 ${dateFilter === 'month' ? 'bg-indigo-50 text-indigo-700 font-extrabold' : 'text-slate-600 hover:bg-slate-50'}`}>Este mes</button>
            <button onClick={() => setDateFilter('all')} className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 ${dateFilter === 'all' ? 'bg-indigo-50 text-indigo-700 font-extrabold' : 'text-slate-600 hover:bg-slate-50'}`}>Todas</button>
          </div>
        </div>

        {/* Filter by Customer */}
        <div className="flex-1 flex flex-col sm:flex-row gap-2">
          <select
            value={customerFilter}
            onChange={e => setCustomerFilter(e.target.value)}
            className="flex-1 min-h-[48px] bg-white px-4 py-3 border border-slate-200/80 rounded-2xl text-base sm:text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm cursor-pointer"
          >
            <option value="all">Filtrar por Cliente: Todos</option>
            {customers.map(c => (
              <option key={c.id} value={c.id}>
                {c.firstName} {c.lastName} ({c.email})
              </option>
            ))}
          </select>

          {/* Search invoices */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={saleSearchQuery}
              onChange={(e) => setSaleSearchQuery(e.target.value)}
              placeholder="Buscar venta o cliente..."
              className="w-full pl-10 pr-4 py-3 min-h-[48px] bg-white border border-slate-200/80 rounded-2xl text-base sm:text-xs text-slate-800 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
            />
          </div>
        </div>
      </div>

      {/* Revenue Card */}
      <div className="bg-white p-5 rounded-3xl shadow-[0_2px_12px_rgba(0,0,0,0.02)] border border-slate-100/60 flex items-center justify-between">
        <div>
          <h3 className="text-[12px] font-bold tracking-wide uppercase text-slate-400 mb-1">
            Ingresos {customerFilter !== 'all' ? `(Cliente seleccionado)` : `(${dateFilter})`}
          </h3>
          <p className="text-3xl font-black text-slate-900">{formatCurrency(totalRevenue)}</p>
          <p className="text-xs text-slate-500 mt-1">
            {filteredSales.filter(s => s.status === 'completed').length} factura(s) completada(s)
          </p>
        </div>
        <div className="bg-indigo-50 p-4 rounded-2xl text-indigo-600">
          <ShoppingBag className="w-8 h-8" />
        </div>
      </div>

      {/* Sales Invoices List */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white p-5 rounded-3xl shadow-[0_2px_12px_rgba(0,0,0,0.02)] border border-slate-100 animate-pulse">
                 <div className="flex justify-between items-start mb-3 border-b border-slate-50 pb-3">
                   <div className="space-y-2 w-1/2">
                      <div className="h-4 bg-slate-100 rounded-full w-24"></div>
                      <div className="h-3 bg-slate-100 rounded-full w-32"></div>
                      <div className="h-3 bg-slate-100 rounded-full w-20"></div>
                   </div>
                   <div className="h-6 bg-slate-100 rounded-full w-24"></div>
                 </div>
                 <div className="space-y-2 mb-4">
                    <div className="flex justify-between">
                       <div className="h-3 bg-slate-100 rounded-full w-32"></div>
                       <div className="h-3 bg-slate-100 rounded-full w-16"></div>
                    </div>
                    <div className="flex justify-between">
                       <div className="h-3 bg-slate-100 rounded-full w-24"></div>
                       <div className="h-3 bg-slate-100 rounded-full w-16"></div>
                    </div>
                 </div>
                 <div className="flex justify-between pt-3 border-t border-slate-50">
                    <div className="h-6 bg-slate-100 rounded-full w-32"></div>
                    <div className="h-8 bg-slate-100 rounded-2xl w-24"></div>
                 </div>
              </div>
            ))}
          </div>
        ) : filteredSales.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-3xl border border-slate-100 border-dashed animate-in fade-in duration-200">
            <Receipt className="mx-auto h-10 w-10 text-slate-300 mb-3" />
            <h3 className="text-base font-semibold text-slate-900">No hay ventas registradas</h3>
            <p className="mt-1 text-xs text-slate-500">
              {customerFilter !== 'all' 
                ? 'Este cliente no tiene ventas para el filtro seleccionado.' 
                : 'No se encontraron ventas para este periodo.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4 animate-in fade-in duration-200">
            {filteredSales.map(sale => (
              <SaleListItem
                key={sale.id}
                sale={sale}
                onSendReminder={handleSendSaleReminder}
                onViewReceipt={(s) => setSaleForReceipt(s)}
                onCancelSale={(s) => setSaleToCancel(s)}
              />
            ))}
            
            {hasMoreSales && filteredSales.length > 0 && (
              <div className="pt-4 flex justify-center">
                <button
                  onClick={loadMoreSales}
                  className="px-6 py-2.5 bg-white border border-slate-200 text-slate-700 text-xs font-bold rounded-xl shadow-sm hover:bg-slate-50 active:scale-95 transition-all cursor-pointer"
                >
                  Cargar más ventas históricas
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Cart & Customer Sale Modal */}
      <NewSaleModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setPreselectedCustomerId(undefined);
        }}
        inventory={inventory}
        customers={customers}
        initialCustomerId={preselectedCustomerId}
        onSaveCustomer={saveCustomer}
        onCompleteSale={addSale}
      />

      {/* Cancel Sale Confirmation Modal */}
      <CancelSaleModal
        sale={saleToCancel}
        onClose={() => setSaleToCancel(null)}
        onConfirmCancel={cancelSale}
      />

      {/* Installment Receipt Modal */}
      {saleForReceipt && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-t-[2rem] sm:rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-100 p-4 sm:p-6 overflow-y-auto">
            <InstallmentReceipt 
              sale={sales.find(s => s.id === saleForReceipt.id) || saleForReceipt}
              onBack={() => setSaleForReceipt(null)}
              showBackButton={true}
            />
          </div>
        </div>
      )}
    </div>
  );
}
