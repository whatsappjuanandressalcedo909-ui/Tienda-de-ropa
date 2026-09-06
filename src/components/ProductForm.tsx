import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Category, Size } from '../types';
import { X, Save, Trash2, Wand2 } from 'lucide-react';
import { useInventory } from '../context/InventoryContext';

export function ProductForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { inventory, saveProduct, deleteProduct, categories, sizes, categorySizes } = useInventory();
  
  const isNew = id === 'new';
  const product = isNew ? null : inventory.find(p => p.id === id);

  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [category, setCategory] = useState<Category>(categories[0] || '');
  
  const availableSizes = categorySizes && categorySizes[category] && categorySizes[category].length > 0 
    ? categorySizes[category] 
    : sizes;

  const [size, setSize] = useState<Size>(availableSizes[0] || '');
  const [color, setColor] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('');

  const generateRandomSku = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setSku(result);
  };

  // Ensure size is valid for category when category changes
  useEffect(() => {
    if (availableSizes.length > 0 && !availableSizes.includes(size)) {
      setSize(availableSizes[0]);
    }
  }, [category, availableSizes, size]);

  // Set initial form values based on loaded product
  useEffect(() => {
    if (product) {
      setName(product.name);
      setSku(product.sku);
      setCategory(product.category);
      setSize(product.size);
      setColor(product.color);
      setPrice(product.price.toString());
      setStock(product.stock.toString());
    } else if (!isNew) {
      // Product not found and not new
      navigate('/');
    }
  }, [product, isNew, navigate]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveProduct({
      name,
      sku,
      category,
      size,
      color,
      price: parseFloat(price) || 0,
      stock: parseInt(stock, 10) || 0,
    }, isNew ? undefined : product?.id);
    navigate(-1);
  };

  const handleDelete = () => {
    if (product && window.confirm('¿Eliminar este producto?')) {
      deleteProduct(product.id);
      navigate('/');
    }
  };

  const handleClose = () => {
    navigate(-1);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-300">
      <div className="bg-white rounded-t-[2rem] sm:rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[92vh] animate-in slide-in-from-bottom-8 sm:slide-in-from-bottom-4 duration-300">
        
        {/* Mobile drag handle */}
        <div className="w-full flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-12 h-1.5 bg-slate-200 rounded-full"></div>
        </div>

        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white">
          <h2 className="text-xl font-bold text-slate-800 tracking-tight">
            {isNew ? 'Nuevo Producto' : 'Editar Producto'}
          </h2>
          <div className="flex items-center gap-1">
            {!isNew && (
              <button 
                type="button"
                onClick={handleDelete}
                className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                title="Eliminar"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            )}
            <button 
              type="button"
              onClick={handleClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 flex-1">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nombre del producto</label>
            <input 
              required
              type="text" 
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
              placeholder="Ej. Camiseta Básica Algodón"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-slate-700">SKU / Código</label>
                <button
                  type="button"
                  onClick={generateRandomSku}
                  className="text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-1 font-medium transition-colors"
                  title="Generar SKU aleatorio"
                >
                  <Wand2 className="w-3.5 h-3.5" />
                  Generar
                </button>
              </div>
              <input 
                required
                type="text" 
                value={sku}
                onChange={e => setSku(e.target.value.toUpperCase())}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                placeholder="Ej. CAM-001"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Categoría</label>
              <select 
                value={category}
                onChange={e => setCategory(e.target.value as Category)}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
              >
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Talla</label>
              <select 
                value={size}
                onChange={e => setSize(e.target.value as Size)}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
              >
                {availableSizes.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Color</label>
              <input 
                required
                type="text" 
                value={color}
                onChange={e => setColor(e.target.value)}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                placeholder="Ej. Blanco"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Precio (COP)</label>
              <input 
                required
                type="number" 
                min="0"
                step="100"
                value={price}
                onChange={e => setPrice(e.target.value)}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Cantidad (Stock)</label>
              <input 
                required
                type="number" 
                min="0"
                value={stock}
                onChange={e => setStock(e.target.value)}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                placeholder="0"
              />
            </div>
          </div>
          
          <div className="pt-4 pb-2">
            <button 
              type="submit"
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white py-3 px-4 rounded-xl font-medium transition-colors"
            >
              <Save className="w-5 h-5" />
              {product ? 'Guardar Cambios' : 'Crear Producto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
