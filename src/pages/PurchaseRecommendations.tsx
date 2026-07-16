import React, { useState, useEffect, useMemo } from 'react';
import { apiFetch } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { Material, Supplier } from '../types';
import { TrendingDown, PackagePlus, AlertTriangle, Package, CalendarClock, ShoppingCart, SlidersHorizontal, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatUnit } from '../lib/utils';

export default function PurchaseRecommendations() {
  const { token, isManager } = useAuth();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [pendingOrder, setPendingOrder] = useState<Material | null>(null);
  const [orderTag, setOrderTag] = useState('Pedido Feito');
  const [orderNotes, setOrderNotes] = useState('');
  const [orderPackageQuantity, setOrderPackageQuantity] = useState<number>(1);
  const [orderPackageUnit, setOrderPackageUnit] = useState<string>('caixas');

  const fetchData = async () => {
    try {
      const [mats, supps] = await Promise.all([
        apiFetch('/api/materials', {}, token),
        apiFetch('/api/suppliers', {}, token)
      ]);
      setMaterials(mats);
      setSuppliers(supps);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    fetchData();
    const interval = setInterval(() => {
      fetchData();
    }, 10000);

    const handleProductsChanged = () => {
      fetchData();
    };
    window.addEventListener('products-changed', handleProductsChanged);

    return () => {
      clearInterval(interval);
      window.removeEventListener('products-changed', handleProductsChanged);
    };
  }, [token]);

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
      fetchData();
      window.dispatchEvent(new CustomEvent('products-changed'));
    } catch (err) {
      alert('Erro ao registrar pedido');
    }
  };

  const recommendations = useMemo(() => {
    return materials
      .filter(m => m.isPulmao !== false)
      .map(m => {
        const dailyUsage = m.dailyUsage || 0;
        const daysOfStock = dailyUsage > 0 ? Math.floor(m.quantity / dailyUsage) : undefined;
        
        const supplierObj = m.supplier || suppliers.find(s => s.id === m.supplierId);
        
        const deliveryDays = m.supplierDeliveryDays !== null && m.supplierDeliveryDays !== undefined && m.supplierDeliveryDays > 0
          ? m.supplierDeliveryDays
          : (supplierObj?.deliveryDays || 0);
          
        const supplierName = m.supplierName || supplierObj?.name || 'Geral (Não definido)';
        
        const reorderPoint = dailyUsage > 0 
          ? dailyUsage * deliveryDays + m.estoqueMinimo 
          : m.estoqueMinimo;
          
        const isCritical = m.quantity <= m.estoqueMinimo || m.quantity <= reorderPoint;
        const isAttendantPending = m.status === 'PURCHASE_REQUESTED' && (m.requestedQuantity === null || m.requestedQuantity === 0);
        
        let suggestion = 0;
        if (isCritical) {
          suggestion = dailyUsage > 0 
            ? Math.max(0, reorderPoint - m.quantity + (dailyUsage * 30))
            : Math.max(0, m.estoqueMinimo * 2 - m.quantity);
        } else if (isAttendantPending) {
          suggestion = dailyUsage > 0
            ? Math.max(1, Math.ceil(dailyUsage * 30))
            : Math.max(1, m.estoqueMinimo * 2 || 10);
        }
        
        return {
          ...m,
          daysOfStock,
          reorderPoint,
          isCritical,
          isAttendantPending,
          suggestion: Math.ceil(suggestion),
          supplierDeliveryDays: deliveryDays,
          supplierName: supplierName
        };
      })
      .filter(m => (m.isCritical && m.status !== 'PURCHASE_REQUESTED') || m.isAttendantPending)
      .sort((a, b) => {
        if (a.isAttendantPending && !b.isAttendantPending) return -1;
        if (!a.isAttendantPending && b.isAttendantPending) return 1;

        if (a.daysOfStock !== undefined && b.daysOfStock !== undefined) {
          return a.daysOfStock - b.daysOfStock;
        }
        if (a.daysOfStock !== undefined) return -1;
        if (b.daysOfStock !== undefined) return 1;
        
        const ratioA = a.estoqueMinimo > 0 ? a.quantity / a.estoqueMinimo : 1;
        const ratioB = b.estoqueMinimo > 0 ? b.quantity / b.estoqueMinimo : 1;
        return ratioA - ratioB;
      });
  }, [materials, suppliers]);

  if (!isManager) {
    return <div className="p-8 text-center text-red-500 font-semibold">Acesso negado.</div>;
  }

  if (loading) {
    return (
      <div className="p-12 text-center text-muted-foreground flex flex-col items-center justify-center min-h-[400px]">
         <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
         <p className="text-lg font-medium">Analisando dados e gerando recomendações...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-2 sm:px-4 pb-12 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between bg-card border border-border p-6 rounded-2xl shadow-sm">
         <div className="min-w-0 flex-1">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
               <ShoppingCart className="w-8 h-8 text-blue-500 shrink-0" />
               Recomendações de Compra
            </h1>
            <p className="text-sm text-muted-foreground mt-1 block truncate max-w-full">
               Sugestões inteligentes baseadas no giro médio de estoque e tempo de entrega dos fornecedores.
            </p>
         </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card border border-border p-5 rounded-2xl shadow-sm flex items-center gap-4">
           <div className="p-3 bg-blue-500/10 text-blue-500 rounded-xl shrink-0">
              <PackagePlus className="w-5 h-5" />
           </div>
           <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block truncate">Itens Críticos</p>
              <h4 className="text-2xl font-black text-foreground mt-0.5">{recommendations.length}</h4>
           </div>
        </div>
      </div>

      {recommendations.length === 0 ? (
         <div className="bg-card border border-border rounded-2xl p-12 text-center flex flex-col items-center justify-center max-w-full">
            <div className="w-16 h-16 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mb-4 shrink-0">
               <Package className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">Estoque Saudável</h3>
            <p className="text-muted-foreground max-w-md text-sm sm:text-base">Não há recomendações de compra no momento. Seus produtos estão acima do ponto de ressuprimento.</p>
         </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 w-full">
          <AnimatePresence>
            {recommendations.map(item => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`bg-card border rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col lg:flex-row gap-6 items-stretch lg:items-center justify-between w-full min-w-0 ${item.isAttendantPending ? 'border-amber-500/30 bg-amber-500/[0.01]' : 'border-red-500/30'}`}
              >
                <div className="flex-1 min-w-0 w-full flex flex-col justify-between">
                  <div className="flex items-center gap-2.5 flex-wrap min-w-0 w-full">
                    <h3 className="text-lg sm:text-xl font-black text-foreground truncate max-w-full" title={item.name}>{item.name}</h3>
                    <span className="text-xs bg-secondary px-2 py-1 rounded-md font-mono text-muted-foreground shrink-0">{item.code}</span>
                    {item.isAttendantPending && (
                      <span className="text-[11px] bg-amber-500/10 text-amber-500 dark:text-amber-400 px-2.5 py-0.5 rounded-md font-semibold flex items-center gap-1 border border-amber-500/20 shrink-0 whitespace-nowrap">
                        <ShoppingCart className="w-3 h-3" />
                        Solicitado por Atendente
                      </span>
                    )}
                    {item.isCritical && (
                      <span className="text-[11px] bg-red-500/10 text-red-500 dark:text-red-400 px-2.5 py-0.5 rounded-md font-semibold flex items-center gap-1 border border-red-500/20 shrink-0 whitespace-nowrap">
                        <AlertTriangle className="w-3 h-3" />
                        Crítico
                      </span>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 w-full min-w-0 text-sm">
                     <div className="min-w-0">
                        <p className="text-xs text-muted-foreground mb-1 block truncate">Estoque Atual</p>
                        <p className="font-semibold text-foreground truncate block">{item.quantity} {formatUnit(item.unit)}</p>
                     </div>
                     <div className="min-w-0">
                        <p className="text-xs text-muted-foreground mb-1 block truncate">Cobertura</p>
                        <p className={`font-semibold truncate block ${item.isCritical ? 'text-red-500 dark:text-red-400' : 'text-foreground'}`}>
                           {item.daysOfStock !== undefined ? `${item.daysOfStock} dias` : (item.isCritical ? 'Crítico' : 'Adequado')}
                        </p>
                     </div>
                     <div className="min-w-0">
                        <p className="text-xs text-muted-foreground mb-1 block truncate">Consumo Médio</p>
                        <p className="font-semibold text-foreground truncate block">
                           {item.dailyUsage ? `${item.dailyUsage} ${formatUnit(item.unit)}/dia` : 'Sem giro'}
                        </p>
                     </div>
                     <div className="min-w-0">
                        <p className="text-xs text-muted-foreground mb-1 block truncate">Tempo de Entrega</p>
                        <p className="font-semibold flex items-center gap-1 text-foreground truncate block">
                           <CalendarClock className="w-3 h-3 text-blue-500 shrink-0" />
                           <span>{item.supplierDeliveryDays ? `${item.supplierDeliveryDays} dias` : 'Imediato'}</span>
                        </p>
                     </div>
                  </div>
                  
                  <div className="mt-4 pt-4 border-t border-border/60 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between text-xs sm:text-sm text-muted-foreground min-w-0 w-full">
                     <p className="truncate max-w-full">
                        Fornecedor: <span className="font-medium text-foreground">{item.supplierName || 'Geral (Não definido)'}</span>
                     </p>
                     <p className="truncate max-w-full">
                        Ponto de Ressuprimento: <span className="font-medium text-foreground">{item.reorderPoint} {formatUnit(item.unit)}</span>
                     </p>
                  </div>
                </div>
                
                <div className={`w-full lg:w-52 rounded-xl p-4 flex flex-col items-center justify-center shrink-0 border min-w-0 ${item.isAttendantPending ? 'bg-amber-500/5 border-amber-500/20 shadow-sm' : 'bg-secondary/40 border-border shadow-sm'}`}>
                  <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mb-1 block text-center truncate w-full">Sugestão de Pedido</p>
                  <p className={`text-2xl sm:text-3xl font-black block truncate max-w-full text-center ${item.isAttendantPending ? 'text-amber-500' : 'text-blue-500'}`}>{item.suggestion} {formatUnit(item.unit)}</p>
                  <button 
                     onClick={() => {
                       setPendingOrder(item as Material);
                       setOrderTag('Pedido Feito');
                       setOrderPackageQuantity(item.suggestion || 1);
                       setOrderPackageUnit('caixas');
                       setOrderNotes(item.isAttendantPending ? `Solicitação do atendente formalizada. Pedido sugerido de ${item.suggestion} ${formatUnit(item.unit)}.` : `Pedido sugerido de ${item.suggestion} ${formatUnit(item.unit)}.`);
                     }}
                     className={`mt-4 w-full text-white px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all shadow-sm ${item.isAttendantPending ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-500/10' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/10'}`}
                  >
                     Gerar Pedido
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <AnimatePresence>
        {pendingOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
               initial={{ opacity: 0 }} 
               animate={{ opacity: 1 }} 
               exit={{ opacity: 0 }}
               className="absolute inset-0 bg-background/80 backdrop-blur-sm"
               onClick={() => setPendingOrder(null)}
            />
            <motion.div 
               initial={{ scale: 0.95, y: 20 }}
               animate={{ scale: 1, y: 0 }}
               exit={{ scale: 0.95, y: 20 }}
               className="bg-card border border-border w-full max-w-md rounded-2xl shadow-2xl relative z-10 overflow-hidden max-h-[calc(100vh-2rem)] overflow-y-auto"
            >
               <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-emerald-500"></div>
               <div className="p-6">
                  <div className="flex justify-between items-start gap-4 min-w-0">
                     <div className="min-w-0 flex-1">
                        <h3 className="text-xl font-bold text-foreground truncate">Confirmar Pedido</h3>
                        <p className="text-sm text-muted-foreground mt-1 truncate">{pendingOrder.name} ({pendingOrder.code})</p>
                     </div>
                     <button type="button" onClick={() => setPendingOrder(null)} className="p-1 text-muted-foreground hover:bg-secondary rounded-lg transition-colors shrink-0">
                        <X className="w-5 h-5" />
                     </button>
                  </div>
                  
                  <form onSubmit={handleConfirmOrder} className="mt-6 space-y-5">
                     <div className="w-full">
                        <label className="block text-sm font-medium text-muted-foreground mb-1.5">Status do Pedido (Tag)</label>
                        <select
                           value={orderTag}
                           onChange={e => setOrderTag(e.target.value)}
                           className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/50 outline-none text-foreground cursor-pointer h-[46px]"
                           required
                        >
                           <option value="Pedido Feito">Pedido Feito</option>
                           <option value="Pedido Entregue">Pedido Entregue</option>
                           <option value="Aguardando envio do produto">Aguardando envio do produto</option>
                           <option value="Pedido em Análise">Pedido em Análise</option>
                           <option value="Pedido Pendente">Pedido Pendente</option>
                        </select>
                     </div>

                     <div className="grid grid-cols-2 gap-4 w-full">
                        <div>
                           <label className="block text-sm font-medium text-muted-foreground mb-1.5">Qtd. Solicitada</label>
                           <input 
                              type="number" 
                              value={orderPackageQuantity}
                              onChange={e => setOrderPackageQuantity(Number(e.target.value))}
                              className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-3 text-base font-bold focus:ring-2 focus:ring-blue-500/50 outline-none text-foreground h-[48px]"
                              min="1"
                              required
                           />
                        </div>
                        <div>
                           <label className="block text-sm font-medium text-muted-foreground mb-1.5">Tipo Embalagem</label>
                           <select
                              value={orderPackageUnit}
                              onChange={e => setOrderPackageUnit(e.target.value)}
                              className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/50 outline-none text-foreground cursor-pointer h-[48px]"
                              required
                           >
                              <option value="caixas">caixas</option>
                              <option value="pacotes">pacotes</option>
                              <option value="unidades">unidades</option>
                              <option value="paletes">paletes</option>
                              <option value="fardos">fardos</option>
                              <option value="tambores">tambores</option>
                              <option value="litros">litros</option>
                              <option value="quilos">quilos</option>
                           </select>
                        </div>
                     </div>

                     <div className="w-full">
                        <label className="block text-sm font-medium text-muted-foreground mb-1.5">Observações da Compra</label>
                        <textarea 
                           value={orderNotes}
                           onChange={e => setOrderNotes(e.target.value)}
                           className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/50 outline-none text-foreground min-h-[100px] resize-none text-sm"
                           placeholder="Insira os detalhes, número do pedido, quantidade solicitada..."
                           required
                        ></textarea>
                     </div>

                     <div className="flex gap-3 pt-4 border-t border-border mt-6 w-full">
                        <button 
                           type="button" 
                           onClick={() => setPendingOrder(null)}
                           className="flex-1 px-4 py-3 border border-border text-foreground font-medium rounded-xl hover:bg-secondary transition-colors text-sm h-[44px]"
                        >
                           Cancelar
                        </button>
                        <button 
                           type="submit" 
                           className="flex-1 px-4 py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/25 text-sm h-[44px]"
                        >
                           Registrar Pedido
                        </button>
                     </div>
                  </form>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}