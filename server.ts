import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import path from 'path';

const app = express();
const PORT = 3000;
const SECRET_KEY = process.env.JWT_SECRET || 'super_secret_key_for_dev_only';

app.use(cors());
app.use(express.json());

// ==========================================
// MOCK DATABASE (Substitua pelo Prisma Client em Produção)
// ==========================================
let users = [
  { id: '1', name: 'Gestor Admin', email: 'admin@estoque.com', password: '123', role: 'MANAGER', sectorId: '1' },
  { id: '2', name: 'João Atendente', email: 'joao@estoque.com', password: '123', role: 'ATTENDANT', sectorId: '2' }
];

let sectors = [
  { id: '1', name: 'Eletrônicos' },
  { id: '2', name: 'Papelaria' }
];

let suppliers = [
  { id: '1', name: 'Fornecedor Alpha (Express)', deliveryDays: 3 },
  { id: '2', name: 'Fornecedor Beta (Padrão)', deliveryDays: 10 },
  { id: '3', name: 'Fornecedor Gamma (Longo Prazo)', deliveryDays: 30 }
];

let materials: any[] = [
  { id: '1', code: 'E-001', codigoBarras: '7891000000001', name: 'Monitor 24"', sectorId: '1', quantity: 10, unit: 'un', estoqueMinimo: 5, status: 'COMPLETED', notes: '', highDiscrepancy: false, supplierId: '2', dailyUsage: 1 },
  { id: '2', code: 'P-001', codigoBarras: '7891000000002', name: 'Papel A4', sectorId: '2', quantity: 2, unit: 'pct', estoqueMinimo: 10, status: 'PURCHASE_REQUESTED', notes: 'Urgente', highDiscrepancy: true, supplierId: '1', dailyUsage: 2 }
];

let timeLogs: any[] = [];
let stockCounts: any[] = [];
let notifications: any[] = [];

// ==========================================
// MIDDLEWARES
// ==========================================
const authMiddleware = (req: any, res: any, next: any) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token não fornecido' });
  try {
    const decoded = jwt.verify(token, SECRET_KEY) as any;
    const dbUser = users.find(u => u.id === decoded.id);
    if (!dbUser) {
      return res.status(401).json({ error: 'Usuário não encontrado' });
    }
    req.user = {
      id: dbUser.id,
      name: dbUser.name,
      email: dbUser.email,
      role: dbUser.role,
      sectorId: dbUser.sectorId
    };
    next();
  } catch (err) {
    res.status(401).json({ error: 'Token inválido' });
  }
};

const managerMiddleware = (req: any, res: any, next: any) => {
  if (req.user?.role !== 'MANAGER') return res.status(403).json({ error: 'Acesso negado. Apenas gestores.' });
  next();
};

// ==========================================
// ROUTES - AUTH & TIME TRACKING
// ==========================================
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  const user = users.find(u => u.email === email && u.password === password);
  if (!user) return res.status(401).json({ error: 'Credenciais inválidas' });

  // Capturar IP
  const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'IP_DESCONHECIDO';
  
  // Registrar Ponto (LOGIN)
  timeLogs.push({
    id: Date.now().toString(),
    userId: user.id,
    type: 'LOGIN',
    timestamp: new Date().toISOString(),
    ipAddress
  });

  const token = jwt.sign({ id: user.id, role: user.role, name: user.name, sectorId: user.sectorId }, SECRET_KEY, { expiresIn: '8h' });
  res.json({ token, user: { id: user.id, name: user.name, role: user.role, sectorId: user.sectorId } });
});

app.post('/api/auth/logout', authMiddleware, (req: any, res: any) => {
  const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'IP_DESCONHECIDO';
  
  // Registrar Ponto (LOGOUT)
  timeLogs.push({
    id: Date.now().toString(),
    userId: req.user.id,
    type: 'LOGOUT',
    timestamp: new Date().toISOString(),
    ipAddress
  });

  res.json({ success: true });
});

app.get('/api/auth/me', authMiddleware, (req: any, res) => {
  res.json({ user: req.user });
});

// ==========================================
// ROUTES - MATERIALS (Estoque)
// ==========================================
app.get('/api/materials', authMiddleware, (req: any, res) => {
  let filteredMaterials = materials;
  if (req.user.role !== 'MANAGER' && req.user.sectorId) {
    filteredMaterials = materials.filter(m => m.sectorId === req.user.sectorId);
  }
  
  const enriched = filteredMaterials.map(m => {
    const supplier = suppliers.find(s => s.id === m.supplierId);
    return {
      ...m,
      sector: sectors.find(s => s.id === m.sectorId)?.name,
      supplierName: supplier?.name,
      supplierDeliveryDays: supplier?.deliveryDays
    };
  });
  res.json(enriched);
});

app.post('/api/materials', authMiddleware, managerMiddleware, (req, res) => {
  const newMaterial = { 
    id: Date.now().toString(), 
    status: 'PENDING', 
    notes: '', 
    estoqueMinimo: req.body.estoqueMinimo || 5,
    codigoBarras: req.body.codigoBarras || '',
    highDiscrepancy: false,
    supplierId: req.body.supplierId || '',
    dailyUsage: req.body.dailyUsage || 1,
    ...req.body 
  };
  materials.push(newMaterial);
  res.json(newMaterial);
});

app.patch('/api/materials/:id/status', authMiddleware, (req: any, res: any) => {
  const { id } = req.params;
  const { status } = req.body;
  const materialIndex = materials.findIndex(m => m.id === id);
  if (materialIndex === -1) return res.status(404).json({ error: 'Material não encontrado' });
  
  materials[materialIndex] = { ...materials[materialIndex], status };
  res.json(materials[materialIndex]);
});

app.post('/api/materials/:id/count', authMiddleware, (req: any, res: any) => {
  const { id } = req.params;
  const { newQuantity, notes, status } = req.body;
  
  const materialIndex = materials.findIndex(m => m.id === id);
  if (materialIndex === -1) return res.status(404).json({ error: 'Material não encontrado' });

  const previousQuantity = materials[materialIndex].quantity;
  const estoqueMinimo = materials[materialIndex].estoqueMinimo;
  
  // Calcular discrepância
  const diff = Math.abs(newQuantity - previousQuantity);
  const highDiscrepancy = diff >= 10;
  
  // Determinar novo status
  let finalStatus = status !== undefined ? status : 'COMPLETED';
  // Lógica: se a quantidade for menor ou igual ao estoque mínimo, força o status para PURCHASE_REQUESTED
  if (newQuantity <= estoqueMinimo && status === undefined) {
    finalStatus = 'PURCHASE_REQUESTED';
  }
  
  // Atualiza material
  materials[materialIndex] = {
    ...materials[materialIndex],
    quantity: newQuantity,
    notes: notes !== undefined ? notes : materials[materialIndex].notes,
    status: finalStatus,
    highDiscrepancy: highDiscrepancy,
    updatedAt: new Date().toISOString(),
    lastCountedBy: req.user.name,
    lastCountedAt: new Date().toISOString()
  };

  if (highDiscrepancy) {
    notifications.push({
      id: Date.now().toString() + '-1',
      title: 'Alta Divergência Detectada',
      message: `A contagem do produto ${materials[materialIndex].name} reportou ${newQuantity} un (era ${previousQuantity} un). Diferença de ${diff}.`,
      read: false,
      timestamp: new Date().toISOString()
    });
  }

  if (newQuantity <= estoqueMinimo) {
    notifications.push({
      id: Date.now().toString() + '-2',
      title: 'Estoque Baixo Atingido',
      message: `O produto ${materials[materialIndex].name} atingiu o estoque mínimo de ${estoqueMinimo} unidades (Atual: ${newQuantity}).`,
      read: false,
      timestamp: new Date().toISOString()
    });
  }

  // Registra Auditoria de Contagem
  const countRecord = {
    id: Date.now().toString(),
    materialId: id,
    userId: req.user.id,
    previousQuantity,
    newQuantity,
    timestamp: new Date().toISOString(),
    notes: notes
  };
  stockCounts.push(countRecord);

  res.json(materials[materialIndex]);
});

// ==========================================
// ROUTES - MANAGERS ONLY
// ==========================================
app.get('/api/notifications', authMiddleware, managerMiddleware, (req, res) => {
  res.json(notifications.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
});

app.patch('/api/notifications/:id/read', authMiddleware, managerMiddleware, (req, res) => {
  const { id } = req.params;
  const index = notifications.findIndex(n => n.id === id);
  if (index !== -1) {
    notifications[index].read = true;
  }
  res.json({ success: true });
});

app.get('/api/sectors', authMiddleware, (req, res) => res.json(sectors));

app.get('/api/suppliers', authMiddleware, (req, res) => res.json(suppliers));

app.post('/api/suppliers', authMiddleware, managerMiddleware, (req, res) => {
  const newSupplier = { id: Date.now().toString(), name: req.body.name, deliveryDays: req.body.deliveryDays || 5 };
  suppliers.push(newSupplier);
  res.json(newSupplier);
});

app.put('/api/suppliers/:id', authMiddleware, managerMiddleware, (req, res) => {
  const { id } = req.params;
  const index = suppliers.findIndex(s => s.id === id);
  if (index === -1) return res.status(404).json({ error: 'Fornecedor não encontrado' });
  suppliers[index] = { ...suppliers[index], name: req.body.name, deliveryDays: req.body.deliveryDays };
  res.json(suppliers[index]);
});

app.delete('/api/suppliers/:id', authMiddleware, managerMiddleware, (req, res) => {
  const { id } = req.params;
  suppliers = suppliers.filter(s => s.id !== id);
  materials = materials.map(m => m.supplierId === id ? { ...m, supplierId: '' } : m);
  res.json({ success: true });
});

app.post('/api/sectors', authMiddleware, managerMiddleware, (req, res) => {
  const newSector = { id: Date.now().toString(), name: req.body.name };
  sectors.push(newSector);
  res.json(newSector);
});

app.put('/api/sectors/:id', authMiddleware, managerMiddleware, (req, res) => {
  const { id } = req.params;
  const index = sectors.findIndex(s => s.id === id);
  if (index === -1) return res.status(404).json({ error: 'Setor não encontrado' });
  sectors[index] = { ...sectors[index], name: req.body.name };
  res.json(sectors[index]);
});

app.delete('/api/sectors/:id', authMiddleware, managerMiddleware, (req, res) => {
  const { id } = req.params;
  sectors = sectors.filter(s => s.id !== id);
  materials = materials.map(m => m.sectorId === id ? { ...m, sectorId: '' } : m);
  users = users.map(u => u.sectorId === id ? { ...u, sectorId: '' } : u);
  res.json({ success: true });
});

app.get('/api/users', authMiddleware, managerMiddleware, (req, res) => {
  res.json(users.map(u => ({ 
    id: u.id, 
    name: u.name, 
    email: u.email, 
    role: u.role,
    sectorId: u.sectorId,
    sectorName: sectors.find(s => s.id === u.sectorId)?.name
  })));
});

app.post('/api/users', authMiddleware, managerMiddleware, (req, res) => {
  const { name, email, password, role, sectorId } = req.body;
  if (users.find(u => u.email === email)) return res.status(400).json({ error: 'Email já cadastrado' });
  const newUser = { id: Date.now().toString(), name, email, password: password || '123', role, sectorId };
  users.push(newUser);
  res.json({ id: newUser.id, name, email, role, sectorId });
});

app.put('/api/users/:id', authMiddleware, managerMiddleware, (req, res) => {
  const { id } = req.params;
  const { name, role, sectorId, email } = req.body;
  const index = users.findIndex(u => u.id === id);
  if (index === -1) return res.status(404).json({ error: 'Usuário não encontrado' });
  
  if (email && email !== users[index].email && users.find(u => u.email === email)) {
    return res.status(400).json({ error: 'Email já cadastrado por outro usuário' });
  }

  users[index] = { ...users[index], name, role, sectorId, email: email || users[index].email };
  res.json({ id: users[index].id, name: users[index].name, email: users[index].email, role: users[index].role, sectorId: users[index].sectorId });
});

app.delete('/api/users/:id', authMiddleware, managerMiddleware, (req: any, res: any) => {
  const { id } = req.params;
  if (id === req.user.id) return res.status(400).json({ error: 'Não pode excluir a si mesmo' });
  users = users.filter(u => u.id !== id);
  res.json({ success: true });
});

app.get('/api/logs/time', authMiddleware, managerMiddleware, (req, res) => {
  const enrichedLogs = timeLogs.map(log => ({
    ...log,
    userName: users.find(u => u.id === log.userId)?.name
  })).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  res.json(enrichedLogs);
});

app.get('/api/logs/stock', authMiddleware, (req: any, res: any) => {
  let filteredCounts = stockCounts;
  
  if (req.user.role !== 'MANAGER' && req.user.sectorId) {
    const sectorMaterials = materials.filter(m => m.sectorId === req.user.sectorId).map(m => m.id);
    filteredCounts = stockCounts.filter(c => sectorMaterials.includes(c.materialId));
  }

  const enrichedCounts = filteredCounts.map(count => {
    const material = materials.find(m => m.id === count.materialId);
    return {
      ...count,
      userName: users.find(u => u.id === count.userId)?.name,
      materialName: material?.name,
      materialCode: material?.code,
      materialSector: sectors.find(s => s.id === material?.sectorId)?.name || 'Desconhecido'
    };
  }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  
  res.json(enrichedCounts);
});

// ==========================================
// VITE SPA FALLBACK
// ==========================================
if (process.env.NODE_ENV !== 'production') {
  import('vite').then(({ createServer }) => {
    createServer({ server: { middlewareMode: true }, appType: 'spa' })
      .then(vite => app.use(vite.middlewares));
  });
} else {
  app.use(express.static(path.join(process.cwd(), 'dist')));
  app.get('*', (req, res) => res.sendFile(path.join(process.cwd(), 'dist', 'index.html')));
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`API Server running on port ${PORT}`);
});
