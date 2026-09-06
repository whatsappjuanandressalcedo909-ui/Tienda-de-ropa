import { Product, Customer, Sale, SystemBackup, DatabaseSchemaDefinition } from '../types';

export const BACKUP_SCHEMA_DEFINITION: DatabaseSchemaDefinition = {
  tables: {
    products: {
      description: 'Catálogo completo de prendas de vestir y artículos en inventario',
      primaryKey: 'id',
      columns: {
        id: 'string (Identificador único UUID)',
        name: 'string (Nombre o referencia de la prenda)',
        sku: 'string (Código de barras o referencia comercial)',
        category: 'string (Categoría a la que pertenece)',
        size: 'string (Talla de la prenda: XS, S, M, L, XL, etc.)',
        color: 'string (Color o tono de la prenda)',
        price: 'number (Precio de venta unitario)',
        stock: 'number (Cantidad física disponible en almacén)',
        lastUpdated: 'string (Marca de tiempo ISO 8601 de última actualización)'
      }
    },
    customers: {
      description: 'Directorio y registro de clientes para ventas y créditos',
      primaryKey: 'id',
      columns: {
        id: 'string (Identificador único UUID)',
        firstName: 'string (Nombres del cliente)',
        lastName: 'string (Apellidos del cliente)',
        email: 'string (Correo electrónico de contacto)',
        phone: 'string? (Teléfono o móvil opcional)',
        createdAt: 'string (Marca de tiempo ISO 8601 de registro)'
      }
    },
    sales: {
      description: 'Transacciones de venta realizadas (contado y crédito a cuotas)',
      primaryKey: 'id',
      columns: {
        id: 'string (Identificador único UUID)',
        customerId: 'string? (Identificador foráneo del cliente)',
        customerName: 'string? (Nombre completo desnormalizado)',
        customerEmail: 'string? (Correo desnormalizado)',
        customerPhone: 'string? (Teléfono desnormalizado)',
        items: 'Array<SaleItem> { productId, productName, quantity, price, subtotal }',
        total: 'number (Monto total monetario de la venta)',
        date: 'string (Marca de tiempo ISO 8601 de la transacción)',
        status: "'completed' | 'cancelled'",
        paymentMethod: "'total' (contado) | 'credit' (crédito en cuotas)",
        installments: 'number? (Número de cuotas pactadas)',
        installmentList: 'Array<Installment> { number, amount, dueDate, status, paidDate, paidAmount, paymentHistory }'
      }
    },
    categories: {
      description: 'Lista maestra de categorías asignables a los productos',
      type: 'string[] (Nombres de categorías únicas)'
    },
    sizes: {
      description: 'Lista maestra de tallas disponibles en la tienda',
      type: 'string[] (Tallas configuradas)'
    }
  }
};

export function generateSystemBackup(
  inventory: Product[],
  customers: Customer[],
  sales: Sale[],
  categories: string[],
  sizes: string[]
): SystemBackup {
  return {
    _format: 'tienda_ropa_backup_v1',
    metadata: {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      systemName: 'Sistema de Inventario, Ventas y Cartera de Ropa',
      totalProducts: inventory.length,
      totalCustomers: customers.length,
      totalSales: sales.length,
      totalCategories: categories.length,
      totalSizes: sizes.length,
    },
    schema: BACKUP_SCHEMA_DEFINITION,
    data: {
      inventory,
      customers,
      sales,
      categories,
      sizes,
    },
  };
}

export function downloadJsonFile(content: object, filename: string) {
  const jsonStr = JSON.stringify(content, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export interface ParsedBackupResult {
  valid: boolean;
  error?: string;
  metadata?: {
    exportedAt?: string;
    version?: string;
    systemName?: string;
  };
  counts: {
    products: number;
    customers: number;
    sales: number;
    categories: number;
    sizes: number;
  };
  data: {
    inventory: Product[];
    customers: Customer[];
    sales: Sale[];
    categories: string[];
    sizes: string[];
  };
}

export function validateAndParseBackupJson(rawJson: string): ParsedBackupResult {
  let parsed: any;
  try {
    parsed = JSON.parse(rawJson);
  } catch (err) {
    return {
      valid: false,
      error: 'El archivo seleccionado no es un formato JSON válido.',
      counts: { products: 0, customers: 0, sales: 0, categories: 0, sizes: 0 },
      data: { inventory: [], customers: [], sales: [], categories: [], sizes: [] },
    };
  }

  if (!parsed || typeof parsed !== 'object') {
    return {
      valid: false,
      error: 'La estructura del archivo JSON está vacía o es inválida.',
      counts: { products: 0, customers: 0, sales: 0, categories: 0, sizes: 0 },
      data: { inventory: [], customers: [], sales: [], categories: [], sizes: [] },
    };
  }

  // Handle both full SystemBackup format and legacy/flat data format
  let inventory: Product[] = [];
  let customers: Customer[] = [];
  let sales: Sale[] = [];
  let categories: string[] = [];
  let sizes: string[] = [];
  let metadata: any = undefined;

  if (parsed.data && typeof parsed.data === 'object') {
    // Standard SystemBackup format
    metadata = parsed.metadata;
    if (Array.isArray(parsed.data.inventory)) inventory = parsed.data.inventory;
    if (Array.isArray(parsed.data.customers)) customers = parsed.data.customers;
    if (Array.isArray(parsed.data.sales)) sales = parsed.data.sales;
    if (Array.isArray(parsed.data.categories)) categories = parsed.data.categories;
    if (Array.isArray(parsed.data.sizes)) sizes = parsed.data.sizes;
  } else {
    // Flat or direct collection backup
    if (Array.isArray(parsed.inventory)) inventory = parsed.inventory;
    else if (Array.isArray(parsed.products)) inventory = parsed.products;

    if (Array.isArray(parsed.customers)) customers = parsed.customers;
    if (Array.isArray(parsed.sales)) sales = parsed.sales;
    if (Array.isArray(parsed.categories)) categories = parsed.categories;
    if (Array.isArray(parsed.sizes)) sizes = parsed.sizes;
  }

  // Ensure items have minimal valid fields
  const cleanInventory = inventory.filter(p => p && typeof p === 'object' && p.id && p.name);
  const cleanCustomers = customers.filter(c => c && typeof c === 'object' && c.id && c.firstName);
  const cleanSales = sales.filter(s => s && typeof s === 'object' && s.id && Array.isArray(s.items));
  const cleanCategories = categories.filter(c => typeof c === 'string' && c.trim().length > 0);
  const cleanSizes = sizes.filter(s => typeof s === 'string' && s.trim().length > 0);

  const totalEntities = cleanInventory.length + cleanCustomers.length + cleanSales.length + cleanCategories.length + cleanSizes.length;

  if (totalEntities === 0) {
    return {
      valid: false,
      error: 'El archivo JSON no contiene tablas reconocibles ni datos de inventario, clientes o ventas.',
      counts: { products: 0, customers: 0, sales: 0, categories: 0, sizes: 0 },
      data: { inventory: [], customers: [], sales: [], categories: [], sizes: [] },
    };
  }

  return {
    valid: true,
    metadata: {
      exportedAt: metadata?.exportedAt,
      version: metadata?.version || '1.0.0',
      systemName: metadata?.systemName,
    },
    counts: {
      products: cleanInventory.length,
      customers: cleanCustomers.length,
      sales: cleanSales.length,
      categories: cleanCategories.length,
      sizes: cleanSizes.length,
    },
    data: {
      inventory: cleanInventory,
      customers: cleanCustomers,
      sales: cleanSales,
      categories: cleanCategories,
      sizes: cleanSizes,
    },
  };
}
