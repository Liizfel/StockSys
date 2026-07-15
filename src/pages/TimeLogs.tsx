import React, { useState, useEffect, useMemo } from 'react';
import { apiFetch } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { TimeLog } from '../types';
import { Clock, LogIn, LogOut, Monitor, User, Calendar, Timer } from 'lucide-react';
import { format, differenceInMinutes, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion } from 'framer-motion';

interface AccessSession {
  id: string;
  userId: string;
  userName?: string;
  loginLog: TimeLog | null;
  logoutLog: TimeLog | null;
  ipAddress: string;
  date: Date;
}

export default function TimeLogs() {
  const { token } = useAuth();
  const [logs, setLogs] = useState<TimeLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch('/api/logs/time', {}, token)
      .then(setLogs)
      .finally(() => setLoading(false));
  }, [token]);

  const sessions = useMemo(() => {
    const accessSessions: AccessSession[] = [];
    const sortedLogs = [...logs].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    
    const openSessions = new Map<string, TimeLog>();
    
    sortedLogs.forEach(log => {
      if (log.type === 'LOGIN') {
        // Se já houver uma sessão aberta, fecha como incompleta se necessário, mas aqui apenas sobrescrevemos por simplicidade ou assumimos que logaram de outro dispositivo
        openSessions.set(log.userId, log);
      } else if (log.type === 'LOGOUT') {
        const login = openSessions.get(log.userId);
        if (login) {
          accessSessions.push({
            id: login.id + '-' + log.id,
            userId: log.userId,
            userName: log.userName,
            loginLog: login,
            logoutLog: log,
            ipAddress: login.ipAddress || log.ipAddress,
            date: parseISO(login.timestamp)
          });
          openSessions.delete(log.userId);
        } else {
          accessSessions.push({
            id: 'logout-' + log.id,
            userId: log.userId,
            userName: log.userName,
            loginLog: null,
            logoutLog: log,
            ipAddress: log.ipAddress,
            date: parseISO(log.timestamp)
          });
        }
      }
    });
    
    openSessions.forEach((login, userId) => {
       accessSessions.push({
          id: 'login-' + login.id,
          userId: login.userId,
          userName: login.userName,
          loginLog: login,
          logoutLog: null,
          ipAddress: login.ipAddress,
          date: parseISO(login.timestamp)
       });
    });

    return accessSessions.sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [logs]);

  const formatDuration = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  if (loading) return <div className="p-8 text-muted-foreground flex justify-center">Analisando registros de acesso...</div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-5xl mx-auto">
      <div className="bg-card/50 backdrop-blur-md p-6 rounded-2xl border border-border shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
         <div>
            <h2 className="text-2xl font-bold text-foreground flex items-center gap-3">
               <Clock className="w-8 h-8 text-blue-500" /> Registro de Acessos
            </h2>
            <p className="text-sm text-muted-foreground mt-1">Controle de ponto: Histórico de entrada, saída, IP e tempo de sessão.</p>
         </div>
         <div className="bg-secondary/50 px-4 py-2 rounded-xl border border-border flex items-center gap-3">
            <Timer className="w-5 h-5 text-blue-500" />
            <div>
               <p className="text-xs text-muted-foreground uppercase font-semibold">Total de Sessões</p>
               <p className="font-mono font-bold text-foreground">{sessions.length}</p>
            </div>
         </div>
      </div>

      <div className="bg-card/50 backdrop-blur-md rounded-2xl border border-border shadow-sm overflow-hidden">
         {/* Desktop view: table */}
         <div className="overflow-x-auto hidden md:block">
            <table className="w-full text-left border-collapse min-w-[700px]">
               <thead>
                  <tr className="bg-secondary/30 border-b border-border">
                     <th className="p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Colaborador</th>
                     <th className="p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Data</th>
                     <th className="p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Entrada</th>
                     <th className="p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Saída</th>
                     <th className="p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Duração</th>
                     <th className="p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">IP da Máquina</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-border">
                  {sessions.map((session, index) => {
                     const hasLogin = !!session.loginLog;
                     const hasLogout = !!session.logoutLog;
                     let durationStr = '-';
                     if (hasLogin && hasLogout) {
                        const mins = differenceInMinutes(
                           parseISO(session.logoutLog!.timestamp),
                           parseISO(session.loginLog!.timestamp)
                        );
                        durationStr = formatDuration(mins);
                     } else if (hasLogin && !hasLogout) {
                        durationStr = 'Em andamento';
                     }

                     return (
                        <motion.tr 
                           initial={{ opacity: 0, y: 10 }}
                           animate={{ opacity: 1, y: 0 }}
                           transition={{ delay: index * 0.02 }}
                           key={session.id} 
                           className="hover:bg-secondary/20 transition-colors"
                        >
                           <td className="p-4 whitespace-nowrap">
                              <div className="flex items-center gap-3">
                                 <div className="w-8 h-8 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
                                    <User className="w-4 h-4" />
                                 </div>
                                 <div>
                                    <p className="font-semibold text-foreground text-sm">{session.userName || 'Desconhecido'}</p>
                                    <p className="text-xs text-muted-foreground font-mono">ID: {session.userId}</p>
                                 </div>
                              </div>
                           </td>
                           <td className="p-4 whitespace-nowrap">
                              <div className="flex items-center gap-2 text-sm text-foreground">
                                 <Calendar className="w-4 h-4 text-muted-foreground" />
                                 {format(session.date, "dd/MM/yyyy")}
                              </div>
                           </td>
                           <td className="p-4 whitespace-nowrap">
                              {hasLogin ? (
                                 <div className="flex items-center gap-2 text-sm text-foreground">
                                    <LogIn className="w-4 h-4 text-emerald-500" />
                                    {format(parseISO(session.loginLog!.timestamp), "HH:mm")}
                                 </div>
                              ) : (
                                 <span className="text-muted-foreground text-sm">-</span>
                              )}
                           </td>
                           <td className="p-4 whitespace-nowrap">
                              {hasLogout ? (
                                 <div className="flex items-center gap-2 text-sm text-foreground">
                                    <LogOut className="w-4 h-4 text-red-500" />
                                    {format(parseISO(session.logoutLog!.timestamp), "HH:mm")}
                                 </div>
                              ) : (
                                 <span className="text-xs bg-blue-500/10 text-blue-500 px-2 py-1 rounded-full font-medium">
                                    Ativo
                                 </span>
                              )}
                           </td>
                           <td className="p-4 whitespace-nowrap">
                              <span className={`text-sm font-medium ${durationStr === 'Em andamento' ? 'text-blue-500' : 'text-foreground'}`}>
                                 {durationStr}
                              </span>
                           </td>
                           <td className="p-4 whitespace-nowrap">
                              <div className="flex items-center gap-2 text-sm font-mono text-muted-foreground">
                                 <Monitor className="w-4 h-4" />
                                 {session.ipAddress}
                              </div>
                           </td>
                        </motion.tr>
                     );
                  })}
                  {sessions.length === 0 && (
                     <tr>
                        <td colSpan={6} className="p-8 text-center text-muted-foreground">
                           Nenhum registro de acesso encontrado.
                        </td>
                     </tr>
                  )}
               </tbody>
            </table>
         </div>

         {/* Mobile view: Cards list */}
         <div className="md:hidden block divide-y divide-border/60">
            {sessions.map((session, index) => {
               const hasLogin = !!session.loginLog;
               const hasLogout = !!session.logoutLog;
               let durationStr = '-';
               if (hasLogin && hasLogout) {
                  const mins = differenceInMinutes(
                     parseISO(session.logoutLog!.timestamp),
                     parseISO(session.loginLog!.timestamp)
                  );
                  durationStr = formatDuration(mins);
               } else if (hasLogin && !hasLogout) {
                  durationStr = 'Em andamento';
               }

               return (
                  <motion.div 
                     initial={{ opacity: 0, y: 10 }}
                     animate={{ opacity: 1, y: 0 }}
                     transition={{ delay: index * 0.02 }}
                     key={session.id} 
                     className="p-4 hover:bg-secondary/10 transition-colors flex flex-col gap-3"
                  >
                     {/* User & Date Header */}
                     <div className="flex justify-between items-start gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                           <div className="w-8 h-8 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0 font-bold text-xs">
                              {(session.userName || 'D').charAt(0).toUpperCase()}
                           </div>
                           <div className="min-w-0">
                              <p className="font-bold text-foreground text-sm truncate">{session.userName || 'Desconhecido'}</p>
                              <p className="text-[10px] text-muted-foreground font-mono">ID: {session.userId}</p>
                           </div>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-foreground bg-secondary/30 px-2.5 py-1 rounded-lg border border-border/40 font-medium shrink-0">
                           <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                           {format(session.date, "dd/MM/yyyy")}
                        </div>
                     </div>

                     {/* Grid: Times & IP */}
                     <div className="grid grid-cols-2 gap-3 bg-secondary/20 p-3 rounded-xl border border-border/40 text-xs">
                        <div className="space-y-1">
                           <span className="text-muted-foreground block font-medium">Entrada / Saída</span>
                           <div className="flex flex-col gap-1">
                              {hasLogin ? (
                                 <div className="flex items-center gap-1 text-foreground font-medium">
                                    <LogIn className="w-3 h-3 text-emerald-500" />
                                    {format(parseISO(session.loginLog!.timestamp), "HH:mm")}
                                 </div>
                              ) : (
                                 <span className="text-muted-foreground">-</span>
                              )}
                              {hasLogout ? (
                                 <div className="flex items-center gap-1 text-foreground font-medium">
                                    <LogOut className="w-3 h-3 text-red-500" />
                                    {format(parseISO(session.logoutLog!.timestamp), "HH:mm")}
                                 </div>
                              ) : (
                                 <span className="inline-flex items-center text-[10px] bg-blue-500/10 text-blue-500 px-1.5 py-0.5 rounded font-bold w-fit">
                                    Ativo
                                 </span>
                              )}
                           </div>
                        </div>
                        <div className="space-y-1">
                           <span className="text-muted-foreground block font-medium">Duração & IP</span>
                           <div className="flex flex-col gap-1">
                              <span className={`font-semibold ${durationStr === 'Em andamento' ? 'text-blue-500' : 'text-foreground'}`}>
                                 {durationStr}
                              </span>
                              <div className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground">
                                 <Monitor className="w-3 h-3" />
                                 {session.ipAddress}
                              </div>
                           </div>
                        </div>
                     </div>
                  </motion.div>
               );
            })}
            {sessions.length === 0 && (
               <div className="p-8 text-center text-muted-foreground">
                  Nenhum registro de acesso encontrado.
               </div>
            )}
         </div>
      </div>
    </div>
  );
}
