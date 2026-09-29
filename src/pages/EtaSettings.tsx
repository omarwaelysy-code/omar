import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Receipt, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  ExternalLink, 
  Eye, 
  EyeOff, 
  Trash2, 
  Loader2, 
  Save, 
  ShieldCheck, 
  Zap, 
  XCircle, 
  Info, 
  Globe, 
  FileText, 
  Copy, 
  Check,
  RefreshCw,
  HelpCircle
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { dbService, apiRequest } from '../services/dbService';

export function EtaSettings() {
  const { language, dir } = useLanguage();
  const { user } = useAuth();
  const { showNotification } = useNotification();

  const [loading, setLoading] = useState(true);
  const [companyInfo, setCompanyInfo] = useState<{ id: string; name: string; tax_number: string }>({
    id: '',
    name: '',
    tax_number: ''
  });

  const [etaSettings, setEtaSettings] = useState<{
    environment: 'preprod' | 'production';
    activity_code: string;
    branch_id: string;
    country_code: string;
    governorate: string;
    city: string;
    street: string;
    building_number: string;
    postal_code: string;
    client_id: string;
    client_secret: string;
    client_secret_configured: boolean;
    operating_key: string;
    operating_key_configured: boolean;
    is_configured: boolean;
  }>({
    environment: 'production',
    activity_code: '',
    branch_id: '0',
    country_code: 'EG',
    governorate: '',
    city: '',
    street: '',
    building_number: '',
    postal_code: '',
    client_id: '',
    client_secret: '',
    client_secret_configured: false,
    operating_key: '',
    operating_key_configured: false,
    is_configured: false
  });

  const [etaSaving, setEtaSaving] = useState(false);
  const [etaTesting, setEtaTesting] = useState(false);
  const [etaTestResult, setEtaTestResult] = useState<{
    connected: boolean;
    message: string;
    code?: string;
    http_status?: number;
    diagnostic?: string;
    environment?: 'preprod' | 'production';
    tested_at?: string;
  } | null>(null);

  const [showClientSecret, setShowClientSecret] = useState(false);
  const [showOperatingKey, setShowOperatingKey] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleCopyToClipboard = (text: string, fieldKey: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldKey);
    setTimeout(() => setCopiedField(null), 2000);
  };

  useEffect(() => {
    async function loadData() {
      if (!user?.company_id) return;
      try {
        setLoading(true);
        // Load company core info
        const comp = await dbService.get<any>('companies', user.company_id);
        if (comp) {
          setCompanyInfo({
            id: comp.id,
            name: comp.name || '',
            tax_number: comp.tax_number || ''
          });
        }

        // Load ETA settings for the active company
        const etaRes = await apiRequest<any>('/company/eta-settings');
        if (etaRes && etaRes.data) {
          setEtaSettings({
            environment: etaRes.data.environment === 'preprod' ? 'preprod' : 'production',
            activity_code: etaRes.data.activity_code || '',
            branch_id: etaRes.data.branch_id || '0',
            country_code: etaRes.data.country_code || 'EG',
            governorate: etaRes.data.governorate || '',
            city: etaRes.data.city || '',
            street: etaRes.data.street || '',
            building_number: etaRes.data.building_number || '',
            postal_code: etaRes.data.postal_code || '',
            client_id: etaRes.data.client_id || '',
            client_secret: etaRes.data.client_secret || '',
            client_secret_configured: Boolean(etaRes.data.client_secret_configured),
            operating_key: etaRes.data.operating_key || '',
            operating_key_configured: Boolean(etaRes.data.operating_key_configured),
            is_configured: Boolean(etaRes.data.is_configured)
          });
        }
      } catch (err: any) {
        console.error('Failed to load ETA settings:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [user?.company_id]);

  const handleSaveEtaSettings = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setEtaSaving(true);
    try {
      const res = await apiRequest<any>('/company/eta-settings', 'POST', {
        ...etaSettings,
        clear_credentials: false,
        confirm_clear_credentials: false
      });
      if (res.success && res.data) {
        setEtaSettings(prev => ({
          ...prev,
          ...res.data,
          client_id: res.data.client_id || etaSettings.client_id || prev.client_id,
          client_secret: res.data.client_secret !== undefined ? res.data.client_secret : etaSettings.client_secret,
          client_secret_configured: Boolean(res.data.client_secret_configured ?? etaSettings.client_secret_configured),
          operating_key: res.data.operating_key !== undefined ? res.data.operating_key : etaSettings.operating_key,
          operating_key_configured: Boolean(res.data.operating_key_configured ?? etaSettings.operating_key_configured),
          is_configured: Boolean(res.data.is_configured ?? ((res.data.client_id || prev.client_id) && (res.data.client_secret || res.data.client_secret_configured)))
        }));
        showNotification(
          language === 'ar'
            ? 'تم حفظ إعدادات ومفاتيح الفاتورة الإلكترونية بنجاح وأمان.'
            : 'ETA e-invoicing settings and keys saved securely.',
          'success'
        );
        window.dispatchEvent(new Event('eta_settings_updated'));
      } else {
        showNotification(
          language === 'ar'
            ? 'تعذر حفظ إعدادات الفاتورة الإلكترونية.'
            : 'Failed to save ETA e-invoicing settings.',
          'error'
        );
      }
    } catch (err: any) {
      showNotification(
        err.message || (language === 'ar' ? 'تعذر حفظ إعدادات الفاتورة الإلكترونية.' : 'Failed to save ETA e-invoicing settings.'),
        'error'
      );
    } finally {
      setEtaSaving(false);
    }
  };

  const handleClearEtaCredentials = async () => {
    if (!window.confirm(
      language === 'ar' 
        ? 'هل أنت متأكد من رغبتك في تفريغ وحذف مفاتيح الربط لهذه الشركة؟' 
        : 'Are you sure you want to clear credentials for this company?'
    )) {
      return;
    }
    setEtaSaving(true);
    try {
      const res = await apiRequest<any>('/company/eta-settings', 'POST', {
        ...etaSettings,
        client_id: '',
        client_secret: '',
        operating_key: '',
        clear_credentials: true,
        confirm_clear_credentials: true
      });
      if (res.success) {
        setEtaSettings(prev => ({
          ...prev,
          client_id: '',
          client_secret: '',
          client_secret_configured: false,
          operating_key: '',
          operating_key_configured: false,
          is_configured: false
        }));
        setEtaTestResult(null);
        window.dispatchEvent(new Event('eta_settings_updated'));
        showNotification(
          language === 'ar'
            ? 'تم تفريغ مفاتيح الربط للشركة بنجاح.'
            : 'ETA credentials cleared successfully.',
          'success'
        );
      }
    } catch (err: any) {
      showNotification(
        language === 'ar' ? 'تعذر تفريغ المفاتيح.' : 'Failed to clear credentials.',
        'error'
      );
    } finally {
      setEtaSaving(false);
    }
  };

  const handleTestEtaConnection = async () => {
    setEtaTesting(true);
    setEtaTestResult(null);
    try {
      const res = await apiRequest<{
        success: boolean;
        connected: boolean;
        environment: 'preprod' | 'production';
        code?: string;
        http_status?: number;
        diagnostic?: string;
        message: string;
        tested_at: string;
      }>('/company/eta-settings/test-connection', 'POST', {
        environment: etaSettings.environment,
        client_id: etaSettings.client_id,
        client_secret: etaSettings.client_secret
      });

      setEtaTestResult({
        connected: Boolean(res.connected),
        message: res.message,
        code: res.code,
        http_status: res.http_status,
        diagnostic: res.diagnostic,
        environment: res.environment,
        tested_at: res.tested_at
      });

      if (res.connected) {
        showNotification(
          language === 'ar'
            ? 'تم الاتصال والتحقق بنجاح مع منظومة الفاتورة الإلكترونية (ETA).'
            : 'ETA connection and authentication successful.',
          'success'
        );
      } else {
        showNotification(
          language === 'ar'
            ? `فشل الاتصال بـ ETA: ${res.message}`
            : `ETA connection failed: ${res.message}`,
          'error'
        );
      }
    } catch (err: any) {
      setEtaTestResult({
        connected: false,
        message: err.message || (language === 'ar' ? 'خطأ غير متوقع أثناء الاتصال بـ ETA' : 'Unexpected error connecting to ETA')
      });
      showNotification(
        err.message || (language === 'ar' ? 'تعذر الاتصال بخوادم ETA.' : 'Failed to contact ETA servers.'),
        'error'
      );
    } finally {
      setEtaTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-2" />
        <span className="text-sm font-bold text-slate-500">
          {language === 'ar' ? 'جاري تحميل إعدادات الفاتورة الإلكترونية...' : 'Loading ETA settings...'}
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-12 animate-in fade-in duration-300" dir={dir}>
      {/* Top Header & Save Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-200 flex items-center justify-center text-amber-600 shadow-2xs flex-shrink-0">
            <Receipt className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">🇪🇬</span>
              <h2 className="text-lg font-bold text-slate-900">
                {language === 'ar' ? 'إعدادات الفاتورة الإلكترونية المصرية (ETA)' : 'Egyptian E-Invoice Settings (ETA)'}
              </h2>
              <span className="bg-indigo-50 text-indigo-700 text-[11px] font-bold px-2.5 py-0.5 rounded-full border border-indigo-100 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-indigo-500" />
                {language === 'ar' ? 'الربط والتكامل' : 'Integration Wizard'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {language === 'ar' 
                ? 'إدارة بيانات الربط المباشر مع مصلحة الضرائب المصرية ومفاتيح الـ API ومطابقة المستندات' 
                : 'Configure API credentials, operating environment, and verify connectivity with Egyptian Tax Authority'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleTestEtaConnection}
            disabled={etaTesting || etaSaving}
            className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3.5 py-2 rounded-xl font-bold text-xs transition-all active:scale-95 disabled:opacity-50"
          >
            {etaTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5 text-amber-600" />}
            <span>{language === 'ar' ? 'اختبار الاتصال' : 'Test Connection'}</span>
          </button>

          <button
            type="button"
            onClick={() => handleSaveEtaSettings()}
            disabled={etaSaving}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-xl font-bold text-xs shadow-sm active:scale-95 disabled:opacity-50 transition-all cursor-pointer"
          >
            {etaSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            <span>{language === 'ar' ? 'حفظ الإعدادات' : 'Save Settings'}</span>
          </button>
        </div>
      </div>

      {/* Active Company & Environment Overview Banner */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Company Context Card */}
        <div className="bg-gradient-to-r from-slate-50 via-indigo-50/40 to-slate-50 border border-indigo-100 rounded-2xl p-3.5 flex items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-sm flex-shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-slate-500">
                  {language === 'ar' ? 'الشركة الحالية الخاضعة للربط:' : 'Active Company:'}
                </span>
                <span className="text-sm font-black text-indigo-900 bg-white px-2.5 py-0.5 rounded-lg border border-indigo-200 shadow-2xs">
                  {companyInfo.name || (language === 'ar' ? 'الشركة الحالية' : 'Current Company')}
                </span>
                {companyInfo.tax_number && (
                  <span className="text-xs font-mono font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                    {language === 'ar' ? `رقم ضريبي: ${companyInfo.tax_number}` : `Tax ID: ${companyInfo.tax_number}`}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                {language === 'ar' 
                  ? '⚠️ مفاتيح الربط مستقلة تماماً لكل شركة بحسب ملفها الضريبي لدى مصلحة الضرائب.' 
                  : 'Note: Credentials are isolated per company tax profile.'}
              </p>
            </div>
          </div>
          {etaSettings.is_configured ? (
            <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-3 py-1 rounded-xl flex items-center gap-1.5 flex-shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              {language === 'ar' ? 'مفاتيح الربط محفوظة' : 'Configured'}
            </span>
          ) : (
            <span className="bg-amber-100 text-amber-800 text-xs font-bold px-3 py-1 rounded-xl flex items-center gap-1.5 flex-shrink-0">
              <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
              {language === 'ar' ? 'غير مربوطة بـ ETA بعد' : 'Not Configured'}
            </span>
          )}
        </div>

        {/* Operating Environment Switcher */}
        <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Globe className="w-4 h-4 text-indigo-600" />
              {language === 'ar' ? 'بيئة التشغيل (Operating Environment)' : 'Operating Environment'}
            </span>
            <a
              href={etaSettings.environment === 'production' ? 'https://invoicing.eta.gov.eg' : 'https://preprod.invoicing.eta.gov.eg'}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[11px] text-indigo-600 hover:text-indigo-700 font-bold hover:underline"
            >
              <span>
                {language === 'ar'
                  ? (etaSettings.environment === 'production' ? 'فتح بوابة الضرائب الفعلية ↗' : 'فتح بوابة الضرائب التجريبية (PreProd) ↗')
                  : 'Open ETA Taxpayer Portal ↗'}
              </span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label
              className={`flex items-start gap-2.5 p-2 rounded-xl border cursor-pointer transition-all ${
                etaSettings.environment === 'preprod'
                  ? 'bg-indigo-50/70 border-indigo-300 ring-2 ring-indigo-500/10'
                  : 'bg-slate-50/50 border-slate-200 hover:border-slate-300'
              }`}
            >
              <input
                type="radio"
                name="eta_environment_page"
                value="preprod"
                checked={etaSettings.environment === 'preprod'}
                onChange={() => setEtaSettings(prev => ({ ...prev, environment: 'preprod' }))}
                className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
              />
              <div className="flex flex-col">
                <span className="font-bold text-xs text-slate-800 flex items-center gap-1">
                  <span>{language === 'ar' ? 'بيئة الاختبار (PreProd)' : 'PreProd / Sandbox'}</span>
                  <span className="bg-amber-100 text-amber-800 text-[9px] px-1 rounded font-bold">{language === 'ar' ? 'للتجارب' : 'Testing'}</span>
                </span>
                <span className="text-[10px] text-slate-500 mt-0.5 leading-snug">
                  {language === 'ar' ? 'لتجربة الربط دون إرسال فواتير حية' : 'Test server before live deployment'}
                </span>
              </div>
            </label>

            <label
              className={`flex items-start gap-2.5 p-2 rounded-xl border cursor-pointer transition-all ${
                etaSettings.environment === 'production'
                  ? 'bg-emerald-50/70 border-emerald-300 ring-2 ring-emerald-500/10'
                  : 'bg-slate-50/50 border-slate-200 hover:border-slate-300'
              }`}
            >
              <input
                type="radio"
                name="eta_environment_page"
                value="production"
                checked={etaSettings.environment === 'production'}
                onChange={() => setEtaSettings(prev => ({ ...prev, environment: 'production' }))}
                className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
              />
              <div className="flex flex-col">
                <span className="font-bold text-xs text-slate-800">
                  {language === 'ar' ? 'التشغيل الفعلي (Production)' : 'Production (Live)'}
                </span>
                <span className="text-[10px] text-slate-500 mt-0.5 leading-snug">
                  {language === 'ar' ? 'المنظومة الرسمية المعتمدة للفواتير الحية' : 'Live system for official tax documents'}
                </span>
              </div>
            </label>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2-COLUMN MAIN LAYOUT: Form & Steps */}
      {/* ========================================================================= */}
      <form onSubmit={handleSaveEtaSettings} className="grid grid-cols-1 xl:grid-cols-2 gap-3 items-start">
        
        {/* ================= COLUMN 1: Taxpayer Profile & API Credentials ================= */}
        <div className="space-y-3">
          
          {/* STEP 1: Taxpayer & Company Info */}
          <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
              <span className="w-6 h-6 rounded-lg bg-indigo-600 text-white font-bold text-xs flex items-center justify-center flex-shrink-0">
                1
              </span>
              <div>
                <h3 className="font-bold text-slate-800 text-xs sm:text-sm">
                  {language === 'ar' ? 'الخطوة الأولى: بيانات الشركة والنشاط الضريبي' : 'Step 1: Taxpayer & Activity Info'}
                </h3>
                <p className="text-[11px] text-slate-400">
                  {language === 'ar' 
                    ? 'تأكد من مطابقة هذه البيانات مع المسجل في بطاقتك الضريبية لدى مصلحة الضرائب المصرية' 
                    : 'Ensure details match your official tax card on ETA portal'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-0.5">
                  {language === 'ar' ? 'اسم المنشأة' : 'Company Name'}
                </label>
                <input
                  type="text"
                  disabled
                  value={companyInfo.name}
                  className="w-full px-2.5 py-1.5 h-8 bg-slate-100 border border-slate-200 rounded-lg text-slate-600 font-medium cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-0.5">
                  {language === 'ar' ? 'رقم التسجيل الضريبي (9 أرقام)' : 'Tax Number (9 digits)'}
                </label>
                <input
                  type="text"
                  disabled
                  value={companyInfo.tax_number}
                  className="w-full px-2.5 py-1.5 h-8 bg-slate-100 border border-slate-200 rounded-lg text-slate-600 font-mono font-bold cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-0.5">
                  {language === 'ar' ? 'كود النشاط الضريبي (Activity Code)' : 'Tax Activity Code'}
                </label>
                <input
                  type="text"
                  value={etaSettings.activity_code}
                  onChange={(e) => setEtaSettings({ ...etaSettings, activity_code: e.target.value })}
                  placeholder="مثال: 4610"
                  className="w-full px-2.5 py-1.5 h-8 bg-white border border-slate-200 rounded-lg text-slate-800 font-mono focus:border-indigo-500 outline-none transition-all"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  {language === 'ar' ? 'كود النشاط المكون من 4 إلى 6 أرقام بالبطاقة الضريبية' : 'Activity code as registered on ETA'}
                </span>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-0.5">
                  {language === 'ar' ? 'كود الفرع (Branch ID) *' : 'Branch ID *'}
                </label>
                <input
                  type="text"
                  value={etaSettings.branch_id}
                  onChange={(e) => setEtaSettings({ ...etaSettings, branch_id: e.target.value })}
                  placeholder="0"
                  className="w-full px-2.5 py-1.5 h-8 bg-white border border-slate-200 rounded-lg text-slate-800 font-mono focus:border-indigo-500 outline-none transition-all"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  {language === 'ar' ? 'كود الفرع (0 للفرع الرئيسي)' : 'Branch ID (0 for Main branch)'}
                </span>
              </div>
            </div>

            {/* Address fields */}
            <div className="pt-2 border-t border-slate-100">
              <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
                {language === 'ar' ? 'تفاصيل العنوان الضريبي الرسمي' : 'Official Registered Address'}
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                <div>
                  <label className="block text-[10px] text-slate-500 mb-0.5">{language === 'ar' ? 'كود الدولة' : 'Country'}</label>
                  <input
                    type="text"
                    value={etaSettings.country_code}
                    onChange={(e) => setEtaSettings({ ...etaSettings, country_code: e.target.value.toUpperCase() })}
                    className="w-full px-2 py-1 h-7.5 bg-white border border-slate-200 rounded-lg font-mono text-center font-bold text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 mb-0.5">{language === 'ar' ? 'المحافظة' : 'Governorate'}</label>
                  <input
                    type="text"
                    value={etaSettings.governorate}
                    onChange={(e) => setEtaSettings({ ...etaSettings, governorate: e.target.value })}
                    className="w-full px-2 py-1 h-7.5 bg-white border border-slate-200 rounded-lg text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 mb-0.5">{language === 'ar' ? 'المدينة / المركز' : 'City'}</label>
                  <input
                    type="text"
                    value={etaSettings.city}
                    onChange={(e) => setEtaSettings({ ...etaSettings, city: e.target.value })}
                    className="w-full px-2 py-1 h-7.5 bg-white border border-slate-200 rounded-lg text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 mb-0.5">{language === 'ar' ? 'اسم الشارع' : 'Street'}</label>
                  <input
                    type="text"
                    value={etaSettings.street}
                    onChange={(e) => setEtaSettings({ ...etaSettings, street: e.target.value })}
                    className="w-full px-2 py-1 h-7.5 bg-white border border-slate-200 rounded-lg text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 mb-0.5">{language === 'ar' ? 'رقم المبنى' : 'Building'}</label>
                  <input
                    type="text"
                    value={etaSettings.building_number}
                    onChange={(e) => setEtaSettings({ ...etaSettings, building_number: e.target.value })}
                    className="w-full px-2 py-1 h-7.5 bg-white border border-slate-200 rounded-lg text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 mb-0.5">{language === 'ar' ? 'الرمز البريدي' : 'Postal Code'}</label>
                  <input
                    type="text"
                    value={etaSettings.postal_code}
                    onChange={(e) => setEtaSettings({ ...etaSettings, postal_code: e.target.value })}
                    className="w-full px-2 py-1 h-7.5 bg-white border border-slate-200 rounded-lg text-slate-800"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* STEP 2: API Credentials & Keys */}
          <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
              <span className="w-6 h-6 rounded-lg bg-indigo-600 text-white font-bold text-xs flex items-center justify-center flex-shrink-0">
                2
              </span>
              <div>
                <h3 className="font-bold text-slate-800 text-xs sm:text-sm">
                  {language === 'ar' ? 'الخطوة الثانية: بيانات التسجيل ومفاتيح الربط (API Credentials)' : 'Step 2: API Credentials & Keys'}
                </h3>
                <p className="text-[11px] text-slate-400">
                  {language === 'ar' 
                    ? 'المفاتيح المستخرجة من شاشة (تسجيل نظام ERP / إضافة بيئة تسجيل) على بوابة الضرائب' 
                    : 'Credentials obtained from ETA portal under ERP System Registration'}
                </p>
              </div>
            </div>

            <div className="space-y-2.5 text-xs">
              {/* Client ID */}
              <div>
                <div className="flex items-center justify-between mb-0.5">
                  <label className="block text-[11px] font-bold text-slate-700">
                    {language === 'ar' ? 'معرف العميل (Client ID) *' : 'Client ID *'}
                  </label>
                  {etaSettings.client_id && (
                    <button
                      type="button"
                      onClick={() => handleCopyToClipboard(etaSettings.client_id, 'client_id')}
                      className="text-[10px] text-indigo-600 hover:text-indigo-700 font-bold flex items-center gap-1"
                    >
                      {copiedField === 'client_id' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedField === 'client_id' ? (language === 'ar' ? 'تم النسخ' : 'Copied') : (language === 'ar' ? 'نسخ' : 'Copy')}</span>
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  value={etaSettings.client_id}
                  onChange={(e) => setEtaSettings({ ...etaSettings, client_id: e.target.value })}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  className="w-full px-3 py-1.5 h-8 bg-white border border-slate-200 rounded-lg text-slate-800 font-mono focus:border-indigo-500 outline-none transition-all text-xs"
                />
              </div>

              {/* Client Secret 1 */}
              <div>
                <div className="flex items-center justify-between mb-0.5">
                  <label className="block text-[11px] font-bold text-slate-700">
                    {language === 'ar' ? 'مفتاح السر الأولي (Client Secret 1) *' : 'Client Secret 1 *'}
                  </label>
                  <div className="flex items-center gap-2">
                    {etaSettings.client_secret_configured && (
                      <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-100">
                        {language === 'ar' ? '✓ تم حفظ المفتاح بأمان' : '✓ Saved Securely'}
                      </span>
                    )}
                    {etaSettings.client_secret && (
                      <button
                        type="button"
                        onClick={() => handleCopyToClipboard(etaSettings.client_secret, 'client_secret')}
                        className="text-[10px] text-indigo-600 hover:text-indigo-700 font-bold flex items-center gap-1"
                      >
                        {copiedField === 'client_secret' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedField === 'client_secret' ? (language === 'ar' ? 'تم النسخ' : 'Copied') : (language === 'ar' ? 'نسخ' : 'Copy')}</span>
                      </button>
                    )}
                  </div>
                </div>
                <div className="relative">
                  <input
                    type={showClientSecret ? 'text' : 'password'}
                    value={etaSettings.client_secret}
                    onChange={(e) => setEtaSettings({ ...etaSettings, client_secret: e.target.value })}
                    placeholder={etaSettings.client_secret_configured ? '••••••••••••••••••••••••••••••••' : 'Client Secret 1'}
                    className="w-full pr-3 pl-8 py-1.5 h-8 bg-white border border-slate-200 rounded-lg text-slate-800 font-mono focus:border-indigo-500 outline-none transition-all text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowClientSecret(!showClientSecret)}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showClientSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Client Secret 2 / Operating Key */}
              <div>
                <div className="flex items-center justify-between mb-0.5">
                  <label className="block text-[11px] font-bold text-slate-700">
                    {language === 'ar' ? 'مفتاح السر الإضافي (Client Secret 2 / Operating Key)' : 'Client Secret 2 / Operating Key'}
                  </label>
                  <div className="flex items-center gap-2">
                    {etaSettings.operating_key_configured && (
                      <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-100">
                        {language === 'ar' ? '✓ تم حفظ المفتاح' : '✓ Saved'}
                      </span>
                    )}
                    {etaSettings.operating_key && (
                      <button
                        type="button"
                        onClick={() => handleCopyToClipboard(etaSettings.operating_key, 'operating_key')}
                        className="text-[10px] text-indigo-600 hover:text-indigo-700 font-bold flex items-center gap-1"
                      >
                        {copiedField === 'operating_key' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedField === 'operating_key' ? (language === 'ar' ? 'تم النسخ' : 'Copied') : (language === 'ar' ? 'نسخ' : 'Copy')}</span>
                      </button>
                    )}
                  </div>
                </div>
                <div className="relative">
                  <input
                    type={showOperatingKey ? 'text' : 'password'}
                    value={etaSettings.operating_key}
                    onChange={(e) => setEtaSettings({ ...etaSettings, operating_key: e.target.value })}
                    placeholder={etaSettings.operating_key_configured ? '••••••••••••••••••••••••••••••••' : 'Client Secret 2 (اختياري)'}
                    className="w-full pr-3 pl-8 py-1.5 h-8 bg-white border border-slate-200 rounded-lg text-slate-800 font-mono focus:border-indigo-500 outline-none transition-all text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowOperatingKey(!showOperatingKey)}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showOperatingKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  {language === 'ar' ? 'يستخدم كسر بديل أو لتأمين استلام الإشعارات من منظومة الضرائب' : 'Secondary secret key or webhook signing key'}
                </span>
              </div>
            </div>

            {/* Step 2 Actions: Clear & Save */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              {(etaSettings.client_id || etaSettings.client_secret_configured || etaSettings.client_secret) ? (
                <button
                  type="button"
                  onClick={handleClearEtaCredentials}
                  disabled={etaSaving || etaTesting}
                  className="flex items-center gap-1.5 text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-3 py-1.5 rounded-lg font-bold text-xs transition-all border border-rose-200 active:scale-95 disabled:opacity-50"
                  title={language === 'ar' ? 'مسح وتفريغ المفاتيح لهذه الشركة' : 'Clear credentials for this company'}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{language === 'ar' ? 'تفريغ وحذف مفاتيح الربط' : 'Clear Credentials'}</span>
                </button>
              ) : <div />}

              <button
                type="submit"
                disabled={etaSaving || etaTesting}
                className="flex items-center gap-1.5 bg-slate-900 hover:bg-black text-white px-4 py-1.5 rounded-lg font-bold text-xs transition-all shadow-sm active:scale-95 disabled:opacity-50"
              >
                {etaSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                <span>{language === 'ar' ? 'حفظ إعدادات الربط' : 'Save Credentials'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* ================= COLUMN 2: Verification, Diagnostics & Quick Portals ================= */}
        <div className="space-y-3">
          
          {/* STEP 3: Test Connection & Live Diagnostic */}
          <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
              <span className="w-6 h-6 rounded-lg bg-indigo-600 text-white font-bold text-xs flex items-center justify-center flex-shrink-0">
                3
              </span>
              <div>
                <h3 className="font-bold text-slate-800 text-xs sm:text-sm">
                  {language === 'ar' ? 'الخطوة الثالثة: اختبار الاتصال والتحقق الفعلي' : 'Step 3: Test Connection & Verification'}
                </h3>
                <p className="text-[11px] text-slate-400">
                  {language === 'ar' 
                    ? 'يقوم النظام بالاتصال الفعلي بخوادم مصلحة الضرائب والتحقق من صحة المفاتيح دون إرسال فواتير' 
                    : 'Performs live OAuth validation with ETA servers without sending any documents'}
                </p>
              </div>
            </div>

            {/* Test Action Box */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <ShieldCheck className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                <span className="leading-snug">
                  {language === 'ar'
                    ? 'فحص أمان الاتصال والمصادقة مع بيئة الضرائب المحددة'
                    : 'Secure OAuth token handshake with selected ETA environment'}
                </span>
              </div>

              <button
                type="button"
                onClick={handleTestEtaConnection}
                disabled={etaTesting || etaSaving}
                className="flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl font-bold text-xs transition-all shadow-sm active:scale-95 disabled:opacity-50 flex-shrink-0"
              >
                {etaTesting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                ) : (
                  <Zap className="w-3.5 h-3.5 text-amber-300" />
                )}
                <span>
                  {etaTesting
                    ? (language === 'ar' ? 'جاري الفحص...' : 'Testing...')
                    : (language === 'ar' ? '⚡ اختبار الاتصال بـ ETA' : '⚡ Test ETA Connection')}
                </span>
              </button>
            </div>

            {/* Test Result Feedback Box */}
            {etaTestResult ? (
              <div className={`p-3 rounded-xl border flex items-start gap-2.5 ${
                etaTestResult.connected
                  ? 'bg-emerald-50/90 border-emerald-200 text-emerald-950 shadow-2xs'
                  : 'bg-rose-50/90 border-rose-200 text-rose-950 shadow-2xs'
              }`}>
                {etaTestResult.connected ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
                )}
                <div className="flex-1 text-xs space-y-1">
                  <div className="font-bold text-xs sm:text-sm">
                    {etaTestResult.connected
                      ? (language === 'ar' ? '🟢 تم الاتصال والتحقق بنجاح مع منظومة ETA' : '🟢 Connection Verified Successfully')
                      : (language === 'ar' ? '🔴 فشل اختبار الاتصال بـ ETA' : '🔴 Connection Test Failed')}
                  </div>
                  <p className="leading-relaxed font-medium">{etaTestResult.message}</p>
                  {etaTestResult.diagnostic && (
                    <div className="text-[10px] font-mono bg-black/5 px-2 py-0.5 rounded w-fit mt-1 opacity-90">
                      {etaTestResult.http_status ? `[HTTP ${etaTestResult.http_status}] ` : ''}{etaTestResult.diagnostic}
                    </div>
                  )}
                  {etaTestResult.tested_at && (
                    <div className="text-[10px] opacity-70 mt-1">
                      {language === 'ar' ? 'تاريخ الفحص: ' : 'Tested at: '}
                      {new Date(etaTestResult.tested_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-xl border border-dashed border-slate-200 text-center text-slate-400 text-xs">
                <HelpCircle className="w-5 h-5 mx-auto mb-1 opacity-60" />
                <span>{language === 'ar' ? 'لم يتم إجراء فحص اتصال حديث بعد. اضغط على الزر أعلاه للبدء.' : 'No recent diagnostic check performed. Click above to run test.'}</span>
              </div>
            )}
          </div>

          {/* STEP 4: Direct Portals & Setup Guidance */}
          <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
              <span className="w-6 h-6 rounded-lg bg-indigo-600 text-white font-bold text-xs flex items-center justify-center flex-shrink-0">
                4
              </span>
              <div>
                <h3 className="font-bold text-slate-800 text-xs sm:text-sm">
                  {language === 'ar' ? 'الخطوة الرابعة: الروابط المباشرة وبوابات منظومة الفاتورة' : 'Step 4: ETA Portals & Setup Guide'}
                </h3>
                <p className="text-[11px] text-slate-400">
                  {language === 'ar' 
                    ? 'روابط الوصول المباشر لبوابات مصلحة الضرائب المصرية لاستخراج المفاتيح ومتابعة الفواتير' 
                    : 'Direct links to official ETA portals for credential generation and invoice tracking'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <a
                href="https://invoicing.eta.gov.eg"
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between p-2.5 bg-slate-50 hover:bg-indigo-50/50 border border-slate-200 hover:border-indigo-200 rounded-xl transition-all group"
              >
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-emerald-600" />
                  <div>
                    <span className="font-bold text-slate-800 block text-xs group-hover:text-indigo-700">
                      {language === 'ar' ? 'بوابة الضرائب الفعلية (Production)' : 'ETA Production Portal'}
                    </span>
                    <span className="text-[10px] text-slate-400">invoicing.eta.gov.eg</span>
                  </div>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600" />
              </a>

              <a
                href="https://preprod.invoicing.eta.gov.eg"
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between p-2.5 bg-slate-50 hover:bg-indigo-50/50 border border-slate-200 hover:border-indigo-200 rounded-xl transition-all group"
              >
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-amber-600" />
                  <div>
                    <span className="font-bold text-slate-800 block text-xs group-hover:text-indigo-700">
                      {language === 'ar' ? 'بوابة الضرائب التجريبية (PreProd)' : 'ETA PreProd Portal'}
                    </span>
                    <span className="text-[10px] text-slate-400">preprod.invoicing.eta.gov.eg</span>
                  </div>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600" />
              </a>
            </div>

            {/* Quick Steps Instructions */}
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-[11px] text-slate-600 space-y-1.5">
              <span className="font-bold text-slate-800 block text-xs">
                {language === 'ar' ? '📌 كيفية استخراج المفاتيح من بوابة مصلحة الضرائب المصرية:' : '📌 How to obtain credentials from ETA Portal:'}
              </span>
              <ol className="list-decimal list-inside space-y-1 text-slate-600 leading-relaxed pr-1">
                <li>{language === 'ar' ? 'سجل الدخول على بوابة الضرائب الخاصة بالمنشأة.' : 'Log in to your ETA taxpayer portal.'}</li>
                <li>{language === 'ar' ? 'انتقل إلى إعدادات ملف المنشأة ثم اختر "تسجيل نظام ERP".' : 'Navigate to Profile Settings > Register ERP System.'}</li>
                <li>{language === 'ar' ? 'أدخل اسم النظام ثم احفظ بيانات الاعتماد المعروضة.' : 'Enter system name and generate credentials.'}</li>
                <li>{language === 'ar' ? 'انسخ الـ Client ID و Client Secret والصقهما في هذه الشاشة.' : 'Copy Client ID & Client Secret and paste here.'}</li>
              </ol>
            </div>
          </div>

        </div>
      </form>
    </div>
  );
}
