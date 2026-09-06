import React, { createContext, useContext, useMemo, useState, useEffect, useCallback } from 'react';
import { Product, Sale, Customer, Installment, SystemBackup, SyncAction } from '../types';
import { generateId } from '../utils';
import { generateSystemBackup } from '../utils/backup';
import { collection, doc, onSnapshot, setDoc, deleteDoc, updateDoc, writeBatch, query, orderBy, limit as firestoreLimit } from 'firebase/firestore';
import { db } from '../firebase';
import { 
  enqueueSyncAction, 
  setCachedData, 
  getCachedData, 
  countPendingSyncActions 
} from '../utils/syncQueue';
import { 
  processSyncQueue, 
  setupAutoSyncListeners, 
  subscribeToSyncStatus 
} from '../utils/syncEngine';

interface CustomerInfoParam {
  id?: string;
  name?: string;
  email?: string;
  phone?: string;
}

interface InventoryContextType {
  inventory: Product[];
  saveProduct: (product: Omit<Product, 'id' | 'lastUpdated'>, id?: string) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  clearInventory: () => Promise<void>;
  stats: {
    totalItems: number;
    totalValue: number;
    lowStockItems: number;
    outOfStockItems: number;
  };
  categories: string[];
  addCategory: (category: string) => Promise<void>;
  removeCategory: (category: string) => Promise<void>;
  categorySizes: Record<string, string[]>;
  addCategorySize: (category: string, size: string) => Promise<void>;
  removeCategorySize: (category: string, size: string) => Promise<void>;
  sizes: string[];
  addSize: (size: string) => Promise<void>;
  removeSize: (size: string) => Promise<void>;
  customers: Customer[];
  saveCustomer: (customer: Omit<Customer, 'id' | 'createdAt'>, id?: string) => Customer;
  deleteCustomer: (id: string) => Promise<void>;
  sales: Sale[];
  hasMoreSales: boolean;
  loadMoreSales: () => void;
  addSale: (
    items: { productId: string; quantity: number }[],
    paymentMethod?: 'total' | 'credit',
    installments?: number,
    customerParam?: string | CustomerInfoParam
  ) => boolean;
  cancelSale: (saleId: string) => Promise<void>;
  toggleInstallmentPayment: (saleId: string, installmentNumber: number) => Promise<void>;
  recordInstallmentPayment: (saleId: string, installmentNumber: number, paymentAmount: number, note?: string) => Promise<void>;
  resetInstallmentPayment: (saleId: string, installmentNumber: number) => Promise<void>;
  getBackupData: () => SystemBackup;
  restoreBackupData: (data: {
    inventory?: Product[];
    customers?: Customer[];
    sales?: Sale[];
    categories?: string[];
    sizes?: string[];
  }, mode: 'overwrite' | 'merge') => Promise<void>;
  isLoading: boolean;
  // Offline Sync Queue properties
  pendingSyncCount: number;
  isSyncing: boolean;
  syncNow: () => Promise<void>;
  isOnline: boolean;
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

  // Offline Sync State
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  const isLoading = isProductsLoading || isCustomersLoading || isSalesLoading;

  // 1. Initial Offline Hydration from IndexedDB & Sync Engine setup
  useEffect(() => {
    // Hydrate state from IndexedDB offline cache so data is available instantly even if disconnected
    getCachedData<Product[]>('products').then((cached) => {
      if (cached && cached.length > 0) {
        setInventory((prev) => (prev.length === 0 ? cached : prev));
        setIsProductsLoading(false);
      }
    });

    getCachedData<Customer[]>('customers').then((cached) => {
      if (cached && cached.length > 0) {
        setCustomers((prev) => (prev.length === 0 ? cached : prev));
        setIsCustomersLoading(false);
      }
    });

    getCachedData<Sale[]>('sales').then((cached) => {
      if (cached && cached.length > 0) {
        setSales((prev) => (prev.length === 0 ? cached : prev));
        setIsSalesLoading(false);
      }
    });

    getCachedData<{ categories?: string[]; sizes?: string[]; categorySizes?: Record<string, string[]> }>('settings').then((cached) => {
      if (cached) {
        if (cached.categories) setCategories(cached.categories);
        if (cached.sizes) setSizes(cached.sizes);
        if (cached.categorySizes) setCategorySizes(cached.categorySizes);
      }
    });

    // Auto-sync listeners for online/offline events
    const cleanupSyncListeners = setupAutoSyncListeners();
    const unsubStatus = subscribeToSyncStatus((status) => {
      setIsSyncing(status.isSyncing);
      setPendingSyncCount(status.pendingCount);
    });

    countPendingSyncActions().then((count) => setPendingSyncCount(count));

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      cleanupSyncListeners();
      unsubStatus();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // 2. Firebase Realtime Listeners (and caching to IndexedDB)
  useEffect(() => {
    const unsubProducts = onSnapshot(
      collection(db, 'products'),
      (snapshot) => {
        const data: Product[] = [];
        snapshot.forEach((docSnap) => data.push(docSnap.data() as Product));
        setInventory(data);
        setCachedData('products', data);
        setIsProductsLoading(false);
      },
      (error) => {
        console.warn('Error en listener de productos (usando caché offline si disponible):', error);
        setIsProductsLoading(false);
      }
    );

    const unsubCustomers = onSnapshot(
      collection(db, 'customers'),
      (snapshot) => {
        const data: Customer[] = [];
        snapshot.forEach((docSnap) => {
          data.push(docSnap.data() as Customer);
        });
        data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setCustomers(data);
        setCachedData('customers', data);
        setIsCustomersLoading(false);
      },
      (error) => {
        console.warn('Error en listener de clientes (usando caché offline si disponible):', error);
        setIsCustomersLoading(false);
      }
    );

    const unsubSettings = onSnapshot(
      doc(db, 'settings', 'global'),
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.categories) setCategories(data.categories);
          if (data.sizes) setSizes(data.sizes);
          if (data.categorySizes) setCategorySizes(data.categorySizes);
          setCachedData('settings', data);
        } else {
          const initialSettings = {
            categories: DEFAULT_CATEGORIES,
            sizes: DEFAULT_SIZES,
            categorySizes: {},
          };
          setDoc(doc(db, 'settings', 'global'), initialSettings, { merge: true });
          setCachedData('settings', initialSettings);
        }
      },
      (error) => {
        console.warn('Error en listener de configuración (usando caché offline si disponible):', error);
      }
    );

    return () => {
      unsubProducts();
      unsubCustomers();
      unsubSettings();
    };
  }, []);

  // 3. Listener for Sales with pagination
  useEffect(() => {
    const salesQuery = query(
      collection(db, 'sales'),
      orderBy('date', 'desc'),
      firestoreLimit(salesLimit)
    );

    const unsubSales = onSnapshot(
      salesQuery,
      (snapshot) => {
        const data: Sale[] = [];
        snapshot.forEach((docSnap) => data.push(docSnap.data() as Sale));
        setSales(data);
        setCachedData('sales', data);
        setHasMoreSales(snapshot.docs.length === salesLimit);
        setIsSalesLoading(false);
      },
      (error) => {
        console.warn('Error en listener de ventas (usando caché offline si disponible):', error);
        setIsSalesLoading(false);
      }
    );

    return () => unsubSales();
  }, [salesLimit]);

  const loadMoreSales = () => {
    setSalesLimit((prev) => prev + 100);
  };

  const stats = useMemo(() => {
    const totalItems = inventory.reduce((acc, curr) => acc + curr.stock, 0);
    const totalValue = inventory.reduce((acc, curr) => acc + curr.price * curr.stock, 0);
    const lowStockItems = inventory.filter((p) => p.stock <= 5 && p.stock > 0).length;
    const outOfStockItems = inventory.filter((p) => p.stock === 0).length;
    return { totalItems, totalValue, lowStockItems, outOfStockItems };
  }, [inventory]);

  // --------------------------------------------------------------------------
  // Data Mutations: With optimistic UI updates, IndexedDB sync queue fallback
  // --------------------------------------------------------------------------

  const saveProduct = async (productData: Omit<Product, 'id' | 'lastUpdated'>, id?: string) => {
    const timestamp = new Date().toISOString();
    const finalId = id || generateId();
    const newProduct: Product = {
      ...productData,
      id: finalId,
      lastUpdated: timestamp,
    };
    const cleanProduct = JSON.parse(JSON.stringify(newProduct));

    // Optimistic UI & local cache
    setInventory((prev) => {
      const idx = prev.findIndex((p) => p.id === finalId);
      let updated: Product[];
      if (idx >= 0) {
        updated = [...prev];
        updated[idx] = cleanProduct;
      } else {
        updated = [cleanProduct, ...prev];
      }
      setCachedData('products', updated);
      return updated;
    });

    const isCurrentlyOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    const actionDesc = `Guardar producto: ${cleanProduct.name}`;

    if (!isCurrentlyOnline) {
      await enqueueSyncAction({
        type: 'SAVE_PRODUCT',
        payload: { product: cleanProduct },
        description: actionDesc,
      });
    } else {
      try {
        await setDoc(doc(db, 'products', finalId), cleanProduct, { merge: true });
      } catch (err) {
        console.warn('Fallo al guardar producto en Firebase directo. Guardando en cola IndexedDB:', err);
        await enqueueSyncAction({
          type: 'SAVE_PRODUCT',
          payload: { product: cleanProduct },
          description: actionDesc,
        });
      }
    }
  };

  const deleteProduct = async (id: string) => {
    const prod = inventory.find((p) => p.id === id);
    const prodName = prod ? prod.name : id;

    setInventory((prev) => {
      const updated = prev.filter((p) => p.id !== id);
      setCachedData('products', updated);
      return updated;
    });

    const isCurrentlyOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    const actionDesc = `Eliminar producto: ${prodName}`;

    if (!isCurrentlyOnline) {
      await enqueueSyncAction({
        type: 'DELETE_PRODUCT',
        payload: { id },
        description: actionDesc,
      });
    } else {
      try {
        await deleteDoc(doc(db, 'products', id));
      } catch (err) {
        console.warn('Fallo al eliminar producto en Firebase directo. Guardando en cola IndexedDB:', err);
        await enqueueSyncAction({
          type: 'DELETE_PRODUCT',
          payload: { id },
          description: actionDesc,
        });
      }
    }
  };

  const clearInventory = async () => {
    setInventory([]);
    setCachedData('products', []);

    const isCurrentlyOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    if (isCurrentlyOnline) {
      try {
        const batch = writeBatch(db);
        inventory.forEach((p) => {
          batch.delete(doc(db, 'products', p.id));
        });
        await batch.commit();
      } catch (err) {
        console.warn('Error al vaciar inventario en Firebase:', err);
      }
    }
  };

  const addCategory = async (category: string) => {
    if (!categories.includes(category)) {
      const newCats = [...categories, category];
      setCategories(newCats);
      setCachedData('settings', { categories: newCats, sizes, categorySizes });

      const isCurrentlyOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
      if (!isCurrentlyOnline) {
        await enqueueSyncAction({
          type: 'UPDATE_SETTINGS',
          payload: { categories: newCats },
          description: `Añadir categoría: ${category}`,
        });
      } else {
        try {
          await updateDoc(doc(db, 'settings', 'global'), { categories: newCats });
        } catch (err) {
          await enqueueSyncAction({
            type: 'UPDATE_SETTINGS',
            payload: { categories: newCats },
            description: `Añadir categoría: ${category}`,
          });
        }
      }
    }
  };

  const removeCategory = async (category: string) => {
    const newCats = categories.filter((c) => c !== category);
    setCategories(newCats);
    setCachedData('settings', { categories: newCats, sizes, categorySizes });

    const isCurrentlyOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    if (!isCurrentlyOnline) {
      await enqueueSyncAction({
        type: 'UPDATE_SETTINGS',
        payload: { categories: newCats },
        description: `Eliminar categoría: ${category}`,
      });
    } else {
      try {
        await updateDoc(doc(db, 'settings', 'global'), { categories: newCats });
      } catch (err) {
        await enqueueSyncAction({
          type: 'UPDATE_SETTINGS',
          payload: { categories: newCats },
          description: `Eliminar categoría: ${category}`,
        });
      }
    }
  };

  const addCategorySize = async (category: string, size: string) => {
    const currentSizes = categorySizes[category] || [];
    if (!currentSizes.includes(size)) {
      const newSizes = [...currentSizes, size];
      const newCategorySizes = { ...categorySizes, [category]: newSizes };
      setCategorySizes(newCategorySizes);
      setCachedData('settings', { categories, sizes, categorySizes: newCategorySizes });

      const isCurrentlyOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
      if (!isCurrentlyOnline) {
        await enqueueSyncAction({
          type: 'UPDATE_SETTINGS',
          payload: { categorySizes: newCategorySizes },
          description: `Añadir talla ${size} a categoría ${category}`,
        });
      } else {
        try {
          await updateDoc(doc(db, 'settings', 'global'), { categorySizes: newCategorySizes });
        } catch (err) {
          await enqueueSyncAction({
            type: 'UPDATE_SETTINGS',
            payload: { categorySizes: newCategorySizes },
            description: `Añadir talla ${size} a categoría ${category}`,
          });
        }
      }
    }
  };

  const removeCategorySize = async (category: string, size: string) => {
    const currentSizes = categorySizes[category] || [];
    const newSizes = currentSizes.filter((s) => s !== size);
    const newCategorySizes = { ...categorySizes, [category]: newSizes };
    setCategorySizes(newCategorySizes);
    setCachedData('settings', { categories, sizes, categorySizes: newCategorySizes });

    const isCurrentlyOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    if (!isCurrentlyOnline) {
      await enqueueSyncAction({
        type: 'UPDATE_SETTINGS',
        payload: { categorySizes: newCategorySizes },
        description: `Eliminar talla ${size} de categoría ${category}`,
      });
    } else {
      try {
        await updateDoc(doc(db, 'settings', 'global'), { categorySizes: newCategorySizes });
      } catch (err) {
        await enqueueSyncAction({
          type: 'UPDATE_SETTINGS',
          payload: { categorySizes: newCategorySizes },
          description: `Eliminar talla ${size} de categoría ${category}`,
        });
      }
    }
  };

  const addSize = async (size: string) => {
    if (!sizes.includes(size)) {
      const newSizes = [...sizes, size];
      setSizes(newSizes);
      setCachedData('settings', { categories, sizes: newSizes, categorySizes });

      const isCurrentlyOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
      if (!isCurrentlyOnline) {
        await enqueueSyncAction({
          type: 'UPDATE_SETTINGS',
          payload: { sizes: newSizes },
          description: `Añadir talla: ${size}`,
        });
      } else {
        try {
          await updateDoc(doc(db, 'settings', 'global'), { sizes: newSizes });
        } catch (err) {
          await enqueueSyncAction({
            type: 'UPDATE_SETTINGS',
            payload: { sizes: newSizes },
            description: `Añadir talla: ${size}`,
          });
        }
      }
    }
  };

  const removeSize = async (size: string) => {
    const newSizes = sizes.filter((s) => s !== size);
    setSizes(newSizes);
    setCachedData('settings', { categories, sizes: newSizes, categorySizes });

    const isCurrentlyOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    if (!isCurrentlyOnline) {
      await enqueueSyncAction({
        type: 'UPDATE_SETTINGS',
        payload: { sizes: newSizes },
        description: `Eliminar talla: ${size}`,
      });
    } else {
      try {
        await updateDoc(doc(db, 'settings', 'global'), { sizes: newSizes });
      } catch (err) {
        await enqueueSyncAction({
          type: 'UPDATE_SETTINGS',
          payload: { sizes: newSizes },
          description: `Eliminar talla: ${size}`,
        });
      }
    }
  };

  /**
   * Saves or creates a customer. Works seamlessly offline and pushes to Firebase on reconnection.
   */
  const saveCustomer = (
    customerData: Omit<Customer, 'id' | 'createdAt'>, 
    id?: string
  ): Customer => {
    const finalId = id || generateId();
    let finalCreatedAt = new Date().toISOString();

    if (id) {
      const existing = customers.find((c) => c.id === id);
      if (existing) finalCreatedAt = existing.createdAt;
    }

    const newCust: Customer = {
      ...customerData,
      id: finalId,
      createdAt: finalCreatedAt,
    };

    const cleanCust = JSON.parse(JSON.stringify(newCust));

    // 1. Optimistic React state update & local IndexedDB cache update
    setCustomers((prev) => {
      const existingIdx = prev.findIndex((c) => c.id === finalId);
      let updated: Customer[];
      if (existingIdx >= 0) {
        updated = [...prev];
        updated[existingIdx] = cleanCust;
      } else {
        updated = [cleanCust, ...prev];
      }
      setCachedData('customers', updated);
      return updated;
    });

    const isCurrentlyOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    const actionDesc = `Guardar cliente: ${cleanCust.firstName} ${cleanCust.lastName}`;

    // 2. If offline, enqueue in IndexedDB; if online, try Firebase and fallback to queue on error
    if (!isCurrentlyOnline) {
      enqueueSyncAction({
        type: 'SAVE_CUSTOMER',
        payload: { customer: cleanCust },
        description: actionDesc,
      });
    } else {
      setDoc(doc(db, 'customers', finalId), cleanCust, { merge: true }).catch((err) => {
        console.warn('Fallo al guardar cliente en Firebase directo. Guardando en cola IndexedDB:', err);
        enqueueSyncAction({
          type: 'SAVE_CUSTOMER',
          payload: { customer: cleanCust },
          description: actionDesc,
        });
      });
    }

    return newCust;
  };

  const deleteCustomer = async (id: string) => {
    const target = customers.find((c) => c.id === id);
    const targetName = target ? `${target.firstName} ${target.lastName}` : id;

    setCustomers((prev) => {
      const updated = prev.filter((c) => c.id !== id);
      setCachedData('customers', updated);
      return updated;
    });

    const isCurrentlyOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    const actionDesc = `Eliminar cliente: ${targetName}`;

    if (!isCurrentlyOnline) {
      await enqueueSyncAction({
        type: 'DELETE_CUSTOMER',
        payload: { id },
        description: actionDesc,
      });
    } else {
      try {
        await deleteDoc(doc(db, 'customers', id));
      } catch (err) {
        console.warn('Fallo al eliminar cliente en Firebase directo. Guardando en cola IndexedDB:', err);
        await enqueueSyncAction({
          type: 'DELETE_CUSTOMER',
          payload: { id },
          description: actionDesc,
        });
      }
    }
  };

  /**
   * Adds a new sale. Calculates installments, updates inventory stock, and stores in IndexedDB queue if offline.
   */
  const addSale = (
    cartItems: { productId: string; quantity: number }[],
    paymentMethod: 'total' | 'credit' = 'total',
    installments?: number,
    customerParam?: string | CustomerInfoParam
  ) => {
    // Validate stock locally
    for (const item of cartItems) {
      const product = inventory.find((p) => p.id === item.productId);
      if (!product || product.stock < item.quantity) return false;
    }

    let total = 0;
    const saleItems = [];

    for (const item of cartItems) {
      const product = inventory.find((p) => p.id === item.productId)!;
      const subtotal = product.price * item.quantity;
      total += subtotal;
      saleItems.push({
        productId: product.id,
        productName: product.name,
        quantity: item.quantity,
        price: product.price,
        subtotal,
      });
    }

    const customerInfo =
      typeof customerParam === 'string'
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
          status: 'pending',
        });
      }
    } else {
      installmentList = [
        {
          number: 1,
          amount: total,
          dueDate: new Date().toISOString(),
          status: 'paid',
          paidDate: new Date().toISOString(),
          paidAmount: total,
        },
      ];
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
      customerPhone: customerInfo.phone,
    };

    const newSale = JSON.parse(JSON.stringify(rawSale));

    // Calculate inventory updates
    const inventoryUpdates: { productId: string; newStock: number }[] = [];
    cartItems.forEach((item) => {
      const p = inventory.find((prod) => prod.id === item.productId);
      if (p) {
        inventoryUpdates.push({ productId: p.id, newStock: p.stock - item.quantity });
      }
    });

    // Optimistic local state updates
    setInventory((prev) => {
      const updated = prev.map((p) => {
        const u = inventoryUpdates.find((item) => item.productId === p.id);
        return u ? { ...p, stock: u.newStock } : p;
      });
      setCachedData('products', updated);
      return updated;
    });

    setSales((prev) => {
      const updated = [newSale, ...prev];
      setCachedData('sales', updated);
      return updated;
    });

    const isCurrentlyOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    const actionDesc = `Registrar venta #${newSaleId.slice(0, 6).toUpperCase()} (${newSale.customerName || 'Cliente'})`;

    if (!isCurrentlyOnline) {
      enqueueSyncAction({
        type: 'ADD_SALE',
        payload: { sale: newSale, inventoryUpdates },
        description: actionDesc,
      });
    } else {
      const batch = writeBatch(db);
      batch.set(doc(db, 'sales', newSaleId), newSale);
      for (const u of inventoryUpdates) {
        batch.update(doc(db, 'products', u.productId), { stock: u.newStock });
      }
      batch.commit().catch((err) => {
        console.warn('Fallo al registrar venta en Firebase directo. Guardando en cola IndexedDB:', err);
        enqueueSyncAction({
          type: 'ADD_SALE',
          payload: { sale: newSale, inventoryUpdates },
          description: actionDesc,
        });
      });
    }

    return true;
  };

  const toggleInstallmentPayment = async (saleId: string, installmentNumber: number) => {
    const sale = sales.find((s) => s.id === saleId);
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

    const updatedList = currentList.map((inst) => {
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

    const cleanUpdatedList = JSON.parse(JSON.stringify(updatedList));

    // Optimistic UI update
    setSales((prev) => {
      const updated = prev.map((s) => (s.id === saleId ? { ...s, installmentList: cleanUpdatedList } : s));
      setCachedData('sales', updated);
      return updated;
    });

    const isCurrentlyOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    const actionDesc = `Modificar estado cuota #${installmentNumber} venta #${saleId.slice(0, 6).toUpperCase()}`;

    if (!isCurrentlyOnline) {
      await enqueueSyncAction({
        type: 'UPDATE_INSTALLMENTS',
        payload: { saleId, installmentList: cleanUpdatedList },
        description: actionDesc,
      });
    } else {
      try {
        await updateDoc(doc(db, 'sales', saleId), {
          installmentList: cleanUpdatedList,
        });
      } catch (err) {
        console.warn('Fallo al actualizar cuota en Firebase directo. Guardando en cola IndexedDB:', err);
        await enqueueSyncAction({
          type: 'UPDATE_INSTALLMENTS',
          payload: { saleId, installmentList: cleanUpdatedList },
          description: actionDesc,
        });
      }
    }
  };

  const recordInstallmentPayment = async (
    saleId: string,
    installmentNumber: number,
    paymentAmount: number,
    note?: string
  ) => {
    if (paymentAmount <= 0) return;
    const sale = sales.find((s) => s.id === saleId);
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
          status: 'pending',
          paidAmount: 0,
        });
      }
    }

    const updatedList = currentList.map((inst) => {
      if (inst.number === installmentNumber) {
        const currentPaid =
          inst.paidAmount !== undefined
            ? inst.paidAmount
            : inst.status === 'paid'
            ? inst.amount
            : 0;

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
          paidDate: isFullyPaid ? inst.paidDate || new Date().toISOString() : inst.paidDate,
          paymentHistory: [...(inst.paymentHistory || []), paymentRecord],
        };
      }
      return inst;
    });

    const cleanUpdatedList = JSON.parse(JSON.stringify(updatedList));

    setSales((prev) => {
      const updated = prev.map((s) => (s.id === saleId ? { ...s, installmentList: cleanUpdatedList } : s));
      setCachedData('sales', updated);
      return updated;
    });

    const isCurrentlyOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    const actionDesc = `Registrar abono de $${paymentAmount} cuota #${installmentNumber} venta #${saleId.slice(0, 6).toUpperCase()}`;

    if (!isCurrentlyOnline) {
      await enqueueSyncAction({
        type: 'UPDATE_INSTALLMENTS',
        payload: { saleId, installmentList: cleanUpdatedList },
        description: actionDesc,
      });
    } else {
      try {
        await updateDoc(doc(db, 'sales', saleId), {
          installmentList: cleanUpdatedList,
        });
      } catch (err) {
        console.warn('Fallo al registrar abono en Firebase directo. Guardando en cola IndexedDB:', err);
        await enqueueSyncAction({
          type: 'UPDATE_INSTALLMENTS',
          payload: { saleId, installmentList: cleanUpdatedList },
          description: actionDesc,
        });
      }
    }
  };

  const resetInstallmentPayment = async (saleId: string, installmentNumber: number) => {
    const sale = sales.find((s) => s.id === saleId);
    if (!sale || !sale.installmentList) return;

    const updatedList = sale.installmentList.map((inst) => {
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

    const cleanUpdatedList = JSON.parse(JSON.stringify(updatedList));

    setSales((prev) => {
      const updated = prev.map((s) => (s.id === saleId ? { ...s, installmentList: cleanUpdatedList } : s));
      setCachedData('sales', updated);
      return updated;
    });

    const isCurrentlyOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    const actionDesc = `Reiniciar cuota #${installmentNumber} venta #${saleId.slice(0, 6).toUpperCase()}`;

    if (!isCurrentlyOnline) {
      await enqueueSyncAction({
        type: 'UPDATE_INSTALLMENTS',
        payload: { saleId, installmentList: cleanUpdatedList },
        description: actionDesc,
      });
    } else {
      try {
        await updateDoc(doc(db, 'sales', saleId), {
          installmentList: cleanUpdatedList,
        });
      } catch (err) {
        console.warn('Fallo al reiniciar cuota en Firebase directo. Guardando en cola IndexedDB:', err);
        await enqueueSyncAction({
          type: 'UPDATE_INSTALLMENTS',
          payload: { saleId, installmentList: cleanUpdatedList },
          description: actionDesc,
        });
      }
    }
  };

  const cancelSale = async (saleId: string) => {
    const sale = sales.find((s) => s.id === saleId);
    if (!sale || sale.status === 'cancelled') return;

    // Return stock
    const items = sale.items || [{ productId: (sale as any).productId, quantity: (sale as any).quantity }];
    const inventoryUpdates: { productId: string; newStock: number }[] = [];

    items.forEach((item) => {
      const p = inventory.find((prod) => prod.id === item.productId);
      if (p) {
        inventoryUpdates.push({ productId: p.id, newStock: p.stock + item.quantity });
      }
    });

    setInventory((prev) => {
      const updated = prev.map((p) => {
        const u = inventoryUpdates.find((item) => item.productId === p.id);
        return u ? { ...p, stock: u.newStock } : p;
      });
      setCachedData('products', updated);
      return updated;
    });

    setSales((prev) => {
      const updated = prev.map((s) => (s.id === saleId ? { ...s, status: 'cancelled' as const } : s));
      setCachedData('sales', updated);
      return updated;
    });

    const isCurrentlyOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    const actionDesc = `Anular venta #${saleId.slice(0, 6).toUpperCase()}`;

    if (!isCurrentlyOnline) {
      await enqueueSyncAction({
        type: 'CANCEL_SALE',
        payload: { saleId, inventoryUpdates },
        description: actionDesc,
      });
    } else {
      try {
        const batch = writeBatch(db);
        batch.update(doc(db, 'sales', saleId), { status: 'cancelled' });
        for (const u of inventoryUpdates) {
          batch.update(doc(db, 'products', u.productId), { stock: u.newStock });
        }
        await batch.commit();
      } catch (err) {
        console.warn('Fallo al anular venta en Firebase directo. Guardando en cola IndexedDB:', err);
        await enqueueSyncAction({
          type: 'CANCEL_SALE',
          payload: { saleId, inventoryUpdates },
          description: actionDesc,
        });
      }
    }
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
      if (data.inventory) data.inventory.forEach((p) => batch.set(doc(db, 'products', p.id), p));
      if (data.customers) data.customers.forEach((c) => batch.set(doc(db, 'customers', c.id), c));
      if (data.sales) data.sales.forEach((s) => batch.set(doc(db, 'sales', s.id), s));
      if (data.categories || data.sizes) {
        batch.set(
          doc(db, 'settings', 'global'),
          {
            categories: data.categories || categories,
            sizes: data.sizes || sizes,
          },
          { merge: true }
        );
      }
    } else {
      if (data.inventory) {
        const existingIds = new Set(inventory.map((p) => p.id));
        data.inventory.filter((p) => !existingIds.has(p.id)).forEach((p) => batch.set(doc(db, 'products', p.id), p));
      }
      if (data.customers) {
        const existingCustIds = new Set(customers.map((c) => c.id));
        data.customers.filter((c) => !existingCustIds.has(c.id)).forEach((c) => batch.set(doc(db, 'customers', c.id), c));
      }
      if (data.sales) {
        const existingSaleIds = new Set(sales.map((s) => s.id));
        data.sales.filter((s) => !existingSaleIds.has(s.id)).forEach((s) => batch.set(doc(db, 'sales', s.id), s));
      }
      if (data.categories || data.sizes) {
        const mergedCategories = Array.from(new Set([...categories, ...(data.categories || [])]));
        const mergedSizes = Array.from(new Set([...sizes, ...(data.sizes || [])]));
        batch.set(
          doc(db, 'settings', 'global'),
          {
            categories: mergedCategories,
            sizes: mergedSizes,
          },
          { merge: true }
        );
      }
    }

    await batch.commit();
  };

  const syncNow = useCallback(async () => {
    await processSyncQueue();
    const count = await countPendingSyncActions();
    setPendingSyncCount(count);
  }, []);

  return (
    <InventoryContext.Provider
      value={{
        inventory,
        saveProduct,
        deleteProduct,
        clearInventory,
        stats,
        categories,
        addCategory,
        removeCategory,
        categorySizes,
        addCategorySize,
        removeCategorySize,
        sizes,
        addSize,
        removeSize,
        customers,
        saveCustomer,
        deleteCustomer,
        sales,
        hasMoreSales,
        loadMoreSales,
        addSale,
        cancelSale,
        toggleInstallmentPayment,
        recordInstallmentPayment,
        resetInstallmentPayment,
        getBackupData,
        restoreBackupData,
        isLoading,
        pendingSyncCount,
        isSyncing,
        syncNow,
        isOnline,
      }}
    >
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
