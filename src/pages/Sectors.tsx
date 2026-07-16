import React, { useState, useEffect, useRef } from 'react';
import { apiFetch } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { Sector, Material, User, Supplier } from '../types';
import { FolderTree, Plus, Trash2, Edit3, Package, Users, ChevronDown, ChevronUp, UserPlus, AlertTriangle, Truck, Upload, Eye, Camera, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatUnit } from '../lib/utils';
import { ProductImageModal } from '../components/ProductImageModal';
import { BarcodeScanner } from '../components/BarcodeScanner';

export default function Sectors() {
  const { token, isManager } = useAuth();
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [newSectorName, setNewSectorName] = useState('');
  const [editingSector, setEditingSector] = useState<Sector | null>(null);
  const ignoreBlurRef = useRef(false);
  const isSavingRef = useRef(false);
  
  const [expandedSector, setExpandedSector] = useState<string | null>(null);

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [supplierForm, setSupplierForm] = useState({ name: '', deliveryDays: 0 });

  const [showProductModal, setShowProductModal] = useState(false);
  const [targetSectorForProduct, setTargetSectorForProduct] = useState<Sector | null>(null);
  const [newProduct, setNewProduct] = useState({ 
    code: '', 
    codigoBarras: '', 
    name: '', 
    quantity: '' as string | number, 
    unit: 'unidade', 
    estoqueMinimo: 5 as string | number, 
    supplierId: '', 
    supplierDeliveryDays: '' as string | number, 
    origin: '', 
    imageUrl: '',
    area: '',
    estante: '',
    prateleira: '',
    palete: '',
    paleteQty: '' as string | number,
    additionalSectors: '',
    isPulmao: true,
    isGiro: false,
    quantityGiro: 0 as string | number
  });

  const [showEditProductModal, setShowEditProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Material | null>(null);
  const [editProductForm, setEditProductForm] = useState({
    id: '',
    code: '',
    codigoBarras: '',
    name: '',
    quantity: 0 as string | number,
    unit: 'unidade',
    estoqueMinimo: 5 as string | number,
    sectorId: '',
    supplierId: '',
    supplierDeliveryDays: '' as string | number,
    origin: '',
    imageUrl: '',
    area: '',
    estante: '',
    prateleira: '',
    palete: '',
    paleteQty: '' as string | number,
    additionalSectors: '',
    isPulmao: true,
    isGiro: false,
    quantityGiro: 0 as string | number
  });

  const [showUserModal, setShowUserModal] = useState(false);
  const [targetSectorForUser, setTargetSectorForUser] = useState<Sector | null>(null);
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'USER' });
  const [userModalTab, setUserModalTab] = useState<'create' | 'link'>('create');
  const [selectedExistingUserId, setSelectedExistingUserId] = useState('');
  const [duplicateModal, setDuplicateModal] = useState<{
    isOpen: boolean;
    code: string;
    existingProduct: Material | null;
  } | null>(null);

  const [sectorWarningModal, setSectorWarningModal] = useState<{
    isOpen: boolean;
    productName: string;
    currentSectorName: string;
    newSectorId: string;
    newSectorName: string;
    isEdit: boolean;
  } | null>(null);

  const [imageModalProduct, setImageModalProduct] = useState<Material | null>(null);

  const [showScanner, setShowScanner] = useState(false);
  const [scanTarget, setScanTarget] = useState<'newProduct' | 'editProduct' | null>(null);

  const handleScanResult = (decodedText: string) => {
    setShowScanner(false);
    if (scanTarget === 'newProduct') {
      setNewProduct(prev => ({ ...prev, codigoBarras: decodedText }));
    } else if (scanTarget === 'editProduct') {
      setEditProductForm(prev => ({ ...prev, codigoBarras: decodedText }));
    }
    setScanTarget(null);
  };

  const fetchData = async () => {
    try {
      const [secData, matData, usrData, supData] = await Promise.all([
        apiFetch('/api/sectors', {}, token),
        apiFetch('/api/materials', {}, token),
        apiFetch('/api/users', {}, token),
        apiFetch('/api/suppliers', {}, token)
      ]);
      setSectors(secData);
      setMaterials(matData);
      setUsers(usrData);
      setSuppliers(supData);
    } catch (err) {
      console.error(err);
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

  const handleAddSector = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSectorName.trim()) return;
    try {
      await apiFetch('/api/sectors', {
        method: 'POST',
        body: JSON.stringify({ name: newSectorName })
      }, token);
      setNewSectorName('');
      fetchData();
    } catch (err) {
      alert('Erro ao criar setor');
    }
  };

  const handleEditSector = async (sector: Sector, newName: string) => {
    if (!newName.trim() || newName === sector.name) {
      setEditingSector(null);
      return;
    }
    if (isSavingRef.current) return;
    isSavingRef.current = true;
    try {
      await apiFetch(`/api/sectors/${sector.id}`, {
        method: 'PUT',
        body: JSON.stringify({ name: newName })
      }, token);
      setEditingSector(null);
      fetchData();
    } catch (err) {
      alert('Erro ao editar setor');
    } finally {
      isSavingRef.current = false;
    }
  };

  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    type: 'sector' | 'product';
    id: string;
    name: string;
  }>({
    isOpen: false,
    type: 'sector',
    id: '',
    name: ''
  });

  const handleDeleteSector = (sector: Sector) => {
    setDeleteModal({
      isOpen: true,
      type: 'sector',
      id: sector.id,
      name: sector.name
    });
  };

  const toggleExpand = (id: string) => {
     setExpandedSector(expandedSector === id ? null : id);
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetSectorForProduct) return;
    
    const duplicate = materials.find(m => m.code.trim().toLowerCase() === newProduct.code.trim().toLowerCase());
    if (duplicate) {
      setDuplicateModal({
        isOpen: true,
        code: newProduct.code,
        existingProduct: duplicate
      });
      return;
    }

    try {
      await apiFetch('/api/materials', {
        method: 'POST',
        body: JSON.stringify({ 
          ...newProduct, 
          sectorId: targetSectorForProduct.id,
          supplierId: newProduct.supplierId || null,
          supplierDeliveryDays: newProduct.supplierDeliveryDays !== '' ? Number(newProduct.supplierDeliveryDays) : null,
          origin: newProduct.origin || null,
          codigoBarras: newProduct.codigoBarras || null,
          imageUrl: newProduct.imageUrl || null,
          area: newProduct.area || null,
          estante: newProduct.estante || null,
          prateleira: newProduct.prateleira || null,
          palete: newProduct.palete || null,
          paleteQty: newProduct.palete ? (newProduct.paleteQty !== '' ? Number(newProduct.paleteQty) : null) : null,
          additionalSectors: newProduct.additionalSectors || null,
          isPulmao: newProduct.isPulmao !== false,
          isGiro: !!newProduct.isGiro,
          quantityGiro: Number(newProduct.quantityGiro || 0)
        })
      }, token);
      setShowProductModal(false);
      setNewProduct({ 
        code: '', 
        codigoBarras: '', 
        name: '', 
        quantity: '', 
        unit: 'unidade', 
        estoqueMinimo: 5, 
        supplierId: '', 
        supplierDeliveryDays: '', 
        origin: '', 
        imageUrl: '',
        area: '',
        estante: '',
        prateleira: '',
        palete: '',
        paleteQty: '',
        additionalSectors: '',
        isPulmao: true,
        isGiro: false,
        quantityGiro: 0
      });
      fetchData();
      window.dispatchEvent(new CustomEvent('products-changed'));
    } catch (err) {
      alert('Erro ao criar produto');
    }
  };

  const handleSectorCheckboxChange = (checked: boolean, targetSector: Sector, isEdit: boolean) => {
    const form = isEdit ? editProductForm : newProduct;
    const currentPrimaryId = isEdit ? editProductForm.sectorId : (targetSectorForProduct?.id || '');
    
    if (checked) {
      const primarySector = sectors.find(s => s.id === currentPrimaryId);
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
      const setForm = isEdit ? setEditProductForm : setNewProduct;
      const current = (form.additionalSectors || '').split(',').filter(Boolean);
      const updated = current.filter(id => id !== targetSector.id);
      const updatedSectorsStr = updated.length > 0 ? updated.join(',') : '';
      setForm((prev: any) => ({ ...prev, additionalSectors: updatedSectorsStr }));
    }
  };

  const confirmSectorAddition = () => {
    if (!sectorWarningModal) return;
    const { newSectorId, isEdit } = sectorWarningModal;
    const form = isEdit ? editProductForm : newProduct;
    const setForm = isEdit ? setEditProductForm : setNewProduct;
    
    const current = (form.additionalSectors || '').split(',').filter(Boolean);
    if (!current.includes(newSectorId)) {
      const updated = [...current, newSectorId];
      setForm((prev: any) => ({ ...prev, additionalSectors: updated.join(',') }));
    }
    setSectorWarningModal(null);
  };

  const handleOpenEditProduct = (mat: Material) => {
    setEditingProduct(mat);
    setEditProductForm({
      id: mat.id,
      code: mat.code,
      codigoBarras: mat.codigoBarras || '',
      name: mat.name,
      quantity: mat.quantity,
      unit: mat.unit || 'unidade',
      estoqueMinimo: mat.estoqueMinimo,
      sectorId: mat.sectorId,
      supplierId: mat.supplierId || '',
      supplierDeliveryDays: mat.supplierDeliveryDays !== null && mat.supplierDeliveryDays !== undefined ? mat.supplierDeliveryDays : '',
      origin: mat.origin || '',
      imageUrl: mat.imageUrl || '',
      area: mat.area || '',
      estante: mat.estante || '',
      prateleira: mat.prateleira || '',
      palete: mat.palete || '',
      paleteQty: mat.paleteQty !== null && mat.paleteQty !== undefined ? mat.paleteQty : '',
      additionalSectors: mat.additionalSectors || '',
      isPulmao: mat.isPulmao !== false,
      isGiro: !!mat.isGiro,
      quantityGiro: mat.quantityGiro !== null && mat.quantityGiro !== undefined ? mat.quantityGiro : 0
    });
    setShowEditProductModal(true);
  };

  const handleEditProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;

    const duplicate = materials.find(m => m.id !== editingProduct.id && m.code.trim().toLowerCase() === editProductForm.code.trim().toLowerCase());
    if (duplicate) {
      setDuplicateModal({
        isOpen: true,
        code: editProductForm.code,
        existingProduct: duplicate
      });
      return;
    }

    try {
      await apiFetch(`/api/materials/${editingProduct.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: editProductForm.name,
          code: editProductForm.code,
          codigoBarras: editProductForm.codigoBarras || null,
          quantity: Number(editProductForm.quantity),
          estoqueMinimo: Number(editProductForm.estoqueMinimo),
          unit: editProductForm.unit,
          sectorId: editProductForm.sectorId,
          supplierId: editProductForm.supplierId || null,
          supplierDeliveryDays: editProductForm.supplierDeliveryDays !== '' ? Number(editProductForm.supplierDeliveryDays) : null,
          origin: editProductForm.origin || null,
          imageUrl: editProductForm.imageUrl || null,
          area: editProductForm.area || null,
          estante: editProductForm.estante || null,
          prateleira: editProductForm.prateleira || null,
          palete: editProductForm.palete || null,
          paleteQty: editProductForm.palete ? (editProductForm.paleteQty !== '' ? Number(editProductForm.paleteQty) : null) : null,
          additionalSectors: editProductForm.additionalSectors || null,
          isPulmao: editProductForm.isPulmao !== false,
          isGiro: !!editProductForm.isGiro,
          quantityGiro: Number(editProductForm.quantityGiro || 0)
        })
      }, token);
      setShowEditProductModal(false);
      setEditingProduct(null);
      fetchData();
      window.dispatchEvent(new CustomEvent('products-changed'));
    } catch (err: any) {
      alert(err.message || 'Erro ao editar produto');
    }
  };

  const handleLinkExistingUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetSectorForUser || !selectedExistingUserId) return;

    const existingUser = users.find(u => u.id === selectedExistingUserId);
    if (!existingUser) return;

    try {
      await apiFetch(`/api/users/${existingUser.id}`, {
        method: 'PUT',
        body: JSON.stringify({ ...existingUser, sectorId: targetSectorForUser.id })
      }, token);
      setShowUserModal(false);
      setSelectedExistingUserId('');
      fetchData();
    } catch (err) {
      alert('Erro ao vincular colaborador ao setor');
    }
  };

  const handleAddSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierForm.name.trim()) return;
    try {
      if (editingSupplier) {
        await apiFetch(`/api/suppliers/${editingSupplier.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            name: supplierForm.name,
            deliveryDays: Number(supplierForm.deliveryDays)
          })
        }, token);
      } else {
        await apiFetch('/api/suppliers', {
          method: 'POST',
          body: JSON.stringify({
            name: supplierForm.name,
            deliveryDays: Number(supplierForm.deliveryDays)
          })
        }, token);
      }
      setShowSupplierModal(false);
      setEditingSupplier(null);
      setSupplierForm({ name: '', deliveryDays: 0 });
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Erro ao salvar fornecedor');
    }
  };

  const handleOpenEditSupplier = (sup: Supplier) => {
    setEditingSupplier(sup);
    setSupplierForm({ name: sup.name, deliveryDays: sup.deliveryDays });
    setShowSupplierModal(true);
  };

  const handleDeleteSupplier = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este fornecedor? Todos os materiais associados a ele ficarão sem fornecedor.')) return;
    try {
      await apiFetch(`/api/suppliers/${id}`, { method: 'DELETE' }, token);
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Erro ao excluir fornecedor');
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetSectorForUser) return;
    try {
      await apiFetch('/api/users', {
        method: 'POST',
        body: JSON.stringify({ ...newUser, sectorId: targetSectorForUser.id })
      }, token);
      setShowUserModal(false);
      setNewUser({ name: '', email: '', password: '', role: 'USER' });
      fetchData();
    } catch (err) {
      alert('Erro ao criar usuário');
    }
  };

  const handleRemoveUserFromSector = async (user: User) => {
    if (!confirm(`Remover ${user.name} deste setor?`)) return;
    try {
       await apiFetch(`/api/users/${user.id}`, {
          method: 'PUT',
          body: JSON.stringify({ ...user, sectorId: null })
       }, token);
       fetchData();
    } catch (err) {
       alert('Erro ao atualizar usuário');
    }
  };

  const handleDeleteProduct = (material: Material) => {
    setDeleteModal({
      isOpen: true,
      type: 'product',
      id: material.id,
      name: material.name
    });
  };

  const executeDelete = async () => {
    const { type, id } = deleteModal;
    setDeleteModal(prev => ({ ...prev, isOpen: false }));
    try {
      await apiFetch(type === 'sector' ? `/api/sectors/${id}` : `/api/materials/${id}`, {
        method: 'DELETE'
      }, token);
      fetchData();
      window.dispatchEvent(new CustomEvent('products-changed'));
    } catch (err) {
      alert(`Erro ao excluir ${type === 'sector' ? 'setor' : 'produto'}`);
    }
  };

  if (loading) return <div className="p-8 text-center text-muted-foreground">Carregando setores...</div>;

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-2 sm:px-4 pb-12 animate-in fade-in duration-500">
      <div className="bg-card/50 backdrop-blur-md p-6 rounded-2xl border border-border shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
             <h2 className="text-2xl font-bold text-foreground flex items-center gap-3">
                <FolderTree className="w-8 h-8 text-blue-500 shrink-0" /> Gerenciamento de Setores
             </h2>
             <p className="text-sm text-muted-foreground mt-1">Organize categorias, visualize produtos e a equipe delegada.</p>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          <div className="lg:col-span-2 space-y-6 w-full min-w-0">
             <div className="bg-card/50 backdrop-blur-md rounded-2xl border border-border shadow-sm overflow-hidden p-4 sm:p-6 w-full">
        {isManager && (
          <form onSubmit={handleAddSector} className="flex gap-3 mb-6 w-full flex-wrap sm:flex-nowrap">
            <input 
              type="text" 
              placeholder="Nome do Novo Setor..." 
              value={newSectorName}
              onChange={e => setNewSectorName(e.target.value)}
              className="flex-1 bg-secondary/50 border border-border rounded-xl px-4 py-2.5 sm:py-3 focus:ring-2 focus:ring-blue-500/50 outline-none transition-all placeholder:text-muted-foreground/50 text-foreground text-sm min-w-0 h-[46px]"
              required
            />
            <button 
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-5 py-2.5 sm:py-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-500/25 shrink-0 w-full sm:w-auto h-[46px] text-sm"
            >
              <Plus className="w-4 h-4" /> <span>Adicionar Setor</span>
            </button>
          </form>
        )}

        <div className="space-y-4 w-full">
          {sectors.map(sector => {
            const sectorMaterials = materials.filter(m => m.sectorId === sector.id);
            const sectorUsers = users.filter(u => u.sectorId === sector.id);
            const isExpanded = expandedSector === sector.id;

            return (
               <div key={sector.id} className="border border-border rounded-xl bg-card overflow-hidden shadow-sm transition-all w-full min-w-0">
                 <div className="p-4 px-4 sm:px-5 flex items-center justify-between hover:bg-secondary/30 transition-colors cursor-pointer w-full" onClick={() => toggleExpand(sector.id)}>
                   <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0 pr-2">
                      {editingSector?.id === sector.id ? (
                         <input 
                           autoFocus
                           defaultValue={sector.name}
                           onBlur={(e) => {
                             if (ignoreBlurRef.current) {
                               ignoreBlurRef.current = false;
                               return;
                             }
                             handleEditSector(sector, e.target.value);
                           }}
                           onKeyDown={(e) => {
                             if (e.key === 'Enter') {
                               e.currentTarget.blur();
                             } else if (e.key === 'Escape') {
                               ignoreBlurRef.current = true;
                               setEditingSector(null);
                             }
                           }}
                           className="bg-background border border-blue-500 rounded-xl px-3 py-1.5 outline-none font-medium text-foreground w-full text-sm max-w-xs h-[36px]"
                           onClick={e => e.stopPropagation()}
                         />
                      ) : (
                         <span className="font-bold text-foreground text-base sm:text-lg truncate block flex-1 min-w-0">{sector.name}</span>
                      )}
                      
                      <div className="flex gap-2 text-[10px] sm:text-xs font-semibold text-muted-foreground shrink-0 hidden sm:flex">
                         <span className="flex items-center gap-1 bg-secondary px-2 py-1 rounded-md whitespace-nowrap"><Package className="w-3.5 h-3.5 text-blue-500" /> {sectorMaterials.length} Itens</span>
                         <span className="flex items-center gap-1 bg-secondary px-2 py-1 rounded-md whitespace-nowrap"><Users className="w-3.5 h-3.5 text-blue-500" /> {sectorUsers.length} Equipe</span>
                      </div>
                   </div>
                   
                   <div className="flex items-center gap-1 shrink-0">
                     {isManager && (
                       <>
                          <button 
                             onClick={(e) => { e.stopPropagation(); setTargetSectorForUser(sector); setShowUserModal(true); }}
                             className="p-1.5 text-muted-foreground hover:text-blue-500 transition-colors rounded-lg hover:bg-blue-500/10 hidden sm:inline-block"
                             title="Adicionar Usuário"
                          >
                             <UserPlus className="w-4 h-4" />
                          </button>
                          <button 
                             onClick={(e) => { e.stopPropagation(); setTargetSectorForProduct(sector); setShowProductModal(true); }}
                             className="p-1.5 text-muted-foreground hover:text-emerald-500 transition-colors rounded-lg hover:bg-emerald-500/10 hidden sm:inline-block"
                             title="Adicionar Produto"
                          >
                             <Plus className="w-4 h-4" />
                          </button>
                          <div className="w-px h-5 bg-border mx-1 hidden sm:block"></div>
                          <button 
                             onClick={(e) => { e.stopPropagation(); ignoreBlurRef.current = false; setEditingSector(sector); }}
                             className="p-1.5 text-muted-foreground hover:text-blue-500 transition-colors rounded-lg hover:bg-blue-500/10"
                             title="Editar Nome"
                          >
                             <Edit3 className="w-4 h-4" />
                          </button>
                          <button 
                             onClick={(e) => { e.stopPropagation(); handleDeleteSector(sector); }}
                             className="p-1.5 text-muted-foreground hover:text-red-500 transition-colors rounded-lg hover:bg-red-500/10"
                             title="Excluir Setor"
                          >
                             <Trash2 className="w-4 h-4" />
                          </button>
                          <div className="w-px h-5 bg-border mx-1"></div>
                       </>
                     )}
                     <button className="p-1.5 text-muted-foreground hover:bg-secondary rounded-lg transition-colors shrink-0">
                       {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                     </button>
                   </div>
                 </div>

                 <AnimatePresence>
                   {isExpanded && (
                     <motion.div 
                        initial={{ height: 0 }}
                        animate={{ height: 'auto' }}
                        exit={{ height: 0 }}
                        className="overflow-hidden border-t border-border bg-secondary/10 w-full"
                     >
                        <div className="p-4 sm:p-5 grid grid-cols-1 md:grid-cols-2 gap-6 w-full items-start">
                           <div>
                              <div className="flex items-center justify-between mb-3.5 gap-2 flex-wrap sm:flex-nowrap">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 truncate">
                                   <Package className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> Produtos Atribuídos
                                </h4>
                                <button 
                                  onClick={() => { setTargetSectorForProduct(sector); setShowProductModal(true); }}
                                  className="text-[11px] text-blue-500 hover:text-blue-600 font-semibold bg-blue-500/5 hover:bg-blue-500/10 px-2 py-1 rounded-md transition-colors border border-blue-500/10 whitespace-nowrap"
                                >
                                  + Vincular Produto
                                </button>
                              </div>
                              {sectorMaterials.length > 0 ? (
                                 <ul className="space-y-2 max-w-full">
                                    {sectorMaterials.map(mat => (
                                       <li 
                                          key={mat.id} 
                                          onClick={() => isManager && handleOpenEditProduct(mat)}
                                          className={`text-sm flex items-center justify-between bg-card border border-border px-3 py-2.5 rounded-xl group hover:border-emerald-500/30 transition-colors w-full min-w-0 gap-2 ${isManager ? 'cursor-pointer hover:bg-secondary/20' : ''}`}
                                       >
                                          <div className="flex-1 min-w-0">
                                             <div className="font-bold text-foreground text-sm truncate block" title={mat.name}>{mat.name}</div>
                                             <div className="text-xs text-muted-foreground font-mono truncate block mt-0.5">{mat.code}</div>
                                          </div>
                                          <div className="flex items-center gap-1 sm:gap-2 shrink-0 md:opacity-0 md:group-hover:opacity-100 opacity-100 transition-opacity">
                                             <span className="font-bold text-xs px-2 py-1 bg-secondary text-foreground rounded-lg whitespace-nowrap font-mono mr-1">
                                                {mat.quantity} {formatUnit(mat.unit)}
                                             </span>
                                             <button 
                                                type="button"
                                                onClick={(e) => { e.stopPropagation(); setImageModalProduct(mat); }}
                                                className="text-amber-500 hover:text-amber-400 p-1.5 rounded-lg hover:bg-amber-500/10 transition-colors shrink-0"
                                                title="Visualizar Foto"
                                             >
                                                <Eye className="w-4 h-4" />
                                             </button>
                                             {isManager && (
                                                 <button 
                                                    type="button"
                                                    onClick={(e) => { e.stopPropagation(); handleOpenEditProduct(mat); }}
                                                    className="text-blue-500 hover:text-blue-400 p-1.5 rounded-lg hover:bg-blue-500/10 transition-colors shrink-0"
                                                    title="Editar Produto"
                                                 >
                                                    <Edit3 className="w-4 h-4" />
                                                 </button>
                                              )}
                                             {isManager && (
                                                <button 
                                                   type="button"
                                                   onClick={(e) => { e.stopPropagation(); handleDeleteProduct(mat); }}
                                                   className="text-red-500 hover:text-red-400 p-1.5 rounded-lg hover:bg-red-500/10 transition-colors shrink-0"
                                                   title="Excluir Produto"
                                                >
                                                   <Trash2 className="w-4 h-4" />
                                                </button>
                                             )}
                                          </div>
                                       </li>
                                    ))}
                                 </ul>
                              ) : (
                                 <div className="bg-card border border-dashed border-border rounded-xl p-4 text-center w-full">
                                    <p className="text-xs text-muted-foreground">Nenhum produto vinculado a este setor.</p>
                                 </div>
                              )}
                           </div>
                           
                           <div className="w-full min-w-0">
                              <div className="flex items-center justify-between mb-3.5 gap-2 flex-wrap sm:flex-nowrap">
                                 <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 truncate">
                                    <Users className="w-3.5 h-3.5 text-blue-500 shrink-0" /> Equipe Delegada
                                 </h4>
                                 <button 
                                    onClick={() => { setTargetSectorForUser(sector); setShowUserModal(true); }}
                                    className="text-[11px] text-blue-500 hover:text-blue-600 font-semibold bg-blue-500/5 hover:bg-blue-500/10 px-2 py-1 rounded-md transition-colors border border-blue-500/10 whitespace-nowrap"
                                 >
                                    + Alocar Membro
                                 </button>
                              </div>
                              {sectorUsers.length > 0 ? (
                                 <ul className="space-y-2 max-w-full">
                                    {sectorUsers.map(usr => (
                                       <li key={usr.id} className="text-sm flex items-center bg-card border border-border px-3 py-2 rounded-xl group hover:border-blue-500/30 transition-colors w-full min-w-0 gap-3">
                                          <div className="w-8 h-8 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center text-xs font-black shrink-0">
                                             {usr.name.charAt(0).toUpperCase()}
                                          </div>
                                          <div className="flex-1 min-w-0">
                                             <div className="font-bold text-foreground truncate text-sm block" title={usr.name}>{usr.name}</div>
                                             <div className="text-xs text-muted-foreground truncate block mt-0.5">{usr.email}</div>
                                          </div>
                                          <button 
                                             type="button"
                                             onClick={() => handleRemoveUserFromSector(usr)}
                                             className="text-muted-foreground hover:text-red-500 md:opacity-0 md:group-hover:opacity-100 opacity-100 transition-opacity shrink-0 p-1"
                                             title="Remover do Setor"
                                          >
                                             <Trash2 className="w-4 h-4" />
                                          </button>
                                       </li>
                                    ))}
                                 </ul>
                              ) : (
                                 <div className="bg-card border border-dashed border-border rounded-xl p-4 text-center w-full">
                                    <p className="text-xs text-muted-foreground">Nenhum colaborador alocado neste setor.</p>
                                 </div>
                              )}
                           </div>
                        </div>
                     </motion.div>
                   )}
                 </AnimatePresence>
               </div>
            )
          })}
          {sectors.length === 0 && (
            <div className="p-12 border-2 border-dashed border-border rounded-2xl text-center flex flex-col items-center justify-center w-full">
               <FolderTree className="w-12 h-12 text-muted-foreground mb-4 opacity-40 shrink-0" />
               <h3 className="text-lg font-bold text-foreground mb-1">Nenhum Setor Cadastrado</h3>
               <p className="text-muted-foreground text-sm max-w-xs">Crie seu primeiro setor no painel superior para organizar produtos e equipes.</p>
            </div>
          )}
        </div>
      </div>
          </div>

          <div className="space-y-6 w-full shrink-0">
             <div className="bg-card/50 backdrop-blur-md rounded-2xl border border-border shadow-sm p-4 sm:p-6 w-full min-w-0">
                <div className="flex items-center justify-between mb-3.5 gap-2 w-full">
                   <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                      <Truck className="w-5 h-5 text-blue-500 shrink-0" /> Fornecedores
                   </h3>
                   {isManager && (
                      <button
                        onClick={() => {
                           setEditingSupplier(null);
                           setSupplierForm({ name: '', deliveryDays: 0 });
                           setShowSupplierModal(true);
                        }}
                        className="p-1.5 text-blue-500 hover:bg-blue-500/10 rounded-lg transition-colors flex items-center gap-1 text-xs font-bold border border-blue-500/10 bg-blue-500/5 whitespace-nowrap"
                      >
                        <Plus className="w-3.5 h-3.5" /> Novo
                      </button>
                   )}
                </div>

                <p className="text-xs text-muted-foreground mb-4">
                   Gerencie prestadores para associar aos materiais e monitorar prazos de entrega estimados.
                </p>

                <div className="space-y-3 w-full">
                  {suppliers.length === 0 ? (
                     <div className="text-center py-8 text-xs text-muted-foreground bg-secondary/20 rounded-xl border border-dashed border-border w-full">
                        Nenhum fornecedor cadastrado.
                     </div>
                  ) : (
                     suppliers.map(sup => (
                        <div key={sup.id} className="p-3.5 bg-card border border-border rounded-xl shadow-sm hover:shadow-md transition-all flex items-center justify-between gap-3 w-full min-w-0 group">
                           <div className="min-w-0 flex-1">
                              <h4 className="font-bold text-sm text-foreground truncate block" title={sup.name}>{sup.name}</h4>
                              <p className="text-xs text-muted-foreground mt-0.5 truncate block">Prazo: {sup.deliveryDays} {sup.deliveryDays === 1 ? 'dia útil' : 'dias úteis'}</p>
                           </div>
                           {isManager && (
                              <div className="flex items-center gap-1 shrink-0 md:opacity-0 md:group-hover:opacity-100 opacity-100 transition-opacity">
                                 <button
                                    onClick={() => handleOpenEditSupplier(sup)}
                                    className="p-1.5 text-muted-foreground hover:text-blue-500 rounded-lg hover:bg-secondary transition-colors"
                                    title="Editar Fornecedor"
                                 >
                                    <Edit3 className="w-4 h-4" />
                                 </button>
                                 <button
                                    onClick={() => handleDeleteSupplier(sup.id)}
                                    className="p-1.5 text-muted-foreground hover:text-red-500 rounded-lg hover:bg-secondary transition-colors"
                                    title="Excluir Fornecedor"
                                 >
                                    <Trash2 className="w-4 h-4" />
                                 </button>
                              </div>
                           )}
                        </div>
                     ))
                  )}
                </div>
             </div>
          </div>
      </div>

      <AnimatePresence>
        {showProductModal && targetSectorForProduct && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
               initial={{ opacity: 0 }} 
               animate={{ opacity: 1 }} 
               exit={{ opacity: 0 }}
               className="absolute inset-0 bg-background/80 backdrop-blur-sm"
               onClick={() => setShowProductModal(false)}
            />
            <motion.div 
               initial={{ scale: 0.95, y: 20 }}
               animate={{ scale: 1, y: 0 }}
               exit={{ scale: 0.95, y: 20 }}
               className="bg-card border border-border rounded-2xl w-full max-w-2xl shadow-2xl p-5 sm:p-6 relative z-10 max-h-[calc(100vh-2rem)] overflow-y-auto scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent"
            >
               <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-emerald-400"></div>
               
               <div className="flex justify-between items-start mb-5 mt-2">
                  <div className="min-w-0 flex-1 pr-2">
                     <h3 className="text-xl font-bold text-foreground truncate">Cadastrar Novo Produto</h3>
                     <p className="text-sm text-muted-foreground mt-0.5 truncate">Setor Alvo: <span className="font-semibold text-foreground">{targetSectorForProduct.name}</span></p>
                  </div>
                  <button type="button" onClick={() => setShowProductModal(false)} className="p-1 text-muted-foreground hover:bg-secondary rounded-lg shrink-0 transition-colors">
                     <X className="w-5 h-5" />
                  </button>
               </div>

               <form onSubmit={handleAddProduct} className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4">
                     <div className="space-y-4">
                        <div>
                           <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">Código Único (SKU)</label>
                           <input 
                              type="text" 
                              value={newProduct.code}
                              onChange={e => setNewProduct({...newProduct, code: e.target.value})}
                              className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-2 focus:ring-2 focus:ring-emerald-500/50 outline-none text-foreground font-mono text-sm h-[40px]"
                              placeholder="Ex: SKU-390"
                              required
                           />
                        </div>
                        
                        <div>
                           <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">Nome do Produto</label>
                           <input 
                              type="text" 
                              value={newProduct.name}
                              onChange={e => setNewProduct({...newProduct, name: e.target.value})}
                              className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-2 focus:ring-2 focus:ring-emerald-500/50 outline-none text-foreground text-sm h-[40px]"
                              placeholder="Ex: Graxa Azul de Lítio"
                              required
                           />
                        </div>

                        <div>
                           <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">Código de Barras</label>
                           <div className="relative flex items-center w-full">
                              <input 
                                 type="text" 
                                 value={newProduct.codigoBarras || ''}
                                 onChange={e => setNewProduct({...newProduct, codigoBarras: e.target.value})}
                                 className="w-full bg-secondary/50 border border-border rounded-xl pl-4 pr-12 py-2 focus:ring-2 focus:ring-emerald-500/50 outline-none text-foreground text-sm font-mono h-[40px]"
                                 placeholder="EAN-13 opcional"
                              />
                              <button
                                 type="button"
                                 onClick={() => {
                                    setScanTarget('newProduct');
                                    setShowScanner(true);
                                 }}
                                 className="absolute right-3 p-1.5 hover:bg-secondary rounded-lg text-muted-foreground hover:text-foreground transition-colors shrink-0"
                              >
                                 <Camera className="w-5 h-5" />
                              </button>
                           </div>
                        </div>

                        <div>
                           <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">Fornecedor Associado</label>
                           <select 
                              value={newProduct.supplierId}
                              onChange={e => setNewProduct({...newProduct, supplierId: e.target.value})}
                              className="w-full bg-secondary/50 border border-border rounded-xl px-3 py-2 focus:ring-2 focus:ring-emerald-500/50 outline-none text-foreground cursor-pointer text-sm h-[40px] truncate"
                           >
                              <option value="">Nenhum fornecedor</option>
                              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                           </select>
                        </div>
                     </div>

                     <div className="space-y-4">
                        <div>
                           <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">Origem do Material</label>
                           <input 
                              type="text" 
                              value={newProduct.origin || ''}
                              onChange={e => setNewProduct({...newProduct, origin: e.target.value})}
                              className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-2 focus:ring-2 focus:ring-emerald-500/50 outline-none text-foreground text-sm h-[40px]"
                              placeholder="Ex: Nacional / Importado"
                           />
                        </div>

                        <div>
                           <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">Prazo de Entrega (Dias Úteis)</label>
                           <input 
                              type="number" 
                              min="0"
                              placeholder="Ex: 5"
                              value={newProduct.supplierDeliveryDays}
                              onChange={e => setNewProduct({...newProduct, supplierDeliveryDays: e.target.value})}
                              className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-2 focus:ring-2 focus:ring-emerald-500/50 outline-none text-foreground text-sm h-[40px]"
                           />
                        </div>

                        <div>
                           <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">Foto do Produto (URL ou arquivo)</label>
                           <div className="flex gap-2 w-full">
                              <input 
                                 type="text" 
                                 value={newProduct.imageUrl || ''}
                                 onChange={e => setNewProduct({...newProduct, imageUrl: e.target.value})}
                                 className="flex-1 bg-secondary/50 border border-border rounded-xl px-4 py-2 focus:ring-2 focus:ring-emerald-500/50 outline-none text-foreground text-sm h-[40px] min-w-0"
                                 placeholder="https://..."
                              />
                              <label className="bg-secondary hover:bg-secondary/80 border border-border text-foreground px-3 rounded-xl cursor-pointer flex items-center justify-center shrink-0 h-[40px]" title="Upload de Imagem Local">
                                 <Upload className="w-4 h-4 text-muted-foreground" />
                                 <input 
                                    type="file" 
                                    accept="image/*" 
                                    className="hidden" 
                                    onChange={(e) => {
                                       const file = e.target.files?.[0];
                                       if (file) {
                                          const reader = new FileReader();
                                          reader.onloadend = () => {
                                             setNewProduct({...newProduct, imageUrl: reader.result as string});
                                          };
                                          reader.readAsDataURL(file);
                                       }
                                    }}
                                 />
                              </label>
                           </div>
                        </div>
                     </div>
                  </div>

                  <div className="border-t border-border/50 pt-4 grid grid-cols-2 gap-4">
                     <div>
                        <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">Unidade Medida</label>
                        <select 
                           value={newProduct.unit}
                           onChange={e => setNewProduct({...newProduct, unit: e.target.value})}
                           className="w-full bg-secondary/50 border border-border rounded-xl px-3 py-2 focus:ring-2 focus:ring-emerald-500/50 outline-none text-foreground cursor-pointer text-sm h-[40px]"
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
                        <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">Mínimo Crítico</label>
                        <input 
                           type="number" 
                           min="0"
                           value={newProduct.estoqueMinimo}
                           onChange={e => setNewProduct({...newProduct, estoqueMinimo: e.target.value ? parseInt(e.target.value) : ''})}
                           className="w-full bg-secondary/50 border border-border rounded-xl px-3 py-2 focus:ring-2 focus:ring-emerald-500/50 outline-none text-foreground font-bold text-sm h-[40px]"
                           required
                        />
                     </div>
                  </div>

                  <div className="space-y-3 border-t border-border/50 pt-4">
                     <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Alocação de Estoque Físico</span>
                     <div className="flex flex-col sm:flex-row gap-4 bg-secondary/20 p-3 rounded-xl border border-border/50">
                        <label className="flex items-start gap-2 cursor-pointer flex-1">
                           <input
                              type="checkbox"
                              checked={newProduct.isPulmao !== false}
                              onChange={e => setNewProduct(prev => ({ ...prev, isPulmao: e.target.checked }))}
                              className="mt-1 rounded text-emerald-500 bg-secondary/50 border-border focus:ring-emerald-500 w-4 h-4 shrink-0"
                           />
                           <div className="flex flex-col">
                              <span className="text-sm font-semibold text-foreground">📦 Estoque Pulmão</span>
                              <span className="text-xxs text-muted-foreground">Volume estocado a granel.</span>
                           </div>
                        </label>
                        <label className="flex items-start gap-2 cursor-pointer flex-1">
                           <input
                              type="checkbox"
                              checked={newProduct.isGiro || false}
                              onChange={e => setNewProduct(prev => ({ ...prev, isGiro: e.target.checked }))}
                              className="mt-1 rounded text-emerald-500 bg-secondary/50 border-border focus:ring-emerald-500 w-4 h-4 shrink-0"
                           />
                           <div className="flex flex-col">
                              <span className="text-sm font-semibold text-foreground">⚡ Giro do Dia</span>
                              <span className="text-xxs text-muted-foreground">Gargalo operacional de uso rápido.</span>
                           </div>
                        </label>
                     </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 min-w-0">
                     {(newProduct.isPulmao !== false) && (
                        <div className="min-w-0">
                           <label className="block text-xs font-semibold text-muted-foreground mb-1">Quantidade no Pulmão</label>
                           <input 
                              type="number" 
                              min="0"
                              value={newProduct.quantity}
                              onChange={e => setNewProduct({...newProduct, quantity: e.target.value ? parseInt(e.target.value) : 0})}
                              className="w-full bg-secondary/50 border border-border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500/50 outline-none text-foreground font-bold h-[40px]"
                              required
                           />
                        </div>
                     )}
                     {newProduct.isGiro && (
                        <div className="min-w-0">
                           <label className="block text-xs font-semibold text-muted-foreground mb-1">Quantidade no Giro</label>
                           <input 
                              type="number" 
                              min="0"
                              value={newProduct.quantityGiro}
                              onChange={e => setNewProduct({...newProduct, quantityGiro: e.target.value ? parseInt(e.target.value) : 0})}
                              className="w-full bg-secondary/50 border border-border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500/50 outline-none text-foreground font-bold h-[40px]"
                              required
                           />
                        </div>
                     )}
                  </div>

                  <div className="border-t border-border/50 pt-4 space-y-3">
                     <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Localização de Armazenagem (Opcional)</h4>
                     <div className="grid grid-cols-2 gap-3.5 text-sm">
                        <input type="text" placeholder="Área" value={newProduct.area} onChange={e => setNewProduct({...newProduct, area: e.target.value})} className="bg-secondary/50 border border-border rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500/50 text-foreground h-[40px]" />
                        <input type="text" placeholder="Estante" value={newProduct.estante} onChange={e => setNewProduct({...newProduct, estante: e.target.value})} className="bg-secondary/50 border border-border rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500/50 text-foreground h-[40px]" />
                        <input type="text" placeholder="Prateleira" value={newProduct.prateleira} onChange={e => setNewProduct({...newProduct, prateleira: e.target.value})} className="bg-secondary/50 border border-border rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500/50 text-foreground h-[40px]" />
                        <input type="text" placeholder="Palete" value={newProduct.palete} onChange={e => setNewProduct({...newProduct, palete: e.target.value})} className="bg-secondary/50 border border-border rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500/50 text-foreground h-[40px]" />
                     </div>
                  </div>

                  <div className="border-t border-border/50 pt-4 flex gap-3">
                     <button type="button" onClick={() => setShowProductModal(false)} className="flex-1 px-4 py-2.5 text-muted-foreground font-medium rounded-xl hover:bg-secondary transition-colors text-sm border border-border h-[44px]">Cancelar</button>
                     <button type="submit" className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl transition-colors shadow-md text-sm h-[44px]">Salvar Produto</button>
                  </div>
               </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Editar Produto */}
      <AnimatePresence>
        {showEditProductModal && editingProduct && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
               initial={{ opacity: 0 }} 
               animate={{ opacity: 1 }} 
               exit={{ opacity: 0 }}
               className="absolute inset-0 bg-background/80 backdrop-blur-sm"
               onClick={() => setShowEditProductModal(false)}
            />
            <motion.div 
               initial={{ scale: 0.95, y: 20 }}
               animate={{ scale: 1, y: 0 }}
               exit={{ scale: 0.95, y: 20 }}
               className="bg-card border border-border rounded-2xl w-full max-w-2xl shadow-2xl p-5 sm:p-6 relative z-10 max-h-[calc(100vh-2rem)] overflow-y-auto scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent"
            >
               <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
               
               <div className="flex justify-between items-start mb-5 mt-2">
                  <div>
                     <h3 className="text-xl font-bold text-foreground">Editar Ficha do Produto</h3>
                     <p className="text-sm text-muted-foreground mt-0.5">Modificando dados cadastrais no sistema</p>
                  </div>
                  <button type="button" onClick={() => setShowEditProductModal(false)} className="p-1 text-muted-foreground hover:bg-secondary rounded-lg shrink-0 transition-colors">
                     <X className="w-5 h-5" />
                  </button>
               </div>

               <form onSubmit={handleEditProductSubmit} className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4">
                     <div className="space-y-4">
                        <div>
                           <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">Código de Identificação (SKU)</label>
                           <input 
                              type="text" 
                              value={editProductForm.code}
                              onChange={e => setEditProductForm({...editProductForm, code: e.target.value})}
                              className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-500/50 outline-none text-foreground font-mono text-sm h-[40px]"
                              required
                           />
                        </div>
                        
                        <div>
                           <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">Nome Comercial</label>
                           <input 
                              type="text" 
                              value={editProductForm.name}
                              onChange={e => setEditProductForm({...editProductForm, name: e.target.value})}
                              className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-500/50 outline-none text-foreground text-sm h-[40px]"
                              required
                           />
                        </div>

                        <div>
                           <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">Código de Barras</label>
                           <div className="relative flex items-center w-full">
                              <input 
                                 type="text" 
                                 value={editProductForm.codigoBarras || ''}
                                 onChange={e => setEditProductForm({...editProductForm, codigoBarras: e.target.value})}
                                 className="w-full bg-secondary/50 border border-border rounded-xl pl-4 pr-12 py-2 focus:ring-2 focus:ring-blue-500/50 outline-none text-foreground text-sm font-mono h-[40px]"
                              />
                              <button
                                 type="button"
                                 onClick={() => {
                                    setScanTarget('editProduct');
                                    setShowScanner(true);
                                 }}
                                 className="absolute right-3 p-1.5 hover:bg-secondary rounded-lg text-muted-foreground hover:text-foreground transition-colors shrink-0"
                              >
                                 <Camera className="w-5 h-5" />
                              </button>
                           </div>
                        </div>

                        <div>
                           <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">Setor Primário</label>
                           <select 
                              value={editProductForm.sectorId}
                              onChange={e => setEditProductForm({...editProductForm, sectorId: e.target.value})}
                              className="w-full bg-secondary/50 border border-border rounded-xl px-3 py-2 focus:ring-2 focus:ring-blue-500/50 outline-none text-foreground cursor-pointer text-sm h-[40px] truncate"
                           >
                              {sectors.map(s => (
                                 <option key={s.id} value={s.id}>{s.name}</option>
                              ))}
                           </select>
                        </div>
                     </div>

                     <div className="space-y-4">
                        <div>
                           <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">Nacionalidade / Origem</label>
                           <input 
                              type="text" 
                              value={editProductForm.origin || ''}
                              onChange={e => setEditProductForm({...editProductForm, origin: e.target.value})}
                              className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-500/50 outline-none text-foreground text-sm h-[40px]"
                           />
                        </div>

                        <div>
                           <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">Fornecedor</label>
                           <select 
                              value={editProductForm.supplierId}
                              onChange={e => setEditProductForm({...editProductForm, supplierId: e.target.value})}
                              className="w-full bg-secondary/50 border border-border rounded-xl px-3 py-2 focus:ring-2 focus:ring-blue-500/50 outline-none text-foreground cursor-pointer text-sm h-[40px] truncate"
                           >
                              <option value="">Nenhum fornecedor</option>
                              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                           </select>
                        </div>

                        <div>
                           <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">Prazo de Entrega (Dias Úteis)</label>
                           <input 
                              type="number" 
                              min="0"
                              value={editProductForm.supplierDeliveryDays}
                              onChange={e => setEditProductForm({...editProductForm, supplierDeliveryDays: e.target.value})}
                              className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-500/50 outline-none text-foreground text-sm h-[40px]"
                           />
                        </div>

                        <div>
                           <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Mudar URL da Imagem</label>
                           <div className="flex gap-2 w-full">
                              <input 
                                 type="text" 
                                 value={editProductForm.imageUrl || ''}
                                 onChange={e => setEditProductForm({...editProductForm, imageUrl: e.target.value})}
                                 className="flex-1 bg-secondary/50 border border-border rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-500/50 outline-none text-foreground text-sm h-[40px] min-w-0"
                              />
                              <label className="bg-secondary hover:bg-secondary/80 border border-border text-foreground px-3 rounded-xl cursor-pointer flex items-center justify-center shrink-0 h-[40px]" title="Upload de Imagem Local">
                                 <Upload className="w-4 h-4 text-muted-foreground" />
                                 <input 
                                    type="file" 
                                    accept="image/*" 
                                    className="hidden" 
                                    onChange={(e) => {
                                       const file = e.target.files?.[0];
                                       if (file) {
                                          const reader = new FileReader();
                                          reader.onloadend = () => {
                                             setEditProductForm({...editProductForm, imageUrl: reader.result as string});
                                          };
                                          reader.readAsDataURL(file);
                                       }
                                    }}
                                 />
                              </label>
                           </div>
                        </div>
                  </div>
                  </div>

                  <div className="border-t border-border/50 pt-4 grid grid-cols-2 gap-4">
                     <div>
                        <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">Métrica de Unidade</label>
                        <select 
                           value={editProductForm.unit}
                           onChange={e => setEditProductForm({...editProductForm, unit: e.target.value})}
                           className="w-full bg-secondary/50 border border-border rounded-xl px-3 py-2 focus:ring-2 focus:ring-blue-500/50 outline-none text-foreground cursor-pointer text-sm h-[40px]"
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
                        <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">Estoque Mínimo</label>
                        <input 
                           type="number" 
                           min="0"
                           value={editProductForm.estoqueMinimo}
                           onChange={e => setEditProductForm({...editProductForm, estoqueMinimo: e.target.value ? parseInt(e.target.value) : ''})}
                           className="w-full bg-secondary/50 border border-border rounded-xl px-3 py-2 focus:ring-2 focus:ring-blue-500/50 outline-none text-foreground font-bold text-sm h-[40px]"
                        />
                     </div>
                  </div>

                  <div className="space-y-3 border-t border-border/50 pt-4">
                     <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Canais de Estoques Habilitados</span>
                     <div className="flex flex-col sm:flex-row gap-4 bg-secondary/20 p-3 rounded-xl border border-border/50">
                        <label className="flex items-start gap-2 cursor-pointer flex-1">
                           <input
                              type="checkbox"
                              checked={editProductForm.isPulmao}
                              onChange={e => setEditProductForm(prev => ({ ...prev, isPulmao: e.target.checked }))}
                              className="mt-1 rounded text-blue-500 bg-secondary/50 border-border focus:ring-blue-500 w-4 h-4 shrink-0"
                           />
                           <div className="flex flex-col">
                              <span className="text-sm font-semibold text-foreground">📦 Estoque Pulmão</span>
                              <span className="text-xxs text-muted-foreground">Habilitar canal pulmão estrutural.</span>
                           </div>
                        </label>
                        <label className="flex items-start gap-2 cursor-pointer flex-1">
                           <input
                              type="checkbox"
                              checked={editProductForm.isGiro}
                              onChange={e => setEditProductForm(prev => ({ ...prev, isGiro: e.target.checked }))}
                              className="mt-1 rounded text-amber-500 bg-secondary/50 border-border focus:ring-amber-500 w-4 h-4 shrink-0"
                           />
                           <div className="flex flex-col">
                              <span className="text-sm font-semibold text-foreground">⚡ Giro do Dia</span>
                              <span className="text-xxs text-muted-foreground">Habilitar canal de uso rotativo.</span>
                           </div>
                        </label>
                     </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 min-w-0">
                     {editProductForm.isPulmao && (
                        <div className="min-w-0">
                           <label className="block text-xs font-semibold text-muted-foreground mb-1">Quantidade Pulmão</label>
                           <input 
                              type="number" 
                              min="0"
                              value={editProductForm.quantity}
                              onChange={e => setEditProductForm({...editProductForm, quantity: e.target.value ? parseInt(e.target.value) : 0})}
                              className="w-full bg-secondary/50 border border-border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/50 outline-none text-foreground font-bold h-[40px]"
                           />
                        </div>
                     )}
                     {editProductForm.isGiro && (
                        <div className="min-w-0">
                           <label className="block text-xs font-semibold text-muted-foreground mb-1">Quantidade Giro</label>
                           <input 
                              type="number" 
                              min="0"
                              value={editProductForm.quantityGiro}
                              onChange={e => setEditProductForm({...editProductForm, quantityGiro: e.target.value ? parseInt(e.target.value) : 0})}
                              className="w-full bg-secondary/50 border border-border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/50 outline-none text-foreground font-bold h-[40px]"
                           />
                        </div>
                     )}
                  </div>

                  <div className="border-t border-border/50 pt-4 flex gap-3">
                     <button type="button" onClick={() => setShowEditProductModal(false)} className="flex-1 px-4 py-2.5 text-muted-foreground font-medium rounded-xl hover:bg-secondary transition-colors text-sm border border-border h-[44px]">Cancelar</button>
                     <button type="submit" className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors shadow-md text-sm h-[44px]">Salvar Modificações</button>
                  </div>
               </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showUserModal && targetSectorForUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
               initial={{ opacity: 0 }} 
               animate={{ opacity: 1 }} 
               exit={{ opacity: 0 }}
               className="absolute inset-0 bg-background/80 backdrop-blur-sm"
               onClick={() => { setShowUserModal(false); setUserModalTab('create'); setSelectedExistingUserId(''); }}
            />
            <motion.div 
               initial={{ scale: 0.95, y: 20 }}
               animate={{ scale: 1, y: 0 }}
               exit={{ scale: 0.95, y: 20 }}
               className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl p-5 sm:p-6 relative z-10 max-h-[95vh] overflow-y-auto custom-scrollbar"
            >
               <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
               
               <div className="flex justify-between items-start mb-5 mt-2">
                  <div className="min-w-0 flex-1">
                     <h3 className="text-xl font-bold text-foreground">Alocar Colaborador</h3>
                     <p className="text-sm text-muted-foreground mt-0.5 truncate">Setor Alvo: <span className="font-semibold text-foreground">{targetSectorForUser.name}</span></p>
                  </div>
                  <button type="button" onClick={() => { setShowUserModal(false); setUserModalTab('create'); setSelectedExistingUserId(''); }} className="p-1 text-muted-foreground hover:bg-secondary rounded-lg shrink-0 transition-colors">
                     <X className="w-5 h-5" />
                  </button>
               </div>

               <div className="flex border-b border-border mb-5 w-full">
                  <button
                     type="button"
                     className={`flex-1 pb-2.5 text-sm font-semibold transition-colors relative ${userModalTab === 'create' ? 'text-blue-500' : 'text-muted-foreground hover:text-foreground'}`}
                     onClick={() => setUserModalTab('create')}
                  >
                     Criar Novo Usuário
                     {userModalTab === 'create' && <motion.div layoutId="userModalActiveTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />}
                  </button>
                  <button
                     type="button"
                     className={`flex-1 pb-2.5 text-sm font-semibold transition-colors relative ${userModalTab === 'link' ? 'text-blue-500' : 'text-muted-foreground hover:text-foreground'}`}
                     onClick={() => setUserModalTab('link')}
                  >
                     Vincular Existente
                     {userModalTab === 'link' && <motion.div layoutId="userModalActiveTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />}
                  </button>
               </div>

               {userModalTab === 'create' ? (
                  <form onSubmit={handleAddUser} className="space-y-4">
                    <div>
                       <label className="block text-xs font-semibold text-muted-foreground mb-1">Nome Completo</label>
                       <input 
                          type="text" 
                          value={newUser.name}
                          onChange={e => setNewUser({...newUser, name: e.target.value})}
                          className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-500/50 outline-none text-foreground h-[40px] text-sm"
                          required
                       />
                    </div>
                    
                    <div>
                       <label className="block text-xs font-semibold text-muted-foreground mb-1">E-mail Corporativo</label>
                       <input 
                          type="email" 
                          value={newUser.email}
                          onChange={e => setNewUser({...newUser, email: e.target.value})}
                          className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-500/50 outline-none text-foreground h-[40px] text-sm"
                          required
                       />
                    </div>

                    <div>
                       <label className="block text-xs font-semibold text-muted-foreground mb-1">Senha de Acesso</label>
                       <input 
                          type="password" 
                          value={newUser.password}
                          onChange={e => setNewUser({...newUser, password: e.target.value})}
                          className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-500/50 outline-none text-foreground h-[40px] text-sm"
                          placeholder="Senha provisória (ex: 123)"
                       />
                    </div>
                    
                    <div>
                       <label className="block text-xs font-semibold text-muted-foreground mb-1">Perfil de Permissão</label>
                       <select
                          value={newUser.role}
                          onChange={e => setNewUser({...newUser, role: e.target.value as 'MANAGER' | 'USER'})}
                          className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-500/50 outline-none text-foreground cursor-pointer h-[40px] text-sm"
                       >
                          <option value="USER">Atendente (Apenas contagem)</option>
                          <option value="MANAGER">Gestor (Controle total)</option>
                       </select>
                    </div>

                    <div className="flex gap-3 pt-3">
                       <button type="button" onClick={() => { setShowUserModal(false); setUserModalTab('create'); }} className="flex-1 px-4 py-2 border border-border text-foreground font-medium rounded-xl hover:bg-secondary transition-colors text-sm h-[40px]">Cancelar</button>
                       <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors shadow-md text-sm h-[40px]">Cadastrar</button>
                    </div>
                  </form>
               ) : (
                  <form onSubmit={handleLinkExistingUser} className="space-y-4">
                    <div>
                       <label className="block text-sm font-medium text-muted-foreground mb-1.5">Selecione o Usuário</label>
                       <select
                          value={selectedExistingUserId}
                          onChange={e => setSelectedExistingUserId(e.target.value)}
                          className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/50 outline-none text-foreground cursor-pointer h-[46px] text-sm truncate"
                          required
                       >
                          <option value="">Selecione um funcionário...</option>
                          {users
                            .filter(u => u.sectorId !== targetSectorForUser.id)
                            .map(u => (
                               <option key={u.id} value={u.id}>
                                 {u.name} ({u.email}) {u.sectorName ? `[${u.sectorName}]` : '[Sem Setor]'}
                               </option>
                            ))
                          }
                       </select>
                       <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
                          O colaborador selecionado será desvinculado de sua lotação anterior e transferido para este setor de forma automática.
                       </p>
                    </div>

                    <div className="flex gap-3 pt-4 border-t border-border/60">
                       <button type="button" onClick={() => { setShowUserModal(false); setUserModalTab('create'); setSelectedExistingUserId(''); }} className="flex-1 px-4 py-2.5 border border-border text-foreground font-medium rounded-xl hover:bg-secondary transition-colors text-sm h-[42px]">Cancelar</button>
                       <button type="submit" className="flex-1 px-4 py-2.5 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors shadow-md text-sm h-[42px]">Transferir Equipe</button>
                    </div>
                  </form>
               )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Fornecedor */}
      <AnimatePresence>
        {showSupplierModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
               initial={{ opacity: 0 }} 
               animate={{ opacity: 1 }} 
               exit={{ opacity: 0 }}
               className="absolute inset-0 bg-background/80 backdrop-blur-sm"
               onClick={() => {
                  setShowSupplierModal(false);
                  setEditingSupplier(null);
                  setSupplierForm({ name: '', deliveryDays: 0 });
               }}
            />
            <motion.div 
               initial={{ scale: 0.95, y: 20 }}
               animate={{ scale: 1, y: 0 }}
               exit={{ scale: 0.95, y: 20 }}
               className="bg-card border border-border rounded-2xl w-full max-w-sm shadow-2xl p-5 sm:p-6 relative z-10 max-h-[calc(100vh-2rem)] overflow-y-auto"
            >
               <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
               
               <div className="flex justify-between items-start mb-5 mt-2 w-full">
                  <div className="min-w-0 flex-1">
                     <h3 className="text-xl font-bold text-foreground truncate">{editingSupplier ? 'Editar Fornecedor' : 'Cadastrar Fornecedor'}</h3>
                     <p className="text-xs text-muted-foreground mt-0.5">Definição de canais de suprimentos</p>
                  </div>
                  <button type="button" onClick={() => { setShowSupplierModal(false); setEditingSupplier(null); setSupplierForm({ name: '', deliveryDays: 0 }); }} className="p-1 text-muted-foreground hover:bg-secondary rounded-lg shrink-0 transition-colors">
                     <X className="w-5 h-5" />
                  </button>
               </div>

               <form onSubmit={handleAddSupplier} className="space-y-4">
                  <div>
                     <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">Razão Social / Nome</label>
                     <input 
                        type="text" 
                        value={supplierForm.name}
                        onChange={e => setSupplierForm({...supplierForm, name: e.target.value})}
                        className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-500/50 outline-none text-foreground text-sm h-[40px]"
                        placeholder="Ex: Distribuidora de Alumínio S/A"
                        required
                     />
                  </div>

                  <div>
                     <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">Prazo de Entrega (Dias Úteis)</label>
                     <input 
                        type="number" 
                        min="0"
                        value={supplierForm.deliveryDays}
                        onChange={e => setSupplierForm({...supplierForm, deliveryDays: Number(e.target.value) || 0})}
                        className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-500/50 outline-none text-foreground text-sm font-bold h-[40px]"
                        required
                     />
                  </div>

                  <div className="flex gap-3 pt-3 border-t border-border/60 mt-5">
                     <button type="button" onClick={() => { setShowSupplierModal(false); setEditingSupplier(null); setSupplierForm({ name: '', deliveryDays: 0 }); }} className="flex-1 px-4 py-2 border border-border text-foreground font-medium rounded-xl hover:bg-secondary transition-colors text-sm h-[40px]">Cancelar</button>
                     <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors shadow-md text-sm h-[40px]">Salvar</button>
                  </div>
               </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deleteModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
               initial={{ opacity: 0 }} 
               animate={{ opacity: 1 }} 
               exit={{ opacity: 0 }}
               className="absolute inset-0 bg-background/80 backdrop-blur-sm"
               onClick={() => setDeleteModal(prev => ({ ...prev, isOpen: false }))}
            />
            <motion.div 
               initial={{ scale: 0.95, y: 20 }}
               animate={{ scale: 1, y: 0 }}
               exit={{ scale: 0.95, y: 20 }}
               className="bg-card border border-destructive/20 rounded-3xl w-full max-w-md shadow-2xl p-6 relative z-10 max-h-[calc(100vh-2rem)] overflow-y-auto"
            >
               <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-600 to-red-500"></div>
               
               <div className="flex flex-col items-center text-center mt-4 mb-6 w-full">
                  <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mb-4 shrink-0">
                     <AlertTriangle className="w-8 h-8" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground">Excluir Definitivamente?</h3>
                  <p className="text-sm text-muted-foreground mt-2 px-2 text-center leading-relaxed">
                     Você está prestes a deletar o {deleteModal.type === 'sector' ? 'setor' : 'produto'}{' '}
                     <span className="text-foreground font-semibold font-mono bg-secondary/60 px-2 py-0.5 rounded border border-border inline-block break-all">"{deleteModal.name}"</span>.
                  </p>
                  <div className="text-xs text-red-500 bg-red-500/5 border border-red-500/10 rounded-xl p-3 mt-4 font-medium flex items-start gap-2 max-w-sm text-left leading-relaxed">
                     <span>⚠️ Esta operação apagará permanentemente o registro de dados e todos os históricos e contagens vinculados a ele na nuvem sem possibilidade de restauração.</span>
                  </div>
               </div>

               <div className="flex gap-3 mt-6 w-full">
                  <button type="button" onClick={() => setDeleteModal(prev => ({ ...prev, isOpen: false }))} className="flex-1 px-4 py-2.5 border border-border text-foreground font-medium rounded-xl hover:bg-secondary transition-colors text-sm h-[42px]">Cancelar</button>
                  <button type="button" onClick={executeDelete} className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-medium rounded-xl transition-colors shadow-md text-sm h-[42px]">Excluir permanentemente</button>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
               className="bg-card border border-rose-500/30 rounded-2xl w-full max-w-md shadow-2xl p-6 relative z-10 max-h-[calc(100vh-2rem)] overflow-y-auto"
            >
               <div className="absolute top-0 left-0 w-full h-1 bg-rose-500"></div>
               
               <div className="flex items-start gap-4 mt-2">
                 <div className="p-3 bg-rose-500/10 rounded-xl text-rose-500 shrink-0">
                   <AlertTriangle className="w-6 h-6" />
                 </div>
                 <div className="flex-1 min-w-0">
                   <h3 className="text-lg font-bold text-foreground font-sans">Código SKU Duplicado</h3>
                   <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                     O código <span className="font-mono bg-rose-500/10 px-1.5 py-0.5 rounded text-rose-500 font-semibold">{duplicateModal.code}</span> já está sendo utilizado em outro material.
                   </p>
                 </div>
               </div>

               {duplicateModal.existingProduct && (
                 <div className="bg-rose-500/5 border border-rose-500/10 rounded-xl p-4 mt-4 space-y-2 text-xs sm:text-sm">
                   <p className="text-xs font-semibold text-rose-500 uppercase tracking-wider">Produto Localizado</p>
                   <div className="grid grid-cols-2 gap-y-1.5">
                     <span className="text-muted-foreground">Nome:</span>
                     <span className="font-semibold text-foreground text-right truncate">{duplicateModal.existingProduct.name}</span>
                     <span className="text-muted-foreground">Setor Original:</span>
                     <span className="font-semibold text-foreground text-right truncate">{sectors.find(s => s.id === duplicateModal.existingProduct?.sectorId)?.name || 'N/A'}</span>
                   </div>
                 </div>
               )}

               <div className="mt-6 w-full">
                 <button type="button" onClick={() => setDuplicateModal(null)} className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-medium rounded-xl transition-colors shadow-lg font-sans w-full text-sm h-[42px]">Ajustar Código</button>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
               className="bg-card border border-amber-500/30 rounded-2xl w-full max-w-md shadow-2xl p-6 relative overflow-hidden z-10 font-sans max-h-[90vh] overflow-y-auto"
            >
               <div className="absolute top-0 left-0 w-full h-1 bg-amber-500"></div>
               
               <div className="flex items-start gap-4 mt-2 w-full">
                 <div className="p-3 bg-amber-500/10 rounded-xl text-amber-500 shrink-0">
                   <AlertTriangle className="w-6 h-6" />
                 </div>
                 <div className="flex-1 min-w-0">
                   <h3 className="text-lg font-bold text-foreground">Habilitar Múltiplos Setores</h3>
                   <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                     O material <span className="font-semibold text-foreground break-words">"{sectorWarningModal.productName}"</span> já possui o vínculo principal no setor <span className="font-semibold text-foreground">"{sectorWarningModal.currentSectorName}"</span>.
                   </p>
                   <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                     Deseja espelhar a visualização deste produto para que ele também conste e seja gerenciado sob o escopo do setor <span className="font-semibold text-foreground">"{sectorWarningModal.newSectorName}"</span>?
                   </p>
                 </div>
               </div>

               <div className="mt-6 flex gap-3 w-full">
                 <button type="button" onClick={() => setSectorWarningModal(null)} className="flex-1 px-4 py-2.5 border border-border text-foreground font-medium rounded-xl hover:bg-secondary transition-colors text-sm h-[42px]">Cancelar</button>
                 <button type="button" onClick={confirmSectorAddition} className="flex-1 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-medium rounded-xl transition-colors shadow-sm text-sm h-[42px]">Vincular Compartilhamento</button>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {imageModalProduct && (
        <ProductImageModal 
          material={imageModalProduct} 
          onClose={() => setImageModalProduct(null)} 
          onUpdate={fetchData} 
        />
      )}

      {showScanner && (
        <BarcodeScanner 
          onResult={handleScanResult}
          onClose={() => {
            setShowScanner(false);
            setScanTarget(null);
          }}
        />
      )}
    </div>
  );
}