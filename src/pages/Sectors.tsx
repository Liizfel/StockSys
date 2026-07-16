import React, { useState, useEffect, useRef } from 'react';
import { apiFetch } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { Sector, Material, User, Supplier } from '../types';
import { FolderTree, Plus, Trash2, Edit3, Package, Users, ChevronDown, ChevronUp, UserPlus, AlertTriangle, Truck, Upload, Eye, Camera, X, Shield, ShieldAlert, BarChart3, User as UserIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatUnit, cn } from '../lib/utils';
import { ProductImageModal } from '../components/ProductImageModal';
import { BarcodeScanner } from '../components/BarcodeScanner';

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

  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({ name: '', email: '', password: '', role: 'ATTENDANT', sectorId: '', additionalSectors: '' });

  const [showProductModal, setShowProductModal] = useState(false);
  const [targetSectorForProduct, setTargetSectorForProduct] = useState<Sector | null>(null);
  const [newProduct, setNewProduct] = useState({ 
    code: '', codigoBarras: '', name: '', quantity: '', unit: 'unidade', estoqueMinimo: 5, supplierId: '', supplierDeliveryDays: '', origin: '', imageUrl: '', area: '', estante: '', prateleira: '', palete: '', paleteQty: '', additionalSectors: '', isPulmao: true, isGiro: false, quantityGiro: 0
  });

  const [showEditProductModal, setShowEditProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Material | null>(null);
  const [editProductForm, setEditProductForm] = useState<any>({});

  const [showUserModal, setShowUserModal] = useState(false);
  const [targetSectorForUser, setTargetSectorForUser] = useState<Sector | null>(null);
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'USER' });
  const [userModalTab, setUserModalTab] = useState<'create' | 'link'>('create');
  const [selectedExistingUserId, setSelectedExistingUserId] = useState('');
  
  const [sectorWarningModal, setSectorWarningModal] = useState<any>(null);
  const [imageModalProduct, setImageModalProduct] = useState<Material | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [scanTarget, setScanTarget] = useState<'newProduct' | 'editProduct' | null>(null);
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, type: 'sector' as const, id: '', name: '' });

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
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  useEffect(() => {
    fetchData();
    window.addEventListener('products-changed', fetchData);
    return () => window.removeEventListener('products-changed', fetchData);
  }, [token]);

  const openNewModal = () => {
    setEditingUser(null);
    setFormData({ name: '', email: '', password: '', role: 'ATTENDANT', sectorId: '', additionalSectors: '' });
    setShowModal(true);
  };

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
    } catch (err) { alert('Erro ao editar'); }
  };

  const executeDelete = async () => {
    try {
      await apiFetch(deleteModal.type === 'sector' ? `/api/sectors/${deleteModal.id}` : `/api/materials/${deleteModal.id}`, { method: 'DELETE' }, token);
      setDeleteModal({ isOpen: false, type: 'sector', id: '', name: '' });
      fetchData();
    } catch (err) { alert('Erro ao excluir'); }
  };

  if (loading) return <div className="p-8 text-center text-muted-foreground">Carregando...</div>;

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 pb-12 w-full">
      {/* HEADER */}
      <div className="bg-card/50 backdrop-blur-md p-6 rounded-2xl border border-border shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-foreground flex items-center gap-3">
               <FolderTree className="w-8 h-8 text-blue-500" /> Gestão de Setores
            </h2>
          </div>
          <button onClick={openNewModal} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-medium w-full sm:w-auto">
             Novo Usuário
          </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
             {sectors.map(sector => (
                <div key={sector.id} className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
                   <div className="p-4 flex items-center justify-between hover:bg-secondary/30 transition-colors cursor-pointer" onClick={() => toggleExpand(sector.id)}>
                      <span className="font-bold text-lg">{sector.name}</span>
                      <button className="p-2"><ChevronDown /></button>
                   </div>
                   <AnimatePresence>
                     {expandedSector === sector.id && (
                        <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} className="overflow-hidden bg-secondary/10">
                           {/* Conteúdo do Setor */}
                        </motion.div>
                     )}
                   </AnimatePresence>
                </div>
             ))}
          </div>
      </div>

      {/* Modal Genérico de Ações */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
            <motion.div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl p-6 relative">
              <h3 className="text-xl font-bold mb-4">{editingUser ? 'Editar' : 'Novo'}</h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                 <input className="w-full bg-secondary p-3 rounded-xl outline-none" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Nome" />
                 {/* ... outros campos ... */}
                 <div className="flex flex-col sm:flex-row gap-3 pt-6 w-full">
                    <button type="button" onClick={() => setShowModal(false)} className="w-full sm:flex-1 px-4 py-3 border border-border rounded-xl">Cancelar</button>
                    <button type="submit" className="w-full sm:flex-1 px-4 py-3 bg-blue-600 text-white rounded-xl">Salvar</button>
                 </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <BarcodeScanner onResult={handleScanResult} onClose={() => setShowScanner(false)} />
    </div>
  );
}