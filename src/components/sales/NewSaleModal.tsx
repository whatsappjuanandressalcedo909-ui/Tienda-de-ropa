import React, { useState, useEffect, useMemo } from 'react';
import { Product, Customer } from '../../types';
import { formatCurrency } from '../../utils';
import { 
  ShoppingCart, 
  X, 
  User, 
  UserPlus, 
  Plus, 
  AlertCircle, 
  Trash2 
} from 'lucide-react';

interface NewSaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  inventory: Product[];
  customers: Customer[];
  initialCustomerId?: string;
  onSaveCustomer: (customerData: { firstName: string; lastName: string; email: string; phone?: string }) => Customer;
  onCompleteSale: (
    cart: { productId: string; quantity: number }[],
    paymentMethod: 'total' | 'credit',
    installments?: number,
    customerInfo?: { id?: string; name?: string; email?: string; phone?: string }
  ) => boolean;
}

export function NewSaleModal({
  isOpen,
  onClose,
  inventory,
  customers,
  initialCustomerId,
  onSaveCustomer,
  onCompleteSale,
}: NewSaleModalProps) {
  const [cart, setCart] = useState<{ productId: string; quantity: number }[]>([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'total' | 'credit'>('total');
  const [installments, setInstallments] = useState('1');
  const [customerPhone, setCustomerPhone] = useState('');

  // Quick Customer inline form
  const [isQuickCustomerOpen, setIsQuickCustomerOpen] = useState(false);
  const [quickFirstName, setQuickFirstName] = useState('');
  const [quickLastName, setQuickLastName] = useState('');
  const [quickEmail, setQuickEmail] = useState('');
  const [quickPhone, setQuickPhone] = useState('');

  const availableProducts = useMemo(() => inventory.filter(p => p.stock > 0), [inventory]);

  // Preselect customer if passed
  useEffect(() => {
    if (initialCustomerId) {
      setSelectedCustomerId(initialCustomerId);
      const targetCustomer = customers.find(c => c.id === initialCustomerId);
      if (targetCustomer?.phone) {
        setCustomerPhone(targetCustomer.phone);
      }
    }
  }, [initialCustomerId, customers]);

  if (!isOpen) return null;

  const handleCustomerChange = (customerId: string) => {
    setSelectedCustomerId(customerId);
    const target = customers.find(c => c.id === customerId);
    if (target?.phone) {
      setCustomerPhone(target.phone);
    }
  };

  const handleQuickCustomerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickFirstName.trim() || !quickLastName.trim() || !quickEmail.trim()) {
      alert('Por favor completa Nombre, Apellido y Correo para registrar el cliente.');
      return;
    }

    const newCust = onSaveCustomer({
      firstName: quickFirstName.trim(),
      lastName: quickLastName.trim(),
      email: quickEmail.trim().toLowerCase(),
      phone: quickPhone.trim() || undefined,
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

  const handleAddToCart = () => {
    const qty = parseInt(quantity, 10);
    if (!selectedProductId || qty < 1) return;

    const product = inventory.find(p => p.id === selectedProductId);
    if (!product) return;

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

  const selectedCustomerObj = customers.find(c => c.id === selectedCustomerId);

  const resetForm = () => {
    setCart([]);
    setSelectedCustomerId('');
    setPaymentMethod('total');
    setInstallments('1');
    setCustomerPhone('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmitSale = () => {
    if (cart.length === 0) return;

    const inst = paymentMethod === 'credit' ? parseInt(installments, 10) : undefined;
    
    const customerInfo = selectedCustomerObj ? {
      id: selectedCustomerObj.id,
      name: `${selectedCustomerObj.firstName} ${selectedCustomerObj.lastName}`,
      email: selectedCustomerObj.email,
      phone: customerPhone || selectedCustomerObj.phone
    } : (customerPhone ? { phone: customerPhone } : undefined);

    const success = onCompleteSale(cart, paymentMethod, inst, customerInfo);
    
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

      resetForm();
      onClose();
    } else {
      alert('Error: stock insuficiente en uno o más productos.');
    }
  };

  return (
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
            onClick={handleClose}
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
  );
}
