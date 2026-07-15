import React, { useState, useEffect, useMemo } from 'react';
import { apiFetch } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { Material } from '../types';
import { 
  DndContext, 
  DragOverlay, 
  closestCorners, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors,
  DragStartEvent,
  DragEndEvent,
  useDroppable
} from '@dnd-kit/core';
import { 
  SortableContext, 
  arrayMove, 
  sortableKeyboardCoordinates, 
  verticalListSortingStrategy 
} from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Container, Package, Clock, ShoppingCart, CheckCircle2, GripVertical, TrendingUp, Camera, Settings2, X, Eye, AlertTriangle } from 'lucide-react';
import { cn, formatUnit } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { BarcodeScanner } from '../components/BarcodeScanner';
import { ProductImageModal } from '../components/ProductImageModal';
import { format } from 'date-fns';

const columns = [
  { id: 'PENDING', title: 'Contagem Pendente', icon: Package, color: 'text-muted-foreground', bg: 'bg-secondary' },
  { id: 'COUNTED_RECENTLY', title: 'Recém Contado', icon: TrendingUp, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  { id: 'AWAITING_CONFIRMATION', title: 'Aguardando Conferência', icon: Clock, color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
  { id: 'PURCHASE_REQUESTED', title: 'Solicitado à Compra', icon: ShoppingCart, color: 'text-red-500', bg: 'bg-red-500/10' },
  { id: 'COMPLETED', title: 'Finalizado/Reposto', icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
];

const purchaseColumns = [
  { id: 'Pedido em Análise', title: 'Em Análise', icon: Settings2, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  { id: 'Pedido Pendente', title: 'Pendente', icon: Clock, color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
  { id: 'Pedido Feito', title: 'Pedido Feito', icon: ShoppingCart, color: 'text-red-500', bg: 'bg-red-500/10' },
  { id: 'Aguardando envio do produto', title: 'Aguardando Envio', icon: Package, color: 'text-indigo-500', bg: 'bg-indigo-500/10' },
  { id: 'Pedido Entregue', title: 'Entregue', icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
];

const getOrderTag = (material: Material): string => {
  if (!material.notes) return 'Pedido Feito';
  const match = material.notes.match(/^\[([^\]]+)\]/);
  if (match) {
    const parsedTag = match[1];
    const validTags = ['Pedido em Análise', 'Pedido Pendente', 'Pedido Feito', 'Aguardando envio do produto', 'Pedido Entregue'];
    if (validTags.includes(parsedTag)) {
      return parsedTag;
    }
  }
  return 'Pedido Feito';
};

const SortableItem = React.memo(({ id, material, onClick, focusGiro }: { id: string, material: Material, onClick?: (material: Material) => void, focusGiro?: boolean }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: id, data: { material } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const currentQty = focusGiro ? (material.quantityGiro || 0) : material.quantity;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "p-4 mb-3 bg-card border rounded-xl shadow-sm cursor-grab active:cursor-grabbing flex items-start gap-3 transition-colors hover:border-blue-500/30",
        isDragging ? "opacity-50 border-blue-500/50 shadow-lg" : "border-border",
        material.highDiscrepancy && !isDragging && "animate-[pulse_2s_ease-in-out_infinite] border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.2)] bg-red-500/5"
      )}
      onClick={() => onClick && onClick(material)}
      {...attributes}
      {...listeners}
    >
       <GripVertical className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
       <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between">
             <h4 className="font-semibold text-foreground truncate flex items-center gap-1.5">{material.name}{material.repostedAt && (new Date().getTime() - new Date(material.repostedAt).getTime() < 24 * 60 * 60 * 1000) && (<span className="shrink-0 inline-flex items-center px-1 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-500 border border-emerald-500/30 animate-pulse">Novo</span>)}</h4>
             <span className="text-xs font-mono text-muted-foreground ml-2">{material.code}</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1 truncate">Setor: {material.sector}</p>
          
          <div className="mt-3 flex items-center justify-between">
             {material.status === 'PURCHASE_REQUESTED' && material.requestedQuantity ? (
                 <>
                   <span className="text-xs px-2 py-1 bg-blue-500/10 text-blue-500 border border-blue-500/20 rounded font-semibold whitespace-nowrap">Solicitado: {material.requestedQuantity} {formatUnit(material.unit)}</span>
                   <span className="text-xs px-2 py-1 bg-secondary rounded text-muted-foreground whitespace-nowrap">Estoque: {currentQty} {formatUnit(material.unit)}</span>
                 </>
              ) : (
                 <span className="text-xs px-2 py-1 bg-secondary rounded text-muted-foreground">Estoque: <strong className="text-foreground">{currentQty} {formatUnit(material.unit)}</strong></span>
              )}
             {material.lastCountedBy && (
                 <span className="text-[10px] text-muted-foreground">por {material.lastCountedBy.split(' ')[0]}</span>
             )}
          </div>
          {material.notes && (
             <div className="mt-3 text-xs text-muted-foreground bg-blue-500/5 p-2 rounded-lg border border-blue-500/10 italic truncate">
                {material.notes}
             </div>
          )}
       </div>
    </div>
  );
}, (prevProps, nextProps) => {
  return prevProps.id === nextProps.id && 
         prevProps.material.id === nextProps.material.id &&
         prevProps.material.status === nextProps.material.status &&
         prevProps.material.statusGiro === nextProps.material.statusGiro &&
         prevProps.material.quantity === nextProps.material.quantity &&
         prevProps.material.quantityGiro === nextProps.material.quantityGiro &&
         prevProps.focusGiro === nextProps.focusGiro &&
         prevProps.material.highDiscrepancy === nextProps.material.highDiscrepancy;
});

const KanbanColumn = ({ col, colMaterials, handleCardClick, focusGiro }: { col: any, colMaterials: Material[], handleCardClick: (m: Material) => void, focusGiro?: boolean }) => {
  const { setNodeRef } = useDroppable({ id: col.id });
  const Icon = col.icon;
  
  return (
    <div ref={setNodeRef} className="w-80 flex flex-col h-full bg-secondary/30 rounded-2xl border border-border overflow-hidden">
       <div className="p-4 border-b border-border bg-card/50 backdrop-blur-md sticky top-0 flex items-center justify-between">
          <div className="flex items-center gap-2">
             <div className={cn("p-1.5 rounded-md", col.bg)}>
                <Icon className={cn("w-4 h-4", col.color)} />
             </div>
             <h3 className="font-semibold">{col.title}</h3>
          </div>
          <span className="text-xs font-bold text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">{colMaterials.length}</span>
       </div>
       
       <div className="flex-1 p-4 overflow-y-auto">
           <SortableContext 
             id={col.id}
             items={colMaterials.map(m => m.id)}
             strategy={verticalListSortingStrategy}
           >
              <div className="min-h-[200px] space-y-3" style={{ height: '100%' }}>
                 <AnimatePresence>
                    {colMaterials.map(material => (
                       <SortableItem key={material.id} id={material.id} material={material} onClick={handleCardClick} focusGiro={focusGiro} />
                    ))}
                 </AnimatePresence>
              </div>
           </SortableContext>
        </div>
    </div>
  );
};

export default function Kanban() {
  const { token, isManager, user } = useAuth();
  const [kanbanMode, setKanbanMode] = useState<'ESTOQUE' | 'PEDIDOS'>('ESTOQUE');

  useEffect(() => {
    if (isManager) {
      setKanbanMode('PEDIDOS');
    } else {
      setKanbanMode('ESTOQUE');
    }
  }, [isManager]);

  const [materials, setMaterials] = useState<Material[]>([]);
  const [focusGiro, setFocusGiro] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  
  const [showCountModal, setShowCountModal] = useState(false);
  const [countMaterial, setCountMaterial] = useState<Material | null>(null);
  const [imageModalProduct, setImageModalProduct] = useState<Material | null>(null);
  const [countQuantity, setCountQuantity] = useState<number | string>('');
  const [countNotes, setCountNotes] = useState('');
  const [countStatus, setCountStatus] = useState<Material['status']>('AWAITING_CONFIRMATION');

  const [pendingMove, setPendingMove] = useState<{ material: Material, newStatus: Material['status'] } | null>(null);
  const [moveTag, setMoveTag] = useState('Verificado');
  const [moveNotes, setMoveNotes] = useState('');
  const [moveQuantity, setMoveQuantity] = useState<number | string>('');
  const [moveRequestedQuantity, setMoveRequestedQuantity] = useState<number | string>('');

  const [showColumnsModal, setShowColumnsModal] = useState(false);
  const [visibleCols, setVisibleCols] = useState<string[]>([]);
  
  useEffect(() => {
     if (token) {
        const saved = localStorage.getItem(`kanban_cols_${token}`);
        if (saved) {
           setVisibleCols(JSON.parse(saved));
        } else {
           setVisibleCols(columns.map(c => c.id));
        }
     }
  }, [token]);

  const toggleColumn = (colId: string) => {
     const newCols = visibleCols.includes(colId) 
        ? visibleCols.filter(c => c !== colId) 
        : [...visibleCols, colId];
     setVisibleCols(newCols);
     if (token) {
        localStorage.setItem(`kanban_cols_${token}`, JSON.stringify(newCols));
     }
  };

  const fetchData = async () => {
    const mats = await apiFetch('/api/materials', {}, token);
    setMaterials(mats);
  };

  useEffect(() => { 
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

  useEffect(() => {
    if (countMaterial) {
      const updated = materials.find(m => m.id === countMaterial.id);
      if (updated) {
        setCountMaterial(updated);
      }
    }
  }, [materials, countMaterial]);

  const handleCardClick = (material: Material) => {
    setCountMaterial(material);
    setCountQuantity(focusGiro ? (material.quantityGiro || 0) : material.quantity);
    setCountNotes('');
    setCountStatus(focusGiro ? (material.statusGiro || 'PENDING') : material.status);
    setShowCountModal(true);
  };

  const handleCountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!countMaterial) return;
    try {
      await apiFetch(`/api/materials/${countMaterial.id}/count`, {
        method: 'POST',
        body: JSON.stringify({ 
           newQuantity: countQuantity, 
           notes: countNotes,
           status: countStatus,
           countType: focusGiro ? 'giro' : 'pulmao'
        })
      }, token);
      setShowCountModal(false);
      fetchData();
      window.dispatchEvent(new CustomEvent('products-changed'));
    } catch (err) {
      alert('Erro ao registrar contagem');
    }
  };

  const handleScanResult = (decodedText: string) => {
    setShowScanner(false);
    
    const found = materials.find(m => m.codigoBarras === decodedText || m.code === decodedText);
    
    if (found) {
      setCountMaterial(found);
      setCountQuantity(focusGiro ? (found.quantityGiro || 0) : found.quantity);
      setCountNotes('');
      setCountStatus(focusGiro ? (found.statusGiro || 'PENDING') : found.status);
      setShowCountModal(true);
    } else {
      alert(`Produto com código ${decodedText} não encontrado.`);
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    setActiveId(null);

    const activeMaterialId = active.id as string;
    const overId = over.id as string;
    const activeMaterial = materials.find(m => m.id === activeMaterialId);

    if (!activeMaterial) return;
    
    if (kanbanMode === 'PEDIDOS') {
       let destinationTag = overId;
       const isOverCol = purchaseColumns.find(c => c.id === overId);
       if (!isOverCol) {
          const overMaterial = materials.find(m => m.id === overId);
          if (overMaterial) {
             destinationTag = getOrderTag(overMaterial);
          } else {
             return;
          }
       }

       const currentTag = getOrderTag(activeMaterial);
       if (currentTag !== destinationTag && isManager) {
          setPendingMove({ material: activeMaterial, newStatus: 'PURCHASE_REQUESTED' });
          setMoveTag(destinationTag);
          const originalNotes = activeMaterial.notes ? activeMaterial.notes.replace(/^\[[^\]]+\]\s*/, '') : ''; setMoveRequestedQuantity(activeMaterial.requestedQuantity || 0);
          setMoveNotes(originalNotes);
          setMoveQuantity(activeMaterial.quantity);
       }
       return;
    }

    const isOverColumn = columns.find(c => c.id === overId);
    if (isOverColumn) {
       const currentStatus = focusGiro ? (activeMaterial.statusGiro || 'PENDING') : activeMaterial.status;
       if (currentStatus !== overId && isManager) {
          setMaterials(prev => prev.map(m => m.id === activeMaterialId ? { ...m, [focusGiro ? 'statusGiro' : 'status']: overId as Material['status'] } : m));
          initPendingMove(activeMaterial, overId as Material['status']);
       }
       return;
    }

    const overMaterial = materials.find(m => m.id === overId);
    if (overMaterial && isManager) {
       const activeStatus = focusGiro ? (activeMaterial.statusGiro || 'PENDING') : activeMaterial.status;
       const overStatus = focusGiro ? (overMaterial.statusGiro || 'PENDING') : overMaterial.status;
       if (activeStatus !== overStatus) {
          setMaterials(prev => prev.map(m => m.id === activeMaterialId ? { ...m, [focusGiro ? 'statusGiro' : 'status']: overStatus as Material['status'] } : m));
          initPendingMove(activeMaterial, overStatus as Material['status']);
       }
    }
  };

  const initPendingMove = (material: Material, newStatus: Material['status']) => {
      setPendingMove({ material, newStatus });
      setMoveTag('Verificado');
      setMoveNotes('');
      setMoveQuantity(focusGiro ? (material.quantityGiro || 0) : material.quantity);
      setMoveRequestedQuantity(material.requestedQuantity || 0);
  };

  const handleCancelMove = () => {
      if (pendingMove) {
          setMaterials(prev => prev.map(m => m.id === pendingMove.material.id ? { ...m, [focusGiro ? 'statusGiro' : 'status']: focusGiro ? (pendingMove.material.statusGiro || 'PENDING') : pendingMove.material.status } : m));
          setPendingMove(null);
      }
  };

  const handleConfirmMove = async (e: React.FormEvent) => {
     e.preventDefault();
     if (!pendingMove) return;

     let finalNotes = '';
     let finalStatus = pendingMove.newStatus;

     if (kanbanMode === 'PEDIDOS') {
        const tagPrefix = `[${moveTag}]`;
        const baseNotes = moveNotes ? moveNotes : 'Atualizado via Kanban';
        finalNotes = `${tagPrefix} ${baseNotes}`;
        
        if (moveTag === 'Pedido Entregue') {
           finalStatus = 'PENDING';
           finalNotes = '[Pedido Entregue] Aguardando nova contagem';
        }
     } else {
        const tagPrefix = `[${moveTag}]`;
        finalNotes = moveNotes ? `${tagPrefix} ${moveNotes}` : tagPrefix;
     }

     try {
       await apiFetch(`/api/materials/${pendingMove.material.id}/count`, {
         method: 'POST',
         body: JSON.stringify({ 
            newQuantity: moveQuantity, 
            notes: finalNotes,
            status: finalStatus,
            countType: focusGiro ? 'giro' : 'pulmao',
            repostedAt: (finalStatus === 'COMPLETED' || moveTag === 'Pedido Entregue') ? new Date().toISOString() : undefined,
            requestedQuantity: (finalStatus === 'COMPLETED' || moveTag === 'Pedido Entregue') ? 0 : (moveRequestedQuantity !== '' ? Number(moveRequestedQuantity) : undefined)
         })
       }, token);
       setPendingMove(null);
       window.dispatchEvent(new CustomEvent('products-changed'));
       fetchData();
     } catch (err) {
       alert('Erro ao mover material e registrar contagem');
     }
  };

  const activeMaterial = activeId ? materials.find(m => m.id === activeId) : null;

  const filteredMaterials = useMemo(() => {
    let list = materials;
    if (focusGiro) {
      list = list.filter(m => !!m.isGiro);
    }
    
    if (!isManager && user) {
      const userSectors = [user.sectorId, ...(user.additionalSectors || '').split(',')].filter(Boolean);
      if (userSectors.length > 0) {
        list = list.filter(m => {
          const matSectors = [m.sectorId, ...(m.additionalSectors || '').split(',')].filter(Boolean);
          return matSectors.some(id => userSectors.includes(id));
        });
      }
    }

    const lowerSearch = search.toLowerCase();
    if (!lowerSearch) return list;
    return list.filter(m => {
       const dateStr = m.lastCountedAt ? format(new Date(m.lastCountedAt), 'dd/MM/yyyy HH:mm') : '';
       return m.name.toLowerCase().includes(lowerSearch) || 
              m.code.toLowerCase().includes(lowerSearch) ||
              (m.codigoBarras && m.codigoBarras.toLowerCase().includes(lowerSearch)) ||
              (m.lastCountedBy && m.lastCountedBy.toLowerCase().includes(lowerSearch)) ||
              dateStr.includes(lowerSearch);
    });
  }, [materials, search, isManager, user, focusGiro]);

  const groupedMaterials = useMemo(() => {
    const grouped: Record<string, Material[]> = {};
    const activeCols = kanbanMode === 'PEDIDOS' ? purchaseColumns : columns;
    activeCols.forEach(c => { grouped[c.id] = []; });
    
    filteredMaterials.forEach(m => {
       if (kanbanMode === 'PEDIDOS') {
          if (m.status === 'PURCHASE_REQUESTED') {
             const tag = getOrderTag(m);
             if (grouped[tag]) {
                grouped[tag].push(m);
             } else {
                grouped['Pedido Feito']?.push(m);
             }
          }
       } else {
          const currentStatus = focusGiro ? (m.statusGiro || 'PENDING') : m.status;
          if (grouped[currentStatus]) {
             grouped[currentStatus].push(m);
          } else {
             grouped['PENDING']?.push(m);
          }
       }
    });

    const sortedGrouped: Record<string, Material[]> = {};
    const now = new Date().getTime();
    Object.keys(grouped).forEach(key => {
       sortedGrouped[key] = [...grouped[key]].sort((a, b) => {
          const aRecent = a.repostedAt ? (now - new Date(a.repostedAt).getTime() < 24 * 60 * 60 * 1000) : false;
          const bRecent = b.repostedAt ? (now - new Date(b.repostedAt).getTime() < 24 * 60 * 60 * 1000) : false;
          if (aRecent && !bRecent) return -1;
          if (!aRecent && bRecent) return 1;
          if (aRecent && bRecent) {
             return new Date(b.repostedAt!).getTime() - new Date(a.repostedAt!).getTime();
          }
          return 0;
       });
    });

    return sortedGrouped;
  }, [filteredMaterials, kanbanMode, focusGiro]);

  return (
    <div className="h-full flex flex-col">
      <div className="mb-6 flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4">
         <div className="flex flex-col sm:flex-row sm:items-center gap-4 w-full xl:w-auto">
            <div>
               <h2 className="text-xl font-bold flex items-center gap-2">
                  <Container className="w-6 h-6 text-blue-500" /> Fluxo de Reposição (Kanban)
               </h2>
               <p className="text-sm text-muted-foreground mt-1">
                  {isManager ? 'Acompanhe e movimente o status de reposições e pedidos.' : 'Visualização do fluxo de materiais. Apenas gestores podem alterar status aqui.'}
               </p>
            </div>
            
            {isManager && (
               <div className="flex bg-secondary/50 p-1 rounded-xl border border-border self-start sm:self-auto shrink-0">
                  <button
                     onClick={() => setKanbanMode('PEDIDOS')}
                     className={cn(
                        "px-4 py-1.5 rounded-lg text-xs font-semibold transition-all",
                        kanbanMode === 'PEDIDOS' 
                           ? "bg-blue-600 text-white shadow" 
                           : "text-muted-foreground hover:text-foreground"
                     )}
                  >
                     Pedidos de Compra
                  </button>
                  <button
                     onClick={() => setKanbanMode('ESTOQUE')}
                     className={cn(
                        "px-4 py-1.5 rounded-lg text-xs font-semibold transition-all",
                        kanbanMode === 'ESTOQUE' 
                           ? "bg-blue-600 text-white shadow" 
                           : "text-muted-foreground hover:text-foreground"
                     )}
                  >
                     Estoque Geral
                  </button>
               </div>
            )}
         </div>

         <div className="w-full xl:w-[650px] shrink-0 flex gap-2 items-center">
             <button
               type="button"
               onClick={() => setFocusGiro(!focusGiro)}
               className={cn(
                 "px-4 py-2 rounded-xl text-xs font-bold border transition-all duration-200 flex items-center gap-1.5 shrink-0 select-none",
                 focusGiro
                   ? "bg-amber-500/15 border-amber-500/30 text-amber-500 shadow-sm animate-none"
                   : "bg-secondary text-muted-foreground hover:text-foreground border-border/80 hover:bg-secondary/80"
               )}
               title="Focar em Itens de Giro ⚡"
             >
               <span>⚡ Giro do Dia</span>
             </button>
             
             <div className="relative flex-1">
               <input 
                  type="text" 
                  placeholder="Buscar por nome, código, usuário, dia, hora..." 
                  className="w-full px-4 py-2 bg-secondary/50 border border-border rounded-xl text-sm focus:ring-2 focus:ring-blue-500/50 outline-none text-foreground"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
               />
             </div>
             <button 
                onClick={() => {
                   setSearch('');
                   setShowScanner(true);
                }}
                className="p-2 bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 border border-blue-500/20 rounded-xl transition-colors flex items-center justify-center shrink-0"
                title="Ler Código do Produto ou QR Code"
             >
                <Camera className="w-5 h-5" />
             </button>
             {isManager && kanbanMode === 'ESTOQUE' && (
                <button 
                   onClick={() => setShowColumnsModal(true)}
                   className="px-3 bg-secondary text-foreground hover:bg-secondary/80 border border-border rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2 shrink-0"
                   title="Personalizar Colunas"
                >
                   <Settings2 className="w-4 h-4" /> Colunas
                </button>
             )}
         </div>
      </div>

      <div className="flex-1 overflow-x-auto pb-4 scrollbar-hide">
         <DndContext 
           sensors={sensors}
           collisionDetection={closestCorners}
           onDragStart={handleDragStart}
           onDragEnd={handleDragEnd}
         >
           <div className="flex h-full gap-6 min-w-max">
             {(kanbanMode === 'PEDIDOS' ? purchaseColumns : columns.filter(c => visibleCols.includes(c.id))).map(col => {
                const colMaterials = groupedMaterials[col.id] || [];
                return <KanbanColumn key={col.id} col={col} colMaterials={colMaterials} handleCardClick={handleCardClick} focusGiro={focusGiro} />;
             })}
           </div>

           <DragOverlay>
             {activeMaterial ? (
               <div className="p-4 bg-card border-2 border-blue-500/50 rounded-xl shadow-2xl opacity-90 scale-105 flex items-start gap-3 w-80">
                  <GripVertical className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                     <h4 className="font-semibold truncate">{activeMaterial.name}</h4>
                     <p className="text-sm text-muted-foreground mt-1 truncate">Setor: {activeMaterial.sector}</p>
                  </div>
               </div>
             ) : null}
           </DragOverlay>
         </DndContext>
      </div>

      <AnimatePresence>
        {pendingMove && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
               initial={{ opacity: 0 }} 
               animate={{ opacity: 1 }} 
               exit={{ opacity: 0 }}
               className="absolute inset-0 bg-background/80 backdrop-blur-sm"
               onClick={handleCancelMove}
            />
            <motion.div 
               initial={{ scale: 0.95, y: 20 }}
               animate={{ scale: 1, y: 0 }}
               exit={{ scale: 0.95, y: 20 }}
               className="bg-card border border-border w-full max-w-md rounded-2xl shadow-2xl relative z-10 overflow-hidden"
            >
               <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-emerald-500"></div>
               <div className="p-6">
                  <h3 className="text-xl font-bold text-foreground">Confirmar Movimentação</h3>
                  <p className="text-sm text-muted-foreground mt-1">{pendingMove.material.name} ({pendingMove.material.code})</p>
                  
                  <form onSubmit={handleConfirmMove} className="mt-6 space-y-5">
                     <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-1.5">Tag de Verificação</label>
                        <select
                           value={moveTag}
                           onChange={e => setMoveTag(e.target.value)}
                           className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/50 outline-none text-foreground cursor-pointer"
                           required
                        >
                           {kanbanMode === 'PEDIDOS' ? (
                               <>
                                  <option value="Pedido em Análise">Pedido em Análise</option>
                                  <option value="Pedido Pendente">Pedido Pendente</option>
                                  <option value="Pedido Feito">Pedido Feito</option>
                                  <option value="Aguardando envio do produto">Aguardando Envio</option>
                                  <option value="Pedido Entregue">Pedido Entregue</option>
                               </>
                            ) : (
                               <>
                                  <option value="Verificado">Verificado</option>
                                  <option value="Compra Feita">Compra Feita</option>
                                  <option value="Reposto">Reposto</option>
                               </>
                            )}
                        </select>
                     </div>

                     <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-1.5">Nova Quantidade ({formatUnit(pendingMove?.material.unit)})</label>
                        <input 
                           type="number" 
                           min="0"
                           value={moveQuantity}
                           onChange={e => setMoveQuantity(e.target.value ? parseInt(e.target.value) : '')}
                           className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-3 text-lg font-bold focus:ring-2 focus:ring-blue-500/50 outline-none text-foreground"
                           required
                        />
                     </div>
                     {kanbanMode === 'PEDIDOS' && (
                        <div>
                           <label className="block text-sm font-medium text-muted-foreground mb-1.5">Quantidade Solicitada / Pedida</label>
                           <input 
                              type="number" 
                              min="0"
                              value={moveRequestedQuantity}
                              onChange={e => setMoveRequestedQuantity(e.target.value ? parseInt(e.target.value) : '')}
                              className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-3 text-lg font-bold focus:ring-2 focus:ring-blue-500/50 outline-none text-foreground"
                              required
                           />
                        </div>
                     )}

                     <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-1.5">Observações (Obrigatório)</label>
                        <textarea 
                           value={moveNotes}
                           onChange={e => setMoveNotes(e.target.value)}
                           className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/50 outline-none text-foreground min-h-[100px] resize-none"
                           placeholder="Insira detalhes sobre a movimentação, como quantidade comprada..."
                           required
                        ></textarea>
                     </div>

                     <div className="flex gap-3 pt-4 border-t border-border mt-6">
                        <button 
                           type="button" 
                           onClick={handleCancelMove}
                           className="flex-1 px-4 py-3 border border-border text-foreground font-medium rounded-xl hover:bg-secondary transition-colors"
                        >
                           Cancelar
                        </button>
                        <button 
                           type="submit" 
                           className="flex-1 px-4 py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/25"
                        >
                           Salvar Movimentação
                        </button>
                     </div>
                  </form>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
         {showColumnsModal && (
            <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            >
            <motion.div 
               initial={{ scale: 0.95, y: 20 }}
               animate={{ scale: 1, y: 0 }}
               exit={{ scale: 0.95, y: 20 }}
               className="bg-card border border-border rounded-2xl w-full max-w-sm shadow-2xl p-6 relative overflow-hidden"
            >
               <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-emerald-500"></div>
               
               <div className="flex justify-between items-start mb-6 mt-2">
                  <h3 className="text-xl font-bold text-foreground">Personalizar Colunas</h3>
                  <button onClick={() => setShowColumnsModal(false)} className="p-1.5 text-muted-foreground hover:bg-secondary rounded-lg transition-colors">
                     <X className="w-5 h-5" />
                  </button>
               </div>
               
               <div className="space-y-3 mb-6">
                  {columns.map(col => (
                     <label key={col.id} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-secondary/30 hover:bg-secondary cursor-pointer transition-colors">
                        <input 
                           type="checkbox" 
                           checked={visibleCols.includes(col.id)}
                           onChange={() => toggleColumn(col.id)}
                           className="w-4 h-4 text-blue-600 rounded border-border focus:ring-blue-500"
                        />
                        <span className="text-sm font-medium text-foreground">{col.title}</span>
                     </label>
                  ))}
               </div>

               <button 
                  onClick={() => setShowColumnsModal(false)}
                  className="w-full px-4 py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/25"
               >
                  Concluído
               </button>
            </motion.div>
            </motion.div>
         )}
      </AnimatePresence>

      <AnimatePresence>
         {showCountModal && countMaterial && (
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
               className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl p-6 relative overflow-hidden z-10"
            >
               <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-emerald-500"></div>
               
               <div className="flex justify-between items-start mb-6 mt-2 gap-4">
                  <div className="min-w-0 flex-1">
                     <h3 className="text-xl font-bold text-foreground">Nova Contagem</h3>
                     <p className="text-sm text-muted-foreground mt-1 break-words">{countMaterial.name} ({countMaterial.code})</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                     <button
                        type="button"
                        onClick={() => setImageModalProduct(countMaterial)}
                        className="p-2 text-blue-500 hover:text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 rounded-xl transition-colors flex items-center justify-center"
                        title="Visualizar Foto do Produto"
                     >
                        <Eye className="w-5 h-5" />
                     </button>
                     <button 
                        type="button"
                        onClick={() => setShowCountModal(false)} 
                        className="p-1.5 text-muted-foreground hover:bg-secondary rounded-lg transition-colors"
                     >
                        <X className="w-5 h-5" />
                     </button>
                  </div>
               </div>

               <form onSubmit={handleCountSubmit} className="space-y-5">
                  <div>
                     <label className="block text-sm font-medium text-muted-foreground mb-1.5">Quantidade Encontrada Fisicamente ({formatUnit(countMaterial.unit)})</label>
                     <div className="flex items-center gap-4">
                        <input 
                           type="number" 
                           min="0"
                           value={countQuantity}
                           onChange={e => setCountQuantity(e.target.value ? parseInt(e.target.value) : '')}
                           className="w-32 bg-secondary/50 border border-border rounded-xl px-4 py-3 text-lg font-bold focus:ring-2 focus:ring-blue-500/50 outline-none text-foreground"
                           required
                        />
                        <div className="text-sm text-muted-foreground flex flex-col">
                           <span>Anterior: <strong className="text-foreground">{(focusGiro ? (countMaterial.quantityGiro || 0) : countMaterial.quantity)} {formatUnit(countMaterial.unit)}</strong></span>
                           <span className={cn(
                              "font-medium mt-0.5",
                              Number(countQuantity) > (focusGiro ? (countMaterial.quantityGiro || 0) : countMaterial.quantity) ? "text-emerald-500" : 
                              Number(countQuantity) < (focusGiro ? (countMaterial.quantityGiro || 0) : countMaterial.quantity) ? "text-red-500" : "text-muted-foreground"
                           )}>
                              Diferença: {Number(countQuantity) - (focusGiro ? (countMaterial.quantityGiro || 0) : countMaterial.quantity) > 0 ? '+' : ''}{Number(countQuantity) - (focusGiro ? (countMaterial.quantityGiro || 0) : countMaterial.quantity)} {formatUnit(countMaterial.unit)}
                           </span>
                        </div>
                     </div>
                  </div>
                  
                  <div>
                     <label className="block text-sm font-medium text-muted-foreground mb-1.5">Ação de Kanban / Status</label>
                     <select
                        value={countStatus}
                        onChange={e => setCountStatus(e.target.value as Material['status'])}
                        className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/50 outline-none text-foreground"
                     >
                        <option value="PENDING">Pendente / Contagem Pendente</option>
                        <option value="COUNTED_RECENTLY">Recém Contado</option>
                        <option value="AWAITING_CONFIRMATION">Aguardando Conferência (Gestor)</option>
                        <option value="PURCHASE_REQUESTED">Solicitado à Compra</option>
                        <option value="COMPLETED">Finalizado / Reposto / OK</option>
                        {!focusGiro && <option value="REALOCATED_TO_GIRO">Realocado para estoque de giro</option>}
                     </select>
                  </div>
                  
                  <div>
                     <label className="block text-sm font-medium text-muted-foreground mb-1.5">Observações (Opcional)</label>
                     <textarea 
                        value={countNotes}
                        onChange={e => setCountNotes(e.target.value)}
                        className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/50 outline-none text-foreground resize-none"
                        rows={3}
                        placeholder="Ex: Embalagem danificada, vencimento próximo..."
                     />
                  </div>

                  <div className="flex gap-3 pt-2">
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

      {imageModalProduct && (
        <ProductImageModal 
          material={imageModalProduct} 
          onClose={() => setImageModalProduct(null)} 
          onUpdate={fetchData} 
        />
      )}
    </div>
  );
}