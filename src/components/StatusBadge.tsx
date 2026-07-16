import React from 'react';
import { Material } from '../types';
import { 
  Package, 
  TrendingUp, 
  Clock, 
  ShoppingCart, 
  CheckCircle2, 
  ArrowLeftRight,
  LucideIcon 
} from 'lucide-react';
import { cn } from '../lib/utils';

interface StatusBadgeProps {
  status: Material['status'] | string | undefined;
  className?: string;
}

export const StatusBadge = ({ status, className }: StatusBadgeProps) => {
  // Configuração das variantes para melhor organização e performance
  const getBadgeConfig = (): { icon: LucideIcon, label: string, classes: string } | null => {
    switch (status) {
      case 'PENDING':
        return { 
          icon: Package, 
          label: 'Pendente', 
          classes: 'bg-secondary text-muted-foreground border-border' 
        };
      case 'COUNTED_RECENTLY':
        return { 
          icon: TrendingUp, 
          label: 'Recém Contado', 
          classes: 'bg-blue-500/10 text-blue-500 border-blue-500/20' 
        };
      case 'AWAITING_CONFIRMATION':
        return { 
          icon: Clock, 
          label: 'Aguardando', 
          classes: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' 
        };
      case 'PURCHASE_REQUESTED':
        return { 
          icon: ShoppingCart, 
          label: 'Solicitado', 
          classes: 'bg-red-500/10 text-red-500 border-red-500/20' 
        };
      case 'COMPLETED':
        return { 
          icon: CheckCircle2, 
          label: 'Reposto', 
          classes: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' 
        };
      case 'REALOCATED_TO_GIRO':
        return { 
          icon: ArrowLeftRight, 
          label: 'Realocado Giro', 
          classes: 'bg-amber-500/10 text-amber-500 border-amber-500/20' 
        };
      default:
        return null;
    }
  };

  const config = getBadgeConfig();
  if (!config) return null;

  const Icon = config.icon;

  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border whitespace-nowrap shrink-0",
      config.classes,
      className
    )}>
      <Icon className="w-3.5 h-3.5 shrink-0" /> 
      {config.label}
    </span>
  );
};