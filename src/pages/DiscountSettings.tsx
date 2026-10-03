import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { Account } from '../types';
import { Save, Settings, BookOpen, User, Truck, History, ChevronDown } from 'lucide-react';
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

  // Auto-suggest default matching accounts if empty
  useEffect(() => {
    if (accounts.length > 0) {
      const defaultCustAccount = accounts.find(a => a.account_usage === 'earned_discounts' || a.account_usage === 'sales_discount');
      const defaultSuppAccount = accounts.find(a => a.account_usage === 'granted_discounts' || a.account_usage === 'purchase_discount');

      setSettings(prev => ({
        customer_discount_account_id: prev.customer_discount_account_id || defaultCustAccount?.id || '',
        supplier_discount_account_id: prev.supplier_discount_account_id || defaultSuppAccount?.id || ''
      }));
    }
  }, [accounts]);

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
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6 animate-in fade-in duration-500" dir={dir}>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight mb-1">
            {t('discount_settings.title')}
          </h1>
          <p className="text-slate-500 font-medium text-xs">
            {t('discount_settings.subtitle')}
          </p>
        </div>
        <div className="w-12 h-12 bg-emerald-600 text-white rounded-2xl flex items-center justify-center shadow-md shadow-emerald-500/20">
          <Settings size={24} />
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white p-5 md:p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
             <div className="w-9 h-9 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center shadow-inner">
                <BookOpen size={18} />
             </div>
             <h2 className="text-base md:text-lg font-bold text-slate-900">
                {t('discount_settings.default_accounts')}
             </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Customer Discount Account */}
            <div className="space-y-2.5 bg-slate-50/70 p-4 rounded-xl border border-slate-200/80">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg">
                  <User size={18} />
                </div>
                <h3 className="font-bold text-sm text-slate-800">{t('discount_settings.customer_discount_label')}</h3>
              </div>
              <p className="text-xs text-slate-500 font-normal leading-relaxed">
                {t('discount_settings.customer_discount_desc')}
              </p>
              <div className="relative group">
                <BookOpen className={`absolute ${dir === 'rtl' ? 'right-3' : 'left-3'} top-3 text-slate-400 group-focus-within:text-emerald-500 transition-colors pointer-events-none`} size={18} />
                <select
                  className={`w-full ${dir === 'rtl' ? 'pr-9 pl-9' : 'pl-9 pr-9'} py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-800 appearance-none outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all shadow-sm`}
                  value={settings.customer_discount_account_id}
                  onChange={(e) => setSettings({ ...settings, customer_discount_account_id: e.target.value })}
                >
                  <option value="">{t('discount_settings.select_account')}</option>
                  {accounts.filter(a => a.account_usage === 'earned_discounts' || a.account_usage === 'sales_discount').map(account => (
                    <option key={account.id} value={account.id}>{account.name} ({account.code})</option>
                  ))}
                </select>
                <ChevronDown className={`absolute ${dir === 'rtl' ? 'left-3' : 'right-3'} top-3 text-slate-400 pointer-events-none`} size={18} />
              </div>
            </div>

            {/* Supplier Discount Account */}
            <div className="space-y-2.5 bg-slate-50/70 p-4 rounded-xl border border-slate-200/80">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-100 text-amber-700 rounded-lg">
                  <Truck size={18} />
                </div>
                <h3 className="font-bold text-sm text-slate-800">{t('discount_settings.supplier_discount_label')}</h3>
              </div>
              <p className="text-xs text-slate-500 font-normal leading-relaxed">
                {t('discount_settings.supplier_discount_desc')}
              </p>
              <div className="relative group">
                <BookOpen className={`absolute ${dir === 'rtl' ? 'right-3' : 'left-3'} top-3 text-slate-400 group-focus-within:text-amber-500 transition-colors pointer-events-none`} size={18} />
                <select
                  className={`w-full ${dir === 'rtl' ? 'pr-9 pl-9' : 'pl-9 pr-9'} py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-800 appearance-none outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all shadow-sm`}
                  value={settings.supplier_discount_account_id}
                  onChange={(e) => setSettings({ ...settings, supplier_discount_account_id: e.target.value })}
                >
                  <option value="">{t('discount_settings.select_account')}</option>
                  {accounts.filter(a => a.account_usage === 'granted_discounts' || a.account_usage === 'purchase_discount').map(account => (
                    <option key={account.id} value={account.id}>{account.name} ({account.code})</option>
                  ))}
                </select>
                <ChevronDown className={`absolute ${dir === 'rtl' ? 'left-3' : 'right-3'} top-3 text-slate-400 pointer-events-none`} size={18} />
              </div>
            </div>
          </div>

          <div className="pt-3 flex border-t border-slate-100">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-zinc-900 text-white rounded-xl shadow hover:bg-zinc-800 active:scale-95 disabled:opacity-50 transition-all font-bold text-sm flex items-center gap-2"
            >
              {saving ? (
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              ) : (
                <Save size={18} />
              )}
              <span>{t('discount_settings.save_settings')}</span>
            </button>
          </div>
        </div>
      </form>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-emerald-600 p-5 rounded-2xl text-white shadow-md relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
          <div className="relative z-10 space-y-2.5">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-white/10 rounded-xl backdrop-blur-md">
                <BookOpen size={18} />
              </div>
              <h4 className="text-sm font-bold tracking-tight">{t('discount_settings.why_define_title')}</h4>
            </div>
            <p className="text-emerald-50 font-normal leading-relaxed text-xs">
              {t('discount_settings.why_define_desc')}
            </p>
          </div>
        </div>

        {settingsId && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="p-3.5 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2.5">
               <div className="w-7 h-7 bg-white rounded-lg shadow-sm flex items-center justify-center text-slate-400">
                 <History size={15} />
               </div>
               <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">{t('discount_settings.recent_activity')}</span>
                  <h3 className="font-bold text-slate-900 text-xs">{t('discount_settings.edit_history')}</h3>
               </div>
            </div>
            <div className="flex-1 max-h-[180px] overflow-y-auto">
              <InlineActivityLog category="settings" documentId={settingsId} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

