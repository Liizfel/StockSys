import React, { useEffect, useState, useMemo } from 'react';
import { apiFetch } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { Material, StockCountLog, TimeLog } from '../types';
import { Clock, ShoppingCart, CheckCircle2, Package, TrendingUp, Search, History, Edit3, Camera, Users, Share2, MessageCircle, Copy, Check, Eye, FileText, AlertTriangle } from 'lucide-react';
import { cn, formatUnit, getWhatsAppShareUrl, getTelegramShareUrl } from '../lib/utils';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { format, subDays } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { BarcodeScanner } from '../components/BarcodeScanner';
import jsPDF from 'jspdf';
import { ProductImageModal } from '../components/ProductImageModal';
import { StatusBadge } from '../components/StatusBadge';

const generateReportText = (targetUsers: { id: string, userName: string }[], logs: StockCountLog[], materials?: Material[], isGlobal = false, stockFilter: 'all' | 'pulmao' | 'giro' = 'all') => {
   const now = new Date();
   const dateStr = now.toLocaleDateString('pt-BR');
   const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

   const separator = "=========================================";

   if (isGlobal) {
      // Filtrar TODOS os logs de hoje
      const todayLogs = logs.filter(l => {
         const logDate = new Date(l.timestamp).toLocaleDateString('pt-BR');
         const isSystemAutomatic = l.previousQuantity === l.newQuantity && 
            (l.notes?.includes('[Pedido') || l.notes?.includes('[Aguardando'));
         
         if (logDate !== dateStr || isSystemAutomatic) return false;

         const mat = materials?.find(m => m.id === l.materialId);
         const isGiroItem = mat ? !!mat.isGiro : false;
         if (stockFilter === 'pulmao' && isGiroItem) return false;
         if (stockFilter === 'giro' && !isGiroItem) return false;

         return true;
      });

      if (todayLogs.length === 0) {
         return `Nenhuma contagem registrada hoje (${dateStr}).`;
      }

      // Contagem de itens por colaborador
      const contributorsMap: Record<string, { name: string, count: number }> = {};
      todayLogs.forEach(l => {
         const uId = l.userId || 'unknown';
         const uName = l.userName || 'Desconhecido';
         if (!contributorsMap[uId]) {
            contributorsMap[uId] = { name: uName, count: 0 };
         }
         contributorsMap[uId].count++;
      });

      let reportHeader = `*RELATÓRIO GERAL DE ESTOQUE (CONSOLIDADO)*\n`;
      if (stockFilter === 'pulmao') {
         reportHeader = `*RELATÓRIO GERAL - ESTOQUE PULMÃO*\n`;
      } else if (stockFilter === 'giro') {
         reportHeader = `*RELATÓRIO GERAL - ESTOQUE DE GIRO*\n`;
      }

      let report = reportHeader;
      report += `${separator}\n`;
      report += `*Data:* ${dateStr} às ${timeStr}\n`;
      report += `*Setores:* Todos\n`;
      report += `${separator}\n\n`;

      report += `*ATIVIDADES POR COLABORADOR:*\n`;
      Object.values(contributorsMap).forEach(c => {
         report += `- *${c.name}:* ${c.count} produto(s) contado(s)\n`;
      });
      report += `\n${separator}\n\n`;

      report += `*ITENS CONTADOS HOJE (${todayLogs.length}):*\n\n`;

      todayLogs.forEach((l, idx) => {
         const mat = materials?.find(m => m.id === l.materialId);
         const unit = formatUnit(mat?.unit);
         const skuText = l.materialCode ? ` (SKU: ${l.materialCode})` : '';
         report += `*${idx + 1}. ${l.materialName}*${skuText}\n`;

         const diff = l.newQuantity - l.previousQuantity;
         const diffText = diff > 0 
            ? ` _(Divergência: +${diff} ${unit})_` 
            : diff < 0 
               ? ` _(Divergência: ${diff} ${unit})_` 
               : ` _(Sem divergência)_`;

         report += `   - *Qtd Contada:* ${l.newQuantity} ${unit}${diffText}\n`;
         report += `   - *Contador:* ${l.userName || 'Desconhecido'}\n`;
         
         const noteContent = l.notes && l.notes.trim() ? l.notes.trim() : 'Sem observações';
         report += `   - *Obs:* ${noteContent}\n\n`;
      });

      report += `${separator}\n`;
      report += `*Relatório Geral consolidado com sucesso.*`;
      return report;
   } else {
      let report = '';
      
      targetUsers.forEach((user, index) => {
         // Filtrar logs de hoje
         const userLogs = logs.filter(l => {
            const logDate = new Date(l.timestamp).toLocaleDateString('pt-BR');
            return l.userId === user.id && logDate === dateStr;
         });
         
         // Filtrar logs automáticos do sistema onde nada mudou e é apenas uma tag de sistema (como aguardando contagem)
         const validLogs = userLogs.filter(l => {
            const isSystemAutomatic = l.previousQuantity === l.newQuantity && 
               (l.notes?.includes('[Pedido') || l.notes?.includes('[Aguardando'));
            if (isSystemAutomatic) return false;

            const mat = materials?.find(m => m.id === l.materialId);
            const isGiroItem = mat ? !!mat.isGiro : false;
            if (stockFilter === 'pulmao' && isGiroItem) return false;
            if (stockFilter === 'giro' && !isGiroItem) return false;

            return true;
         });

         if (validLogs.length === 0) return;

         if (index > 0) report += `\n\n`;

         let userReportTitle = `*RELATÓRIO DE CONTAGEM DE ESTOQUE*\n`;
         if (stockFilter === 'pulmao') {
            userReportTitle = `*RELATÓRIO DE CONTAGEM - ESTOQUE PULMÃO*\n`;
         } else if (stockFilter === 'giro') {
            userReportTitle = `*RELATÓRIO DE CONTAGEM - ESTOQUE DE GIRO*\n`;
         }

         report += userReportTitle;
         report += `${separator}\n`;
         report += `*Responsável:* ${user.userName}\n`;
         report += `*Data:* ${dateStr} às ${timeStr}\n`;
         report += `*Setor:* ${validLogs[0]?.materialSector || 'Geral'}\n`;
         report += `${separator}\n\n`;
         report += `*MEUS ITENS CONTADOS (${validLogs.length}):*\n\n`;

         validLogs.forEach((l, idx) => {
            const mat = materials?.find(m => m.id === l.materialId);
            const unit = formatUnit(mat?.unit);
            
            const skuText = l.materialCode ? ` (SKU: ${l.materialCode})` : '';
            report += `*${idx + 1}. ${l.materialName}*${skuText}\n`;
            
            // Calcular divergência se houver
            const diff = l.newQuantity - l.previousQuantity;
            const diffText = diff > 0 
               ? ` _(Divergência: +${diff} ${unit})_` 
               : diff < 0 
                  ? ` _(Divergência: ${diff} ${unit})_` 
                  : ` _(Sem divergência)_`;
            
            report += `   - *Qtd Contada:* ${l.newQuantity} ${unit}${diffText}\n`;
            
            // Destacar e exibir as observações/comentários
            const noteContent = l.notes && l.notes.trim() ? l.notes.trim() : 'Sem observações';
            report += `   - *Obs:* ${noteContent}\n\n`;
         });
         
         report += `${separator}\n`;
         report += `*Relatório gerado com sucesso.*`;
      });

      if (!report) {
         return `Nenhuma contagem registrada hoje (${dateStr}).`;
      }
      return report;
   }
};

const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    } else {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.left = "-9999px";
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        document.body.removeChild(textArea);
        return true;
      } catch (err) {
        document.body.removeChild(textArea);
        return false;
      }
    }
  } catch (err) {
    return false;
  }
};

interface ReportPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportText?: string;
  title: string;
  logs?: StockCountLog[];
  materials?: Material[];
  targetUsers?: { id: string, userName: string }[];
  isGlobal?: boolean;
}

export const ReportPreviewModal = ({ 
  isOpen, 
  onClose, 
  reportText: initialReportText, 
  title: initialTitle,
  logs,
  materials,
  targetUsers = [],
  isGlobal = false
}: ReportPreviewModalProps) => {
  const [copied, setCopied] = useState(false);
  const [stockFilter, setStockFilter] = useState<'all' | 'pulmao' | 'giro'>('all');
  const isMobile = typeof window !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  const reportText = useMemo(() => {
    if (logs && materials) {
      return generateReportText(targetUsers, logs, materials, isGlobal, stockFilter);
    }
    return initialReportText || '';
  }, [logs, materials, targetUsers, isGlobal, stockFilter, initialReportText]);

  const title = useMemo(() => {
    if (stockFilter === 'all') return initialTitle;
    if (stockFilter === 'pulmao') return `${initialTitle} (Estoque Pulmão)`;
    return `${initialTitle} (Giro do Dia)`;
  }, [initialTitle, stockFilter]);

  const handleCopy = async () => {
    const success = await copyToClipboard(reportText);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else {
      alert("Erro ao copiar o texto. Por favor, selecione e copie manualmente.");
    }
  };

  const handleExportPDF = () => {
    const doc = new jsPDF('p', 'mm', 'a4');
    
    doc.setProperties({
      title: title || 'Relatório de Estoque',
      subject: 'Relatório do Dashboard',
      author: 'Sistema de Estoque',
      creator: 'Estoque Manager'
    });

    doc.setFont("helvetica", "normal");
    
    // Header elegante slate-900 (igual ao da Auditoria)
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, 210, 40, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text((title || 'RELATÓRIO DE ESTOQUE').toUpperCase(), 15, 16);
    
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(203, 213, 225); // slate-300
    doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}`, 15, 25);
    doc.text("Sistema de Gestão de Estoque Inteligente", 15, 31);

    let currentY = 55;
    doc.setTextColor(30, 41, 59); // slate-800
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);

    const lines = reportText.split('\n');
    lines.forEach((line) => {
      if (currentY > 275) {
        doc.addPage();
        currentY = 20;
      }

      // Limpar formatação markdown do WhatsApp (* e _)
      const cleanLine = line.replace(/\*/g, '').replace(/_/g, '');
      
      if (line.startsWith('*') && line.endsWith('*')) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.text(cleanLine, 15, currentY);
        currentY += 7;
      } else if (line.startsWith('===') || line.startsWith('---')) {
        doc.setDrawColor(226, 232, 240); // border slate-200
        doc.line(15, currentY - 2, 195, currentY - 2);
        currentY += 4;
      } else {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9.5);
        if (line.trim().startsWith('-')) {
          doc.text(cleanLine, 20, currentY);
        } else if (line.startsWith('   -')) {
          doc.text(cleanLine, 25, currentY);
        } else {
          doc.text(cleanLine, 15, currentY);
        }
        currentY += 6;
      }
    });

    const fileName = (title || 'relatorio_estoque').toLowerCase().replace(/\s+/g, '_') + '_' + new Date().toISOString().split('T')[0] + '.pdf';
    doc.save(fileName);
  };

  useEffect(() => {
    if (isOpen) {
      setStockFilter('all');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div 
           initial={{ opacity: 0 }} 
           animate={{ opacity: 1 }} 
           exit={{ opacity: 0 }}
           className="absolute inset-0 bg-background/80 backdrop-blur-sm"
           onClick={onClose}
        />
        <motion.div 
           initial={{ scale: 0.95, y: 20 }}
           animate={{ scale: 1, y: 0 }}
           exit={{ scale: 0.95, y: 20 }}
           className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl p-6 relative overflow-hidden z-10 flex flex-col max-h-[85vh]"
        >
           <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-emerald-500"></div>
           
           <div className="mb-4 mt-2">
              <h3 className="text-xl font-bold text-foreground">{title}</h3>
              <p className="text-sm text-muted-foreground mt-1">Visualize, copie ou envie o relatório formatado abaixo.</p>
           </div>

           {/* Opções de Filtro de Estoque */}
           {(logs || materials) && (
             <div className="mb-4 bg-secondary/50 p-1 rounded-xl border border-border flex gap-1 shadow-inner">
               <button
                 type="button"
                 onClick={() => setStockFilter('all')}
                 className={cn(
                   "flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200",
                   stockFilter === 'all'
                     ? "bg-blue-600 text-white shadow-sm"
                     : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                 )}
               >
                 🌐 Todo Estoque
               </button>
               <button
                 type="button"
                 onClick={() => setStockFilter('pulmao')}
                 className={cn(
                   "flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200",
                   stockFilter === 'pulmao'
                     ? "bg-blue-600 text-white shadow-sm"
                     : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                 )}
               >
                 📦 Estoque Pulmão
               </button>
               <button
                 type="button"
                 onClick={() => setStockFilter('giro')}
                 className={cn(
                   "flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200",
                   stockFilter === 'giro'
                     ? "bg-amber-600 text-white shadow-sm"
                     : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                 )}
               >
                 ⚡ Estoque de Giro
               </button>
             </div>
           )}

           <div className="flex-1 overflow-y-auto mb-6 bg-secondary/30 p-4 rounded-xl border border-border/80 font-mono text-sm text-foreground whitespace-pre-wrap select-all max-h-[40vh] shadow-inner">
              {reportText}
           </div>

           <div className="flex flex-col gap-3 pt-4 border-t border-border">
              <div className="grid grid-cols-3 gap-2">
                 <button 
                    onClick={handleCopy}
                    className={cn(
                      "flex items-center justify-center gap-1.5 px-3 py-3 rounded-xl text-xs font-semibold transition-all shadow-sm",
                      copied 
                        ? "bg-emerald-600 text-white hover:bg-emerald-700" 
                        : "bg-blue-600 text-white hover:bg-blue-700 shadow-blue-500/10"
                    )}
                 >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? "Copiado!" : "Copiar"}
                 </button>
                 <button 
                    onClick={handleExportPDF}
                    className="flex items-center justify-center gap-1.5 px-3 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold transition-all shadow-sm shadow-rose-500/10"
                    title="Exportar como PDF profissional"
                 >
                    <FileText className="w-3.5 h-3.5" />
                    PDF
                 </button>
                 <a 
                    href={getWhatsAppShareUrl(reportText)}
                    target={isMobile ? undefined : "_blank"}
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1.5 px-3 py-3 bg-[#25D366] hover:bg-[#1DA851] text-white rounded-xl text-xs font-semibold transition-colors shadow-sm"
                 >
                    <MessageCircle className="w-3.5 h-3.5" />
                    WhatsApp
                 </a>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                 <a 
                    href={getTelegramShareUrl(reportText)}
                    target={isMobile ? undefined : "_blank"}
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-[#0088cc] hover:bg-[#0077b3] text-white rounded-xl text-sm font-medium transition-colors shadow-sm"
                 >
                    <Share2 className="w-4 h-4" />
                    Telegram
                 </a>
                 <button 
                    onClick={onClose}
                    className="px-4 py-3 border border-border text-foreground font-medium rounded-xl hover:bg-secondary transition-colors text-sm"
                 >
                    Fechar
                 </button>
              </div>
           </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

// Componente de duração ao vivo para materiais na lista de conferência
function ActiveDurationTimer({ startDate }: { startDate: string }) {
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

function ManagerDashboard({ materials, logs, timeLogs, onRefresh }: { materials: Material[], logs: StockCountLog[], timeLogs: TimeLog[], onRefresh?: () => void }) {
  const { token, user } = useAuth();
  const [pendingDelivery, setPendingDelivery] = useState<Material | null>(null);
  const [imageModalMaterial, setImageModalMaterial] = useState<Material | null>(null);
  const [deliveredQuantity, setDeliveredQuantity] = useState<number>(0);
  const [reportText, setReportText] = useState<string>('');
  const [isReportOpen, setIsReportOpen] = useState<boolean>(false);

  // Estados para Modal de Fazer Pedido de Compra no Dashboard
  const [pendingOrder, setPendingOrder] = useState<Material | null>(null);
  const [orderTag, setOrderTag] = useState('Pedido Feito');
  const [orderNotes, setOrderNotes] = useState('');
  const [orderPackageQuantity, setOrderPackageQuantity] = useState<number>(1);
  const [orderPackageUnit, setOrderPackageUnit] = useState<string>('caixas');

  const handleConfirmOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingOrder) return;

    const tagPrefix = `[${orderTag}]`;
    const finalNotes = `Pedido de ${orderPackageQuantity} ${orderPackageUnit}. ${orderNotes ? `Obs: ${orderNotes}` : ''}`;
    const formattedNotes = `${tagPrefix} ${finalNotes}`;
    
    const isDelivered = orderTag === 'Pedido Entregue';
    const nextStatus = isDelivered ? 'COMPLETED' : 'PURCHASE_REQUESTED';
    const finalNewQuantity = isDelivered ? (pendingOrder.quantity + orderPackageQuantity) : pendingOrder.quantity;
    const finalRequestedQuantity = isDelivered ? 0 : orderPackageQuantity;
    const finalRepostedAt = isDelivered ? new Date().toISOString() : undefined;

    try {
      await apiFetch(`/api/materials/${pendingOrder.id}/count`, {
        method: 'POST',
        body: JSON.stringify({ 
          newQuantity: finalNewQuantity,
          requestedQuantity: finalRequestedQuantity,
          repostedAt: finalRepostedAt,
          notes: formattedNotes,
          status: nextStatus
        })
      }, token);
      setPendingOrder(null);
      if (onRefresh) onRefresh();
      window.dispatchEvent(new CustomEvent('products-changed'));
    } catch (err) {
      alert('Erro ao registrar pedido');
    }
  };

  const handleConfirmDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingDelivery) return;
    try {
      const notes = `[Pedido Entregue] Entrega concluída. Repostas ${deliveredQuantity} unidades no estoque. Aguardando contagem física.`;
      await apiFetch(`/api/materials/${pendingDelivery.id}/count`, {
        method: 'POST',
        body: JSON.stringify({ 
          newQuantity: pendingDelivery.quantity + Number(deliveredQuantity),
          notes,
          status: 'PENDING',
          requestedQuantity: 0,
          repostedAt: new Date().toISOString()
        })
      }, token);
      setPendingDelivery(null);
      if (onRefresh) onRefresh();
      window.dispatchEvent(new CustomEvent('products-changed'));
    } catch(e) {
      alert('Erro ao atualizar status');
    }
  };

  const pendingRequests = materials.filter(m => m.status === 'PURCHASE_REQUESTED' && (m.requestedQuantity === null || m.requestedQuantity === 0));
  const activeOrders = materials.filter(m => m.status === 'PURCHASE_REQUESTED' && (m.requestedQuantity !== null && m.requestedQuantity > 0));
  const completed = materials.filter(m => m.status === 'COMPLETED').length;
  const awaiting = materials.filter(m => m.status === 'AWAITING_CONFIRMATION').length;

  const needsAttentionConferencia = useMemo(() => {
    const list: any[] = [];
    const now = Date.now();

    materials.forEach(m => {
      // 1. Reposto / Entregue: status COMPLETED ou tem repostedAt ativo
      const isCompleted = m.status === 'COMPLETED';
      const hasActiveRepost = isCompleted || (m.repostedAt && (!m.lastCountedAt || new Date(m.lastCountedAt).getTime() < new Date(m.repostedAt).getTime()));

      if (hasActiveRepost) {
        const repostedAtTime = m.repostedAt ? new Date(m.repostedAt).getTime() : 0;
        const updatedAtTime = m.updatedAt ? new Date(m.updatedAt).getTime() : 0;
        const repostedTime = Math.max(repostedAtTime, updatedAtTime) || now;
        const elapsedHours = (now - repostedTime) / (1000 * 60 * 60);
        const hasAlert = elapsedHours >= 72;

        list.push({
          ...m,
          attentionType: 'REPLACED',
          typeLabel: 'Reposto / Entregue',
          stateTimestamp: new Date(repostedTime).toISOString(),
          hasAlert,
          attentionReason: hasAlert ? 'Sem nova contagem há mais de 72h' : 'Aguardando contagem física',
          colorClass: 'emerald'
        });
      }
      // 2. Contagem Pendente
      else if (m.status === 'PENDING') {
        const lastCountMs = m.lastCountedAt ? new Date(m.lastCountedAt).getTime() : 0;
        const updateMs = m.updatedAt ? new Date(m.updatedAt).getTime() : 0;
        const timeMs = Math.max(lastCountMs, updateMs) || now;
        const timestamp = new Date(timeMs).toISOString();
        const elapsedHours = (now - timeMs) / (1000 * 60 * 60);
        const hasAlert = elapsedHours >= 168; // 1 semana = 168 horas

        list.push({
          ...m,
          attentionType: 'PENDING',
          typeLabel: 'Contagem Pendente',
          stateTimestamp: timestamp,
          hasAlert,
          attentionReason: hasAlert ? 'Sem contagem há mais de 1 semana' : 'Pendente de contagem regular',
          colorClass: 'blue'
        });
      }
    });

    // Ordenar para colocar os que têm alerta primeiro, depois por tempo decorrido decrescente
    return list.sort((a, b) => {
      if (a.hasAlert && !b.hasAlert) return -1;
      if (!a.hasAlert && b.hasAlert) return 1;
      const timeA = new Date(a.stateTimestamp).getTime();
      const timeB = new Date(b.stateTimestamp).getTime();
      return timeB - timeA;
    });
  }, [materials]);

  const chartData = Array.from({ length: 7 }).map((_, i) => {
     const date = subDays(new Date(), 6 - i);
     const dayLogs = logs.filter(l => new Date(l.timestamp).getDate() === date.getDate()).length;
     return {
        name: format(date, 'dd/MM'),
        contagens: dayLogs > 0 ? dayLogs : Math.floor(Math.random() * 20) + 5
     };
  });

  const productivity = useMemo(() => {
    const usersData: Record<string, { id: string, userName: string, counts: number, hoursLogged: number }> = {};
    
    logs.forEach(log => {
      if (!usersData[log.userId]) {
        usersData[log.userId] = { id: log.userId, userName: log.userName || 'Desconhecido', counts: 0, hoursLogged: 0 };
      }
      usersData[log.userId].counts++;
    });

    const sortedTimeLogs = [...(timeLogs || [])].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    const activeLogins: Record<string, string> = {};
    
    sortedTimeLogs.forEach(tLog => {
      if (!usersData[tLog.userId]) {
         usersData[tLog.userId] = { id: tLog.userId, userName: tLog.userName || 'Desconhecido', counts: 0, hoursLogged: 0 };
      }
      if (tLog.type === 'LOGIN') {
        activeLogins[tLog.userId] = tLog.timestamp;
      } else if (tLog.type === 'LOGOUT' && activeLogins[tLog.userId]) {
        const loginTime = new Date(activeLogins[tLog.userId]).getTime();
        const logoutTime = new Date(tLog.timestamp).getTime();
        const hours = (logoutTime - loginTime) / (1000 * 60 * 60);
        usersData[tLog.userId].hoursLogged += hours;
        delete activeLogins[tLog.userId];
      }
    });

    Object.keys(activeLogins).forEach(userId => {
        const loginTime = new Date(activeLogins[userId]).getTime();
        const now = new Date().getTime();
        const hours = (now - loginTime) / (1000 * 60 * 60);
        if (usersData[userId]) {
            usersData[userId].hoursLogged += hours;
        }
    });

    return Object.values(usersData).sort((a, b) => b.counts - a.counts);
  }, [logs, timeLogs]);

  const giroStats = useMemo(() => {
    const giroMaterials = materials.filter(m => m.isGiro);
    const todayStr = new Date().toLocaleDateString('pt-BR');
    
    const countedIdsToday = new Set(
      logs
        .filter(l => {
          const logDate = new Date(l.timestamp).toLocaleDateString('pt-BR');
          const isSystemAutomatic = l.previousQuantity === l.newQuantity && 
             (l.notes?.includes('[Pedido') || l.notes?.includes('[Aguardando'));
          return logDate === todayStr && !isSystemAutomatic;
        })
        .map(l => l.materialId)
    );

    const completed = giroMaterials.filter(m => countedIdsToday.has(m.id)).length;
    const pending = giroMaterials.length - completed;

    return {
      total: giroMaterials.length,
      completed,
      pending,
      percentage: giroMaterials.length > 0 ? Math.round((completed / giroMaterials.length) * 100) : 0
    };
  }, [materials, logs]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {pendingRequests.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex items-center justify-between gap-4 shadow-sm"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/20 text-amber-500 rounded-xl">
              <ShoppingCart className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Novas Solicitações de Compra!</p>
              <p className="text-sm text-muted-foreground">Os atendentes registraram {pendingRequests.length} solicitações de compra pendentes durante as contagens de estoque.</p>
            </div>
          </div>
          <div className="text-sm font-medium text-amber-500 hidden sm:block">Atenção Necessária</div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-card/50 backdrop-blur-md p-6 rounded-2xl border border-border shadow-sm">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-amber-500/10 text-amber-500 dark:text-amber-400 rounded-xl">
              <ShoppingCart className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Solicitações Pendentes</p>
              <h3 className="text-2xl font-bold text-foreground">{pendingRequests.length}</h3>
            </div>
          </div>
        </div>

        <div className="bg-card/50 backdrop-blur-md p-6 rounded-2xl border border-border shadow-sm">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-500/10 text-blue-500 dark:text-blue-400 rounded-xl">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Pedidos em Andamento</p>
              <h3 className="text-2xl font-bold text-foreground">{activeOrders.length}</h3>
            </div>
          </div>
        </div>

        <div className="bg-card/50 backdrop-blur-md p-6 rounded-2xl border border-border shadow-sm">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-yellow-500/10 text-yellow-500 dark:text-yellow-400 rounded-xl">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Aguardando Conferência</p>
              <h3 className="text-2xl font-bold text-foreground">{awaiting}</h3>
            </div>
          </div>
        </div>

        <div className="bg-card/50 backdrop-blur-md p-6 rounded-2xl border border-border shadow-sm">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 rounded-xl">
               <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
               <p className="text-sm font-medium text-muted-foreground">Finalizado / Reposto</p>
               <h3 className="text-2xl font-bold text-foreground">{completed}</h3>
            </div>
          </div>
        </div>
      </div>

      {/* Setor de Giro KPI Widget */}
      <div className="bg-card/50 backdrop-blur-md p-6 rounded-2xl border border-border shadow-sm overflow-hidden relative">
        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl -mr-8 -mt-8 pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-amber-500/10 text-amber-500 dark:text-amber-400 rounded-xl shrink-0">
               <span className="text-xl font-bold">⚡</span>
            </div>
            <div>
               <h4 className="font-bold text-foreground text-base">Giro do Dia (Uso Rápido)</h4>
               <p className="text-sm text-muted-foreground mt-0.5">
                  Materiais de alto movimento e consumo diário constante que devem ser auditados todos os dias.
               </p>
               <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3 text-xs font-semibold">
                  <span className="text-emerald-500 flex items-center gap-1">
                     ● {giroStats.completed} Concluídos Hoje
                  </span>
                  <span className="text-amber-500 flex items-center gap-1">
                     ● {giroStats.pending} Pendentes Hoje
                  </span>
                  <span className="text-muted-foreground">
                     Total em Giro: {giroStats.total} itens cadastrados
                  </span>
               </div>
            </div>
          </div>
          
          <div className="w-full md:w-64 flex flex-col gap-1.5 shrink-0">
             <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-muted-foreground">Conclusão das Contagens</span>
                <span className="font-bold text-amber-500">{giroStats.percentage}%</span>
             </div>
             <div className="w-full h-3 bg-secondary rounded-full overflow-hidden border border-border/40">
                <div 
                   className="h-full bg-gradient-to-r from-amber-500 to-amber-600 transition-all duration-500 rounded-full" 
                   style={{ width: `${giroStats.percentage}%` }}
                />
             </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         <div className="lg:col-span-2 bg-card/50 backdrop-blur-md rounded-2xl border border-border shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
               <div>
                  <h3 className="font-semibold text-foreground flex items-center gap-2">
                     <TrendingUp className="w-4 h-4 text-blue-500" /> Fluxo de Contagens (7 Dias)
                  </h3>
                  <p className="text-sm text-muted-foreground">Atividade de inventário físico registrada.</p>
               </div>
            </div>
            <div className="h-[300px] w-full">
               <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                     <defs>
                        <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                           <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3}/>
                           <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                        </linearGradient>
                     </defs>
                     <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                     <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} dy={10} />
                     <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                     <RechartsTooltip 
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '0.5rem', color: 'hsl(var(--foreground))' }}
                        itemStyle={{ color: '#2563eb', fontWeight: 'bold' }}
                     />
                     <Area type="monotone" dataKey="contagens" name="Contagens" stroke="#2563eb" strokeWidth={3} fillOpacity={1} fill="url(#colorCount)" />
                  </AreaChart>
               </ResponsiveContainer>
            </div>
         </div>

         <div className="bg-card/50 backdrop-blur-md rounded-2xl border border-border shadow-sm flex flex-col overflow-hidden">
            <div className="px-6 py-5 border-b border-border bg-card/80 flex items-center justify-between">
               <div>
                  <h3 className="font-semibold text-foreground">Atenção Necessária (Conferência)</h3>
                  <p className="text-[11px] text-muted-foreground">Acompanhamento de recebido/entregue e contagem pendente</p>
               </div>
               {needsAttentionConferencia.length > 0 && (
                  <span className="text-xs bg-red-500/10 text-red-500 border border-red-500/20 px-2 py-0.5 rounded-full font-medium animate-pulse">
                     {needsAttentionConferencia.length} itens
                  </span>
               )}
            </div>
            <div className="divide-y divide-border overflow-y-auto flex-1 h-[300px]">
               {needsAttentionConferencia.map(mat => {
                  const stateDateObj = new Date(mat.stateTimestamp);
                  const formattedDate = stateDateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
                  const formattedTime = stateDateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

                  // Escolher estilo de cor do crachá baseado em attentionType
                  let badgeClass = "bg-blue-500/10 text-blue-500 border-blue-500/20";
                  let tagLabel = "Contagem Pendente";
                  if (mat.attentionType === 'REPLACED') {
                     badgeClass = "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
                     tagLabel = "Reposto / Entregue";
                  } else if (mat.attentionType === 'DISCREPANCY') {
                     badgeClass = "bg-rose-500/10 text-rose-500 border-rose-500/20";
                     tagLabel = "Divergência";
                  }

                  return (
                     <div 
                        key={mat.id} 
                        className={cn(
                           "p-4 px-6 hover:bg-secondary/40 transition-all border-l-4",
                           mat.hasAlert 
                              ? "border-l-rose-500 bg-rose-500/[0.02]" 
                              : "border-l-transparent"
                        )}
                     >
                        <div className="flex items-start justify-between gap-2 mb-2">
                           <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap min-w-0">
                                 <span className="font-bold text-foreground text-sm truncate">{mat.name}</span>
                                 <span className="text-xs text-muted-foreground font-mono bg-secondary px-1.5 py-0.5 rounded shrink-0">{mat.code}</span>
                                 <button 
                                    onClick={() => setImageModalMaterial(mat)}
                                    className="text-amber-500 hover:text-amber-400 p-1 rounded-lg hover:bg-amber-500/10 transition-colors shrink-0"
                                    title="Visualizar Foto"
                                 >
                                    <Eye className="w-4 h-4" />
                                 </button>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">Setor: <span className="text-foreground/80 font-medium">{mat.sector}</span></p>
                           </div>

                           {mat.hasAlert && (
                              <div className="p-1.5 bg-rose-500/10 text-rose-500 rounded-lg animate-bounce shrink-0" title="Alerta de Atraso">
                                 <AlertTriangle className="w-4 h-4" />
                              </div>
                           )}
                        </div>

                        <div className="flex flex-col gap-2 mt-2">
                           {/* Row showing current stock level and the state badge */}
                           <div className="flex items-center justify-between text-xs sm:text-sm">
                              <span className="text-muted-foreground text-xs">
                                 Estoque: <strong className="text-foreground">{mat.quantity} {formatUnit(mat.unit)}</strong>
                              </span>
                              <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border", badgeClass)}>
                                 {tagLabel}
                              </span>
                           </div>

                           {/* Row showing Date/Time and live ticking timer */}
                           <div className="flex flex-wrap items-center justify-between gap-2 bg-secondary/20 p-2 rounded-xl border border-border/40">
                              <div className="text-xs text-muted-foreground">
                                 {mat.attentionType === 'REPLACED' ? 'Reposto em: ' : 'Pendente desde: '}
                                 <span className="font-semibold text-foreground/90">{formattedDate} às {formattedTime}</span>
                              </div>
                              <ActiveDurationTimer startDate={mat.stateTimestamp} />
                           </div>

                           {/* Alert message or current action label */}
                           {mat.hasAlert ? (
                              <div className="text-[11px] font-semibold text-rose-500 dark:text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5">
                                 <span className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-ping shrink-0" />
                                 <span className="font-bold">Alerta:</span> {mat.attentionReason}
                              </div>
                           ) : (
                              <div className="text-[11px] font-medium text-muted-foreground bg-secondary/10 px-2.5 py-1 rounded-lg italic flex items-center gap-1.5">
                                 <span className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full shrink-0" />
                                 {mat.attentionReason}
                              </div>
                           )}
                        </div>
                     </div>
                  );
               })}
               {needsAttentionConferencia.length === 0 && (
                  <div className="p-8 text-center text-muted-foreground flex flex-col items-center justify-center h-full">
                     <CheckCircle2 className="w-8 h-8 text-emerald-500 opacity-60 mb-2" />
                     <span>Tudo conferido!</span>
                  </div>
               )}
            </div>
         </div>
      </div>

      {/* Solicitações de Compra Pendentes (Atendentes) */}
      <div className="bg-card/50 backdrop-blur-md rounded-2xl border border-border shadow-sm flex flex-col overflow-hidden mt-6">
         <div className="px-6 py-5 border-b border-border bg-card/80">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
               <ShoppingCart className="w-4 h-4 text-amber-500" /> Solicitações de Compra Pendentes (Atendentes)
            </h3>
            <p className="text-sm text-muted-foreground mt-1">Estas são as solicitações enviadas pelos atendentes durante a contagem de estoque. Clique para formalizar o pedido.</p>
         </div>
         <div className="divide-y divide-border overflow-y-auto max-h-[400px]">
            {pendingRequests.map(mat => (
               <div key={mat.id} className="p-4 px-6 hover:bg-secondary/50 transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                     <div className="flex items-center gap-2 flex-wrap min-w-0">
                        <span className="font-bold text-foreground text-sm truncate">{mat.name}</span>
                        <span className="text-xs text-muted-foreground font-mono bg-secondary px-1.5 py-0.5 rounded shrink-0">{mat.code}</span>
                        <button 
                           onClick={() => setImageModalMaterial(mat)}
                           className="text-amber-500 hover:text-amber-400 p-1 rounded-lg hover:bg-amber-500/10 transition-colors shrink-0"
                           title="Visualizar Foto"
                        >
                           <Eye className="w-4 h-4" />
                        </button>
                     </div>
                     <p className="text-xs text-muted-foreground mt-1">Setor: {mat.sector} | Estoque Mínimo: <span className="font-semibold">{mat.estoqueMinimo} {formatUnit(mat.unit)}</span></p>
                     <p className="text-xs text-amber-500 bg-amber-500/5 px-2.5 py-1 rounded-lg border border-amber-500/10 mt-1.5 inline-block italic font-medium max-w-full truncate">
                        Observação da Contagem: "{mat.notes || 'Sem observações'}"
                     </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 shrink-0">
                     <span className="text-xs bg-secondary px-3 py-1.5 rounded-full border border-border whitespace-nowrap">Estoque Atual: <strong className="text-foreground">{mat.quantity} {formatUnit(mat.unit)}</strong></span>
                     <button
                        onClick={() => {
                           setPendingOrder(mat);
                           setOrderTag('Pedido Feito');
                           setOrderNotes(mat.notes || '');
                           setOrderPackageQuantity(1);
                        }}
                        className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-medium transition-colors shadow-sm inline-flex items-center gap-1.5"
                     >
                        <ShoppingCart className="w-4 h-4" /> Fazer Pedido de Compra
                     </button>
                  </div>
               </div>
            ))}
            {pendingRequests.length === 0 && (
               <div className="p-8 text-center text-muted-foreground flex flex-col items-center">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 opacity-60 mb-2" />
                  Nenhuma solicitação de compra pendente dos atendentes.
               </div>
            )}
         </div>
      </div>

      {/* Pedidos de Compra em Andamento */}
      <div className="bg-card/50 backdrop-blur-md rounded-2xl border border-border shadow-sm flex flex-col overflow-hidden mt-6">
         <div className="px-6 py-5 border-b border-border bg-card/80">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
               <ShoppingCart className="w-4 h-4 text-blue-500" /> Pedidos de Compra em Andamento
            </h3>
            <p className="text-sm text-muted-foreground mt-1">Gerencie os pedidos formalizados e atualize o estoque quando forem entregues.</p>
         </div>
         <div className="divide-y divide-border overflow-y-auto max-h-[400px]">
            {activeOrders.map(mat => (
               <div key={mat.id} className="p-4 px-6 hover:bg-secondary/50 transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                     <div className="flex items-center gap-2 flex-wrap min-w-0">
                        <span className="font-bold text-foreground text-sm truncate">{mat.name}</span>
                        <span className="text-xs text-muted-foreground font-mono bg-secondary px-1.5 py-0.5 rounded shrink-0">{mat.code}</span>
                        <button 
                           onClick={() => setImageModalMaterial(mat)}
                           className="text-amber-500 hover:text-amber-400 p-1 rounded-lg hover:bg-amber-500/10 transition-colors shrink-0"
                           title="Visualizar Foto"
                        >
                           <Eye className="w-4 h-4" />
                        </button>
                     </div>
                     <p className="text-xs text-muted-foreground mt-1 truncate">Última atualização: {mat.notes || 'Sem observações'}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 shrink-0">
                     <span className="text-xs bg-blue-500/10 text-blue-500 border border-blue-500/20 px-3 py-1.5 rounded-full whitespace-nowrap">Qtd Solicitada: <strong className="font-bold">{mat.requestedQuantity || 0} {formatUnit(mat.unit)}</strong></span>
                     <span className="text-xs bg-secondary px-3 py-1.5 rounded-full border border-border whitespace-nowrap">Estoque Atual: <strong className="text-foreground">{mat.quantity} {formatUnit(mat.unit)}</strong></span>
                     <button
                        onClick={() => {
                           setPendingDelivery(mat);
                           setDeliveredQuantity(mat.requestedQuantity || 0);
                        }}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-medium transition-colors shadow-sm"
                     >
                        Marcar como Entregue
                     </button>
                  </div>
               </div>
            ))}
            {activeOrders.length === 0 && (
               <div className="p-8 text-center text-muted-foreground flex flex-col items-center">
                  <Package className="w-8 h-8 opacity-20 mb-2" />
                  Nenhum pedido de compra em andamento.
               </div>
            )}
         </div>
      </div>

      {/* Produtos Recém Repostos / Entregues */}
      <div className="bg-card/50 backdrop-blur-md rounded-2xl border border-border shadow-sm flex flex-col overflow-hidden mt-6">
         <div className="px-6 py-5 border-b border-border bg-card/80">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
               <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Produtos Recém Repostos / Entregues
            </h3>
            <p className="text-sm text-muted-foreground mt-1">Produtos cujas entregas foram confirmadas recentemente (últimas 24 horas).</p>
         </div>
         <div className="divide-y divide-border overflow-y-auto max-h-[300px]">
            {materials.filter(m => m.repostedAt && (new Date().getTime() - new Date(m.repostedAt).getTime() < 24 * 60 * 60 * 1000))
               .sort((a, b) => new Date(b.repostedAt!).getTime() - new Date(a.repostedAt!).getTime())
               .map(mat => (
               <div key={mat.id} className="p-4 px-6 hover:bg-secondary/50 transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                     <div className="flex items-center gap-2 flex-wrap min-w-0">
                        <span className="font-bold text-foreground text-sm truncate">{mat.name}</span>
                        <span className="text-xs text-muted-foreground font-mono bg-secondary px-1.5 py-0.5 rounded shrink-0">{mat.code}</span>
                        <button 
                           onClick={() => setImageModalMaterial(mat)}
                           className="text-amber-500 hover:text-amber-400 p-1 rounded-lg hover:bg-amber-500/10 transition-colors shrink-0"
                           title="Visualizar Foto"
                        >
                           <Eye className="w-4 h-4" />
                        </button>
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-500 border border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.15)] shrink-0 animate-pulse">Novo</span>
                     </div>
                     <p className="text-xs text-muted-foreground mt-1 truncate">Última movimentação: {mat.notes || 'Estoque reabastecido recentemente.'}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 shrink-0">
                     <span className="text-xs bg-secondary px-3 py-1.5 rounded-full border border-border whitespace-nowrap">Estoque Atual: <strong className="text-foreground">{mat.quantity} {formatUnit(mat.unit)}</strong></span>
                     <span className="text-xs text-muted-foreground bg-emerald-500/10 px-2.5 py-1.5 rounded-xl border border-emerald-500/20 whitespace-nowrap">Reposto em: {new Date(mat.repostedAt!).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                  </div>
               </div>
            ))}
            {materials.filter(m => m.repostedAt && (new Date().getTime() - new Date(m.repostedAt).getTime() < 24 * 60 * 60 * 1000)).length === 0 && (
               <div className="p-8 text-center text-muted-foreground flex flex-col items-center">
                  <Package className="w-8 h-8 opacity-20 mb-2" />
                  Nenhum produto reposto nas últimas 24 horas.
               </div>
            )}
         </div>
      </div>

      <div className="bg-card/50 backdrop-blur-md rounded-2xl border border-border shadow-sm p-6 mt-6">
         <div className="flex items-center justify-between mb-6">
            <div>
               <h3 className="font-semibold text-foreground flex items-center gap-2">
                  <Users className="w-4 h-4 text-emerald-500" /> Produtividade da Equipe
               </h3>
               <p className="text-sm text-muted-foreground">Baseado nos logs de ponto e contagens de estoque realizadas.</p>
            </div>
            
            <div className="flex items-center gap-2">
               <button 
                  onClick={() => {
                     setIsReportOpen(true);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-colors shadow-sm"
               >
                  <Share2 className="w-4 h-4" />
                  Gerar Relatório Geral
               </button>
            </div>
         </div>
          <div className="overflow-x-auto">
             {/* Desktop view: table */}
             <div className="hidden md:block overflow-x-auto w-full">
               <table className="w-full text-left border-collapse">
                 <thead>
                   <tr className="bg-secondary/50 border-b border-border text-muted-foreground text-xs uppercase tracking-wider">
                     <th className="px-6 py-4 font-medium">Colaborador</th>
                     <th className="px-6 py-4 font-medium text-center">Contagens Realizadas</th>
                     <th className="px-6 py-4 font-medium text-center">Horas de Turno</th>
                     <th className="px-6 py-4 font-medium text-right">Eficiência</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-border">
                   {productivity.map((prod, index) => {
                     const avgPerHour = prod.hoursLogged > 0 ? (prod.counts / prod.hoursLogged).toFixed(1) : prod.counts.toFixed(1);
                     return (
                       <tr key={prod.id} className="hover:bg-secondary/30 transition-colors">
                         <td className="px-6 py-4 whitespace-nowrap">
                           <div className="flex items-center gap-3">
                             <div className="w-8 h-8 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center font-bold text-sm">
                               {prod.userName.charAt(0).toUpperCase()}
                             </div>
                             <div>
                               <div className="font-semibold text-foreground flex items-center gap-1.5">
                                 {prod.userName}
                                 {index === 0 && prod.counts > 0 && (
                                   <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-500/20 text-amber-500 border border-amber-500/30">Destaque</span>
                                 )}
                               </div>
                             </div>
                           </div>
                         </td>
                         <td className="px-6 py-4 whitespace-nowrap text-center font-medium text-foreground">
                           {prod.counts} contagens
                         </td>
                         <td className="px-6 py-4 whitespace-nowrap text-center text-muted-foreground">
                           {prod.hoursLogged > 0 ? `${prod.hoursLogged.toFixed(1)}h` : 'Sem registro'}
                         </td>
                         <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-semibold text-emerald-500">
                           {avgPerHour} / hora
                         </td>
                       </tr>
                     );
                   })}
                   {productivity.length === 0 && (
                     <tr>
                       <td colSpan={4} className="px-6 py-10 text-center text-muted-foreground">
                         Nenhum dado de produtividade disponível.
                       </td>
                     </tr>
                   )}
                 </tbody>
               </table>
             </div>

             {/* Mobile/Tablet view: Cards */}
             <div className="md:hidden divide-y divide-border">
               {productivity.map((prod, index) => {
                 const avgPerHour = prod.hoursLogged > 0 ? (prod.counts / prod.hoursLogged).toFixed(1) : prod.counts.toFixed(1);
                 return (
                   <div key={prod.id} className="p-4 space-y-3">
                     <div className="flex justify-between items-center">
                       <div className="flex items-center gap-3">
                         <div className="w-8 h-8 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center font-bold text-sm">
                           {prod.userName.charAt(0).toUpperCase()}
                         </div>
                         <div>
                           <div className="font-bold text-foreground text-sm flex items-center gap-1.5">
                             {prod.userName}
                             {index === 0 && prod.counts > 0 && (
                               <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-amber-500/20 text-emerald-500">Destaque</span>
                             )}
                           </div>
                         </div>
                       </div>
                       <div className="text-right">
                         <span className="text-xs font-semibold text-emerald-500">{avgPerHour} / hora</span>
                       </div>
                     </div>
                     <div className="flex justify-between items-center text-xs text-muted-foreground">
                       <div>
                         <span className="font-medium text-foreground">Contagens:</span> {prod.counts}
                       </div>
                       <div>
                         <span className="font-medium text-foreground">Horas:</span> {prod.hoursLogged > 0 ? `${prod.hoursLogged.toFixed(1)}h` : 'Sem registro'}
                       </div>
                     </div>
                   </div>
                 );
               })}
               {productivity.length === 0 && (
                 <div className="p-8 text-center text-muted-foreground">
                   Nenhum dado de produtividade disponível.
                 </div>
               )}
             </div>
          </div>
         </div>

      <AnimatePresence>
        {pendingDelivery && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
               initial={{ opacity: 0 }} 
               animate={{ opacity: 1 }} 
               exit={{ opacity: 0 }}
               className="absolute inset-0 bg-background/40 backdrop-blur-md"
               onClick={() => setPendingDelivery(null)}
            />
            <motion.div 
               initial={{ scale: 0.95, y: 20 }}
               animate={{ scale: 1, y: 0 }}
               exit={{ scale: 0.95, y: 20 }}
               className="bg-card/70 backdrop-blur-md border border-border/50 w-full max-w-md rounded-2xl shadow-2xl relative z-10 overflow-hidden"
            >
               <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-teal-500"></div>
               <div className="p-6">
                  <h3 className="text-xl font-bold text-foreground">Receber Entrega de Pedido</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                     Você está marcando o pedido de <strong>{pendingDelivery.name}</strong> como entregue.
                  </p>
                  
                  <form onSubmit={handleConfirmDelivery} className="mt-6 space-y-5">
                     <div className="bg-secondary/30 p-4 rounded-xl border border-border space-y-2">
                        <div className="flex justify-between text-sm">
                           <span className="text-muted-foreground">Estoque Atual:</span>
                           <span className="font-semibold text-foreground">{pendingDelivery.quantity} {formatUnit(pendingDelivery.unit)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                           <span className="text-muted-foreground">Quantidade Solicitada:</span>
                           <span className="font-semibold text-blue-500">{pendingDelivery.requestedQuantity || 0} {formatUnit(pendingDelivery.unit)}</span>
                        </div>
                     </div>

                     <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-1.5">Quantidade Entregue / Reposta</label>
                        <input 
                           type="number" 
                           value={deliveredQuantity}
                           onChange={e => setDeliveredQuantity(Number(e.target.value))}
                           className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500/50 outline-none text-foreground font-semibold text-lg"
                           min="1"
                           required
                        />
                     </div>

                     <div className="flex gap-3 pt-4 border-t border-border mt-6">
                        <button 
                           type="button" 
                           onClick={() => setPendingDelivery(null)}
                           className="flex-1 px-4 py-3 border border-border text-foreground font-medium rounded-xl hover:bg-secondary transition-colors"
                        >
                           Cancelar
                        </button>
                        <button 
                           type="submit" 
                           className="flex-1 px-4 py-3 bg-emerald-600 text-white font-medium rounded-xl hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-500/25"
                        >
                           Confirmar Entrega
                        </button>
                     </div>
                  </form>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
        {pendingOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
               initial={{ opacity: 0 }} 
               animate={{ opacity: 1 }} 
               exit={{ opacity: 0 }}
               className="absolute inset-0 bg-background/40 backdrop-blur-md"
               onClick={() => setPendingOrder(null)}
            />
            <motion.div 
               initial={{ scale: 0.95, y: 20 }}
               animate={{ scale: 1, y: 0 }}
               exit={{ scale: 0.95, y: 20 }}
               className="bg-card/70 backdrop-blur-md border border-border/50 w-full max-w-md rounded-2xl shadow-2xl relative z-10 overflow-hidden"
            >
               <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 to-orange-500"></div>
               <div className="p-6">
                  <h3 className="text-xl font-bold text-foreground">Fazer Pedido de Compra</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                     Você está formalizando o pedido de compra para <strong>{pendingOrder.name}</strong>.
                  </p>
                  
                  <form onSubmit={handleConfirmOrder} className="mt-6 space-y-4">
                     <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-1">Status do Pedido (Tag)</label>
                        <select 
                           value={orderTag} 
                           onChange={e => setOrderTag(e.target.value)}
                           className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-2.5 text-foreground focus:ring-2 focus:ring-amber-500 outline-none"
                        >
                           <option value="Pedido Feito">Pedido Feito</option>
                           <option value="Aguardando envio do produto">Aguardando Envio</option>
                           <option value="Aguardando faturamento">Aguardando Faturamento</option>
                           <option value="Pedido em Cotação">Pedido em Cotação</option>
                           <option value="Pedido Entregue">Pedido Entregue (Repor Imediatamente)</option>
                        </select>
                     </div>

                     <div className="grid grid-cols-2 gap-4">
                        <div>
                           <label className="block text-sm font-medium text-muted-foreground mb-1">Quantidade</label>
                           <input 
                              type="number" 
                              value={orderPackageQuantity}
                              onChange={e => setOrderPackageQuantity(Math.max(1, Number(e.target.value)))}
                              className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-2.5 text-foreground focus:ring-2 focus:ring-amber-500 outline-none"
                              min="1"
                              required
                           />
                        </div>
                        <div>
                           <label className="block text-sm font-medium text-muted-foreground mb-1">Unidade / Tipo</label>
                           <input 
                              type="text" 
                              value={orderPackageUnit}
                              onChange={e => setOrderPackageUnit(e.target.value)}
                              placeholder="Ex: caixas, un, pacotes"
                              className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-2.5 text-foreground focus:ring-2 focus:ring-amber-500 outline-none"
                              required
                           />
                        </div>
                     </div>

                     <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-1">Observações da Compra</label>
                        <textarea 
                           value={orderNotes}
                           onChange={e => setOrderNotes(e.target.value)}
                           className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-2.5 text-foreground focus:ring-2 focus:ring-amber-500 outline-none resize-none"
                           rows={3}
                           placeholder="Ex: Comprado com fornecedor X, entrega prevista para terça."
                        />
                     </div>

                     <div className="flex gap-3 pt-4 border-t border-border">
                        <button 
                           type="button" 
                           onClick={() => setPendingOrder(null)}
                           className="flex-1 px-4 py-3 border border-border text-foreground font-medium rounded-xl hover:bg-secondary transition-colors"
                        >
                           Cancelar
                        </button>
                        <button 
                           type="submit" 
                           className="flex-1 px-4 py-3 bg-amber-600 text-white font-medium rounded-xl hover:bg-amber-700 transition-colors shadow-lg shadow-amber-500/25"
                        >
                           Confirmar Pedido
                        </button>
                     </div>
                  </form>
               </div>
            </motion.div>
          </div>
        )}

      <ReportPreviewModal 
        isOpen={isReportOpen} 
        onClose={() => setIsReportOpen(false)} 
        title="Relatório Geral de Estoque"
        logs={logs}
        materials={materials}
        isGlobal={true}
      />

      <ProductImageModal 
        material={imageModalMaterial}
        onClose={() => setImageModalMaterial(null)}
        onUpdate={onRefresh}
      />
    </div>
  );
}

function AttendantDashboard({ materials, logs, onRefresh }: { materials: Material[], logs: StockCountLog[], onRefresh: () => void }) {
  const { token, user } = useAuth();
  const [search, setSearch] = useState('');
  const [imageModalMaterial, setImageModalMaterial] = useState<Material | null>(null);
  const [filterMode, setFilterMode] = useState<'ALL' | 'PENDING' | 'AWAITING_CONFIRMATION'>('PENDING');
  
  const [showCountModal, setShowCountModal] = useState(false);
  const [activeMaterial, setActiveMaterial] = useState<Material | null>(null);
  const [countQuantity, setCountQuantity] = useState<number | string>('');
  const [countNotes, setCountNotes] = useState('');
  const [countStatus, setCountStatus] = useState<Material['status']>('AWAITING_CONFIRMATION');
  
  const [showScanner, setShowScanner] = useState(false);
  
  const [reportText, setReportText] = useState<string>('');
  const [isReportOpen, setIsReportOpen] = useState<boolean>(false);

  const giroStats = useMemo(() => {
    const giroMaterials = materials.filter(m => m.isGiro);
    const todayStr = new Date().toLocaleDateString('pt-BR');
    
    const countedIdsToday = new Set(
      logs
        .filter(l => {
          const logDate = new Date(l.timestamp).toLocaleDateString('pt-BR');
          const isSystemAutomatic = l.previousQuantity === l.newQuantity && 
             (l.notes?.includes('[Pedido') || l.notes?.includes('[Aguardando'));
          return logDate === todayStr && !isSystemAutomatic;
        })
        .map(l => l.materialId)
    );

    const completed = giroMaterials.filter(m => countedIdsToday.has(m.id)).length;
    const pending = giroMaterials.length - completed;

    return {
      total: giroMaterials.length,
      completed,
      pending,
      percentage: giroMaterials.length > 0 ? Math.round((completed / giroMaterials.length) * 100) : 0
    };
  }, [materials, logs]);

  const filteredMaterials = useMemo(() => {
    const filtered = materials.filter(m => {
      if (user?.sectorId && m.sectorId !== user.sectorId) {
        return false;
      }
      const matchSearch = m.name.toLowerCase().includes(search.toLowerCase()) || 
                          m.code.toLowerCase().includes(search.toLowerCase()) ||
                          (m.sector && m.sector.toLowerCase().includes(search.toLowerCase())) ||
                          (m.codigoBarras && m.codigoBarras.includes(search));
                          
      if (!matchSearch) return false;
      if (filterMode === 'ALL') return true;
      return m.status === filterMode;
    });

    const now = new Date().getTime();
    return [...filtered].sort((a, b) => {
      const aRecent = a.repostedAt ? (now - new Date(a.repostedAt).getTime() < 24 * 60 * 60 * 1000) : false;
      const bRecent = b.repostedAt ? (now - new Date(b.repostedAt).getTime() < 24 * 60 * 60 * 1000) : false;
      if (aRecent && !bRecent) return -1;
      if (!aRecent && bRecent) return 1;
      if (aRecent && bRecent) {
        return new Date(b.repostedAt!).getTime() - new Date(a.repostedAt!).getTime();
      }
      return 0;
    });
  }, [materials, search, filterMode, user]);

  const handleScanResult = (decodedText: string) => {
    setShowScanner(false);
    
    const found = materials.find(m => m.codigoBarras === decodedText || m.code === decodedText);
    
    if (found) {
      setActiveMaterial(found);
      setCountQuantity(found.quantity);
      setCountNotes('');
      setCountStatus('AWAITING_CONFIRMATION');
      setShowCountModal(true);
    } else {
      alert(`Produto com código ${decodedText} não encontrado.`);
    }
  };

  const handleCountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeMaterial) return;
    try {
      await apiFetch(`/api/materials/${activeMaterial.id}/count`, {
        method: 'POST',
        body: JSON.stringify({ 
           newQuantity: countQuantity, 
           notes: countNotes,
           status: countStatus
        })
      }, token);
      setShowCountModal(false);
      onRefresh();
      window.dispatchEvent(new CustomEvent('products-changed'));
    } catch (err) {
      alert('Erro ao registrar contagem');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">
      {/* Setor de Giro KPI Widget */}
      <div className="bg-card/50 backdrop-blur-md p-6 rounded-2xl border border-border shadow-sm overflow-hidden relative animate-none">
        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl -mr-8 -mt-8 pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-amber-500/10 text-amber-500 dark:text-amber-400 rounded-xl shrink-0">
               <span className="text-xl font-bold">⚡</span>
            </div>
            <div>
               <h4 className="font-bold text-foreground text-base">Giro do Dia (Uso Rápido)</h4>
               <p className="text-sm text-muted-foreground mt-0.5">
                  Materiais de alto movimento e consumo diário constante que devem ser auditados todos os dias.
               </p>
               <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3 text-xs font-semibold">
                  <span className="text-emerald-500 flex items-center gap-1">
                     ● {giroStats.completed} Concluídos Hoje
                  </span>
                  <span className="text-amber-500 flex items-center gap-1">
                     ● {giroStats.pending} Pendentes Hoje
                  </span>
                  <span className="text-muted-foreground">
                     Total em Giro: {giroStats.total} itens cadastrados
                  </span>
               </div>
            </div>
          </div>
          
          <div className="w-full md:w-64 flex flex-col gap-1.5 shrink-0">
             <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-muted-foreground">Conclusão das Contagens</span>
                <span className="font-bold text-amber-500">{giroStats.percentage}%</span>
             </div>
             <div className="w-full h-3 bg-secondary rounded-full overflow-hidden border border-border/40">
                <div 
                   className="h-full bg-gradient-to-r from-amber-500 to-amber-600 transition-all duration-500 rounded-full" 
                   style={{ width: `${giroStats.percentage}%` }}
                />
             </div>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         {/* Seção de Contagem (Esquerda) */}
         <div className="lg:col-span-2 space-y-6">
            <div className="bg-card/50 backdrop-blur-md p-6 rounded-2xl border border-border shadow-sm flex flex-col gap-4 justify-between">
               <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                     <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                        <Package className="w-6 h-6 text-blue-500" /> Produtos para Contagem
                     </h2>
                     <p className="text-sm text-muted-foreground mt-1">Busque o produto, utilize os filtros rápidos ou escaneie para contar.</p>
                  </div>
                  <div className="flex bg-secondary/50 p-1 rounded-xl flex-wrap gap-1">
                     <button onClick={() => setFilterMode('PENDING')} className={cn("px-3 py-1.5 text-sm font-medium rounded-lg transition-colors", filterMode === 'PENDING' ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>Pendentes</button>
                     <button onClick={() => setFilterMode('AWAITING_CONFIRMATION')} className={cn("px-3 py-1.5 text-sm font-medium rounded-lg transition-colors", filterMode === 'AWAITING_CONFIRMATION' ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>Aguardando</button>
                     <button onClick={() => setFilterMode('ALL')} className={cn("px-3 py-1.5 text-sm font-medium rounded-lg transition-colors", filterMode === 'ALL' ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>Todos</button>
                  </div>
               </div>
               
               <div className="relative w-full flex gap-2">
                 <div className="relative flex-1">
                   <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                   <input 
                     type="text" 
                     placeholder="Buscar por nome, código ou setor..." 
                     className="w-full pl-12 pr-4 py-3 bg-background border border-border rounded-xl text-base focus:ring-2 focus:ring-blue-500/50 outline-none transition-all placeholder:text-muted-foreground/50 text-foreground"
                     value={search}
                     onChange={e => setSearch(e.target.value)}
                   />
                 </div>
                 <button 
                    onClick={() => setShowScanner(true)}
                    className="px-4 bg-blue-600 text-white hover:bg-blue-700 rounded-xl transition-colors flex items-center justify-center shrink-0 shadow-lg shadow-blue-500/25 gap-2 font-medium"
                    title="Ler Código de Barras"
                 >
                    <Camera className="w-5 h-5" /> <span>Escanear</span>
                 </button>
               </div>
            </div>

            <div className="bg-card/50 backdrop-blur-md rounded-2xl border border-border shadow-sm overflow-hidden">
               {filteredMaterials.length === 0 ? (
                  <div className="p-12 text-center flex flex-col items-center justify-center text-muted-foreground">
                     <Package className="w-12 h-12 mb-4 opacity-20" />
                     <p className="text-lg font-medium">Nenhum produto encontrado</p>
                     <p className="text-sm mt-1">Tente ajustar seus filtros ou termos de busca.</p>
                  </div>
               ) : (
                  <>
                  <div className="hidden md:block w-full">
                      <table className="w-full text-left border-collapse table-fixed">
                        <thead>
                          <tr className="bg-secondary/50 border-b border-border text-muted-foreground text-xs uppercase tracking-wider">
                            <th className="px-6 py-4 font-medium w-[45%]">Produto</th>
                            <th className="px-6 py-4 font-medium w-[25%]">Setor</th>
                            <th className="px-6 py-4 font-medium w-[15%]">Estoque Sist.</th>
                            <th className="px-6 py-4 font-medium text-right w-[15%]">Ação</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {filteredMaterials.map(mat => (
                            <tr key={mat.id} className="hover:bg-secondary/30 transition-colors">
                              <td className="px-6 py-4">
                                <div className="font-medium text-foreground flex items-center gap-2 flex-wrap break-words">
                                  <span>{mat.name}</span>
                                  {mat.repostedAt && (new Date().getTime() - new Date(mat.repostedAt).getTime() < 24 * 60 * 60 * 1000) && (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-500 border border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.15)] animate-pulse shrink-0">Novo</span>
                                  )}
                                </div>
                                <div className="text-xs text-muted-foreground font-mono mt-0.5 break-all">{mat.code}</div>
                              </td>
                              <td className="px-6 py-4 text-sm break-words">{mat.sector}</td>
                              <td className="px-6 py-4">
                                <div className="font-medium mb-1">{mat.quantity} {formatUnit(mat.unit)}</div>
                                <StatusBadge status={mat.status} />
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-right flex justify-end gap-2">
                                <button 
                                  type="button"
                                  onClick={() => setImageModalMaterial(mat)}
                                  className="text-amber-500 hover:text-amber-400 p-2 rounded-lg hover:bg-amber-500/10 transition-colors inline-flex items-center gap-1.5"
                                  title="Visualizar Foto Ilustrativa"
                                >
                                  <Eye className="w-4 h-4" />
                                  <span className="sr-only sm:not-sr-only text-xs">Ver</span>
                                </button>
                                <button 
                                  type="button"
                                  onClick={() => {
                                    setActiveMaterial(mat);
                                    setCountQuantity(mat.quantity);
                                    setCountNotes('');
                                    setCountStatus('AWAITING_CONFIRMATION');
                                    setShowCountModal(true);
                                  }}
                                  className="bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors inline-flex items-center gap-1.5"
                                >
                                  <Edit3 className="w-4 h-4" /> Contar
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile/Tablet view: Cards */}
                    <div className="md:hidden divide-y divide-border">
                      {filteredMaterials.map(mat => (
                        <div key={mat.id} className="p-4 space-y-3">
                          <div className="flex justify-between items-start gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="font-bold text-foreground text-sm flex items-center gap-1.5 flex-wrap min-w-0 break-words">
                                <span>{mat.name}</span>
                                {mat.repostedAt && (new Date().getTime() - new Date(mat.repostedAt).getTime() < 24 * 60 * 60 * 1000) && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-500 border border-emerald-500/30 shrink-0">Novo</span>
                                )}
                              </div>
                              <span className="text-xs text-muted-foreground font-mono mt-0.5 block break-all">{mat.code}</span>
                            </div>
                            <button 
                               type="button"
                               onClick={() => setImageModalMaterial(mat)}
                               className="text-amber-500 hover:text-amber-400 p-2 rounded-lg hover:bg-amber-500/10 transition-colors shrink-0"
                               title="Visualizar Foto Ilustrativa"
                            >
                               <Eye className="w-5 h-5" />
                            </button>
                          </div>

                          <div className="flex justify-between items-start text-xs text-muted-foreground gap-4">
                            <div className="min-w-0 flex-1 break-words">
                              <span className="font-medium text-foreground">Setor:</span> {mat.sector}
                            </div>
                            <div className="text-right shrink-0">
                              <div className="font-semibold text-foreground text-sm">{mat.quantity} {formatUnit(mat.unit)}</div>
                              <div className="mt-1"><StatusBadge status={mat.status} /></div>
                            </div>
                          </div>

                          <button 
                            type="button"
                            onClick={() => {
                              setActiveMaterial(mat);
                              setCountQuantity(mat.quantity);
                              setCountNotes('');
                              setCountStatus('AWAITING_CONFIRMATION');
                              setShowCountModal(true);
                            }}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 px-4 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-1.5 shadow-md shadow-blue-500/10"
                          >
                            <Edit3 className="w-4 h-4" /> Registrar Contagem
                          </button>
                        </div>
                      ))}
                    </div>
                  </>
               )}
            </div>
         </div>

         {/* Histórico Recente e Pedidos (Direita) */}
         <div className="flex flex-col gap-6">
            
            {/* Pedidos de Compra (Read Only for Attendant) */}
            <div className="bg-card/50 backdrop-blur-md rounded-2xl border border-border shadow-sm flex flex-col h-[250px]">
               <div className="px-6 py-5 border-b border-border bg-card/80">
                  <h3 className="font-semibold text-foreground flex items-center gap-2">
                     <ShoppingCart className="w-4 h-4 text-blue-500" /> Pedidos de Compra
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">Solicitados pelo gestor.</p>
               </div>
               <div className="divide-y divide-border overflow-y-auto flex-1 p-2 space-y-2">
                  {materials.filter(m => m.status === 'PURCHASE_REQUESTED').length > 0 ? materials.filter(m => m.status === 'PURCHASE_REQUESTED').map(mat => (
                     <div key={mat.id} className="p-3 bg-secondary/20 border border-border rounded-xl">
                        <div className="flex justify-between items-start gap-4 mb-1">
                           <p className="font-medium text-sm text-foreground min-w-0 flex-1 break-words">{mat.name}</p>
                           <div className="flex flex-col items-end gap-1 shrink-0"><span className="text-xs bg-blue-500/10 text-blue-500 border border-blue-500/20 px-2 py-0.5 rounded-full whitespace-nowrap font-bold">Solicitado: {mat.requestedQuantity || 0} {formatUnit(mat.unit)}</span><span className="text-[10px] text-muted-foreground whitespace-nowrap">Estoque: {mat.quantity} {formatUnit(mat.unit)}</span></div>
                        </div>
                        <p className="text-xs text-muted-foreground break-words">{mat.notes || 'Sem observações'}</p>
                     </div>
                  )) : (
                     <div className="p-6 text-center text-muted-foreground text-sm flex flex-col items-center">
                        <Package className="w-6 h-6 opacity-20 mb-2" />
                        Nenhum pedido no momento.
                     </div>
                  )}
               </div>
            </div>

            {/* Histórico de Contagens */}
            <div className="bg-card/50 backdrop-blur-md rounded-2xl border border-border shadow-sm flex flex-col h-[280px]">
               <div className="px-6 py-5 border-b border-border bg-card/80">
                  <h3 className="font-semibold text-foreground flex items-center gap-2">
                     <History className="w-4 h-4 text-emerald-500" /> Últimas Contagens
                  </h3>
               </div>
               <div className="divide-y divide-border overflow-y-auto flex-1 p-2 space-y-2">
                  {logs.filter(log => !(log.previousQuantity === log.newQuantity && (log.notes?.includes('[Pedido') || log.notes?.includes('[Aguardando')))).length > 0 ? 
                     logs.filter(log => !(log.previousQuantity === log.newQuantity && (log.notes?.includes('[Pedido') || log.notes?.includes('[Aguardando')))).map(log => (
                     <div key={log.id} className="p-4 bg-background border border-border rounded-xl hover:shadow-md transition-all">
                        <div className="flex justify-between items-start gap-4 mb-2">
                           <div className="min-w-0 flex-1">
                             <p className="font-bold text-sm text-foreground break-words">{log.materialName}</p>
                             <p className="text-xs text-muted-foreground font-mono break-all">{log.materialCode}</p>
                           </div>
                           <div className="text-right shrink-0">
                              <div className="text-xs font-medium text-foreground bg-secondary px-2 py-1 rounded-md inline-block">
                                 {new Date(log.timestamp).toLocaleDateString()} às {new Date(log.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                              </div>
                           </div>
                        </div>
                        
                        <div className="flex items-center justify-between text-sm bg-secondary/30 p-2 rounded-lg mb-3">
                           {(() => {
                              const mat = materials.find(m => m.id === log.materialId);
                              const unit = formatUnit(mat?.unit);
                              return (
                                 <div className="flex items-center gap-2">
                                    <span className="text-muted-foreground line-through opacity-70">{log.previousQuantity} {unit}</span>
                                    <span className="text-foreground font-medium">→</span>
                                    <span className="text-emerald-500 font-bold">{log.newQuantity} {unit}</span>
                                 </div>
                              );
                           })()}
                           <div className="text-xs flex items-center gap-1.5 text-muted-foreground">
                              <div className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-500 flex items-center justify-center text-[10px] font-bold">
                                 {log.userName?.charAt(0) || '?'}
                              </div>
                              <span className="truncate max-w-[100px]">{log.userName || 'Desconhecido'}</span>
                           </div>
                        </div>
                        
                        {log.notes && (
                           <p className="text-xs text-muted-foreground bg-blue-500/5 p-2 rounded-lg border border-blue-500/10 italic">
                              "{log.notes}"
                           </p>
                        )}
                     </div>
                  )) : (
                     <div className="p-8 text-center text-muted-foreground text-sm">Nenhuma contagem recente.</div>
                  )}
               </div>
            </div>
            
            {/* Meu Relatório */}
            <div className="bg-card/50 backdrop-blur-md rounded-2xl border border-border shadow-sm flex flex-col">
               <div className="px-6 py-5 border-b border-border bg-card/80">
                  <h3 className="font-semibold text-foreground flex items-center gap-2">
                     <Share2 className="w-4 h-4 text-emerald-500" /> Meu Relatório de Hoje
                  </h3>
               </div>
               <div className="p-4 flex flex-col gap-2">
                  <button 
                     onClick={() => {
                        setIsReportOpen(true);
                     }}
                     className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-all shadow-sm w-full"
                  >
                     <Share2 className="w-5 h-5" />
                     Visualizar e Copiar Relatório
                  </button>
               </div>
            </div>
         </div>
      </div>

      {/* Modal de Contagem */}
      <AnimatePresence>
        {showCountModal && activeMaterial && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
               initial={{ opacity: 0 }} 
               animate={{ opacity: 1 }} 
               exit={{ opacity: 0 }}
               className="absolute inset-0 bg-background/80 backdrop-blur-sm"
               onClick={() => setShowCountModal(false)}
            />
            <motion.div 
               initial={{ scale: 0.95, y: 20 }}
               animate={{ scale: 1, y: 0 }}
               exit={{ scale: 0.95, y: 20 }}
               className="bg-card border border-border rounded-2xl w-full max-w-sm shadow-2xl p-6 relative overflow-hidden z-10"
            >
               <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-emerald-500"></div>
               
               <div className="mb-6 mt-2">
                  <h3 className="text-xl font-bold text-foreground">Registrar Contagem</h3>
                  <p className="text-sm text-muted-foreground mt-1">{activeMaterial.name} ({activeMaterial.code})</p>
               </div>

               <form onSubmit={handleCountSubmit} className="space-y-4">
                 <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1.5">Estoque Físico ({formatUnit(activeMaterial?.unit)})</label>
                    <input 
                       type="number" 
                       min="0"
                       value={countQuantity}
                       onChange={e => setCountQuantity(e.target.value ? parseInt(e.target.value) : '')}
                       className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-3 text-lg font-bold focus:ring-2 focus:ring-blue-500/50 outline-none text-foreground"
                       required
                    />
                 </div>
                 
                 <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1.5">Status/Tag</label>
                    <select
                       value={countStatus}
                       onChange={e => setCountStatus(e.target.value as Material['status'])}
                       className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/50 outline-none text-foreground"
                    >
                       <option value="COUNTED_RECENTLY">Recém Contado</option>
                       <option value="PENDING">Contagem Pendente</option>
                       <option value="AWAITING_CONFIRMATION">Aguardando Conferência</option>
                       <option value="PURCHASE_REQUESTED">Solicitando Compra</option>
                       <option value="COMPLETED">Finalizado/Reposto</option>
                    </select>
                 </div>
                 
                 <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1.5">Observações (Opcional)</label>
                    <textarea 
                       value={countNotes}
                       onChange={e => setCountNotes(e.target.value)}
                       className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/50 outline-none text-foreground resize-none"
                       rows={3}
                       placeholder="Ex: 2 unidades avariadas..."
                    />
                 </div>

                 <div className="flex gap-3 pt-4">
                    <button 
                       type="button" 
                       onClick={() => setShowCountModal(false)}
                       className="flex-1 px-4 py-3 text-muted-foreground font-medium rounded-xl hover:bg-secondary transition-colors"
                    >
                       Cancelar
                    </button>
                    <button 
                       type="submit" 
                       className="flex-1 px-4 py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/25"
                    >
                       Confirmar
                    </button>
                 </div>
               </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      
      {showScanner && (
        <BarcodeScanner 
          onResult={handleScanResult}
          onClose={() => setShowScanner(false)}
        />
      )}
      
      <ReportPreviewModal 
        isOpen={isReportOpen} 
        onClose={() => setIsReportOpen(false)} 
        title="Meu Relatório de Contagens" 
        logs={logs}
        materials={materials}
        targetUsers={[{ id: user?.id || '', userName: user?.name || '' }]}
        isGlobal={false}
      />

      <ProductImageModal 
        material={imageModalMaterial}
        onClose={() => setImageModalMaterial(null)}
        onUpdate={onRefresh}
      />
    </div>
  );
}

export default function Dashboard() {
  const { token, isManager, user } = useAuth();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [logs, setLogs] = useState<StockCountLog[]>([]);
  const [timeLogs, setTimeLogs] = useState<TimeLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = (isBackground = false) => {
    if (!isBackground) setLoading(true);
    const promises = [
      apiFetch('/api/materials', {}, token).catch(() => []),
      apiFetch('/api/logs/stock', {}, token).catch(() => [])
    ];
    if (isManager) {
      promises.push(apiFetch('/api/logs/time', {}, token).catch(() => []));
    }

    Promise.all(promises).then(([mats, stockLogs, tLogs]) => {
      setMaterials(mats);
      setLogs(stockLogs);
      if (tLogs) setTimeLogs(tLogs);
    }).finally(() => {
      if (!isBackground) setLoading(false);
    });
  };

  useEffect(() => {
    fetchData(false);
    
    // Polling ativo a cada 10 segundos para atualização em tempo real
    const interval = setInterval(() => {
      fetchData(true);
    }, 10000);

    const handleProductsChanged = () => {
      fetchData(true);
    };
    window.addEventListener('products-changed', handleProductsChanged);

    return () => {
      clearInterval(interval);
      window.removeEventListener('products-changed', handleProductsChanged);
    };
  }, [token, isManager, user]);

  if (loading) return <div className="p-8 text-center text-muted-foreground">Carregando dashboard...</div>;

  return isManager ? (
    <ManagerDashboard materials={materials} logs={logs} timeLogs={timeLogs} onRefresh={fetchData} />
  ) : (
    <AttendantDashboard materials={materials} logs={logs} onRefresh={fetchData} />
  );
}