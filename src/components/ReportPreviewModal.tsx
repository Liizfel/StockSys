import React, { useEffect, useState, useMemo } from 'react';
import { Material, StockCountLog } from '../types';
import { X, Check, Copy, FileText, MessageCircle, Share2 } from 'lucide-react';
import { cn, formatUnit, getWhatsAppShareUrl, getTelegramShareUrl } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import jsPDF from 'jspdf';

export const generateReportText = (
  targetUsers: { id: string; userName: string }[],
  logs: StockCountLog[],
  materials?: Material[],
  isGlobal = false,
  stockFilter: 'all' | 'pulmao' | 'giro' = 'all'
) => {
  const now = new Date();
  const dateStr = now.toLocaleDateString('pt-BR');
  const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  const separator = "=========================================";

  if (isGlobal) {
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

    const contributorsMap: Record<string, { name: string; count: number }> = {};
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

      report += `    - *Qtd Contada:* ${l.newQuantity} ${unit}${diffText}\n`;
      report += `    - *Contador:* ${l.userName || 'Desconhecido'}\n`;
      
      const noteContent = l.notes && l.notes.trim() ? l.notes.trim() : 'Sem observações';
      report += `    - *Obs:* ${noteContent}\n\n`;
    });

    report += `${separator}\n`;
    report += `*Relatório Geral consolidado com sucesso.*`;
    return report;
  } else {
    let report = '';
    
    targetUsers.forEach((user, index) => {
      const userLogs = logs.filter(l => {
        const logDate = new Date(l.timestamp).toLocaleDateString('pt-BR');
        return l.userId === user.id && logDate === dateStr;
      });
      
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
        
        const diff = l.newQuantity - l.previousQuantity;
        const diffText = diff > 0 
          ? ` _(Divergência: +${diff} ${unit})_` 
          : diff < 0 
            ? ` _(Divergência: ${diff} ${unit})_` 
            : ` _(Sem divergência)_`;
        
        report += `    - *Qtd Contada:* ${l.newQuantity} ${unit}${diffText}\n`;
        
        const noteContent = l.notes && l.notes.trim() ? l.notes.trim() : 'Sem observações';
        report += `    - *Obs:* ${noteContent}\n\n`;
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

export const copyToClipboard = async (text: string): Promise<boolean> => {
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
  targetUsers?: { id: string; userName: string }[];
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
    
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, 210, 40, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text((title || 'RELATÓRIO DE ESTOQUE').toUpperCase(), 15, 16);
    
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(203, 213, 225);
    doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}`, 15, 25);
    doc.text("Sistema de Gestão de Estoque Inteligente", 15, 31);

    let currentY = 55;
    doc.setTextColor(30, 41, 59);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);

    const lines = reportText.split('\n');
    lines.forEach((line) => {
      if (currentY > 275) {
        doc.addPage();
        currentY = 20;
      }

      const cleanLine = line.replace(/\*/g, '').replace(/_/g, '');
      
      if (line.startsWith('*') && line.endsWith('*')) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.text(cleanLine, 15, currentY);
        currentY += 7;
      } else if (line.startsWith('===') || line.startsWith('---')) {
        doc.setDrawColor(226, 232, 240);
        doc.line(15, currentY - 2, 195, currentY - 2);
        currentY += 4;
      } else {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9.5);
        if (line.trim().startsWith('-')) {
          doc.text(cleanLine, 20, currentY);
        } else if (line.startsWith('    -')) {
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
           className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl p-4 sm:p-6 relative overflow-hidden z-10 flex flex-col max-h-[90vh] md:max-h-[85vh]"
        >
           <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-emerald-500"></div>
           
           <div className="mb-4 mt-2 flex justify-between items-start gap-4">
              <div className="min-w-0 flex-1">
                 <h3 className="text-lg sm:text-xl font-bold text-foreground truncate">{title}</h3>
                 <p className="text-xs sm:text-sm text-muted-foreground mt-1 truncate">Visualize, copie ou envie o relatório formatado abaixo.</p>
              </div>
              <button onClick={onClose} className="p-1.5 hover:bg-secondary rounded-lg transition-colors text-muted-foreground hover:text-foreground shrink-0 min-w-[36px] min-h-[36px] flex items-center justify-center">
                 <X className="w-5 h-5" />
              </button>
           </div>

           {(logs || materials) && (
             <div className="mb-4 bg-secondary/50 p-1 rounded-xl border border-border flex gap-1 shadow-inner shrink-0 overflow-x-auto scrollbar-none">
               <button
                 type="button"
                 onClick={() => setStockFilter('all')}
                 className={cn(
                   "flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all duration-200 whitespace-nowrap",
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
                   "flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all duration-200 whitespace-nowrap",
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
                   "flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all duration-200 whitespace-nowrap",
                   stockFilter === 'giro'
                     ? "bg-amber-600 text-white shadow-sm"
                     : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                 )}
               >
                 ⚡ Estoque de Giro
               </button>
             </div>
           )}

           <div className="flex-1 overflow-y-auto mb-6 bg-secondary/30 p-4 rounded-xl border border-border/80 font-mono text-xs sm:text-sm text-foreground whitespace-pre-wrap select-all max-h-[45vh] md:max-h-[40vh] shadow-inner custom-scrollbar">
              {reportText}
           </div>

           <div className="flex flex-col gap-3 pt-4 border-t border-border shrink-0 w-full">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full">
                 <button 
                    onClick={handleCopy}
                    className={cn(
                      "flex items-center justify-center gap-1.5 px-2 py-2.5 sm:py-3 rounded-xl text-xs font-semibold transition-all shadow-sm truncate h-[42px] sm:h-auto",
                      copied 
                        ? "bg-emerald-600 text-white hover:bg-emerald-700" 
                        : "bg-blue-600 text-white hover:bg-blue-700 shadow-blue-500/10"
                    )}
                 >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? "Copiado!" : "Copiar"}</span>
                 </button>
                 <button 
                    onClick={handleExportPDF}
                    className="flex items-center justify-center gap-1.5 px-2 py-2.5 sm:py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold transition-all shadow-sm shadow-rose-500/10 truncate h-[42px] sm:h-auto"
                    title="Exportar como PDF profissional"
                 >
                    <FileText className="w-3.5 h-3.5" />
                    <span>PDF</span>
                 </button>
                 <a 
                    href={getWhatsAppShareUrl(reportText)}
                    target={isMobile ? undefined : "_blank"}
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1.5 px-2 py-2.5 sm:py-3 bg-[#25D366] hover:bg-[#1DA851] text-white rounded-xl text-xs font-semibold transition-colors shadow-sm truncate h-[42px] sm:h-auto"
                 >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>WhatsApp</span>
                 </a>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                 <a 
                    href={getTelegramShareUrl(reportText)}
                    target={isMobile ? undefined : "_blank"}
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[#0088cc] hover:bg-[#0077b3] text-white rounded-xl text-xs font-semibold transition-colors shadow-sm truncate h-[40px]"
                 >
                    <Share2 className="w-4 h-4" />
                    <span>Telegram</span>
                 </a>
                 <button 
                    onClick={onClose}
                    className="px-4 py-2.5 border border-border text-foreground font-semibold rounded-xl hover:bg-secondary transition-colors text-xs h-[40px] truncate"
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
