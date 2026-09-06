export type Category = string;
export type Size = string;

export interface Product {
  id: string;
  name: string;
  sku: string;
  category: Category;
  size: Size;
  color: string;
  price: number;
  stock: number;
  lastUpdated: string;
}

export type SortOption = 'name' | 'stock' | 'price' | 'newest';

export interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  createdAt: string;
}

export interface SaleItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  subtotal: number;
}

export interface InstallmentPaymentRecord {
  id: string;
  date: string;
  amount: number;
  note?: string;
}

export interface Installment {
  number: number;
  amount: number;
  dueDate: string;
  status: 'paid' | 'pending';
  paidDate?: string;
  paidAmount?: number;
  paymentHistory?: InstallmentPaymentRecord[];
}

export interface Sale {
  id: string;
  customerId?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  items: SaleItem[];
  total: number;
  date: string;
  status: 'completed' | 'cancelled';
  paymentMethod?: 'total' | 'credit';
  installments?: number;
  installmentList?: Installment[];
}

export interface BackupMetadata {
  version: string;
  exportedAt: string;
  systemName: string;
  totalProducts: number;
  totalCustomers: number;
  totalSales: number;
  totalCategories: number;
  totalSizes: number;
}

export interface DatabaseSchemaDefinition {
  tables: {
    products: {
      description: string;
      primaryKey: string;
      columns: Record<string, string>;
    };
    customers: {
      description: string;
      primaryKey: string;
      columns: Record<string, string>;
    };
    sales: {
      description: string;
      primaryKey: string;
      columns: Record<string, string>;
    };
    categories: {
      description: string;
      type: string;
    };
    sizes: {
      description: string;
      type: string;
    };
  };
}

export interface SystemBackup {
  _format: string;
  metadata: BackupMetadata;
  schema: DatabaseSchemaDefinition;
  data: {
    inventory: Product[];
    customers: Customer[];
    sales: Sale[];
    categories: string[];
    sizes: string[];
  };
}
