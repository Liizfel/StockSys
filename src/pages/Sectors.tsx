import React, { useState, useEffect, useRef } from 'react';
import { apiFetch } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { Sector, Material, User, Supplier } from '../types';
import { FolderTree, Plus, Trash2, Edit3, Package, Users, ChevronDown, ChevronUp, UserPlus, AlertTriangle, Truck, Upload, Eye, Camera, X, Shield, ShieldAlert, BarChart3, User as UserIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatUnit } from '../lib/utils';
import { ProductImageModal } from '../components/ProductImageModal';
import { BarcodeScanner } from '../components/BarcodeScanner';
import { cn } from '../lib/utils';

export default function Sectors() {
  const { token, isManager, user: currentUser } = useAuth();
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
    code: '', codigoBarras: '', name: '', quantity: '' as string | number, unit: 'unidade', estoqueMinimo: 5 as string | number, 
    supplierId: '', supplierDeliveryDays: '' as string | number, origin: '', imageUrl: '', area: '', estante: '', prateleira: '', palete: '', paleteQty: '' as string | number, additionalSectors: '', isPulmao: true, isGiro: false, quantityGiro: 0 as string | number
  });

  const [showEditProductModal, setShowEditProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Material | null>(null);
  const [editProductForm, setEditProductForm] = useState({
    id: '', code: '', codigoBarras: '', name: '', quantity: 0 as string | number, unit: 'unidade', estoqueMinimo: 5 as string | number, sectorId: '', supplierId: '', supplierDeliveryDays: '' as string | number, origin: '', imageUrl: '', area: '', estante: '', prateleira: '', palete: '', paleteQty: '' as string | number, additionalSectors: '', isPulmao: true, isGiro: false, quantityGiro: 0 as string | number
  });

  const [showUserModal, setShowUserModal] = useState(false);
  const [targetSectorForUser, setTargetSectorForUser] = useState<Sector | null>(null);
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'USER' });
  const [userModalTab, setUserModalTab] = useState<'create' | 'link'>('create');
  const [selectedExistingUserId, setSelectedExistingUserId] = useState('');
  const [duplicateModal, setDuplicateModal] = useState<{ isOpen: boolean; code: string; existingProduct: Material | null; } | null>(null);
  const [sectorWarningModal, setSectorWarningModal] = useState<{ isOpen: boolean; productName: string; currentSectorName: string; newSectorId: string; newSectorName: string; isEdit: boolean; } | null>(null);
  const [imageModalProduct, setImageModalProduct] = useState<Material | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [scanTarget, setScanTarget] = useState<'newProduct' | 'editProduct' | null>(null);
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; type: 'sector' | 'product'; id: string; name: string; }>({ isOpen: false, type: 'sector', id: '', name: '' });

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
    const interval = setInterval(() => fetchData(), 10000);
    window.addEventListener('products-changed', fetchData);
    return () => { clearInterval(interval); window.removeEventListener('products-changed', fetchData); };
  }, [token]);

  const handleAddSector = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/sectors', { method: 'POST', body: JSON.stringify({ name: newSectorName }) }, token);
      setNewSectorName('');
      fetchData();
    } catch (err) { alert('Erro ao criar setor'); }
  };

  const handleEditSector = async (sector: Sector, newName: string) => {
    if (!newName.trim() || newName === sector.name) { setEditingSector(null); return; }
    try {
      await apiFetch(`/api/sectors/${sector.id}`, { method: 'PUT', body: JSON.stringify({ name: newName }) }, token);
      setEditingSector(null);
      fetchData();
    } catch (err) { alert('Erro ao editar setor'); }
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetSectorForProduct) return;
    try {
      await apiFetch('/api/materials', { method: 'POST', body: JSON.stringify({ ...newProduct, sectorId: targetSectorForProduct.id }) }, token);
      setShowProductModal(false);
      fetchData();
    } catch (err) { alert('Erro ao criar produto'); }
  };

  const executeDelete = async () => {
    try {
      await apiFetch(deleteModal.type === 'sector' ? `/api/sectors/${deleteModal.id}` : `/api/materials/${deleteModal.id}`, { method: 'DELETE' }, token);
      setDeleteModal({ isOpen: false, type: 'sector', id: '', name: '' });
      fetchData();
    } catch (err) { alert('Erro ao excluir'); }
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* HEADER RESPONSIVO */}
      <div className="bg-card backdrop-blur-md p-6 rounded-2xl border border-border shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-foreground flex items-center gap-3">
               <FolderTree className="w-8 h-8 text-blue-500" /> Gerenciamento de Setores
            </h2>
          </div>
          <button onClick={openNewModal} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-medium w-full sm:w-auto">
             Novo Setor
          </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Coluna Principal */}
          <div className="xl:col-span-2 space-y-6">
             {sectors.map(sector => (
                <div key={sector.id} className="bg-card border border-border rounded-2xl p-4 sm:p-6 w-full">
                   {/* Layout flex para o cabeçalho do setor */}
                   <div className="flex items-center justify-between">
                      <h3 className="font-bold text-lg truncate">{sector.name}</h3>
                      <button onClick={() => toggleExpand(sector.id)} className="p-2">
                        {expandedSector === sector.id ? <ChevronUp /> : <ChevronDown />}
                      </button>
                   </div>
                   {/* Conteúdo expandido com overflow-x-auto para tabelas */}
                   <AnimatePresence>
                     {expandedSector === sector.id && (
                        <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} className="overflow-x-auto">
                           {/* ... Conteúdo do Setor ... */}
                        </motion.div>
                     )}
                   </AnimatePresence>
                </div>
             ))}
          </div>
          
          {/* Coluna Fornecedores (Side) */}
          <div className="w-full">
            <div className="bg-card border border-border p-6 rounded-2xl">
               <h3 className="font-bold text-lg mb-4">Fornecedores</h3>
               {/* Listagem compacta */}
            </div>
          </div>
      </div>
      
      {/* Scan e Modais... */}
      {showScanner && <BarcodeScanner onResult={handleScanResult} onClose={() => setShowScanner(false)} />}
    </div>
  );
}