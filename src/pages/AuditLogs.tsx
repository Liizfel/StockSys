import React, { useState, useEffect, useMemo } from 'react';
import { apiFetch } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { StockCountLog, Material } from '../types';
import { 
  History, 
  Package, 
  User, 
  Calendar, 
  Clock, 
  Filter, 
  AlertTriangle, 
  TrendingDown, 
  FileText, 
  Download, 
  Share2, 
  Copy, 
  Check, 
  MessageSquare, 
  X, 
  SlidersHorizontal, 
  MapPin, 
  ArrowRight,
  TrendingUp,
  Inbox,
  CheckCircle2
} from 'lucide-react';
import { format, isSameDay, parseISO, set } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { cn, formatUnit, getWhatsAppShareUrl, getTelegramShareUrl } from '../lib/utils';
import { jsPDF } from 'jspdf';

// Modal para Pré-visualização e Compartilhamento de Relatórios
interface ReportPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportText: string;
  title: string;
  onExportPDF: () => void;
}

export const ReportPreviewModal = ({ isOpen, onClose, reportText, title, onExportPDF }: ReportPreviewModalProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(reportText);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = reportText;
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (err) {
      alert("Erro ao copiar o texto. Por favor, copie manualmente.");
    }
  };

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
           
           <div className="mb-4 mt-2 flex justify-between items-start">
              <div>
                 <h3 className="text-xl font-bold text-foreground">{title}</h3>
                 <p className="text-sm text-muted-foreground mt-1">Compartilhe o relatório de auditoria ou salve em PDF.</p>
              </div>
              <button onClick={onClose} className="p-1 hover:bg-secondary rounded-lg transition-colors text-muted-foreground hover:text-foreground">
                 <X className="w-5 h-5" />
              </button>
           </div>

           <div className="flex-1 overflow-y-auto mb-6 bg-secondary/30 p-4 rounded-xl border border-border/80 font-mono text-xs text-foreground whitespace-pre-wrap select-all max-h-[35vh] shadow-inner">
              {reportText}
           </div>

           <div className="flex flex-col gap-3 pt-4 border-t border-border">
              <div className="grid grid-cols-2 gap-3">
                 <button 
                    onClick={handleCopy}
                    className={cn(
                      "flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-all shadow-sm",
                      copied 
                        ? "bg-emerald-600 text-white hover:bg-emerald-700" 
                        : "bg-blue-600 text-white hover:bg-blue-700"
                    )}
                 >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copied ? "Copiado!" : "Copiar Texto"}
                 </button>
                 
                 <button 
                    onClick={onExportPDF}
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-medium transition-colors shadow-sm"
                 >
                    <Download className="w-4 h-4" />
                    Salvar PDF
                 </button>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                 <a 
                    href={getWhatsAppShareUrl(reportText)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-[#25D366] hover:bg-[#1DA851] text-white rounded-xl text-sm font-medium transition-colors shadow-sm"
                 >
                    <Share2 className="w-4 h-4" />
                    WhatsApp
                 </a>
                 <a 
                    href={getTelegramShareUrl(reportText)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-[#0088cc] hover:bg-[#0077b3] text-white rounded-xl text-sm font-medium transition-colors shadow-sm"
                 >
                    <Share2 className="w-4 h-4" />
                    Telegram
                 </a>
              </div>
           </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default function AuditLogs() {
  const { token, isManager } = useAuth();
  const [logs, setLogs] = useState<StockCountLog[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Estado dos Filtros
  const [userFilter, setUserFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [timeStart, setTimeStart] = useState('');
  const [timeEnd, setTimeEnd] = useState('');
  const [sectorFilter, setSectorFilter] = useState('');
  const [productFilter, setProductFilter] = useState('');

  // Otimização de Performance: Paginação
  const [visibleCount, setVisibleCount] = useState(30);

  // Estado do Modal de Relatório
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [reportText, setReportText] = useState('');

  // Buscar dados de auditoria ao montar
  useEffect(() => {
    if (!token) return;
    
    const fetchAll = async () => {
       try {
          const [fetchedLogs, fetchedMaterials, fetchedUsers] = await Promise.all([
             apiFetch('/api/logs/stock', {}, token),
             apiFetch('/api/materials', {}, token),
             isManager ? apiFetch('/api/users', {}, token).catch(() => []) : Promise.resolve([])
          ]);
          setLogs(fetchedLogs);
          setMaterials(fetchedMaterials);
          setUsers(fetchedUsers);
       } catch (error) {
          console.error("Error fetching audit data:", error);
       } finally {
          setLoading(false);
       }
    };
    
    fetchAll();
  }, [token, isManager]);

  // Processamento dinâmico de filtros com useMemo
  const filteredLogs = useMemo(() => {
    // Reseta contador de paginação nas mudanças de filtro para evitar renderização inicial pesada
    setVisibleCount(30);

    return logs.filter(log => {
      const logDate = parseISO(log.timestamp);
      
      // 1. User Filter (attendant)
      if (userFilter && log.userId !== userFilter && log.userName !== userFilter) {
         return false;
      }
      
      // 2. Date Filter
      if (dateFilter) {
         const filterDate = parseISO(dateFilter);
         if (!isSameDay(logDate, filterDate)) return false;
      }
      
      // 3. Hour/Time Filters
      if (timeStart) {
         const [hours, minutes] = timeStart.split(':').map(Number);
         const start = set(logDate, { hours, minutes, seconds: 0, milliseconds: 0 });
         if (logDate < start) return false;
      }
      
      if (timeEnd) {
         const [hours, minutes] = timeEnd.split(':').map(Number);
         const end = set(logDate, { hours, minutes, seconds: 59, milliseconds: 999 });
         if (logDate > end) return false;
      }

      // 4. Sector Filter
      if (sectorFilter && log.materialSector !== sectorFilter) {
         return false;
      }

      // 5. Specific Product Filter
      if (productFilter && log.materialId !== productFilter) {
         return false;
      }
      
      return true;
    }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [logs, userFilter, dateFilter, timeStart, timeEnd, sectorFilter, productFilter]);

  // Fila de logs paginados
  const visibleLogs = useMemo(() => {
    return filteredLogs.slice(0, visibleCount);
  }, [filteredLogs, visibleCount]);

  // Extrair setores únicos presentes no banco de dados de logs
  const uniqueSectors = useMemo(() => {
    const list = logs.map(l => l.materialSector).filter(Boolean) as string[];
    return Array.from(new Set(list)).sort();
  }, [logs]);

  // Extrair produtos únicos presentes no banco de dados de logs
  const uniqueProducts = useMemo(() => {
    const map: Record<string, { id: string, name: string, code: string }> = {};
    logs.forEach(l => {
      if (l.materialId && !map[l.materialId]) {
        map[l.materialId] = {
          id: l.materialId,
          name: l.materialName || 'Desconhecido',
          code: l.materialCode || ''
        };
      }
    });
    return Object.values(map).sort((a, b) => a.name.localeCompare(b.name));
  }, [logs]);

  // Cálculo de estatísticas sobre os logs filtrados
  const stats = useMemo(() => {
    let positive = 0;
    let negative = 0;
    let zero = 0;
    
    filteredLogs.forEach(log => {
      const diff = log.newQuantity - log.previousQuantity;
      if (diff > 0) positive++;
      else if (diff < 0) negative++;
      else zero++;
    });

    return {
      total: filteredLogs.length,
      positive,
      negative,
      zero
    };
  }, [filteredLogs]);

  // Dados do Gráfico: Cronologia de atividades (soma o volume de contagem por dia em ordem cronológica)
  const activityTimelineData = useMemo(() => {
     const countsByDate: Record<string, number> = {};
     filteredLogs.forEach(log => {
        const dateStr = format(parseISO(log.timestamp), 'dd/MM');
        countsByDate[dateStr] = (countsByDate[dateStr] || 0) + 1;
     });
     
     return Object.entries(countsByDate)
        .map(([date, count]) => ({ date, contagens: count }))
        .reverse(); // colocar em sequência cronológica
  }, [filteredLogs]);

  // Principais materiais críticos precisando de reposição
  const criticalReplacements = useMemo(() => {
     return materials
        .map(m => {
           const deficit = m.estoqueMinimo - m.quantity;
           const isPurchaseRequested = m.status === 'PURCHASE_REQUESTED';
           // Se foi solicitado pelos atendentes, o deficit pode ser a quantidade solicitada (se houver) ou o deficit físico
           const finalDeficit = isPurchaseRequested 
              ? Math.max(deficit, m.requestedQuantity || 1) 
              : deficit;
              
           return {
              name: m.name,
              code: m.code,
              current: m.quantity,
              min: m.estoqueMinimo,
              deficit: finalDeficit,
              unit: formatUnit(m.unit),
              isPurchaseRequested
           };
        })
        .filter(m => m.deficit > 0 || m.isPurchaseRequested)
        .sort((a, b) => b.deficit - a.deficit)
        .slice(0, 5);
  }, [materials]);

  // Gerador de Relatório de Texto (Mesmo estilo do Dashboard mas adaptado para os filtros atuais)
  const handleGenerateTextReport = () => {
    const separator = "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━";
    const now = new Date();
    const dateStr = now.toLocaleDateString('pt-BR');
    const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    let report = `*RELATÓRIO DE AUDITORIA DE ESTOQUE*\n`;
    report += `${separator}\n`;
    report += `*Gerado em:* ${dateStr} às ${timeStr}\n`;
    
    // Listar filtros aplicados
    const activeFilters = [
      userFilter ? `Colaborador: ${userFilter}` : '',
      dateFilter ? `Data: ${format(parseISO(dateFilter), 'dd/MM/yyyy')}` : '',
      (timeStart || timeEnd) ? `Horário: ${timeStart || '00:00'} - ${timeEnd || '23:59'}` : '',
      sectorFilter ? `Setor: ${sectorFilter}` : '',
      productFilter ? `Produto: ${uniqueProducts.find(p => p.id === productFilter)?.name || 'Específico'}` : ''
    ].filter(Boolean);

    report += `*Filtros aplicados:* ${activeFilters.join(' | ') || 'Nenhum (Relatório Geral)'}\n`;
    report += `*Total de contagens:* ${filteredLogs.length} registro(s)\n`;
    report += `${separator}\n\n`;

    if (filteredLogs.length === 0) {
      report += `Nenhum registro de contagem localizado sob os parâmetros selecionados.\n`;
      setReportText(report);
      setIsReportOpen(true);
      return;
    }

    report += `*RESUMO ESTATÍSTICO:*\n`;
    report += `- Sobras (+): ${stats.positive}\n`;
    report += `- Faltas (-): ${stats.negative}\n`;
    report += `- Sem divergência: ${stats.zero}\n\n`;
    report += `${separator}\n\n`;

    report += `*DETALHAMENTO DAS CONTAGENS:*\n\n`;

    filteredLogs.forEach((l, idx) => {
      const mat = materials.find(m => m.id === l.materialId);
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
      report += `   - *Data/Hora:* ${format(parseISO(l.timestamp), "dd/MM/yyyy 'às' HH:mm")}\n`;
      report += `   - *Setor:* ${l.materialSector || 'Geral'}\n`;
      
      const noteContent = l.notes && l.notes.trim() ? l.notes.trim() : 'Sem observações';
      report += `   - *Obs:* ${noteContent}\n\n`;
    });

    report += `${separator}\n`;
    report += `*Relatório de Auditoria concluído.*`;
    setReportText(report);
    setIsReportOpen(true);
  };

  // Exportador PDF Profissional com quebra de página, layouts e estatísticas
  const handleExportPDF = () => {
    const doc = new jsPDF('p', 'mm', 'a4');
    
    doc.setProperties({
      title: 'Relatório de Auditoria e Gestão de Estoque',
      subject: 'Auditoria de Contagens',
      author: 'Sistema de Estoque',
      creator: 'Estoque Manager'
    });

    // Configurações de fonte
    doc.setFont("helvetica", "normal");
    
    // Cabeçalho elegante escuro
    doc.setFillColor(15, 23, 42); // slate-900 (combina com o lindo tema escuro)
    doc.rect(0, 0, 210, 42, 'F');
    
    // Título e detalhes do cabeçalho
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("RELATÓRIO DE AUDITORIA DE ESTOQUE", 15, 16);
    
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(203, 213, 225); // slate-300
    doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}`, 15, 24);
    
    const filterDesc = [
      userFilter ? `Colaborador: ${userFilter}` : '',
      dateFilter ? `Data: ${format(parseISO(dateFilter), 'dd/MM/yyyy')}` : '',
      (timeStart || timeEnd) ? `Horário: ${timeStart || '00:00'} - ${timeEnd || '23:59'}` : '',
      sectorFilter ? `Setor: ${sectorFilter}` : '',
      productFilter ? `Produto: ${uniqueProducts.find(p => p.id === productFilter)?.name || 'Específico'}` : ''
    ].filter(Boolean).join(' | ') || 'Nenhum (Relatório Geral)';
    
    doc.text(`Filtros: ${filterDesc}`, 15, 30);
    doc.text(`Total de registros: ${filteredLogs.length} contagem(ns)`, 15, 35);
    
    // Caixas de Resumo de Estatísticas
    doc.setTextColor(30, 41, 59); // slate-800
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Resumo Estatístico:", 15, 52);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    
    // Caixas de grade para estatísticas
    doc.setFillColor(241, 245, 249); // slate-100
    doc.rect(15, 56, 40, 16, 'F');
    doc.rect(60, 56, 40, 16, 'F');
    doc.rect(105, 56, 40, 16, 'F');
    doc.rect(150, 56, 45, 16, 'F');
    
    doc.setFont("helvetica", "bold");
    doc.text(`${filteredLogs.length}`, 35, 68, { align: 'center' });
    doc.text(`+${stats.positive}`, 80, 68, { align: 'center' });
    doc.text(`-${stats.negative}`, 125, 68, { align: 'center' });
    doc.text(`${stats.zero}`, 172.5, 68, { align: 'center' });
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text("TOTAL CONTAS", 35, 62, { align: 'center' });
    doc.text("SOBRAS (+)", 80, 62, { align: 'center' });
    doc.text("FALTAS (-)", 125, 62, { align: 'center' });
    doc.text("SEM DIVERGÊNCIA", 172.5, 62, { align: 'center' });
    
    let currentY = 82;
    
    // Cabeçalho da Tabela
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(15, currentY, 180, 8, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("Data/Hora", 15, currentY + 5.5);
    doc.text("Produto (SKU)", 43, currentY + 5.5);
    doc.text("Setor", 98, currentY + 5.5);
    doc.text("Responsável", 123, currentY + 5.5);
    doc.text("Contagem", 151, currentY + 5.5);
    doc.text("Divergência", 195, currentY + 5.5, { align: 'right' });
    
    currentY += 8;
    doc.setTextColor(30, 41, 59);
    
    filteredLogs.forEach((log) => {
      // Auto-paginação
      if (currentY > 270) {
        doc.addPage();
        currentY = 20;
        
        // Repintar Cabeçalho
        doc.setFillColor(15, 23, 42);
        doc.rect(15, currentY, 180, 8, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.text("Data/Hora", 15, currentY + 5.5);
        doc.text("Produto (SKU)", 43, currentY + 5.5);
        doc.text("Setor", 98, currentY + 5.5);
        doc.text("Responsável", 123, currentY + 5.5);
        doc.text("Contagem", 151, currentY + 5.5);
        doc.text("Divergência", 195, currentY + 5.5, { align: 'right' });
        currentY += 8;
        doc.setTextColor(30, 41, 59);
      }
      
      const mat = materials.find(m => m.id === log.materialId);
      const dateStr = format(parseISO(log.timestamp), "dd/MM/yyyy HH:mm");
      const matName = log.materialName || mat?.name || 'Material';
      const matCode = log.materialCode || mat?.code || '';
      const fullProductText = matCode ? `${matName} (${matCode})` : matName;
      const productToDisplay = fullProductText.length > 38 ? fullProductText.substring(0, 35) + '...' : fullProductText;
      const sectorDisplay = log.materialSector || mat?.sector || 'Geral';
      const sectorToDisplay = sectorDisplay.length > 15 ? sectorDisplay.substring(0, 13) + '...' : sectorDisplay;
      const userDisplay = log.userName || log.userId || 'Desconhecido';
      const userToDisplay = userDisplay.length > 16 ? userDisplay.substring(0, 14) + '...' : userDisplay;
      
      const diff = log.newQuantity - log.previousQuantity;
      const unit = formatUnit(mat?.unit);
      const qtyChangeText = `${log.previousQuantity} -> ${log.newQuantity} ${unit}`;
      const qtyChangeToDisplay = qtyChangeText.length > 20 ? qtyChangeText.substring(0, 18) + '..' : qtyChangeText;
      const diffText = diff > 0 ? `+${diff} ${unit}` : diff === 0 ? '0' : `${diff} ${unit}`;
      
      // Cores de alerta/zebra
      if (diff !== 0) {
        doc.setFillColor(254, 242, 242); // vermelho bem claro para divergência
      } else {
        doc.setFillColor(255, 255, 255);
      }
      doc.rect(15, currentY, 180, 6, 'F');
      
      doc.setDrawColor(229, 231, 235);
      doc.setLineWidth(0.1);
      doc.line(15, currentY + 6, 195, currentY + 6);
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(30, 41, 59);
      doc.text(dateStr, 15, currentY + 4.2);
      doc.text(productToDisplay, 43, currentY + 4.2);
      doc.text(sectorToDisplay, 98, currentY + 4.2);
      doc.text(userToDisplay, 123, currentY + 4.2);
      doc.text(qtyChangeToDisplay, 151, currentY + 4.2);
      
      if (diff > 0) {
        doc.setTextColor(16, 185, 129); // verde esmeralda
        doc.setFont("helvetica", "bold");
      } else if (diff < 0) {
        doc.setTextColor(239, 68, 68); // vermelho suave
        doc.setFont("helvetica", "bold");
      } else {
        doc.setTextColor(100, 116, 139); // cinza ardósia
      }
      doc.text(diffText, 195, currentY + 4.2, { align: 'right' });
      doc.setTextColor(30, 41, 59);
      doc.setFont("helvetica", "normal");
      
      currentY += 6;
      
      // Auto-embrulho de observações/comentários
      if (log.notes && log.notes.trim()) {
        const notesLines = doc.splitTextToSize(`Obs: ${log.notes.trim()}`, 170);
        notesLines.forEach((line: string) => {
          if (currentY > 275) {
            doc.addPage();
            currentY = 20;
          }
          
          doc.setFillColor(248, 250, 252); // fundo slate-50 para nota
          doc.rect(15, currentY, 180, 5, 'F');
          
          // Indicador vertical esquerdo Slate-200
          doc.setFillColor(226, 232, 240);
          doc.rect(15, currentY, 1.5, 5, 'F');
          
          doc.setFont("helvetica", "italic");
          doc.setFontSize(7.5);
          doc.setTextColor(100, 116, 139);
          doc.text(line, 19, currentY + 3.5);
          
          currentY += 5;
        });
        doc.setTextColor(30, 41, 59);
        doc.setFont("helvetica", "normal");
      }
    });
    
    // Bloco de Assinatura inferior
    if (currentY > 240) {
      doc.addPage();
      currentY = 30;
    } else {
      currentY += 20;
    }
    
    doc.setLineWidth(0.3);
    doc.setDrawColor(148, 163, 184);
    doc.line(60, currentY, 150, currentY);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.text("Assinatura do Gestor Responsável", 105, currentY + 5, { align: "center" });
    
    doc.save(`Auditoria_Estoque_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-muted-foreground flex flex-col items-center justify-center min-h-[400px]">
         <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
         <p className="text-lg font-medium">Analisando registros de contagem e auditoria...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-1 sm:px-4 pb-12 animate-in fade-in duration-500">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between bg-card border border-border p-6 rounded-2xl shadow-sm">
         <div>
            <h2 className="text-2xl font-bold text-foreground flex items-center gap-3">
               <History className="w-8 h-8 text-blue-500" /> 
               Auditoria e Gestão de Contagens
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
               Histórico consolidado, monitoramento de discrepâncias físicas e exportação de relatórios profissionais.
            </p>
         </div>
         <div className="flex flex-wrap gap-2 w-full md:w-auto">
            <button
               onClick={handleGenerateTextReport}
               className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-colors shadow-md shadow-blue-500/10"
            >
               <FileText className="w-4 h-4" />
               Gerar Relatório
            </button>
            <button
               onClick={() => handleExportPDF()}
               disabled={filteredLogs.length === 0}
               className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-secondary hover:bg-secondary/80 text-foreground border border-border rounded-xl text-sm font-medium transition-colors shadow-sm disabled:opacity-50"
            >
               <Download className="w-4 h-4 text-red-500" />
               Exportar PDF
            </button>
         </div>
      </div>

      {/* Bento Stats Highlight Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card border border-border p-4 rounded-xl flex items-center gap-3.5">
           <div className="p-3 bg-blue-500/10 text-blue-500 rounded-xl">
              <Package className="w-5 h-5" />
           </div>
           <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Filtrado</p>
              <h4 className="text-xl font-bold text-foreground mt-0.5">{stats.total}</h4>
           </div>
        </div>
        
        <div className="bg-card border border-border p-4 rounded-xl flex items-center gap-3.5">
           <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-xl">
              <TrendingUp className="w-5 h-5" />
           </div>
           <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Sobras (+)</p>
              <h4 className="text-xl font-bold text-emerald-500 mt-0.5">+{stats.positive}</h4>
           </div>
        </div>

        <div className="bg-card border border-border p-4 rounded-xl flex items-center gap-3.5">
           <div className="p-3 bg-red-500/10 text-red-500 rounded-xl">
              <TrendingDown className="w-5 h-5" />
           </div>
           <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Faltas (-)</p>
              <h4 className="text-xl font-bold text-red-500 mt-0.5">-{stats.negative}</h4>
           </div>
        </div>

        <div className="bg-card border border-border p-4 rounded-xl flex items-center gap-3.5">
           <div className="p-3 bg-slate-500/10 text-slate-500 rounded-xl">
              <CheckCircle2 className="w-5 h-5" />
           </div>
           <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Sem Desvios</p>
              <h4 className="text-xl font-bold text-muted-foreground mt-0.5">{stats.zero}</h4>
           </div>
        </div>
      </div>

      {/* Grid: Charts and Ranking */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         {/* Chart: Activity timeline */}
         <div className="lg:col-span-2 bg-card border border-border p-6 rounded-2xl shadow-sm flex flex-col">
            <h3 className="text-base font-bold text-foreground mb-4 flex items-center gap-2">
               <TrendingUp className="w-4 h-4 text-blue-500" /> Histórico Volumétrico de Contagens
            </h3>
            <div className="flex-1 min-h-[220px]">
               {activityTimelineData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                     <AreaChart data={activityTimelineData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                           <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                           </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="opacity-10" vertical={false} />
                        <XAxis dataKey="date" stroke="currentColor" className="text-xs opacity-50 font-mono" tickLine={false} axisLine={false} />
                        <YAxis stroke="currentColor" className="text-xs opacity-50 font-mono" tickLine={false} axisLine={false} />
                        <Tooltip 
                           contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '0.75rem', color: 'hsl(var(--foreground))' }}
                           itemStyle={{ color: '#3b82f6', fontWeight: 'bold' }}
                        />
                        <Area type="monotone" dataKey="contagens" name="Contagens" stroke="#3b82f6" strokeWidth={2.5} fillOpacity={1} fill="url(#colorCount)" />
                     </AreaChart>
                  </ResponsiveContainer>
               ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Sem dados de contagens registradas sob este filtro</div>
               )}
            </div>
         </div>

         {/* Ranking */}
         <div className="bg-card border border-border p-6 rounded-2xl shadow-sm flex flex-col">
            <h3 className="text-base font-bold text-foreground mb-4 flex items-center gap-2">
               <AlertTriangle className="w-4 h-4 text-red-500" /> Top Críticos de Reposição
            </h3>
            <div className="flex-1 overflow-auto space-y-4">
               {criticalReplacements.length > 0 ? (
                  criticalReplacements.map((item, i) => (
                     <div key={item.code} className={`flex items-center gap-3 border p-2.5 rounded-xl ${item.isPurchaseRequested ? 'bg-amber-500/5 border-amber-500/20' : 'bg-secondary/20 border-border/40'}`}>
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${item.isPurchaseRequested ? 'bg-amber-500/10 text-amber-500' : 'bg-red-500/10 text-red-500'}`}>
                           {i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                           <p className="text-xs font-semibold text-foreground truncate flex items-center gap-1.5">
                              {item.name}
                              {item.isPurchaseRequested && (
                                 <span className="text-[9px] bg-amber-500/10 text-amber-500 border border-amber-500/20 px-1 py-0.5 rounded font-mono shrink-0">Solicitado</span>
                              )}
                           </p>
                           <div className="w-full bg-secondary rounded-full h-1.5 mt-1 overflow-hidden">
                              <div 
                                 className={`h-full rounded-full ${item.isPurchaseRequested ? 'bg-amber-500' : 'bg-red-500'}`} 
                                 style={{ width: `${Math.max(5, Math.min(100, item.min > 0 ? (item.current / item.min) * 100 : 100))}%` }}
                              />
                           </div>
                        </div>
                        <div className="text-right shrink-0">
                           <p className={`text-xs font-bold ${item.isPurchaseRequested ? 'text-amber-500' : 'text-red-500'}`}>-{item.deficit} {item.unit}</p>
                           <p className="text-[9px] text-muted-foreground">min: {item.min}</p>
                        </div>
                     </div>
                  ))
               ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center py-4">
                     <Package className="w-10 h-10 text-emerald-500 mb-2 opacity-30" />
                     <p className="text-muted-foreground text-xs">Estoque totalmente regulado.<br/>Nenhuma carência crítica.</p>
                  </div>
               )}
            </div>
         </div>
      </div>

      {/* Research and Advanced Filter Console Panel */}
      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border bg-secondary/30 flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-blue-500" />
          <h3 className="font-bold text-sm text-foreground">Filtros de Pesquisa Avançados</h3>
          {(userFilter || dateFilter || timeStart || timeEnd || sectorFilter || productFilter) && (
             <button 
                onClick={() => { 
                  setUserFilter(''); 
                  setDateFilter(''); 
                  setTimeStart(''); 
                  setTimeEnd(''); 
                  setSectorFilter('');
                  setProductFilter('');
                }}
                className="text-xs text-blue-500 hover:text-blue-600 font-medium ml-auto flex items-center gap-1 bg-blue-500/5 px-2 py-1 rounded-md border border-blue-500/10"
             >
                <X className="w-3 h-3" /> Limpar Filtros
             </button>
          )}
        </div>
        
        {/* Dynamic Controls Grid */}
        <div className="p-5 grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-4 bg-card">
           {/* Attendant filter */}
           <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                 <User className="w-3.5 h-3.5 text-blue-500" /> Atendente/Contador
              </label>
              <select 
                 className="bg-secondary/40 border border-border rounded-xl px-3 py-2 text-sm text-foreground w-full focus:ring-2 focus:ring-blue-500/50 outline-none transition-all cursor-pointer h-[40px]"
                 value={userFilter}
                 onChange={e => setUserFilter(e.target.value)}
              >
                 <option value="">Todos os atendentes</option>
                 {users.map(u => (
                    <option key={u.id} value={u.name || u.id}>{u.name || u.id}</option>
                 ))}
                 {Array.from(new Set(logs.map(l => l.userName || l.userId))).filter(name => !users.find(u => u.name === name || u.id === name)).map(name => (
                    <option key={name} value={name}>{name}</option>
                 ))}
              </select>
           </div>

           {/* Sector filter */}
           <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                 <MapPin className="w-3.5 h-3.5 text-blue-500" /> Setor do Produto
              </label>
              <select 
                 className="bg-secondary/40 border border-border rounded-xl px-3 py-2 text-sm text-foreground w-full focus:ring-2 focus:ring-blue-500/50 outline-none transition-all cursor-pointer h-[40px]"
                 value={sectorFilter}
                 onChange={e => setSectorFilter(e.target.value)}
              >
                 <option value="">Todos os setores</option>
                 {uniqueSectors.map(sect => (
                    <option key={sect} value={sect}>{sect}</option>
                 ))}
              </select>
           </div>

           {/* Specific product filter */}
           <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                 <Package className="w-3.5 h-3.5 text-blue-500" /> Produto Específico
              </label>
              <select 
                 className="bg-secondary/40 border border-border rounded-xl px-3 py-2 text-sm text-foreground w-full focus:ring-2 focus:ring-blue-500/50 outline-none transition-all cursor-pointer h-[40px]"
                 value={productFilter}
                 onChange={e => setProductFilter(e.target.value)}
              >
                 <option value="">Todos os produtos</option>
                 {uniqueProducts.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
                 ))}
              </select>
           </div>

           {/* Day / Date filter */}
           <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                 <Calendar className="w-3.5 h-3.5 text-blue-500" /> Dia Específico
              </label>
              <input 
                 type="date" 
                 className="bg-secondary/40 border border-border rounded-xl px-3 py-2 text-sm text-foreground w-full focus:ring-2 focus:ring-blue-500/50 outline-none transition-all cursor-pointer h-[40px]"
                 value={dateFilter}
                 onChange={e => setDateFilter(e.target.value)}
              />
           </div>

           {/* Hour filter */}
           <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                 <Clock className="w-3.5 h-3.5 text-blue-500" /> Intervalo Horário (Filtro)
              </label>
              <div className="flex gap-2 items-center">
                 <input 
                    type="time" 
                    className="bg-secondary/40 border border-border rounded-xl px-2.5 py-2 text-xs text-foreground w-full focus:ring-2 focus:ring-blue-500/50 outline-none transition-all cursor-pointer h-[40px]"
                    value={timeStart}
                    onChange={e => setTimeStart(e.target.value)}
                    placeholder="Início"
                 />
                 <span className="text-muted-foreground text-xs font-bold">às</span>
                 <input 
                    type="time" 
                    className="bg-secondary/40 border border-border rounded-xl px-2.5 py-2 text-xs text-foreground w-full focus:ring-2 focus:ring-blue-500/50 outline-none transition-all cursor-pointer h-[40px]"
                    value={timeEnd}
                    onChange={e => setTimeEnd(e.target.value)}
                    placeholder="Fim"
                 />
              </div>
           </div>
        </div>
      </div>

      {/* Main Logs Table / Records List */}
      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border bg-card flex justify-between items-center flex-wrap gap-2">
           <h3 className="font-bold text-foreground text-base flex items-center gap-2">
              <History className="w-4 h-4 text-emerald-500" /> Registros de Contagem ({filteredLogs.length})
           </h3>
           <p className="text-xs text-muted-foreground font-mono">
              Visualizando {visibleLogs.length} de {filteredLogs.length} logs
           </p>
        </div>

        <div className="divide-y divide-border">
          {visibleLogs.map((log) => {
            const material = materials.find(m => m.id === log.materialId);
            const diff = log.newQuantity - log.previousQuantity;
            const unit = formatUnit(material?.unit);
            
            return (
              <div 
                 key={log.id} 
                 className="p-4 sm:p-5 hover:bg-secondary/20 transition-all duration-150 flex flex-col gap-3"
              >
                 {/* Top row */}
                 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-start sm:items-center gap-3">
                       <div className="w-8 h-8 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center font-bold text-xs shrink-0 self-center">
                          {log.userName?.charAt(0).toUpperCase() || '?'}
                       </div>
                       <div>
                          <div className="flex flex-wrap items-center gap-1.5">
                             <span className="font-bold text-foreground text-sm">{material?.name || log.materialName}</span>
                             {material?.code && (
                                <span className="text-[10px] font-mono text-muted-foreground bg-secondary px-1.5 py-0.5 rounded border border-border">
                                   {material.code}
                                </span>
                             )}
                             {log.materialSector && (
                                <span className="text-[10px] font-medium text-blue-500 bg-blue-500/10 px-1.5 py-0.5 rounded">
                                   {log.materialSector}
                                </span>
                             )}
                          </div>
                          
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                             <span className="font-medium text-foreground">{log.userName || log.userId || 'Desconhecido'}</span>
                             <span>•</span>
                             <span>{format(parseISO(log.timestamp), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
                          </div>
                       </div>
                    </div>

                    {/* Numeric Divergence Block */}
                    <div className="flex items-center gap-4 sm:justify-end self-end sm:self-auto bg-secondary/30 sm:bg-transparent p-2 rounded-xl sm:p-0">
                       <div className="text-right">
                          <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">Alteração</p>
                          <div className="flex items-center gap-1.5 text-xs text-foreground font-mono mt-0.5">
                             <span className="text-muted-foreground line-through opacity-60">{log.previousQuantity} {unit}</span>
                             <ArrowRight className="w-3 h-3 text-muted-foreground" />
                             <span className="font-bold">{log.newQuantity} {unit}</span>
                          </div>
                       </div>
                       
                       <div className="text-right min-w-[70px]">
                          <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-semibold mb-0.5">Divergência</p>
                          {diff > 0 ? (
                             <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                                +{diff} {unit}
                             </span>
                          ) : diff < 0 ? (
                             <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-red-500/10 text-red-500 border border-red-500/20">
                                {diff} {unit}
                             </span>
                          ) : (
                             <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-secondary text-muted-foreground border border-border">
                                Sem desvios
                             </span>
                          )}
                       </div>
                    </div>
                 </div>

                 {/* Comments/Notes Row */}
                 {log.notes && log.notes.trim() && (
                    <div className="flex items-start gap-2 bg-secondary/30 border border-border/60 p-3 rounded-xl">
                       <MessageSquare className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                       <p className="text-xs text-muted-foreground italic leading-relaxed">
                          "{log.notes.trim()}"
                       </p>
                    </div>
                 )}
              </div>
            );
          })}

          {filteredLogs.length === 0 && (
            <div className="p-16 text-center text-muted-foreground flex flex-col items-center justify-center">
               <Inbox className="w-12 h-12 mb-4 opacity-15" />
               <p className="text-base font-semibold">Nenhum registro localizado</p>
               <p className="text-sm mt-1 max-w-md">
                  Nenhuma contagem corresponde aos filtros aplicados. Tente alargar as buscas limpando os filtros.
               </p>
            </div>
          )}
        </div>

        {/* Load More Pagination Trigger Button */}
        {filteredLogs.length > visibleCount && (
          <div className="p-4 text-center border-t border-border bg-secondary/10">
             <button 
                onClick={() => setVisibleCount(prev => prev + 30)}
                className="px-6 py-2.5 bg-secondary hover:bg-secondary/80 text-foreground font-medium rounded-xl text-sm transition-all border border-border inline-flex items-center gap-2 shadow-sm hover:scale-[1.01]"
             >
                Carregar Mais Registros ({filteredLogs.length - visibleCount} restantes)
             </button>
          </div>
        )}
      </div>

      {/* Preview Modal for reports */}
      <ReportPreviewModal 
        isOpen={isReportOpen} 
        onClose={() => setIsReportOpen(false)} 
        reportText={reportText} 
        title="Relatório de Auditoria Filtrado"
        onExportPDF={() => {
          handleExportPDF();
          setIsReportOpen(false);
        }}
      />
    </div>
  );
}
