import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => void;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  isManager: boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    if (storedToken) {
      // Buscar informações do usuário em tempo real do servidor para garantir sincronia
      fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${storedToken}` }
      })
      .then(res => {
        if (res.ok) return res.json();
        throw new Error('Falha ao validar sessão');
      })
      .then(data => {
        if (data.user) {
          setToken(storedToken);
          setUser(data.user);
          localStorage.setItem('user', JSON.stringify(data.user));
        } else {
          throw new Error('Falha ao validar sessão');
        }
      })
      .catch(err => {
        console.warn('Sessão expirada ou inválida:', err.message || err);
        // Limpar sessão em caso de falha de autenticação
        setToken(null);
        setUser(null);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      })
      .finally(() => {
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, []);

  const login = (newToken: string, newUser: User) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
  };

  const logout = async () => {
    if (token) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` }
        });
      } catch (err) {
        console.error('Erro no logout', err);
      }
    }
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  return (
    <AuthContext.Provider value={{
      user,
      token,
      login,
      logout,
      isAuthenticated: !!token,
      isManager: user?.role === 'MANAGER',
      loading
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
