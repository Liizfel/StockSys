import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Lock, Mail, Loader2, Package, Eye, EyeOff } from 'lucide-react';
import { motion } from 'framer-motion';

const StockSysLogo = () => (
  <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-emerald-600 rounded-xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-blue-500/20">
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
  
  // Estados de Esqueci a Senha
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      let data: any = {};
      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const text = await res.text();
        throw new Error(text.substring(0, 100) || `Erro do servidor (${res.status})`);
      }

      if (!res.ok) throw new Error(data.error || 'Erro de autenticação');

      login(data.token, data.user);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Erro ao fazer login');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    if (newPassword !== confirmNewPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail, newPassword })
      });

      let data: any = {};
      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const text = await res.text();
        throw new Error(text.substring(0, 100) || `Erro do servidor (${res.status})`);
      }

      if (!res.ok) throw new Error(data.error || 'Erro ao redefinir a senha');

      setSuccessMessage('Senha redefinida com sucesso! Você já pode fazer o login.');
      setIsForgotPassword(false);
      setEmail(resetEmail);
      setPassword(newPassword);
      setResetEmail('');
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (err: any) {
      setError(err.message || 'Erro ao redefinir a senha');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden text-foreground">
      {/* Animated Background Gradients */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-500/20 rounded-full blur-[120px] animate-[pulse_8s_ease-in-out_infinite]"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-emerald-500/15 rounded-full blur-[120px] animate-[pulse_10s_ease-in-out_infinite_reverse]"></div>

      <motion.div 
         initial={{ opacity: 0, y: 20 }}
         animate={{ opacity: 1, y: 0 }}
         transition={{ duration: 0.5, ease: "easeOut" }}
         className="max-w-md w-full bg-card/60 backdrop-blur-xl rounded-3xl border border-border/50 shadow-2xl p-8 space-y-6 relative z-10"
      >
        <div className="text-center">
          <StockSysLogo />
          <h1 className="text-3xl font-bold tracking-tight">StockSys</h1>
          <p className="text-sm text-muted-foreground mt-2">Sistema de Gestão de Estoque</p>
        </div>

        {error && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-destructive/10 text-destructive p-3 rounded-xl text-sm text-center font-medium border border-destructive/20">
            {error}
          </motion.div>
        )}

        {successMessage && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-emerald-500/10 text-emerald-500 p-3 rounded-xl text-sm text-center font-medium border border-emerald-500/20">
            {successMessage}
          </motion.div>
        )}

        {!isForgotPassword ? (
          <form onSubmit={handleLogin} className="space-y-4 pt-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground ml-1">Endereço de E-mail</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-secondary/50 border border-border rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all placeholder:text-muted-foreground/50"
                  placeholder="nome@stocksys.com"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center px-1">
                <label className="text-sm font-medium text-muted-foreground">Senha de Acesso</label>
                <button
                  type="button"
                  onClick={() => {
                    setIsForgotPassword(true);
                    setError('');
                    setSuccessMessage('');
                    setResetEmail(email === 'admin@estoque.com' ? '' : email);
                  }}
                  className="text-xs text-blue-500 hover:text-blue-600 font-medium transition-colors"
                >
                  Esqueceu a senha?
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input 
                  type={showPassword ? "text" : "password"} 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-11 py-3 bg-secondary/50 border border-border rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all placeholder:text-muted-foreground/50"
                  placeholder="••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-70 shadow-lg shadow-blue-500/25 mt-6"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Acessar Sistema'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleResetPassword} className="space-y-4 pt-4">
            <h3 className="text-lg font-semibold text-center">Redefinir Senha</h3>
            <p className="text-xs text-muted-foreground text-center">
              Insira o seu e-mail cadastrado e a nova senha desejada para redefinição.
            </p>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground ml-1">E-mail Cadastrado</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input 
                  type="email" 
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-secondary/50 border border-border rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all placeholder:text-muted-foreground/50"
                  placeholder="nome@stocksys.com"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground ml-1">Nova Senha</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input 
                  type={showPassword ? "text" : "password"} 
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full pl-11 pr-11 py-3 bg-secondary/50 border border-border rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all placeholder:text-muted-foreground/50"
                  placeholder="Nova senha"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground ml-1">Confirmar Nova Senha</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input 
                  type={showPassword ? "text" : "password"} 
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  className="w-full pl-11 pr-11 py-3 bg-secondary/50 border border-border rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all placeholder:text-muted-foreground/50"
                  placeholder="Confirme a nova senha"
                  required
                />
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-70 shadow-lg shadow-blue-500/25"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Confirmar Redefinição'}
              </button>
              
              <button 
                type="button" 
                onClick={() => {
                  setIsForgotPassword(false);
                  setError('');
                }}
                className="w-full text-sm text-muted-foreground hover:text-foreground py-2 transition-colors"
              >
                Cancelar e Voltar
              </button>
            </div>
          </form>
        )}
      </motion.div>
    </div>
  );
}
