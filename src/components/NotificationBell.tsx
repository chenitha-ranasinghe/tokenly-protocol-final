'use client';
import { useState, useEffect, useRef } from 'react';
import { Bell, Shield, TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { authFetch } from '@/lib/client';

interface DbNotification {
  id: string;
  title: string;
  message: string;
  type: string;
  is_read: number;
  created_at?: string;
}

export default function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<DbNotification[]>([]);
  const [isMounted, setIsMounted] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifs = async () => {
    try {
      const res = await authFetch('/api/notifications');
      const data = await res.json();
      if (data.success) setNotifications(data.notifications);
    } catch (e) {}
  };

  useEffect(() => {
    setIsMounted(true);
    fetchNotifs();
    const interval = setInterval(fetchNotifs, 10000);
    return () => clearInterval(interval);
  }, []);

  const markRead = async (id?: string) => {
    try {
      await authFetch('/api/notifications', {
        method: 'PATCH',
        body: JSON.stringify(id ? { notificationId: id } : { all: true })
      });
      fetchNotifs();
    } catch (e) {}
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const getIcon = (type: string) => {
    switch (type) {
      case 'yield': return <TrendingUp size={14} color="var(--success)" />;
      case 'dispute': return <AlertTriangle size={14} color="var(--warning)" />;
      case 'slash': return <Shield size={14} color="var(--danger)" />;
      default: return <CheckCircle size={14} color="var(--rolex-gold)" />;
    }
  };

  return (
    <div style={{ position: 'relative' }} ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        style={{ background: 'transparent', border: 'none', cursor: 'pointer', position: 'relative', padding: 8 }}>
        <Bell size={20} color={isOpen ? 'var(--rolex-gold)' : 'var(--text-muted)'} />
        {unreadCount > 0 && (
          <span style={{ 
            position: 'absolute', top: 4, right: 4, background: 'var(--danger)', color: '#fff', 
            fontSize: '10px', width: 16, height: 16, borderRadius: '50%', 
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800,
            border: '2px solid var(--bg-primary)'
          }}>
            {unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            style={{ 
              position: 'absolute', top: '100%', right: 0, width: 320, background: 'var(--bg-card)', 
              border: '1px solid var(--border-heavy)', borderRadius: 12, boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
              marginTop: 12, zIndex: 100, overflow: 'hidden'
            }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-dark)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' }}>PROTOCOL PULSE</span>
              <button 
                onClick={() => markRead()}
                style={{ fontSize: '0.65rem', color: 'var(--rolex-gold)', background: 'transparent', border: 'none', cursor: 'pointer' }}>
                MARK ALL READ
              </button>
            </div>

            <div style={{ maxHeight: 400, overflowY: 'auto', padding: '12px 0' }}>
              {notifications.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  No recent activities.
                </div>
              ) : notifications.map((n, i) => (
                <div 
                  key={n.id} 
                  onClick={() => !n.is_read && markRead(n.id)}
                  style={{ 
                    padding: '12px 20px', borderBottom: i !== notifications.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none',
                    background: n.is_read ? 'transparent' : 'rgba(163,126,44,0.05)', cursor: 'pointer',
                    display: 'flex', gap: 12
                  }}>
                  <div style={{ marginTop: 2 }}>{getIcon(n.type)}</div>
                  <div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#fff', marginBottom: 2 }}>{n.title}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>{n.message}</div>
                    <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginTop: 4 }}>{isMounted ? (n.created_at ? new Date(n.created_at).toLocaleTimeString() : '—') : '---'}</div>
                  </div>
                </div>
              ))}
            </div>
            
            <div style={{ padding: 12, background: 'rgba(0,0,0,0.2)', textAlign: 'center' }}>
              <button style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', fontSize: '0.7rem', fontWeight: 600 }}>VIEW ALL HISTORY</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
