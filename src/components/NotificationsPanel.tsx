import React, { useEffect, useState } from 'react';
import { Bell, X, Check, Package, AlertTriangle, Inbox } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';

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
        if (err.message && (
          err.message.includes('Failed to fetch') || 
          err.message.includes('Token') || 
          err.message.includes('401')
        )) return;
        console.error('Failed to fetch notifications', err);
      }
    };

    fetchNotifications();
    const interval = setInterval(fetchNotifications, 10000);
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
        className="p-2 text-muted-foreground hover:text-foreground rounded-full hover:bg-secondary transition-colors relative flex items-center justify-center shrink-0"
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
              className="absolute right-0 mt-3 w-[calc(100vw-1rem)] sm:w-[380px] max-h-[80vh] bg-card border border-border rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden"
            >
              <div className="p-4 border-b border-border bg-secondary/30 flex items-center justify-between shrink-0">
                <div>
                  <h3 className="font-semibold text-foreground text-sm">Notificações</h3>
                  <p className="text-[10px] text-muted-foreground">Expiram após 24h</p>
                </div>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <button 
                      onClick={markAllAsRead}
                      className="text-[10px] sm:text-xs text-blue-500 hover:text-blue-600 font-medium transition-colors"
                    >
                      Marcar todas como lidas
                    </button>
                  )}
                  <span className="text-[10px] bg-blue-500/10 text-blue-500 px-2 py-0.5 rounded-full font-bold">
                    {unreadCount}
                  </span>
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                <AnimatePresence initial={false}>
                  {notifications.filter(n => !n.read).length === 0 ? (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="p-8 text-center text-sm text-muted-foreground flex flex-col items-center justify-center gap-2"
                    >
                      <Inbox className="w-8 h-8 opacity-20" />
                      Sem novas notificações
                    </motion.div>
                  ) : (
                    notifications.filter(n => !n.read).map(notification => (
                      <motion.div 
                        key={notification.id} 
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, height: 0, margin: 0, padding: 0, border: 'none' }}
                        className="p-3 rounded-xl border border-border bg-card hover:bg-secondary/30 flex gap-3 transition-colors overflow-hidden items-start"
                      >
                        <div className="mt-0.5 shrink-0">
                          {notification.title.includes('Divergência') ? (
                            <AlertTriangle className="w-5 h-5 text-yellow-500" />
                          ) : (
                            <Package className="w-5 h-5 text-red-500" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start gap-2">
                            <p className="text-sm font-semibold text-foreground truncate">{notification.title}</p>
                            <span className="text-[10px] text-muted-foreground shrink-0 font-mono">
                              {new Date(notification.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground leading-normal mt-0.5 break-words">
                            {notification.message}
                          </p>
                        </div>
                        <button 
                          onClick={() => markAsRead(notification.id)}
                          className="shrink-0 p-1.5 text-blue-500 hover:bg-blue-500/10 rounded-lg transition-colors"
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