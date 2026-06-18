import React, { useState, useEffect } from 'react';
import { 
  Database, 
  Download, 
  Upload, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle2, 
  Calendar,
  Clock,
  Shield,
  FileJson,
  FileSpreadsheet
} from 'lucide-react';
import { dbService } from '../services/dbService';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '../contexts/LanguageContext';

export const BackupRestore: React.FC = () => {
  const { user } = useAuth();
  const { t, dir, language } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'info', message: string } | null>(null);
  const [progress, setProgress] = useState(0);
  const [backupSchedule, setBackupSchedule] = useState<'none' | 'daily' | 'weekly' | 'monthly'>('none');
  const [lastBackup, setLastBackup] = useState<string | null>(null);
  
  // Custom Modal States
  const [confirmModal, setConfirmModal] = useState<{
    show: boolean;
    title: string;
    message: string;
    onConfirm: (mode: 'merge' | 'replace') => void;
    type: 'json' | 'excel';
  }>({
    show: false,
    title: '',
    message: '',
    onConfirm: () => {},
    type: 'json'
  });

  const [restoreMode, setRestoreMode] = useState<'merge' | 'replace'>('merge');

  const [successModal, setSuccessModal] = useState<{
    show: boolean;
    message: string;
  }>({
    show: false,
    message: ''
  });

  useEffect(() => {
    if (user) {
      // Load last backup info from local storage or settings
      const savedLastBackup = localStorage.getItem(`last_backup_${user.company_id}`);
      const savedSchedule = localStorage.getItem(`backup_schedule_${user.company_id}`);
      if (savedLastBackup) setLastBackup(savedLastBackup);
      if (savedSchedule) setBackupSchedule(savedSchedule as any);
    }
  }, [user]);

  const handleExportJSON = async () => {
    if (!user) return;
    setLoading(true);
    setStatus({ type: 'info', message: language === 'ar' ? 'جاري تحضير النسخة الاحتياطية على الخادم...' : 'Preparing backup on server...' });
    setProgress(20);

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/erp/system/backup?company_id=${user.company_id}`, {
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
        },
      });

      if (!response.ok) {
        throw new Error(language === 'ar' ? 'فشل تصدير النسخة الاحتياطية من الخادم' : 'Failed to export backup from server');
      }

      setProgress(80);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `backup_${user.company_id}_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      const now = new Date().toLocaleString('ar-EG');
      setLastBackup(now);
      localStorage.setItem(`last_backup_${user.company_id}`, now);
      
      setProgress(100);
      setStatus({ type: 'success', message: language === 'ar' ? 'تم تصدير النسخة الاحتياطية بنجاح' : 'Backup exported successfully' });
      await dbService.logActivity(user.id, user.username, user.company_id, language === 'ar' ? 'نسخ احتياطي' : 'Backup', language === 'ar' ? 'تصدير نسخة احتياطية كاملة (JSON)' : 'Export full backup (JSON)', 'backup');
    } catch (error: any) {
      console.error('Export error:', error);
      setStatus({ type: 'error', message: error.message || (language === 'ar' ? 'فشل تصدير النسخة الاحتياطية' : 'Failed to export backup') });
    } finally {
      setLoading(false);
    }
  };

  const handleExportExcel = async () => {
    if (!user) return;
    setLoading(true);
    setStatus({ type: 'info', message: language === 'ar' ? 'جاري تحضير ملف Excel على الخادم...' : 'Preparing Excel file on server...' });
    setProgress(30);

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/erp/system/export-excel?company_id=${user.company_id}`, {
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
        },
      });

      if (!response.ok) {
        throw new Error(language === 'ar' ? 'فشل تصدير ملف Excel من الخادم' : 'Failed to export Excel file from server');
      }

      setProgress(70);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `backup_${user.company_id}_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      setProgress(100);
      setStatus({ type: 'success', message: language === 'ar' ? 'تم تصدير ملف Excel بنجاح' : 'Excel file exported successfully' });
      await dbService.logActivity(user.id, user.username, user.company_id, language === 'ar' ? 'نسخ احتياطي' : 'Backup', language === 'ar' ? 'تصدير بيانات إلى Excel' : 'Export data to Excel', 'backup');
    } catch (error: any) {
      console.error('Excel export error:', error);
      setStatus({ type: 'error', message: error.message || (language === 'ar' ? 'فشل تصدير ملف Excel' : 'Failed to export Excel file') });
    } finally {
      setLoading(false);
    }
  };

  const executeImportJSON = async (file: File, mode: 'merge' | 'replace') => {
    if (!user) return;
    setLoading(true);
    setStatus({ type: 'info', message: language === 'ar' ? 'جاري رفع ومعالجة ملف النسخة الاحتياطية...' : 'Uploading and processing backup file...' });
    setProgress(10);

    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/erp/system/restore?mode=${mode}`, {
        method: 'POST',
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
        },
        body: formData
      });

      setProgress(90);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || (language === 'ar' ? 'فشل استعادة البيانات' : 'Failed to restore data'));
      }

      setProgress(100);
      setStatus({ type: 'success', message: language === 'ar' ? 'تم استعادة البيانات بنجاح' : 'Data restored successfully' });
      setSuccessModal({
        show: true,
        message: mode === 'replace' 
          ? (language === 'ar' ? 'تم حذف البيانات القديمة واستبدالها بالنسخة الاحتياطية بنجاح' : 'Old data deleted and replaced with backup successfully')
          : (language === 'ar' ? 'تم دمج البيانات المستوردة مع البيانات الحالية بنجاح' : 'Imported data merged with current data successfully')
      });
      await dbService.logActivity(user.id, user.username, user.company_id, language === 'ar' ? 'استعادة بيانات' : 'Restore Data', language === 'ar' ? `استعادة نسخة احتياطية (JSON) - وضع: ${mode === 'replace' ? 'استبدال' : 'دمج'}` : `Restore backup (JSON) - Mode: ${mode === 'replace' ? 'Replace' : 'Merge'}`, 'backup');
    } catch (error: any) {
      console.error('Import error:', error);
      setStatus({ type: 'error', message: error.message || (language === 'ar' ? 'فشل استيراد البيانات' : 'Failed to import data') });
    } finally {
      setLoading(false);
    }
  };

  const handleImportJSON = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    setConfirmModal({
      show: true,
      title: language === 'ar' ? 'تأكيد استعادة JSON' : 'Confirm JSON Restore',
      message: language === 'ar' ? 'تعمل هذه العملية على استعادة كافة الجداول والبيانات. يرجى اختيار طريقة الاستعادة:' : 'This operation restores all tables and data. Please choose the restore method:',
      onConfirm: (mode) => executeImportJSON(file, mode),
      type: 'json'
    });
    
    event.target.value = '';
  };

  const executeImportExcel = async (file: File, mode: 'merge' | 'replace') => {
    if (!user) return;
    setLoading(true);
    setStatus({ type: 'info', message: language === 'ar' ? 'جاري رفع ومعالجة ملف Excel...' : 'Uploading and processing Excel file...' });
    setProgress(10);

    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/erp/system/import-excel?mode=${mode}`, {
        method: 'POST',
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
        },
        body: formData
      });

      setProgress(90);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || (language === 'ar' ? 'فشل استيراد ملف Excel' : 'Failed to import Excel file'));
      }

      setProgress(100);
      setStatus({ type: 'success', message: language === 'ar' ? 'تم استعادة البيانات من ملف Excel بنجاح' : 'Data restored from Excel file successfully' });
      setSuccessModal({
        show: true,
        message: mode === 'replace' 
          ? (language === 'ar' ? 'تم حذف البيانات القديمة واستبدالها ببيانات ملف Excel بنجاح' : 'Old data deleted and replaced with Excel data successfully')
          : (language === 'ar' ? 'تم دمج بيانات ملف Excel مع البيانات الحالية بنجاح' : 'Excel data merged with current data successfully')
      });
      await dbService.logActivity(user.id, user.username, user.company_id, language === 'ar' ? 'استعادة بيانات' : 'Restore Data', language === 'ar' ? `استعادة بيانات من Excel - وضع: ${mode === 'replace' ? 'استبدال' : 'دمج'}` : `Restore data from Excel - Mode: ${mode === 'replace' ? 'Replace' : 'Merge'}`, 'backup');
    } catch (error: any) {
      console.error('Excel import error:', error);
      setStatus({ type: 'error', message: error.message || (language === 'ar' ? 'فشل استيراد ملف Excel' : 'Failed to import Excel file') });
    } finally {
      setLoading(false);
    }
  };

  const handleImportExcel = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    setConfirmModal({
      show: true,
      title: language === 'ar' ? 'تأكيد استعادة Excel' : 'Confirm Excel Restore',
      message: language === 'ar' ? 'يرجى اختيار طريقة الاستعادة المفضلة:' : 'Please choose your preferred restore method:',
      onConfirm: (mode) => executeImportExcel(file, mode),
      type: 'excel'
    });
    
    // Reset input
    event.target.value = '';
  };

  const handleScheduleChange = (schedule: typeof backupSchedule) => {
    if (!user) return;
    setBackupSchedule(schedule);
    localStorage.setItem(`backup_schedule_${user.company_id}`, schedule);
    setStatus({ type: 'success', message: language === 'ar' ? 'تم تحديث جدول النسخ الاحتياطي' : 'Backup schedule updated' });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20" dir={dir}>
      {/* Header */}
      <div className="bg-white rounded-3xl p-8 shadow-sm border border-stone-200">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 bg-emerald-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
            <Database size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-stone-900">{language === 'ar' ? 'النسخ الاحتياطي والاستعادة' : 'Backup & Restore'}</h1>
            <p className="text-stone-500 font-medium">{language === 'ar' ? 'قم بحماية بياناتك من خلال عمل نسخ احتياطية منتظمة' : 'Protect your data by creating regular backups'}</p>
          </div>
        </div>

        <AnimatePresence>
          {status && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={`p-4 rounded-2xl flex items-center gap-3 mb-6 ${
                status.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                status.type === 'error' ? 'bg-red-50 text-red-700 border border-red-100' :
                'bg-blue-50 text-blue-700 border border-blue-100'
              }`}
            >
              {status.type === 'success' ? <CheckCircle2 size={20} /> : 
               status.type === 'error' ? <AlertCircle size={20} /> : 
               <RefreshCw size={20} className="animate-spin" />}
              <span className="font-bold">{status.message}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {loading && (
          <div className="mb-6 space-y-2">
            <div className="flex justify-between text-sm font-bold text-stone-600">
              <span>{language === 'ar' ? 'جاري المعالجة...' : 'Processing...'}</span>
              <span>{progress}%</span>
            </div>
            <div className="w-full h-3 bg-stone-100 rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-emerald-500"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Export Section */}
          <div className="space-y-4">
            <h2 className="text-lg font-black text-stone-800 flex items-center gap-2">
              <Download size={20} className="text-emerald-500" />
              {language === 'ar' ? 'تصدير البيانات' : 'Export Data'}
            </h2>
            <div className="grid grid-cols-1 gap-3">
              <button
                onClick={handleExportJSON}
                disabled={loading}
                className="flex items-center justify-between p-4 bg-stone-50 hover:bg-emerald-50 border border-stone-200 hover:border-emerald-200 rounded-2xl transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white rounded-xl shadow-sm group-hover:text-emerald-500 transition-colors">
                    <FileJson size={24} />
                  </div>
                  <div className="text-right">
                    <p className="font-black text-stone-900">{language === 'ar' ? 'نسخة احتياطية كاملة' : 'Full Backup'}</p>
                    <p className="text-xs text-stone-500">{language === 'ar' ? 'ملف JSON للاستعادة الكاملة' : 'JSON file for full restore'}</p>
                  </div>
                </div>
                <Download size={18} className="text-stone-400 group-hover:text-emerald-500" />
              </button>

              <button
                onClick={handleExportExcel}
                disabled={loading}
                className="flex items-center justify-between p-4 bg-stone-50 hover:bg-blue-50 border border-stone-200 hover:border-blue-200 rounded-2xl transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white rounded-xl shadow-sm group-hover:text-blue-500 transition-colors">
                    <FileSpreadsheet size={24} />
                  </div>
                  <div className="text-right">
                    <p className="font-black text-stone-900">{language === 'ar' ? 'تصدير إلى Excel' : 'Export to Excel'}</p>
                    <p className="text-xs text-stone-500">{language === 'ar' ? 'ملف جداول بيانات للمراجعة' : 'Spreadsheet file for review'}</p>
                  </div>
                </div>
                <Download size={18} className="text-stone-400 group-hover:text-blue-500" />
              </button>
            </div>
          </div>

          {/* Import Section */}
          <div className="space-y-4">
            <h2 className="text-lg font-black text-stone-800 flex items-center gap-2">
              <Upload size={20} className="text-blue-500" />
              {language === 'ar' ? 'استعادة البيانات' : 'Restore Data'}
            </h2>
            <div className="grid grid-cols-1 gap-3">
              <div className="relative">
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportJSON}
                  disabled={loading}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                />
                <div className="flex items-center justify-between p-4 bg-stone-50 hover:bg-emerald-50 border border-stone-200 hover:border-emerald-200 rounded-2xl transition-all group">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white rounded-xl shadow-sm group-hover:text-emerald-500 transition-colors">
                      <FileJson size={24} />
                    </div>
                    <div className="text-right">
                      <p className="font-black text-stone-900">{language === 'ar' ? 'رفع ملف JSON' : 'Upload JSON File'}</p>
                      <p className="text-xs text-stone-500">{language === 'ar' ? 'استعادة كاملة تشمل الصور والإعدادات' : 'Full restore including images and settings'}</p>
                    </div>
                  </div>
                  <Upload size={18} className="text-stone-400 group-hover:text-emerald-500" />
                </div>
              </div>

              <div className="relative">
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={handleImportExcel}
                  disabled={loading}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                />
                <div className="flex items-center justify-between p-4 bg-stone-50 hover:bg-blue-50 border border-stone-200 hover:border-blue-200 rounded-2xl transition-all group">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white rounded-xl shadow-sm group-hover:text-blue-500 transition-colors">
                      <FileSpreadsheet size={24} />
                    </div>
                    <div className="text-right">
                      <p className="font-black text-stone-900">{language === 'ar' ? 'رفع ملف Excel' : 'Upload Excel File'}</p>
                      <p className="text-xs text-stone-500">{language === 'ar' ? 'استعادة البيانات من جداول Excel' : 'Restore data from Excel sheets'}</p>
                    </div>
                  </div>
                  <Upload size={18} className="text-stone-400 group-hover:text-blue-500" />
                </div>
              </div>
            </div>
            <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl">
              <div className="flex gap-3">
                <AlertCircle size={20} className="text-amber-600 shrink-0" />
                <p className="text-xs text-amber-800 leading-relaxed font-bold">
                  {language === 'ar' ? 'تنبيه: عملية الاستعادة ستقوم بدمج البيانات. تأكد من أن الملف صحيح وينتمي لنفس الشركة لتجنب تداخل البيانات.' : 'Warning: The restore process will merge data. Make sure the file is correct and belongs to the same company to avoid data overlap.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Schedule Section */}
      <div className="bg-white rounded-3xl p-8 shadow-sm border border-stone-200">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-stone-100 rounded-2xl flex items-center justify-center text-stone-600">
              <Calendar size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black text-stone-900">{language === 'ar' ? 'جدولة النسخ الاحتياطي' : 'Backup Schedule'}</h2>
              <p className="text-stone-500 text-sm font-medium">{language === 'ar' ? 'قم بتعيين تذكير دوري لعمل نسخة احتياطية' : 'Set a periodic reminder to make a backup'}</p>
            </div>
          </div>
          {lastBackup && (
            <div className="text-right">
              <p className="text-xs text-stone-400 font-bold uppercase tracking-wider">{language === 'ar' ? 'آخر نسخة احتياطية' : 'Last Backup'}</p>
              <p className="text-sm font-black text-stone-900">{lastBackup}</p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { id: 'none', label: language === 'ar' ? 'بدون جدولة' : 'No Schedule', icon: Shield },
            { id: 'daily', label: language === 'ar' ? 'يومي' : 'Daily', icon: Clock },
            { id: 'weekly', label: language === 'ar' ? 'أسبوعي' : 'Weekly', icon: Calendar },
            { id: 'monthly', label: language === 'ar' ? 'شهري' : 'Monthly', icon: Calendar }
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => handleScheduleChange(item.id as any)}
              className={`
                flex flex-col items-center gap-3 p-6 rounded-2xl border-2 transition-all
                ${backupSchedule === item.id 
                  ? 'bg-emerald-50 border-emerald-500 text-emerald-700' 
                  : 'bg-stone-50 border-stone-100 text-stone-500 hover:border-stone-200'}
              `}
            >
              <item.icon size={24} />
              <span className="font-black text-sm">{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Security Info */}
      <div className="bg-zinc-900 rounded-3xl p-8 text-white shadow-xl">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center">
            <Shield size={24} className="text-emerald-400" />
          </div>
          <h2 className="text-xl font-black">{language === 'ar' ? 'أمان البيانات' : 'Data Security'}</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="space-y-2">
            <h3 className="font-black text-emerald-400">{language === 'ar' ? 'تشفير كامل' : 'Full Encryption'}</h3>
            <p className="text-sm text-zinc-400 leading-relaxed font-medium">
              {language === 'ar' ? 'يتم تخزين بياناتك بشكل آمن ومشفر على خوادم Firestore السحابية مع حماية كاملة.' : 'Your data is stored securely and encrypted on Firestore cloud servers with complete protection.'}
            </p>
          </div>
          <div className="space-y-2">
            <h3 className="font-black text-emerald-400">{language === 'ar' ? 'تحكم مطلق' : 'Absolute Control'}</h3>
            <p className="text-sm text-zinc-400 leading-relaxed font-medium">
              {language === 'ar' ? 'أنت تملك بياناتك بالكامل ويمكنك تصديرها في أي وقت بتنسيقات مفتوحة (JSON/Excel).' : 'You own your data completely and can export it at any time in open formats (JSON/Excel).'}
            </p>
          </div>
          <div className="space-y-2">
            <h3 className="font-black text-emerald-400">{language === 'ar' ? 'استعادة سريعة' : 'Quick Recovery'}</h3>
            <p className="text-sm text-zinc-400 leading-relaxed font-medium">
              {language === 'ar' ? 'في حالة حدوث أي خطأ، يمكنك العودة لنقطة سابقة من خلال ملفات النسخ الاحتياطي.' : 'In case of any error, you can return to a previous point through backup files.'}
            </p>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {confirmModal.show && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border border-stone-200"
            >
              <div className="flex items-center gap-4 mb-6">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                  confirmModal.type === 'json' ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'
                }`}>
                  <AlertCircle size={24} />
                </div>
                <h3 className="text-xl font-black text-stone-900">{confirmModal.title}</h3>
              </div>
              <p className="text-stone-600 font-bold mb-6 leading-relaxed">
                {confirmModal.message}
              </p>

              <div className="space-y-3 mb-8">
                <button
                  onClick={() => setRestoreMode('merge')}
                  className={`w-full p-4 rounded-2xl border-2 text-right transition-all ${
                    restoreMode === 'merge'
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-700'
                      : 'bg-stone-50 border-stone-100 text-stone-500 hover:border-stone-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      restoreMode === 'merge' ? 'border-emerald-500' : 'border-stone-300'
                    }`}>
                      {restoreMode === 'merge' && <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full" />}
                    </div>
                    <div className="flex-1 mr-3">
                      <p className="font-black text-sm">{language === 'ar' ? 'دمج البيانات (Merge)' : 'Merge Data (Merge)'}</p>
                      <p className="text-xs opacity-70">{language === 'ar' ? 'إضافة البيانات الجديدة إلى البيانات الحالية دون حذف' : 'Add new data to current data without deleting'}</p>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => setRestoreMode('replace')}
                  className={`w-full p-4 rounded-2xl border-2 text-right transition-all ${
                    restoreMode === 'replace'
                      ? 'bg-red-50 border-red-500 text-red-700'
                      : 'bg-stone-50 border-stone-100 text-stone-500 hover:border-stone-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      restoreMode === 'replace' ? 'border-red-500' : 'border-stone-300'
                    }`}>
                      {restoreMode === 'replace' && <div className="w-2.5 h-2.5 bg-red-500 rounded-full" />}
                    </div>
                    <div className="flex-1 mr-3">
                      <p className="font-black text-sm">{language === 'ar' ? 'استبدال البيانات (Replace)' : 'Replace Data (Replace)'}</p>
                      <p className="text-xs opacity-70">{language === 'ar' ? 'حذف كافة البيانات الحالية واستبدالها بالنسخة الاحتياطية' : 'Delete all current data and replace it with backup'}</p>
                    </div>
                  </div>
                </button>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    confirmModal.onConfirm(restoreMode);
                    setConfirmModal(prev => ({ ...prev, show: false }));
                  }}
                  className={`flex-1 py-4 rounded-2xl font-black text-white shadow-lg transition-all active:scale-95 ${
                    restoreMode === 'replace'
                      ? 'bg-red-500 shadow-red-500/20 hover:bg-red-600'
                      : confirmModal.type === 'json' 
                        ? 'bg-emerald-500 shadow-emerald-500/20 hover:bg-emerald-600' 
                        : 'bg-blue-500 shadow-blue-500/20 hover:bg-blue-600'
                  }`}
                >
                  {language === 'ar' ? 'تأكيد الاستعادة' : 'Confirm Restore'}
                </button>
                <button
                  onClick={() => setConfirmModal(prev => ({ ...prev, show: false }))}
                  className="flex-1 py-4 bg-stone-100 hover:bg-stone-200 text-stone-600 rounded-2xl font-black transition-all active:scale-95"
                >
                  {language === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Success Modal */}
      <AnimatePresence>
        {successModal.show && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border border-stone-200 text-center"
            >
              <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 size={40} />
              </div>
              <h3 className="text-2xl font-black text-stone-900 mb-4">{language === 'ar' ? 'تمت العملية بنجاح' : 'Success'}</h3>
              <p className="text-stone-600 font-bold mb-8 leading-relaxed">
                {successModal.message}
              </p>
              <button
                onClick={() => setSuccessModal({ show: false, message: '' })}
                className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-black shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
              >
                {language === 'ar' ? 'حسناً' : 'OK'}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
