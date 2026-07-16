import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Lock, Mail, Loader2, Package, Eye, EyeOff } from 'lucide-react';
import { motion } from 'framer-motion';

const StockSysLogo = () => (
  <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-emerald-600 rounded-xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-blue-500/20 shrink-0">
    <Package className="w-8 h-8 text-white" />
  </div>
);

export default function Login() {
  const [email, setEmail] = useState('admin@estoque.com');
  const [password, setPassword] = useState('123');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Adicionamos a barra ao final / para evitar redirecionamentos que perdem o POST
      const res = await fetch('/api/auth/login/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro de autenticação');

      login(data.token, data.user);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Erro ao conectar com o servidor');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmNewPassword) {
      setError('As senhas não coincidem.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail, newPassword })
      });
      if (!res.ok) throw new Error('Erro ao redefinir a senha');
      setSuccessMessage('Senha redefinida com sucesso!');
      setIsForgotPassword(false);
    } catch (err: any) {
      setError(err.message || 'Erro ao redefinir a senha');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Decorativo */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-500/20 rounded-full blur-[120px] animate-pulse"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-emerald-500/15 rounded-full blur-[120px] animate-pulse delay-700"></div>

      <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-card/60 backdrop-blur-xl rounded-3xl border border-border/50 shadow-2xl p-6 sm:p-8 space-y-6 relative z-10"
      >
        <div className="text-center">
          <StockSysLogo />
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">StockSys</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">Sistema de Gestão de Estoque</p>
        </div>

        {error && <div className="bg-destructive/10 text-destructive p-3 rounded-xl text-xs font-medium border border-destructive/20 text-center">{error}</div>}
        {successMessage && <div className="bg-emerald-500/10 text-emerald-500 p-3 rounded-xl text-xs font-medium border border-emerald-500/20 text-center">{successMessage}</div>}

        {!isForgotPassword ? (
          <form onSubmit={handleLogin} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-muted-foreground ml-1 uppercase tracking-wider">E-mail</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full pl-11 pr-4 py-3 bg-secondary/50 border border-border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all h-[48px] text-sm" placeholder="nome@stocksys.com" required />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center px-1">
                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Senha</label>
                <button type="button" onClick={() => setIsForgotPassword(true)} className="text-[10px] text-blue-500 hover:text-blue-600 font-medium transition-colors">Esqueceu?</button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full pl-11 pr-11 py-3 bg-secondary/50 border border-border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all h-[48px] text-sm" placeholder="••••••" required />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-[48px] rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 mt-6">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Acessar Sistema'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleResetPassword} className="space-y-4 pt-2">
             {/* ... formulário de reset ... */}
          </form>
        )}
      </motion.div>
    </div>
  );
}