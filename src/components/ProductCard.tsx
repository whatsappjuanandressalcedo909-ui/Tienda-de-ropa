import React from 'react';
import { Product } from '../types';
import { formatCurrency } from '../utils';
import { Edit2, Package } from 'lucide-react';

interface ProductCardProps {
  key?: React.Key;
  product: Product;
  onEdit: (product?: Product) => void;
}

export function ProductCard({ product, onEdit }: ProductCardProps) {
  const isLowStock = product.stock <= 5;
  const isOutOfStock = product.stock === 0;

  return (
    <div 
      onClick={() => onEdit(product)}
      className="bg-white rounded-[1.5rem] p-4 shadow-[0_2px_12px_rgba(0,0,0,0.03)] border border-slate-100/60 hover:shadow-lg hover:border-indigo-100 transition-all cursor-pointer group active:scale-[0.98]"
    >
      <div className="flex items-center gap-4">
        {/* Category Icon */}
        <div className={`w-14 h-14 rounded-2xl flex flex-shrink-0 items-center justify-center transition-colors ${
          isOutOfStock ? 'bg-red-50 text-red-400' : 
          isLowStock ? 'bg-amber-50 text-amber-400' : 
          'bg-indigo-50 text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white'
        }`}>
          <Package className="w-7 h-7" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
              {product.category}
            </span>
            {isOutOfStock ? (
              <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                AGOTADO
              </span>
            ) : isLowStock ? (
              <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                QUEDAN {product.stock}
              </span>
            ) : null}
          </div>
          
          <h3 className="text-[15px] font-bold text-slate-800 leading-tight truncate mb-1">
            {product.name}
          </h3>
          
          <div className="text-[13px] text-slate-500 truncate">
            {product.size} • {product.color}
          </div>
        </div>

        {/* Price & Action */}
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          <span className="text-[15px] font-bold text-slate-900">
            {formatCurrency(product.price)}
          </span>
          <div className="w-10 h-10 sm:w-8 sm:h-8 rounded-2xl sm:rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
            <Edit2 className="w-4 h-4" />
          </div>
        </div>
      </div>
    </div>
  );
}
