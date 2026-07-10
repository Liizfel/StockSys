export type Role = 'MANAGER' | 'ATTENDANT';

export interface User {
  id: string;
  name: string;
  email?: string;
  role: Role;
  sectorId?: string;
  sectorName?: string;
}

export interface Sector {
  id: string;
  name: string;
}

export interface Material {
  id: string;
  code: string;
  codigoBarras?: string;
  name: string;
  sectorId: string;
  sector?: string;
  quantity: number;
  unit?: string;
  estoqueMinimo: number;
  highDiscrepancy?: boolean;
  status: 'PENDING' | 'COUNTED_RECENTLY' | 'AWAITING_CONFIRMATION' | 'PURCHASE_REQUESTED' | 'COMPLETED' | 'DIVERGENCIA_AVARIA';
  notes?: string;
  updatedAt?: string;
  lastCountedBy?: string;
  lastCountedAt?: string;
  supplierId?: string;
  supplierName?: string;
  supplierDeliveryDays?: number;
  dailyUsage?: number;
  origin?: string;
  requestedQuantity?: number;
  repostedAt?: string;
  imageUrl?: string;
}

export interface Supplier {
  id: string;
  name: string;
  deliveryDays: number;
}

export interface TimeLog {
  id: string;
  userId: string;
  userName?: string;
  type: 'LOGIN' | 'LOGOUT';
  timestamp: string;
  ipAddress: string;
}

export interface StockCountLog {
  id: string;
  materialId: string;
  materialName?: string;
  materialCode?: string;
  materialSector?: string;
  userId: string;
  userName?: string;
  previousQuantity: number;
  newQuantity: number;
  timestamp: string;
  notes?: string;
}
