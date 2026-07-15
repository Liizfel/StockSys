import React, { useState, useEffect, useRef } from 'react';
import { apiFetch } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { Sector, Material, User, Supplier } from '../types';
import { FolderTree, Plus, Trash2, Edit3, Package, Users, ChevronDown, ChevronUp, UserPlus, AlertTriangle, Truck, Upload, Eye, Camera } from 'lucide-react';
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

  // Estados para Fornecedores
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

  // Estados para Edição de Produto
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

  // Estados do Modal de Exclusão
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
      setForm((prev: any) => ({ ...prev, additionalSectors: updated.join(',') }));
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

  // Manipuladores de Fornecedores
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
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-500">
      <div className="bg-card/50 backdrop-blur-md p-6 rounded-2xl border border-border shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
         <div>
            <h2 className="text-2xl font-bold text-foreground flex items-center gap-3">
               <FolderTree className="w-8 h-8 text-blue-500" /> Gerenciamento de Setores
            </h2>
            <p className="text-sm text-muted-foreground mt-1">Organize categorias, visualize produtos e a equipe delegada.</p>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         {/* Setores (takes 2 columns) */}
         <div className="lg:col-span-2 space-y-6">
            <div className="bg-card/50 backdrop-blur-md rounded-2xl border border-border shadow-sm overflow-hidden p-6">
        {isManager && (
          <form onSubmit={handleAddSector} className="flex gap-3 mb-6">
            <input 
              type="text" 
              placeholder="Nome do Novo Setor..." 
              value={newSectorName}
              onChange={e => setNewSectorName(e.target.value)}
              className="flex-1 bg-secondary/50 border border-border rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/50 outline-none transition-all placeholder:text-muted-foreground/50 text-foreground"
              required
            />
            <button 
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-5 py-3 rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-blue-500/25 shrink-0"
            >
              <Plus className="w-5 h-5" /> <span className="hidden sm:inline">Adicionar Setor</span>
            </button>
          </form>
        )}

        <div className="space-y-4">
          {sectors.map(sector => {
            const sectorMaterials = materials.filter(m => m.sectorId === sector.id);
            const sectorUsers = users.filter(u => u.sectorId === sector.id);
            const isExpanded = expandedSector === sector.id;

            return (
               <div key={sector.id} className="border border-border rounded-xl bg-card overflow-hidden shadow-sm transition-all">
                 <div className="p-4 px-5 flex items-center justify-between hover:bg-secondary/30 transition-colors cursor-pointer" onClick={() => toggleExpand(sector.id)}>
                   <div className="flex items-center gap-4 flex-1 min-w-0">
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
                           className="bg-background border border-blue-500 rounded px-3 py-1 outline-none font-medium text-foreground max-w-full"
                           onClick={e => e.stopPropagation()}
                         />
                      ) : (
                         <span className="font-semibold text-foreground text-lg truncate">{sector.name}</span>
                      )}
                      
                      <div className="flex gap-3 text-xs font-medium text-muted-foreground hidden md:flex">
                         <span className="flex items-center gap-1.5 bg-secondary/50 px-2 py-1 rounded-md"><Package className="w-3.5 h-3.5" /> {sectorMaterials.length} Produtos</span>
                         <span className="flex items-center gap-1.5 bg-secondary/50 px-2 py-1 rounded-md"><Users className="w-3.5 h-3.5" /> {sectorUsers.length} Usuários</span>
                      </div>
                   </div>
                   
                   <div className="flex items-center gap-1 sm:gap-2 ml-4 shrink-0">
                     {isManager && (
                       <>
                         <button 
                            onClick={(e) => { e.stopPropagation(); setTargetSectorForUser(sector); setShowUserModal(true); }}
                            className="p-2 text-muted-foreground hover:text-blue-500 transition-colors rounded-lg hover:bg-blue-500/10 hidden sm:block"
                            title="Adicionar Usuário"
                         >
                           <UserPlus className="w-4 h-4" />
                         </button>
                         <button 
                            onClick={(e) => { e.stopPropagation(); setTargetSectorForProduct(sector); setShowProductModal(true); }}
                            className="p-2 text-muted-foreground hover:text-emerald-500 transition-colors rounded-lg hover:bg-emerald-500/10 hidden sm:block"
                            title="Adicionar Produto"
                         >
                           <Plus className="w-4 h-4" />
                         </button>
                         <div className="w-px h-6 bg-border mx-1 hidden sm:block"></div>
                         <button 
                            onClick={(e) => { e.stopPropagation(); ignoreBlurRef.current = false; setEditingSector(sector); }}
                            className="p-2 text-muted-foreground hover:text-blue-500 transition-colors rounded-lg hover:bg-blue-500/10"
                            title="Editar Nome"
                         >
                           <Edit3 className="w-4 h-4" />
                         </button>
                         <button 
                            onClick={(e) => { e.stopPropagation(); handleDeleteSector(sector); }}
                            className="p-2 text-muted-foreground hover:text-red-500 transition-colors rounded-lg hover:bg-red-500/10"
                            title="Excluir Setor"
                         >
                           <Trash2 className="w-4 h-4" />
                         </button>
                         <div className="w-px h-6 bg-border mx-1"></div>
                       </>
                     )}
                     <button className="p-2 text-muted-foreground hover:bg-secondary rounded-lg transition-colors">
                       {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                     </button>
                   </div>
                 </div>

                 <AnimatePresence>
                   {isExpanded && (
                     <motion.div 
                        initial={{ height: 0 }}
                        animate={{ height: 'auto' }}
                        exit={{ height: 0 }}
                        className="overflow-hidden border-t border-border bg-secondary/10"
                     >
                        <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-8">
                           {/* Produtos */}
                           <div>
                              <div className="flex items-center justify-between mb-4">
                                <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                                   <Package className="w-4 h-4 text-emerald-500" /> Produtos Neste Setor
                                </h4>
                                <button 
                                  onClick={() => { setTargetSectorForProduct(sector); setShowProductModal(true); }}
                                  className="text-xs text-blue-500 hover:text-blue-600 font-medium bg-blue-500/10 px-2 py-1 rounded-md transition-colors"
                                >
                                  + Novo Produto
                                </button>
                              </div>
                              {sectorMaterials.length > 0 ? (
                                 <ul className="space-y-2">
                                    {sectorMaterials.map(mat => (
                                       <li 
                                          key={mat.id} 
                                          onClick={() => isManager && handleOpenEditProduct(mat)}
                                          className={`text-sm flex items-center justify-between bg-background border border-border px-3 py-2 rounded-xl group hover:border-emerald-500/30 transition-colors ${isManager ? 'cursor-pointer hover:bg-secondary/20' : ''}`}
                                       >
                                          <div className="flex-1 min-w-0 pr-4">
                                             <div className="font-medium text-foreground truncate">{mat.name}</div>
                                             <div className="text-xs text-muted-foreground font-mono">{mat.code}</div>
                                          </div>
                                          <div className="flex items-center gap-4 shrink-0">
                                             <span className="font-semibold text-foreground bg-secondary px-2 py-1 rounded-md">{mat.quantity} {formatUnit(mat.unit)}</span>
                                             <button 
                                                type="button"
                                                onClick={(e) => { e.stopPropagation(); setImageModalProduct(mat); }}
                                                className="text-amber-500 hover:text-amber-400 p-1.5 rounded-lg hover:bg-amber-500/10 transition-colors inline-flex items-center"
                                                title="Visualizar Foto"
                                             >
                                                <Eye className="w-4 h-4" />
                                             </button>
                                             {isManager && (
                                                 <button 
                                                    onClick={(e) => { e.stopPropagation(); handleOpenEditProduct(mat); }}
                                                    className="text-muted-foreground hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                                    title="Editar Produto"
                                                 >
                                                    <Edit3 className="w-4 h-4" />
                                                 </button>
                                              )}
                                             <button 
                                                onClick={(e) => { e.stopPropagation(); handleDeleteProduct(mat); }}
                                                className="text-muted-foreground hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                                title="Excluir Produto"
                                             >
                                                <Trash2 className="w-4 h-4" />
                                             </button>
                                          </div>
                                       </li>
                                    ))}
                                 </ul>
                              ) : (
                                 <div className="bg-background border border-dashed border-border rounded-xl p-4 text-center">
                                    <p className="text-sm text-muted-foreground">Nenhum produto vinculado.</p>
                                 </div>
                              )}
                           </div>
                           
                           {/* Usuários */}
                           <div>
                              <div className="flex items-center justify-between mb-4">
                                 <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                                    <Users className="w-4 h-4 text-blue-500" /> Equipe Delegada
                                 </h4>
                                 <button 
                                   onClick={() => { setTargetSectorForUser(sector); setShowUserModal(true); }}
                                   className="text-xs text-blue-500 hover:text-blue-600 font-medium bg-blue-500/10 px-2 py-1 rounded-md transition-colors"
                                 >
                                   + Novo Usuário
                                 </button>
                              </div>
                              {sectorUsers.length > 0 ? (
                                 <ul className="space-y-2">
                                    {sectorUsers.map(usr => (
                                       <li key={usr.id} className="text-sm flex items-center gap-3 bg-background border border-border px-3 py-2 rounded-xl group hover:border-blue-500/30 transition-colors">
                                          <div className="w-8 h-8 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center text-sm font-bold shrink-0">
                                             {usr.name.charAt(0).toUpperCase()}
                                          </div>
                                          <div className="flex-1 min-w-0">
                                             <div className="font-medium text-foreground truncate">{usr.name}</div>
                                             <div className="text-xs text-muted-foreground truncate">{usr.email}</div>
                                          </div>
                                          <button 
                                             onClick={() => handleRemoveUserFromSector(usr)}
                                             className="text-muted-foreground hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                                             title="Remover do Setor"
                                          >
                                             <Trash2 className="w-4 h-4" />
                                          </button>
                                       </li>
                                    ))}
                                 </ul>
                              ) : (
                                 <div className="bg-background border border-dashed border-border rounded-xl p-4 text-center">
                                    <p className="text-sm text-muted-foreground">Nenhum colaborador alocado.</p>
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
            <div className="p-12 border-2 border-dashed border-border rounded-2xl text-center flex flex-col items-center">
               <FolderTree className="w-12 h-12 text-muted-foreground mb-4 opacity-50" />
               <h3 className="text-lg font-semibold text-foreground mb-1">Nenhum Setor Cadastrado</h3>
               <p className="text-muted-foreground">Crie seu primeiro setor para começar a organizar produtos e equipes.</p>
            </div>
          )}
        </div>
      </div>
         </div>

         {/* Painel de Fornecedores (takes 1 column) */}
         <div className="space-y-6">
            <div className="bg-card/50 backdrop-blur-md rounded-2xl border border-border shadow-sm p-6">
               <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-foreground flex items-center gap-2 font-sans">
                     <Truck className="w-5 h-5 text-blue-500" /> Fornecedores
                  </h3>
                  {isManager && (
                     <button
                        onClick={() => {
                           setEditingSupplier(null);
                           setSupplierForm({ name: '', deliveryDays: 0 });
                           setShowSupplierModal(true);
                        }}
                        className="p-1.5 text-blue-500 hover:bg-blue-500/10 rounded-lg transition-colors flex items-center gap-1 text-xs font-semibold font-sans"
                     >
                        <Plus className="w-4 h-4" /> Novo
                     </button>
                  )}
               </div>

               <p className="text-xs text-muted-foreground mb-4 font-sans">
                  Cadastre e gerencie fornecedores para associá-los aos materiais e monitorar prazos de entrega estimados.
               </p>

               <div className="space-y-3">
                  {suppliers.length === 0 ? (
                     <div className="text-center py-8 text-sm text-muted-foreground bg-secondary/20 rounded-xl border border-dashed border-border font-sans">
                        Nenhum fornecedor cadastrado.
                     </div>
                  ) : (
                     suppliers.map(sup => (
                        <div key={sup.id} className="p-4 bg-card border border-border rounded-xl shadow-sm hover:shadow-md transition-all flex items-center justify-between font-sans">
                           <div className="min-w-0 flex-1 pr-2">
                              <h4 className="font-semibold text-sm text-foreground truncate">{sup.name}</h4>
                              <p className="text-xs text-muted-foreground mt-0.5">Prazo: {sup.deliveryDays} {sup.deliveryDays === 1 ? 'dia útil' : 'dias úteis'}</p>
                           </div>
                           {isManager && (
                              <div className="flex items-center gap-1 shrink-0">
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

      {/* Modal Novo Produto no Setor */}
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
               className="bg-card border border-border rounded-2xl w-full max-w-2xl shadow-2xl p-6 relative z-10 max-h-[calc(100vh-4rem)] overflow-y-auto scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent"
            >
               <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-emerald-400"></div>
               
               <div className="mb-6 mt-2">
                  <h3 className="text-xl font-bold text-foreground">Novo Produto</h3>
                  <p className="text-sm text-muted-foreground mt-1">Adicionando ao setor: <span className="font-medium text-foreground">{targetSectorForProduct.name}</span></p>
               </div>

               <form onSubmit={handleAddProduct} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                     {/* Coluna Esquerda */}
                     <div className="space-y-4">
                        <div>
                           <label className="block text-sm font-medium text-muted-foreground mb-1.5">Código Único (SKU)</label>
                           <input 
                              type="text" 
                              value={newProduct.code}
                              onChange={e => setNewProduct({...newProduct, code: e.target.value})}
                              className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-emerald-500/50 outline-none text-foreground font-mono text-sm"
                              required
                           />
                        </div>
                        
                        <div>
                           <label className="block text-sm font-medium text-muted-foreground mb-1.5">Nome do Produto</label>
                           <input 
                              type="text" 
                              value={newProduct.name}
                              onChange={e => setNewProduct({...newProduct, name: e.target.value})}
                              className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-emerald-500/50 outline-none text-foreground text-sm"
                              required
                           />
                        </div>

                        <div>
                           <label className="block text-sm font-medium text-muted-foreground mb-1.5">Código de Barras</label>
                           <div className="relative flex items-center">
                              <input 
                                 type="text" 
                                 value={newProduct.codigoBarras || ''}
                                 onChange={e => setNewProduct({...newProduct, codigoBarras: e.target.value})}
                                 className="w-full bg-secondary/50 border border-border rounded-xl pl-4 pr-12 py-2.5 focus:ring-2 focus:ring-emerald-500/50 outline-none text-foreground text-sm font-mono"
                                 placeholder="Ex: 7891234567890"
                              />
                              <button
                                 type="button"
                                 onClick={() => {
                                    setScanTarget('newProduct');
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
                           <label className="block text-sm font-medium text-muted-foreground mb-1.5 font-sans">Fornecedor (Opcional)</label>
                           <select 
                              value={newProduct.supplierId}
                              onChange={e => setNewProduct({...newProduct, supplierId: e.target.value})}
                              className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-emerald-500/50 outline-none text-foreground cursor-pointer text-sm"
                           >
                              <option value="">Nenhum fornecedor</option>
                              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                           </select>
                        </div>
                     </div>

                     {/* Coluna Direita */}
                     <div className="space-y-4">
                        <div>
                           <label className="block text-sm font-medium text-muted-foreground mb-1.5">Origem</label>
                           <input 
                              type="text" 
                              value={newProduct.origin || ''}
                              onChange={e => setNewProduct({...newProduct, origin: e.target.value})}
                              className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-emerald-500/50 outline-none text-foreground text-sm"
                              placeholder="Ex: Nacional / Importado"
                           />
                        </div>

                        <div>
                           <label className="block text-sm font-medium text-muted-foreground mb-1.5 font-sans">Prazo de Entrega (Dias - Opcional)</label>
                           <input 
                              type="number" 
                              min="0"
                              placeholder="Ex: 5"
                              value={newProduct.supplierDeliveryDays}
                              onChange={e => setNewProduct({...newProduct, supplierDeliveryDays: e.target.value})}
                              className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-emerald-500/50 outline-none text-foreground text-sm"
                           />
                        </div>

                        <div>
                           <label className="block text-sm font-medium text-muted-foreground mb-1.5">Imagem do Produto (URL ou upload local)</label>
                           <div className="flex gap-2">
                              <input 
                                 type="text" 
                                 value={newProduct.imageUrl || ''}
                                 onChange={e => setNewProduct({...newProduct, imageUrl: e.target.value})}
                                 className="flex-1 bg-secondary/50 border border-border rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-emerald-500/50 outline-none text-foreground text-sm"
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
                                             setNewProduct({...newProduct, imageUrl: reader.result as string});
                                          };
                                          reader.readAsDataURL(file);
                                       }
                                    }}
                                 />
                              </label>
                           </div>
                           {newProduct.imageUrl && (
                              <div className="mt-2 relative w-12 h-12 border border-border rounded-lg overflow-hidden bg-secondary">
                                 <img src={newProduct.imageUrl} alt="Preview" className="w-full h-full object-cover" />
                                 <button 
                                    type="button" 
                                    onClick={() => setNewProduct({...newProduct, imageUrl: ''})}
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
                  <div className="border-t border-border/50 pt-4 space-y-4">
                     <div className="grid grid-cols-2 gap-4">
                        <div>
                           <label className="block text-sm font-medium text-muted-foreground mb-1.5">Unidade</label>
                           <select 
                              value={newProduct.unit}
                              onChange={e => setNewProduct({...newProduct, unit: e.target.value})}
                              className="w-full bg-secondary/50 border border-border rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-emerald-500/50 outline-none text-foreground cursor-pointer text-sm"
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
                           <label className="block text-sm font-medium text-muted-foreground mb-1.5">Mínimo</label>
                           <input 
                              type="number" 
                              min="0"
                              value={newProduct.estoqueMinimo}
                              onChange={e => setNewProduct({...newProduct, estoqueMinimo: e.target.value ? parseInt(e.target.value) : ''})}
                              className="w-full bg-secondary/50 border border-border rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-emerald-500/50 outline-none text-foreground font-bold text-sm"
                              required
                           />
                        </div>
                     </div>

                     {/* Configuração de Destino de Estoque */}
                     <div className="space-y-3">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Destino de Estoque</span>
                        <div className="flex flex-col sm:flex-row gap-4 bg-secondary/20 p-3 rounded-xl border border-border/50">
                           <label className="flex items-start gap-2.5 cursor-pointer flex-1">
                              <input
                                 type="checkbox"
                                 checked={newProduct.isPulmao !== false}
                                 onChange={e => setNewProduct(prev => ({ ...prev, isPulmao: e.target.checked }))}
                                 className="mt-1 rounded text-emerald-500 bg-secondary/50 border-border focus:ring-emerald-500 w-4 h-4 shrink-0"
                              />
                              <div className="flex flex-col">
                                 <span className="text-sm font-medium text-foreground flex items-center gap-1">📦 Estoque Pulmão</span>
                                 <span className="text-xxs text-muted-foreground">Armazenamento principal de reserva.</span>
                              </div>
                           </label>

                           <label className="flex items-start gap-2.5 cursor-pointer flex-1">
                              <input
                                 type="checkbox"
                                 checked={newProduct.isGiro || false}
                                 onChange={e => setNewProduct(prev => ({ ...prev, isGiro: e.target.checked }))}
                                 className="mt-1 rounded text-emerald-500 bg-secondary/50 border-border focus:ring-emerald-500 w-4 h-4 shrink-0"
                              />
                               <div className="flex flex-col">
                                 <span className="text-sm font-medium text-foreground flex items-center gap-1">⚡ Giro do Dia</span>
                                 <span className="text-xxs text-muted-foreground">Uso rápido para consumo diário.</span>
                              </div>
                           </label>
                        </div>
                     </div>

                     <div className="grid grid-cols-2 gap-4">
                        {(newProduct.isPulmao !== false) && (
                           <div>
                              <label className="block text-sm font-medium text-muted-foreground mb-1.5">Qtd. Estoque Pulmão 📦</label>
                              <input 
                                 type="number" 
                                 min="0"
                                 value={newProduct.quantity}
                                 onChange={e => setNewProduct({...newProduct, quantity: e.target.value ? parseInt(e.target.value) : 0})}
                                 className="w-full bg-secondary/50 border border-border rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-emerald-500/50 outline-none text-foreground font-bold text-sm border-emerald-500/20 focus:border-emerald-500"
                                 required
                              />
                           </div>
                        )}
                        {newProduct.isGiro && (
                           <div>
                               <label className="block text-sm font-medium text-muted-foreground mb-1.5">Qtd. Giro do Dia ⚡</label>
                               <input 
                                  type="number" 
                                  min="0"
                                  value={newProduct.quantityGiro}
                                  onChange={e => setNewProduct({...newProduct, quantityGiro: e.target.value ? parseInt(e.target.value) : 0})}
                                  className="w-full bg-secondary/50 border border-border rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-emerald-500/50 outline-none text-foreground font-bold text-sm border-emerald-500/20 focus:border-emerald-500"
                                  required
                               />
                           </div>
                        )}
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
                              value={newProduct.area}
                              onChange={e => setNewProduct({...newProduct, area: e.target.value})}
                              className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-emerald-500/50 outline-none text-foreground text-sm"
                              placeholder="Ex: Área A"
                           />
                        </div>
                        <div>
                           <label className="block text-xs font-medium text-muted-foreground mb-1">Estante</label>
                           <input 
                              type="text" 
                              value={newProduct.estante}
                              onChange={e => setNewProduct({...newProduct, estante: e.target.value})}
                              className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-emerald-500/50 outline-none text-foreground text-sm"
                              placeholder="Ex: Estante 3"
                           />
                        </div>
                        <div>
                           <label className="block text-xs font-medium text-muted-foreground mb-1">Prateleira</label>
                           <input 
                              type="text" 
                              value={newProduct.prateleira}
                              onChange={e => setNewProduct({...newProduct, prateleira: e.target.value})}
                              className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-emerald-500/50 outline-none text-foreground text-sm"
                              placeholder="Ex: Prateleira B"
                           />
                        </div>
                        <div>
                           <label className="block text-xs font-medium text-muted-foreground mb-1">Palete</label>
                           <input 
                              type="text" 
                              value={newProduct.palete}
                              onChange={e => setNewProduct({...newProduct, palete: e.target.value})}
                              className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-emerald-500/50 outline-none text-foreground text-sm"
                              placeholder="Ex: Palete 12"
                           />
                        </div>
                     </div>
                     <AnimatePresence>
                        {newProduct.palete && (
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
                                 value={newProduct.paleteQty}
                                 onChange={e => setNewProduct({...newProduct, paleteQty: e.target.value ? parseInt(e.target.value) : ''})}
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
                           .filter(s => s.id !== targetSectorForProduct?.id)
                           .map(s => {
                              const isChecked = (newProduct.additionalSectors || '')
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
                        {sectors.filter(s => s.id !== targetSectorForProduct?.id).length === 0 && (
                           <p className="text-xs text-muted-foreground italic p-2 col-span-2">Nenhum outro setor disponível</p>
                        )}
                     </div>
                  </div>

                  <div className="flex gap-3 pt-4 border-t border-border/50">
                     <button 
                        type="button" 
                        onClick={() => setShowProductModal(false)}
                        className="flex-1 px-4 py-3 text-muted-foreground font-medium rounded-xl hover:bg-secondary transition-colors text-sm"
                     >
                        Cancelar
                     </button>
                     <button 
                        type="submit" 
                        className="flex-1 px-4 py-3 bg-emerald-600 text-white font-medium rounded-xl hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-500/25 text-sm"
                     >
                        Salvar Produto
                     </button>
                  </div>
               </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Novo Usuário no Setor */}
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
               className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl p-6 relative z-10 max-h-[calc(100vh-2rem)] overflow-y-auto scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent"
            >
               <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
               
               <div className="mb-6 mt-2">
                  <h3 className="text-xl font-bold text-foreground font-sans">Novo Colaborador</h3>
                  <p className="text-sm text-muted-foreground mt-1">Alocando ao setor: <span className="font-medium text-foreground">{targetSectorForUser.name}</span></p>
               </div>

               <div className="flex border-b border-border mb-6">
                  <button
                     type="button"
                     className={`flex-1 pb-3 text-sm font-semibold transition-colors relative ${userModalTab === 'create' ? 'text-blue-500' : 'text-muted-foreground hover:text-foreground'}`}
                     onClick={() => setUserModalTab('create')}
                  >
                     Cadastrar Novo
                     {userModalTab === 'create' && <motion.div layoutId="userModalActiveTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />}
                  </button>
                  <button
                     type="button"
                     className={`flex-1 pb-3 text-sm font-semibold transition-colors relative ${userModalTab === 'link' ? 'text-blue-500' : 'text-muted-foreground hover:text-foreground'}`}
                     onClick={() => setUserModalTab('link')}
                  >
                     Vincular Existente
                     {userModalTab === 'link' && <motion.div layoutId="userModalActiveTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />}
                  </button>
               </div>

               {userModalTab === 'create' ? (
                  <form onSubmit={handleAddUser} className="space-y-4">
                    <div>
                       <label className="block text-sm font-medium text-muted-foreground mb-1.5">Nome Completo</label>
                       <input 
                          type="text" 
                          value={newUser.name}
                          onChange={e => setNewUser({...newUser, name: e.target.value})}
                          className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/50 outline-none text-foreground"
                          required
                       />
                    </div>
                    
                    <div>
                       <label className="block text-sm font-medium text-muted-foreground mb-1.5">E-mail de Acesso</label>
                       <input 
                          type="email" 
                          value={newUser.email}
                          onChange={e => setNewUser({...newUser, email: e.target.value})}
                          className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/50 outline-none text-foreground"
                          required
                       />
                    </div>

                    <div>
                       <label className="block text-sm font-medium text-muted-foreground mb-1.5">Senha Provisória</label>
                       <input 
                          type="password" 
                          value={newUser.password}
                          onChange={e => setNewUser({...newUser, password: e.target.value})}
                          className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/50 outline-none text-foreground"
                          placeholder="Padrão: 123"
                       />
                    </div>
                    
                    <div>
                       <label className="block text-sm font-medium text-muted-foreground mb-1.5">Perfil de Acesso</label>
                       <select
                          value={newUser.role}
                          onChange={e => setNewUser({...newUser, role: e.target.value as 'MANAGER' | 'USER'})}
                          className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/50 outline-none text-foreground cursor-pointer"
                       >
                          <option value="USER">Atendente (Contagem)</option>
                          <option value="MANAGER">Gestor (Acesso Total)</option>
                       </select>
                    </div>

                    <div className="flex gap-3 pt-4">
                       <button 
                          type="button" 
                          onClick={() => { setShowUserModal(false); setUserModalTab('create'); }}
                          className="flex-1 px-4 py-3 text-muted-foreground font-medium rounded-xl hover:bg-secondary transition-colors"
                       >
                          Cancelar
                       </button>
                       <button 
                          type="submit" 
                          className="flex-1 px-4 py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/25"
                       >
                          Adicionar Usuário
                       </button>
                    </div>
                  </form>
               ) : (
                  <form onSubmit={handleLinkExistingUser} className="space-y-4">
                    <div>
                       <label className="block text-sm font-medium text-muted-foreground mb-1.5">Selecione o Colaborador</label>
                       <select
                          value={selectedExistingUserId}
                          onChange={e => setSelectedExistingUserId(e.target.value)}
                          className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/50 outline-none text-foreground cursor-pointer"
                          required
                       >
                          <option value="">Selecione...</option>
                          {users
                            .filter(u => u.sectorId !== targetSectorForUser.id)
                            .map(u => (
                               <option key={u.id} value={u.id}>
                                 {u.name} ({u.email}) {u.sectorName ? `[Setor: ${u.sectorName}]` : '[Sem Setor]'}
                               </option>
                            ))
                          }
                       </select>
                       <p className="text-xs text-muted-foreground mt-2">
                         O colaborador selecionado será transferido ou associado a este setor automaticamente.
                       </p>
                    </div>

                    <div className="flex gap-3 pt-6">
                       <button 
                          type="button" 
                          onClick={() => { setShowUserModal(false); setUserModalTab('create'); setSelectedExistingUserId(''); }}
                          className="flex-1 px-4 py-3 text-muted-foreground font-medium rounded-xl hover:bg-secondary transition-colors"
                       >
                          Cancelar
                       </button>
                       <button 
                          type="submit" 
                          className="flex-1 px-4 py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/25"
                       >
                          Vincular Colaborador
                       </button>
                    </div>
                  </form>
               )}
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
               className="bg-card border border-border rounded-2xl w-full max-w-2xl shadow-2xl p-6 relative z-10 max-h-[calc(100vh-4rem)] overflow-y-auto scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent"
            >
               <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
               
               <div className="mb-6 mt-2">
                  <h3 className="text-xl font-bold text-foreground">Editar Produto</h3>
                  <p className="text-sm text-muted-foreground mt-1">Atualizando dados cadastrados</p>
               </div>

               <form onSubmit={handleEditProductSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                     {/* Coluna Esquerda */}
                     <div className="space-y-4">
                        <div>
                           <label className="block text-sm font-medium text-muted-foreground mb-1.5">Código Único (SKU)</label>
                           <input 
                              type="text" 
                              value={editProductForm.code}
                              onChange={e => setEditProductForm({...editProductForm, code: e.target.value})}
                              className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500/50 outline-none text-foreground font-mono text-sm"
                              required
                           />
                        </div>
                        
                        <div>
                           <label className="block text-sm font-medium text-muted-foreground mb-1.5">Nome do Produto</label>
                           <input 
                              type="text" 
                              value={editProductForm.name}
                              onChange={e => setEditProductForm({...editProductForm, name: e.target.value})}
                              className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500/50 outline-none text-foreground text-sm"
                              required
                           />
                        </div>

                        <div>
                           <label className="block text-sm font-medium text-muted-foreground mb-1.5">Código de Barras</label>
                           <div className="relative flex items-center">
                              <input 
                                 type="text" 
                                 value={editProductForm.codigoBarras || ''}
                                 onChange={e => setEditProductForm({...editProductForm, codigoBarras: e.target.value})}
                                 className="w-full bg-secondary/50 border border-border rounded-xl pl-4 pr-12 py-2.5 focus:ring-2 focus:ring-blue-500/50 outline-none text-foreground text-sm font-mono"
                                 placeholder="Ex: 7891234567890"
                              />
                              <button
                                 type="button"
                                 onClick={() => {
                                    setScanTarget('editProduct');
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
                              value={editProductForm.sectorId}
                              onChange={e => setEditProductForm({...editProductForm, sectorId: e.target.value})}
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
                              value={editProductForm.origin || ''}
                              onChange={e => setEditProductForm({...editProductForm, origin: e.target.value})}
                              className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500/50 outline-none text-foreground text-sm"
                              placeholder="Ex: Nacional / Importado"
                           />
                        </div>

                        <div>
                           <label className="block text-sm font-medium text-muted-foreground mb-1.5 font-sans">Fornecedor (Opcional)</label>
                           <select 
                              value={editProductForm.supplierId}
                              onChange={e => setEditProductForm({...editProductForm, supplierId: e.target.value})}
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
                              value={editProductForm.supplierDeliveryDays}
                              onChange={e => setEditProductForm({...editProductForm, supplierDeliveryDays: e.target.value})}
                              className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500/50 outline-none text-foreground text-sm"
                           />
                        </div>

                        <div>
                           <label className="block text-sm font-medium text-muted-foreground mb-1.5">Imagem do Produto (URL ou upload local)</label>
                           <div className="flex gap-2">
                              <input 
                                 type="text" 
                                 value={editProductForm.imageUrl || ''}
                                 onChange={e => setEditProductForm({...editProductForm, imageUrl: e.target.value})}
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
                                             setEditProductForm({...editProductForm, imageUrl: reader.result as string});
                                          };
                                          reader.readAsDataURL(file);
                                       }
                                    }}
                                 />
                              </label>
                           </div>
                           {editProductForm.imageUrl && (
                              <div className="mt-2 relative w-12 h-12 border border-border rounded-lg overflow-hidden bg-secondary">
                                 <img src={editProductForm.imageUrl} alt="Preview" className="w-full h-full object-cover" />
                                 <button 
                                    type="button" 
                                    onClick={() => setEditProductForm({...editProductForm, imageUrl: ''})}
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
                  <div className="border-t border-border/50 pt-4 space-y-4">
                     <div className="grid grid-cols-2 gap-4">
                        <div>
                           <label className="block text-sm font-medium text-muted-foreground mb-1.5">Unidade</label>
                           <select 
                              value={editProductForm.unit}
                              onChange={e => setEditProductForm({...editProductForm, unit: e.target.value})}
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
                           <label className="block text-sm font-medium text-muted-foreground mb-1.5">Mínimo</label>
                           <input 
                              type="number" 
                              min="0"
                              value={editProductForm.estoqueMinimo}
                              onChange={e => setEditProductForm({...editProductForm, estoqueMinimo: e.target.value ? parseInt(e.target.value) : ''})}
                              className="w-full bg-secondary/50 border border-border rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-blue-500/50 outline-none text-foreground font-bold text-sm"
                              required
                           />
                        </div>
                     </div>

                     {/* Configuração de Destino de Estoque */}
                     <div className="space-y-3">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Destino de Estoque</span>
                        <div className="flex flex-col sm:flex-row gap-4 bg-secondary/20 p-3 rounded-xl border border-border/50">
                           <label className="flex items-start gap-2.5 cursor-pointer flex-1">
                              <input
                                 type="checkbox"
                                 checked={editProductForm.isPulmao !== false}
                                 onChange={e => setEditProductForm(prev => ({ ...prev, isPulmao: e.target.checked }))}
                                 className="mt-1 rounded text-blue-500 bg-secondary/50 border-border focus:ring-blue-500 w-4 h-4 shrink-0"
                              />
                              <div className="flex flex-col">
                                 <span className="text-sm font-medium text-foreground flex items-center gap-1">📦 Estoque Pulmão</span>
                                 <span className="text-xxs text-muted-foreground">Armazenamento principal de reserva.</span>
                              </div>
                           </label>

                           <label className="flex items-start gap-2.5 cursor-pointer flex-1">
                              <input
                                 type="checkbox"
                                 checked={editProductForm.isGiro || false}
                                 onChange={e => setEditProductForm(prev => ({ ...prev, isGiro: e.target.checked }))}
                                 className="mt-1 rounded text-blue-500 bg-secondary/50 border-border focus:ring-blue-500 w-4 h-4 shrink-0"
                              />
                               <div className="flex flex-col">
                                 <span className="text-sm font-medium text-foreground flex items-center gap-1">⚡ Giro do Dia</span>
                                 <span className="text-xxs text-muted-foreground">Uso rápido para consumo diário.</span>
                              </div>
                           </label>
                        </div>
                     </div>

                     <div className="grid grid-cols-2 gap-4">
                        {(editProductForm.isPulmao !== false) && (
                           <div>
                              <label className="block text-sm font-medium text-muted-foreground mb-1.5">Qtd. Estoque Pulmão 📦</label>
                              <input 
                                 type="number" 
                                 min="0"
                                 value={editProductForm.quantity}
                                 onChange={e => setEditProductForm({...editProductForm, quantity: e.target.value ? parseInt(e.target.value) : 0})}
                                 className="w-full bg-secondary/50 border border-border rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-blue-500/50 outline-none text-foreground font-bold text-sm border-blue-500/20 focus:border-blue-500"
                                 required
                              />
                           </div>
                        )}
                        {editProductForm.isGiro && (
                           <div>
                               <label className="block text-sm font-medium text-muted-foreground mb-1.5">Qtd. Giro do Dia ⚡</label>
                               <input 
                                  type="number" 
                                  min="0"
                                  value={editProductForm.quantityGiro}
                                  onChange={e => setEditProductForm({...editProductForm, quantityGiro: e.target.value ? parseInt(e.target.value) : 0})}
                                  className="w-full bg-secondary/50 border border-border rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-blue-500/50 outline-none text-foreground font-bold text-sm border-blue-500/20 focus:border-blue-500"
                                  required
                               />
                           </div>
                        )}
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
                              value={editProductForm.area}
                              onChange={e => setEditProductForm({...editProductForm, area: e.target.value})}
                              className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500/50 outline-none text-foreground text-sm"
                              placeholder="Ex: Área A"
                           />
                        </div>
                        <div>
                           <label className="block text-xs font-medium text-muted-foreground mb-1">Estante</label>
                           <input 
                              type="text" 
                              value={editProductForm.estante}
                              onChange={e => setEditProductForm({...editProductForm, estante: e.target.value})}
                              className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500/50 outline-none text-foreground text-sm"
                              placeholder="Ex: Estante 3"
                           />
                        </div>
                        <div>
                           <label className="block text-xs font-medium text-muted-foreground mb-1">Prateleira</label>
                           <input 
                              type="text" 
                              value={editProductForm.prateleira}
                              onChange={e => setEditProductForm({...editProductForm, prateleira: e.target.value})}
                              className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500/50 outline-none text-foreground text-sm"
                              placeholder="Ex: Prateleira B"
                           />
                        </div>
                        <div>
                           <label className="block text-xs font-medium text-muted-foreground mb-1">Palete</label>
                           <input 
                              type="text" 
                              value={editProductForm.palete}
                              onChange={e => setEditProductForm({...editProductForm, palete: e.target.value})}
                              className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500/50 outline-none text-foreground text-sm"
                              placeholder="Ex: Palete 12"
                           />
                        </div>
                     </div>
                     <AnimatePresence>
                        {editProductForm.palete && (
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
                                 value={editProductForm.paleteQty}
                                 onChange={e => setEditProductForm({...editProductForm, paleteQty: e.target.value ? parseInt(e.target.value) : ''})}
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
                           .filter(s => s.id !== editProductForm.sectorId)
                           .map(s => {
                              const isChecked = (editProductForm.additionalSectors || '')
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
                        {sectors.filter(s => s.id !== editProductForm.sectorId).length === 0 && (
                           <p className="text-xs text-muted-foreground italic p-2 col-span-2">Nenhum outro setor disponível</p>
                        )}
                     </div>
                  </div>

                  <div className="flex gap-3 pt-4 border-t border-border/50">
                     <button 
                        type="button" 
                        onClick={() => setShowEditProductModal(false)}
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

      {/* Modal de Confirmação de Exclusão Definitiva */}
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
               className="bg-card border border-destructive/20 rounded-3xl w-full max-w-md shadow-2xl p-6 relative z-10 max-h-[calc(100vh-2rem)] overflow-y-auto scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent"
            >
               <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-600 to-red-500"></div>
               
               <div className="flex flex-col items-center text-center mt-4 mb-6">
                  <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mb-4">
                     <AlertTriangle className="w-8 h-8" />
                  </div>
                  <h3 className="text-2xl font-bold text-foreground">Excluir Definitivamente?</h3>
                  <p className="text-sm text-muted-foreground mt-2 px-2 text-center">
                     Você está prestes a excluir o {deleteModal.type === 'sector' ? 'setor' : 'produto'}{' '}
                     <span className="text-foreground font-semibold font-mono bg-secondary/50 px-2 py-0.5 rounded border border-border">"{deleteModal.name}"</span>.
                  </p>
                  <p className="text-xs text-red-500 bg-red-500/5 border border-red-500/10 rounded-xl p-3 mt-4 font-medium flex items-center gap-2 max-w-sm text-left leading-normal">
                     <span>⚠️ Esta ação é 100% definitiva e irreversível. Todos os dados vinculados, históricos e registros associados serão removidos permanentemente do banco de dados e não poderão ser recuperados.</span>
                  </p>
               </div>

               <div className="flex gap-3 mt-6">
                  <button 
                     type="button" 
                     onClick={() => setDeleteModal(prev => ({ ...prev, isOpen: false }))}
                     className="flex-1 px-4 py-3 border border-border text-foreground font-medium rounded-xl hover:bg-secondary transition-colors"
                  >
                     Cancelar
                  </button>
                  <button 
                     type="button" 
                     onClick={executeDelete}
                     className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white font-medium rounded-xl transition-colors shadow-lg shadow-red-500/25 flex items-center justify-center gap-2"
                  >
                     Excluir
                  </button>
               </div>
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
               className="bg-card border border-border rounded-2xl w-full max-w-sm shadow-2xl p-6 relative z-10 max-h-[calc(100vh-2rem)] overflow-y-auto scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent"
            >
               <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
               
               <div className="mb-6 mt-2">
                  <h3 className="text-xl font-bold text-foreground font-sans">{editingSupplier ? 'Editar Fornecedor' : 'Novo Fornecedor'}</h3>
                  <p className="text-xs text-muted-foreground mt-1 font-sans">
                     {editingSupplier ? 'Atualize os dados do fornecedor' : 'Cadastre um novo fornecedor'}
                  </p>
               </div>

               <form onSubmit={handleAddSupplier} className="space-y-4">
                  <div>
                     <label className="block text-sm font-medium text-muted-foreground mb-1.5 font-sans">Nome do Fornecedor</label>
                     <input 
                        type="text" 
                        value={supplierForm.name}
                        onChange={e => setSupplierForm({...supplierForm, name: e.target.value})}
                        className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/50 outline-none text-foreground font-sans"
                        required
                     />
                  </div>

                  <div>
                     <label className="block text-sm font-medium text-muted-foreground mb-1.5 font-sans">Prazo de Entrega Estimado (Dias)</label>
                     <input 
                        type="number" 
                        min="0"
                        value={supplierForm.deliveryDays}
                        onChange={e => setSupplierForm({...supplierForm, deliveryDays: Number(e.target.value) || 0})}
                        className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/50 outline-none text-foreground font-bold font-sans"
                        required
                     />
                  </div>

                  <div className="flex gap-3 pt-4">
                     <button 
                        type="button" 
                        onClick={() => {
                           setShowSupplierModal(false);
                           setEditingSupplier(null);
                           setSupplierForm({ name: '', deliveryDays: 0 });
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
               className="bg-card border border-rose-500/30 rounded-2xl w-full max-w-md shadow-2xl p-6 relative z-10 max-h-[calc(100vh-2rem)] overflow-y-auto scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent"
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
    </div>
  );
}

