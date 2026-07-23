import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { Account } from '../types';
import { Save, Settings, BookOpen, User, Truck, History } from 'lucide-react';
import { dbService } from '../services/dbService';
import { InlineActivityLog } from '../components/InlineActivityLog';
import { useLanguage } from '../contexts/LanguageContext';

export const DiscountSettings: React.FC = () => {
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const { t, dir } = useLanguage();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [settings, setSettings] = useState({
    customer_discount_account_id: '',
    supplier_discount_account_id: ''
  });

  useEffect(() => {
    if (user) {
      const unsubAccounts = dbService.subscribe<Account>('accounts', user.company_id, setAccounts);
      
      // Fetch existing settings
      const fetchSettings = async () => {
        try {
          const docs = await dbService.getDocsByFilter<any>('settings', user.company_id, [
            { field: 'type', operator: '==', value: 'discount_settings' }
          ]);
          if (docs.length > 0) {
            setSettingsId(docs[0].id);
            setSettings({
              customer_discount_account_id: docs[0].customer_discount_account_id || '',
              supplier_discount_account_id: docs[0].supplier_discount_account_id || ''
            });
          }
        } catch (e) {
          console.error('Error fetching discount settings:', e);
        } finally {
          setLoading(false);
        }
      };

      fetchSettings();
      return () => unsubAccounts();
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);

    try {
      const custDiscountAccount = accounts.find(a => a.id === settings.customer_discount_account_id);
      const suppDiscountAccount = accounts.find(a => a.id === settings.supplier_discount_account_id);

      if (settings.customer_discount_account_id && (!custDiscountAccount || (custDiscountAccount.account_usage !== 'earned_discounts' && custDiscountAccount.account_usage !== 'sales_discount'))) {
        showNotification('خطأ: حساب خصم العملاء (مسموح به) يلزم أن يكون من قسم (قائمة الدخل - إيرادات) بـ استخدام (خصم مبيعات)', 'error');
        setSaving(false);
        return;
      }

      if (settings.supplier_discount_account_id && (!suppDiscountAccount || (suppDiscountAccount.account_usage !== 'granted_discounts' && suppDiscountAccount.account_usage !== 'purchase_discount'))) {
        showNotification('خطأ: حساب خصم الموردين (مكتسب) يلزم أن يكون من قسم (قائمة الدخل - تكاليف) بـ استخدام (خصم مشتريات)', 'error');
        setSaving(false);
        return;
      }

      const docs = await dbService.getDocsByFilter<any>('settings', user.company_id, [
        { field: 'type', operator: '==', value: 'discount_settings' }
      ]);

      if (docs.length > 0) {
        await dbService.update('settings', docs[0].id, {
          ...settings,
          updated_at: new Date().toISOString()
        });
        setSettingsId(docs[0].id);
      } else {
        const id = await dbService.add('settings', {
          ...settings,
          type: 'discount_settings',
          company_id: user.company_id,
          created_at: new Date().toISOString()
        });
        setSettingsId(id);
      }

      await dbService.logActivity(user.id, user.username, user.company_id, t('discount_settings.activity_log_action'), t('discount_settings.activity_log_desc'), 'settings', settingsId || undefined);
      showNotification(t('discount_settings.toast_success'));
    } catch (e) {
      console.error(e);
      showNotification(t('discount_settings.toast_error'), 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-10 space-y-12 animate-in fade-in duration-700" dir={dir}>
      <div className="flex flex-col md:flex-row items-center justify-between gap-8 pb-4 border-b border-slate-100">
        <div>
          <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tighter mb-3 leading-none italic serif">
            {t('discount_settings.title')}
          </h1>
          <p className="text-slate-400 font-bold uppercase tracking-[0.3em] text-xs">
            {t('discount_settings.subtitle')}
          </p>
        </div>
        <div className="w-20 h-20 bg-emerald-600 text-white rounded-[2rem] flex items-center justify-center shadow-2xl shadow-emerald-500/20 active:scale-95 transition-all">
          <Settings size={36} />
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-12">
        <div className="bg-white p-10 md:p-14 rounded-[3.5rem] border border-slate-100 shadow-xl shadow-slate-200/50 space-y-10">
          <div className="flex items-center gap-4 border-b border-slate-50 pb-8">
             <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center shadow-inner">
                <BookOpen size={24} />
             </div>
             <h2 className="text-2xl font-black text-slate-900 leading-none tracking-tight">
                {t('discount_settings.default_accounts')}
             </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            {/* Customer Discount Account */}
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
                  <User size={24} />
                </div>
                <h3 className="font-black text-xl text-slate-800 tracking-tight">{t('discount_settings.customer_discount_label')}</h3>
              </div>
              <p className="text-sm text-slate-400 font-medium leading-relaxed px-1">
                {t('discount_settings.customer_discount_desc')}
              </p>
              <div className="relative group">
                <BookOpen className={`absolute ${dir === 'rtl' ? 'right-5' : 'left-5'} top-5 text-slate-300 group-focus-within:text-emerald-500 transition-colors pointer-events-none`} size={24} />
                <select
                  className={`w-full ${dir === 'rtl' ? 'pr-14 pl-6' : 'pl-14 pr-6'} py-5 bg-slate-50 border border-slate-100 rounded-[2rem] text-xl font-black text-slate-900 appearance-none outline-none focus:bg-white focus:ring-8 focus:ring-emerald-500/5 focus:border-emerald-500/50 transition-all shadow-inner`}
                  value={settings.customer_discount_account_id}
                  onChange={(e) => setSettings({ ...settings, customer_discount_account_id: e.target.value })}
                >
                  <option value="">{t('discount_settings.select_account')}</option>
                  {accounts.filter(a => a.account_usage === 'earned_discounts' || a.account_usage === 'sales_discount').map(account => (
                    <option key={account.id} value={account.id}>{account.name} ({account.code})</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Supplier Discount Account */}
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl">
                  <Truck size={24} />
                </div>
                <h3 className="font-black text-xl text-slate-800 tracking-tight">{t('discount_settings.supplier_discount_label')}</h3>
              </div>
              <p className="text-sm text-slate-400 font-medium leading-relaxed px-1">
                {t('discount_settings.supplier_discount_desc')}
              </p>
              <div className="relative group">
                <BookOpen className={`absolute ${dir === 'rtl' ? 'right-5' : 'left-5'} top-5 text-slate-300 group-focus-within:text-amber-500 transition-colors pointer-events-none`} size={24} />
                <select
                  className={`w-full ${dir === 'rtl' ? 'pr-14 pl-6' : 'pl-14 pr-6'} py-5 bg-slate-50 border border-slate-100 rounded-[2rem] text-xl font-black text-slate-900 appearance-none outline-none focus:bg-white focus:ring-8 focus:ring-amber-500/5 focus:border-amber-500/50 transition-all shadow-inner`}
                  value={settings.supplier_discount_account_id}
                  onChange={(e) => setSettings({ ...settings, supplier_discount_account_id: e.target.value })}
                >
                  <option value="">{t('discount_settings.select_account')}</option>
                  {accounts.filter(a => a.account_usage === 'granted_discounts' || a.account_usage === 'purchase_discount').map(account => (
                    <option key={account.id} value={account.id}>{account.name} ({account.code})</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="pt-10 flex border-t border-slate-50">
            <button
              type="submit"
              disabled={saving}
              className="group relative px-16 py-6 bg-zinc-900 border border-white/10 text-white rounded-[2rem] shadow-2xl overflow-hidden transition-all hover:bg-zinc-800 active:scale-95 disabled:opacity-50"
            >
              <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative z-10 flex items-center gap-4 font-black uppercase tracking-widest text-xl">
                {saving ? (
                  <div className="w-6 h-6 border-4 border-white/20 border-t-white rounded-full animate-spin" />
                ) : (
                  <Save size={24} className="group-hover:rotate-12 transition-transform" />
                )}
                {t('discount_settings.save_settings')}
              </div>
            </button>
          </div>
        </div>
      </form>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        <div className="bg-emerald-600 p-10 rounded-[3rem] text-white shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="relative z-10 space-y-6">
            <div className="flex items-center gap-4">
              <div className="p-4 bg-white/10 rounded-2xl backdrop-blur-md">
                <BookOpen size={32} />
              </div>
              <h4 className="text-2xl font-black tracking-tight">{t('discount_settings.why_define_title')}</h4>
            </div>
            <p className="text-emerald-50 font-medium leading-relaxed text-lg italic serif">
              {t('discount_settings.why_define_desc')}
            </p>
          </div>
        </div>

        {settingsId && (
          <div className="bg-white rounded-[3rem] border border-slate-100 shadow-xl shadow-slate-200/50 overflow-hidden flex flex-col">
            <div className="p-8 border-b border-slate-50 bg-slate-50/50 flex items-center gap-4">
               <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center text-slate-400">
                 <History size={24} />
               </div>
               <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">{t('discount_settings.recent_activity')}</span>
                  <h3 className="font-black text-slate-900 text-lg">{t('discount_settings.edit_history')}</h3>
               </div>
            </div>
            <div className="flex-1 max-h-[300px] overflow-y-auto">
              <InlineActivityLog category="settings" documentId={settingsId} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
