import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Building2, 
  Upload, 
  Globe, 
  Coins, 
  Calendar, 
  MapPin, 
  FileText, 
  ShieldCheck,
  Save,
  Loader2,
  Image as ImageIcon
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { dbService } from '../services/dbService';
import { COUNTRIES, CURRENCIES } from '../constants/company';
import toast from 'react-hot-toast';

interface CompanyData {
  id: string;
  name: string;
  logo_url: string;
  commercial_register: string;
  tax_number: string;
  country: string;
  address: string;
  currency: string;
  fiscal_year_end: string;
}

export function CompanySettings() {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<CompanyData>({
    id: '',
    name: '',
    logo_url: '',
    commercial_register: '',
    tax_number: '',
    country: '',
    address: '',
    currency: 'EGP',
    fiscal_year_end: new Date(new Date().getFullYear(), 11, 31).toISOString().split('T')[0]
  });

  useEffect(() => {
    if (user?.company_id) {
      loadCompanyData();
    }
  }, [user?.company_id]);

  const loadCompanyData = async () => {
    try {
      setLoading(true);
      const company = await dbService.get<any>('companies', user!.company_id);
      if (company) {
        setData({
          id: company.id,
          name: company.name || '',
          logo_url: company.logo_url || '',
          commercial_register: company.commercial_register || '',
          tax_number: company.tax_number || '',
          country: company.country || '',
          address: company.address || '',
          currency: company.currency || 'EGP',
          fiscal_year_end: company.fiscal_year_end ? new Date(company.fiscal_year_end).toISOString().split('T')[0] : new Date(new Date().getFullYear(), 11, 31).toISOString().split('T')[0]
        });
      }
    } catch (error) {
      console.error('Failed to load company data:', error);
      toast.error(t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.company_id) return;

    try {
      setSaving(true);
      await dbService.update('companies', user.company_id, {
        name: data.name,
        logo_url: data.logo_url,
        commercial_register: data.commercial_register,
        tax_number: data.tax_number,
        country: data.country,
        address: data.address,
        currency: data.currency,
        fiscal_year_end: data.fiscal_year_end
      });
      toast.success(t('company_settings.save_success'));
    } catch (error) {
      console.error('Failed to save company settings:', error);
      toast.error(t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Simple base64 for now, usually we'd upload to a storage service
    const reader = new FileReader();
    reader.onloadend = () => {
      setData(prev => ({ ...prev, logo_url: reader.result as string }));
    };
    reader.readAsDataURL(file);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-900 mb-2">{t('company_settings.title')}</h1>
        <p className="text-zinc-500">{t('company_settings.subtitle')}</p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Logo Section */}
        <section className="bg-white p-6 rounded-xl border border-zinc-200 shadow-sm">
          <div className="flex items-center gap-2 mb-4 text-indigo-600">
            <ImageIcon className="w-5 h-5" />
            <h2 className="font-semibold">{t('company_settings.logo')}</h2>
          </div>
          <div className="flex items-center gap-6">
            <div className="w-32 h-32 rounded-lg border-2 border-dashed border-zinc-200 flex items-center justify-center bg-zinc-50 relative overflow-hidden group">
              {data.logo_url ? (
                <img src={data.logo_url} alt="Logo" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
              ) : (
                <Building2 className="w-12 h-12 text-zinc-300" />
              )}
              <label className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                <Upload className="w-6 h-6 text-white" />
                <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} />
              </label>
            </div>
            <div className="flex-1">
              <p className="text-sm text-zinc-500 mb-2">
                {language === 'ar' 
                  ? 'يفضل استخدام صورة مربعة بحجم 512x512 بيكسل على الأقل' 
                  : 'Prefer a square image, at least 512x512 pixels'}
              </p>
              <button 
                type="button"
                onClick={() => document.querySelector<HTMLInputElement>('input[type="file"]')?.click()}
                className="px-4 py-2 border border-zinc-200 rounded-lg text-sm font-medium hover:bg-zinc-50 transition-colors flex items-center gap-2"
              >
                <Upload className="w-4 h-4" />
                {t('common.add')}
              </button>
            </div>
          </div>
        </section>

        {/* Basic Info */}
        <section className="bg-white p-6 rounded-xl border border-zinc-200 shadow-sm">
          <div className="flex items-center gap-2 mb-6 text-indigo-600">
            <FileText className="w-5 h-5" />
            <h2 className="font-semibold">{language === 'ar' ? 'المعلومات الأساسية' : 'Basic Information'}</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-2">
                {t('company_settings.name')}
              </label>
              <input
                type="text"
                value={data.name}
                onChange={(e) => setData({ ...data, name: e.target.value })}
                className="w-full px-4 py-2 rounded-lg border border-zinc-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-2">
                {t('company_settings.commercial_register')}
              </label>
              <input
                type="text"
                value={data.commercial_register}
                onChange={(e) => setData({ ...data, commercial_register: e.target.value })}
                className="w-full px-4 py-2 rounded-lg border border-zinc-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-2">
                {t('company_settings.tax_number')}
              </label>
              <input
                type="text"
                value={data.tax_number}
                onChange={(e) => setData({ ...data, tax_number: e.target.value })}
                className="w-full px-4 py-2 rounded-lg border border-zinc-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-2">
                {t('company_settings.country')}
              </label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
                <select
                  value={data.country}
                  onChange={(e) => setData({ ...data, country: e.target.value })}
                  className="w-full pl-10 pr-4 py-2 rounded-lg border border-zinc-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none appearance-none"
                >
                  <option value="">{t('common.select_category')}</option>
                  {COUNTRIES.map(c => (
                    <option key={c.code} value={c.code}>
                      {language === 'ar' ? c.nameAr : c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-zinc-700 mb-2">
                {t('company_settings.address')}
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 w-4 h-4 text-zinc-400 pointer-events-none" />
                <textarea
                  value={data.address}
                  onChange={(e) => setData({ ...data, address: e.target.value })}
                  rows={3}
                  className="w-full pl-10 pr-4 py-2 rounded-lg border border-zinc-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Financial Info */}
        <section className="bg-white p-6 rounded-xl border border-zinc-200 shadow-sm">
          <div className="flex items-center gap-2 mb-6 text-indigo-600">
            <Coins className="w-5 h-5" />
            <h2 className="font-semibold">{language === 'ar' ? 'الإعدادات المالية' : 'Financial Settings'}</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-2">
                {t('company_settings.currency')}
                <span className="text-red-500 ml-1">*</span>
              </label>
              <select
                value={data.currency}
                required
                onChange={(e) => setData({ ...data, currency: e.target.value })}
                className="w-full px-4 py-2 rounded-lg border border-zinc-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none appearance-none"
              >
                {CURRENCIES.map(c => (
                  <option key={c.code} value={c.code}>
                    {language === 'ar' ? `${c.nameAr} (${c.symbol})` : `${c.name} (${c.symbol})`}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-2">
                {t('company_settings.fiscal_year_end')}
                <span className="text-red-500 ml-1">*</span>
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
                <input
                  type="date"
                  required
                  value={data.fiscal_year_end}
                  onChange={(e) => setData({ ...data, fiscal_year_end: e.target.value })}
                  className="w-full pl-10 pr-4 py-2 rounded-lg border border-zinc-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
                />
              </div>
            </div>
          </div>
        </section>

        <div className="flex justify-end gap-4 pb-8">
          <button
            type="submit"
            disabled={saving}
            className="px-8 py-3 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-100 hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center gap-2 font-semibold"
          >
            {saving ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Save className="w-5 h-5" />
            )}
            {t('common.save')}
          </button>
        </div>
      </form>
    </div>
  );
}
