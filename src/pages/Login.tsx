import React, { useState } from 'react';
import { Lock, User as UserIcon, ArrowRight, Eye, EyeOff, Languages, Shield, Sun, Moon } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { Logo } from '../components/Logo';
import { motion } from 'framer-motion';

interface LoginProps {
  onToggle: () => void;
}

export const Login: React.FC<LoginProps> = ({ onToggle }) => {
  const { t, dir, language, setLanguage } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleForgotPassword = () => {
    setError('يرجى التواصل مع مدير النظام لإعادة تعيين كلمة المرور.');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    setLoading(true);
    setError('');
    
    try {
      const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail);
      if (!isEmail) {
        throw new Error("يرجى إدخال بريد إلكتروني صحيح");
      }

      await login(cleanEmail, password);
    } catch (e: any) {
      console.error('Login error:', e);
      setError(e.message || "حدث خطأ أثناء تسجيل الدخول");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center p-4 relative overflow-hidden font-sans transition-colors duration-500" dir={dir}>
      {/* Decorative Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-brand-primary/5 dark:bg-brand-primary/10 blur-[120px] rounded-full" />
        <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-brand-primary/10 dark:bg-brand-primary/5 blur-[120px] rounded-full" />
      </div>

      <div className={`absolute top-8 ${dir === 'rtl' ? 'left-8' : 'right-8'} flex items-center gap-3`}>
        <button 
          onClick={toggleTheme}
          className="p-3 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-md border border-zinc-200 dark:border-white/5 rounded-2xl text-zinc-600 dark:text-zinc-400 hover:bg-white dark:hover:bg-zinc-800 transition-all shadow-sm active:scale-95"
        >
          {theme === 'dark' ? <Sun size={20} className="text-amber-500" /> : <Moon size={20} />}
        </button>
        <button 
          onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
          className="flex items-center gap-2 px-4 py-2 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-md border border-zinc-200 dark:border-white/5 rounded-2xl text-zinc-600 dark:text-zinc-400 font-bold hover:bg-white dark:hover:bg-zinc-800 transition-all shadow-sm active:scale-95"
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
          <Logo variant="full" className="h-16 justify-center mb-4" />
          <p className="text-zinc-500 dark:text-zinc-400 font-medium">{t('common.app_description')}</p>
        </div>

        <div className="glass-card p-10 relative">
          <form onSubmit={handleSubmit} className="space-y-8">
            {error && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className={`p-4 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 rounded-2xl text-sm font-bold border border-red-100 dark:border-red-500/20 ${dir === 'rtl' ? 'text-right' : 'text-left'} flex items-center gap-2`}
              >
                <div className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
                {error}
              </motion.div>
            )}
            
            <div className="space-y-5">
              <div className="relative group">
                <div className={`absolute ${dir === 'rtl' ? 'right-5' : 'left-5'} top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-brand-primary transition-colors`}>
                  <UserIcon size={20} />
                </div>
                <input
                  required
                  type="email"
                  placeholder={t('common.email')}
                  className={`premium-input ${dir === 'rtl' ? 'pr-14 pl-5' : 'pl-14 pr-5'}`}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="relative group">
                <div className={`absolute ${dir === 'rtl' ? 'right-5' : 'left-5'} top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-brand-primary transition-colors`}>
                  <Lock size={20} />
                </div>
                <input
                  required
                  type={showPassword ? "text" : "password"}
                  placeholder={t('common.password')}
                  className={`premium-input ${dir === 'rtl' ? 'pr-14 pl-14' : 'pl-14 pr-14'}`}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className={`absolute ${dir === 'rtl' ? 'left-4' : 'right-4'} top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors p-1`}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>

              <div className={dir === 'rtl' ? 'text-right px-2' : 'text-left px-2'}>
                <button 
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-xs text-zinc-400 dark:text-zinc-500 font-bold hover:text-brand-primary transition-colors"
                >
                  {t('common.forgot_password')}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="premium-button-primary w-full flex items-center justify-center gap-3 group"
            >
              <span className="text-lg">
                {loading ? t('common.loading') : t('common.login')}
              </span>
              {!loading && (
                <ArrowRight 
                  size={20} 
                  className={`transition-transform group-hover:translate-x-1 ${dir === 'rtl' ? 'rotate-180 group-hover:-translate-x-1' : ''}`} 
                />
              )}
            </button>
          </form>

          {/* Additional info/security badges */}
          <div className="mt-8 flex items-center justify-center gap-6 border-t border-zinc-100 dark:border-white/5 pt-8 opacity-40 grayscale group-hover:grayscale-0 transition-all">
            <div className="flex items-center gap-1.5 grayscale">
              <Shield size={14} className="text-zinc-400 dark:text-zinc-500" />
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-500">Secure AES-256</span>
            </div>
            <div className="w-1 h-1 rounded-full bg-zinc-200 dark:bg-zinc-800" />
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-500">Trusted by 10k+</span>
          </div>
        </div>
        
        <div className="mt-10 flex flex-col items-center gap-3">
          <p className="text-zinc-400 dark:text-zinc-600 text-[10px] font-bold uppercase tracking-[0.2em]">
            &copy; 2026 OBRAIN ERP • v2.0
          </p>
          <div className="flex items-center gap-4 text-[10px] font-black text-zinc-300 dark:text-zinc-700 uppercase tracking-widest">
            <a href="#" className="hover:text-brand-primary transition-colors">Privacy</a>
            <span>•</span>
            <a href="#" className="hover:text-brand-primary transition-colors">Terms</a>
            <span>•</span>
            <a href="#" className="hover:text-brand-primary transition-colors">Support</a>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
