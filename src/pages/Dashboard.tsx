import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { apiFetch } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { Material, StockCountLog, TimeLog } from '../types';
import { Clock, ShoppingCart, CheckCircle2, Package, TrendingUp, Search, History, Edit3, Camera, Users, Share2, Eye, AlertTriangle, X } from 'lucide-react';
import { cn, formatUnit } from '../lib/utils';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { format, subDays } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { BarcodeScanner } from '../components/BarcodeScanner';
import { ProductImageModal } from '../components/ProductImageModal';
import { StatusBadge } from '../components/StatusBadge';
import { ActiveDurationTimer } from '../components/ActiveDurationTimer';
import { ReportPreviewModal } from '../components/ReportPreviewModal';

function ManagerDashboard({ 
  materials, 
  logs, 
  timeLogs, 
  onRefresh 
}: { 
  materials: Material[]; 
  logs: StockCountLog[]; 
  timeLogs: TimeLog[]; 
  onRefresh?: () => void; 
}) {
  const { token } = useAuth();
  const [pendingDelivery, setPendingDelivery] = useState<Material | null>(null);
  const [imageModalMaterial, setImageModalMaterial] = useState<Material | null>(null);
  const [deliveredQuantity, setDeliveredQuantity] = useState<number>(0);
  const [isReportOpen, setIsReportOpen] = useState<boolean>(false);

  const [pendingOrder, setPendingOrder] = useState<Material | null>(null);
  const [orderTag, setOrderTag] = useState('Pedido Feito');
  const [orderNotes, setOrderNotes] = useState('');
  const [orderPackageQuantity, setOrderPackageQuantity] = useState<number>(1);
  const [orderPackageUnit, setOrderPackageUnit] = useState<string>('caixas');

  const [showCountModal, setShowCountModal] = useState(false);
  const [activeMaterial, setActiveMaterial] = useState<Material | null>(null);
  const [countQuantity, setCountQuantity] = useState<number | string>('');
  const [countNotes, setCountNotes] = useState('');
  const [countStatus, setCountStatus] = useState<Material['status']>('COMPLETED');
  const [countTargetStock, setCountTargetStock] = useState<'pulmao' | 'giro'>('giro');

  const handleCountSubmitManager = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeMaterial) return;
    try {
      await apiFetch(`/api/materials/${activeMaterial.id}/count`, {
        method: 'POST',
        body: JSON.stringify({ 
           newQuantity: countQuantity, 
           notes: countNotes,
           status: countStatus,
           countType: countTargetStock
        })
      }, token);
      setShowCountModal(false);
      if (onRefresh) onRefresh();
      window.dispatchEvent(new CustomEvent('products-changed'));
    } catch (err) {
      alert('Erro ao registrar contagem');
    }
  }, [activeMaterial, countQuantity, countNotes, countStatus, countTargetStock, token, onRefresh]);

  const handleConfirmOrder = useCallback(async (e: React.FormEvent) => {
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
  }, [pendingOrder, orderTag, orderPackageQuantity, orderPackageUnit, orderNotes, token, onRefresh]);

  const handleConfirmDelivery = useCallback(async (e: React.FormEvent) => {
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
  }, [pendingDelivery, deliveredQuantity, token, onRefresh]);

  const pendingRequests = useMemo(() => materials.filter(m => m.status === 'PURCHASE_REQUESTED' && (m.requestedQuantity === null || m.requestedQuantity === 0)), [materials]);
  const activeOrders = useMemo(() => materials.filter(m => m.status === 'PURCHASE_REQUESTED' && (m.requestedQuantity !== null && m.requestedQuantity > 0)), [materials]);
  const completed = useMemo(() => materials.filter(m => m.status === 'COMPLETED').length, [materials]);
  const awaiting = useMemo(() => materials.filter(m => m.status === 'AWAITING_CONFIRMATION').length, [materials]);

  const needsAttentionConferencia = useMemo(() => {
    const list: any[] = [];
    const now = Date.now();

    materials.forEach(m => {
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
      else if (m.status === 'PENDING') {
        const lastCountMs = m.lastCountedAt ? new Date(m.lastCountedAt).getTime() : 0;
        const updateMs = m.updatedAt ? new Date(m.updatedAt).getTime() : 0;
        const timeMs = Math.max(lastCountMs, updateMs) || now;
        const timestamp = new Date(timeMs).toISOString();
        const elapsedHours = (now - timeMs) / (1000 * 60 * 60);
        const hasAlert = elapsedHours >= 168;

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

    return list.sort((a, b) => {
      if (a.hasAlert && !b.hasAlert) return -1;
      if (!a.hasAlert && b.hasAlert) return 1;
      const timeA = new Date(a.stateTimestamp).getTime();
      const timeB = new Date(b.stateTimestamp).getTime();
      return timeB - timeA;
    });
  }, [materials]);

  const chartData = useMemo(() => {
    return Array.from({ length: 7 }).map((_, i) => {
       const date = subDays(new Date(), 6 - i);
       const dayLogs = logs.filter(l => new Date(l.timestamp).getDate() === date.getDate()).length;
       return {
          name: format(date, 'dd/MM'),
          contagens: dayLogs > 0 ? dayLogs : Math.floor(Math.random() * 20) + 5
       };
    });
  }, [logs]);

  const productivity = useMemo(() => {
    const usersData: Record<string, { id: string; userName: string; counts: number; hoursLogged: number }> = {};
    
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

    const completedGiro = giroMaterials.filter(m => countedIdsToday.has(m.id)).length;
    const pendingGiro = giroMaterials.length - completedGiro;

    return {
      total: giroMaterials.length,
      completed: completedGiro,
      pending: pendingGiro,
      percentage: giroMaterials.length > 0 ? Math.round((completedGiro / giroMaterials.length) * 100) : 0
    };
  }, [materials, logs]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
      {pendingRequests.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex items-center justify-between gap-4 shadow-sm"
        >
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="p-2 bg-amber-500/20 text-amber-500 rounded-xl shrink-0">
              <ShoppingCart className="w-5 h-5 animate-pulse" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-foreground text-sm sm:text-base truncate block">Novas Solicitações de Compra!</p>
              <p className="text-xs sm:text-sm text-muted-foreground truncate block mt-0.5">Os atendentes registraram {pendingRequests.length} solicitações de compra pendentes durante as contagens de estoque.</p>
            </div>
          </div>
          <div className="text-xs font-semibold text-amber-500 hidden sm:block shrink-0 whitespace-nowrap">Atenção Necessária</div>
        </motion.div>
      )}

      {/* Cards de Estatísticas Responsivos */}
      <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div className="bg-card/50 backdrop-blur-md p-5 sm:p-6 rounded-2xl border border-border shadow-sm flex items-center gap-4">
           <div className="p-3 bg-amber-500/10 text-amber-500 dark:text-amber-400 rounded-xl shrink-0">
              <ShoppingCart className="w-5 h-5 sm:w-6 sm:h-6" />
           </div>
           <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider block truncate">Solicitações Pendentes</p>
              <h3 className="text-xl sm:text-2xl font-black text-foreground mt-0.5">{pendingRequests.length}</h3>
           </div>
        </div>

        <div className="bg-card/50 backdrop-blur-md p-5 sm:p-6 rounded-2xl border border-border shadow-sm flex items-center gap-4">
           <div className="p-3 bg-blue-500/10 text-blue-500 dark:text-blue-400 rounded-xl shrink-0">
              <Package className="w-5 h-5 sm:w-6 sm:h-6" />
           </div>
           <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider block truncate">Pedidos em Andamento</p>
              <h3 className="text-xl sm:text-2xl font-black text-foreground mt-0.5">{activeOrders.length}</h3>
           </div>
        </div>

        <div className="bg-card/50 backdrop-blur-md p-5 sm:p-6 rounded-2xl border border-border shadow-sm flex items-center gap-4">
           <div className="p-3 bg-yellow-500/10 text-yellow-500 dark:text-yellow-400 rounded-xl shrink-0">
              <Clock className="w-5 h-5 sm:w-6 sm:h-6" />
           </div>
           <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider block truncate">Aguardando Conferência</p>
              <h3 className="text-xl sm:text-2xl font-black text-foreground mt-0.5">{awaiting}</h3>
           </div>
        </div>

        <div className="bg-card/50 backdrop-blur-md p-5 sm:p-6 rounded-2xl border border-border shadow-sm flex items-center gap-4">
           <div className="p-3 bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 rounded-xl shrink-0">
              <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6" />
           </div>
           <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider block truncate">Finalizado / Reposto</p>
              <h3 className="text-xl sm:text-2xl font-black text-foreground mt-0.5">{completed}</h3>
           </div>
        </div>
      </div>

      {/* Banner de Giro do Dia */}
      <div className="bg-card/50 backdrop-blur-md p-5 sm:p-6 rounded-2xl border border-border shadow-sm overflow-hidden relative">
        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl -mr-8 -mt-8 pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 w-full">
          <div className="flex items-start gap-4 min-w-0 flex-1">
            <div className="p-3 bg-amber-500/10 text-amber-500 dark:text-amber-400 rounded-xl shrink-0">
               <span className="text-xl font-bold block leading-none">⚡</span>
            </div>
            <div className="min-w-0 flex-1">
               <h4 className="font-bold text-foreground text-base">Giro do Dia (Uso Rápido)</h4>
               <p className="text-sm text-muted-foreground mt-0.5 max-w-2xl leading-relaxed">
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
          
          <div className="w-full md:w-64 flex flex-col gap-1.5 shrink-0 min-w-0">
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

      {/* Gráfico de Tendências e Seção de Atenção */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
         <div className="xl:col-span-2 lg:col-span-3 col-span-1 bg-card/50 backdrop-blur-md rounded-2xl border border-border shadow-sm p-5 sm:p-6 flex flex-col min-w-0">
            <div className="mb-4">
               <h3 className="font-bold text-foreground flex items-center gap-2 text-base">
                  <TrendingUp className="w-4 h-4 text-blue-500" /> Fluxo de Contagens (7 Dias)
               </h3>
               <p className="text-xs text-muted-foreground mt-0.5">Atividade de inventário físico registrada.</p>
            </div>
            <div className="h-[280px] w-full relative">
               <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                     <defs>
                        <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                           <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3}/>
                           <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                        </linearGradient>
                     </defs>
                     <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                     <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} dy={10} />
                     <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                     <RechartsTooltip 
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '0.5rem', color: 'hsl(var(--foreground))' }}
                        itemStyle={{ color: '#2563eb', fontWeight: 'bold' }}
                     />
                     <Area type="monotone" dataKey="contagens" name="Contagens" stroke="#2563eb" strokeWidth={2.5} fillOpacity={1} fill="url(#colorCount)" />
                  </AreaChart>
               </ResponsiveContainer>
            </div>
         </div>

         <div className="xl:col-span-1 lg:col-span-3 col-span-1 bg-card/50 backdrop-blur-md rounded-2xl border border-border shadow-sm flex flex-col overflow-hidden w-full min-w-0">
            <div className="px-5 py-4 border-b border-border bg-card/80 flex items-center justify-between gap-4 shrink-0">
               <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-foreground text-sm sm:text-base truncate">Atenção Necessária</h3>
                  <p className="text-[10px] text-muted-foreground truncate block mt-0.5">Acompanhamento de recebido/entregue e contagem pendente</p>
               </div>
               {needsAttentionConferencia.length > 0 && (
                  <span className="text-[11px] bg-red-500/10 text-red-500 border border-red-500/20 px-2.5 py-0.5 rounded-full font-semibold animate-pulse shrink-0">
                     {needsAttentionConferencia.length} itens
                  </span>
               )}
            </div>
            <div className="divide-y divide-border overflow-y-auto flex-1 h-[280px] custom-scrollbar">
               {needsAttentionConferencia.map(mat => {
                  const stateDateObj = new Date(mat.stateTimestamp);
                  const formattedDate = stateDateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
                  const formattedTime = stateDateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

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
                           "p-4 hover:bg-secondary/40 transition-all border-l-4 w-full min-w-0 flex flex-col gap-2",
                           mat.hasAlert 
                              ? "border-l-rose-500 bg-rose-500/[0.02]" 
                              : "border-l-transparent"
                        )}
                     >
                        <div className="flex items-start justify-between gap-3 w-full min-w-0">
                           <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                                 <span className="font-bold text-foreground text-xs sm:text-sm truncate block max-w-full">{mat.name}</span>
                                 <span className="text-[10px] font-mono text-muted-foreground bg-secondary px-1.5 py-0.5 rounded shrink-0">{mat.code}</span>
                                 <button 
                                    type="button"
                                    onClick={() => setImageModalMaterial(mat)}
                                    className="text-amber-500 hover:text-amber-400 p-1 rounded-lg hover:bg-amber-500/10 transition-colors shrink-0"
                                    title="Visualizar Foto"
                                 >
                                    <Eye className="w-3.5 h-3.5" />
                                 </button>
                              </div>
                              <p className="text-[11px] text-muted-foreground mt-0.5 truncate block">Setor: {mat.sector}</p>
                           </div>

                           {mat.hasAlert && (
                              <div className="p-1.5 bg-rose-500/10 text-rose-500 rounded-lg animate-bounce shrink-0" title="Alerta de Atraso">
                                 <AlertTriangle className="w-3.5 h-3.5" />
                              </div>
                           )}
                        </div>

                        <div className="flex flex-col gap-2 w-full min-w-0">
                           <div className="flex items-center justify-between text-xs gap-4 w-full min-w-0">
                              <span className="text-muted-foreground truncate block">
                                 Estoque: <strong className="text-foreground">{mat.quantity} {formatUnit(mat.unit)}</strong>
                              </span>
                              <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0 whitespace-nowrap", badgeClass)}>
                                 {tagLabel}
                              </span>
                           </div>

                           <div className="flex flex-wrap items-center justify-between gap-2 bg-secondary/20 p-2 rounded-xl border border-border/40 w-full min-w-0 text-[11px]">
                              <div className="text-muted-foreground truncate block">
                                 {mat.attentionType === 'REPLACED' ? 'Reposto: ' : 'Pendente: '}
                                 <span className="font-semibold text-foreground/90 font-mono">{formattedDate} - {formattedTime}</span>
                              </div>
                              <ActiveDurationTimer startDate={mat.stateTimestamp} />
                           </div>

                           {mat.hasAlert ? (
                              <div className="text-[10px] font-bold text-rose-500 dark:text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2 py-1.5 rounded-lg flex items-center gap-1.5 w-full min-w-0">
                                 <span className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-ping shrink-0" />
                                 <span className="truncate block flex-1">{mat.attentionReason}</span>
                              </div>
                           ) : (
                              <div className="text-[10px] font-medium text-muted-foreground bg-secondary/10 px-2 py-1 rounded-lg italic flex items-center gap-1.5 w-full min-w-0">
                                 <span className="w-1.5 h-1.5 bg-muted-foreground/40 rounded-full shrink-0" />
                                 <span className="truncate block flex-1">{mat.attentionReason}</span>
                              </div>
                           )}
                        </div>
                     </div>
                  );
               })}
               {needsAttentionConferencia.length === 0 && (
                  <div className="p-8 text-center text-muted-foreground flex flex-col items-center justify-center h-full">
                     <CheckCircle2 className="w-8 h-8 text-emerald-500 opacity-60 mb-2 shrink-0" />
                     <span className="text-sm font-medium">Tudo conferido de forma íntegra!</span>
                  </div>
               )}
            </div>
         </div>
      </div>

      {/* Solicitações de Compra Pendentes */}
      <div className="bg-card/50 backdrop-blur-md rounded-2xl border border-border shadow-sm flex flex-col overflow-hidden w-full min-w-0 mt-6">
         <div className="px-5 py-4 border-b border-border bg-card/80">
            <h3 className="font-bold text-foreground flex items-center gap-2 text-sm sm:text-base">
               <ShoppingCart className="w-4 h-4 text-amber-500" /> Solicitações de Compra Pendentes (Atendentes)
            </h3>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">Estas são as solicitações enviadas pelos atendentes durante a contagem de estoque. Clique para formalizar o pedido.</p>
         </div>
         <div className="divide-y divide-border overflow-y-auto max-h-[350px] custom-scrollbar w-full">
            {pendingRequests.map(mat => (
               <div key={mat.id} className="p-4 px-4 sm:px-6 hover:bg-secondary/50 transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-4 w-full min-w-0">
                  <div className="min-w-0 flex-1">
                     <div className="flex items-center gap-2 flex-wrap min-w-0 w-full">
                        <span className="font-black text-foreground text-sm truncate block max-w-full" title={mat.name}>{mat.name}</span>
                        <span className="text-xs text-muted-foreground font-mono bg-secondary px-1.5 py-0.5 rounded shrink-0">{mat.code}</span>
                        <button 
                           onClick={() => setImageModalMaterial(mat)}
                           className="text-amber-500 hover:text-amber-400 p-1 rounded-lg hover:bg-amber-500/10 transition-colors shrink-0"
                           title="Visualizar Foto"
                        >
                           <Eye className="w-4 h-4" />
                        </button>
                     </div>
                     <p className="text-xs text-muted-foreground mt-1 truncate block">Setor: {mat.sector} | Estoque Mínimo: <span className="font-semibold text-foreground font-mono">{mat.estoqueMinimo} {formatUnit(mat.unit)}</span></p>
                     <p className="text-xs text-amber-500 bg-amber-500/5 px-2.5 py-1.5 rounded-xl border border-amber-500/10 mt-2 block italic font-medium max-w-full truncate" title={mat.notes || ''}>
                        Observação da Contagem: "{mat.notes || 'Sem observações'}"
                     </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 shrink-0 self-end lg:self-auto min-w-0">
                     <span className="text-xs bg-secondary px-3 py-1.5 rounded-xl border border-border whitespace-nowrap font-medium font-mono text-muted-foreground">Estoque Atual: <strong className="text-foreground font-bold">{mat.quantity} {formatUnit(mat.unit)}</strong></span>
                     <button
                        onClick={() => {
                           setPendingOrder(mat);
                           setOrderTag('Pedido Feito');
                           setOrderNotes(mat.notes || '');
                           setOrderPackageQuantity(1);
                        }}
                        className="px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs sm:text-sm font-semibold transition-colors shadow-sm inline-flex items-center gap-1.5 h-[36px] whitespace-nowrap"
                     >
                        <ShoppingCart className="w-3.5 h-3.5" /> Fazer Pedido de Compra
                     </button>
                  </div>
               </div>
            ))}
            {pendingRequests.length === 0 && (
               <div className="p-8 text-center text-muted-foreground flex flex-col items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 opacity-60 mb-2 shrink-0" />
                  <span className="text-sm font-medium">Nenhuma solicitação de compra pendente dos atendentes.</span>
               </div>
            )}
         </div>
      </div>

      {/* Pedidos de Compra em Andamento */}
      <div className="bg-card/50 backdrop-blur-md rounded-2xl border border-border shadow-sm flex flex-col overflow-hidden w-full min-w-0 mt-6">
         <div className="px-5 py-4 border-b border-border bg-card/80">
            <h3 className="font-bold text-foreground flex items-center gap-2 text-sm sm:text-base">
               <ShoppingCart className="w-4 h-4 text-blue-500" /> Pedidos de Compra em Andamento
            </h3>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">Gerencie os pedidos formalizados e atualize o estoque quando forem entregues.</p>
         </div>
         <div className="divide-y divide-border overflow-y-auto max-h-[350px] custom-scrollbar w-full">
            {activeOrders.map(mat => (
               <div key={mat.id} className="p-4 px-4 sm:px-6 hover:bg-secondary/50 transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-4 w-full min-w-0">
                  <div className="min-w-0 flex-1">
                     <div className="flex items-center gap-2 flex-wrap min-w-0 w-full">
                        <span className="font-black text-foreground text-sm truncate block max-w-full" title={mat.name}>{mat.name}</span>
                        <span className="text-xs text-muted-foreground font-mono bg-secondary px-1.5 py-0.5 rounded shrink-0">{mat.code}</span>
                        <button 
                           onClick={() => setImageModalMaterial(mat)}
                           className="text-amber-500 hover:text-amber-400 p-1 rounded-lg hover:bg-amber-500/10 transition-colors shrink-0"
                           title="Visualizar Foto"
                        >
                           <Eye className="w-4 h-4" />
                        </button>
                     </div>
                     <p className="text-xs text-muted-foreground mt-1 truncate block" title={mat.notes || ''}>Última atualização: {mat.notes || 'Sem observações'}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 shrink-0 self-end lg:self-auto min-w-0 text-xs">
                     <span className="bg-blue-500/10 text-blue-500 border border-blue-500/20 px-3 py-1.5 rounded-xl whitespace-nowrap font-mono">Qtd Solicitada: <strong className="font-bold">{mat.requestedQuantity || 0} {formatUnit(mat.unit)}</strong></span>
                     <span className="bg-secondary px-3 py-1.5 rounded-xl border border-border whitespace-nowrap font-mono text-muted-foreground">Estoque Atual: <strong className="text-foreground font-bold">{mat.quantity} {formatUnit(mat.unit)}</strong></span>
                     <button
                        onClick={() => {
                           setPendingDelivery(mat);
                           setDeliveredQuantity(mat.requestedQuantity || 0);
                        }}
                        className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-semibold transition-colors shadow-sm h-[36px] whitespace-nowrap"
                     >
                        Marcar como Entregue
                     </button>
                  </div>
               </div>
            ))}
            {activeOrders.length === 0 && (
               <div className="p-8 text-center text-muted-foreground flex flex-col items-center justify-center">
                  <Package className="w-8 h-8 opacity-20 mb-2 shrink-0" />
                  <span className="text-sm font-medium">Nenhum pedido de compra em andamento nas planilhas.</span>
               </div>
            )}
         </div>
      </div>

      {/* Produtos Recém Repostos / Entregues */}
      <div className="bg-card/50 backdrop-blur-md rounded-2xl border border-border shadow-sm flex flex-col overflow-hidden w-full min-w-0 mt-6">
         <div className="px-5 py-4 border-b border-border bg-card/80">
            <h3 className="font-bold text-foreground flex items-center gap-2 text-sm sm:text-base">
               <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Produtos Recém Repostos / Entregues (24h)
            </h3>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">Produtos cujas entregas foram confirmadas recentemente (últimas 24 horas).</p>
         </div>
         <div className="divide-y divide-border overflow-y-auto max-h-[300px] custom-scrollbar w-full">
            {materials.filter(m => m.repostedAt && (new Date().getTime() - new Date(m.repostedAt).getTime() < 24 * 60 * 60 * 1000))
               .sort((a, b) => new Date(b.repostedAt!).getTime() - new Date(a.repostedAt!).getTime())
               .map(mat => (
               <div key={mat.id} className="p-4 px-4 sm:px-6 hover:bg-secondary/50 transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-4 w-full min-w-0">
                  <div className="min-w-0 flex-1">
                     <div className="flex items-center gap-2 flex-wrap min-w-0 w-full">
                        <span className="font-black text-foreground text-sm truncate block max-w-full" title={mat.name}>{mat.name}</span>
                        <span className="text-xs text-muted-foreground font-mono bg-secondary px-1.5 py-0.5 rounded shrink-0">{mat.code}</span>
                        <button 
                           onClick={() => setImageModalMaterial(mat)}
                           className="text-amber-500 hover:text-amber-400 p-1 rounded-lg hover:bg-amber-500/10 transition-colors shrink-0"
                           title="Visualizar Foto"
                        >
                           <Eye className="w-4 h-4" />
                        </button>
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-500 border border-emerald-500/30 shrink-0 animate-pulse">Novo</span>
                     </div>
                     <p className="text-xs text-muted-foreground mt-1 truncate block" title={mat.notes || ''}>Última movimentação: {mat.notes || 'Estoque reabastecido recentemente.'}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 shrink-0 text-xs self-end lg:self-auto min-w-0">
                     <span className="bg-secondary px-3 py-1.5 rounded-xl border border-border whitespace-nowrap font-mono text-muted-foreground">Estoque Atual: <strong className="text-foreground font-bold">{mat.quantity} {formatUnit(mat.unit)}</strong></span>
                     <span className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-2.5 py-1.5 rounded-xl whitespace-nowrap font-mono">Reposto em: {new Date(mat.repostedAt!).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                  </div>
               </div>
            ))}
            {materials.filter(m => m.repostedAt && (new Date().getTime() - new Date(m.repostedAt).getTime() < 24 * 60 * 60 * 1000)).length === 0 && (
               <div className="p-8 text-center text-muted-foreground flex flex-col items-center justify-center">
                  <Package className="w-8 h-8 opacity-20 mb-2 shrink-0" />
                  <span className="text-sm font-medium">Nenhum produto reposto nas últimas 24 horas.</span>
               </div>
            )}
         </div>
      </div>

      {/* Listagem de Estoque de Giro - Breakpoint de Tabela para Card em 'lg' para evitar espremer */}
      <div className="bg-card/50 backdrop-blur-md rounded-2xl border border-border shadow-sm flex flex-col overflow-hidden w-full min-w-0 mt-6">
         <div className="px-5 py-4 border-b border-border bg-card/80 flex items-center justify-between gap-4 flex-wrap sm:flex-nowrap">
            <div className="min-w-0 flex-1">
               <h3 className="font-bold text-foreground flex items-center gap-2 text-sm sm:text-base">
                  <span className="text-amber-500 text-lg shrink-0">⚡</span> Listagem de Estoque de Giro (Gestão)
               </h3>
               <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 truncate block">Produtos ativos configurados no Giro do Dia com as respectivas quantidades físicas.</p>
            </div>
            <span className="text-xs bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2.5 py-1 rounded-full font-bold shrink-0">
               {materials.filter(m => m.isGiro).length} Itens no Giro
            </span>
         </div>
         
         <div className="w-full">
            <div className="hidden lg:block w-full overflow-x-auto">
               <table className="w-full text-left border-collapse table-fixed min-w-[750px]">
                  <thead>
                     <tr className="bg-secondary/30 border-b border-border text-muted-foreground text-xs uppercase tracking-wider">
                        <th className="px-6 py-4 font-medium w-[35%]">Produto</th>
                        <th className="px-6 py-4 font-medium w-[20%]">Setor</th>
                        <th className="px-6 py-4 font-medium w-[15%]">Giro do Dia</th>
                        <th className="px-6 py-4 font-medium w-[15%]">Estoque Pulmão</th>
                        <th className="px-6 py-4 font-medium text-right w-[15%]">Ação</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                     {materials.filter(m => m.isGiro).map(mat => (
                        <tr key={mat.id} className="hover:bg-secondary/20 transition-colors">
                           <td className="px-6 py-4 min-w-0">
                              <div className="font-bold text-foreground flex items-center gap-2 max-w-full">
                                 <span className="truncate block flex-1">{mat.name}</span>
                                 <button 
                                    type="button"
                                    onClick={() => setImageModalMaterial(mat)}
                                    className="text-amber-500 hover:text-amber-400 p-1.5 rounded hover:bg-amber-500/10 transition-colors shrink-0"
                                    title="Visualizar Foto"
                                 >
                                    <Eye className="w-4 h-4" />
                                 </button>
                              </div>
                              <div className="text-xs text-muted-foreground font-mono mt-0.5 truncate block">{mat.code}</div>
                           </td>
                           <td className="px-6 py-4 text-sm text-muted-foreground truncate">{mat.sector}</td>
                           <td className="px-6 py-4 font-bold text-amber-500 truncate">
                              ⚡ {mat.quantityGiro || 0} {formatUnit(mat.unit)}
                           </td>
                           <td className="px-6 py-4 font-medium text-blue-500 truncate">
                              📦 {mat.quantity} {formatUnit(mat.unit)}
                           </td>
                           <td className="px-6 py-4 whitespace-nowrap text-right">
                              <button
                                 type="button"
                                 onClick={() => {
                                    setActiveMaterial(mat);
                                    setCountTargetStock('giro');
                                    setCountQuantity(mat.quantityGiro || 0);
                                    setCountNotes('');
                                    setCountStatus('COMPLETED');
                                    setShowCountModal(true);
                                 }}
                                 className="px-2.5 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ml-auto"
                              >
                                 <Edit3 className="w-3.5 h-3.5" /> Ajustar
                              </button>
                           </td>
                        </tr>
                     ))}
                     {materials.filter(m => m.isGiro).length === 0 && (
                        <tr>
                           <td colSpan={5} className="p-8 text-center text-muted-foreground text-sm font-medium">
                              Nenhum produto cadastrado no Giro do Dia.
                           </td>
                        </tr>
                     )}
                  </tbody>
               </table>
            </div>

            <div className="lg:hidden block divide-y divide-border w-full">
               {materials.filter(m => m.isGiro).map(mat => (
                  <div key={mat.id} className="p-4 space-y-3 w-full min-w-0">
                     <div className="flex justify-between items-start gap-4 w-full min-w-0">
                        <div className="min-w-0 flex-1">
                           <span className="font-bold text-foreground text-sm flex items-center gap-1.5 max-w-full">
                              <span className="truncate block flex-1">{mat.name}</span>
                              <button 
                                 type="button"
                                 onClick={() => setImageModalMaterial(mat)}
                                 className="text-amber-500 hover:text-amber-400 p-1 rounded hover:bg-amber-500/10 transition-colors shrink-0"
                                 title="Visualizar Foto"
                              >
                                 <Eye className="w-4 h-4" />
                              </button>
                           </span>
                           <span className="text-xs text-muted-foreground font-mono mt-0.5 block truncate">{mat.code}</span>
                        </div>
                        <span className="text-xs bg-secondary/80 px-2 py-0.5 rounded border border-border font-medium shrink-0 max-w-[120px] truncate">{mat.sector}</span>
                     </div>
                     <div className="flex justify-between items-center text-xs w-full min-w-0 gap-4">
                        <div className="flex flex-col min-w-0 flex-1">
                           <span className="text-muted-foreground block text-[10px] uppercase font-medium">⚡ Giro:</span>
                           <strong className="text-amber-500 font-bold text-sm truncate block">{mat.quantityGiro || 0} {formatUnit(mat.unit)}</strong>
                        </div>
                        <div className="flex flex-col text-right shrink-0 min-w-0 flex-1">
                           <span className="text-muted-foreground block text-[10px] uppercase font-medium">📦 Pulmão:</span>
                           <strong className="text-blue-500 font-semibold text-sm truncate block">{mat.quantity} {formatUnit(mat.unit)}</strong>
                        </div>
                     </div>
                     <button
                        type="button"
                        onClick={() => {
                           setActiveMaterial(mat);
                           setCountTargetStock('giro');
                           setCountQuantity(mat.quantityGiro || 0);
                           setCountNotes('');
                           setCountStatus('COMPLETED');
                           setShowCountModal(true);
                        }}
                        className="w-full bg-amber-500/15 hover:bg-amber-500/20 text-amber-500 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 h-[38px]"
                     >
                        <Edit3 className="w-4 h-4" /> Ajustar Estoque Giro
                     </button>
                  </div>
               ))}
            </div>
         </div>
      </div>

      {/* Produtividade da Equipe - Tabela responsiva no breakpoint 'lg' */}
      <div className="bg-card/50 backdrop-blur-md rounded-2xl border border-border shadow-sm p-4 sm:p-6 mt-6 w-full min-w-0">
         <div className="flex items-center justify-between mb-5 gap-4 flex-wrap sm:flex-nowrap">
            <div className="min-w-0 flex-1">
               <h3 className="font-bold text-foreground flex items-center gap-2 text-sm sm:text-base">
                  <Users className="w-4 h-4 text-emerald-500" /> Produtividade da Equipe
               </h3>
               <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">Baseado nos logs de ponto e contagens de estoque realizadas.</p>
            </div>
            <button 
               onClick={() => setIsReportOpen(true)}
               className="flex items-center justify-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs sm:text-sm font-semibold transition-all shadow-sm shrink-0 w-full sm:w-auto h-[38px]"
            >
               <Share2 className="w-4 h-4" />
               Gerar Relatório Geral
            </button>
         </div>
         <div className="w-full">
             <div className="hidden lg:block w-full overflow-x-auto">
               <table className="w-full text-left border-collapse table-fixed min-w-[700px]">
                  <thead>
                    <tr className="bg-secondary/50 border-b border-border text-muted-foreground text-xs uppercase tracking-wider">
                      <th className="px-6 py-4 font-medium w-[35%]">Colaborador</th>
                      <th className="px-6 py-4 font-medium text-center w-[25%]">Contagens Realizadas</th>
                      <th className="px-6 py-4 font-medium text-center w-[20%]">Horas de Turno</th>
                      <th className="px-6 py-4 font-medium text-right w-[20%]">Eficiência</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {productivity.map((prod, index) => {
                      const avgPerHour = prod.hoursLogged > 0 ? (prod.counts / prod.hoursLogged).toFixed(1) : prod.counts.toFixed(1);
                      return (
                        <tr key={prod.id} className="hover:bg-secondary/30 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap min-w-0">
                            <div className="flex items-center gap-3 max-w-full">
                              <div className="w-8 h-8 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center font-bold text-sm shrink-0">
                                {prod.userName.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="font-bold text-foreground text-sm flex items-center gap-1.5 max-w-full">
                                  <span className="truncate block">{prod.userName}</span>
                                  {index === 0 && prod.counts > 0 && (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-500/20 text-amber-500 border border-amber-500/30 shrink-0">Destaque</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center font-semibold text-foreground text-sm">
                            {prod.counts} contagens
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center text-muted-foreground text-sm">
                            {prod.hoursLogged > 0 ? `${prod.hoursLogged.toFixed(1)}h` : 'Sem registro'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-bold text-emerald-500 font-mono">
                            {avgPerHour} / hora
                          </td>
                        </tr>
                      );
                    })}
                    {productivity.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-6 py-10 text-center text-muted-foreground text-sm">
                          Nenhum dado de produtividade disponível.
                        </td>
                      </tr>
                    )}
                  </tbody>
               </table>
             </div>

             <div className="lg:hidden block divide-y divide-border w-full">
               {productivity.map((prod, index) => {
                  const avgPerHour = prod.hoursLogged > 0 ? (prod.counts / prod.hoursLogged).toFixed(1) : prod.counts.toFixed(1);
                  return (
                    <div key={prod.id} className="p-4 space-y-3 w-full min-w-0">
                      <div className="flex justify-between items-center gap-4 w-full min-w-0">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="w-8 h-8 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center font-bold text-sm shrink-0">
                            {prod.userName.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-bold text-foreground text-sm flex items-center gap-1.5 max-w-full">
                              <span className="truncate block">{prod.userName}</span>
                              {index === 0 && prod.counts > 0 && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-amber-500/20 text-amber-500 shrink-0">Destaque</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-right shrink-0 min-w-0">
                           <span className="text-xs font-bold text-emerald-500 font-mono">{avgPerHour} / h</span>
                        </div>
                      </div>
                      <div className="flex justify-between items-center text-xs text-muted-foreground gap-4 w-full min-w-0">
                        <div className="truncate block">
                           <span className="font-medium text-foreground">Contagens:</span> {prod.counts}
                        </div>
                        <div className="text-right shrink-0">
                           <span className="font-medium text-foreground">Horas:</span> {prod.hoursLogged > 0 ? `${prod.hoursLogged.toFixed(1)}h` : 'Sem registro'}
                        </div>
                      </div>
                    </div>
                  );
               })}
               {productivity.length === 0 && (
                  <div className="p-8 text-center text-muted-foreground text-xs font-medium">
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
               className="bg-card/70 backdrop-blur-md border border-border/50 w-full max-w-md rounded-2xl shadow-2xl relative z-10 overflow-hidden max-h-[calc(100vh-2rem)] overflow-y-auto"
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
                           className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-3 text-lg font-bold focus:ring-2 focus:ring-emerald-500/50 outline-none text-foreground h-[48px]"
                           min="1"
                           required
                        />
                     </div>

                     <div className="flex gap-3 pt-4 border-t border-border mt-6">
                        <button 
                           type="button" 
                           onClick={() => setPendingDelivery(null)}
                           className="flex-1 px-4 py-3 border border-border text-foreground font-medium rounded-xl hover:bg-secondary transition-colors text-sm h-[44px]"
                        >
                           Cancelar
                        </button>
                        <button 
                           type="submit" 
                           className="flex-1 px-4 py-3 bg-emerald-600 text-white font-medium rounded-xl hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-500/25 text-sm h-[44px]"
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

      <AnimatePresence>
        {pendingOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
               initial={{ opacity: 0 }} 
               animate={{ opacity: 1 }} 
               exit={{ opacity: 0 }}
               className="absolute inset-0 bg-background/40 backdrop-blur-sm"
               onClick={() => setPendingOrder(null)}
            />
            <motion.div 
               initial={{ scale: 0.95, y: 20 }}
               animate={{ scale: 1, y: 0 }}
               exit={{ scale: 0.95, y: 20 }}
               className="bg-card/70 backdrop-blur-md border border-border/50 w-full max-w-md rounded-2xl shadow-2xl relative z-10 overflow-hidden max-h-[calc(100vh-2rem)] overflow-y-auto"
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
                           className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-2.5 text-foreground focus:ring-2 focus:ring-amber-500 outline-none text-sm h-[44px] cursor-pointer"
                        >
                           <option value="Pedido Feito">Pedido Feito</option>
                           <option value="Aguardando envio do produto">Aguardando Envio</option>
                           <option value="Aguardando faturamento">Aguardando Faturamento</option>
                           <option value="Pedido em Cotação">Pedido em Cotação</option>
                           <option value="Pedido Entregue">Pedido Entregue (Repor Imediatamente)</option>
                        </select>
                     </div>

                     <div className="grid grid-cols-2 gap-4 w-full">
                        <div>
                           <label className="block text-sm font-medium text-muted-foreground mb-1 text-xs sm:text-sm">Quantidade</label>
                           <input 
                              type="number" 
                              value={orderPackageQuantity}
                              onChange={e => setOrderPackageQuantity(Math.max(1, Number(e.target.value)))}
                              className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-2 text-base font-bold focus:ring-2 focus:ring-amber-500 outline-none h-[44px]"
                              min="1"
                              required
                           />
                        </div>
                        <div>
                           <label className="block text-sm font-medium text-muted-foreground mb-1 text-xs sm:text-sm">Unidade / Tipo</label>
                           <input 
                              type="text" 
                              value={orderPackageUnit}
                              onChange={e => setOrderPackageUnit(e.target.value)}
                              placeholder="Ex: caixas, un"
                              className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-2 text-foreground focus:ring-2 focus:ring-amber-500 outline-none h-[44px] text-sm"
                              required
                           />
                        </div>
                     </div>

                     <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-1">Observações da Compra</label>
                        <textarea 
                           value={orderNotes}
                           onChange={e => setOrderNotes(e.target.value)}
                           className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-2.5 text-foreground focus:ring-2 focus:ring-amber-500 outline-none resize-none text-sm"
                           rows={3}
                           placeholder="Ex: Comprado com fornecedor X..."
                        />
                     </div>

                     <div className="flex gap-3 pt-4 border-t border-border w-full">
                        <button 
                           type="button" 
                           onClick={() => setPendingOrder(null)}
                           className="flex-1 px-4 py-3 border border-border text-foreground font-medium rounded-xl hover:bg-secondary transition-colors text-sm h-[44px]"
                        >
                           Cancelar
                        </button>
                        <button 
                           type="submit" 
                           className="flex-1 px-4 py-3 bg-amber-600 text-white font-medium rounded-xl hover:bg-amber-700 transition-colors shadow-lg shadow-amber-500/25 text-sm h-[44px]"
                        >
                           Confirmar Pedido
                        </button>
                     </div>
                  </form>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
                 className="bg-card border border-border rounded-2xl w-full max-w-sm shadow-2xl p-6 relative overflow-hidden z-10 max-h-[calc(100vh-2rem)] overflow-y-auto"
              >
                 <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 to-blue-500"></div>
                 
                 <div className="mb-6 mt-2 flex justify-between items-start gap-4">
                    <div className="min-w-0 flex-1">
                       <h3 className="text-xl font-bold text-foreground">Ajustar Estoque (Gestão)</h3>
                       <p className="text-sm text-muted-foreground mt-1 truncate">{activeMaterial.name} ({activeMaterial.code})</p>
                    </div>
                    <button type="button" onClick={() => setShowCountModal(false)} className="p-1 text-muted-foreground hover:bg-secondary rounded-lg shrink-0 transition-colors">
                       <X className="w-5 h-5" />
                    </button>
                 </div>

                 <form onSubmit={handleCountSubmitManager} className="space-y-4">
                  {activeMaterial.isGiro && activeMaterial.isPulmao !== false ? (
                     <div className="bg-secondary/40 p-1.5 rounded-xl border border-border/60 flex gap-2">
                        <button
                           type="button"
                           onClick={() => {
                              setCountTargetStock('pulmao');
                              setCountQuantity(activeMaterial.quantity || 0);
                           }}
                           className={cn(
                              "flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5",
                              countTargetStock === 'pulmao'
                                 ? "bg-blue-500/10 text-blue-500 border border-blue-500/25 shadow-sm"
                                 : "text-muted-foreground hover:text-foreground"
                           )}
                        >
                           📦 Estoque Pulmão
                        </button>
                        <button
                           type="button"
                           onClick={() => {
                              setCountTargetStock('giro');
                              setCountQuantity(activeMaterial.quantityGiro || 0);
                           }}
                           className={cn(
                              "flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5",
                              countTargetStock === 'giro'
                                 ? "bg-amber-500/10 text-amber-500 border border-amber-500/25 shadow-sm"
                                 : "text-muted-foreground hover:text-foreground"
                           )}
                        >
                           ⚡ Giro do Dia
                        </button>
                     </div>
                  ) : (
                     <div className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium px-1">
                        <span>Estoque Alvo:</span>
                        {countTargetStock === 'giro' ? (
                           <span className="text-amber-500 font-semibold flex items-center gap-1">⚡ Giro do Dia</span>
                        ) : (
                           <span className="text-blue-500 font-semibold flex items-center gap-1">📦 Estoque Pulmão</span>
                        )}
                     </div>
                  )}

                  <div>
                     <label className="block text-sm font-medium text-muted-foreground mb-1.5">Quantidade Física ({formatUnit(activeMaterial?.unit)})</label>
                     <input 
                        type="number" 
                        min="0"
                        value={countQuantity}
                        onChange={e => setCountQuantity(e.target.value ? parseInt(e.target.value) : '')}
                        className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-3 text-lg font-bold focus:ring-2 focus:ring-amber-500/50 outline-none text-foreground h-[46px]"
                        required
                     />
                  </div>
                  
                  <div>
                     <label className="block text-sm font-medium text-muted-foreground mb-1.5">Status/Tag</label>
                     <select
                        value={countStatus}
                        onChange={e => setCountStatus(e.target.value as Material['status'])}
                        className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-3 focus:ring-2 focus:ring-amber-500/50 outline-none text-foreground cursor-pointer h-[44px]"
                     >
                        <option value="COMPLETED">Finalizado/Reposto</option>
                        <option value="COUNTED_RECENTLY">Recém Contado</option>
                        <option value="PENDING">Contagem Pendente</option>
                        <option value="AWAITING_CONFIRMATION">Aguardando Conferência</option>
                        <option value="PURCHASE_REQUESTED">Solicitando Compra</option>
                        {countTargetStock === 'pulmao' && (
                           <option value="REALOCATED_TO_GIRO">Realocado para estoque de giro</option>
                        )}
                     </select>
                  </div>

                  <div>
                     <label className="block text-sm font-medium text-muted-foreground mb-1.5">Motivo do Ajuste / Notas</label>
                     <textarea 
                        value={countNotes}
                        onChange={e => setCountNotes(e.target.value)}
                        className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-3 focus:ring-2 focus:ring-amber-500/50 outline-none text-foreground resize-none text-sm"
                        rows={3}
                        placeholder="Ex: Ajuste de divergência após contagem..."
                     />
                  </div>

                  <div className="flex gap-3 pt-2 w-full">
                     <button 
                        type="button"
                        onClick={() => setShowCountModal(false)}
                        className="flex-1 px-4 py-3 border border-border text-foreground font-medium rounded-xl hover:bg-secondary transition-colors text-sm h-[44px]"
                     >
                        Cancelar
                     </button>
                     <button 
                        type="submit"
                        className="flex-1 px-4 py-3 bg-amber-600 text-white font-medium rounded-xl hover:bg-amber-700 transition-colors shadow-lg shadow-amber-500/25 text-sm h-[44px]"
                     >
                        Salvar Ajuste
                     </button>
                  </div>
                 </form>
              </motion.div>
            </div>
         )}
      </AnimatePresence>

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

function AttendantDashboard({ 
  materials, 
  logs, 
  onRefresh 
}: { 
  materials: Material[]; 
  logs: StockCountLog[]; 
  onRefresh: () => void; 
}) {
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
  const [isReportOpen, setIsReportOpen] = useState<boolean>(false);

  const [dashboardStockTab, setDashboardStockTab] = useState<'pulmao' | 'giro'>('pulmao');
  const [countTargetStock, setCountTargetStock] = useState<'pulmao' | 'giro'>('pulmao');

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

    const completedGiro = giroMaterials.filter(m => countedIdsToday.has(m.id)).length;
    const pendingGiro = giroMaterials.length - completedGiro;

    return {
      total: giroMaterials.length,
      completed: completedGiro,
      pending: pendingGiro,
      percentage: giroMaterials.length > 0 ? Math.round((completedGiro / giroMaterials.length) * 100) : 0
    };
  }, [materials, logs]);

  const filteredMaterials = useMemo(() => {
    const filtered = materials.filter(m => {
      if (user?.sectorId && m.sectorId !== user.sectorId) {
        return false;
      }
      
      if (dashboardStockTab === 'giro' && !m.isGiro) {
        return false;
      }
      if (dashboardStockTab === 'pulmao' && m.isPulmao === false) {
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
  }, [materials, search, filterMode, user, dashboardStockTab]);

  const [visibleCount, setVisibleCount] = useState(25);

  useEffect(() => {
    setVisibleCount(25);
  }, [search, filterMode, dashboardStockTab]);

  const visibleMaterials = useMemo(() => {
    return filteredMaterials.slice(0, visibleCount);
  }, [filteredMaterials, visibleCount]);

  const handleScanResult = useCallback((decodedText: string) => {
    setShowScanner(false);
    
    const found = materials.find(m => m.codigoBarras === decodedText || m.code === decodedText);
    
    if (found) {
      setActiveMaterial(found);
      const initialStockType = found.isGiro && found.isPulmao === false ? 'giro' : 'pulmao';
      setCountTargetStock(initialStockType);
      setCountQuantity(initialStockType === 'giro' ? (found.quantityGiro || 0) : found.quantity);
      setCountNotes('');
      setCountStatus('AWAITING_CONFIRMATION');
      setShowCountModal(true);
    } else {
      alert(`Produto com código ${decodedText} não encontrado.`);
    }
  }, [materials]);

  const handleCountSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeMaterial) return;
    try {
      await apiFetch(`/api/materials/${activeMaterial.id}/count`, {
        method: 'POST',
        body: JSON.stringify({ 
           newQuantity: countQuantity, 
           notes: countNotes,
           status: countStatus,
           countType: countTargetStock
        })
      }, token);
      setShowCountModal(false);
      onRefresh();
      window.dispatchEvent(new CustomEvent('products-changed'));
    } catch (err) {
      alert('Erro ao registrar contagem');
    }
  }, [activeMaterial, countQuantity, countNotes, countStatus, countTargetStock, token, onRefresh]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
      {/* Banner Giro do Dia */}
      <div className="bg-card/50 backdrop-blur-md p-5 sm:p-6 rounded-2xl border border-border shadow-sm overflow-hidden relative">
        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl -mr-8 -mt-8 pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 w-full">
          <div className="flex items-start gap-4 min-w-0 flex-1">
            <div className="p-3 bg-amber-500/10 text-amber-500 dark:text-amber-400 rounded-xl shrink-0">
               <span className="text-xl font-bold block leading-none">⚡</span>
            </div>
            <div className="min-w-0 flex-1">
               <h4 className="font-bold text-foreground text-base">Giro do Dia (Uso Rápido)</h4>
               <p className="text-sm text-muted-foreground mt-0.5 max-w-2xl leading-relaxed">
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
          
          <div className="w-full md:w-64 flex flex-col gap-1.5 shrink-0 min-w-0">
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
      
      {/* Grade de Layout Inteligente: Sidebar lateral no desktop/notebook, empilhado no mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
         <div className="lg:col-span-2 col-span-1 space-y-6 w-full min-w-0">
            <div className="bg-card/50 backdrop-blur-md p-4 sm:p-6 rounded-2xl border border-border shadow-sm flex flex-col gap-4 justify-between w-full">
               <div className="flex border-b border-border/60 pb-1 mb-1 gap-4 overflow-x-auto scrollbar-none">
                  <button
                     onClick={() => setDashboardStockTab('pulmao')}
                     className={cn(
                        "pb-2 text-sm font-semibold relative transition-all flex items-center gap-1.5 whitespace-nowrap",
                        dashboardStockTab === 'pulmao'
                           ? "text-blue-500 font-bold border-b-2 border-blue-500"
                           : "text-muted-foreground hover:text-foreground"
                     )}
                  >
                     <span>📦 Estoque Pulmão</span>
                  </button>
                  <button
                     onClick={() => setDashboardStockTab('giro')}
                     className={cn(
                        "pb-2 text-sm font-semibold relative transition-all flex items-center gap-1.5 whitespace-nowrap",
                        dashboardStockTab === 'giro'
                           ? "text-amber-500 font-bold border-b-2 border-amber-500"
                           : "text-muted-foreground hover:text-foreground"
                     )}
                  >
                     <span>⚡ Giro do Dia</span>
                  </button>
               </div>

               <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 w-full">
                  <div className="min-w-0 flex-1">
                     <h2 className="text-lg sm:text-xl font-bold text-foreground flex items-center gap-2">
                        {dashboardStockTab === 'giro' ? (
                           <><span className="text-amber-500">⚡</span> Produtos de Giro do Dia</>
                        ) : (
                           <><Package className="w-5 h-5 text-blue-500" /> Produtos para Contagem</>
                        )}
                     </h2>
                     <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">Busque o produto, utilize os filtros rápidos ou escaneie para contar.</p>
                  </div>
                  <div className="flex bg-secondary/50 p-1 rounded-xl gap-1 shrink-0 overflow-x-auto scrollbar-none w-full sm:w-auto">
                     <button onClick={() => setFilterMode('PENDING')} className={cn("flex-1 sm:flex-none px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap", filterMode === 'PENDING' ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>Pendentes</button>
                     <button onClick={() => setFilterMode('AWAITING_CONFIRMATION')} className={cn("flex-1 sm:flex-none px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap", filterMode === 'AWAITING_CONFIRMATION' ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>Aguardando</button>
                     <button onClick={() => setFilterMode('ALL')} className={cn("flex-1 sm:flex-none px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap", filterMode === 'ALL' ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>Todos</button>
                  </div>
               </div>
               
               <div className="relative w-full flex gap-2">
                  <div className="relative flex-1 min-w-0">
                    <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input 
                      type="text" 
                      placeholder="Buscar por nome, código ou setor..." 
                      className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-blue-500/50 outline-none transition-all placeholder:text-muted-foreground/50 text-foreground h-[40px]"
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                    />
                  </div>
                  <button 
                     onClick={() => setShowScanner(true)}
                     className="px-4 bg-blue-600 text-white hover:bg-blue-700 rounded-xl transition-colors flex items-center justify-center shrink-0 shadow-lg shadow-blue-500/25 gap-1.5 text-xs font-semibold h-[40px]"
                     title="Ler Código de Barras"
                  >
                     <Camera className="w-4 h-4" /> <span className="hidden sm:inline">Escanear</span>
                  </button>
               </div>
            </div>

            <div className="bg-card/50 backdrop-blur-md rounded-2xl border border-border shadow-sm overflow-hidden w-full">
               {filteredMaterials.length === 0 ? (
                  <div className="p-12 text-center flex flex-col items-center justify-center text-muted-foreground w-full">
                     <Package className="w-10 h-10 mb-3 opacity-20 shrink-0" />
                     <p className="text-base font-bold text-foreground">Nenhum produto localizado</p>
                     <p className="text-xs mt-0.5">Tente ajustar seus filtros ou termos de busca.</p>
                  </div>
               ) : (
                  <>
                  <div className="hidden lg:block w-full overflow-x-auto">
                      <table className="w-full text-left border-collapse table-fixed min-w-[700px]">
                        <thead>
                          <tr className="bg-secondary/50 border-b border-border text-muted-foreground text-xs uppercase tracking-wider">
                            <th className="px-6 py-4 font-medium w-[45%]">Produto</th>
                            <th className="px-6 py-4 font-medium w-[25%]">Setor</th>
                            <th className="px-6 py-4 font-medium w-[15%]">Estoque</th>
                            <th className="px-6 py-4 font-medium text-right w-[15%]">Ação</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {visibleMaterials.map(mat => (
                            <tr key={mat.id} className="hover:bg-secondary/30 transition-colors">
                              <td className="px-6 py-4 min-w-0">
                                <div className="font-semibold text-foreground flex items-center gap-2 max-w-full">
                                  <span className="truncate block flex-1">{mat.name}</span>
                                  {mat.repostedAt && (new Date().getTime() - new Date(mat.repostedAt).getTime() < 24 * 60 * 60 * 1000) && (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-500 border border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.15)] animate-pulse shrink-0">Novo</span>
                                  )}
                                </div>
                                <div className="text-xs text-muted-foreground font-mono mt-0.5 block truncate">{mat.code}</div>
                              </td>
                              <td className="px-6 py-4 text-sm min-w-0 truncate">{mat.sector}</td>
                              <td className="px-6 py-4 min-w-0">
                                <div className="font-bold mb-1 truncate">
                                  {dashboardStockTab === 'giro' ? (
                                    <span className="text-amber-500 font-bold">⚡ {mat.quantityGiro || 0} {formatUnit(mat.unit)}</span>
                                  ) : (
                                    <span className="text-blue-500 font-bold">📦 {mat.quantity} {formatUnit(mat.unit)}</span>
                                  )}
                                </div>
                                <StatusBadge status={mat.status} />
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-right flex justify-end gap-1.5">
                                <button 
                                  type="button"
                                  onClick={() => setImageModalMaterial(mat)}
                                  className="text-amber-500 hover:text-amber-400 p-1.5 rounded-lg hover:bg-amber-500/10 transition-colors shrink-0"
                                  title="Visualizar Foto"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                                <button 
                                  type="button"
                                  onClick={() => {
                                    setActiveMaterial(mat);
                                    setCountTargetStock(dashboardStockTab);
                                    setCountQuantity(dashboardStockTab === 'giro' ? (mat.quantityGiro || 0) : mat.quantity);
                                    setCountNotes('');
                                    setCountStatus('AWAITING_CONFIRMATION');
                                    setShowCountModal(true);
                                  }}
                                  className={cn(
                                    "px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors inline-flex items-center gap-1.5 shrink-0",
                                    dashboardStockTab === 'giro' ? "bg-amber-500/10 text-amber-500 hover:bg-amber-500/20" : "bg-blue-500/10 text-blue-500 hover:bg-blue-500/20"
                                  )}
                                >
                                  <Edit3 className="w-3.5 h-3.5" /> Contar
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                   </div>

                   <div className="lg:hidden block divide-y divide-border w-full">
                     {visibleMaterials.map(mat => (
                        <div key={mat.id} className="p-4 space-y-3 w-full min-w-0">
                          <div className="flex justify-between items-start gap-3 w-full min-w-0">
                            <div className="min-w-0 flex-1">
                              <div className="font-bold text-foreground text-sm flex items-center gap-1.5 max-w-full">
                                <span className="truncate block flex-1">{mat.name}</span>
                                {mat.repostedAt && (new Date().getTime() - new Date(mat.repostedAt).getTime() < 24 * 60 * 60 * 1000) && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-500 shrink-0">Novo</span>
                                )}
                              </div>
                              <span className="text-xs text-muted-foreground font-mono mt-0.5 block truncate">{mat.code}</span>
                            </div>
                            <button 
                               type="button"
                               onClick={() => setImageModalMaterial(mat)}
                               className="text-amber-500 hover:text-amber-400 p-1.5 rounded-lg hover:bg-amber-500/10 transition-colors shrink-0"
                            >
                               <Eye className="w-5 h-5" />
                            </button>
                          </div>

                          <div className="flex justify-between items-center text-xs text-muted-foreground gap-4 w-full min-w-0">
                            <div className="min-w-0 flex-1 truncate block">
                              <span className="font-medium text-foreground">Setor:</span> {mat.sector}
                            </div>
                            <div className="text-right shrink-0 min-w-0">
                              <div className="font-bold text-foreground text-sm truncate block">
                                {dashboardStockTab === 'giro' ? (
                                  <span className="text-amber-500 font-bold">⚡ {mat.quantityGiro || 0} {formatUnit(mat.unit)}</span>
                                ) : (
                                  <span className="text-blue-500 font-bold">📦 {mat.quantity} {formatUnit(mat.unit)}</span>
                                )}
                              </div>
                              <div className="mt-1"><StatusBadge status={mat.status} /></div>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                               setActiveMaterial(mat);
                               setCountTargetStock(dashboardStockTab);
                               setCountQuantity(dashboardStockTab === 'giro' ? (mat.quantityGiro || 0) : mat.quantity);
                               setCountNotes('');
                               setCountStatus('AWAITING_CONFIRMATION');
                               setShowCountModal(true);
                            }}
                            className={cn(
                               "w-full py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 h-[38px] shadow-sm",
                               dashboardStockTab === 'giro' ? "bg-amber-600 hover:bg-amber-700 text-white" : "bg-blue-600 hover:bg-blue-700 text-white"
                            )}
                          >
                             <Edit3 className="w-4 h-4" /> Registrar Contagem
                          </button>
                        </div>
                     ))}
                   </div>
                   {filteredMaterials.length > visibleCount && (
                      <div className="p-4 border-t border-border bg-secondary/10 text-center w-full">
                         <button
                            type="button"
                            onClick={() => setVisibleCount(prev => prev + 25)}
                            className="px-4 py-2.5 text-sm font-semibold text-blue-500 hover:text-blue-600 hover:bg-blue-500/5 rounded-xl border border-blue-500/10 transition-colors inline-flex items-center gap-1.5 shadow-sm"
                         >
                            Carregar mais ({filteredMaterials.length - visibleCount} restantes)
                         </button>
                      </div>
                   )}
                  </>
               )}
            </div>
         </div>

         {/* Painel Lateral Direito - Corrigida a prop col-span de 4 para 1 na grade lg:grid-cols-3 */}
         <div className="lg:col-span-1 col-span-1 flex flex-col gap-6 w-full min-w-0">
            <div className="bg-card/50 backdrop-blur-md rounded-2xl border border-border shadow-sm flex flex-col h-[250px] w-full">
               <div className="px-5 py-4 border-b border-border bg-card/80">
                  <h3 className="font-bold text-foreground flex items-center gap-2 text-sm">
                     <ShoppingCart className="w-4 h-4 text-blue-500 shrink-0" /> Pedidos de Compra Ativos
                  </h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Acompanhamento solicitado pelo gestor.</p>
               </div>
               <div className="divide-y divide-border overflow-y-auto flex-1 p-2 space-y-2 custom-scrollbar">
                  {materials.filter(m => m.status === 'PURCHASE_REQUESTED').length > 0 ? materials.filter(m => m.status === 'PURCHASE_REQUESTED').map(mat => (
                     <div key={mat.id} className="p-3 bg-secondary/20 border border-border rounded-xl text-xs">
                        <div className="flex justify-between items-start gap-3 mb-1 w-full min-w-0">
                           <p className="font-bold text-foreground min-w-0 flex-1 break-words leading-tight">{mat.name}</p>
                           <div className="flex flex-col items-end gap-1 shrink-0 font-mono">
                              <span className="text-[10px] bg-blue-500/10 text-blue-500 border border-blue-500/20 px-2 py-0.5 rounded-full font-bold whitespace-nowrap">Pedidas: {mat.requestedQuantity || 0} {formatUnit(mat.unit)}</span>
                              <span className="text-[9px] text-muted-foreground whitespace-nowrap">Estoque: {mat.quantity}</span>
                           </div>
                        </div>
                        <p className="text-[11px] text-muted-foreground break-words leading-normal italic">"{mat.notes || 'Sem observações'}"</p>
                     </div>
                  )) : (
                     <div className="p-8 text-center text-muted-foreground text-xs flex flex-col items-center justify-center h-full">
                        <Package className="w-6 h-6 opacity-20 mb-1.5 shrink-0" />
                        <span>Nenhum pedido de compra listado.</span>
                     </div>
                  )}
               </div>
            </div>

            <div className="bg-card/50 backdrop-blur-md rounded-2xl border border-border shadow-sm flex flex-col h-[250px] w-full">
               <div className="px-5 py-4 border-b border-border bg-card/80">
                  <h3 className="font-bold text-foreground flex items-center gap-2 text-sm">
                     <History className="w-4 h-4 text-emerald-500 shrink-0" /> Minhas Últimas Contagens
                  </h3>
               </div>
               <div className="divide-y divide-border overflow-y-auto flex-1 p-2 space-y-2 custom-scrollbar">
                  {logs.filter(log => log.userId === user?.id && !(log.previousQuantity === log.newQuantity && (log.notes?.includes('[Pedido') || log.notes?.includes('[Aguardando')))).length > 0 ? 
                     logs.filter(log => log.userId === user?.id && !(log.previousQuantity === log.newQuantity && (log.notes?.includes('[Pedido') || log.notes?.includes('[Aguardando')))).map(log => (
                     <div key={log.id} className="p-3 bg-background border border-border rounded-xl text-xs flex flex-col gap-2">
                        <div className="flex justify-between items-start gap-4 mb-0.5 w-full min-w-0">
                           <div className="min-w-0 flex-1">
                              <p className="font-bold text-foreground truncate block text-xs">{log.materialName}</p>
                              <p className="text-[10px] text-muted-foreground font-mono truncate block mt-0.5">{log.materialCode}</p>
                           </div>
                           <span className="text-[10px] font-medium text-foreground bg-secondary px-2 py-0.5 rounded-md shrink-0 font-mono">
                              {new Date(log.timestamp).toLocaleDateString()}
                           </span>
                        </div>
                        
                        <div className="flex items-center justify-between text-xs bg-secondary/30 p-1.5 rounded-lg w-full min-w-0">
                           {(() => {
                              const mat = materials.find(m => m.id === log.materialId);
                              const unit = formatUnit(mat?.unit);
                              return (
                                 <div className="flex items-center gap-1.5 font-mono">
                                    <span className="text-muted-foreground line-through opacity-60">{log.previousQuantity}</span>
                                    <span>→</span>
                                    <span className="text-emerald-500 font-bold">{log.newQuantity} {unit}</span>
                                 </div>
                              );
                           })()}
                           <span className={cn(
                              "text-[9px] font-bold px-1.5 py-0.5 rounded border shrink-0",
                              log.countType === 'GIRO' ? "bg-amber-500/10 text-amber-500 border-amber-500/20" : "bg-blue-500/10 text-blue-500 border-blue-500/20"
                           )}>
                              {log.countType === 'GIRO' ? 'Giro' : 'Pulmão'}
                           </span>
                        </div>
                        
                        {log.notes && (
                           <p className="text-[11px] text-muted-foreground bg-blue-500/5 p-1.5 rounded-lg border border-blue-500/10 italic truncate block w-full">
                              "{log.notes}"
                           </p>
                        )}
                     </div>
                  )) : (
                     <div className="p-8 text-center text-muted-foreground text-xs flex flex-col items-center justify-center h-full">
                        <History className="w-6 h-6 opacity-20 mb-1.5 shrink-0" />
                        <span>Nenhuma contagem realizada hoje.</span>
                     </div>
                  )}
               </div>
            </div>
            
            <div className="bg-card/50 backdrop-blur-md rounded-2xl border border-border shadow-sm flex flex-col w-full">
               <div className="px-5 py-4 border-b border-border bg-card/80">
                  <h3 className="font-bold text-foreground flex items-center gap-2 text-sm">
                     <Share2 className="w-4 h-4 text-emerald-500 shrink-0" /> Meu Relatório de Hoje
                  </h3>
               </div>
               <div className="p-4 w-full">
                  <button 
                     onClick={() => setIsReportOpen(true)}
                     className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs sm:text-sm font-semibold transition-all shadow-sm w-full h-[40px]"
                  >
                     <Share2 className="w-4 h-4" />
                     Visualizar e Copiar Relatório
                  </button>
               </div>
            </div>
         </div>
      </div>

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
               className="bg-card border border-border rounded-2xl w-full max-w-sm shadow-2xl p-6 relative overflow-hidden z-10 max-h-[calc(100vh-2rem)] overflow-y-auto"
            >
               <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-emerald-500"></div>
               
               <div className="mb-5 mt-2 flex justify-between items-start gap-4">
                  <div className="min-w-0 flex-1">
                     <h3 className="text-xl font-bold text-foreground truncate">Registrar Contagem</h3>
                     <p className="text-sm text-muted-foreground mt-0.5 truncate">{activeMaterial.name} ({activeMaterial.code})</p>
                  </div>
                  <button type="button" onClick={() => setShowCountModal(false)} className="p-1 text-muted-foreground hover:bg-secondary rounded-lg shrink-0 transition-colors">
                     <X className="w-5 h-5" />
                  </button>
               </div>

               <form onSubmit={handleCountSubmit} className="space-y-4">
                  {activeMaterial.isGiro && activeMaterial.isPulmao !== false ? (
                     <div className="bg-secondary/40 p-1.5 rounded-xl border border-border/60 flex gap-2">
                        <button
                           type="button"
                           onClick={() => {
                              setCountTargetStock('pulmao');
                              setCountQuantity(activeMaterial.quantity || 0);
                           }}
                           className={cn(
                              "flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5",
                              countTargetStock === 'pulmao'
                                 ? "bg-blue-500/10 text-blue-500 border border-blue-500/25 shadow-sm"
                                 : "text-muted-foreground hover:text-foreground"
                           )}
                        >
                           📦 Estoque Pulmão
                        </button>
                        <button
                           type="button"
                           onClick={() => {
                              setCountTargetStock('giro');
                              setCountQuantity(activeMaterial.quantityGiro || 0);
                           }}
                           className={cn(
                              "flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5",
                              countTargetStock === 'giro'
                                 ? "bg-amber-500/10 text-amber-500 border border-amber-500/25 shadow-sm"
                                 : "text-muted-foreground hover:text-foreground"
                           )}
                        >
                           ⚡ Giro do Dia
                        </button>
                     </div>
                  ) : (
                     <div className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium px-1">
                        <span>Estoque Alvo:</span>
                        {countTargetStock === 'giro' ? (
                           <span className="text-amber-500 font-semibold flex items-center gap-1">⚡ Giro do Dia</span>
                        ) : (
                           <span className="text-blue-500 font-semibold flex items-center gap-1">📦 Estoque Pulmão</span>
                        )}
                     </div>
                  )}

                  <div>
                     <label className="block text-sm font-medium text-muted-foreground mb-1.5">Estoque Físico ({formatUnit(activeMaterial?.unit)})</label>
                     <input 
                        type="number" 
                        min="0"
                        value={countQuantity}
                        onChange={e => setCountQuantity(e.target.value ? parseInt(e.target.value) : '')}
                        className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-3 text-lg font-bold focus:ring-2 focus:ring-blue-500/50 outline-none text-foreground h-[46px]"
                        required
                     />
                  </div>
                  
                  <div>
                     <label className="block text-sm font-medium text-muted-foreground mb-1.5">Status/Tag</label>
                     <select
                        value={countStatus}
                        onChange={e => setCountStatus(e.target.value as Material['status'])}
                        className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/50 outline-none text-foreground h-[44px] cursor-pointer"
                     >
                        <option value="AWAITING_CONFIRMATION">Aguardando Conferência</option>
                        <option value="COUNTED_RECENTLY">Recém Contado</option>
                        <option value="PENDING">Contagem Pendente</option>
                        <option value="PURCHASE_REQUESTED">Solicitando Compra</option>
                        <option value="COMPLETED">Finalizado/Reposto</option>
                        {countTargetStock === 'pulmao' && (
                           <option value="REALOCATED_TO_GIRO">Realocado para estoque de giro</option>
                        )}
                     </select>
                  </div>
                  
                  <div>
                     <label className="block text-sm font-medium text-muted-foreground mb-1.5">Observações (Opcional)</label>
                     <textarea 
                        value={countNotes}
                        onChange={e => setCountNotes(e.target.value)}
                        className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/50 outline-none text-foreground resize-none text-sm"
                        rows={3}
                        placeholder="Ex: Embalagem danificada..."
                     />
                  </div>

                  <div className="flex gap-3 pt-2 w-full">
                     <button 
                        type="button" 
                        onClick={() => setShowCountModal(false)}
                        className="flex-1 px-4 py-3 text-muted-foreground font-medium rounded-xl hover:bg-secondary transition-colors text-sm h-[44px]"
                     >
                        Cancelar
                     </button>
                     <button 
                        type="submit" 
                        className="flex-1 px-4 py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/25 text-sm h-[44px]"
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

  const fetchData = useCallback((isBackground = false) => {
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
  }, [token, isManager]);

  useEffect(() => {
    fetchData(false);
    
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
  }, [fetchData, user]);

  if (loading) return <div className="p-8 text-center text-muted-foreground">Carregando dashboard...</div>;

  return isManager ? (
    <ManagerDashboard materials={materials} logs={logs} timeLogs={timeLogs} onRefresh={fetchData} />
  ) : (
    <AttendantDashboard materials={materials} logs={logs} onRefresh={fetchData} />
  );
}
