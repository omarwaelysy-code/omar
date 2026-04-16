import React, { useState } from 'react';
import { Shield, Lock, User as UserIcon, ArrowRight, Eye, EyeOff, Languages } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';

interface LoginProps {
  onToggle: () => void;
}

export const Login: React.FC<LoginProps> = ({ onToggle }) => {
  const { t, dir, language, setLanguage } = useLanguage();
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
        throw new Error(t('auth.invalid_email'));
      }

      await login(cleanEmail, password);
    } catch (e: any) {
      console.error('Login error:', e);
      setError(e.message || t('auth.login_error_general'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4 relative" dir={dir}>
      <div className={`absolute top-8 ${dir === 'rtl' ? 'left-8' : 'right-8'}`}>
        <button 
          onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-zinc-200 rounded-2xl text-zinc-600 font-bold hover:bg-zinc-50 transition-all shadow-sm"
        >
          <Languages size={20} />
          <span>{language === 'ar' ? 'English' : 'العربية'}</span>
        </button>
      </div>

      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-emerald-500 text-white shadow-xl shadow-emerald-500/20 mb-4">
            <Shield size={32} />
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-zinc-900 italic serif">{t('common.app_name')}</h1>
          <p className="text-zinc-500">{t('common.app_description')}</p>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-zinc-100">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className={`p-4 bg-red-50 text-red-600 rounded-2xl text-sm font-medium border border-red-100 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                {error}
              </div>
            )}
            
            <div className="space-y-4">
              <div className="relative">
                <UserIcon className={`absolute ${dir === 'rtl' ? 'right-4' : 'left-4'} top-4 text-zinc-400`} size={20} />
                <input
                  required
                  type="email"
                  placeholder={t('common.email')}
                  className={`w-full ${dir === 'rtl' ? 'pr-12 pl-4' : 'pl-12 pr-4'} py-4 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all ${dir === 'rtl' ? 'text-right' : 'text-left'}`}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="relative">
                <Lock className={`absolute ${dir === 'rtl' ? 'right-4' : 'left-4'} top-4 text-zinc-400`} size={20} />
                <input
                  required
                  type={showPassword ? "text" : "password"}
                  placeholder={t('common.password')}
                  className={`w-full ${dir === 'rtl' ? 'pr-12 pl-12' : 'pl-12 pr-12'} py-4 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all ${dir === 'rtl' ? 'text-right' : 'text-left'}`}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className={`absolute ${dir === 'rtl' ? 'left-4' : 'right-4'} top-4 text-zinc-400 hover:text-zinc-600 transition-colors`}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              <div className={dir === 'rtl' ? 'text-right' : 'text-left'}>
                <button 
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-xs text-zinc-500 hover:text-emerald-600 transition-colors"
                >
                  {t('common.forgot_password')}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-zinc-900 text-white rounded-2xl font-bold hover:bg-zinc-800 transition-all flex items-center justify-center gap-2 group disabled:opacity-50"
            >
              {loading ? t('common.loading_login') : t('common.login')}
              <ArrowRight size={20} className={`group-hover:-translate-x-1 transition-transform ${dir === 'rtl' ? 'rotate-180' : ''}`} />
            </button>
          </form>
        </div>
        
        <p className="text-center text-zinc-400 text-xs">
          &copy; 2026 AccuSmart AI. {t('common.copyright')}
        </p>
      </div>
    </div>
  );
};
