import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { Account } from '../types';
import { Save, Settings, BookOpen, User, Truck, History } from 'lucide-react';
import { dbService } from '../services/dbService';
import { InlineActivityLog } from '../components/InlineActivityLog';

export const DiscountSettings: React.FC = () => {
  const { user } = useAuth();
  const { showNotification } = useNotification();
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

      await dbService.logActivity(user.id, user.username, user.company_id, 'تحديث إعدادات الخصومات', 'تم تحديث الحسابات الافتراضية للخصومات', 'settings', settingsId || undefined);
      showNotification('تم حفظ الإعدادات بنجاح');
    } catch (e) {
      console.error(e);
      showNotification('حدث خطأ أثناء حفظ الإعدادات', 'error');
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
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 italic serif">إعدادات الخصومات</h2>
          <p className="text-zinc-500">تحديد الحسابات المالية الافتراضية لعمليات الخصم.</p>
        </div>
        <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
          <Settings size={24} />
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-3xl border border-zinc-100 shadow-sm space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Customer Discount Account */}
          <div className="space-y-4">
            <div className="flex items-center gap-3 text-emerald-600">
              <User size={20} />
              <h3 className="font-bold text-lg">خصم العملاء (مسموح به)</h3>
            </div>
            <p className="text-sm text-zinc-500">اختر الحساب الذي سيتم تحميل قيمة الخصم الممنوح للعملاء عليه.</p>
            <div className="relative">
              <BookOpen className="absolute left-3 top-3 text-zinc-400" size={18} />
              <select
                className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all appearance-none"
                value={settings.customer_discount_account_id}
                onChange={(e) => setSettings({ ...settings, customer_discount_account_id: e.target.value })}
              >
                <option value="">اختر الحساب...</option>
                {accounts.map(account => (
                  <option key={account.id} value={account.id}>{account.name} ({account.code})</option>
                ))}
              </select>
            </div>
          </div>

          {/* Supplier Discount Account */}
          <div className="space-y-4">
            <div className="flex items-center gap-3 text-amber-600">
              <Truck size={20} />
              <h3 className="font-bold text-lg">خصم الموردين (مكتسب)</h3>
            </div>
            <p className="text-sm text-zinc-500">اختر الحساب الذي سيتم قيد قيمة الخصم المكتسب من الموردين فيه.</p>
            <div className="relative">
              <BookOpen className="absolute left-3 top-3 text-zinc-400" size={18} />
              <select
                className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none transition-all appearance-none"
                value={settings.supplier_discount_account_id}
                onChange={(e) => setSettings({ ...settings, supplier_discount_account_id: e.target.value })}
              >
                <option value="">اختر الحساب...</option>
                {accounts.map(account => (
                  <option key={account.id} value={account.id}>{account.name} ({account.code})</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-6 border-t border-zinc-100">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-3 px-12 py-4 bg-zinc-900 text-white rounded-2xl font-bold hover:bg-zinc-800 transition-all shadow-xl disabled:opacity-50 active:scale-95"
          >
            <Save size={24} />
            {saving ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
          </button>
        </div>
      </form>

      <div className="bg-emerald-50 border border-emerald-100 p-6 rounded-2xl flex gap-4 items-start">
        <div className="p-2 bg-white text-emerald-600 rounded-xl shadow-sm">
          <BookOpen size={20} />
        </div>
        <div className="space-y-1">
          <h4 className="font-bold text-emerald-900">لماذا نحدد هذه الحسابات؟</h4>
          <p className="text-sm text-emerald-700 leading-relaxed">
            تحديد هذه الحسابات يسهل عملية تسجيل القيود المحاسبية تلقائياً عند إجراء أي خصم. 
            سيتم استخدام هذه الحسابات كطرف مدين في خصم العملاء (خسارة/مصروف) وطرف دائن في خصم الموردين (ربح/إيراد).
          </p>
        </div>
      </div>

      {settingsId && (
        <div className="bg-white rounded-3xl border border-zinc-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-zinc-50 bg-zinc-50/50 flex items-center gap-3">
            <History size={20} className="text-zinc-400" />
            <h3 className="font-bold text-zinc-900">سجل التعديلات</h3>
          </div>
          <div className="p-0">
            <InlineActivityLog category="settings" documentId={settingsId} />
          </div>
        </div>
      )}
    </div>
  );
};
