import React, { useEffect, useState } from 'react';
import { Bell, X, Check, Package, AlertTriangle } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';

export function NotificationsPanel() {
  const { token, isManager } = useAuth();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isManager || !token) return;

    const fetchNotifications = async () => {
      try {
        const data = await apiFetch('/api/notifications', {}, token);
        setNotifications(data);
      } catch (err: any) {
        // Ignorar erros de rede e de autenticação para evitar ruídos durante reinicializações ou expirações de sessão
        if (err.message && (
          err.message.includes('Failed to fetch') || 
          err.message.includes('Token inválido') || 
          err.message.includes('Token não fornecido') ||
          err.message.includes('HTTP Error 401')
        )) {
            return;
        }
        console.error('Failed to fetch notifications', err);
      }
    };

    fetchNotifications();
    const interval = setInterval(fetchNotifications, 10000); // Polling a cada 10s
    return () => clearInterval(interval);
  }, [isManager, token]);

  if (!isManager) return null;

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = async (id: string) => {
    try {
      await apiFetch(`/api/notifications/${id}/read`, { method: 'PATCH' }, token);
      setNotifications(notifications.map(n => n.id === id ? { ...n, read: true } : n));
    } catch (err) {
      console.error(err);
    }
  };

  const markAllAsRead = async () => {
    try {
      await apiFetch('/api/notifications/read-all', { method: 'POST' }, token);
      setNotifications(notifications.map(n => ({ ...n, read: true })));
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 text-muted-foreground hover:text-foreground dark:hover:text-foreground rounded-full hover:bg-secondary dark:hover:bg-secondary/50 transition-colors relative flex items-center justify-center"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-background"></span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               className="fixed inset-0 z-40"
               onClick={() => setIsOpen(false)}
            />
            <motion.div 
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute right-0 mt-2 w-[calc(100vw-2rem)] sm:w-[380px] max-h-[80vh] sm:max-h-[500px] bg-card border border-border rounded-2xl shadow-xl z-50 flex flex-col overflow-hidden"
            >
              <div className="p-4 border-b border-border bg-secondary/30 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-foreground text-sm">Notificações</h3>
                  <p className="text-[10px] text-muted-foreground">Expiram após 24h</p>
                </div>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <button 
                      onClick={markAllAsRead}
                      className="text-xs text-blue-500 hover:text-blue-600 dark:text-blue-400 font-medium transition-colors"
                    >
                      Marcar todas como lidas
                    </button>
                  )}
                  <span className="text-[10px] bg-blue-500/10 text-blue-500 px-2 py-0.5 rounded-full font-medium">
                    {unreadCount} novas
                  </span>
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                <AnimatePresence initial={false}>
                  {notifications.filter(n => !n.read).length === 0 ? (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="p-8 text-center text-sm text-muted-foreground flex flex-col items-center justify-center gap-1.5"
                    >
                      <Check className="w-6 h-6 text-emerald-500 bg-emerald-500/10 p-1 rounded-full" />
                      Sem novas notificações
                    </motion.div>
                  ) : (
                    notifications.filter(n => !n.read).map(notification => (
                      <motion.div 
                        key={notification.id} 
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, height: 0, padding: 0, margin: 0, border: 'none', transition: { duration: 0.2 } }}
                        className="p-3 rounded-xl border border-border bg-secondary/30 dark:bg-secondary/10 flex gap-3 transition-colors overflow-hidden"
                      >
                        <div className="mt-0.5 shrink-0">
                          {notification.title.includes('Divergência') ? (
                            <AlertTriangle className="w-5 h-5 text-yellow-500 dark:text-yellow-400" />
                          ) : (
                            <Package className="w-5 h-5 text-red-500 dark:text-red-400" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start mb-1">
                            <p className="text-sm font-medium text-foreground">
                              {notification.title}
                            </p>
                            <span className="text-[10px] text-muted-foreground shrink-0 ml-2">
                              {new Date(notification.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground leading-normal">
                            {notification.message}
                          </p>
                        </div>
                        <button 
                          onClick={() => markAsRead(notification.id)}
                          className="shrink-0 p-1.5 text-blue-500 hover:text-blue-600 hover:bg-blue-500/10 dark:text-blue-400 dark:hover:bg-blue-400/10 rounded-lg h-fit transition-colors"
                          title="Marcar como lida"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      </motion.div>
                    ))
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
