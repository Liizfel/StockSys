import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Kanban from './pages/Kanban';
import Materials from './pages/Materials';
import PurchaseRecommendations from './pages/PurchaseRecommendations';
import TimeLogs from './pages/TimeLogs';
import AuditLogs from './pages/AuditLogs';
import Sectors from './pages/Sectors';
import UsersPage from './pages/Users';

const ProtectedRoute = ({ children, requireManager = false }: { children: React.ReactNode, requireManager?: boolean }) => {
  const { isAuthenticated, isManager, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
      </div>
    );
  }
  
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (requireManager && !isManager) return <Navigate to="/" replace />;
  
  return <>{children}</>;
};

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          
          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<Dashboard />} />
            <Route path="kanban" element={<Kanban />} />
            <Route path="materiais" element={<Materials />} />
            
            {/* Rotas de Gestor */}
            <Route path="recomendacoes" element={<ProtectedRoute requireManager><PurchaseRecommendations /></ProtectedRoute>} />
            <Route path="auditoria" element={<ProtectedRoute requireManager><AuditLogs /></ProtectedRoute>} />
            <Route path="ponto" element={<ProtectedRoute requireManager><TimeLogs /></ProtectedRoute>} />
            <Route path="setores" element={<ProtectedRoute requireManager><Sectors /></ProtectedRoute>} />
            <Route path="usuarios" element={<ProtectedRoute requireManager><UsersPage /></ProtectedRoute>} />
          </Route>
        </Routes>
      </AuthProvider>
    </ThemeProvider>
  );
}
