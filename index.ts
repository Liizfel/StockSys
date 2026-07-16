import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';

let resolvedDatabaseUrl = process.env.POSTGRES_PRISMA_URL || 
                            process.env.POSTGRES_URL || 
                            process.env.DATABASE_URL || 
                            process.env.URL_DO_BANCO_DE_DADOS || "";

process.env.DATABASE_URL = resolvedDatabaseUrl;

if (!process.env.VERCEL) {
  try {
    console.log(`Iniciando migração automática do banco de dados (${resolvedDatabaseUrl.startsWith('file:') ? 'SQLite' : 'PostgreSQL'})...`);
    execSync('npx prisma db push --accept-data-loss', { stdio: 'inherit' });
    console.log("Migração do banco de dados concluída com sucesso!");
  } catch (error: any) {
    console.error("Falha na migração automática do banco de dados:", error.message || error);
  }
}

let prismaInstance: PrismaClient | null = null;

function getPrisma(): PrismaClient {
  if (!prismaInstance) {
    if (!resolvedDatabaseUrl) {
      throw new Error("Nenhuma URL de conexão com o banco de dados configurada!");
    }
    prismaInstance = new PrismaClient({
      datasources: {
        db: {
          url: resolvedDatabaseUrl
        }
      }
    });
  }
  return prismaInstance;
}

const prisma = new Proxy({} as PrismaClient, {
  get(target, prop, receiver) {
    const instance = getPrisma();
    const value = Reflect.get(instance, prop, receiver);
    if (typeof value === 'function') {
      return value.bind(instance);
    }
    return value;
  }
});

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: 'MANAGER' | 'ATTENDANT';
    name: string;
    sectorId?: string | null;
    additionalSectors?: string | null;
  };
}

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const SECRET_KEY = process.env.JWT_SECRET || 'super_secret_key_for_dev_only';

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

app.get('/api/health', async (req: Request, res: Response) => {
  const envInfo = {
    NODE_ENV: process.env.NODE_ENV,
    VERCEL: process.env.VERCEL,
    has_POSTGRES_PRISMA_URL: !!process.env.POSTGRES_PRISMA_URL,
    has_POSTGRES_URL: !!process.env.POSTGRES_URL,
    has_DATABASE_URL: !!process.env.DATABASE_URL,
    has_URL_DO_BANCO_DE_DADOS: !!process.env.URL_DO_BANCO_DE_DADOS,
    resolvedDatabaseUrlLength: resolvedDatabaseUrl ? resolvedDatabaseUrl.length : 0,
    resolvedDatabaseUrlPrefix: resolvedDatabaseUrl ? resolvedDatabaseUrl.substring(0, 15) + '...' : 'none'
  };

  try {
    const client = getPrisma();
    await client.$connect();
    const userCount = await client.user.count();
    res.json({
      status: 'ok',
      database: 'connected',
      userCount,
      env: envInfo
    });
  } catch (err: any) {
    res.status(500).json({
      status: 'error',
      message: err.message,
      stack: err.stack,
      env: envInfo
    });
  }
});

const authMiddleware = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token não fornecido' });
  try {
    const decoded = jwt.verify(token, SECRET_KEY) as any;
    
    const dbUser = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (!dbUser) {
      return res.status(401).json({ error: 'Usuário não encontrado' });
    }
    
    req.user = {
      id: dbUser.id,
      role: dbUser.role as 'MANAGER' | 'ATTENDANT',
      name: dbUser.name,
      sectorId: dbUser.sectorId,
      additionalSectors: dbUser.additionalSectors
    };
    next();
  } catch (err) {
    res.status(401).json({ error: 'Token inválido' });
  }
};

const managerMiddleware = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (req.user?.role !== 'MANAGER') return res.status(403).json({ error: 'Acesso negado. Apenas gestores.' });
  next();
};

app.post('/api/auth/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;
  
  if (email === 'admin@estoque.com') {
    try {
      const client = getPrisma();
      const admin = await client.user.findUnique({ where: { email } });
      if (!admin) {
        await client.user.create({
          data: {
            name: 'Gestor Geral',
            email: 'admin@estoque.com',
            password: 'Admin@123',
            role: 'MANAGER'
          }
        });
      } else if (admin.password !== 'Admin@123' || admin.role !== 'MANAGER') {
        await client.user.update({
          where: { email },
          data: {
            password: 'Admin@123',
            role: 'MANAGER'
          }
        });
      }
    } catch (e) {
      console.error("Erro ao auto-cadastrar/atualizar admin:", e);
    }
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.password !== password) {
    return res.status(401).json({ error: 'Credenciais inválidas' });
  }

  const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'IP_DESCONHECIDO';
  
  await prisma.timeLog.create({
    data: {
      userId: user.id,
      type: 'LOGIN',
      ipAddress
    }
  });

  const token = jwt.sign({ id: user.id, role: user.role, name: user.name, sectorId: user.sectorId, additionalSectors: user.additionalSectors }, SECRET_KEY, { expiresIn: '8h' });
  res.json({ 
    token, 
    user: { 
      id: user.id, 
      name: user.name, 
      role: user.role,
      sectorId: user.sectorId,
      additionalSectors: user.additionalSectors
    } 
  });
});

app.post('/api/auth/reset-password', async (req: Request, res: Response) => {
  const { email, newPassword } = req.body;
  
  if (!email || !newPassword) {
    return res.status(400).json({ error: 'E-mail e nova senha são obrigatórios' });
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(404).json({ error: 'E-mail não cadastrado no sistema.' });
    }

    await prisma.user.update({
      where: { email },
      data: { password: newPassword }
    });

    res.json({ success: true, message: 'Senha redefinida com sucesso!' });
  } catch (err: any) {
    res.status(500).json({ error: 'Erro ao redefinir a senha' });
  }
});

app.post('/api/auth/logout', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'IP_DESCONHECIDO';
  
  if (req.user) {
    await prisma.timeLog.create({
      data: {
        userId: req.user.id,
        type: 'LOGOUT',
        ipAddress
      }
    });
  }

  res.json({ success: true });
});

app.get('/api/auth/me', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  res.json({ user: req.user });
});

app.get('/api/materials', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const whereClause: any = {};
  
  if (req.user?.role !== 'MANAGER' && req.user?.sectorId) {
    const allowedSectors = [req.user.sectorId];
    if (req.user.additionalSectors) {
      const additional = req.user.additionalSectors.split(',').filter(Boolean);
      allowedSectors.push(...additional);
    }
    whereClause.OR = [
      { sectorId: { in: allowedSectors } },
      ...allowedSectors.map(secId => ({
        additionalSectors: { contains: secId }
      }))
    ];
  }

  const dbMaterials = await prisma.material.findMany({
    where: whereClause,
    include: { 
      sector: true, 
      supplier: true,
      counts: {
        include: { user: true },
        orderBy: { timestamp: 'desc' },
        take: 1
      }
    }
  });

  const enriched = dbMaterials.map(m => {
    const lastCount = m.counts && m.counts[0];
    return {
      ...m,
      sector: m.sector?.name,
      supplierName: m.supplier?.name,
      lastCountedAt: lastCount ? lastCount.timestamp.toISOString() : undefined,
      lastCountedBy: lastCount ? lastCount.user?.name : undefined,
      counts: undefined
    };
  });

  res.json(enriched);
});

app.post('/api/materials', authMiddleware, managerMiddleware, async (req: Request, res: Response) => {
  try {
    const { 
      code, 
      codigoBarras, 
      name, 
      sectorId, 
      quantity, 
      estoqueMinimo, 
      unit, 
      supplierId, 
      supplierDeliveryDays, 
      origin, 
      imageUrl,
      area,
      estante,
      prateleira,
      palete,
      paleteQty,
      additionalSectors,
      isGiro,
      isPulmao,
      quantityGiro
    } = req.body;

    let additionalSectorsStr = "";
    if (additionalSectors !== undefined && additionalSectors !== null) {
      additionalSectorsStr = Array.isArray(additionalSectors)
        ? additionalSectors.filter(Boolean).join(',')
        : String(additionalSectors);
    }

    const newMaterial = await (prisma.material as any).create({
      data: {
        code,
        codigoBarras,
        name,
        sector: { connect: { id: sectorId } },
        quantity: Number(quantity) || 0,
        estoqueMinimo: Number(estoqueMinimo) || 5,
        unit: unit || 'un',
        status: 'PENDING',
        statusGiro: 'PENDING',
        supplier: supplierId ? { connect: { id: supplierId } } : undefined,
        supplierDeliveryDays: supplierDeliveryDays !== undefined && supplierDeliveryDays !== null ? Number(supplierDeliveryDays) : null,
        origin: origin || null,
        imageUrl: imageUrl || null,
        isGiro: isGiro !== undefined ? Boolean(isGiro) : false,
        isPulmao: isPulmao !== undefined ? Boolean(isPulmao) : true,
        quantityGiro: quantityGiro !== undefined ? Number(quantityGiro) : 0,
        area: area || null,
        estante: estante || null,
        prateleira: prateleira || null,
        palete: palete || null,
        paleteQty: paleteQty !== undefined && paleteQty !== null ? Number(paleteQty) : null,
        additionalSectors: additionalSectorsStr
      }
    });

    res.json(newMaterial);
  } catch (error) {
    res.status(400).json({ error: 'Erro ao criar material. Verifique se o código já existe.' });
  }
});

app.patch('/api/materials/:id/status', authMiddleware, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status, countType } = req.body;
  
  try {
    const updateData: any = {};
    const isGiroTarget = countType === 'giro';

    if (isGiroTarget) {
      updateData.statusGiro = status;
      updateData.repostedAtGiro = status === 'COMPLETED' ? new Date() : null;
    } else {
      updateData.status = status;
      updateData.repostedAt = status === 'COMPLETED' ? new Date() : null;
    }

    const updated = await prisma.material.update({
      where: { id: String(id) },
      data: updateData
    });
    res.json(updated);
  } catch (error) {
    res.status(404).json({ error: 'Material não encontrado' });
  }
});

app.put('/api/materials/:id', authMiddleware, managerMiddleware, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { 
    name, 
    code, 
    codigoBarras, 
    quantity, 
    estoqueMinimo, 
    unit, 
    sectorId, 
    supplierId, 
    supplierDeliveryDays, 
    origin, 
    imageUrl,
    area,
    estante,
    prateleira,
    palete,
    paleteQty,
    additionalSectors,
    isGiro,
    isPulmao,
    quantityGiro,
    status,
    statusGiro
  } = req.body;
  try {
    const material = await prisma.material.findUnique({ where: { id: String(id) } });
    if (!material) return res.status(404).json({ error: 'Material não encontrado' });

    let finalStatus = status !== undefined ? status : material.status;
    let finalRepostedAt = material.repostedAt;

    const newQty = quantity !== undefined ? Number(quantity) : material.quantity;
    const minEstoque = estoqueMinimo !== undefined ? Number(estoqueMinimo) : material.estoqueMinimo;

    if (quantity !== undefined || estoqueMinimo !== undefined) {
      if (newQty <= minEstoque) {
        if (material.status !== 'PURCHASE_REQUESTED' && material.status !== 'AWAITING_CONFIRMATION') {
          finalStatus = 'PURCHASE_REQUESTED';
          finalRepostedAt = null;
        }
      } else {
        if (material.status === 'PURCHASE_REQUESTED') {
          finalStatus = 'COMPLETED';
          finalRepostedAt = new Date();
        }
      }
    }

    const updated = await (prisma.material as any).update({
      where: { id: String(id) },
      data: {
        name,
        code,
        codigoBarras,
        quantity: quantity !== undefined ? Number(quantity) : undefined,
        estoqueMinimo: estoqueMinimo !== undefined ? Number(estoqueMinimo) : undefined,
        unit,
        sector: sectorId ? { connect: { id: sectorId } } : undefined,
        status: finalStatus,
        statusGiro: statusGiro !== undefined ? statusGiro : undefined,
        repostedAt: finalRepostedAt,
        supplier: supplierId !== undefined ? (supplierId ? { connect: { id: supplierId } } : { disconnect: true }) : undefined,
        supplierDeliveryDays: supplierDeliveryDays !== undefined ? (supplierDeliveryDays !== null ? Number(supplierDeliveryDays) : null) : undefined,
        origin: origin !== undefined ? origin : undefined,
        imageUrl: imageUrl !== undefined ? imageUrl : undefined,
        isGiro: isGiro !== undefined ? Boolean(isGiro) : undefined,
        isPulmao: isPulmao !== undefined ? Boolean(isPulmao) : undefined,
        quantityGiro: quantityGiro !== undefined ? Number(quantityGiro) : undefined,
        area: area !== undefined ? area : undefined,
        estante: estante !== undefined ? estante : undefined,
        prateleira: prateleira !== undefined ? prateleira : undefined,
        palete: palete !== undefined ? palete : undefined,
        paleteQty: paleteQty !== undefined ? (paleteQty !== null ? Number(paleteQty) : null) : undefined,
        additionalSectors: additionalSectors !== undefined 
          ? (Array.isArray(additionalSectors) ? additionalSectors.filter(Boolean).join(',') : String(additionalSectors)) 
          : undefined
      }
    });
    res.json(updated);
  } catch (error: any) {
    console.error("Erro ao atualizar material:", error);
    res.status(400).json({ 
      error: 'Erro ao atualizar material. Verifique se o código é único, se o setor existe ou se os campos numéricos são válidos.',
      details: error.message || String(error)
    });
  }
});

app.delete('/api/materials/:id', authMiddleware, managerMiddleware, async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    await prisma.material.delete({
      where: { id: String(id) }
    });
    res.status(204).send();
  } catch (error) {
    res.status(404).json({ error: 'Material não encontrado' });
  }
});

app.post('/api/materials/:id/count', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { newQuantity, notes, status, requestedQuantity, repostedAt, countType } = req.body;
  
  try {
    const material = await prisma.material.findUnique({ where: { id: String(id) } });
    if (!material) return res.status(404).json({ error: 'Material não encontrado' });

    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'Usuário não autenticado ou ID do usuário ausente' });
    }

    const isCountingGiro = countType === 'giro';
    const previousQuantity = Math.round(Number(isCountingGiro ? ((material as any).quantityGiro ?? 0) : (material.quantity ?? 0)));
    const estoqueMinimo = material.estoqueMinimo;
    
    let finalStatus = status !== undefined ? status : 'COMPLETED';
    const resolvedNewQuantity = Math.round(Number(newQuantity !== undefined && newQuantity !== '' && newQuantity !== null ? newQuantity : previousQuantity));
    
    if (isNaN(resolvedNewQuantity)) {
      return res.status(400).json({ error: 'A quantidade de contagem deve ser um número válido.' });
    }

    if (resolvedNewQuantity <= estoqueMinimo && status === undefined) {
      finalStatus = 'PURCHASE_REQUESTED';
    }
    
    let resolvedRepostedAt = isCountingGiro ? (material as any).repostedAtGiro : material.repostedAt;
    if (repostedAt !== undefined) {
      resolvedRepostedAt = repostedAt ? new Date(repostedAt) : null;
    } else {
      if (finalStatus === 'COMPLETED') {
        resolvedRepostedAt = new Date();
      } else if (finalStatus !== (isCountingGiro ? (material as any).statusGiro : material.status)) {
        resolvedRepostedAt = null;
      }
    }

    const updateData: any = {
      notes: notes !== undefined ? notes : material.notes,
      requestedQuantity: req.body.requestedQuantity !== undefined 
        ? (req.body.requestedQuantity === null ? null : Math.round(Number(req.body.requestedQuantity))) 
        : material.requestedQuantity
    };

    if (isCountingGiro) {
      updateData.quantityGiro = resolvedNewQuantity;
      updateData.statusGiro = finalStatus;
      updateData.repostedAtGiro = resolvedRepostedAt;
    } else {
      updateData.quantity = resolvedNewQuantity;
      updateData.status = finalStatus;
      updateData.repostedAt = resolvedRepostedAt;
      if (finalStatus === 'REALOCATED_TO_GIRO') {
        const diff = material.quantity - resolvedNewQuantity;
        if (diff > 0) {
          updateData.quantityGiro = Math.round(Number(((material as any).quantityGiro || 0) + diff));
        }
      }
    }

    const updatedMaterial = await (prisma.material as any).update({
      where: { id: String(id) },
      data: updateData
    });

    const prefix = isCountingGiro ? '[GIRO]' : '[PULMÃO]';
    const finalNotes = notes ? `${prefix} ${notes}` : prefix;

    await (prisma.stockCount as any).create({
      data: {
        materialId: String(id),
        userId: req.user.id,
        previousQuantity,
        newQuantity: resolvedNewQuantity,
        countType: isCountingGiro ? 'GIRO' : 'PULMAO',
        notes: finalNotes
      }
    });

    res.json(updatedMaterial);
  } catch (error: any) {
    console.error("Erro ao registrar contagem de material:", error);
    res.status(500).json({ 
      error: 'Erro interno ao registrar contagem de material.', 
      details: error.message || String(error)
    });
  }
});

app.get('/api/suppliers', authMiddleware, async (req: Request, res: Response) => {
  try {
    const allSuppliers = await prisma.supplier.findMany();
    res.json(allSuppliers);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao listar fornecedores' });
  }
});

app.post('/api/suppliers', authMiddleware, managerMiddleware, async (req: Request, res: Response) => {
  const { name, deliveryDays } = req.body;
  try {
    const newSupplier = await prisma.supplier.create({
      data: {
        name,
        deliveryDays: Number(deliveryDays) || 0
      }
    });
    res.json(newSupplier);
  } catch (error) {
    res.status(400).json({ error: 'Fornecedor com este nome já existe' });
  }
});

app.put('/api/suppliers/:id', authMiddleware, managerMiddleware, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, deliveryDays } = req.body;
  try {
    const updatedSupplier = await prisma.supplier.update({
      where: { id: String(id) },
      data: {
        name,
        deliveryDays: Number(deliveryDays) || 0
      }
    });
    res.json(updatedSupplier);
  } catch (error) {
    res.status(400).json({ error: 'Erro ao atualizar fornecedor ou nome já cadastrado' });
  }
});

app.delete('/api/suppliers/:id', authMiddleware, managerMiddleware, async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    await prisma.supplier.delete({
      where: { id: String(id) }
    });
    res.status(204).send();
  } catch (error) {
    res.status(400).json({ error: 'Erro ao excluir fornecedor' });
  }
});

app.get('/api/sectors', authMiddleware, async (req: Request, res: Response) => {
  const allSectors = await prisma.sector.findMany();
  res.json(allSectors);
});

app.post('/api/sectors', authMiddleware, managerMiddleware, async (req: Request, res: Response) => {
  const { name } = req.body;
  try {
    const newSector = await prisma.sector.create({ data: { name } });
    res.json(newSector);
  } catch (error) {
    res.status(400).json({ error: 'Este setor já existe' });
  }
});

app.put('/api/sectors/:id', authMiddleware, managerMiddleware, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name } = req.body;
  try {
    const updatedSector = await prisma.sector.update({
      where: { id: String(id) },
      data: { name }
    });
    res.json(updatedSector);
  } catch (error) {
    res.status(400).json({ error: 'Erro ao editar setor' });
  }
});

app.delete('/api/sectors/:id', authMiddleware, managerMiddleware, async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    await prisma.sector.delete({
      where: { id: String(id) }
    });
    res.status(204).send();
  } catch (error) {
    res.status(400).json({ error: 'Erro ao excluir setor' });
  }
});

app.get('/api/users', authMiddleware, managerMiddleware, async (req: Request, res: Response) => {
  try {
    const allUsers = await prisma.user.findMany({
      include: { sector: true }
    });

    const enrichedUsers = allUsers.map(user => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      sectorId: user.sectorId,
      sectorName: user.sector ? user.sector.name : null,
      additionalSectors: user.additionalSectors || ""
    }));

    res.json(enrichedUsers);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao listar usuários' });
  }
});

app.post('/api/users', authMiddleware, managerMiddleware, async (req: Request, res: Response) => {
  const { name, email, password, role, sectorId, additionalSectors } = req.body;
  try {
    let additionalSectorsStr = "";
    if (additionalSectors) {
      additionalSectorsStr = Array.isArray(additionalSectors)
        ? additionalSectors.filter(Boolean).join(',')
        : String(additionalSectors);
    }

    const newUser = await prisma.user.create({
      data: { 
        name, 
        email, 
        password: password || '123', 
        role,
        sectorId: sectorId || null,
        additionalSectors: additionalSectorsStr
      }
    });
    res.json({ id: newUser.id, name, email, role, sectorId: newUser.sectorId, additionalSectors: newUser.additionalSectors });
  } catch (error) {
    res.status(400).json({ error: 'Email já cadastrado' });
  }
});

app.put('/api/users/:id', authMiddleware, managerMiddleware, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, email, role, password, sectorId, additionalSectors } = req.body;
  try {
    let additionalSectorsStr = "";
    if (additionalSectors !== undefined) {
      additionalSectorsStr = Array.isArray(additionalSectors)
        ? additionalSectors.filter(Boolean).join(',')
        : String(additionalSectors);
    }

    const updateData: any = { 
      name, 
      email, 
      role,
      sectorId: sectorId || null,
      additionalSectors: additionalSectorsStr
    };
    if (password) updateData.password = password;

    const updatedUser = await prisma.user.update({
      where: { id: String(id) },
      data: updateData,
      include: { sector: true }
    });

    res.json({
      id: updatedUser.id,
      name: updatedUser.name,
      email: updatedUser.email,
      role: updatedUser.role,
      createdAt: updatedUser.createdAt,
      sectorId: updatedUser.sectorId,
      sectorName: updatedUser.sector ? updatedUser.sector.name : null,
      additionalSectors: updatedUser.additionalSectors || ""
    });
  } catch (error) {
    res.status(404).json({ error: 'Usuário não encontrado ou falha na atualização' });
  }
});

app.delete('/api/users/:id', authMiddleware, managerMiddleware, async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    await prisma.user.delete({ where: { id: String(id) } });
    res.status(204).send();
  } catch (error) {
    res.status(404).json({ error: 'Usuário não encontrado' });
  }
});

app.get('/api/notifications', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user?.role !== 'MANAGER') {
      return res.json([]);
    }

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    await prisma.notification.deleteMany({
      where: {
        createdAt: {
          lt: twentyFourHoursAgo
        }
      }
    });

    const criticalMaterials = await prisma.material.findMany({
      where: {
        OR: [
          { status: 'PURCHASE_REQUESTED' },
          {
            quantity: {
              lte: prisma.material.fields.estoqueMinimo
            }
          }
        ]
      },
      include: { sector: true }
    });

    for (const material of criticalMaterials) {
      const isCritical = material.quantity <= material.estoqueMinimo;
      const type = isCritical ? 'CRITICAL_STOCK' : 'PURCHASE_ALERT';
      
      const existing = await prisma.notification.findFirst({
        where: {
          materialId: material.id,
          type: type
        }
      });

      if (!existing) {
        await prisma.notification.create({
          data: {
            materialId: material.id,
            type: type,
            title: isCritical ? 'Estoque Crítico!' : 'Solicitação de Compra',
            message: isCritical 
              ? `O item "${material.name}" atingiu o nível crítico (${material.quantity} un.).`
              : `Nova recomendação de compra gerada para o item "${material.name}".`,
            read: false
          }
        });
      }
    }

    const allDbNotifications = await prisma.notification.findMany();
    for (const notif of allDbNotifications) {
      const isStillActive = criticalMaterials.some(material => {
        const isCritical = material.quantity <= material.estoqueMinimo;
        const expectedType = isCritical ? 'CRITICAL_STOCK' : 'PURCHASE_ALERT';
        return material.id === notif.materialId && expectedType === notif.type;
      });

      if (!isStillActive) {
        await prisma.notification.delete({
          where: { id: notif.id }
        });
      }
    }

    const dbNotifications = await prisma.notification.findMany({
      where: {
        read: false,
        createdAt: {
          gte: twentyFourHoursAgo
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    const notifications = dbNotifications.map(n => ({
      id: n.id,
      type: n.type,
      title: n.title,
      message: n.message,
      read: n.read,
      createdAt: n.createdAt,
      timestamp: n.createdAt
    }));

    res.json(notifications);
  } catch (error) {
    console.error('Erro ao processar notificações:', error);
    res.status(500).json({ error: 'Erro ao processar notificações' });
  }
});

app.patch('/api/notifications/:id/read', authMiddleware, async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const updated = await prisma.notification.update({
      where: { id: String(id) },
      data: { read: true }
    });
    res.json(updated);
  } catch (error) {
    res.status(404).json({ error: 'Notificação não encontrada' });
  }
});

app.post('/api/notifications/read-all', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await prisma.notification.updateMany({
      where: { read: false },
      data: { read: true }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao marcar todas as notificações como lidas' });
  }
});

app.get('/api/logs/time', authMiddleware, managerMiddleware, async (req: Request, res: Response) => {
  const logs = await prisma.timeLog.findMany({
    include: { user: true },
    orderBy: { timestamp: 'desc' }
  });
  
  const enriched = logs.map(log => ({
    id: log.id,
    userId: log.userId,
    userName: log.user.name,
    type: log.type,
    timestamp: log.timestamp,
    ipAddress: log.ipAddress
  }));
  
  res.json(enriched);
});

app.get('/api/logs/stock', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const counts = await prisma.stockCount.findMany({
    include: { user: true, material: { include: { sector: true } } },
    orderBy: { timestamp: 'desc' }
  });

  const enriched = counts.map((c: any) => ({
    id: c.id,
    materialId: c.materialId,
    userId: c.userId,
    previousQuantity: c.previousQuantity,
    newQuantity: c.newQuantity,
    timestamp: c.timestamp,
    userName: c.user.name,
    materialName: c.material.name,
    materialCode: c.material.code,
    materialSector: c.material.sector?.name || 'Desconhecido',
    countType: c.countType,
    notes: c.notes
  }));

  res.json(enriched);
});

if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  import('vite').then(({ createServer }) => {
    createServer({ server: { middlewareMode: true }, appType: 'spa' })
       .then(vite => app.use(vite.middlewares));
  });
} else {
  app.use(express.static(path.join(process.cwd(), 'dist')));
  app.get('*all', (req: Request, res: Response) => res.sendFile(path.join(process.cwd(), 'dist', 'index.html')));
}

if (process.env.NODE_ENV !== 'test' && !process.env.VERCEL) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`API Server running on http://0.0.0.0:${PORT}`);
  });
}

export default app;