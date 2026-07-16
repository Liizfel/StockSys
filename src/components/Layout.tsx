import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { LogOut, LayoutDashboard, Clock, History, FolderTree, Users, Boxes, Sun, Moon, Package, Container, ShoppingCart, Menu, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { NotificationsPanel } from './NotificationsPanel';

const StockSysLogo = () => (
  <div className="p-1.5 bg-blue-600 rounded-lg flex items-center justify-center text-white shadow-md shadow-blue-500/20 shrink-0">
    <Package className="w-5 h-5" />
  </div>
);

export default function Layout() {
  const { user, logout, isManager } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const checkModal = () => {
      const backdrops = document.querySelectorAll('.backdrop-blur-sm');
      let hasModal = false;
      backdrops.forEach(el => {
        if (el.classList.contains('lg:hidden')) return;
        if (el.classList.contains('fixed') || el.classList.contains('absolute')) {
          hasModal = true;
        }
      });
      setIsModalOpen(hasModal);
    };

    checkModal();
    const observer = new MutationObserver(checkModal);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const menuItems = [
    { path: '/', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/kanban', label: 'Kanban', icon: Container },
    { path: '/materiais', label: 'Lista de Produtos', icon: Boxes },
    ...(isManager ? [
      { path: '/recomendacoes', label: 'Sugestões de Compra', icon: ShoppingCart },
      { path: '/setores', label: 'Setores', icon: FolderTree },
      { path: '/usuarios', label: 'Equipe', icon: Users },
      { path: '/auditoria', label: 'Auditoria de Estoque', icon: History },
      { path: '/ponto', label: 'Registro de Acesso', icon: Clock },
    ] : [])
  ];

  const SidebarContent = () => (
    <>
      <div className="p-6 border-b border-border flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3 text-blue-600">
           <StockSysLogo />
           <span className="font-bold text-xl tracking-tight text-foreground">StockSys</span>
        </div>
        <button 
           onClick={() => setIsMobileMenuOpen(false)} 
           className="lg:hidden p-2 text-muted-foreground hover:text-foreground rounded-md hover:bg-secondary transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto custom-scrollbar">
        {menuItems.map(item => {
          const Icon = item.icon;
          const active = location.pathname === item.path;
          return (
            <Link 
              key={item.path} 
              to={item.path}
              onClick={() => setIsMobileMenuOpen(false)}
              className="relative block"
            >
               {active && (
                  <motion.div 
                     layoutId="sidebar-active"
                     className="absolute inset-0 bg-blue-500/10 border border-blue-500/20 rounded-lg z-0"
                     transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
               )}
               <div className={cn(
                "relative z-10 flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition-colors text-sm",
                active ? "text-blue-600 dark:text-blue-400" : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground dark:hover:text-foreground"
               )}>
                  <Icon className={cn("w-4.5 h-4.5", active ? "text-blue-600 dark:text-blue-400" : "text-muted-foreground dark:text-muted-foreground")} />
                  {item.label}
               </div>
            </Link>
          )
        })}
      </nav>

      <div className="p-4 border-t border-border bg-card/50 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-3 mb-4 px-2">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center text-white font-bold shadow-md shrink-0">
            {user?.name?.charAt(0).toUpperCase() || '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{user?.name || 'Usuário'}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.role === 'MANAGER' ? 'Gestor' : 'Atendente'}</p>
          </div>
        </div>
        <button 
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 rounded-lg transition-colors border border-transparent hover:border-destructive/20"
        >
          <LogOut className="w-4 h-4" />
          Sair
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-background flex text-foreground selection:bg-blue-500/30 overflow-hidden w-full">
      <aside className="hidden lg:flex w-64 bg-card border-r border-border flex-col shrink-0 relative z-20 h-screen">
        <SidebarContent />
      </aside>

      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 w-64 bg-card border-r border-border flex flex-col z-50 lg:hidden shadow-2xl h-screen"
            >
              <SidebarContent />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative w-full">
        <div className="absolute top-0 left-0 right-0 h-96 bg-blue-500/5 blur-[100px] pointer-events-none z-0"></div>

        <header className={cn(
          "h-16 bg-card/50 border-b border-border flex items-center justify-between px-4 sm:px-6 lg:px-8 sticky top-0 z-30 transition-all duration-300 w-full",
          isModalOpen ? "backdrop-blur-sm filter blur-[2px] opacity-50 pointer-events-none" : "backdrop-blur-md"
        )}>
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden p-2 -ml-1 text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary/50 transition-colors shrink-0"
              aria-label="Menu principal"
            >
              <Menu className="w-6 h-6" />
            </button>
            <h2 className="text-base sm:text-lg font-semibold text-foreground capitalize truncate max-w-[200px] sm:max-w-none">
              {menuItems.find(m => m.path === location.pathname)?.label || 'Visão Geral'}
            </h2>
          </div>
          
          <div className="flex items-center gap-3 sm:gap-4 shrink-0">
              <button onClick={toggleTheme} className="p-2 text-muted-foreground hover:text-foreground rounded-md hover:bg-secondary transition-colors">
                 {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
              <NotificationsPanel />
          </div>
        </header>
        
        <div className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8 relative min-w-0 w-full">
          <AnimatePresence mode="wait">
             <motion.div
               key={location.pathname}
               initial={{ opacity: 0, y: 10 }}
               animate={{ opacity: 1, y: 0 }}
               exit={{ opacity: 0, y: -10 }}
               transition={{ duration: 0.2 }}
               className="h-full w-full"
             >
                <Outlet />
             </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}