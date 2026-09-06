import React, { useState, useMemo, useEffect } from 'react';
import { 
  ShoppingBag, Plus, X, Receipt, Trash2, Filter, AlertCircle, 
  ShoppingCart, AlertTriangle, User, UserPlus, Search, Phone, Mail, MessageSquare 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useInventory } from '../context/InventoryContext';
import { formatCurrency, getInstallmentSummary, getWhatsAppReminderUrl } from '../utils';
import { Sale, Customer } from '../types';
import { useSearchParams } from 'react-router-dom';
import { InstallmentReceipt } from '../components/InstallmentReceipt';

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
  
  // Cart & Customer State
  const [cart, setCart] = useState<{ productId: string; quantity: number }[]>([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'total' | 'credit'>('total');
  const [installments, setInstallments] = useState('1');
  const [customerPhone, setCustomerPhone] = useState('');

  // Quick Customer Creation within modal
  const [isQuickCustomerOpen, setIsQuickCustomerOpen] = useState(false);
  const [quickFirstName, setQuickFirstName] = useState('');
  const [quickLastName, setQuickLastName] = useState('');
  const [quickEmail, setQuickEmail] = useState('');
  const [quickPhone, setQuickPhone] = useState('');

  const availableProducts = inventory.filter(p => p.stock > 0);

  // Auto-open modal with customer pre-selected if navigated from Customers page
  useEffect(() => {
    const custId = searchParams.get('customerId');
    if (custId) {
      setSelectedCustomerId(custId);
      const targetCustomer = customers.find(c => c.id === custId);
      if (targetCustomer?.phone) {
        setCustomerPhone(targetCustomer.phone);
      }
      setIsModalOpen(true);
    }
  }, [searchParams, customers]);

  // Handle customer selection change
  const handleCustomerChange = (customerId: string) => {
    setSelectedCustomerId(customerId);
    const target = customers.find(c => c.id === customerId);
    if (target?.phone) {
      setCustomerPhone(target.phone);
    }
  };

  // Quick Customer Registration
  const handleQuickCustomerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickFirstName.trim() || !quickLastName.trim() || !quickEmail.trim()) {
      alert('Por favor completa Nombre, Apellido y Correo para registrar el cliente.');
      return;
    }

    const newCust = saveCustomer({
      firstName: quickFirstName.trim(),
      lastName: quickLastName.trim(),
      email: quickEmail.trim().toLowerCase(),
      phone: quickPhone.trim() || undefined
    });

    setSelectedCustomerId(newCust.id);
    if (newCust.phone) {
      setCustomerPhone(newCust.phone);
    }

    setIsQuickCustomerOpen(false);
    setQuickFirstName('');
    setQuickLastName('');
    setQuickEmail('');
    setQuickPhone('');
  };

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
      customerName: sale.customerName,
      installmentAmount: nextPending.amount,
      installmentRemaining: nextPending.amount - (nextPending.paidAmount || 0),
      totalPendingDebt: summary.totalPending,
      dueDateStr: nextPending.dueDate,
    });

    window.open(url, '_blank');
  };

  const handleAddToCart = () => {
    const qty = parseInt(quantity, 10);
    if (!selectedProductId || qty < 1) return;

    const product = inventory.find(p => p.id === selectedProductId);
    if (!product) return;

    // Check if adding this exceeds stock
    const existingCartItem = cart.find(item => item.productId === selectedProductId);
    const totalRequested = (existingCartItem?.quantity || 0) + qty;

    if (totalRequested > product.stock) {
      alert(`No hay suficiente stock. Stock actual: ${product.stock}`);
      return;
    }

    if (existingCartItem) {
      setCart(cart.map(item => 
        item.productId === selectedProductId ? { ...item, quantity: totalRequested } : item
      ));
    } else {
      setCart([...cart, { productId: selectedProductId, quantity: qty }]);
    }
    
    setSelectedProductId('');
    setQuantity('1');
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter(item => item.productId !== productId));
  };

  const cartTotal = cart.reduce((acc, item) => {
    const product = inventory.find(p => p.id === item.productId);
    return acc + (product ? product.price * item.quantity : 0);
  }, 0);

  const selectedCustomerObj = useMemo(() => {
    return customers.find(c => c.id === selectedCustomerId);
  }, [customers, selectedCustomerId]);

  const handleSubmitSale = () => {
    if (cart.length === 0) return;

    const inst = paymentMethod === 'credit' ? parseInt(installments, 10) : undefined;
    
    const customerInfo = selectedCustomerObj ? {
      id: selectedCustomerObj.id,
      name: `${selectedCustomerObj.firstName} ${selectedCustomerObj.lastName}`,
      email: selectedCustomerObj.email,
      phone: customerPhone || selectedCustomerObj.phone
    } : (customerPhone ? { phone: customerPhone } : undefined);

    const success = addSale(cart, paymentMethod, inst, customerInfo);
    
    if (success) {
      const phoneToSend = customerPhone || selectedCustomerObj?.phone;
      if (phoneToSend) {
        const cleanPhone = phoneToSend.replace(/\D/g, '');
        const clientGreeting = selectedCustomerObj 
          ? `¡Hola *${selectedCustomerObj.firstName}*!`
          : `¡Hola!`;

        let text = `🛒 *${clientGreeting} Aquí tienes el resumen de tu compra!*\n\n`;
        text += `*Productos:*\n`;
        cart.forEach(item => {
          const product = inventory.find(p => p.id === item.productId);
          if (product) {
            text += `- ${item.quantity}x ${product.name} (${formatCurrency(product.price * item.quantity)})\n`;
          }
        });
        text += `\n*Total a pagar: ${formatCurrency(cartTotal)}*\n`;
        
        if (paymentMethod === 'credit') {
          text += `Forma de pago: Crédito a ${inst} meses\n`;
          text += `Cuota mensual aprox: ${formatCurrency(cartTotal / (inst || 1))}\n`;
        } else {
          text += `Forma de pago: Contado\n`;
        }
        text += `\n¡Gracias por tu compra!`;
        
        const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
        window.open(url, '_blank');
      }

      setIsModalOpen(false);
      setCart([]);
      setSelectedCustomerId('');
      setPaymentMethod('total');
      setInstallments('1');
      setCustomerPhone('');
    } else {
      alert('Error: stock insuficiente en uno o más productos.');
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setCart([]);
    setSelectedCustomerId('');
    setPaymentMethod('total');
    setInstallments('1');
    setCustomerPhone('');
    setIsQuickCustomerOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">Ventas</h2>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.95 }}
          id="btn-new-sale"
          onClick={() => setIsModalOpen(true)}
          className="min-h-[44px] flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all shadow-sm cursor-pointer select-none"
        >
          <ShoppingCart className="w-4 h-4" />
          Nueva Venta
        </motion.button>
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
              onChange={e => setSaleSearchQuery(e.target.value)}
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
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-12 bg-white rounded-3xl border border-slate-100 border-dashed"
          >
            <Receipt className="mx-auto h-10 w-10 text-slate-300 mb-3" />
            <h3 className="text-base font-semibold text-slate-900">No hay ventas registradas</h3>
            <p className="mt-1 text-xs text-slate-500">
              {customerFilter !== 'all' 
                ? 'Este cliente no tiene ventas para el filtro seleccionado.' 
                : 'No se encontraron ventas para este periodo.'}
            </p>
          </motion.div>
        ) : (
          <div className="space-y-4 animate-in fade-in duration-200">
            {filteredSales.map(sale => (
              <div 
                key={sale.id} 
                className={`bg-white p-5 rounded-3xl shadow-[0_2px_12px_rgba(0,0,0,0.02)] border transition-all ${sale.status === 'cancelled' ? 'border-red-100/60 opacity-75' : 'border-slate-100/60'}`}
              >
                <div className="flex items-start justify-between mb-3 border-b border-slate-50 pb-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-bold text-slate-800">
                      Factura #{sale.id.slice(0,6).toUpperCase()}
                    </p>
                    {sale.status === 'cancelled' ? (
                      <span className="bg-red-50 text-red-600 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider">
                        Anulada
                      </span>
                    ) : (
                      <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider">
                        Completada
                      </span>
                    )}
                    {sale.paymentMethod && (
                      <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[10px] uppercase font-bold">
                        {sale.paymentMethod === 'credit' ? `Crédito (${sale.installments} meses)` : 'Contado'}
                      </span>
                    )}
                  </div>

                  {/* Customer Info Badge */}
                  {sale.customerName ? (
                    <div className="flex items-center gap-1.5 mt-1 text-xs text-indigo-600 font-semibold">
                      <User className="w-3.5 h-3.5" />
                      <span>Cliente: <strong>{sale.customerName}</strong></span>
                      {sale.customerEmail && (
                        <span className="text-slate-400 font-normal">({sale.customerEmail})</span>
                      )}
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-400 mt-1">Cliente Ocasional</p>
                  )}

                  <p className="text-xs font-medium text-slate-500 mt-1 flex items-center gap-2">
                    <span>{new Date(sale.date).toLocaleString()}</span>
                    {sale.customerPhone && (
                      <span className="text-emerald-600 font-bold flex items-center gap-1">
                        <Phone className="w-3 h-3" /> {sale.customerPhone}
                      </span>
                    )}
                  </p>
                </div>

                <div className="text-right">
                  <p className={`font-black text-lg ${sale.status === 'cancelled' ? 'text-slate-400 line-through' : 'text-indigo-600'}`}>
                    {formatCurrency(sale.total)}
                  </p>
                </div>
              </div>
              
              <div className="space-y-1.5 mb-4">
                {sale.items?.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-xs text-slate-600">
                    <span>{item.quantity}x {item.productName}</span>
                    <span className="text-slate-900 font-medium">{formatCurrency(item.subtotal)}</span>
                  </div>
                ))}
                {!sale.items && (
                  <div className="flex justify-between text-xs text-slate-600">
                    <span>{(sale as any).quantity}x {(sale as any).productName}</span>
                    <span className="text-slate-900 font-medium">{formatCurrency(sale.total)}</span>
                  </div>
                )}
              </div>

              {sale.status === 'completed' && (() => {
                const summ = getInstallmentSummary(sale);
                return (
                  <div className="flex flex-wrap items-center justify-between pt-2.5 border-t border-slate-50 gap-2">
                    <div className="text-[11px] text-slate-500 font-medium">
                      {sale.paymentMethod === 'credit' ? (
                        summ.isFullyPaid ? (
                          <span className="text-emerald-700 font-bold">✓ {summ.totalCount}/{summ.totalCount} cuotas pagadas</span>
                        ) : (
                          <span className="text-amber-800 font-bold">{summ.paidCount}/{summ.totalCount} pagadas (Por pagar: {formatCurrency(summ.totalPending)})</span>
                        )
                      ) : (
                        <span className="text-emerald-700 font-bold">✓ Pagado al contado</span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 ml-auto flex-wrap w-full sm:w-auto pt-1 sm:pt-0">
                      {sale.paymentMethod === 'credit' && !summ.isFullyPaid && (
                        <button 
                          type="button"
                          onClick={() => handleSendSaleReminder(sale)}
                          className="min-h-[44px] flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-200 px-3.5 py-2.5 rounded-2xl transition-all cursor-pointer border border-emerald-300 shadow-2xs active:scale-95 select-none"
                          title="Enviar recordatorio de pago por WhatsApp"
                        >
                          <MessageSquare className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>Recordar Pago</span>
                        </button>
                      )}

                      <button 
                        type="button"
                        onClick={() => setSaleForReceipt(sale)}
                        className="min-h-[44px] flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 text-xs font-bold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 active:bg-indigo-200 px-3.5 py-2.5 rounded-2xl transition-all cursor-pointer border border-indigo-200 active:scale-95 select-none"
                      >
                        <Receipt className="w-4 h-4 text-indigo-600 shrink-0" />
                        <span>Ver Tirilla</span>
                      </button>

                      <button 
                        id={`btn-cancel-sale-${sale.id}`}
                        onClick={() => setSaleToCancel(sale)}
                        className="min-h-[44px] text-xs font-bold text-red-500 hover:text-red-700 hover:bg-red-50 active:bg-red-100 px-3 py-2 rounded-2xl transition-all cursor-pointer select-none"
                      >
                        Anular Venta
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>
          ))}
          
          {hasMoreSales && filteredSales.length > 0 && (
            <div className="pt-4 flex justify-center">
              <button
                onClick={loadMoreSales}
                className="px-6 py-2.5 bg-white border border-slate-200 text-slate-700 text-xs font-bold rounded-xl shadow-sm hover:bg-slate-50 active:scale-95 transition-all"
              >
                Cargar más ventas históricas
              </button>
            </div>
          )}
        </div>
      )}
    </div>

      {/* Cart & Customer Sale Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-t-[2rem] sm:rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[95vh] animate-in slide-in-from-bottom-8 sm:slide-in-from-bottom-4 duration-300">
            <div className="w-full flex justify-center pt-3 pb-1 sm:hidden">
              <div className="w-12 h-1.5 bg-slate-200 rounded-full"></div>
            </div>

            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <div className="flex items-center gap-3">
                <div className="bg-indigo-50 p-2 rounded-xl text-indigo-600">
                  <ShoppingCart className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-800 tracking-tight">Nueva Venta</h2>
                  <p className="text-xs text-slate-400">Selecciona el cliente y los productos</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={handleCloseModal}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              {/* Customer Selector Section */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-indigo-600" />
                    Cliente Asignado
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsQuickCustomerOpen(!isQuickCustomerOpen)}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    {isQuickCustomerOpen ? 'Ocultar formulario' : '+ Nuevo Cliente'}
                  </button>
                </div>

                {/* Quick New Customer Inline Form */}
                {isQuickCustomerOpen && (
                  <form onSubmit={handleQuickCustomerSubmit} className="bg-white p-3.5 rounded-xl border border-indigo-100 space-y-3 shadow-sm animate-in fade-in duration-200">
                    <p className="text-xs font-bold text-indigo-900 flex items-center gap-1">
                      <UserPlus className="w-3.5 h-3.5 text-indigo-600" />
                      Registrar Cliente Rápido
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="Nombre *"
                        value={quickFirstName}
                        onChange={e => setQuickFirstName(e.target.value)}
                        className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                        required
                      />
                      <input
                        type="text"
                        placeholder="Apellido *"
                        value={quickLastName}
                        onChange={e => setQuickLastName(e.target.value)}
                        className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                        required
                      />
                    </div>
                    <input
                      type="email"
                      placeholder="Correo Electrónico *"
                      value={quickEmail}
                      onChange={e => setQuickEmail(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                      required
                    />
                    <input
                      type="tel"
                      placeholder="Teléfono / WhatsApp (ej: +57 300 123 4567)"
                      value={quickPhone}
                      onChange={e => setQuickPhone(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setIsQuickCustomerOpen(false)}
                        className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-sm"
                      >
                        Guardar y Seleccionar
                      </button>
                    </div>
                  </form>
                )}

                {/* Customer Dropdown */}
                <select
                  id="select-sale-customer"
                  value={selectedCustomerId}
                  onChange={e => handleCustomerChange(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs font-medium"
                >
                  <option value="">-- Seleccionar cliente existente o dejar en blanco --</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.firstName} {c.lastName} ({c.email})
                    </option>
                  ))}
                </select>

                {selectedCustomerObj && (
                  <div className="bg-indigo-50/80 border border-indigo-100/80 rounded-xl p-3 text-xs flex items-center justify-between">
                    <div>
                      <p className="font-bold text-indigo-950">
                        {selectedCustomerObj.firstName} {selectedCustomerObj.lastName}
                      </p>
                      <p className="text-indigo-700/80 text-[11px]">{selectedCustomerObj.email}</p>
                    </div>
                    {selectedCustomerObj.phone && (
                      <span className="bg-emerald-100 text-emerald-800 text-[11px] font-bold px-2 py-0.5 rounded-full">
                        WA: {selectedCustomerObj.phone}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Add Product to Cart */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Añadir Producto</label>
                    <select
                      value={selectedProductId}
                      onChange={e => setSelectedProductId(e.target.value)}
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-xs"
                    >
                      <option value="" disabled>Selecciona un producto...</option>
                      {availableProducts.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name} - {formatCurrency(p.price)} (Stock: {p.stock})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="w-20">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Cant.</label>
                    <input
                      type="number"
                      min="1"
                      value={quantity}
                      onChange={e => setQuantity(e.target.value)}
                      className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-xs"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAddToCart}
                    disabled={!selectedProductId || parseInt(quantity, 10) < 1}
                    className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white p-2.5 rounded-xl transition-colors mb-[1px] cursor-pointer"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Cart Items */}
              <div>
                <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center justify-between">
                  Resumen de Compra
                  <span className="bg-slate-100 text-slate-600 py-0.5 px-2 rounded-full text-xs">{cart.length} items</span>
                </h3>
                
                {cart.length === 0 ? (
                  <div className="text-center py-8 border-2 border-dashed border-slate-100 rounded-2xl">
                    <AlertCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-xs text-slate-500 font-medium">El carrito está vacío</p>
                  </div>
                ) : (
                  <div className="space-y-2 mb-6">
                    {cart.map(item => {
                      const product = inventory.find(p => p.id === item.productId);
                      if (!product) return null;
                      
                      return (
                        <div key={item.productId} className="flex items-center justify-between bg-white border border-slate-100 p-3 rounded-2xl shadow-sm">
                          <div className="flex-1">
                            <p className="font-bold text-sm text-slate-800">{product.name}</p>
                            <p className="text-xs font-medium text-slate-500">
                              {item.quantity}x {formatCurrency(product.price)}
                            </p>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="font-bold text-indigo-600 text-sm">
                              {formatCurrency(product.price * item.quantity)}
                            </span>
                            <button
                              onClick={() => removeFromCart(item.productId)}
                              className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Payment method & WhatsApp */}
                {cart.length > 0 && (
                  <div className="space-y-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Forma de Pago</label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setPaymentMethod('total')}
                          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all border cursor-pointer ${paymentMethod === 'total' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200'}`}
                        >
                          Total (Contado)
                        </button>
                        <button
                          type="button"
                          onClick={() => setPaymentMethod('credit')}
                          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all border cursor-pointer ${paymentMethod === 'credit' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200'}`}
                        >
                          Crédito
                        </button>
                      </div>
                    </div>

                    {paymentMethod === 'credit' && (
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Meses (Cuotas)</label>
                        <input
                          type="number"
                          min="1"
                          value={installments}
                          onChange={e => setInstallments(e.target.value)}
                          className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-sm"
                          placeholder="Ej: 3"
                        />
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                        WhatsApp para Comprobante
                      </label>
                      <input
                        type="tel"
                        value={customerPhone}
                        onChange={e => setCustomerPhone(e.target.value)}
                        className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-xs"
                        placeholder="+57 300 123 4567"
                      />
                      <p className="text-[10px] text-slate-400 mt-1">
                        Se abrirá WhatsApp con el resumen de la compra dirigido a este contacto
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer with Total and Submit */}
            <div className="p-6 border-t border-slate-100 bg-slate-50/50">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Total a Cobrar</span>
                <span className="text-2xl font-black text-slate-900">{formatCurrency(cartTotal)}</span>
              </div>
              <button
                id="btn-submit-sale"
                onClick={handleSubmitSale}
                disabled={cart.length === 0}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 text-white font-bold py-3.5 px-4 rounded-xl transition-colors shadow-lg shadow-indigo-600/20 cursor-pointer"
              >
                Completar Venta
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Sale Confirmation Modal */}
      {saleToCancel && (
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
              Estás a punto de anular la <strong className="text-slate-700">Factura #{saleToCancel.id.slice(0, 6).toUpperCase()}</strong> por un valor de <strong className="text-indigo-600">{formatCurrency(saleToCancel.total)}</strong>.
            </p>

            <div className="bg-amber-50 border border-amber-200/60 rounded-2xl p-3 mb-5 text-[11px] text-amber-800 font-medium">
              Al confirmar, los productos se devolverán automáticamente al stock del inventario.
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                id="btn-confirm-cancel-no"
                type="button"
                onClick={() => setSaleToCancel(null)}
                className="w-full py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-xl transition-colors cursor-pointer"
              >
                No, volver
              </button>

              <button
                id="btn-confirm-cancel-si"
                type="button"
                onClick={() => {
                  cancelSale(saleToCancel.id);
                  setSaleToCancel(null);
                }}
                className="w-full py-3 px-4 bg-red-600 hover:bg-red-700 text-white font-bold text-sm rounded-xl transition-colors shadow-lg shadow-red-600/20 cursor-pointer"
              >
                Sí, anular
              </button>
            </div>
          </div>
        </div>
      )}

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
