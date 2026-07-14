import React, { useState, useEffect, useMemo } from 'react';
import { Users, Plus, Edit3, Trash2, Shield, User as UserIcon, ShieldAlert, BarChart3 } from 'lucide-react';
import { User, Sector } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from 'recharts';

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

  useEffect(() => {
    fetchData();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingUser ? `/api/users/${editingUser.id}` : '/api/users';
      const method = editingUser ? 'PUT' : 'POST';
      
      const payload = { ...formData };
      if (editingUser) delete (payload as any).password; // Não atualiza a senha se estiver editando aqui

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
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
    if (id === currentUser?.id) {
       alert("Você não pode excluir seu próprio usuário.");
       return;
    }
    if (!confirm('Tem certeza que deseja excluir este usuário?')) return;
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        fetchData();
      } else {
        const errorData = await res.json();
        alert(errorData.error || 'Erro ao excluir usuário');
      }
    } catch (err) {
      console.error(err);
    }
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
     if (unassigned > 0) {
        counts.push({ name: 'Sem Setor', value: unassigned });
     }
     const managers = users.filter(u => u.role === 'MANAGER').length;
     if (managers > 0) {
        counts.push({ name: 'Gestores Gerais', value: managers });
     }
     return counts.filter(c => c.value > 0);
  }, [users, sectors]);

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#64748b'];

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">
      {/* Header */}
      <div className="bg-card/50 backdrop-blur-md p-6 rounded-2xl border border-border shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
         <div>
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
               <Users className="w-6 h-6 text-blue-500" /> Gestão de Equipe
            </h2>
            <p className="text-sm text-muted-foreground mt-1">Gerencie acessos e delegue responsáveis por setor.</p>
         </div>
         <button 
           onClick={openNewModal}
           className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 transition-all shadow-lg shadow-blue-500/25 shrink-0"
         >
           <Plus className="w-4 h-4" /> Novo Usuário
         </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         {/* Chart Section */}
         <div className="bg-card/50 backdrop-blur-md p-6 rounded-2xl border border-border shadow-sm flex flex-col">
             <h3 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-6">
                <BarChart3 className="w-5 h-5 text-emerald-500" /> Distribuição de Equipe
             </h3>
             <div className="flex-1 min-h-[250px] relative">
               {users.length > 0 ? (
                 <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                       <Pie
                          data={chartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                       >
                          {chartData.map((entry, index) => (
                             <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                       </Pie>
                       <RechartsTooltip 
                          contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '0.5rem', color: 'hsl(var(--foreground))' }}
                          itemStyle={{ color: 'hsl(var(--foreground))' }}
                       />
                       <Legend wrapperStyle={{ fontSize: '12px', color: 'hsl(var(--foreground))' }} />
                    </PieChart>
                 </ResponsiveContainer>
               ) : (
                 <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm">
                    Nenhum dado
                 </div>
               )}
             </div>
         </div>

         {/* List Section */}
         <div className="lg:col-span-2 bg-card/50 backdrop-blur-md rounded-2xl border border-border shadow-sm overflow-hidden flex flex-col">
             <div className="p-6 border-b border-border">
                <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                   <UserIcon className="w-5 h-5 text-blue-500" /> Lista de Usuários
                </h3>
             </div>
             
             <div className="overflow-x-auto">
               {loading ? (
                 <div className="p-8 text-center text-muted-foreground">Carregando...</div>
               ) : users.length === 0 ? (
                 <div className="p-8 text-center text-muted-foreground">Nenhum usuário cadastrado.</div>
               ) : (
                 <table className="w-full text-left border-collapse">
                   <thead>
                     <tr className="bg-secondary/50 border-b border-border text-muted-foreground text-xs uppercase tracking-wider">
                       <th className="px-6 py-4 font-medium">Nome / Email</th>
                       <th className="px-6 py-4 font-medium">Cargo</th>
                       <th className="px-6 py-4 font-medium">Setor Delegado</th>
                       <th className="px-6 py-4 font-medium text-right">Ações</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-border">
                     {users.map(user => (
                       <tr key={user.id} className="hover:bg-secondary/30 transition-colors">
                         <td className="px-6 py-4 whitespace-nowrap">
                           <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center text-white font-bold shadow-sm text-xs">
                                 {user.name.charAt(0)}
                              </div>
                              <div>
                                 <div className="text-sm font-medium text-foreground">{user.name}</div>
                                 <div className="text-xs text-muted-foreground">{user.email}</div>
                              </div>
                           </div>
                         </td>
                         <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                               user.role === 'MANAGER' 
                               ? 'bg-purple-500/10 text-purple-500 border border-purple-500/20' 
                               : 'bg-blue-500/10 text-blue-500 border border-blue-500/20'
                            }`}>
                               {user.role === 'MANAGER' ? <ShieldAlert className="w-3 h-3" /> : <Shield className="w-3 h-3" />}
                               {user.role === 'MANAGER' ? 'Gestor' : 'Atendente'}
                            </span>
                         </td>
                         <td className="px-6 py-4 whitespace-nowrap">
                           {user.role === 'MANAGER' ? (
                             <span className="text-xs text-muted-foreground italic">Acesso Global</span>
                           ) : (
                             <span className="text-sm font-medium text-foreground">
                               <>
                                  <span>{user.sectorName || <span className="text-muted-foreground italic">Não atribuído</span>}</span>
                                  {user.additionalSectors && (
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {user.additionalSectors.split(',').map(id => {
                                        const sec = sectors.find(s => s.id === id);
                                        return sec ? <span key={id} className="text-[10px] bg-secondary text-secondary-foreground border border-border px-1.5 py-0.5 rounded font-semibold">{sec.name}</span> : null;
                                      })}
                                    </div>
                                  )}
                                </>
                             </span>
                           )}
                         </td>
                         <td className="px-6 py-4 whitespace-nowrap text-right">
                           <div className="flex items-center justify-end gap-2">
                             <button 
                               onClick={() => openEditModal(user)}
                               className="p-2 text-muted-foreground hover:text-blue-500 hover:bg-blue-500/10 rounded-lg transition-colors"
                             >
                               <Edit3 className="w-4 h-4" />
                             </button>
                             {user.id !== currentUser?.id && (
                               <button 
                                 onClick={() => handleDelete(user.id)}
                                 className="p-2 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                               >
                                 <Trash2 className="w-4 h-4" />
                               </button>
                             )}
                           </div>
                         </td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               )}
             </div>
         </div>
      </div>

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
               initial={{ opacity: 0 }} 
               animate={{ opacity: 1 }} 
               exit={{ opacity: 0 }}
               className="absolute inset-0 bg-background/80 backdrop-blur-sm"
               onClick={() => setShowModal(false)}
            />
            <motion.div 
               initial={{ scale: 0.95, y: 20 }}
               animate={{ scale: 1, y: 0 }}
               exit={{ scale: 0.95, y: 20 }}
               className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl p-6 relative overflow-hidden z-10"
            >
               <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-emerald-500"></div>
               
               <div className="mb-6 mt-2">
                  <h3 className="text-xl font-bold text-foreground">
                    {editingUser ? 'Editar Usuário' : 'Novo Usuário'}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">Preencha os dados de acesso.</p>
               </div>

               <form onSubmit={handleSubmit} className="space-y-4">
                 <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1.5">Nome Completo</label>
                    <input 
                       type="text" 
                       value={formData.name}
                       onChange={e => setFormData({...formData, name: e.target.value})}
                       className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/50 outline-none text-foreground"
                       required
                    />
                 </div>
                 
                 <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1.5">E-mail de Acesso</label>
                    <input 
                       type="email" 
                       value={formData.email}
                       onChange={e => setFormData({...formData, email: e.target.value})}
                       className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/50 outline-none text-foreground"
                       required
                    />
                 </div>

                 {!editingUser && (
                   <div>
                      <label className="block text-sm font-medium text-muted-foreground mb-1.5">Senha Provisória</label>
                      <input 
                         type="password" 
                         value={formData.password}
                         onChange={e => setFormData({...formData, password: e.target.value})}
                         className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/50 outline-none text-foreground"
                         required
                      />
                   </div>
                 )}

                 <div className="grid grid-cols-2 gap-4">
                    <div>
                       <label className="block text-sm font-medium text-muted-foreground mb-1.5">Cargo (Nível de Acesso)</label>
                       <select 
                          value={formData.role}
                          onChange={e => setFormData({...formData, role: e.target.value})}
                          className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/50 outline-none text-foreground"
                       >
                          <option value="ATTENDANT">Atendente</option>
                          <option value="MANAGER">Gestor</option>
                       </select>
                    </div>
                    <div>
                       <label className="block text-sm font-medium text-muted-foreground mb-1.5">Setor (Opcional)</label>
                       <select 
                          value={formData.sectorId}
                          onChange={e => setFormData({...formData, sectorId: e.target.value})}
                          
                          className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/50 outline-none text-foreground disabled:opacity-50"
                       >
                          <option value="">Nenhum</option>
                          {sectors.map(s => (
                             <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                       </select>
                    </div>
                 </div>

                 {true && (
                    <div className="space-y-2 col-span-2 mt-1">
                       <label className="block text-sm font-medium text-muted-foreground mb-1">Setores Adicionais sob Responsabilidade</label>
                       <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto p-2 bg-secondary/20 rounded-xl border border-border/50">
                          {sectors
                             .filter(s => s.id !== formData.sectorId)
                             .map(s => {
                                const isChecked = (formData.additionalSectors || '')
                                  .split(',')
                                  .filter(Boolean)
                                  .includes(s.id);
                                return (
                                  <label key={s.id} className="flex items-center gap-2 px-3 py-1.5 hover:bg-secondary/50 rounded-lg cursor-pointer text-xs text-foreground">
                                     <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={e => {
                                           const current = (formData.additionalSectors || '').split(',').filter(Boolean);
                                           let updated;
                                           if (e.target.checked) {
                                              updated = [...current, s.id];
                                           } else {
                                              updated = current.filter(id => id !== s.id);
                                           }
                                           setFormData({ ...formData, additionalSectors: updated.join(',') });
                                        }}
                                        className="rounded text-blue-500 bg-secondary/50 border-border focus:ring-blue-500 w-3.5 h-3.5"
                                     />
                                     <span className="truncate">{s.name}</span>
                                  </label>
                                );
                             })}
                          {sectors.filter(s => s.id !== formData.sectorId).length === 0 && (
                             <p className="text-xs text-muted-foreground italic p-2 col-span-2">Nenhum outro setor disponível</p>
                          )}
                       </div>
                    </div>
                 )}

                 <div className="flex gap-3 pt-4">
                    <button 
                       type="button" 
                       onClick={() => setShowModal(false)}
                       className="flex-1 px-4 py-3 text-muted-foreground font-medium rounded-xl hover:bg-secondary transition-colors"
                    >
                       Cancelar
                    </button>
                    <button 
                       type="submit" 
                       className="flex-1 px-4 py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/25"
                    >
                       {editingUser ? 'Salvar' : 'Cadastrar'}
                    </button>
                 </div>
               </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
