import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, SlidersHorizontal, Package, Plus } from 'lucide-react';
import { motion } from 'motion/react';
import { useInventory } from '../context/InventoryContext';
import { SortOption } from '../types';
import { ProductCard } from '../components/ProductCard';

export function Inventory() {
  const { inventory, isLoading } = useInventory();
  const navigate = useNavigate();
  
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('newest');

  const filteredInventory = useMemo(() => {
    return inventory
      .filter(p => 
        p.name.toLowerCase().includes(search.toLowerCase()) || 
        p.sku.toLowerCase().includes(search.toLowerCase()) ||
        p.category.toLowerCase().includes(search.toLowerCase())
      )
      .sort((a, b) => {
        if (sortBy === 'name') return a.name.localeCompare(b.name);
        if (sortBy === 'price') return b.price - a.price;
        if (sortBy === 'stock') return a.stock - b.stock;
        return new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime();
      });
  }, [inventory, search, sortBy]);

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-slate-400" />
          </div>
          <input
            type="text"
            placeholder="Buscar por nombre, SKU o categoría..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="block w-full pl-12 pr-4 py-3.5 border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.02)] rounded-2xl text-[15px] leading-5 bg-white placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
          />
        </div>
        <div className="relative">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="block w-full pl-4 pr-11 py-3.5 text-[15px] border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.02)] focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 rounded-2xl bg-white appearance-none"
          >
            <option value="newest">Más recientes</option>
            <option value="name">Nombre (A-Z)</option>
            <option value="price">Mayor Precio</option>
            <option value="stock">Menor Stock</option>
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-400">
            <SlidersHorizontal className="h-4 w-4" />
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-white rounded-3xl p-3 border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.02)] animate-pulse">
              <div className="w-full h-48 bg-slate-100 rounded-2xl mb-4"></div>
              <div className="px-2 space-y-3">
                <div className="h-4 bg-slate-100 rounded-full w-3/4"></div>
                <div className="h-3 bg-slate-100 rounded-full w-1/2"></div>
                <div className="flex justify-between items-center pt-2 mt-2 border-t border-slate-50">
                   <div className="h-4 bg-slate-100 rounded-full w-1/3"></div>
                   <div className="h-6 w-16 bg-slate-100 rounded-full"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filteredInventory.length === 0 ? (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center py-16 bg-white rounded-3xl border border-slate-100 border-dashed"
        >
          <Package className="mx-auto h-12 w-12 text-slate-300 mb-3" />
          <h3 className="text-lg font-medium text-slate-900">No hay productos</h3>
          <p className="mt-1 text-slate-500 max-w-sm mx-auto">
            {search 
              ? "No se encontraron productos que coincidan con tu búsqueda."
              : "Comienza añadiendo productos a tu inventario."}
          </p>
          {!search && (
            <button
              onClick={() => navigate('/product/new')}
              className="mt-6 inline-flex items-center gap-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 px-4 py-2 rounded-full text-sm font-medium transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Añadir Producto
            </button>
          )}
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 animate-in fade-in duration-200">
          {filteredInventory.map(product => (
            <div key={product.id}>
              <ProductCard 
                product={product} 
                onEdit={() => navigate(`/product/${product.id}`)} 
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
