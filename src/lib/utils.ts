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

export function getWhatsAppShareUrl(text: string): string {
  const encoded = encodeURIComponent(text);
  const isMobile = typeof window !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  if (isMobile) {
    return `whatsapp://send?text=${encoded}`;
  } else {
    return `https://api.whatsapp.com/send?text=${encoded}`;
  }
}

export function getTelegramShareUrl(text: string): string {
  const encoded = encodeURIComponent(text);
  const isMobile = typeof window !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  if (isMobile) {
    return `tg://msg?text=${encoded}`;
  } else {
    return `https://t.me/share/url?url=&text=${encoded}`;
  }
}

