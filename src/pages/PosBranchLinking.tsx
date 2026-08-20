import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Building2, 
  Home, 
  Clock, 
  Key, 
  Copy, 
  Check, 
  RefreshCw, 
  AlertCircle, 
  ShieldCheck, 
  Radio, 
  Trash2, 
  CheckCircle2, 
  XCircle,
  ExternalLink,
  Laptop,
  Plus
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { dbService, apiRequest } from '../services/dbService';
import { PosBranchLinkingCode } from '../types';

interface Department {
  id: string;
  code: string;
  name: string;
}

interface Warehouse {
  id: string;
  code: string;
  name: string;
}

export function PosBranchLinking() {
  const { t, dir, language } = useLanguage();
  const { user, company } = useAuth();
  const { showNotification } = useNotification();

  const isPosEnabled = company?.pos_enabled === true || (company?.settings as any)?.pos_enabled === true;

  const [loading, setLoading] = useState(true);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [linkingCodes, setLinkingCodes] = useState<PosBranchLinkingCode[]>([]);
  
  // Generator form
  const [selectedDept, setSelectedDept] = useState<string>('');
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('');
  const [validityHours, setValidityHours] = useState<number>(24);
  const [generating, setGenerating] = useState(false);
  const [latestCode, setLatestCode] = useState<PosBranchLinkingCode | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const fetchData = async () => {
    if (!user?.company_id || !isPosEnabled) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const [deptsData, whData] = await Promise.all([
        dbService.list<Department>('departments', user.company_id),
        dbService.list<Warehouse>('warehouses', user.company_id)
      ]);
      setDepartments(deptsData || []);
      setWarehouses(whData || []);

      // Fetch existing linking codes
      const codes = await apiRequest<PosBranchLinkingCode[]>('/api/erp/pos/branch-linking-codes', 'GET');
      setLinkingCodes(codes || []);
    } catch (err: any) {
      console.error('Error loading POS branch linking data:', err);
      showNotification(err.message || 'Failed to load POS data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user?.company_id, isPosEnabled]);

  const handleGenerateCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDept) {
      showNotification(
        language === 'ar' ? 'يرجى اختيار الفرع (الإدارة)' : 'Please select a branch (department)',
        'error'
      );
      return;
    }

    try {
      setGenerating(true);
      const newCode = await apiRequest<PosBranchLinkingCode>(
        '/api/erp/pos/branch-linking-codes/generate',
        'POST',
        {
          departmentId: selectedDept,
          warehouseId: selectedWarehouse || null,
          validityHours
        }
      );

      setLatestCode(newCode);
      showNotification(
        language === 'ar' ? 'تم إنشاء رمز ربط الفرع بنجاح' : 'Branch linking code created successfully',
        'success'
      );
      fetchData();
    } catch (err: any) {
      console.error('Failed to generate linking code:', err);
      showNotification(err.message || 'Failed to generate code', 'error');
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    showNotification(language === 'ar' ? 'تم نسخ الرمز للحافظة' : 'Code copied to clipboard', 'info');
    setTimeout(() => setCopiedCode(null), 2500);
  };

  const handleRevoke = async (id: string) => {
    if (!window.confirm(language === 'ar' ? 'هل أنت متأكد من إلغاء هذا الرمز؟' : 'Are you sure you want to revoke this code?')) {
      return;
    }
    try {
      await apiRequest(`/api/erp/pos/branch-linking-codes/${id}/revoke`, 'PUT');
      showNotification(language === 'ar' ? 'تم إلغاء الرمز' : 'Code revoked', 'success');
      if (latestCode?.id === id) {
        setLatestCode(null);
      }
      fetchData();
    } catch (err: any) {
      showNotification(err.message || 'Failed to revoke code', 'error');
    }
  };

  if (!isPosEnabled) {
    return (
      <div className="w-full max-w-4xl mx-auto p-6 md:p-10" dir={dir}>
        <div className="bg-amber-50 border border-amber-200 rounded-3xl p-8 text-center space-y-4">
          <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center mx-auto">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800">
            {language === 'ar' ? 'نظام نقاط البيع (POS) غير مفعل' : 'Point of Sale (POS) is Disabled'}
          </h2>
          <p className="text-slate-500 max-w-lg mx-auto text-sm leading-relaxed">
            {language === 'ar' 
              ? 'يرجى تفعيل خيار "نظام نقاط البيع (POS)" من إعدادات الشركة لتتمكن من إدارة وربط الفروع والأجهزة.' 
              : 'Please enable "Point of Sale (POS) System" in Company Settings to manage branch linking.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[98%] 2xl:max-w-[1600px] mx-auto p-4 md:p-8 space-y-8 animate-in fade-in duration-500" dir={dir}>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center font-bold">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
                {language === 'ar' ? 'نقاط البيع - ربط الفروع' : 'POS - Branch Linking'}
              </h1>
              <p className="text-slate-400 font-semibold text-xs md:text-sm mt-0.5">
                {language === 'ar' 
                  ? 'إنشاء رموز ربط مؤمنة للاستخدام لمرة واحدة لربط أجهزة نقاط البيع بالفرع والمستودع.' 
                  : 'Generate secure single-use linking codes to bind POS devices to company branches.'}
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all disabled:opacity-50 self-start md:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>{language === 'ar' ? 'تحديث' : 'Refresh'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Generator Form (Left/Top) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-100 shadow-sm space-y-6">
            <div className="flex items-center gap-2 text-indigo-600 justify-between">
              <div className="flex items-center gap-2">
                <Key className="w-5 h-5" />
                <span className="font-bold text-base md:text-lg">
                  {language === 'ar' ? 'توليد رمز ربط فرع جديد' : 'Generate New Linking Code'}
                </span>
              </div>
              <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 text-[11px] font-bold rounded-lg">
                Phase 1
              </span>
            </div>

            <form onSubmit={handleGenerateCode} className="space-y-4">
              {/* Branch / Department Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">
                  {language === 'ar' ? 'الفرع / الإدارة *' : 'Branch / Department *'}
                </label>
                <div className="relative">
                  <Building2 className={`absolute ${dir === 'rtl' ? 'right-3.5' : 'left-3.5'} top-3 w-4 h-4 text-slate-400`} />
                  <select
                    value={selectedDept}
                    onChange={(e) => setSelectedDept(e.target.value)}
                    required
                    className={`w-full ${dir === 'rtl' ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 text-sm font-medium focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 outline-none`}
                  >
                    <option value="">{language === 'ar' ? '-- اختر الفرع --' : '-- Select Branch --'}</option>
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.id}>
                        {dept.name} ({dept.code || 'BR'})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Warehouse Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">
                  {language === 'ar' ? 'المستودع الافتراضي' : 'Default Warehouse'}
                </label>
                <div className="relative">
                  <Home className={`absolute ${dir === 'rtl' ? 'right-3.5' : 'left-3.5'} top-3 w-4 h-4 text-slate-400`} />
                  <select
                    value={selectedWarehouse}
                    onChange={(e) => setSelectedWarehouse(e.target.value)}
                    className={`w-full ${dir === 'rtl' ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 text-sm font-medium focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 outline-none`}
                  >
                    <option value="">{language === 'ar' ? '-- مستودع الفرع الافتراضي --' : '-- Default Branch Warehouse --'}</option>
                    {warehouses.map((wh) => (
                      <option key={wh.id} value={wh.id}>
                        {wh.name} ({wh.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Validity Hours */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">
                  {language === 'ar' ? 'صلاحية الرمز' : 'Code Validity Duration'}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { hours: 1, labelAr: '1 ساعة', labelEn: '1 Hour' },
                    { hours: 24, labelAr: '24 ساعة', labelEn: '24 Hours' },
                    { hours: 72, labelAr: '3 أيام', labelEn: '3 Days' },
                  ].map((item) => (
                    <button
                      key={item.hours}
                      type="button"
                      onClick={() => setValidityHours(item.hours)}
                      className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                        validityHours === item.hours
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'
                      }`}
                    >
                      {language === 'ar' ? item.labelAr : item.labelEn}
                    </button>
                  ))}
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={generating || departments.length === 0}
                className="w-full mt-2 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-2xl font-bold text-sm transition-all shadow-md shadow-emerald-500/10 active:scale-95 disabled:opacity-50"
              >
                {generating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                <span>{language === 'ar' ? 'توليد رمز الربط الآن' : 'Generate Linking Code'}</span>
              </button>
            </form>
          </div>

          {/* Latest Generated Code Hero */}
          <AnimatePresence>
            {latestCode && latestCode.status === 'pending' && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white p-6 rounded-3xl shadow-xl space-y-4 relative overflow-hidden"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold">
                    <ShieldCheck className="w-4 h-4" />
                    <span>{language === 'ar' ? 'رمز الربط جاهز للاستخدام' : 'Linking Code Ready'}</span>
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {language === 'ar' ? 'صالح حتى:' : 'Expires:'} {new Date(latestCode.expires_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                <div className="bg-white/10 p-4 rounded-2xl border border-white/10 flex items-center justify-between gap-4">
                  <span className="font-mono text-2xl md:text-3xl font-black tracking-widest text-emerald-300 select-all">
                    {latestCode.code}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy(latestCode.code)}
                    className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all active:scale-95"
                    title={language === 'ar' ? 'نسخ' : 'Copy'}
                  >
                    {copiedCode === latestCode.code ? <Check className="w-5 h-5 text-emerald-400" /> : <Copy className="w-5 h-5" />}
                  </button>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  {language === 'ar' 
                    ? 'أدخل هذا الرمز داخل شاشة إعدادات Cafe POS في الفرع لإتمام عملية الربط الأولية.' 
                    : 'Enter this code in the Cafe POS Settings screen at the branch to complete linking.'}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Linking Codes History Table (Right/Bottom) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-100 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-slate-800 text-base md:text-lg">
                {language === 'ar' ? 'سجل رموز الربط' : 'Linking Codes History'}
              </h2>
              <span className="text-xs font-semibold text-slate-400">
                {linkingCodes.length} {language === 'ar' ? 'رمز' : 'codes'}
              </span>
            </div>

            {linkingCodes.length === 0 ? (
              <div className="text-center py-12 text-slate-400 space-y-2">
                <Laptop className="w-10 h-10 mx-auto text-slate-300" />
                <p className="text-xs font-semibold">
                  {language === 'ar' ? 'لا توجد رموز ربط منشأة بعد' : 'No linking codes generated yet'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-start text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 font-bold">
                      <th className="pb-3 text-start">{language === 'ar' ? 'الرمز' : 'Code'}</th>
                      <th className="pb-3 text-start">{language === 'ar' ? 'الفرع' : 'Branch'}</th>
                      <th className="pb-3 text-start">{language === 'ar' ? 'المستودع' : 'Warehouse'}</th>
                      <th className="pb-3 text-start">{language === 'ar' ? 'الحالة' : 'Status'}</th>
                      <th className="pb-3 text-start">{language === 'ar' ? 'انتهاء الصلاحية' : 'Expires'}</th>
                      <th className="pb-3 text-end">{language === 'ar' ? 'الإجراء' : 'Action'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {linkingCodes.map((codeItem) => {
                      const isExpired = new Date(codeItem.expires_at) < new Date();
                      const status = codeItem.status === 'pending' && isExpired ? 'expired' : codeItem.status;

                      return (
                        <tr key={codeItem.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-3.5 font-mono font-bold text-slate-800 flex items-center gap-1.5">
                            <span>{codeItem.code}</span>
                            <button
                              onClick={() => handleCopy(codeItem.code)}
                              className="text-slate-400 hover:text-indigo-600 transition-colors p-1"
                              title="Copy"
                            >
                              {copiedCode === codeItem.code ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </td>
                          <td className="py-3.5 text-slate-600 font-medium">
                            {codeItem.department_name || '-'}
                          </td>
                          <td className="py-3.5 text-slate-600 font-medium">
                            {codeItem.warehouse_name || '-'}
                          </td>
                          <td className="py-3.5">
                            {status === 'pending' && (
                              <span className="px-2.5 py-1 bg-amber-50 text-amber-700 rounded-full font-bold text-[10px]">
                                {language === 'ar' ? 'في الانتظار' : 'Pending'}
                              </span>
                            )}
                            {status === 'used' && (
                              <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full font-bold text-[10px]">
                                {language === 'ar' ? 'مستخدم' : 'Used'}
                              </span>
                            )}
                            {status === 'expired' && (
                              <span className="px-2.5 py-1 bg-slate-100 text-slate-500 rounded-full font-bold text-[10px]">
                                {language === 'ar' ? 'منتهي' : 'Expired'}
                              </span>
                            )}
                            {status === 'revoked' && (
                              <span className="px-2.5 py-1 bg-rose-50 text-rose-700 rounded-full font-bold text-[10px]">
                                {language === 'ar' ? 'ملغي' : 'Revoked'}
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 text-slate-400 font-mono text-[11px]">
                            {new Date(codeItem.expires_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                          </td>
                          <td className="py-3.5 text-end">
                            {status === 'pending' ? (
                              <button
                                onClick={() => handleRevoke(codeItem.id)}
                                className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold rounded-lg transition-colors text-[11px]"
                              >
                                {language === 'ar' ? 'إلغاء' : 'Revoke'}
                              </button>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
