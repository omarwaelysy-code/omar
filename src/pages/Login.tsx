import React, { useState } from 'react';
import { Lock, User as UserIcon, ArrowRight, Eye, EyeOff, Languages, Shield, AlertCircle, MonitorX, LogIn } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { Logo } from '../components/Logo';
import { motion, AnimatePresence } from 'framer-motion';

interface LoginProps {
  onToggle: () => void;
}

interface SessionConflict {
  message: string;
  lastActiveAt: string;
  canForce: boolean;
  email: string;
  password: string;
}

export const Login: React.FC<LoginProps> = ({ onToggle }) => {
  const { t, dir, language, setLanguage } = useLanguage();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sessionConflict, setSessionConflict] = useState<SessionConflict | null>(null);
  const [forceLoading, setForceLoading] = useState(false);

  // Check for session invalidation message from a force-login by another device
  const invalidationMsg = sessionStorage.getItem('session_invalidated_message');
  const [error, setError] = useState(invalidationMsg || '');

  React.useEffect(() => {
    if (invalidationMsg) {
      sessionStorage.removeItem('session_invalidated_message');
    }
  }, []);


  const handleForgotPassword = () => {
    setError('يرجى التواصل مع مدير النظام لإعادة تعيين كلمة المرور.');
  };

  const doLogin = async (emailVal: string, passwordVal: string, force = false) => {
    const response = await fetch('/api/erp/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: emailVal, password: passwordVal, force })
    });

    const data = await response.json();

    if (response.status === 409 && data.error === 'SESSION_CONFLICT') {
      setSessionConflict({
        message: data.message,
        lastActiveAt: data.lastActiveAt,
        canForce: data.canForce,
        email: emailVal,
        password: passwordVal
      });
      return;
    }

    if (!response.ok) {
      throw new Error(data.error || 'فشل تسجيل الدخول');
    }

    // success - let the auth context handle the rest
    localStorage.setItem('auth_token', data.token);
    localStorage.setItem('auth_user', JSON.stringify(data.user));
    // Reload to trigger AuthContext initAuth
    window.location.reload();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    setLoading(true);
    setError('');
    setSessionConflict(null);
    
    try {
      const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail);
      if (!isEmail) {
        throw new Error("يرجى إدخال بريد إلكتروني صحيح");
      }

      await doLogin(cleanEmail, password);
    } catch (e: any) {
      console.error('Login error:', e);
      setError(e.message || "حدث خطأ أثناء تسجيل الدخول");
    } finally {
      setLoading(false);
    }
  };

  const handleForceLogin = async () => {
    if (!sessionConflict) return;
    setForceLoading(true);
    setError('');
    try {
      await doLogin(sessionConflict.email, sessionConflict.password, true);
    } catch (e: any) {
      setError(e.message || "حدث خطأ أثناء تسجيل الدخول");
      setSessionConflict(null);
    } finally {
      setForceLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 relative overflow-hidden font-sans" dir={dir}>
      {/* Decorative Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-brand-primary/5 blur-[120px] rounded-full" />
        <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-brand-primary/5 blur-[120px] rounded-full" />
      </div>

      <div className={`absolute top-8 ${dir === 'rtl' ? 'left-8' : 'right-8'}`}>
        <button 
          onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
          className="flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur-md border border-slate-200 rounded-xl text-slate-600 font-bold hover:bg-white transition-all shadow-sm active:scale-95"
        >
          <Languages size={20} />
          <span className="text-sm">{language === 'ar' ? 'English' : 'العربية'}</span>
        </button>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-[440px] z-10"
      >
        <div className="text-center mb-10">
          <Logo variant="full" size="lg" className="justify-center mb-4" />
          <p className="text-slate-500 font-medium">{t('common.app_description')}</p>
        </div>

        <div className="bg-white border border-slate-200 shadow-xl rounded-2xl p-10 relative">
          
          {/* Session Conflict Banner */}
          <AnimatePresence>
            {sessionConflict && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mb-6 rounded-2xl border-2 border-amber-300 bg-amber-50 overflow-hidden"
              >
                <div className="flex items-center gap-3 p-4 border-b border-amber-200 bg-amber-100">
                  <MonitorX className="text-amber-600 shrink-0" size={22} />
                  <span className="font-black text-amber-800 text-sm">جلسة نشطة مكتشفة</span>
                </div>
                <div className="p-4">
                  <p className="text-amber-800 text-sm font-medium leading-relaxed whitespace-pre-line mb-4">
                    {sessionConflict.message}
                  </p>
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={handleForceLogin}
                      disabled={forceLoading}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-amber-600 hover:bg-amber-700 text-white font-black rounded-xl transition-all active:scale-95 disabled:opacity-60 text-sm"
                    >
                      <LogIn size={16} />
                      {forceLoading ? 'جارٍ تسجيل الدخول...' : 'تسجيل الدخول وإنهاء الجلسة الأخرى'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setSessionConflict(null)}
                      className="w-full px-4 py-2 text-slate-500 hover:text-slate-700 font-bold text-sm transition-colors"
                    >
                      إلغاء
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-4 bg-red-50 border-2 border-red-200 text-red-700 rounded-2xl text-sm font-bold text-right flex items-start gap-3 shadow-sm"
              >
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div className="leading-relaxed">{error}</div>
              </motion.div>
            )}
            
            <div className="space-y-5">
              <div className="relative group">
                <div className={`absolute ${dir === 'rtl' ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-brand-primary transition-colors`}>
                  <UserIcon size={18} />
                </div>
                <input
                  required
                  type="email"
                  placeholder={t('common.email')}
                  className={`premium-input ${dir === 'rtl' ? 'pr-12 pl-4' : 'pl-12 pr-4'}`}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="relative group">
                <div className={`absolute ${dir === 'rtl' ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-brand-primary transition-colors`}>
                  <Lock size={18} />
                </div>
                <input
                  required
                  type={showPassword ? "text" : "password"}
                  placeholder={t('common.password')}
                  className={`premium-input ${dir === 'rtl' ? 'pr-12 pl-12' : 'pl-12 pr-12'}`}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className={`absolute ${dir === 'rtl' ? 'left-4' : 'right-4'} top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1`}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              <div className={dir === 'rtl' ? 'text-right px-1' : 'text-left px-1'}>
                <button 
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-xs text-slate-400 font-bold hover:text-brand-primary transition-colors"
                >
                  {t('common.forgot_password')}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || forceLoading}
              className="premium-button-primary w-full flex items-center justify-center gap-3 transition-opacity"
            >
              <span className="text-base">
                {loading ? t('common.loading') : t('common.login')}
              </span>
              {!loading && (
                <ArrowRight 
                  size={18} 
                  className={`transition-transform duration-300 group-hover:translate-x-1 ${dir === 'rtl' ? 'rotate-180 group-hover:-translate-x-1' : ''}`} 
                />
              )}
            </button>
          </form>

          {/* Security badges */}
          <div className="mt-8 flex items-center justify-center gap-6 border-t border-slate-100 pt-8 opacity-60">
            <div className="flex items-center gap-1.5">
              <Shield size={14} className="text-slate-400" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Secure AES-256</span>
            </div>
            <div className="w-1 h-1 rounded-full bg-slate-200" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">ERP Premium v2.0</span>
          </div>
        </div>
        
        <div className="mt-10 flex flex-col items-center gap-3">
          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em]">
            &copy; 2026 OBRAIN SYSTEM
          </p>
        </div>
      </motion.div>
    </div>
  );
};
