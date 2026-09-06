import React, { createContext, useContext, useMemo, useState, useEffect } from 'react';
import { Product, Sale, Customer, Installment, SystemBackup } from '../types';
import { generateId } from '../utils';
import { generateSystemBackup } from '../utils/backup';
import { collection, doc, onSnapshot, setDoc, deleteDoc, updateDoc, writeBatch, query, orderBy, limit as firestoreLimit } from 'firebase/firestore';
import { db } from '../firebase';

interface CustomerInfoParam {
  id?: string;
  name?: string;
  email?: string;
  phone?: string;
}

interface InventoryContextType {
  inventory: Product[];
  saveProduct: (product: Omit<Product, 'id' | 'lastUpdated'>, id?: string) => void;
  deleteProduct: (id: string) => void;
  clearInventory: () => void;
  stats: {
    totalItems: number;
    totalValue: number;
    lowStockItems: number;
    outOfStockItems: number;
  };
  categories: string[];
  addCategory: (category: string) => void;
  removeCategory: (category: string) => void;
  categorySizes: Record<string, string[]>;
  addCategorySize: (category: string, size: string) => void;
  removeCategorySize: (category: string, size: string) => void;
  sizes: string[];
  addSize: (size: string) => void;
  removeSize: (size: string) => void;
  customers: Customer[];
  saveCustomer: (customer: Omit<Customer, 'id' | 'createdAt'>, id?: string) => Customer;
  deleteCustomer: (id: string) => void;
  sales: Sale[];
  hasMoreSales: boolean;
  loadMoreSales: () => void;
  addSale: (
    items: { productId: string; quantity: number }[],
    paymentMethod?: 'total' | 'credit',
    installments?: number,
    customerParam?: string | CustomerInfoParam
  ) => boolean;
  cancelSale: (saleId: string) => void;
  toggleInstallmentPayment: (saleId: string, installmentNumber: number) => void;
  recordInstallmentPayment: (saleId: string, installmentNumber: number, paymentAmount: number, note?: string) => void;
  resetInstallmentPayment: (saleId: string, installmentNumber: number) => void;
  getBackupData: () => SystemBackup;
  restoreBackupData: (data: {
    inventory?: Product[];
    customers?: Customer[];
    sales?: Sale[];
    categories?: string[];
    sizes?: string[];
  }, mode: 'overwrite' | 'merge') => void;
  isLoading: boolean;
}

const InventoryContext = createContext<InventoryContextType | undefined>(undefined);

const DEFAULT_CATEGORIES = ['Camisetas', 'Pantalones', 'Vestidos', 'Zapatos', 'Accesorios', 'Chaquetas'];
const DEFAULT_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'Única', 'N/A'];

export function InventoryProvider({ children }: { children: React.ReactNode }) {
  const [inventory, setInventory] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [categorySizes, setCategorySizes] = useState<Record<string, string[]>>({});
  const [sizes, setSizes] = useState<string[]>(DEFAULT_SIZES);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [salesLimit, setSalesLimit] = useState(100);
  const [hasMoreSales, setHasMoreSales] = useState(true);
  const [isProductsLoading, setIsProductsLoading] = useState(true);
  const [isCustomersLoading, setIsCustomersLoading] = useState(true);
  const [isSalesLoading, setIsSalesLoading] = useState(true);

  const isLoading = isProductsLoading || isCustomersLoading || isSalesLoading;

  // Firebase Realtime Listeners
  useEffect(() => {
    const unsubProducts = onSnapshot(collection(db, 'products'), (snapshot) => {
      const data: Product[] = [];
      snapshot.forEach(doc => data.push(doc.data() as Product));
      setInventory(data);
      setIsProductsLoading(false);
    }, (error) => {
      console.error("Error fetching products:", error);
      setIsProductsLoading(false);
    });

    const unsubCustomers = onSnapshot(collection(db, 'customers'), (snapshot) => {
      const data: Customer[] = [];
      snapshot.forEach(doc => {
        data.push(doc.data() as Customer);
      });
      data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setCustomers(data);
      setIsCustomersLoading(false);
    }, (error) => {
      console.error("Error fetching customers:", error);
      setIsCustomersLoading(false);
    });

    const unsubSettings = onSnapshot(doc(db, 'settings', 'global'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.categories) setCategories(data.categories);
        if (data.sizes) setSizes(data.sizes);
        if (data.categorySizes) setCategorySizes(data.categorySizes);
      } else {
        setDoc(doc(db, 'settings', 'global'), {
          categories: DEFAULT_CATEGORIES,
          sizes: DEFAULT_SIZES,
          categorySizes: {}
        }, { merge: true });
      }
    }, (error) => {
      console.error("Error fetching settings:", error);
    });

    return () => {
      unsubProducts();
      unsubCustomers();
      unsubSettings();
    };
  }, []);

  // Separate listener for Sales to handle pagination dependency
  useEffect(() => {
    const salesQuery = query(
      collection(db, 'sales'),
      orderBy('date', 'desc'),
      firestoreLimit(salesLimit)
    );

    const unsubSales = onSnapshot(salesQuery, (snapshot) => {
      const data: Sale[] = [];
      snapshot.forEach(doc => data.push(doc.data() as Sale));
      setSales(data);
      // If we got exactly the limit we requested, there might be more
      setHasMoreSales(snapshot.docs.length === salesLimit);
      setIsSalesLoading(false);
    }, (error) => {
      console.error("Error fetching sales:", error);
      setIsSalesLoading(false);
    });

    return () => unsubSales();
  }, [salesLimit]);

  const loadMoreSales = () => {
    setSalesLimit(prev => prev + 100);
  };

  const stats = useMemo(() => {
    const totalItems = inventory.reduce((acc, curr) => acc + curr.stock, 0);
    const totalValue = inventory.reduce((acc, curr) => acc + (curr.price * curr.stock), 0);
    const lowStockItems = inventory.filter(p => p.stock <= 5 && p.stock > 0).length;
    const outOfStockItems = inventory.filter(p => p.stock === 0).length;
    return { totalItems, totalValue, lowStockItems, outOfStockItems };
  }, [inventory]);

  const saveProduct = async (productData: Omit<Product, 'id' | 'lastUpdated'>, id?: string) => {
    const timestamp = new Date().toISOString();
    const finalId = id || generateId();
    const productRef = doc(db, 'products', finalId);
    
    const newProduct = {
      ...productData,
      id: finalId,
      lastUpdated: timestamp
    };
    const cleanProduct = JSON.parse(JSON.stringify(newProduct));

    await setDoc(productRef, cleanProduct, { merge: true });
  };

  const deleteProduct = async (id: string) => {
    await deleteDoc(doc(db, 'products', id));
  };

  const clearInventory = async () => {
    const batch = writeBatch(db);
    inventory.forEach(p => {
      batch.delete(doc(db, 'products', p.id));
    });
    await batch.commit();
  };

  const addCategory = async (category: string) => {
    if (!categories.includes(category)) {
      const newCats = [...categories, category];
      await updateDoc(doc(db, 'settings', 'global'), { categories: newCats });
    }
  };

  const removeCategory = async (category: string) => {
    const newCats = categories.filter(c => c !== category);
    await updateDoc(doc(db, 'settings', 'global'), { categories: newCats });
  };

  const addCategorySize = async (category: string, size: string) => {
    const currentSizes = categorySizes[category] || [];
    if (!currentSizes.includes(size)) {
      const newSizes = [...currentSizes, size];
      const newCategorySizes = { ...categorySizes, [category]: newSizes };
      await updateDoc(doc(db, 'settings', 'global'), { categorySizes: newCategorySizes });
    }
  };

  const removeCategorySize = async (category: string, size: string) => {
    const currentSizes = categorySizes[category] || [];
    const newSizes = currentSizes.filter(s => s !== size);
    const newCategorySizes = { ...categorySizes, [category]: newSizes };
    await updateDoc(doc(db, 'settings', 'global'), { categorySizes: newCategorySizes });
  };

  const addSize = async (size: string) => {
    if (!sizes.includes(size)) {
      const newSizes = [...sizes, size];
      await updateDoc(doc(db, 'settings', 'global'), { sizes: newSizes });
    }
  };

  const removeSize = async (size: string) => {
    const newSizes = sizes.filter(s => s !== size);
    await updateDoc(doc(db, 'settings', 'global'), { sizes: newSizes });
  };

  const saveCustomer = (customerData: Omit<Customer, 'id' | 'createdAt'>, id?: string): Customer => {
    const finalId = id || generateId();
    let finalCreatedAt = new Date().toISOString();
    
    if (id) {
      const existing = customers.find(c => c.id === id);
      if (existing) finalCreatedAt = existing.createdAt;
    }

    const newCust: Customer = {
      ...customerData,
      id: finalId,
      createdAt: finalCreatedAt
    };
    
    // Strip undefined
    const cleanCust = JSON.parse(JSON.stringify(newCust));

    // Fire and forget, local state handles optimistic if we wanted, but onSnapshot is fast.
    setDoc(doc(db, 'customers', finalId), cleanCust, { merge: true });
    return newCust;
  };

  const deleteCustomer = async (id: string) => {
    await deleteDoc(doc(db, 'customers', id));
  };

  const addSale = (
    cartItems: { productId: string; quantity: number }[],
    paymentMethod: 'total' | 'credit' = 'total',
    installments?: number,
    customerParam?: string | CustomerInfoParam
  ) => {
    // Validate stock locally
    for (const item of cartItems) {
      const product = inventory.find(p => p.id === item.productId);
      if (!product || product.stock < item.quantity) return false;
    }

    let total = 0;
    const saleItems = [];
    
    for (const item of cartItems) {
      const product = inventory.find(p => p.id === item.productId)!;
      const subtotal = product.price * item.quantity;
      total += subtotal;
      saleItems.push({
        productId: product.id,
        productName: product.name,
        quantity: item.quantity,
        price: product.price,
        subtotal
      });
    }

    const customerInfo = typeof customerParam === 'string'
      ? { phone: customerParam }
      : customerParam || {};

    let installmentList: Installment[] = [];
    if (paymentMethod === 'credit') {
      const numInstallments = Math.max(1, installments || 1);
      const perInstallment = Math.floor((total / numInstallments) * 100) / 100;
      let accumulated = 0;
      const baseDate = new Date();

      for (let i = 1; i <= numInstallments; i++) {
        const dueDate = new Date(baseDate);
        dueDate.setMonth(dueDate.getMonth() + (i - 1));
        const amount = i === numInstallments ? +(total - accumulated).toFixed(2) : perInstallment;
        accumulated += amount;

        installmentList.push({
          number: i,
          amount,
          dueDate: dueDate.toISOString(),
          status: 'pending'
        });
      }
    } else {
      installmentList = [{
        number: 1,
        amount: total,
        dueDate: new Date().toISOString(),
        status: 'paid',
        paidDate: new Date().toISOString(),
        paidAmount: total
      }];
    }

    const newSaleId = generateId();
    const rawSale: Sale = {
      id: newSaleId,
      items: saleItems,
      total,
      date: new Date().toISOString(),
      status: 'completed',
      paymentMethod,
      installments,
      installmentList,
      customerId: customerInfo.id,
      customerName: customerInfo.name,
      customerEmail: customerInfo.email,
      customerPhone: customerInfo.phone
    };
    
    // Strip undefined to prevent Firestore errors
    const newSale = JSON.parse(JSON.stringify(rawSale));

    // Firebase batch write to update inventory and create sale atomically
    const batch = writeBatch(db);
    batch.set(doc(db, 'sales', newSaleId), newSale);
    
    for (const item of cartItems) {
      const product = inventory.find(p => p.id === item.productId)!;
      batch.update(doc(db, 'products', product.id), {
        stock: product.stock - item.quantity
      });
    }
    batch.commit();

    return true;
  };

  const toggleInstallmentPayment = async (saleId: string, installmentNumber: number) => {
    const sale = sales.find(s => s.id === saleId);
    if (!sale) return;

    let currentList = sale.installmentList;
    if (!currentList || currentList.length === 0) {
      const count = Math.max(1, sale.installments || 1);
      const per = Math.floor((sale.total / count) * 100) / 100;
      let acc = 0;
      const bDate = new Date(sale.date || Date.now());
      currentList = [];
      for (let i = 1; i <= count; i++) {
        const dDate = new Date(bDate);
        dDate.setMonth(dDate.getMonth() + (i - 1));
        const amt = i === count ? +(sale.total - acc).toFixed(2) : per;
        acc += amt;
        currentList.push({
          number: i,
          amount: amt,
          dueDate: dDate.toISOString(),
          status: sale.paymentMethod === 'total' ? 'paid' : 'pending',
          paidDate: sale.paymentMethod === 'total' ? sale.date : undefined,
          paidAmount: sale.paymentMethod === 'total' ? amt : 0,
        });
      }
    }

    const updatedList = currentList.map(inst => {
      if (inst.number === installmentNumber) {
        const isCurrentlyPaid = inst.status === 'paid';
        if (isCurrentlyPaid) {
          return {
            ...inst,
            status: 'pending' as const,
            paidAmount: 0,
            paidDate: undefined,
            paymentHistory: [],
          };
        } else {
          const remaining = Math.max(0, +(inst.amount - (inst.paidAmount || 0)).toFixed(2));
          const fullRecord = {
            id: Math.random().toString(36).substring(2, 9),
            date: new Date().toISOString(),
            amount: remaining > 0 ? remaining : inst.amount,
            note: 'Pago completo registrado',
          };
          return {
            ...inst,
            status: 'paid' as const,
            paidAmount: inst.amount,
            paidDate: new Date().toISOString(),
            paymentHistory: [...(inst.paymentHistory || []), fullRecord],
          };
        }
      }
      return inst;
    });

    await updateDoc(doc(db, 'sales', saleId), {
      installmentList: JSON.parse(JSON.stringify(updatedList))
    });
  };

  const recordInstallmentPayment = async (
    saleId: string, 
    installmentNumber: number, 
    paymentAmount: number, 
    note?: string
  ) => {
    if (paymentAmount <= 0) return;
    const sale = sales.find(s => s.id === saleId);
    if (!sale) return;

    let currentList = sale.installmentList;
    if (!currentList || currentList.length === 0) {
      // similar default initialization
      const count = Math.max(1, sale.installments || 1);
      const per = Math.floor((sale.total / count) * 100) / 100;
      let acc = 0;
      const bDate = new Date(sale.date || Date.now());
      currentList = [];
      for (let i = 1; i <= count; i++) {
        const dDate = new Date(bDate);
        dDate.setMonth(dDate.getMonth() + (i - 1));
        const amt = i === count ? +(sale.total - acc).toFixed(2) : per;
        acc += amt;
        currentList.push({
          number: i,
          amount: amt,
          dueDate: dDate.toISOString(),
          status: 'pending',
          paidAmount: 0,
        });
      }
    }

    const updatedList = currentList.map(inst => {
      if (inst.number === installmentNumber) {
        const currentPaid = inst.paidAmount !== undefined 
          ? inst.paidAmount 
          : (inst.status === 'paid' ? inst.amount : 0);
        
        const newPaid = Math.min(inst.amount, +(currentPaid + paymentAmount).toFixed(2));
        const isFullyPaid = newPaid >= inst.amount - 0.01;

        const paymentRecord = {
          id: Math.random().toString(36).substring(2, 9),
          date: new Date().toISOString(),
          amount: paymentAmount,
          note: note?.trim() || undefined,
        };

        return {
          ...inst,
          paidAmount: newPaid,
          status: isFullyPaid ? ('paid' as const) : ('pending' as const),
          paidDate: isFullyPaid ? (inst.paidDate || new Date().toISOString()) : inst.paidDate,
          paymentHistory: [...(inst.paymentHistory || []), paymentRecord],
        };
      }
      return inst;
    });

    await updateDoc(doc(db, 'sales', saleId), {
      installmentList: JSON.parse(JSON.stringify(updatedList))
    });
  };

  const resetInstallmentPayment = async (saleId: string, installmentNumber: number) => {
    const sale = sales.find(s => s.id === saleId);
    if (!sale || !sale.installmentList) return;

    const updatedList = sale.installmentList.map(inst => {
      if (inst.number === installmentNumber) {
        return {
          ...inst,
          status: 'pending' as const,
          paidAmount: 0,
          paidDate: undefined,
          paymentHistory: [],
        };
      }
      return inst;
    });

    await updateDoc(doc(db, 'sales', saleId), {
      installmentList: JSON.parse(JSON.stringify(updatedList))
    });
  };

  const cancelSale = async (saleId: string) => {
    const sale = sales.find(s => s.id === saleId);
    if (!sale || sale.status === 'cancelled') return;

    const batch = writeBatch(db);
    batch.update(doc(db, 'sales', saleId), { status: 'cancelled' });
    
    // Return stock
    const items = sale.items || [{ productId: (sale as any).productId, quantity: (sale as any).quantity }];
    items.forEach(item => {
      const p = inventory.find(prod => prod.id === item.productId);
      if (p) {
        batch.update(doc(db, 'products', p.id), {
          stock: p.stock + item.quantity
        });
      }
    });

    await batch.commit();
  };

  const getBackupData = (): SystemBackup => {
    return generateSystemBackup(inventory, customers, sales, categories, sizes);
  };

  const restoreBackupData = async (
    data: {
      inventory?: Product[];
      customers?: Customer[];
      sales?: Sale[];
      categories?: string[];
      sizes?: string[];
    },
    mode: 'overwrite' | 'merge'
  ) => {
    const batch = writeBatch(db);
    
    if (mode === 'overwrite') {
      // In overwrite mode we'd normally clear everything first, but for safety in Firebase
      // it's tricky without a cloud function. We will just overwrite matching docs and add new ones.
      if (data.inventory) data.inventory.forEach(p => batch.set(doc(db, 'products', p.id), p));
      if (data.customers) data.customers.forEach(c => batch.set(doc(db, 'customers', c.id), c));
      if (data.sales) data.sales.forEach(s => batch.set(doc(db, 'sales', s.id), s));
      if (data.categories || data.sizes) {
        batch.set(doc(db, 'settings', 'global'), {
          categories: data.categories || categories,
          sizes: data.sizes || sizes
        }, { merge: true });
      }
    } else {
      // Merge mode
      if (data.inventory) {
        const existingIds = new Set(inventory.map(p => p.id));
        data.inventory.filter(p => !existingIds.has(p.id)).forEach(p => batch.set(doc(db, 'products', p.id), p));
      }
      if (data.customers) {
        const existingCustIds = new Set(customers.map(c => c.id));
        data.customers.filter(c => !existingCustIds.has(c.id)).forEach(c => batch.set(doc(db, 'customers', c.id), c));
      }
      if (data.sales) {
        const existingSaleIds = new Set(sales.map(s => s.id));
        data.sales.filter(s => !existingSaleIds.has(s.id)).forEach(s => batch.set(doc(db, 'sales', s.id), s));
      }
      if (data.categories || data.sizes) {
        const mergedCategories = Array.from(new Set([...categories, ...(data.categories || [])]));
        const mergedSizes = Array.from(new Set([...sizes, ...(data.sizes || [])]));
        batch.set(doc(db, 'settings', 'global'), {
          categories: mergedCategories,
          sizes: mergedSizes
        }, { merge: true });
      }
    }
    
    await batch.commit();
  };

  return (
    <InventoryContext.Provider value={{ 
      inventory, saveProduct, deleteProduct, clearInventory, stats,
      categories, addCategory, removeCategory,
      categorySizes, addCategorySize, removeCategorySize,
      sizes, addSize, removeSize,
      customers, saveCustomer, deleteCustomer,
      sales, hasMoreSales, loadMoreSales, addSale, cancelSale, toggleInstallmentPayment,
      recordInstallmentPayment, resetInstallmentPayment,
      getBackupData, restoreBackupData, isLoading
    }}>
      {children}
    </InventoryContext.Provider>
  );
}

export function useInventory() {
  const context = useContext(InventoryContext);
  if (context === undefined) {
    throw new Error('useInventory must be used within an InventoryProvider');
  }
  return context;
}
