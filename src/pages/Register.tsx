import React, { useState } from 'react';
import { Shield, Lock, User as UserIcon, ArrowRight, Building2, Mail, Languages, Home } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { dbService } from '../services/dbService';

interface RegisterProps {
  onToggle: () => void;
  onBack?: () => void;
}

export const Register: React.FC<RegisterProps> = ({ onToggle, onBack }) => {
  const { t, dir, language, setLanguage } = useLanguage();
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [companyIdToJoin, setCompanyIdToJoin] = useState('');
  const [registerMode, setRegisterMode] = useState<'create' | 'join'>('create');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (registerMode === 'join' && !companyIdToJoin) {
      setError(t('auth.company_id_required'));
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      let finalCompanyId = companyIdToJoin;
      
      if (registerMode === 'create') {
        // 1. Create Company
        const companyId = await dbService.add('companies', {
          name: companyName,
          code: companyName.substring(0, 3).toUpperCase() + Math.floor(Math.random() * 1000)
        });
        finalCompanyId = companyId;
      } else {
        // 2. Verify Company ID exists
        const company = await dbService.get<any>('companies', companyIdToJoin);
        if (!company) {
          throw new Error(t('auth.invalid_company_id'));
        }
      }

      // 3. Register User
      await fetch('/api/erp/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          email,
          password,
          company_id: finalCompanyId,
          role: registerMode === 'create' ? 'admin' : 'user'
        })
      });

      // 4. Success - switch to login
      onToggle();
    } catch (e: any) {
      setError(e.message || t('auth.register_failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4 relative" dir={dir}>
      {/* Navigation Buttons: Main Website & Language */}
      <div className={`absolute top-6 ${dir === 'rtl' ? 'right-6 sm:right-8' : 'left-6 sm:left-8'} z-20`}>
        <button 
          type="button"
          onClick={() => onBack ? onBack() : (window.location.href = '/')}
          className="flex items-center gap-2 px-3.5 py-2 bg-white/90 backdrop-blur-md border border-zinc-200 rounded-xl text-zinc-700 font-bold hover:text-emerald-700 hover:border-emerald-300 hover:bg-white transition-all shadow-sm active:scale-95 text-xs sm:text-sm"
        >
          <Home size={16} className="text-emerald-600" />
          <span>{language === 'ar' ? 'الموقع التعريفي' : 'Main Website'}</span>
        </button>
      </div>

      <div className={`absolute top-6 ${dir === 'rtl' ? 'left-6 sm:left-8' : 'right-6 sm:right-8'} z-20`}>
        <button 
          onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
          className="flex items-center gap-2 px-3.5 py-2 bg-white/90 backdrop-blur-md border border-zinc-200 rounded-xl text-zinc-600 font-bold hover:bg-white transition-all shadow-sm active:scale-95 text-xs sm:text-sm"
        >
          <Languages size={16} />
          <span>{language === 'ar' ? 'English' : 'العربية'}</span>
        </button>
      </div>

      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-emerald-500 text-white shadow-xl shadow-emerald-500/20 mb-4">
            <Shield size={32} />
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-zinc-900 italic serif">{t('common.app_name')}</h1>
          <p className="text-zinc-500">{t('common.new_account_title')}</p>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-zinc-100">
          <div className="flex bg-zinc-100 p-1 rounded-2xl mb-6">
            <button 
              onClick={() => setRegisterMode('create')}
              className={`flex-1 py-2 text-sm font-bold rounded-xl transition-all ${registerMode === 'create' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
            >
              {t('common.create_company')}
            </button>
            <button 
              onClick={() => setRegisterMode('join')}
              className={`flex-1 py-2 text-sm font-bold rounded-xl transition-all ${registerMode === 'join' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
            >
              {t('common.join_company')}
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className={`p-4 bg-red-50 text-red-600 rounded-2xl text-sm font-medium border border-red-100 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                {error}
              </div>
            )}
            
            <div className="space-y-4">
              {registerMode === 'create' ? (
                <div className="relative">
                  <Building2 className={`absolute ${dir === 'rtl' ? 'right-4' : 'left-4'} top-4 text-zinc-400`} size={20} />
                  <input
                    required
                    type="text"
                    placeholder={t('common.company_name')}
                    className={`w-full ${dir === 'rtl' ? 'pr-12 pl-4' : 'pl-12 pr-4'} py-4 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all ${dir === 'rtl' ? 'text-right' : 'text-left'}`}
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                  />
                </div>
              ) : (
                <div className="relative">
                  <Building2 className={`absolute ${dir === 'rtl' ? 'right-4' : 'left-4'} top-4 text-zinc-400`} size={20} />
                  <input
                    required
                    type="text"
                    placeholder={t('common.company_id')}
                    className={`w-full ${dir === 'rtl' ? 'pr-12 pl-4' : 'pl-12 pr-4'} py-4 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all ${dir === 'rtl' ? 'text-right' : 'text-left'} font-mono`}
                    value={companyIdToJoin}
                    onChange={(e) => setCompanyIdToJoin(e.target.value)}
                  />
                </div>
              )}
              <div className="relative">
                <UserIcon className={`absolute ${dir === 'rtl' ? 'right-4' : 'left-4'} top-4 text-zinc-400`} size={20} />
                <input
                  required
                  type="text"
                  placeholder={t('common.username')}
                  className={`w-full ${dir === 'rtl' ? 'pr-12 pl-4' : 'pl-12 pr-4'} py-4 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all ${dir === 'rtl' ? 'text-right' : 'text-left'}`}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
              <div className="relative">
                <Mail className={`absolute ${dir === 'rtl' ? 'right-4' : 'left-4'} top-4 text-zinc-400`} size={20} />
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
                  type="password"
                  placeholder={t('common.password')}
                  className={`w-full ${dir === 'rtl' ? 'pr-12 pl-4' : 'pl-12 pr-4'} py-4 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all ${dir === 'rtl' ? 'text-right' : 'text-left'}`}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-zinc-900 text-white rounded-2xl font-bold hover:bg-zinc-800 transition-all flex items-center justify-center gap-2 group disabled:opacity-50"
            >
              {loading ? t('common.register_loading') : t('common.register')}
              <ArrowRight size={20} className={`group-hover:-translate-x-1 transition-transform ${dir === 'rtl' ? 'rotate-180' : ''}`} />
            </button>
          </form>
          
          <div className="mt-6 flex flex-col items-center gap-3">
            <button 
              type="button"
              onClick={onToggle}
              className="text-sm text-emerald-600 font-bold hover:underline"
            >
              {t('common.have_account')}
            </button>
            <button 
              type="button"
              onClick={() => onBack ? onBack() : (window.location.href = '/')}
              className="text-xs text-zinc-500 hover:text-emerald-700 font-medium transition-colors"
            >
              {language === 'ar' ? '← العودة إلى الموقع التعريفي' : '← Back to Website'}
            </button>
          </div>
        </div>
        
        <p className="text-center text-zinc-400 text-xs">
          &copy; 2026 Obrain ERP AI. {t('common.copyright')}
        </p>
      </div>
    </div>
  );
};
