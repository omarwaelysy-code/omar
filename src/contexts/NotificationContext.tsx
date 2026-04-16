import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { CheckCircle, AlertCircle, X, Info, Bell, Trash2, CheckCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { AppNotification } from '../types';
import { useAuth } from './AuthContext';
import { useNavigation } from './NavigationContext';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface NotificationContextType {
  showNotification: (message: string, type?: ToastType) => void;
  addPersistentNotification: (notification: Omit<AppNotification, 'id' | 'timestamp' | 'read'> & { id?: string }) => void;
  notifications: AppNotification[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  dismissNotification: (id: string) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
  isCenterOpen: boolean;
  setIsCenterOpen: (open: boolean) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { setCurrentPage } = useNavigation();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [persistentNotifications, setPersistentNotifications] = useState<AppNotification[]>([]);
  const [isCenterOpen, setIsCenterOpen] = useState(false);

  // Load notifications from localStorage when user changes
  useEffect(() => {
    if (user) {
      try {
        const saved = localStorage.getItem(`app_notifications_${user.company_id}`);
        setPersistentNotifications(saved ? JSON.parse(saved) : []);
      } catch (error) {
        console.error('Error loading notifications from localStorage:', error);
        setPersistentNotifications([]);
      }
    } else {
      setPersistentNotifications([]);
    }
  }, [user]);

  // Save notifications to localStorage whenever they change
  useEffect(() => {
    if (user) {
      localStorage.setItem(`app_notifications_${user.company_id}`, JSON.stringify(persistentNotifications));
    }
  }, [persistentNotifications, user]);

  const showNotification = useCallback((message: string, type: ToastType = 'success') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const addPersistentNotification = useCallback((n: Omit<AppNotification, 'id' | 'timestamp' | 'read'> & { id?: string }) => {
    const id = n.id || Math.random().toString(36).substring(2, 9);
    
    setPersistentNotifications((prev) => {
      // Check if notification with same ID already exists
      const exists = prev.find(item => item.id === id);
      if (exists) {
        // If it exists and is unread, don't add it again
        if (!exists.read) return prev;
        // If it exists but was read, we might want to "renew" it if it's a recurring alert
        // For now, let's just update the timestamp and mark as unread
        return [
          { ...exists, read: false, timestamp: new Date().toISOString(), message: n.message },
          ...prev.filter(item => item.id !== id)
        ];
      }

      const newNotification: AppNotification = {
        ...n,
        id,
        timestamp: new Date().toISOString(),
        read: false,
      };
      return [newNotification, ...prev];
    });

    // Also show a toast for persistent notifications
    showNotification(n.message, n.type);
  }, [showNotification]);

  const markAsRead = (id: string) => {
    setPersistentNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const handleNotificationClick = (n: AppNotification) => {
    markAsRead(n.id);
    if (n.path) {
      setCurrentPage(n.path);
      setIsCenterOpen(false);
    }
  };

  const dismissNotification = (id: string) => {
    setPersistentNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const markAllAsRead = () => {
    setPersistentNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const clearAll = () => {
    setPersistentNotifications([]);
  };

  const unreadCount = persistentNotifications.filter((n) => !n.read).length;

  return (
    <NotificationContext.Provider value={{ 
      showNotification, 
      addPersistentNotification,
      notifications: persistentNotifications,
      unreadCount,
      markAsRead,
      dismissNotification,
      markAllAsRead,
      clearAll,
      isCenterOpen,
      setIsCenterOpen
    }}>
      {children}
      
      {/* Toast Container */}
      <div className="fixed top-4 left-4 z-[9999] flex flex-col gap-3 pointer-events-none">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: -50, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -20, scale: 0.9 }}
              className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl border min-w-[300px] max-w-md ${
                t.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-800' :
                t.type === 'error' ? 'bg-red-50 border-red-100 text-red-800' :
                t.type === 'warning' ? 'bg-amber-50 border-amber-100 text-amber-800' :
                'bg-blue-50 border-blue-100 text-blue-800'
              }`}
            >
              {t.type === 'success' && <CheckCircle size={20} className="text-emerald-500 shrink-0" />}
              {t.type === 'error' && <AlertCircle size={20} className="text-red-500 shrink-0" />}
              {t.type === 'warning' && <AlertCircle size={20} className="text-amber-500 shrink-0" />}
              {t.type === 'info' && <Info size={20} className="text-blue-500 shrink-0" />}
              
              <p className="text-sm font-bold flex-1 text-right">{t.message}</p>
              
              <button 
                onClick={() => setToasts((prev) => prev.filter((toast) => toast.id !== t.id))}
                className="p-1 hover:bg-black/5 rounded-lg transition-colors"
              >
                <X size={16} className="opacity-50" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Notification Center Overlay */}
      <AnimatePresence>
        {isCenterOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCenterOpen(false)}
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[9990]"
            />
            <motion.div
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 100 }}
              className="fixed top-0 right-0 bottom-0 w-full max-w-md bg-white shadow-2xl z-[9991] flex flex-col"
              dir="rtl"
            >
              <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                    <Bell size={20} />
                  </div>
                  <h2 className="text-xl font-bold text-zinc-900">التنبيهات</h2>
                </div>
                <button 
                  onClick={() => setIsCenterOpen(false)}
                  className="p-2 hover:bg-zinc-100 rounded-xl transition-colors"
                >
                  <X size={20} className="text-zinc-400" />
                </button>
              </div>

              <div className="flex items-center justify-between px-6 py-3 bg-zinc-50 border-b border-zinc-100">
                <button 
                  onClick={markAllAsRead}
                  className="text-xs font-bold text-emerald-600 hover:underline flex items-center gap-1"
                >
                  <CheckCheck size={14} />
                  تحديد الكل كمقروء
                </button>
                <button 
                  onClick={clearAll}
                  className="text-xs font-bold text-red-500 hover:underline flex items-center gap-1"
                >
                  <Trash2 size={14} />
                  مسح الكل
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                {persistentNotifications.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-zinc-400 gap-4">
                    <Bell size={48} className="opacity-20" />
                    <p className="font-medium">لا توجد تنبيهات حالياً</p>
                  </div>
                ) : (
                  persistentNotifications.map((n) => (
                    <div 
                      key={n.id}
                      onClick={() => handleNotificationClick(n)}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer relative group ${
                        n.read ? 'bg-white border-zinc-100 opacity-70' : 'bg-zinc-50 border-emerald-100 shadow-sm'
                      }`}
                    >
                      {!n.read && (
                        <div className="absolute top-4 left-4 w-2 h-2 bg-emerald-500 rounded-full" />
                      )}
                      <div className="flex gap-3">
                        <div className={`p-2 rounded-xl shrink-0 ${
                          n.type === 'success' ? 'bg-emerald-100 text-emerald-600' :
                          n.type === 'error' ? 'bg-red-100 text-red-600' :
                          n.type === 'warning' ? 'bg-amber-100 text-amber-600' :
                          'bg-blue-100 text-blue-600'
                        }`}>
                          {n.type === 'success' && <CheckCircle size={18} />}
                          {n.type === 'error' && <AlertCircle size={18} />}
                          {n.type === 'warning' && <AlertCircle size={18} />}
                          {n.type === 'info' && <Info size={18} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="font-bold text-zinc-900 text-sm mb-1">{n.title}</h4>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                dismissNotification(n.id);
                              }}
                              className="p-1 hover:bg-zinc-200 rounded-lg text-zinc-400 hover:text-zinc-600 transition-colors"
                            >
                              <X size={14} />
                            </button>
                          </div>
                          <p className="text-zinc-600 text-xs leading-relaxed">{n.message}</p>
                          <p className="text-[10px] text-zinc-400 mt-2">
                            {new Date(n.timestamp).toLocaleString('ar-EG')}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};
