import React, { useState } from 'react';
import { X, Lock, Eye, EyeOff, Check, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useNotification } from '../contexts/NotificationContext';
import { dbService } from '../services/dbService';

export const ChangePasswordModal: React.FC = () => {
  const { user, logout } = useAuth();
  const { t, dir } = useLanguage();
  const { showNotification } = useNotification();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!user || !user.must_change_password) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      showNotification(t('auth.password_mismatch'), 'error');
      return;
    }

    if (newPassword.length < 6) {
      showNotification(t('auth.password_min_length'), 'error');
      return;
    }

    setLoading(true);
    try {
      // Use the generic update endpoint
      // Our backend now handles hashing if "password" key is present
      await dbService.update('users', user.id, {
        password: newPassword,
        must_change_password: false,
        temp_password: null
      });

      showNotification(t('auth.password_change_success'), 'success');
      
      // Delay logout slightly to show notification
      setTimeout(() => {
        logout();
      }, 2000);
    } catch (error: any) {
      console.error('Error changing password:', error);
      showNotification(error.message || t('auth.password_change_error'), 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-zinc-900/60 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 border border-zinc-100">
        <div className="p-8 border-b border-zinc-50 bg-stone-50 text-center relative">
          <div className="mx-auto w-16 h-16 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center mb-4">
            <Lock size={32} />
          </div>
          <h3 className="text-2xl font-black text-zinc-900">{t('auth.update_password_title')}</h3>
          <p className="text-sm text-zinc-500 font-bold mt-1">{t('auth.must_change_password_msg')}</p>
        </div>
        
        <form onSubmit={handleSubmit} className="p-8 space-y-6" dir={dir}>
          <div className="space-y-4">
            <div className="relative">
              <Lock className={`absolute ${dir === 'rtl' ? 'right-4' : 'left-4'} top-4 text-zinc-400`} size={20} />
              <input
                required
                type={showPassword ? "text" : "password"}
                placeholder={t('auth.new_password')}
                className={`w-full ${dir === 'rtl' ? 'pr-12 pl-12' : 'pl-12 pr-12'} py-4 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-bold`}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className={`absolute ${dir === 'rtl' ? 'left-4' : 'right-4'} top-4 text-zinc-400 hover:text-zinc-600`}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>

            <div className="relative">
              <Lock className={`absolute ${dir === 'rtl' ? 'right-4' : 'left-4'} top-4 text-zinc-400`} size={20} />
              <input
                required
                type={showPassword ? "text" : "password"}
                placeholder={t('auth.confirm_password')}
                className={`w-full ${dir === 'rtl' ? 'pr-12 pl-4' : 'pl-12 pr-4'} py-4 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-bold`}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-100 rounded-2xl text-blue-700 text-left">
            <AlertCircle size={20} className="shrink-0 mt-0.5" />
            <p className="text-xs font-bold leading-relaxed">
              {t('users.temp_password_hint')}
            </p>
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-zinc-900 text-white rounded-2xl font-bold hover:bg-zinc-800 transition-all flex items-center justify-center gap-2 shadow-xl shadow-zinc-900/20 disabled:opacity-50"
          >
            {loading ? t('common.updating') : t('auth.change_and_continue')}
            <Check size={20} />
          </button>
        </form>
      </div>
    </div>
  );
};
