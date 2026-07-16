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

  // Estados dos Modais e Formulários
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({ name: '', email: '', password: '', role: 'ATTENDANT', sectorId: '', additionalSectors: '' });
  
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

  // (Funções fetchData, handleAddSector, etc., mantidas iguais)
  // ... (código existente de lógica de API mantido) ...

  // Ajuste nos Botões do Modal para Responsividade
  const renderModalButtons = (onCancel: () => void, confirmLabel: string) => (
    <div className="flex flex-col sm:flex-row gap-3 pt-6 w-full">
      <button 
        type="button" 
        onClick={onCancel}
        className="w-full sm:flex-1 px-4 py-3 border border-border text-foreground font-medium rounded-xl hover:bg-secondary transition-colors text-sm h-[48px]"
      >
        Cancelar
      </button>
      <button 
        type="submit" 
        className="w-full sm:flex-1 px-4 py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/25 text-sm h-[48px]"
      >
        {confirmLabel}
      </button>
    </div>
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 pb-12 animate-in fade-in duration-500">
      {/* O resto do JSX continua aqui, mas substituindo os botões de rodapé por renderModalButtons() */}
      {/* Exemplo de uso no Modal: */}
      {/* <form onSubmit={handleSubmit}> */}
      {/* ... campos ... */}
      {/* {renderModalButtons(() => setShowModal(false), editingUser ? 'Salvar Alterações' : 'Cadastrar')} */}
      {/* </form> */}
      
      {/* Certifique-se de envolver os Modais com max-h-[90vh] e overflow-y-auto */}
    </div>
  );
}