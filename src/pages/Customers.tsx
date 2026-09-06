import React, { useState, useMemo } from 'react';
import { 
  Users, UserPlus, Search, UserCheck, DollarSign
} from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { Customer, Sale } from '../types';
import { formatCurrency, getInstallmentSummary, getWhatsAppReminderUrl } from '../utils';
import { useNavigate } from 'react-router-dom';
import { downloadOrShareCustomerPDF } from '../utils/pdfGenerator';
import { CustomerFormModal } from '../components/customers/CustomerFormModal';
import { CustomerHistoryModal } from '../components/customers/CustomerHistoryModal';
import { CustomerListItem } from '../components/customers/CustomerListItem';

export function Customers() {
  const { customers, saveCustomer, deleteCustomer, sales, isLoading, isOnline, pendingSyncCount } = useInventory();
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [historyModalCustomer, setHistoryModalCustomer] = useState<Customer | null>(null);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [toastNotification, setToastNotification] = useState<string | null>(null);
  const [expandedCustomerId, setExpandedCustomerId] = useState<string | null>(null);

  // Customer sales aggregation
  const customerStatsMap = useMemo(() => {
    const map = new Map<string, { totalSpent: number; purchaseCount: number; lastPurchaseDate?: string }>();
    
    customers.forEach(c => {
      map.set(c.id, { totalSpent: 0, purchaseCount: 0 });
    });

    sales.forEach(sale => {
      if (sale.status === 'completed' && sale.customerId) {
        const current = map.get(sale.customerId) || { totalSpent: 0, purchaseCount: 0 };
        current.totalSpent += sale.total;
        current.purchaseCount += 1;
        if (!current.lastPurchaseDate || new Date(sale.date) > new Date(current.lastPurchaseDate)) {
          current.lastPurchaseDate = sale.date;
        }
        map.set(sale.customerId, current);
      }
    });

    return map;
  }, [customers, sales]);

  // Customer credit & installments balance aggregation
  const customerCreditMap = useMemo(() => {
    const map = new Map<string, { totalPendingDebt: number; pendingCount: number; activeCredits: number }>();
    customers.forEach(c => {
      map.set(c.id, { totalPendingDebt: 0, pendingCount: 0, activeCredits: 0 });
    });

    sales.forEach(sale => {
      if (sale.status === 'completed' && sale.customerId) {
        const summary = getInstallmentSummary(sale);
        if (summary.totalPending > 0) {
          const curr = map.get(sale.customerId) || { totalPendingDebt: 0, pendingCount: 0, activeCredits: 0 };
          curr.totalPendingDebt += summary.totalPending;
          curr.pendingCount += summary.pendingCount;
          curr.activeCredits += 1;
          map.set(sale.customerId, curr);
        }
      }
    });

    return map;
  }, [customers, sales]);

  // Overall statistics
  const totalCustomers = customers.length;
  const activeCustomersCount = useMemo(() => {
    let count = 0;
    customerStatsMap.forEach(stats => {
      if (stats.purchaseCount > 0) count++;
    });
    return count;
  }, [customerStatsMap]);

  const totalSalesToCustomers = useMemo(() => {
    let sum = 0;
    customerStatsMap.forEach(stats => {
      sum += stats.totalSpent;
    });
    return sum;
  }, [customerStatsMap]);

  // Filter customers by query
  const filteredCustomers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return customers;
    return customers.filter(c => 
      c.firstName.toLowerCase().includes(q) ||
      c.lastName.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      (c.phone && c.phone.toLowerCase().includes(q))
    );
  }, [customers, searchQuery]);

  const handleOpenCreateModal = () => {
    setEditingCustomer(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (c: Customer) => {
    setEditingCustomer(c);
    setIsModalOpen(true);
  };

  const handleSaveCustomer = (customerData: { firstName: string; lastName: string; email: string; phone?: string }) => {
    saveCustomer(customerData, editingCustomer?.id);
    setIsModalOpen(false);
    if (!isOnline) {
      setToastNotification(`¡Cliente guardado en IndexedDB! Se sincronizará automáticamente con Firebase al recuperar conexión.`);
      setTimeout(() => setToastNotification(null), 4500);
    } else {
      setToastNotification(`Cliente ${customerData.firstName} guardado exitosamente.`);
      setTimeout(() => setToastNotification(null), 3000);
    }
  };

  const handleDelete = (c: Customer) => {
    const stats = customerStatsMap.get(c.id);
    const hasSales = (stats?.purchaseCount || 0) > 0;
    const confirmMessage = hasSales
      ? `¿Eliminar a ${c.firstName} ${c.lastName}? Tiene ${stats?.purchaseCount} venta(s) registrada(s). Las ventas existentes no se perderán.`
      : `¿Eliminar al cliente ${c.firstName} ${c.lastName}?`;

    if (window.confirm(confirmMessage)) {
      deleteCustomer(c.id);
      if (historyModalCustomer?.id === c.id) {
        setHistoryModalCustomer(null);
      }
    }
  };

  // Handle Export & Share Customer Statement PDF
  const handleExportPDF = async (targetCustomer: Customer) => {
    setIsExportingPDF(true);
    try {
      const custSales = sales.filter(s => s.customerId === targetCustomer.id);
      const res = await downloadOrShareCustomerPDF(targetCustomer, custSales);
      if (res.shared) {
        setToastNotification(`¡Resumen en PDF de ${targetCustomer.firstName} compartido exitosamente!`);
      } else {
        setToastNotification(`¡PDF de ${targetCustomer.firstName} descargado correctamente!`);
      }
      setTimeout(() => setToastNotification(null), 4000);
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        console.error('Error generating PDF:', err);
        setToastNotification('Ocurrió un error al generar el PDF.');
        setTimeout(() => setToastNotification(null), 4000);
      }
    } finally {
      setIsExportingPDF(false);
    }
  };

  const handleSendSaleReminder = (sale: Sale) => {
    const summary = getInstallmentSummary(sale);
    const nextPending = summary.pendingList[0];
    if (!nextPending) return;

    const url = getWhatsAppReminderUrl({
      phone: sale.customerPhone || historyModalCustomer?.phone,
      customerName: sale.customerName || `${historyModalCustomer?.firstName || ''} ${historyModalCustomer?.lastName || ''}`.trim(),
      installmentAmount: nextPending.amount,
      installmentRemaining: nextPending.amount - (nextPending.paidAmount || 0),
      totalPendingDebt: summary.totalPending,
      dueDateStr: nextPending.dueDate,
    });

    window.open(url, '_blank');
    setToastNotification(`Recordatorio preparado para ${sale.customerName || 'el cliente'}`);
    setTimeout(() => setToastNotification(null), 3500);
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            Clientes
            <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-bold">
              {totalCustomers}
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">Administra tu base de clientes y consulta sus compras</p>
        </div>
        
        <button
          id="btn-new-customer"
          onClick={handleOpenCreateModal}
          className="min-h-[44px] flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all shadow-sm cursor-pointer active:scale-95 select-none"
        >
          <UserPlus className="w-4 h-4" />
          Nuevo Cliente
        </button>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white p-4 rounded-3xl shadow-[0_2px_12px_rgba(0,0,0,0.02)] border border-slate-100/60 flex items-center gap-3">
          <div className="bg-indigo-50 p-3 rounded-2xl text-indigo-600">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Clientes</p>
            <p className="text-xl font-black text-slate-900">{totalCustomers}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-3xl shadow-[0_2px_12px_rgba(0,0,0,0.02)] border border-slate-100/60 flex items-center gap-3">
          <div className="bg-emerald-50 p-3 rounded-2xl text-emerald-600">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Con Compras</p>
            <p className="text-xl font-black text-slate-900">{activeCustomersCount}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-3xl shadow-[0_2px_12px_rgba(0,0,0,0.02)] border border-slate-100/60 flex items-center gap-3">
          <div className="bg-violet-50 p-3 rounded-2xl text-violet-600">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Ventas a Clientes</p>
            <p className="text-xl font-black text-slate-900">{formatCurrency(totalSalesToCustomers)}</p>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          id="search-customers-input"
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar por nombre, correo o teléfono..."
          className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200/80 rounded-2xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-400 shadow-[0_2px_12px_rgba(0,0,0,0.02)]"
        />
      </div>

      {/* Customers List */}
      {isLoading ? (
        <div className="text-center py-16">
          <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-xs font-semibold text-slate-500">Cargando clientes...</p>
        </div>
      ) : filteredCustomers.length === 0 ? (
        <div className="bg-white rounded-3xl p-10 text-center border border-slate-100/80 shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
          <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="font-bold text-slate-800 text-sm">
            {searchQuery ? 'No se encontraron clientes' : 'No tienes clientes registrados'}
          </h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            {searchQuery
              ? 'Prueba con otro término de búsqueda o limpia el filtro.'
              : 'Registra a tus clientes habituales para asociar sus compras y tener su historial.'}
          </p>
          {!searchQuery && (
            <button
              onClick={handleOpenCreateModal}
              className="mt-4 inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-indigo-700 transition-colors cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              Registrar Primer Cliente
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredCustomers.map(customer => {
            const stats = customerStatsMap.get(customer.id) || { totalSpent: 0, purchaseCount: 0 };
            const creditStats = customerCreditMap.get(customer.id);
            const isExpanded = expandedCustomerId === customer.id;

            return (
              <CustomerListItem
                key={customer.id}
                customer={customer}
                isExpanded={isExpanded}
                onToggleExpand={() => setExpandedCustomerId(isExpanded ? null : customer.id)}
                stats={stats}
                creditStats={creditStats}
                onEdit={handleOpenEditModal}
                onDelete={handleDelete}
                onOpenHistory={(c) => setHistoryModalCustomer(c)}
                onExportPDF={handleExportPDF}
                isExportingPDF={isExportingPDF}
                onNavigateToNewSale={(custId) => navigate(`/sales?customerId=${custId}`)}
              />
            );
          })}
        </div>
      )}

      {/* Customer Form Modal */}
      <CustomerFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        editingCustomer={editingCustomer}
        onSave={handleSaveCustomer}
      />

      {/* Customer Purchases History & Installments Modal */}
      <CustomerHistoryModal
        customer={historyModalCustomer}
        sales={sales}
        onClose={() => setHistoryModalCustomer(null)}
        onNavigateToNewSale={(custId) => navigate(`/sales?customerId=${custId}`)}
        onExportPDF={handleExportPDF}
        isExportingPDF={isExportingPDF}
        onSendSaleReminder={handleSendSaleReminder}
      />

      {/* Toast Notification */}
      {toastNotification && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 text-xs font-bold animate-in fade-in slide-in-from-bottom-4 duration-200 border border-slate-700/60 backdrop-blur-sm">
          <span>{toastNotification}</span>
        </div>
      )}
    </div>
  );
}
