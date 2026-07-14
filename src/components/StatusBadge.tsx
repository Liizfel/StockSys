import React from 'react';
import { Material } from '../types';
import { Package, TrendingUp, Clock, ShoppingCart, CheckCircle2 } from 'lucide-react';

export const StatusBadge = ({ status }: { status: Material['status'] }) => {
  switch (status) {
    case 'PENDING':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-secondary text-muted-foreground border border-border">
          <Package className="w-3.5 h-3.5" /> Pendente
        </span>
      );
    case 'COUNTED_RECENTLY':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-500 dark:text-blue-400 border border-blue-500/20">
          <TrendingUp className="w-3.5 h-3.5" /> Recém Contado
        </span>
      );
    case 'AWAITING_CONFIRMATION':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-500/10 text-yellow-500 dark:text-yellow-400 border border-yellow-500/20">
          <Clock className="w-3.5 h-3.5" /> Aguardando
        </span>
      );
    case 'PURCHASE_REQUESTED':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-500 dark:text-red-400 border border-red-500/20">
          <ShoppingCart className="w-3.5 h-3.5" /> Solicitado
        </span>
      );
    case 'COMPLETED':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 border border-emerald-500/20">
          <CheckCircle2 className="w-3.5 h-3.5" /> Reposto
        </span>
      );
    default:
      return null;
  }
};
