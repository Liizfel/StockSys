import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatUnit(unit?: string): string {
  if (!unit) return 'un';
  const mapping: Record<string, string> = {
    'unidade': 'un',
    'pacote': 'pct',
    'caixa': 'cx',
    'palete': 'plt',
    'kg': 'kg',
    'l': 'l',
    'un': 'un',
    'pct': 'pct',
    'cx': 'cx',
    'plt': 'plt',
  };
  return mapping[unit.toLowerCase()] || unit;
}

