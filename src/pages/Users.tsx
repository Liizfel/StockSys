import React, { useState, useEffect, useMemo } from 'react';
import { Users, Plus, Edit3, Trash2, Shield, User as UserIcon, ShieldAlert, BarChart3, X } from 'lucide-react';
import { User, Sector } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip as RechartsTooltip } from 'recharts';
import { cn } from '../lib/utils';

export default function UsersPage() {
  const { token, user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'ATTENDANT',
    sectorId: '',
    additionalSectors: ''
  });

  const fetchData = async () => {
    try {
      const [usersRes, sectorsRes] = await Promise.all([
        fetch('/api/users', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/sectors', { headers: { 'Authorization': `Bearer ${token}` } })
      ]);
      const usersData = await usersRes.json();
      const sectorsData = await sectorsRes.json();
      
      setUsers(Array.isArray(usersData) ? usersData : []);
      setSectors(Array.isArray(sectorsData) ? sectorsData : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingUser ? `/api/users/${editingUser.id}` : '/api/users';
      const method = editingUser ? 'PUT' : 'POST';
      const payload = { ...formData };
      if (editingUser) delete (payload as any).password;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
        setShowModal(false);
        setEditingUser(null);
        setFormData({ name: '', email: '', password: '', role: 'ATTENDANT', sectorId: '', additionalSectors: '' });
        fetchData();
      } else {
        const errorData = await res.json();
        alert(errorData.error || 'Erro ao salvar usuário');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: string) => {
    if (id === currentUser?.id) { alert("Você não pode excluir seu próprio usuário."); return; }
    if (!confirm('Tem certeza que deseja excluir este usuário?')) return;
    try {
      await fetch(`/api/users/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
      fetchData();
    } catch (err) { console.error(err); }
  };

  const openEditModal = (user: User) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      email: user.email || '',
      password: '',
      role: user.role,
      sectorId: user.sectorId || '',
      additionalSectors: user.additionalSectors || ''
    });
    setShowModal(true);
  };
  
  const openNewModal = () => {
    setEditingUser(null);
    setFormData({ name: '', email: '', password: '', role: 'ATTENDANT', sectorId: '', additionalSectors: '' });
    setShowModal(true);
  };

  const chartData = useMemo(() => {
     const counts = sectors.map(sector => ({
       name: sector.name,
       value: users.filter(u => u.sectorId === sector.id).length
     }));
     const unassigned = users.filter(u => !u.sectorId && u.role !== 'MANAGER').length;
     if (unassigned > 0) counts.push({ name: 'Sem Setor', value: unassigned });
     return counts.filter(c => c.value > 0);
  }, [users, sectors]);

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#64748b'];

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-2 sm:px-4 pb-12 animate-in fade-in duration-500">
      <div className="bg-card/50 backdrop-blur-md p-6 rounded-2xl border border-border shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-foreground flex items-center gap-3">
               <Users className="w-8 h-8 text-blue-500" /> Gestão de Equipe
            </h2>
            <p className="text-sm text-muted-foreground mt-1">Gerencie acessos e delegue responsáveis por setor.</p>
          </div>
          <button 
            onClick={openNewModal}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 transition-all shadow-lg shadow-blue-500/25 shrink-0"
          >
            <Plus className="w-4 h-4" /> Novo Usuário
          </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-card/50 backdrop-blur-md p-6 rounded-2xl border border-border shadow-sm flex flex-col">
              <h3 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-6">
                <BarChart3 className="w-5 h-5 text-emerald-500" /> Distribuição de Equipe
              </h3>
              <div className="h-[250px] w-full">
                {users.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                     <PieChart>
                        <Pie data={chartData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                           {chartData.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                        </Pie>
                        <RechartsTooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '0.5rem' }} />
                     </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Nenhum dado</div>
                )}
              </div>
          </div>

          <div className="lg:col-span-2 bg-card/50 backdrop-blur-md rounded-2xl border border-border shadow-sm flex flex-col min-w-0">
             <div className="p-6 border-b border-border">
                <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                   <UserIcon className="w-5 h-5 text-blue-500" /> Lista de Usuários
                </h3>
             </div>
             
             {loading ? (
                <div className="p-8 text-center text-muted-foreground">Carregando...</div>
             ) : users.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">Nenhum usuário cadastrado.</div>
             ) : (
               <div className="overflow-hidden w-full">
                  {/* Tabela para Desktops */}
                  <div className="hidden md:block w-full overflow-x-auto">
                    <table className="w-full text-left border-collapse table-fixed">
                      <thead>
                        <tr className="bg-secondary/30 border-b border-border text-muted-foreground text-xs uppercase tracking-wider">
                          <th className="px-6 py-4 font-medium w-[40%]">Nome / Email</th>
                          <th className="px-6 py-4 font-medium w-[20%]">Cargo</th>
                          <th className="px-6 py-4 font-medium w-[25%]">Setores</th>
                          <th className="px-6 py-4 font-medium text-right w-[15%]">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {users.map(user => (
                          <tr key={user.id} className="hover:bg-secondary/30 transition-colors">
                            <td className="px-6 py-4 truncate">
                               <div className="flex items-center gap-3">
                                 <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-600 font-bold text-xs shrink-0">{user.name.charAt(0)}</div>
                                 <div className="min-w-0">
                                    <div className="text-sm font-medium text-foreground truncate">{user.name}</div>
                                    <div className="text-xs text-muted-foreground truncate">{user.email}</div>
                                 </div>
                               </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border", user.role === 'MANAGER' ? 'bg-purple-500/10 text-purple-500 border-purple-500/20' : 'bg-blue-500/10 text-blue-500 border-blue-500/20')}>
                                 {user.role === 'MANAGER' ? <ShieldAlert className="w-3 h-3" /> : <Shield className="w-3 h-3" />}
                                 {user.role === 'MANAGER' ? 'Gestor' : 'Atendente'}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm truncate">
                              {user.role === 'MANAGER' ? 'Acesso Global' : (
                                <div className="flex flex-wrap gap-1">
                                  {user.sectorId && <span className="bg-blue-500/10 text-blue-600 px-1.5 py-0.5 rounded text-[10px] font-bold">{sectors.find(s => s.id === user.sectorId)?.name}</span>}
                                  {user.additionalSectors?.split(',').filter(Boolean).map(id => (
                                     <span key={id} className="bg-secondary text-muted-foreground px-1.5 py-0.5 rounded text-[10px] font-bold">{sectors.find(s => s.id === id)?.name}</span>
                                  ))}
                                </div>
                              )}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                 <button onClick={() => openEditModal(user)} className="p-2 text-muted-foreground hover:text-blue-500 transition-colors"><Edit3 className="w-4 h-4" /></button>
                                 {user.id !== currentUser?.id && (
                                   <button onClick={() => handleDelete(user.id)} className="p-2 text-muted-foreground hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                                 )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Lista de Cartões para Mobile */}
                  <div className="md:hidden block divide-y divide-border">
                    {users.map(user => (
                       <div key={user.id} className="p-4 space-y-3">
                          <div className="flex items-center gap-3">
                             <div className="w-8 h-8 rounded-full bg-blue-500/10 text-blue-600 flex items-center justify-center font-bold text-xs shrink-0">{user.name.charAt(0)}</div>
                             <div className="min-w-0 flex-1">
                                <p className="text-sm font-bold text-foreground truncate">{user.name}</p>
                                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                             </div>
                             <div className="flex gap-1">
                                <button onClick={() => openEditModal(user)} className="p-2 text-blue-500"><Edit3 className="w-4 h-4" /></button>
                                {user.id !== currentUser?.id && (
                                   <button onClick={() => handleDelete(user.id)} className="p-2 text-red-500"><Trash2 className="w-4 h-4" /></button>
                                )}
                             </div>
                          </div>
                          <div className="flex flex-wrap gap-2 text-xs">
                             <span className={cn("px-2 py-0.5 rounded-md font-semibold border", user.role === 'MANAGER' ? 'bg-purple-500/10 text-purple-500' : 'bg-blue-500/10 text-blue-500')}>
                                {user.role === 'MANAGER' ? 'Gestor' : 'Atendente'}
                             </span>
                             <span className="bg-secondary px-2 py-0.5 rounded-md font-medium text-muted-foreground">
                                {user.role === 'MANAGER' ? 'Acesso Global' : (user.sectorId ? sectors.find(s => s.id === user.sectorId)?.name : 'Sem setor')}
                             </span>
                          </div>
                       </div>
                    ))}
                  </div>
               </div>
             )}
          </div>
      </div>

      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setShowModal(false)} />
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl p-6 relative z-10 max-h-[90vh] overflow-y-auto">
               <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-emerald-500"></div>
               <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-bold text-foreground">{editingUser ? 'Editar Usuário' : 'Novo Usuário'}</h3>
                  <button onClick={() => setShowModal(false)} className="p-1 hover:bg-secondary rounded-lg"><X className="w-5 h-5" /></button>
               </div>
               <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1.5">Nome Completo</label>
                    <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-3 outline-none text-foreground" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1.5">E-mail</label>
                    <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-3 outline-none text-foreground" required />
                  </div>
                  {!editingUser && (
                     <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-1.5">Senha</label>
                        <input type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-3 outline-none text-foreground" required />
                     </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1.5">Cargo</label>
                    <select value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})} className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-3 outline-none text-foreground">
                        <option value="ATTENDANT">Atendente</option>
                        <option value="MANAGER">Gestor</option>
                    </select>
                  </div>
                  {formData.role === 'ATTENDANT' && (
                     <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-1.5">Setor Principal</label>
                        <select value={formData.sectorId} onChange={e => setFormData({...formData, sectorId: e.target.value})} className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-3 outline-none text-foreground">
                            <option value="">Nenhum</option>
                            {sectors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                     </div>
                  )}
                  <div className="pt-4 flex gap-3">
                     <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-3 border border-border rounded-xl font-medium">Cancelar</button>
                     <button type="submit" className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-xl font-medium shadow-lg shadow-blue-500/25">Salvar</button>
                  </div>
               </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}