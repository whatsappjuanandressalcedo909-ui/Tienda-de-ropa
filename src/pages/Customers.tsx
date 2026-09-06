import React, { useState, useMemo } from 'react';
import { 
  Users, UserPlus, Search, Mail, Phone, ShoppingBag, 
  Edit2, Trash2, Calendar, MessageSquare, Receipt, X, Plus, 
  UserCheck, ArrowUpRight, DollarSign, Clock, CheckCircle2, ChevronRight, ChevronDown,
  FileText, Share2, Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useInventory } from '../context/InventoryContext';
import { Customer, Sale } from '../types';
import { formatCurrency, getInstallmentSummary, getWhatsAppReminderUrl } from '../utils';
import { useNavigate } from 'react-router-dom';
import { InstallmentReceipt } from '../components/InstallmentReceipt';
import { downloadOrShareCustomerPDF } from '../utils/pdfGenerator';

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

export function Customers() {
  const { customers, saveCustomer, deleteCustomer, sales, isLoading } = useInventory();
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [historyModalCustomer, setHistoryModalCustomer] = useState<Customer | null>(null);
  const [selectedSaleIdForReceipt, setSelectedSaleIdForReceipt] = useState<string | null>(null);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [toastNotification, setToastNotification] = useState<string | null>(null);
  const [expandedCustomerId, setExpandedCustomerId] = useState<string | null>(null);
  const [showHistoryCards, setShowHistoryCards] = useState(false);

  React.useEffect(() => {
    if (historyModalCustomer) {
      setShowHistoryCards(false);
    }
  }, [historyModalCustomer]);

  // Form State
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

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
    setFirstName('');
    setLastName('');
    setEmail('');
    setPhone('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (c: Customer) => {
    setEditingCustomer(c);
    setFirstName(c.firstName);
    setLastName(c.lastName);
    setEmail(c.email);
    setPhone(c.phone || '');
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim() || !email.trim()) {
      alert('Por favor completa los campos obligatorios: Nombre, Apellido y Correo.');
      return;
    }

    saveCustomer({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim() || undefined
    }, editingCustomer?.id);

    setIsModalOpen(false);
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

  // Get customer sales history
  const customerSalesHistory: Sale[] = useMemo(() => {
    if (!historyModalCustomer) return [];
    return sales.filter(s => s.customerId === historyModalCustomer.id);
  }, [sales, historyModalCustomer]);

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

      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Buscar por nombre, apellido, correo o teléfono..."
          className="w-full pl-11 pr-11 py-3.5 min-h-[48px] bg-white border border-slate-200/80 rounded-2xl text-base sm:text-sm text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all shadow-sm"
        />
        {searchQuery && (
          <button 
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 min-w-[36px] min-h-[36px] flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-full cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Customers List */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="space-y-3">
             {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="bg-white rounded-3xl p-4 sm:p-5 flex items-center justify-between shadow-[0_2px_12px_rgba(0,0,0,0.02)] border border-slate-100 animate-pulse">
                   <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-slate-100 shrink-0"></div>
                      <div className="space-y-2">
                         <div className="h-4 bg-slate-100 rounded-full w-32"></div>
                         <div className="h-3 bg-slate-100 rounded-full w-24"></div>
                      </div>
                   </div>
                   <div className="w-8 h-8 rounded-xl bg-slate-100"></div>
                </div>
             ))}
          </div>
        ) : filteredCustomers.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-12 bg-white rounded-3xl border border-slate-100 border-dashed"
          >
            <Users className="mx-auto h-10 w-10 text-slate-300 mb-3" />
            <h3 className="text-base font-semibold text-slate-900">
              {searchQuery ? 'No se encontraron clientes' : 'Aún no tienes clientes registrados'}
            </h3>
            <p className="text-xs text-slate-500 max-w-xs mx-auto mt-1 mb-4">
              {searchQuery 
                ? 'Prueba con otro término de búsqueda o limpia el filtro.' 
                : 'Crea tu primer cliente para asignarle ventas y dar seguimiento a sus compras.'}
            </p>
            {!searchQuery && (
              <button
                onClick={handleOpenCreateModal}
                className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-full text-xs font-semibold hover:bg-indigo-700 transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Registrar Cliente
              </button>
            )}
          </motion.div>
        ) : (
          <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-3">
            {filteredCustomers.map(customer => {
              const stats = customerStatsMap.get(customer.id) || { totalSpent: 0, purchaseCount: 0 };
              const initials = `${customer.firstName.charAt(0)}${customer.lastName.charAt(0)}`.toUpperCase();

              return (
                <motion.div 
                  key={customer.id} 
                  variants={itemVariants}
                  layoutId={`customer-${customer.id}`}
                  className="bg-white rounded-3xl shadow-[0_2px_12px_rgba(0,0,0,0.02)] border border-slate-100/70 hover:border-slate-200 transition-all overflow-hidden"
                >
                  {/* Header/Summary (Always visible) */}
                  <div 
                    onClick={() => setExpandedCustomerId(expandedCustomerId === customer.id ? null : customer.id)}
                    className="p-4 sm:p-5 flex items-center justify-between cursor-pointer active:bg-slate-50 transition-colors select-none"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white font-bold flex items-center justify-center text-sm shadow-sm shrink-0">
                        {initials}
                      </div>
                      <div className="flex flex-col">
                        <h3 className="font-bold text-base text-slate-900 leading-tight">
                          {customer.firstName} {customer.lastName}
                        </h3>
                        {expandedCustomerId !== customer.id && (
                          <div className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                            {customer.phone || customer.email || 'Sin datos de contacto'}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                       {/* Debts indicator when collapsed */}
                       {expandedCustomerId !== customer.id && (() => {
                          const creditStats = customerCreditMap.get(customer.id);
                          if (creditStats && creditStats.totalPendingDebt > 0) {
                            return <div className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-sm" title="Tiene deuda pendiente" />;
                          }
                          return null;
                       })()}
                       <div className={`p-1.5 sm:p-2 rounded-xl text-slate-400 transition-transform duration-300 ${expandedCustomerId === customer.id ? 'rotate-90 bg-slate-100' : 'bg-slate-50'}`}>
                         <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
                       </div>
                    </div>
                  </div>

                  {/* Expanded Content */}
                  <AnimatePresence>
                    {expandedCustomerId === customer.id && (
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
                                onClick={(e) => { e.stopPropagation(); handleOpenEditModal(customer); }}
                                className="min-w-[36px] min-h-[36px] flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 active:bg-indigo-100 rounded-xl transition-colors cursor-pointer"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                title="Eliminar cliente"
                                onClick={(e) => { e.stopPropagation(); handleDelete(customer); }}
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
                          {(() => {
                            const creditStats = customerCreditMap.get(customer.id);
                            if (creditStats && creditStats.totalPendingDebt > 0) {
                              return (
                                <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-amber-50/90 border border-amber-200/80 text-xs text-amber-900">
                                  <div className="flex items-center gap-1.5 font-bold">
                                    <Clock className="w-3.5 h-3.5 text-amber-600" />
                                    <span>Saldo por pagar: {formatCurrency(creditStats.totalPendingDebt)}</span>
                                  </div>
                                  <span className="text-[11px] font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                                    {creditStats.pendingCount} cuota{creditStats.pendingCount > 1 ? 's' : ''} pendiente{creditStats.pendingCount > 1 ? 's' : ''}
                                  </span>
                                </div>
                              );
                            }
                            return null;
                          })()}

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
                                  setHistoryModalCustomer(customer);
                                  setSelectedSaleIdForReceipt(null);
                                }}
                                className="min-h-[44px] inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 transition-all cursor-pointer active:scale-95 select-none"
                              >
                                <Receipt className="w-4 h-4 text-slate-500" />
                                Ver Compras ({stats.purchaseCount})
                              </button>

                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); handleExportPDF(customer); }}
                                disabled={isExportingPDF}
                                className="min-h-[44px] inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 active:bg-indigo-200 border border-indigo-200 transition-all cursor-pointer disabled:opacity-50 active:scale-95 select-none"
                                title="Exportar y compartir resumen de ventas y cuotas en PDF"
                              >
                                <FileText className="w-4 h-4 text-indigo-600" />
                                PDF
                              </button>
                            </div>

                            <button
                              onClick={(e) => { e.stopPropagation(); navigate(`/sales?customerId=${customer.id}`); }}
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
                </motion.div>
              );
          })}
        </motion.div>
      )}
    </div>

      {/* Customer Form Modal (Create / Edit) */}
      {isModalOpen && (
        <div 
          id="modal-customer-form"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200"
        >
          <div className="bg-white rounded-t-[2rem] sm:rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in slide-in-from-bottom-8 sm:slide-in-from-bottom-4 duration-300 border border-slate-100">
            <div className="w-full flex justify-center pt-3 pb-1 sm:hidden">
              <div className="w-12 h-1.5 bg-slate-200 rounded-full"></div>
            </div>

            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Users className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">
                  {editingCustomer ? 'Editar Cliente' : 'Nuevo Cliente'}
                </h3>
              </div>
              <button 
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                    Nombre <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={e => setFirstName(e.target.value)}
                    placeholder="Ej: Laura"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                    Apellido <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={lastName}
                    onChange={e => setLastName(e.target.value)}
                    placeholder="Ej: Pérez"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                  Correo Electrónico <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="ejemplo@correo.com"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span>Teléfono / WhatsApp</span>
                  <span className="text-[10px] text-indigo-500 lowercase">Recomendado</span>
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="+57 300 123 4567"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all text-sm"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Permite enviar automáticamente el resumen de compra a su WhatsApp.
                </p>
              </div>

              <div className="pt-3 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl transition-colors shadow-lg shadow-indigo-600/20 cursor-pointer"
                >
                  {editingCustomer ? 'Guardar Cambios' : 'Crear Cliente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Customer Purchases History & Installments Modal */}
      {historyModalCustomer && (
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
                    {historyModalCustomer.firstName} {historyModalCustomer.lastName}
                    {historyModalCustomer.phone ? ` • ${historyModalCustomer.phone}` : ''}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button 
                  type="button"
                  onClick={() => handleExportPDF(historyModalCustomer)}
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
                    setHistoryModalCustomer(null);
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
                            onClick={() => handleExportPDF(historyModalCustomer)}
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
                          const custId = historyModalCustomer.id;
                          setHistoryModalCustomer(null);
                          setSelectedSaleIdForReceipt(null);
                          navigate(`/sales?customerId=${custId}`);
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
                                      handleSendSaleReminder(sale);
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
                  setHistoryModalCustomer(null);
                  setSelectedSaleIdForReceipt(null);
                }}
                className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={() => {
                  const custId = historyModalCustomer.id;
                  setHistoryModalCustomer(null);
                  setSelectedSaleIdForReceipt(null);
                  navigate(`/sales?customerId=${custId}`);
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                Nueva Venta
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastNotification && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 text-xs font-bold animate-in fade-in slide-in-from-bottom-4 duration-200 border border-slate-700/60 backdrop-blur-sm">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastNotification}</span>
        </div>
      )}
    </div>
  );
}
