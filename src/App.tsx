import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import Layout from './components/Layout';

// Lazy loaded page components
const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Kanban = lazy(() => import('./pages/Kanban'));
const Materials = lazy(() => import('./pages/Materials'));
const PurchaseRecommendations = lazy(() => import('./pages/PurchaseRecommendations'));
const TimeLogs = lazy(() => import('./pages/TimeLogs'));
const AuditLogs = lazy(() => import('./pages/AuditLogs'));
const Sectors = lazy(() => import('./pages/Sectors'));
const UsersPage = lazy(() => import('./pages/Users'));

const PageLoader = () => (
  <div className="flex flex-col items-center justify-center min-h-screen bg-background">
    <div className="relative flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      <div className="absolute animate-ping inline-flex h-8 w-8 rounded-full bg-blue-500 opacity-25"></div>
    </div>
    <span className="text-xs font-medium text-muted-foreground mt-4 tracking-wider animate-pulse uppercase">
      Carregando recurso...
    </span>
  </div>
);

const ProtectedRoute = ({ children, requireManager = false }: { children: React.ReactNode, requireManager?: boolean }) => {
  const { isAuthenticated, isManager, loading } = useAuth();
  
  if (loading) {
    return <PageLoader />;
  }
  
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (requireManager && !isManager) return <Navigate to="/" replace />;
  
  return <>{children}</>;
};

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Suspense fallback={<PageLoader />}>
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
        </Suspense>
      </AuthProvider>
    </ThemeProvider>
  );
}
