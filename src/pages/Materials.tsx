import React, { useState, useEffect } from 'react';
import { apiFetch } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { Material, Sector, Supplier } from '../types';
import { StatusBadge } from './Dashboard';
import { Search, Edit3, Plus, TrendingDown, TrendingUp, X, History, Camera, Settings2, ClipboardCheck, AlertTriangle, Eye, Image as ImageIcon, Upload, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { cn, formatUnit } from '../lib/utils';
import { StockCountLog } from '../types';
import { BarcodeScanner } from '../components/BarcodeScanner';
import { ProductImageModal } from '../components/ProductImageModal';

// Gerador de dados de mini gráfico para efeito de hover
const generateMiniChartData = (baseQty: number) => {
   return Array.from({ length: 5 }).map((_, i) => ({
      val: Math.max(0, baseQty + (Math.random() * 20 - 10) * (i - 2))
   }));
};

const TABLE_COLUMNS = [
  { id: 'code', label: 'Código' },
  { id: 'material', label: 'Material' },
  { id: 'sector', label: 'Setor' },
  { id: 'stock', label: 'Estoque' },
  { id: 'status', label: 'Status (Kanban)' },
  { id: 'actions', label: 'Ações' }
];

export default function Materials() {
  const { token, isManager, user } = useAuth();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [search, setSearch] = useState('');
  const [filterSector, setFilterSector] = useState('');
  const [loading, setLoading] = useState(true);
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);

  // Preferências de colunas
  const [showColumnsModal, setShowColumnsModal] = useState(false);
  const [visibleCols, setVisibleCols] = useState<string[]>([]);
  
  useEffect(() => {
     if (token) {
        const saved = localStorage.getItem(`mat_cols_${token}`);
        if (saved) {
           setVisibleCols(JSON.parse(saved));
        } else {
           setVisibleCols(TABLE_COLUMNS.map(c => c.id));
        }
     }
  }, [token]);

  const toggleColumn = (colId: string) => {
     const newCols = visibleCols.includes(colId) 
        ? visibleCols.filter(c => c !== colId) 
        : [...visibleCols, colId];
     setVisibleCols(newCols);
     if (token) {
        localStorage.setItem(`mat_cols_${token}`, JSON.stringify(newCols));
     }
  };

  // Estados do Modal de Contagem e Detalhes
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  const [countQuantity, setCountQuantity] = useState<number | string>('');
  const [countNotes, setCountNotes] = useState('');
  const [countStatus, setCountStatus] = useState<Material['status']>('COMPLETED');
  const [duplicateModal, setDuplicateModal] = useState<{
    isOpen: boolean;
    code: string;
    existingProduct: Material | null;
  } | null>(null);
  const [unregisteredProductModal, setUnregisteredProductModal] = useState<{
    isOpen: boolean;
    code: string;
  } | null>(null);
  const [imageModalMaterial, setImageModalMaterial] = useState<Material | null>(null);
  const [detailMaterial, setDetailMaterial] = useState<Material | null>(null);
  
  const [sectorWarningModal, setSectorWarningModal] = useState<{
    isOpen: boolean;
    productName: string;
    currentSectorName: string;
    newSectorId: string;
    newSectorName: string;
    isEdit: boolean;
  } | null>(null);

  const [showNewModal, setShowNewModal] = useState(false);
  const [newMaterial, setNewMaterial] = useState({ 
    code: '', 
    codigoBarras: '', 
    name: '', 
    sectorId: '', 
    quantity: '' as string | number, 
    unit: 'unidade', 
    estoqueMinimo: 5 as string | number,
    supplierId: '',
    origin: '',
    imageUrl: '',
    supplierDeliveryDays: '' as string | number,
    area: '',
    estante: '',
    prateleira: '',
    palete: '',
    paleteQty: '' as string | number,
    additionalSectors: ''
  });
  const [showScanner, setShowScanner] = useState(false);
  const [scanTarget, setScanTarget] = useState<'search' | 'editMaterial' | null>(null);

  // Estado do Modal de Cadastro de Fornecedor
  const [showAddSupplierModal, setShowAddSupplierModal] = useState(false);
  const [supplierModalTarget, setSupplierModalTarget] = useState<'new' | 'edit' | null>(null);
  const [newSupplierName, setNewSupplierName] = useState('');
  const [newSupplierDeliveryDays, setNewSupplierDeliveryDays] = useState(0);

  // Estado do Modal de Edição de Material
  const [showEditMaterialModal, setShowEditMaterialModal] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [editMaterialForm, setEditMaterialForm] = useState({
    id: '',
    code: '',
    codigoBarras: '',
    name: '',
    sectorId: '',
    quantity: '' as string | number,
    unit: 'unidade',
    estoqueMinimo: 5 as string | number,
    supplierId: '',
    origin: '',
    imageUrl: '',
    supplierDeliveryDays: '' as string | number,
    area: '',
    estante: '',
    prateleira: '',
    palete: '',
    paleteQty: '' as string | number,
    additionalSectors: ''
  });

  const handleSectorCheckboxChange = (checked: boolean, targetSector: Sector, isEdit: boolean) => {
    const form = isEdit ? editMaterialForm : newMaterial;
    
    if (checked) {
      const primarySector = sectors.find(s => s.id === form.sectorId);
      const primaryName = primarySector ? primarySector.name : 'Nenhum';
      
      setSectorWarningModal({
        isOpen: true,
        productName: form.name || 'Este produto',
        currentSectorName: primaryName,
        newSectorId: targetSector.id,
        newSectorName: targetSector.name,
        isEdit
      });
    } else {
      const setForm = isEdit ? setEditMaterialForm : setNewMaterial;
      const current = (form.additionalSectors || '').split(',').filter(Boolean);
      const updated = current.filter(id => id !== targetSector.id);
      setForm((prev: any) => ({ ...prev, additionalSectors: updated.join(',') }));
    }
  };

  const confirmSectorAddition = () => {
    if (!sectorWarningModal) return;
    const { newSectorId, isEdit } = sectorWarningModal;
    const form = isEdit ? editMaterialForm : newMaterial;
    const setForm = isEdit ? setEditMaterialForm : setNewMaterial;
    
    const current = (form.additionalSectors || '').split(',').filter(Boolean);
    if (!current.includes(newSectorId)) {
      const updated = [...current, newSectorId];
      setForm((prev: any) => ({ ...prev, additionalSectors: updated.join(',') }));
    }
    setSectorWarningModal(null);
  };

  const handleOpenEditMaterial = (material: Material) => {
    setEditingMaterial(material);
    setEditMaterialForm({
      id: material.id,
      code: material.code,
      codigoBarras: material.codigoBarras || '',
      name: material.name,
      sectorId: material.sectorId,
      quantity: material.quantity,
      unit: material.unit || 'unidade',
      estoqueMinimo: material.estoqueMinimo,
      supplierId: material.supplierId || '',
      origin: material.origin || '',
      imageUrl: material.imageUrl || '',
      supplierDeliveryDays: material.supplierDeliveryDays !== null && material.supplierDeliveryDays !== undefined ? material.supplierDeliveryDays : '',
      area: material.area || '',
      estante: material.estante || '',
      prateleira: material.prateleira || '',
      palete: material.palete || '',
      paleteQty: material.paleteQty !== null && material.paleteQty !== undefined ? material.paleteQty : '',
      additionalSectors: material.additionalSectors || ''
    });
    setShowEditMaterialModal(true);
  };

  const handleEditMaterialSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMaterial) return;

    const duplicate = materials.find(m => m.id !== editingMaterial.id && m.code.trim().toLowerCase() === editMaterialForm.code.trim().toLowerCase());
    if (duplicate) {
      setDuplicateModal({
        isOpen: true,
        code: editMaterialForm.code,
        existingProduct: duplicate
      });
      return;
    }

    try {
      await apiFetch(`/api/materials/${editingMaterial.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: editMaterialForm.name,
          code: editMaterialForm.code,
          codigoBarras: editMaterialForm.codigoBarras,
          quantity: Number(editMaterialForm.quantity),
          estoqueMinimo: Number(editMaterialForm.estoqueMinimo),
          unit: editMaterialForm.unit,
          sectorId: editMaterialForm.sectorId,
          supplierId: editMaterialForm.supplierId || null,
          origin: editMaterialForm.origin || null,
          imageUrl: editMaterialForm.imageUrl || null,
          supplierDeliveryDays: editMaterialForm.supplierDeliveryDays !== '' ? Number(editMaterialForm.supplierDeliveryDays) : null,
          area: editMaterialForm.area || null,
          estante: editMaterialForm.estante || null,
          prateleira: editMaterialForm.prateleira || null,
          palete: editMaterialForm.palete || null,
          paleteQty: editMaterialForm.palete ? (editMaterialForm.paleteQty !== '' ? Number(editMaterialForm.paleteQty) : null) : null,
          additionalSectors: editMaterialForm.additionalSectors || null
        })
      }, token);
      setShowEditMaterialModal(false);
      setEditingMaterial(null);
      fetchData();
      window.dispatchEvent(new CustomEvent('products-changed'));
    } catch (err: any) {
      alert(err.message || 'Erro ao editar material');
    }
  };

  // Estado do Modal de Histórico de Contagens
  const [historyMaterial, setHistoryMaterial] = useState<Material | null>(null);
  const [historyLogs, setHistoryLogs] = useState<StockCountLog[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyDateFilter, setHistoryDateFilter] = useState('');
  const [historyUserFilter, setHistoryUserFilter] = useState('');

  const fetchHistory = async (materialId: string) => {
    setHistoryLoading(true);
    try {
      const logs = await apiFetch('/api/logs/stock', {}, token);
      setHistoryLogs(logs.filter((l: StockCountLog) => l.materialId === materialId));
    } catch (err) {
      console.error(err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleOpenHistory = (material: Material) => {
    setHistoryMaterial(material);
    setHistoryDateFilter('');
    setHistoryUserFilter('');
    fetchHistory(material.id);
  };

  const fetchData = async () => {
    try {
      const [mats, secs, sups] = await Promise.all([
        apiFetch('/api/materials', {}, token),
        apiFetch('/api/sectors', {}, token).catch(() => []),
        apiFetch('/api/suppliers', {}, token).catch(() => [])
      ]);
      setMaterials(mats);
      if (secs.length) setSectors(secs);
      if (sups.length) setSuppliers(sups);
    } finally {
      setLoading(false);
    }
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
    if (detailMaterial) {
      const updated = materials.find(m => m.id === detailMaterial.id);
      if (updated) {
        setDetailMaterial(updated);
      }
    }
  }, [materials, detailMaterial]);

  const handleCountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMaterial) return;

    try {
      await apiFetch(`/api/materials/${selectedMaterial.id}/count`, {
        method: 'POST',
        body: JSON.stringify({
          newQuantity: countQuantity,
          notes: countNotes,
          status: countStatus
        })
      }, token);
      
      setSelectedMaterial(null);
      fetchData(); 
      window.dispatchEvent(new CustomEvent('products-changed'));
    } catch (err) {
      alert('Erro ao registrar contagem.');
    }
  };

  const handleCreateMaterial = async (e: React.FormEvent) => {
    e.preventDefault();

    const duplicate = materials.find(m => m.code.trim().toLowerCase() === newMaterial.code.trim().toLowerCase());
    if (duplicate) {
      setDuplicateModal({
        isOpen: true,
        code: newMaterial.code,
        existingProduct: duplicate
      });
      return;
    }

    try {
      await apiFetch('/api/materials', {
        method: 'POST',
        body: JSON.stringify({
          ...newMaterial,
          supplierId: newMaterial.supplierId || null,
          origin: newMaterial.origin || null,
          imageUrl: newMaterial.imageUrl || null,
          supplierDeliveryDays: newMaterial.supplierDeliveryDays !== '' ? Number(newMaterial.supplierDeliveryDays) : null,
          area: newMaterial.area || null,
          estante: newMaterial.estante || null,
          prateleira: newMaterial.prateleira || null,
          palete: newMaterial.palete || null,
          paleteQty: newMaterial.palete ? (newMaterial.paleteQty !== '' ? Number(newMaterial.paleteQty) : null) : null,
          additionalSectors: newMaterial.additionalSectors || null
        })
      }, token);
      setShowNewModal(false);
      setNewMaterial({ 
        code: '', 
        codigoBarras: '', 
        name: '', 
        sectorId: '', 
        quantity: '' as string | number, 
        unit: 'unidade', 
        estoqueMinimo: 5 as string | number,
        supplierId: '',
        origin: '',
        imageUrl: '',
        supplierDeliveryDays: '' as string | number,
        area: '',
        estante: '',
        prateleira: '',
        palete: '',
        paleteQty: '' as string | number,
        additionalSectors: ''
      });
      fetchData();
      window.dispatchEvent(new CustomEvent('products-changed'));
    } catch (err) {
      alert('Erro ao criar material');
    }
  };

  const filteredMaterials = materials.filter(m => {
    if (!isManager && user) {
      const userSectors = [user.sectorId, ...(user.additionalSectors || '').split(',')].filter(Boolean);
      if (userSectors.length > 0) {
        const matSectors = [m.sectorId, ...(m.additionalSectors || '').split(',')].filter(Boolean);
        const hasOverlap = matSectors.some(id => userSectors.includes(id));
        if (!hasOverlap) {
          return false;
        }
      }
    }
    const matchesSearch = m.name.toLowerCase().includes(search.toLowerCase()) || m.code.toLowerCase().includes(search.toLowerCase()) || (m.codigoBarras && m.codigoBarras.includes(search));
    const matchesSector = filterSector ? (m.sectorId === filterSector || (m.additionalSectors || '').split(',').includes(filterSector)) : true;
    return matchesSearch && matchesSector;
  }).sort((a, b) => {
    const now = new Date().getTime();
    const aRecent = a.repostedAt ? (now - new Date(a.repostedAt).getTime() < 24 * 60 * 60 * 1000) : false;
    const bRecent = b.repostedAt ? (now - new Date(b.repostedAt).getTime() < 24 * 60 * 60 * 1000) : false;
    if (aRecent && !bRecent) return -1;
    if (!aRecent && bRecent) return 1;
    if (aRecent && bRecent) {
       return new Date(b.repostedAt!).getTime() - new Date(a.repostedAt!).getTime();
    }
    return 0;
  });

  const handleScanResult = (decodedText: string) => {
    setShowScanner(false);
    
    if (scanTarget === 'editMaterial') {
      setEditMaterialForm(prev => ({ ...prev, codigoBarras: decodedText }));
      setScanTarget(null);
      return;
    }

    // Buscar material por código de barras ou código
    const found = materials.find(m => m.codigoBarras === decodedText || m.code === decodedText);
    
    if (found) {
      setSelectedMaterial(found);
      setCountQuantity(found.quantity);
      setCountNotes('');
      setCountStatus(found.status);
    } else {
      // Abre o modal informando que o produto não está cadastrado
      setUnregisteredProductModal({
        isOpen: true,
        code: decodedText
      });
      // Preenche os dados no formulário de novo produto
      setNewMaterial(prev => ({
        ...prev,
        code: decodedText,
        codigoBarras: decodedText
      }));
      // Abre o modal padrão de criação de produto
      setShowNewModal(true);
    }
    setScanTarget(null);
  };

  if (loading) return <div className="p-8 text-muted-foreground">Carregando materiais...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-card/50 backdrop-blur-md p-4 rounded-2xl border border-border shadow-sm relative z-10">
        <div className="flex-1 flex flex-col sm:flex-row gap-4 w-full">
          <div className="relative flex-1 sm:max-w-md flex gap-2">
            <div className="relative flex-1">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
               <input 
                 type="text" 
                 placeholder="Buscar por nome ou código..." 
                 className="w-full pl-9 pr-4 py-2 bg-secondary/50 border border-border rounded-xl text-sm focus:ring-2 focus:ring-blue-500/50 outline-none transition-all placeholder:text-muted-foreground/50 text-foreground"
                 value={search}
                 onChange={e => setSearch(e.target.value)}
               />
            </div>
            <button 
               onClick={() => {
                  setScanTarget('search');
                  setShowScanner(true);
               }}
               className="p-2 bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 border border-blue-500/20 rounded-xl transition-colors flex items-center justify-center shrink-0"
               title="Ler Código de Barras"
            >
               <Camera className="w-5 h-5" />
            </button>
          </div>
          <select 
            className="border border-border bg-secondary/50 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500/50 outline-none text-foreground w-full sm:w-auto"
            value={filterSector}
            onChange={e => setFilterSector(e.target.value)}
          >
            <option value="">Todos os Setores</option>
            {sectors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        {isManager && (
          <div className="flex gap-2 w-full lg:w-auto justify-end">
            <button 
              onClick={() => setShowColumnsModal(true)}
              className="bg-secondary text-foreground hover:bg-secondary/80 px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 transition-all border border-border shrink-0"
              title="Personalizar Colunas"
            >
              <Settings2 className="w-4 h-4" /> Colunas
            </button>
            <button 
              onClick={() => setShowNewModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 transition-all shadow-lg shadow-blue-500/25 shrink-0"
            >
              <Plus className="w-4 h-4" /> Novo Material
            </button>
          </div>
        )}
      </div>

      <div className="bg-card/50 backdrop-blur-md rounded-2xl border border-border shadow-sm overflow-hidden relative z-10">
        {/* Desktop view: table */}
        <div className="overflow-x-auto hidden md:block">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-secondary/50">
              <tr>
                {visibleCols.includes('code') && <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Código</th>}
                {visibleCols.includes('material') && <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Material</th>}
                {visibleCols.includes('sector') && <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Setor</th>}
                {visibleCols.includes('stock') && <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Estoque</th>}
                {visibleCols.includes('status') && <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status (Kanban)</th>}
                {visibleCols.includes('actions') && <th className="px-6 py-4 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ações</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border relative">
              <AnimatePresence>
                {filteredMaterials.map(mat => (
                  <motion.tr 
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    key={mat.id} 
                    className="hover:bg-secondary/30 cursor-pointer transition-colors relative group"
                    onMouseEnter={() => setHoveredRow(mat.id)}
                    onMouseLeave={() => setHoveredRow(null)}
                    onClick={(e) => {
                      const target = e.target as HTMLElement;
                      if (target.closest('button') || target.closest('a')) return;
                      setDetailMaterial(mat);
                    }}
                  >
                    {visibleCols.includes('code') && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-muted-foreground flex flex-col">
                         <span>{mat.code}</span>
                         {mat.codigoBarras && <span className="text-xs opacity-50">{mat.codigoBarras}</span>}
                      </td>
                    )}
                    {visibleCols.includes('material') && (
                      <td className="px-6 py-4 whitespace-nowrap relative">
                        <div className="text-sm font-medium text-foreground flex items-center gap-2">{mat.name}{mat.repostedAt && (new Date().getTime() - new Date(mat.repostedAt).getTime() < 24 * 60 * 60 * 1000) && (<span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-500 border border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.15)] animate-pulse">Novo</span>)}</div>
                        {mat.notes && <div className="text-xs text-muted-foreground mt-1 max-w-[200px] truncate">{mat.notes}</div>}
                      </td>
                    )}
                    {visibleCols.includes('sector') && <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">{mat.sector}</td>}
                    {visibleCols.includes('stock') && (
                      <td className="px-6 py-4 whitespace-nowrap relative">
                        <div className="flex items-center gap-2">
                           <span className="text-sm font-bold text-foreground">{mat.quantity} {formatUnit(mat.unit)}</span>
                           {/* Smart Table Hover Chart */}
                           {hoveredRow === mat.id && (
                              <motion.div 
                                 initial={{ opacity: 0, scale: 0.8, x: -10 }}
                                 animate={{ opacity: 1, scale: 1, x: 0 }}
                                 className="absolute left-14 top-1/2 -translate-y-1/2 h-8 w-20 bg-background/80 rounded border border-border px-1 pointer-events-none"
                              >
                                 <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={generateMiniChartData(mat.quantity)}>
                                       <Line type="monotone" dataKey="val" stroke="#6366f1" strokeWidth={2} dot={false} isAnimationActive={false} />
                                    </LineChart>
                                 </ResponsiveContainer>
                              </motion.div>
                           )}
                        </div>
                      </td>
                    )}
                    {visibleCols.includes('status') && <td className="px-6 py-4 whitespace-nowrap"><StatusBadge status={mat.status} /></td>}
                    {visibleCols.includes('actions') && (
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end gap-2">
                           <button 
                             onClick={() => handleOpenHistory(mat)}
                             className="text-emerald-500 hover:text-emerald-400 p-2 rounded-lg hover:bg-emerald-500/10 transition-colors inline-flex items-center gap-1.5"
                             title="Ver Histórico de Contagens"
                           >
                             <History className="w-4 h-4" />
                           </button>
                           <button 
                             onClick={() => setImageModalMaterial(mat)}
                             className="text-amber-500 hover:text-amber-400 p-2 rounded-lg hover:bg-amber-500/10 transition-colors inline-flex items-center gap-1.5"
                             title="Visualizar Foto Ilustrativa"
                           >
                             <Eye className="w-4 h-4" />
                             <span className="sr-only sm:not-sr-only text-xs">Ver</span>
                           </button>
                           <button 
                             onClick={() => {
                               setSelectedMaterial(mat);
                               setCountQuantity(mat.quantity);
                               setCountNotes(mat.notes || '');
                               setCountStatus(mat.status);
                             }}
                             className="text-blue-500 hover:text-blue-400 p-2 rounded-lg hover:bg-blue-500/10 transition-colors inline-flex items-center gap-1.5"
                           >
                             <ClipboardCheck className="w-4 h-4" />
                             <span className="sr-only sm:not-sr-only text-xs">Contar</span>
                           </button>
                           {isManager && (
                             <button 
                               onClick={() => handleOpenEditMaterial(mat)}
                               className="text-indigo-500 hover:text-indigo-400 p-2 rounded-lg hover:bg-indigo-500/10 transition-colors inline-flex items-center gap-1.5"
                               title="Editar Produto"
                             >
                               <Edit3 className="w-4 h-4" />
                               <span className="sr-only sm:not-sr-only text-xs">Editar</span>
                             </button>
                           )}
                        </div>
                      </td>
                    )}
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
          {filteredMaterials.length === 0 && (
            <div className="p-8 text-center text-muted-foreground">
              Nenhum material encontrado com os filtros atuais.
            </div>
          )}
        </div>

        {/* Mobile view: Cards list */}
        <div className="md:hidden block divide-y divide-border/60">
          <AnimatePresence>
            {filteredMaterials.map(mat => (
              <motion.div
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                key={mat.id}
                onClick={(e) => {
                  const target = e.target as HTMLElement;
                  if (target.closest('button') || target.closest('a')) return;
                  setDetailMaterial(mat);
                }}
                className="p-4 hover:bg-secondary/10 cursor-pointer transition-colors flex flex-col gap-3.5 relative"
              >
                {/* Header (SKU / Code & Title / Badge) */}
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-foreground flex items-center gap-1.5 flex-wrap">
                      <span className="truncate">{mat.name}</span>
                      {mat.repostedAt && (new Date().getTime() - new Date(mat.repostedAt).getTime() < 24 * 60 * 60 * 1000) && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-500 border border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.15)] animate-pulse">
                          Novo
                        </span>
                      )}
                    </div>
                    <div className="text-xs font-mono text-muted-foreground mt-0.5 flex flex-col">
                      <span>Código: {mat.code}</span>
                      {mat.codigoBarras && <span className="opacity-60 text-[10px] truncate">EAN: {mat.codigoBarras}</span>}
                    </div>
                  </div>
                  <div className="shrink-0">
                     <StatusBadge status={mat.status} />
                  </div>
                </div>

                {/* Meta Detail Boxes */}
                <div className="grid grid-cols-2 gap-3 bg-secondary/30 p-3 rounded-xl border border-border/40 text-xs">
                  <div>
                    <span className="text-muted-foreground block font-medium mb-0.5">Setor</span>
                    <span className="text-foreground font-semibold truncate block">{mat.sector || 'Geral'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block font-medium mb-0.5">Estoque Disponível</span>
                    <span className="text-foreground font-bold text-sm block">
                      {mat.quantity} {formatUnit(mat.unit)}
                    </span>
                  </div>
                </div>

                {/* Notes if any */}
                {mat.notes && (
                  <p className="text-xs text-muted-foreground line-clamp-2 bg-secondary/10 px-2.5 py-2 rounded-lg border border-border/20 italic">
                    {mat.notes}
                  </p>
                )}

                {/* Actions Row */}
                <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-border/40 flex-wrap">
                  <button 
                    onClick={() => handleOpenHistory(mat)}
                    className="text-emerald-500 hover:text-emerald-400 p-2 rounded-lg hover:bg-emerald-500/10 transition-colors inline-flex items-center gap-1 text-xs"
                    title="Histórico"
                  >
                    <History className="w-4 h-4" />
                    <span>Histórico</span>
                  </button>
                  <button 
                    onClick={() => setImageModalMaterial(mat)}
                    className="text-amber-500 hover:text-amber-400 p-2 rounded-lg hover:bg-amber-500/10 transition-colors inline-flex items-center gap-1 text-xs"
                    title="Ver Foto"
                  >
                    <Eye className="w-4 h-4" />
                    <span>Ver Foto</span>
                  </button>
                  <button 
                    onClick={() => {
                      setSelectedMaterial(mat);
                      setCountQuantity(mat.quantity);
                      setCountNotes(mat.notes || '');
                      setCountStatus(mat.status);
                    }}
                    className="text-blue-500 hover:text-blue-400 p-2 rounded-lg hover:bg-blue-500/10 transition-colors inline-flex items-center gap-1 text-xs"
                  >
                    <ClipboardCheck className="w-4 h-4" />
                    <span>Contar</span>
                  </button>
                  {isManager && (
                    <button 
                      onClick={() => handleOpenEditMaterial(mat)}
                      className="text-indigo-500 hover:text-indigo-400 p-2 rounded-lg hover:bg-indigo-500/10 transition-colors inline-flex items-center gap-1 text-xs"
                      title="Editar"
                    >
                      <Edit3 className="w-4 h-4" />
                      <span>Editar</span>
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          {filteredMaterials.length === 0 && (
            <div className="p-8 text-center text-muted-foreground">
              Nenhum material encontrado com os filtros atuais.
            </div>
          )}
        </div>
      </div>

      {/* Modal de Configuração de Colunas */}
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
                  {TABLE_COLUMNS.map(col => (
                     <label key={col.id} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-secondary/30 hover:bg-secondary cursor-pointer transition-colors">
                        <input 
                           type="checkbox" 
                           checked={visibleCols.includes(col.id)}
                           onChange={() => toggleColumn(col.id)}
                           className="w-4 h-4 text-blue-600 rounded border-border focus:ring-blue-500"
                        />
                        <span className="text-sm font-medium text-foreground">{col.label}</span>
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

      {/* Modal de Contagem */}
      <AnimatePresence>
         {selectedMaterial && (
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
               className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl p-6 relative overflow-hidden"
            >
               <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-emerald-500"></div>
               
               <div className="flex justify-between items-start mb-6 mt-2">
                  <div>
                     <h3 className="text-xl font-bold text-foreground">Nova Contagem</h3>
                     <p className="text-sm text-muted-foreground mt-1">{selectedMaterial.name} ({selectedMaterial.code})</p>
                  </div>
                  <button onClick={() => setSelectedMaterial(null)} className="p-1.5 text-muted-foreground hover:bg-secondary rounded-lg transition-colors">
                     <X className="w-5 h-5" />
                  </button>
               </div>
               
               <form onSubmit={handleCountSubmit} className="space-y-5">
               <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1.5">Quantidade Encontrada Fisicamente ({formatUnit(selectedMaterial.unit)})</label>
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
                        <span>Anterior: <strong className="text-foreground">{selectedMaterial.quantity} {formatUnit(selectedMaterial.unit)}</strong></span>
                        <span className={cn(
                           "font-medium mt-0.5",
                           Number(countQuantity) > selectedMaterial.quantity ? "text-emerald-500" : 
                           Number(countQuantity) < selectedMaterial.quantity ? "text-red-500" : "text-muted-foreground"
                        )}>
                           Diferença: {Number(countQuantity) - selectedMaterial.quantity > 0 ? '+' : ''}{Number(countQuantity) - selectedMaterial.quantity} {formatUnit(selectedMaterial.unit)}
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
                  </select>
               </div>
               
               <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1.5">Observações (Opcional)</label>
                  <textarea 
                     value={countNotes}
                     onChange={e => setCountNotes(e.target.value)}
                     className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/50 outline-none resize-none text-foreground"
                     rows={3}
                     placeholder="Ex: Embalagem danificada, vencimento próximo..."
                  />
               </div>

               <div className="flex gap-3 pt-2">
                  <button 
                     type="button" 
                     onClick={() => setSelectedMaterial(null)}
                     className="flex-1 px-4 py-3 border border-border text-foreground font-medium rounded-xl hover:bg-secondary transition-colors"
                  >
                     Cancelar
                  </button>
                  <button 
                     type="submit" 
                     className="flex-1 px-4 py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/25"
                  >
                     Salvar Contagem
                  </button>
               </div>
               </form>
            </motion.div>
            </motion.div>
         )}
      </AnimatePresence>

      {/* Modal Novo Material */}
      <AnimatePresence>
         {showNewModal && (
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
               className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl p-6 relative overflow-hidden"
            >
               <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-blue-500"></div>
               
               <div className="flex justify-between items-start mb-6 mt-2">
                  <h3 className="text-xl font-bold text-foreground">Cadastrar Novo Material</h3>
                  <button onClick={() => setShowNewModal(false)} className="p-1.5 text-muted-foreground hover:bg-secondary rounded-lg transition-colors">
                     <X className="w-5 h-5" />
                  </button>
               </div>
               
               <form onSubmit={handleCreateMaterial} className="space-y-4">
               <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1.5">Código</label>
                  <input 
                     type="text" 
                     value={newMaterial.code}
                     onChange={e => setNewMaterial({...newMaterial, code: e.target.value})}
                     className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500/50 outline-none text-foreground font-mono"
                     placeholder="Ex: MAT-001"
                     required
                  />
               </div>
               
               <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1.5">Código de Barras</label>
                  <input 
                     type="text" 
                     value={newMaterial.codigoBarras}
                     onChange={e => setNewMaterial({...newMaterial, codigoBarras: e.target.value})}
                     className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500/50 outline-none text-foreground font-mono"
                     placeholder="Ex: 7891000..."
                  />
               </div>

               <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1.5">Nome do Material</label>
                  <input 
                     type="text" 
                     value={newMaterial.name}
                     onChange={e => setNewMaterial({...newMaterial, name: e.target.value})}
                     className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500/50 outline-none text-foreground"
                     required
                  />
               </div>

               <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1.5">Setor</label>
                  <select 
                     value={newMaterial.sectorId}
                      onChange={e => setNewMaterial({...newMaterial, sectorId: e.target.value})}
                      className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500/50 outline-none text-foreground"
                      required
                   >
                      <option value="">Selecione um setor...</option>
                      {sectors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                   </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                   <div>
                      <div className="flex justify-between items-center mb-1.5">
                         <label className="block text-sm font-medium text-muted-foreground">Fornecedor</label>
                         <button 
                            type="button" 
                            onClick={() => {
                               setSupplierModalTarget('new');
                               setShowAddSupplierModal(true);
                            }}
                            className="text-xs text-blue-500 hover:underline"
                         >
                            + Novo
                         </button>
                      </div>
                      <select 
                         value={newMaterial.supplierId}
                         onChange={e => setNewMaterial({...newMaterial, supplierId: e.target.value})}
                         className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500/50 outline-none text-foreground cursor-pointer"
                      >
                         <option value="">Selecione...</option>
                         {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                   </div>
                   
                   <div>
                      <label className="block text-sm font-medium text-muted-foreground mb-1.5">Origem</label>
                      <input 
                         type="text" 
                         value={newMaterial.origin}
                         onChange={e => setNewMaterial({...newMaterial, origin: e.target.value})}
                         className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500/50 outline-none text-foreground"
                         placeholder="Ex: Nacional, Importado"
                      />
                   </div>
                </div>

                 <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1.5 font-sans">Prazo de Entrega (Dias - Opcional)</label>
                    <input 
                       type="number" 
                       min="0"
                       placeholder="Ex: 5"
                       value={newMaterial.supplierDeliveryDays}
                       onChange={e => setNewMaterial({...newMaterial, supplierDeliveryDays: e.target.value})}
                       className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500/50 outline-none text-foreground text-sm"
                    />
                 </div>

                 <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1.5">Imagem do Produto (URL ou upload local)</label>
                    <div className="flex gap-2">
                       <input 
                          type="text" 
                          value={newMaterial.imageUrl || ''}
                          onChange={e => setNewMaterial({...newMaterial, imageUrl: e.target.value})}
                          className="flex-1 bg-secondary/50 border border-border rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500/50 outline-none text-foreground text-sm"
                          placeholder="Ex: https://imagens.com/produto.jpg"
                       />
                       <label className="bg-secondary hover:bg-secondary/80 border border-border text-foreground p-3 rounded-xl cursor-pointer flex items-center justify-center shrink-0" title="Upload de Imagem Local">
                          <Upload className="w-5 h-5 text-muted-foreground" />
                          <input 
                             type="file" 
                             accept="image/*" 
                             className="hidden" 
                             onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                   const reader = new FileReader();
                                   reader.onloadend = () => {
                                      setNewMaterial({...newMaterial, imageUrl: reader.result as string});
                                   };
                                   reader.readAsDataURL(file);
                                }
                             }}
                          />
                       </label>
                    </div>
                    {newMaterial.imageUrl && (
                       <div className="mt-2 relative w-12 h-12 border border-border rounded-lg overflow-hidden bg-secondary">
                          <img src={newMaterial.imageUrl} alt="Preview" className="w-full h-full object-cover" />
                          <button 
                             type="button" 
                             onClick={() => setNewMaterial({...newMaterial, imageUrl: ''})}
                             className="absolute inset-0 bg-black/50 flex items-center justify-center text-white opacity-0 hover:opacity-100 transition-opacity"
                          >
                             <Trash2 className="w-4 h-4 text-red-500" />
                          </button>
                       </div>
                    )}
                 </div>

                <div className="grid grid-cols-3 gap-4">
                   <div>
                      <label className="block text-sm font-medium text-muted-foreground mb-1.5">Unidade</label>
                     <select 
                        value={newMaterial.unit}
                        onChange={e => setNewMaterial({...newMaterial, unit: e.target.value})}
                        className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500/50 outline-none text-foreground cursor-pointer"
                     >
                        <option value="unidade">un</option>
                        <option value="pacote">pct</option>
                        <option value="caixa">cx</option>
                        <option value="palete">plt</option>
                        <option value="kg">kg</option>
                        <option value="l">l</option>
                     </select>
                  </div>
                  <div>
                     <label className="block text-sm font-medium text-muted-foreground mb-1.5">Qtd. Inicial</label>
                     <input 
                        type="number" 
                        min="0"
                        value={newMaterial.quantity}
                        onChange={e => setNewMaterial({...newMaterial, quantity: e.target.value ? parseInt(e.target.value) : ''})}
                        className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500/50 outline-none text-foreground font-bold"
                        required
                     />
                  </div>
                  <div>
                     <label className="block text-sm font-medium text-muted-foreground mb-1.5">Mínimo</label>
                     <input 
                        type="number" 
                        min="0"
                        value={newMaterial.estoqueMinimo}
                        onChange={e => setNewMaterial({...newMaterial, estoqueMinimo: e.target.value ? parseInt(e.target.value) : ''})}
                        className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500/50 outline-none text-foreground font-bold"
                        required
                     />
                  </div>
               </div>

               {/* Localização Física (Opcional) */}
               <div className="border-t border-border/50 pt-4 space-y-4">
                  <h4 className="text-sm font-semibold text-foreground">Localização Física (Opcional)</h4>
                  <div className="grid grid-cols-2 gap-4">
                     <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">Área</label>
                        <input 
                           type="text" 
                           value={newMaterial.area}
                           onChange={e => setNewMaterial({...newMaterial, area: e.target.value})}
                           className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-emerald-500/50 outline-none text-foreground text-sm"
                           placeholder="Ex: Área A"
                        />
                     </div>
                     <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">Estante</label>
                        <input 
                           type="text" 
                           value={newMaterial.estante}
                           onChange={e => setNewMaterial({...newMaterial, estante: e.target.value})}
                           className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-emerald-500/50 outline-none text-foreground text-sm"
                           placeholder="Ex: Estante 3"
                        />
                     </div>
                     <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">Prateleira</label>
                        <input 
                           type="text" 
                           value={newMaterial.prateleira}
                           onChange={e => setNewMaterial({...newMaterial, prateleira: e.target.value})}
                           className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-emerald-500/50 outline-none text-foreground text-sm"
                           placeholder="Ex: Prateleira B"
                        />
                     </div>
                     <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">Palete</label>
                        <input 
                           type="text" 
                           value={newMaterial.palete}
                           onChange={e => setNewMaterial({...newMaterial, palete: e.target.value})}
                           className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-emerald-500/50 outline-none text-foreground text-sm"
                           placeholder="Ex: Palete 12"
                        />
                     </div>
                  </div>
                  <AnimatePresence>
                     {newMaterial.palete && (
                        <motion.div 
                           initial={{ opacity: 0, height: 0 }}
                           animate={{ opacity: 1, height: 'auto' }}
                           exit={{ opacity: 0, height: 0 }}
                           className="space-y-1.5"
                        >
                           <label className="block text-xs font-medium text-muted-foreground">Quantidade do Palete</label>
                           <input 
                              type="number" 
                              min="0"
                              value={newMaterial.paleteQty}
                              onChange={e => setNewMaterial({...newMaterial, paleteQty: e.target.value ? parseInt(e.target.value) : ''})}
                              className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-emerald-500/50 outline-none text-foreground text-sm font-bold"
                              placeholder="Ex: 50"
                           />
                        </motion.div>
                     )}
                  </AnimatePresence>
               </div>

               {/* Vínculo de Setores Adicionais */}
               <div className="border-t border-border/50 pt-4 space-y-2">
                  <label className="block text-sm font-semibold text-foreground">Vincular a Outros Setores (Opcional)</label>
                  <p className="text-xs text-muted-foreground mb-2">Selecione setores adicionais nos quais este material também estará visível.</p>
                  <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto p-2 bg-secondary/20 rounded-xl border border-border/50">
                     {sectors
                        .filter(s => s.id !== newMaterial.sectorId)
                        .map(s => {
                           const isChecked = (newMaterial.additionalSectors || '')
                             .split(',')
                             .filter(Boolean)
                             .includes(s.id);
                           return (
                             <label key={s.id} className="flex items-center gap-2 px-3 py-1.5 hover:bg-secondary/50 rounded-lg cursor-pointer text-xs text-foreground">
                                <input
                                   type="checkbox"
                                   checked={isChecked}
                                   onChange={e => handleSectorCheckboxChange(e.target.checked, s, false)}
                                   className="rounded text-emerald-500 bg-secondary/50 border-border focus:ring-emerald-500 w-3.5 h-3.5"
                                />
                                <span className="truncate">{s.name}</span>
                             </label>
                           );
                        })}
                     {sectors.filter(s => s.id !== newMaterial.sectorId).length === 0 && (
                        <p className="text-xs text-muted-foreground italic p-2 col-span-2">Nenhum outro setor disponível</p>
                     )}
                  </div>
               </div>

               <div className="flex gap-3 pt-4">
                  <button 
                     type="button" 
                     onClick={() => setShowNewModal(false)}
                     className="flex-1 px-4 py-3 border border-border text-foreground font-medium rounded-xl hover:bg-secondary transition-colors"
                  >
                     Cancelar
                  </button>
                  <button 
                     type="submit" 
                     className="flex-1 px-4 py-3 bg-emerald-600 text-white font-medium rounded-xl hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-500/25"
                  >
                     Cadastrar
                  </button>
               </div>
               </form>
            </motion.div>
            </motion.div>
         )}
      </AnimatePresence>

      {/* History Modal */}
      <AnimatePresence>
         {historyMaterial && (
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
               className="bg-card border border-border rounded-2xl w-full max-w-2xl shadow-2xl p-6 relative overflow-hidden max-h-[90vh] flex flex-col"
            >
               <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-blue-500"></div>
               
               <div className="flex justify-between items-start mb-6 mt-2 shrink-0">
                  <div>
                     <h3 className="text-xl font-bold text-foreground">Histórico de Contagens</h3>
                     <p className="text-sm text-muted-foreground mt-1">{historyMaterial.name} ({historyMaterial.code})</p>
                  </div>
                  <button onClick={() => setHistoryMaterial(null)} className="p-1.5 text-muted-foreground hover:bg-secondary rounded-lg transition-colors">
                     <X className="w-5 h-5" />
                  </button>
               </div>
               
               <div className="flex gap-4 mb-4 shrink-0">
                  <div className="flex-1">
                     <label className="text-xs font-medium text-muted-foreground mb-1 block">Filtrar por Data</label>
                     <input 
                        type="date" 
                        value={historyDateFilter}
                        onChange={e => setHistoryDateFilter(e.target.value)}
                        className="w-full bg-secondary/50 border border-border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500/50 outline-none text-foreground"
                     />
                  </div>
                  <div className="flex-1">
                     <label className="text-xs font-medium text-muted-foreground mb-1 block">Filtrar por Usuário</label>
                     <input 
                        type="text" 
                        placeholder="Nome do usuário..."
                        value={historyUserFilter}
                        onChange={e => setHistoryUserFilter(e.target.value)}
                        className="w-full bg-secondary/50 border border-border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500/50 outline-none text-foreground"
                     />
                  </div>
               </div>

               <div className="overflow-y-auto flex-1 border border-border rounded-xl bg-secondary/20 p-2 space-y-2">
                  {historyLoading ? (
                     <div className="p-8 text-center text-muted-foreground">Carregando histórico...</div>
                  ) : historyLogs.filter(log => {
                     const matchDate = historyDateFilter ? new Date(log.timestamp).toISOString().split('T')[0] === historyDateFilter : true;
                     const matchUser = historyUserFilter ? log.userName?.toLowerCase().includes(historyUserFilter.toLowerCase()) : true;
                     return matchDate && matchUser;
                  }).length > 0 ? (
                     historyLogs.filter(log => {
                        const matchDate = historyDateFilter ? new Date(log.timestamp).toISOString().split('T')[0] === historyDateFilter : true;
                        const matchUser = historyUserFilter ? log.userName?.toLowerCase().includes(historyUserFilter.toLowerCase()) : true;
                        return matchDate && matchUser;
                     }).map(log => (
                        <div key={log.id} className="p-4 bg-background border border-border rounded-xl hover:shadow-sm transition-all">
                           <div className="flex justify-between items-start mb-2">
                              <div>
                                 <div className="text-xs flex items-center gap-1.5 font-medium text-foreground">
                                    <div className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-500 flex items-center justify-center text-[10px] font-bold">
                                       {log.userName?.charAt(0) || '?'}
                                    </div>
                                    <span>{log.userName || 'Desconhecido'}</span>
                                 </div>
                              </div>
                              <div className="text-right">
                                 <div className="text-xs font-medium text-muted-foreground bg-secondary px-2 py-1 rounded-md inline-block">
                                    {new Date(log.timestamp).toLocaleDateString()} às {new Date(log.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                 </div>
                              </div>
                           </div>
                           
                           <div className="flex items-center justify-between text-sm bg-secondary/30 p-2 rounded-lg">
                              <div className="flex items-center gap-2">
                                 <span className="text-muted-foreground line-through opacity-70">{log.previousQuantity} {formatUnit(historyMaterial.unit)}</span>
                                 <span className="text-foreground font-medium">→</span>
                                 <span className="text-emerald-500 font-bold">{log.newQuantity} {formatUnit(historyMaterial.unit)}</span>
                              </div>
                           </div>
                           
                           {log.notes && (
                              <p className="text-xs text-muted-foreground bg-blue-500/5 p-2 rounded-lg border border-blue-500/10 italic mt-2">
                                 "{log.notes}"
                              </p>
                           )}
                        </div>
                     ))
                  ) : (
                     <div className="p-8 text-center text-muted-foreground">Nenhuma contagem encontrada com os filtros atuais.</div>
                  )}
               </div>
            </motion.div>
            </motion.div>
         )}
      </AnimatePresence>

      {/* Modal Editar Produto */}
      <AnimatePresence>
        {showEditMaterialModal && editingMaterial && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
               initial={{ opacity: 0 }} 
               animate={{ opacity: 1 }} 
               exit={{ opacity: 0 }}
               className="absolute inset-0 bg-background/80 backdrop-blur-sm"
               onClick={() => setShowEditMaterialModal(false)}
            />
            <motion.div 
               initial={{ scale: 0.95, y: 20 }}
               animate={{ scale: 1, y: 0 }}
               exit={{ scale: 0.95, y: 20 }}
               className="bg-card border border-border rounded-2xl w-full max-w-2xl shadow-2xl p-6 relative z-10 max-h-[calc(100vh-4rem)] overflow-y-auto scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent"
            >
               <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
               
               <div className="mb-6 mt-2">
                  <h3 className="text-xl font-bold text-foreground">Editar Produto</h3>
                  <p className="text-sm text-muted-foreground mt-1">Atualizando dados cadastrados</p>
               </div>

               <form onSubmit={handleEditMaterialSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                     {/* Coluna Esquerda */}
                     <div className="space-y-4">
                        <div>
                           <label className="block text-sm font-medium text-muted-foreground mb-1.5">Código Único (SKU)</label>
                           <input 
                              type="text" 
                              value={editMaterialForm.code}
                              onChange={e => setEditMaterialForm({...editMaterialForm, code: e.target.value})}
                              className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500/50 outline-none text-foreground font-mono text-sm"
                              required
                           />
                        </div>
                        
                        <div>
                           <label className="block text-sm font-medium text-muted-foreground mb-1.5">Nome do Produto</label>
                           <input 
                              type="text" 
                              value={editMaterialForm.name}
                              onChange={e => setEditMaterialForm({...editMaterialForm, name: e.target.value})}
                              className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500/50 outline-none text-foreground text-sm"
                              required
                           />
                        </div>

                        <div>
                           <label className="block text-sm font-medium text-muted-foreground mb-1.5">Código de Barras</label>
                           <div className="relative flex items-center">
                              <input 
                                 type="text" 
                                 value={editMaterialForm.codigoBarras || ''}
                                 onChange={e => setEditMaterialForm({...editMaterialForm, codigoBarras: e.target.value})}
                                 className="w-full bg-secondary/50 border border-border rounded-xl pl-4 pr-12 py-2.5 focus:ring-2 focus:ring-blue-500/50 outline-none text-foreground text-sm font-mono"
                                 placeholder="Ex: 7891234567890"
                              />
                              <button
                                 type="button"
                                 onClick={() => {
                                    setScanTarget('editMaterial');
                                    setShowScanner(true);
                                 }}
                                 className="absolute right-3 p-1.5 hover:bg-secondary rounded-lg text-muted-foreground hover:text-foreground transition-colors"
                                 title="Escanear Código de Barras com a câmera"
                              >
                                 <Camera className="w-5 h-5" />
                              </button>
                           </div>
                        </div>

                        <div>
                           <label className="block text-sm font-medium text-muted-foreground mb-1.5">Setor Atribuído</label>
                           <select 
                              value={editMaterialForm.sectorId}
                              onChange={e => setEditMaterialForm({...editMaterialForm, sectorId: e.target.value})}
                              className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500/50 outline-none text-foreground cursor-pointer text-sm"
                           >
                              {sectors.map(s => (
                                 <option key={s.id} value={s.id}>{s.name}</option>
                              ))}
                           </select>
                        </div>
                     </div>

                     {/* Coluna Direita */}
                     <div className="space-y-4">
                        <div>
                           <label className="block text-sm font-medium text-muted-foreground mb-1.5">Origem</label>
                           <input 
                              type="text" 
                              value={editMaterialForm.origin || ''}
                              onChange={e => setEditMaterialForm({...editMaterialForm, origin: e.target.value})}
                              className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500/50 outline-none text-foreground text-sm"
                              placeholder="Ex: Nacional / Importado"
                           />
                        </div>

                        <div>
                           <div className="flex justify-between items-center mb-1.5">
                              <label className="block text-sm font-medium text-muted-foreground font-sans">Fornecedor (Opcional)</label>
                              <button 
                                 type="button" 
                                 onClick={() => {
                                    setSupplierModalTarget('edit');
                                    setShowAddSupplierModal(true);
                                 }}
                                 className="text-xs text-blue-500 hover:underline"
                              >
                                 + Novo
                              </button>
                           </div>
                           <select 
                              value={editMaterialForm.supplierId || ''}
                              onChange={e => setEditMaterialForm({...editMaterialForm, supplierId: e.target.value})}
                              className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500/50 outline-none text-foreground cursor-pointer text-sm"
                           >
                              <option value="">Nenhum fornecedor</option>
                              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                           </select>
                        </div>

                        <div>
                           <label className="block text-sm font-medium text-muted-foreground mb-1.5 font-sans">Prazo de Entrega (Dias - Opcional)</label>
                           <input 
                              type="number" 
                              min="0"
                              placeholder="Ex: 5"
                              value={editMaterialForm.supplierDeliveryDays}
                              onChange={e => setEditMaterialForm({...editMaterialForm, supplierDeliveryDays: e.target.value})}
                              className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500/50 outline-none text-foreground text-sm"
                           />
                        </div>

                        <div>
                           <label className="block text-sm font-medium text-muted-foreground mb-1.5">Imagem do Produto (URL ou upload local)</label>
                           <div className="flex gap-2">
                              <input 
                                 type="text" 
                                 value={editMaterialForm.imageUrl || ''}
                                 onChange={e => setEditMaterialForm({...editMaterialForm, imageUrl: e.target.value})}
                                 className="flex-1 bg-secondary/50 border border-border rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500/50 outline-none text-foreground text-sm"
                                 placeholder="Ex: https://imagens.com/produto.jpg"
                              />
                              <label className="bg-secondary hover:bg-secondary/80 border border-border text-foreground p-2.5 rounded-xl cursor-pointer flex items-center justify-center shrink-0" title="Upload de Imagem Local">
                                 <Upload className="w-5 h-5 text-muted-foreground" />
                                 <input 
                                    type="file" 
                                    accept="image/*" 
                                    className="hidden" 
                                    onChange={(e) => {
                                       const file = e.target.files?.[0];
                                       if (file) {
                                          const reader = new FileReader();
                                          reader.onloadend = () => {
                                             setEditMaterialForm({...editMaterialForm, imageUrl: reader.result as string});
                                          };
                                          reader.readAsDataURL(file);
                                       }
                                    }}
                                 />
                              </label>
                           </div>
                           {editMaterialForm.imageUrl && (
                              <div className="mt-2 relative w-12 h-12 border border-border rounded-lg overflow-hidden bg-secondary">
                                 <img src={editMaterialForm.imageUrl} alt="Preview" className="w-full h-full object-cover" />
                                 <button 
                                    type="button" 
                                    onClick={() => setEditMaterialForm({...editMaterialForm, imageUrl: ''})}
                                    className="absolute inset-0 bg-black/50 flex items-center justify-center text-white opacity-0 hover:opacity-100 transition-opacity"
                                 >
                                    <Trash2 className="w-4 h-4 text-red-500" />
                                 </button>
                              </div>
                           )}
                        </div>
                     </div>
                  </div>

                  {/* Detalhes de Quantidade na base */}
                  <div className="grid grid-cols-3 gap-4 border-t border-border/50 pt-4">
                     <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-1.5">Unidade</label>
                        <select 
                           value={editMaterialForm.unit}
                           onChange={e => setEditMaterialForm({...editMaterialForm, unit: e.target.value})}
                           className="w-full bg-secondary/50 border border-border rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-blue-500/50 outline-none text-foreground cursor-pointer text-sm"
                        >
                           <option value="unidade">un</option>
                           <option value="pacote">pct</option>
                           <option value="caixa">cx</option>
                           <option value="palete">plt</option>
                           <option value="kg">kg</option>
                           <option value="l">l</option>
                        </select>
                     </div>
                     <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-1.5">Qtd. Atual</label>
                        <input 
                           type="number" 
                           min="0"
                           value={editMaterialForm.quantity}
                           onChange={e => setEditMaterialForm({...editMaterialForm, quantity: e.target.value ? parseInt(e.target.value) : ''})}
                           className="w-full bg-secondary/50 border border-border rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-blue-500/50 outline-none text-foreground font-bold text-sm"
                           required
                        />
                     </div>
                     <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-1.5">Mínimo</label>
                        <input 
                           type="number" 
                           min="0"
                           value={editMaterialForm.estoqueMinimo}
                           onChange={e => setEditMaterialForm({...editMaterialForm, estoqueMinimo: e.target.value ? parseInt(e.target.value) : ''})}
                           className="w-full bg-secondary/50 border border-border rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-blue-500/50 outline-none text-foreground font-bold text-sm"
                           required
                        />
                     </div>
                  </div>

                  {/* Localização Física (Opcional) */}
                  <div className="border-t border-border/50 pt-4 space-y-4">
                     <h4 className="text-sm font-semibold text-foreground">Localização Física (Opcional)</h4>
                     <div className="grid grid-cols-2 gap-4">
                        <div>
                           <label className="block text-xs font-medium text-muted-foreground mb-1">Área</label>
                           <input 
                              type="text" 
                              value={editMaterialForm.area}
                              onChange={e => setEditMaterialForm({...editMaterialForm, area: e.target.value})}
                              className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500/50 outline-none text-foreground text-sm"
                              placeholder="Ex: Área A"
                           />
                        </div>
                        <div>
                           <label className="block text-xs font-medium text-muted-foreground mb-1">Estante</label>
                           <input 
                              type="text" 
                              value={editMaterialForm.estante}
                              onChange={e => setEditMaterialForm({...editMaterialForm, estante: e.target.value})}
                              className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500/50 outline-none text-foreground text-sm"
                              placeholder="Ex: Estante 3"
                           />
                        </div>
                        <div>
                           <label className="block text-xs font-medium text-muted-foreground mb-1">Prateleira</label>
                           <input 
                              type="text" 
                              value={editMaterialForm.prateleira}
                              onChange={e => setEditMaterialForm({...editMaterialForm, prateleira: e.target.value})}
                              className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500/50 outline-none text-foreground text-sm"
                              placeholder="Ex: Prateleira B"
                           />
                        </div>
                        <div>
                           <label className="block text-xs font-medium text-muted-foreground mb-1">Palete</label>
                           <input 
                              type="text" 
                              value={editMaterialForm.palete}
                              onChange={e => setEditMaterialForm({...editMaterialForm, palete: e.target.value})}
                              className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500/50 outline-none text-foreground text-sm"
                              placeholder="Ex: Palete 12"
                           />
                        </div>
                     </div>
                     <AnimatePresence>
                        {editMaterialForm.palete && (
                           <motion.div 
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="space-y-1.5"
                           >
                              <label className="block text-xs font-medium text-muted-foreground">Quantidade do Palete</label>
                              <input 
                                 type="number" 
                                 min="0"
                                 value={editMaterialForm.paleteQty}
                                 onChange={e => setEditMaterialForm({...editMaterialForm, paleteQty: e.target.value ? parseInt(e.target.value) : ''})}
                                 className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500/50 outline-none text-foreground text-sm font-bold"
                                 placeholder="Ex: 50"
                              />
                           </motion.div>
                        )}
                     </AnimatePresence>
                  </div>

                  {/* Vínculo de Setores Adicionais */}
                  <div className="border-t border-border/50 pt-4 space-y-2">
                     <label className="block text-sm font-semibold text-foreground">Vincular a Outros Setores (Opcional)</label>
                     <p className="text-xs text-muted-foreground mb-2">Selecione setores adicionais nos quais este material também estará visível.</p>
                     <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto p-2 bg-secondary/20 rounded-xl border border-border/50">
                        {sectors
                           .filter(s => s.id !== editMaterialForm.sectorId)
                           .map(s => {
                              const isChecked = (editMaterialForm.additionalSectors || '')
                                .split(',')
                                .filter(Boolean)
                                .includes(s.id);
                              return (
                                <label key={s.id} className="flex items-center gap-2 px-3 py-1.5 hover:bg-secondary/50 rounded-lg cursor-pointer text-xs text-foreground">
                                   <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={e => handleSectorCheckboxChange(e.target.checked, s, true)}
                                      className="rounded text-blue-500 bg-secondary/50 border-border focus:ring-blue-500 w-3.5 h-3.5"
                                   />
                                   <span className="truncate">{s.name}</span>
                                </label>
                              );
                           })}
                        {sectors.filter(s => s.id !== editMaterialForm.sectorId).length === 0 && (
                           <p className="text-xs text-muted-foreground italic p-2 col-span-2">Nenhum outro setor disponível</p>
                        )}
                     </div>
                  </div>

                  <div className="flex gap-3 pt-4 border-t border-border/50">
                     <button 
                        type="button" 
                        onClick={() => setShowEditMaterialModal(false)}
                        className="flex-1 px-4 py-3 text-muted-foreground font-medium rounded-xl hover:bg-secondary transition-colors text-sm"
                     >
                        Cancelar
                     </button>
                     <button 
                        type="submit" 
                        className="flex-1 px-4 py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/25 text-sm"
                     >
                        Salvar Alterações
                     </button>
                  </div>
               </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Criar Fornecedor */}
      <AnimatePresence>
         {showAddSupplierModal && (
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
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
                  
                  <div className="flex justify-between items-start mb-6 mt-2">
                     <h3 className="text-xl font-bold text-foreground">Novo Fornecedor</h3>
                     <button 
                        type="button"
                        onClick={() => {
                           setShowAddSupplierModal(false);
                           setSupplierModalTarget(null);
                           setNewSupplierName('');
                           setNewSupplierDeliveryDays(0);
                        }} 
                        className="p-1.5 text-muted-foreground hover:bg-secondary rounded-lg transition-colors"
                     >
                        <X className="w-5 h-5" />
                     </button>
                  </div>
                  
                  <form 
                     onSubmit={async (e) => {
                        e.preventDefault();
                        if (!newSupplierName.trim()) return;
                        try {
                           const res = await apiFetch('/api/suppliers', {
                              method: 'POST',
                              body: JSON.stringify({ name: newSupplierName, deliveryDays: newSupplierDeliveryDays })
                           }, token);
                           setSuppliers(prev => [...prev, res]);
                           if (supplierModalTarget === 'new') {
                              setNewMaterial(prev => ({ ...prev, supplierId: res.id }));
                           } else if (supplierModalTarget === 'edit') {
                              setEditMaterialForm(prev => ({ ...prev, supplierId: res.id }));
                           }
                           setShowAddSupplierModal(false);
                           setSupplierModalTarget(null);
                           setNewSupplierName('');
                           setNewSupplierDeliveryDays(0);
                        } catch (err: any) {
                           alert(err.message || 'Erro ao cadastrar fornecedor');
                        }
                     }} 
                     className="space-y-4"
                  >
                     <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-1.5 font-sans">Nome do Fornecedor</label>
                        <input 
                           type="text" 
                           value={newSupplierName}
                           onChange={e => setNewSupplierName(e.target.value)}
                           placeholder="Ex: Distribuidora XYZ"
                           className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/50 outline-none text-foreground font-sans"
                           required
                        />
                     </div>
                     
                     <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-1.5 font-sans">Prazo de Entrega (Dias Úteis)</label>
                        <input 
                           type="number" 
                           min="0"
                           value={newSupplierDeliveryDays}
                           onChange={e => setNewSupplierDeliveryDays(parseInt(e.target.value) || 0)}
                           className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/50 outline-none text-foreground font-bold font-sans"
                           required
                        />
                     </div>
                     
                     <div className="flex gap-3 pt-4">
                        <button 
                           type="button" 
                           onClick={() => {
                              setShowAddSupplierModal(false);
                              setSupplierModalTarget(null);
                              setNewSupplierName('');
                              setNewSupplierDeliveryDays(0);
                           }}
                           className="flex-1 px-4 py-3 border border-border text-foreground font-medium rounded-xl hover:bg-secondary transition-colors font-sans"
                        >
                           Cancelar
                        </button>
                        <button 
                           type="submit" 
                           className="flex-1 px-4 py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/25 font-sans"
                        >
                           Salvar
                        </button>
                     </div>
                  </form>
               </motion.div>
            </motion.div>
         )}
      </AnimatePresence>

      {showScanner && (
        <BarcodeScanner 
          onResult={handleScanResult}
          onClose={() => setShowScanner(false)}
        />
      )}

      {/* Modal de Alerta: Vínculo em Múltiplos Setores */}
      <AnimatePresence>
        {sectorWarningModal && sectorWarningModal.isOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
               initial={{ opacity: 0 }} 
               animate={{ opacity: 1 }} 
               exit={{ opacity: 0 }}
               className="absolute inset-0 bg-background/80 backdrop-blur-sm"
               onClick={() => setSectorWarningModal(null)}
            />
            <motion.div 
               initial={{ scale: 0.95, y: 20 }}
               animate={{ scale: 1, y: 0 }}
               exit={{ scale: 0.95, y: 20 }}
               className="bg-card border border-amber-500/30 rounded-2xl w-full max-w-md shadow-2xl p-6 relative overflow-hidden z-10 font-sans"
            >
               <div className="absolute top-0 left-0 w-full h-1 bg-amber-500"></div>
               
               <div className="flex items-start gap-4 mt-2">
                 <div className="p-3 bg-amber-500/10 rounded-xl text-amber-500 shrink-0">
                   <AlertTriangle className="w-6 h-6" />
                 </div>
                 <div className="flex-1 min-w-0">
                   <h3 className="text-lg font-bold text-foreground">Produto já vinculado a outro setor</h3>
                   <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                     O produto <span className="font-semibold text-foreground break-words">"{sectorWarningModal.productName}"</span> já está vinculado ao setor principal <span className="font-semibold text-foreground">"{sectorWarningModal.currentSectorName}"</span>.
                   </p>
                   <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                     Tem certeza de que deseja vincular este produto também ao setor <span className="font-semibold text-foreground">"{sectorWarningModal.newSectorName}"</span>? Ele ficará visível em ambos os setores.
                   </p>
                 </div>
               </div>

               <div className="mt-6 flex gap-3">
                 <button 
                    type="button" 
                    onClick={() => setSectorWarningModal(null)}
                    className="flex-1 px-4 py-2.5 border border-border text-foreground font-medium rounded-xl hover:bg-secondary transition-colors text-sm"
                 >
                    Não, Cancelar
                 </button>
                 <button 
                    type="button" 
                    onClick={confirmSectorAddition}
                    className="flex-1 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-medium rounded-xl transition-colors shadow-lg shadow-amber-500/20 text-sm"
                 >
                    Sim, Vincular Setor
                 </button>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal de Alerta: Código Duplicado */}
      <AnimatePresence>
        {duplicateModal && duplicateModal.isOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
               initial={{ opacity: 0 }} 
               animate={{ opacity: 1 }} 
               exit={{ opacity: 0 }}
               className="absolute inset-0 bg-background/80 backdrop-blur-sm"
               onClick={() => setDuplicateModal(null)}
            />
            <motion.div 
               initial={{ scale: 0.95, y: 20 }}
               animate={{ scale: 1, y: 0 }}
               exit={{ scale: 0.95, y: 20 }}
               className="bg-card border border-rose-500/30 rounded-2xl w-full max-w-md shadow-2xl p-6 relative overflow-hidden z-10"
            >
               <div className="absolute top-0 left-0 w-full h-1 bg-rose-500"></div>
               
               <div className="flex items-start gap-4 mt-2">
                 <div className="p-3 bg-rose-500/10 rounded-xl text-rose-500">
                   <AlertTriangle className="w-6 h-6" />
                 </div>
                 <div className="flex-1">
                   <h3 className="text-lg font-bold text-foreground font-sans">Código já Cadastrado</h3>
                   <p className="text-sm text-muted-foreground mt-1">
                     O código <span className="font-mono bg-rose-500/10 px-1.5 py-0.5 rounded text-rose-500 font-semibold">{duplicateModal.code}</span> já está sendo utilizado por outro produto no sistema.
                   </p>
                 </div>
               </div>

               {duplicateModal.existingProduct && (
                 <div className="bg-rose-500/5 border border-rose-500/10 rounded-xl p-4 mt-4 space-y-2">
                   <p className="text-xs font-semibold text-rose-500 uppercase tracking-wider">Produto Existente</p>
                   <div className="grid grid-cols-2 gap-y-2 text-sm">
                     <span className="text-muted-foreground">Nome:</span>
                     <span className="font-semibold text-foreground text-right">{duplicateModal.existingProduct.name}</span>
                     
                     <span className="text-muted-foreground">Setor:</span>
                     <span className="font-semibold text-foreground text-right">
                       {sectors.find(s => s.id === duplicateModal.existingProduct?.sectorId)?.name || 'N/A'}
                     </span>

                     <span className="text-muted-foreground">Estoque Atual:</span>
                     <span className="font-semibold text-foreground text-right">
                       {duplicateModal.existingProduct.quantity} {duplicateModal.existingProduct.unit}
                     </span>
                   </div>
                 </div>
               )}

               <div className="mt-6 flex justify-end">
                 <button 
                    type="button" 
                    onClick={() => setDuplicateModal(null)}
                    className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-medium rounded-xl transition-colors shadow-lg shadow-rose-500/20 font-sans w-full"
                 >
                    Entendido, vou alterar
                 </button>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal de Alerta: Produto não Cadastrado */}
      <AnimatePresence>
        {unregisteredProductModal && unregisteredProductModal.isOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
               initial={{ opacity: 0 }} 
               animate={{ opacity: 1 }} 
               exit={{ opacity: 0 }}
               className="absolute inset-0 bg-background/80 backdrop-blur-sm"
               onClick={() => setUnregisteredProductModal(null)}
            />
            <motion.div 
               initial={{ scale: 0.95, y: 20 }}
               animate={{ scale: 1, y: 0 }}
               exit={{ scale: 0.95, y: 20 }}
               className="bg-card border border-amber-500/30 rounded-2xl w-full max-w-md shadow-2xl p-6 relative overflow-hidden z-10"
            >
               <div className="absolute top-0 left-0 w-full h-1 bg-amber-500"></div>
               
               <div className="flex items-start gap-4 mt-2">
                 <div className="p-3 bg-amber-500/10 rounded-xl text-amber-500">
                   <AlertTriangle className="w-6 h-6" />
                 </div>
                 <div className="flex-1">
                   <h3 className="text-lg font-bold text-foreground font-sans">Produto não Cadastrado</h3>
                   <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                     O código <span className="font-mono bg-amber-500/10 px-1.5 py-0.5 rounded text-amber-600 font-semibold">{unregisteredProductModal.code}</span> não foi encontrado no estoque.
                   </p>
                   <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                     O formulário de cadastro já foi aberto em segundo plano com o código de barras preenchido automaticamente!
                   </p>
                 </div>
               </div>

               <div className="mt-6 flex gap-3">
                 <button 
                    type="button" 
                    onClick={() => setUnregisteredProductModal(null)}
                    className="flex-1 px-5 py-3 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-xl transition-colors shadow-lg shadow-amber-500/20 font-sans"
                 >
                    Continuar para o Cadastro
                 </button>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal de Detalhes Completo do Produto */}
      <AnimatePresence>
         {detailMaterial && (
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
                  className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl p-6 relative overflow-hidden flex flex-col max-h-[90vh]"
               >
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
                  
                  <div className="flex justify-between items-start mb-4 mt-2 shrink-0">
                     <div className="min-w-0 flex-1 pr-4">
                        <span className="text-xs font-bold text-blue-500 uppercase tracking-wider block">Ficha do Produto</span>
                        <h3 className="text-xl font-black text-foreground mt-1 break-words leading-tight">{detailMaterial.name}</h3>
                        <p className="text-xs text-muted-foreground font-mono mt-0.5">SKU: {detailMaterial.code}</p>
                     </div>
                     <button 
                        onClick={() => setDetailMaterial(null)} 
                        className="p-1.5 text-muted-foreground hover:bg-secondary rounded-lg transition-colors shrink-0"
                     >
                        <X className="w-5 h-5" />
                     </button>
                  </div>

                  <div className="overflow-y-auto flex-1 pr-1 space-y-5 my-2">
                     {/* Imagem do Produto */}
                     <div className="relative aspect-[16/9] w-full bg-secondary/10 border border-border rounded-xl overflow-hidden flex items-center justify-center group shrink-0">
                        {detailMaterial.imageUrl ? (
                           <>
                              <img 
                                 src={detailMaterial.imageUrl} 
                                 alt={detailMaterial.name} 
                                 referrerPolicy="no-referrer"
                                 className="w-full h-full object-contain rounded-lg p-2"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-between p-3">
                                 <span className="text-xs font-medium text-white">Foto Ilustrativa</span>
                                 <button 
                                    onClick={() => {
                                       setImageModalMaterial(detailMaterial);
                                       setDetailMaterial(null);
                                    }}
                                    className="p-1.5 bg-black/60 hover:bg-black/80 rounded-lg text-white border border-white/10 transition-colors flex items-center gap-1.5 text-xs font-bold"
                                    title="Visualizar ampliado / Gerenciar"
                                 >
                                    <Eye className="w-4 h-4" />
                                    Ver Foto
                                 </button>
                              </div>
                           </>
                        ) : (
                           <div className="flex flex-col items-center justify-center p-6 text-center text-muted-foreground">
                              <ImageIcon className="w-10 h-10 opacity-30 mb-2" />
                              <span className="text-xs font-medium">Nenhuma foto cadastrada</span>
                              {isManager && (
                                 <button 
                                    onClick={() => {
                                       setImageModalMaterial(detailMaterial);
                                       setDetailMaterial(null);
                                    }}
                                    className="text-xs text-blue-500 hover:underline mt-1.5 font-bold"
                                 >
                                    Adicionar Foto
                                 </button>
                              )}
                           </div>
                        )}
                     </div>

                     {/* Informações Grid */}
                     <div className="grid grid-cols-2 gap-3.5 bg-secondary/25 p-4 rounded-xl border border-border/60">
                        <div>
                           <span className="text-[10px] text-muted-foreground block uppercase tracking-wider font-semibold">Setor Atribuído</span>
                           <span className="text-sm font-semibold text-foreground">
                              {detailMaterial.sector || sectors.find(s => s.id === detailMaterial.sectorId)?.name || 'N/A'}
                           </span>
                        </div>
                        <div>
                           <span className="text-[10px] text-muted-foreground block uppercase tracking-wider font-semibold">Status no Kanban</span>
                           <div className="mt-1"><StatusBadge status={detailMaterial.status} /></div>
                        </div>
                        <div>
                           <span className="text-[10px] text-muted-foreground block uppercase tracking-wider font-semibold">Estoque Físico</span>
                           <span className="text-sm font-black text-foreground">
                              {detailMaterial.quantity} {formatUnit(detailMaterial.unit)}
                           </span>
                        </div>
                        <div>
                           <span className="text-[10px] text-muted-foreground block uppercase tracking-wider font-semibold">Estoque Mínimo</span>
                           <span className="text-sm font-semibold text-foreground">
                              {detailMaterial.estoqueMinimo} {formatUnit(detailMaterial.unit)}
                           </span>
                        </div>
                        <div className="col-span-2 border-t border-border/40 pt-3 mt-1 grid grid-cols-2 gap-3.5">
                           <div>
                              <span className="text-[10px] text-muted-foreground block uppercase tracking-wider font-semibold">Fornecedor</span>
                              <span className="text-sm font-semibold text-foreground">
                                 {suppliers.find(s => s.id === detailMaterial.supplierId)?.name || 'Não cadastrado'}
                              </span>
                           </div>
                           <div>
                              <span className="text-[10px] text-muted-foreground block uppercase tracking-wider font-semibold">Prazo de Entrega</span>
                              <span className="text-sm font-semibold text-foreground">
                                 {suppliers.find(s => s.id === detailMaterial.supplierId) 
                                    ? `${suppliers.find(s => s.id === detailMaterial.supplierId)?.deliveryDays} dias úteis` 
                                    : 'N/A'}
                              </span>
                           </div>
                        </div>
                        <div className="col-span-2 border-t border-border/40 pt-3 mt-1 grid grid-cols-2 gap-3.5">
                           <div>
                              <span className="text-[10px] text-muted-foreground block uppercase tracking-wider font-semibold">Origem</span>
                              <span className="text-sm font-semibold text-foreground">{detailMaterial.origin || 'Não informada'}</span>
                           </div>
                           <div>
                              <span className="text-[10px] text-muted-foreground block uppercase tracking-wider font-semibold">Código de Barras</span>
                              <span className="text-sm font-mono text-foreground break-all">{detailMaterial.codigoBarras || 'N/A'}</span>
                           </div>
                        </div>
                     </div>

                     {/* Observações */}
                     {/* Localização Física */}
                      {(detailMaterial.area || detailMaterial.estante || detailMaterial.prateleira || detailMaterial.palete) && (
                         <div className="bg-secondary/15 border border-border/50 rounded-xl p-4 space-y-2.5">
                            <span className="text-[10px] text-muted-foreground block uppercase tracking-wider font-bold">Localização Física</span>
                            <div className="grid grid-cols-2 gap-2.5 text-xs font-sans">
                               {detailMaterial.area && (
                                  <div>
                                     <span className="text-muted-foreground block text-[10px] uppercase">Área:</span>
                                     <span className="font-semibold text-foreground text-sm">{detailMaterial.area}</span>
                                  </div>
                               )}
                               {detailMaterial.estante && (
                                  <div>
                                     <span className="text-muted-foreground block text-[10px] uppercase">Estante:</span>
                                     <span className="font-semibold text-foreground text-sm">{detailMaterial.estante}</span>
                                  </div>
                               )}
                               {detailMaterial.prateleira && (
                                  <div>
                                     <span className="text-muted-foreground block text-[10px] uppercase">Prateleira:</span>
                                     <span className="font-semibold text-foreground text-sm">{detailMaterial.prateleira}</span>
                                  </div>
                               )}
                               {detailMaterial.palete && (
                                  <div>
                                     <span className="text-muted-foreground block text-[10px] uppercase">Palete:</span>
                                     <span className="font-semibold text-foreground text-sm">
                                        {detailMaterial.palete} 
                                        {detailMaterial.paleteQty !== null && detailMaterial.paleteQty !== undefined && detailMaterial.paleteQty !== '' && (
                                           <span className="text-muted-foreground font-normal ml-1">({detailMaterial.paleteQty} itens)</span>
                                        )}
                                     </span>
                                  </div>
                                )}
                            </div>
                         </div>
                      )}

                      {/* Setores Adicionais */}
                      {(() => {
                         const additionalIds = (detailMaterial.additionalSectors || '').split(',').filter(Boolean);
                         if (additionalIds.length === 0) return null;
                         const mappedNames = additionalIds
                            .map(id => sectors.find(s => s.id === id)?.name)
                            .filter(Boolean);
                         if (mappedNames.length === 0) return null;

                         return (
                            <div className="bg-secondary/15 border border-border/50 rounded-xl p-4 space-y-2.5">
                               <span className="text-[10px] text-muted-foreground block uppercase tracking-wider font-bold font-sans">Outros Setores Vinculados</span>
                               <div className="flex flex-wrap gap-1.5 mt-1">
                                  {mappedNames.map((name, idx) => (
                                     <span key={idx} className="bg-blue-500/10 border border-blue-500/20 text-blue-500 text-[11px] font-semibold px-2.5 py-1 rounded-full font-sans">
                                        {name}
                                     </span>
                                  ))}
                               </div>
                            </div>
                         );
                      })()}

                      {detailMaterial.notes && (
                        <div className="bg-blue-500/5 border border-blue-500/10 rounded-xl p-3">
                           <span className="text-[10px] text-blue-500 block uppercase tracking-wider font-bold mb-1">Observações</span>
                           <p className="text-xs text-foreground italic break-words">"{detailMaterial.notes}"</p>
                        </div>
                     )}

                     {/* Ações Rápidas */}
                     <div className="space-y-2.5 pt-1">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Ações Disponíveis</span>
                        <div className="grid grid-cols-2 gap-2">
                           <button 
                              onClick={() => {
                                 setSelectedMaterial(detailMaterial);
                                 setCountQuantity(detailMaterial.quantity);
                                 setCountNotes(detailMaterial.notes || '');
                                 setCountStatus(detailMaterial.status);
                                 setDetailMaterial(null);
                              }}
                              className="flex items-center gap-2 justify-center py-2.5 px-3 rounded-xl border border-blue-500/20 bg-blue-500/5 hover:bg-blue-500/10 text-blue-500 transition-colors font-bold text-xs"
                           >
                              <ClipboardCheck className="w-4 h-4" />
                              Contar Estoque
                           </button>

                           <button 
                              onClick={() => {
                                 handleOpenHistory(detailMaterial);
                                 setDetailMaterial(null);
                              }}
                              className="flex items-center gap-2 justify-center py-2.5 px-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10 text-emerald-500 transition-colors font-bold text-xs"
                           >
                              <History className="w-4 h-4" />
                              Ver Histórico
                           </button>

                           <button 
                              onClick={() => {
                                 setImageModalMaterial(detailMaterial);
                                 setDetailMaterial(null);
                              }}
                              className="flex items-center gap-2 justify-center py-2.5 px-3 rounded-xl border border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10 text-amber-500 transition-colors font-bold text-xs"
                           >
                              <Eye className="w-4 h-4" />
                              Ver / Tirar Foto
                           </button>

                           {isManager && (
                              <button 
                                 onClick={() => {
                                    handleOpenEditMaterial(detailMaterial);
                                    setDetailMaterial(null);
                                 }}
                                 className="flex items-center gap-2 justify-center py-2.5 px-3 rounded-xl border border-indigo-500/20 bg-indigo-500/5 hover:bg-indigo-500/10 text-indigo-500 transition-colors font-bold text-xs"
                              >
                                 <Edit3 className="w-4 h-4" />
                                 Editar Cadastro
                              </button>
                           )}
                        </div>
                     </div>
                  </div>

                  <div className="shrink-0 pt-3 border-t border-border mt-3 flex gap-2">
                     <button
                        onClick={() => setDetailMaterial(null)}
                        className="w-full py-2.5 bg-secondary hover:bg-secondary/80 text-foreground font-semibold rounded-xl transition-colors text-sm border border-border"
                     >
                        Fechar
                     </button>
                  </div>
               </motion.div>
            </motion.div>
         )}
      </AnimatePresence>

      <ProductImageModal 
         material={imageModalMaterial}
         onClose={() => setImageModalMaterial(null)}
         onUpdate={fetchData}
      />
    </div>
  );
}
