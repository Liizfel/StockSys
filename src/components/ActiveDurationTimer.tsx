import React, { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';

interface ActiveDurationTimerProps {
  startDate: string;
}

export function ActiveDurationTimer({ startDate }: ActiveDurationTimerProps) {
  const [elapsed, setElapsed] = useState('');

  useEffect(() => {
    const calculate = () => {
      const start = new Date(startDate).getTime();
      const now = Date.now();
      const diff = Math.max(0, now - start);

      const days = Math.floor(diff / (24 * 60 * 60 * 1000));
      const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
      const minutes = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));
      const seconds = Math.floor((diff % (60 * 1000)) / 1000);

      const parts = [];
      if (days > 0) {
        parts.push(`${days}d`);
      }
      if (hours > 0 || days > 0) {
        parts.push(`${hours}h`);
      }
      parts.push(`${minutes}m`);
      parts.push(`${seconds}s`);

      setElapsed(parts.join(' '));
    };

    calculate();
    const interval = setInterval(calculate, 1000);
    return () => clearInterval(interval);
  }, [startDate]);

  return (
    <span className="font-mono text-xs font-semibold bg-secondary text-secondary-foreground border border-border/80 px-2.5 py-1 rounded-xl inline-flex items-center gap-1.5 shrink-0 select-none">
      <Clock className="w-3.5 h-3.5 text-muted-foreground" />
      {elapsed}
    </span>
  );
}
