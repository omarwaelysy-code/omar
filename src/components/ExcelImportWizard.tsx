import React, { useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Download, Upload, CheckCircle, XCircle, AlertTriangle,
  FileSpreadsheet, Eye, ChevronRight, Loader2, RefreshCw,
  X, Info, ArrowRight, ArrowLeft, Check
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface ImportColumn {
  key: string;
  label: string;
  type: string;
}

interface ValidatedRow {
  rowNumber: number;
  data: Record<string, any>;
  errors?: string[];
}

interface ValidationResult {
  total: number;
  valid: number;
  errors: number;
  validRows: ValidatedRow[];
  errorRows: ValidatedRow[];
  columns: ImportColumn[];
  moduleConfig: { nameAr: string; uniqueKey?: string };
}

interface Props {
  module: string;
  moduleNameAr: string;
  onClose: () => void;
  onSuccess: () => void;
}

type Step = 'download' | 'upload' | 'preview' | 'done';

export const ExcelImportWizard: React.FC<Props> = ({ module, moduleNameAr, onClose, onSuccess }) => {
  const { dir } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>('download');
  const [uploading, setUploading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [importResult, setImportResult] = useState<{ inserted: number; updated: number; total: number } | null>(null);
  const [importError, setImportError] = useState('');
  const [showOnlyErrors, setShowOnlyErrors] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // ── Download Template ─────────────────────────────────────────
  const handleDownloadTemplate = () => {
    const token = localStorage.getItem('auth_token') || '';
    const link = document.createElement('a');
    link.href = `/api/erp/import/template/${module}`;
    link.setAttribute('download', `template_${module}.xlsx`);
    // Use fetch with auth header
    fetch(`/api/erp/import/template/${module}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.blob())
      .then(blob => {
        const url = URL.createObjectURL(blob);
        link.href = url;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      });
  };

  // ── Upload & Validate ─────────────────────────────────────────
  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setUploading(true);
    setValidation(null);
    setImportError('');

    const formData = new FormData();
    formData.append('file', file);
    const token = localStorage.getItem('auth_token') || '';

    try {
      const res = await fetch(`/api/erp/import/validate/${module}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل التحقق');
      setValidation(data);
      setStep('preview');
    } catch (err: any) {
      setImportError(err.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [module]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const fakeEvent = { target: { files: [file] } } as any;
    handleFileChange(fakeEvent);
  }, [handleFileChange]);

  // ── Execute Import ────────────────────────────────────────────
  const handleImport = async () => {
    if (!validation || validation.errors > 0) return;
    setImporting(true);
    setImportError('');
    const token = localStorage.getItem('auth_token') || '';
    try {
      const res = await fetch(`/api/erp/import/execute/${module}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ rows: validation.validRows })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل الاستيراد');
      setImportResult(data);
      setStep('done');
      onSuccess();
    } catch (err: any) {
      setImportError(err.message);
    } finally {
      setImporting(false);
    }
  };

  // ── Helpers ───────────────────────────────────────────────────
  const displayedRows = showOnlyErrors
    ? validation?.errorRows || []
    : [...(validation?.errorRows || []), ...(validation?.validRows || [])].sort((a, b) => a.rowNumber - b.rowNumber);

  const steps: { key: Step; label: string }[] = [
    { key: 'download', label: 'تنزيل النموذج' },
    { key: 'upload', label: 'رفع الملف' },
    { key: 'preview', label: 'مراجعة البيانات' },
    { key: 'done', label: 'اكتمل' }
  ];
  const stepIndex = steps.findIndex(s => s.key === step);

  return (
    <div className="fixed inset-0 z-[9990] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" dir="rtl">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="bg-gradient-to-l from-emerald-600 to-emerald-700 px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="text-white" size={22} />
            <div>
              <h2 className="text-white font-black text-lg">استيراد {moduleNameAr} من Excel</h2>
              <p className="text-emerald-100 text-xs">رفع البيانات من ملف Excel مع مراجعة قبل الحفظ</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-xl">
            <X size={20} />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-3 shrink-0">
          <div className="flex items-center gap-0">
            {steps.map((s, i) => (
              <React.Fragment key={s.key}>
                <div className={`flex items-center gap-2 text-sm font-bold ${i <= stepIndex ? 'text-emerald-600' : 'text-slate-400'}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black border-2 ${
                    i < stepIndex ? 'bg-emerald-600 border-emerald-600 text-white' :
                    i === stepIndex ? 'border-emerald-600 text-emerald-600 bg-white' :
                    'border-slate-300 text-slate-400 bg-white'
                  }`}>
                    {i < stepIndex ? <Check size={12} /> : i + 1}
                  </div>
                  <span className="hidden sm:inline">{s.label}</span>
                </div>
                {i < steps.length - 1 && (
                  <div className={`h-[2px] flex-1 mx-2 ${i < stepIndex ? 'bg-emerald-500' : 'bg-slate-200'}`} />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <AnimatePresence mode="wait">

            {/* ── STEP 1: Download Template ── */}
            {step === 'download' && (
              <motion.div key="download" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
                <div className="bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-6 text-center">
                  <FileSpreadsheet className="mx-auto mb-3 text-emerald-500" size={48} />
                  <h3 className="text-xl font-black text-slate-800 mb-2">الخطوة الأولى: تنزيل نموذج Excel</h3>
                  <p className="text-slate-600 text-sm mb-6 leading-relaxed">
                    قم بتنزيل النموذج الجاهز واملأه بالبيانات المطلوبة. النموذج يحتوي على شرح لكل عمود وأمثلة توضيحية والقيم المسموح بها.
                  </p>
                  <button
                    onClick={handleDownloadTemplate}
                    className="inline-flex items-center gap-3 px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl transition-all active:scale-95 shadow-lg shadow-emerald-200"
                  >
                    <Download size={20} />
                    تنزيل نموذج Excel - {moduleNameAr}
                  </button>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                  <div className="flex items-start gap-3">
                    <Info className="text-amber-500 shrink-0 mt-0.5" size={18} />
                    <div className="text-sm text-amber-800 space-y-1">
                      <p className="font-bold">تعليمات مهمة:</p>
                      <ul className="list-disc list-inside space-y-0.5 text-amber-700">
                        <li>لا تحذف أو تعدّل رؤوس الأعمدة (الصف الأول والثاني)</li>
                        <li>الصف الثالث مثال توضيحي فقط - يمكن حذفه</li>
                        <li>ابدأ إدخال البيانات من الصف الرابع</li>
                        <li>الحقول المعلمة بـ (*) إجبارية</li>
                        <li>الأكواد يجب أن تكون فريدة وغير مكررة</li>
                        <li>تنسيق التواريخ: YYYY-MM-DD (مثال: 2025-01-01)</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={() => setStep('upload')}
                    className="flex items-center gap-2 px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition-all active:scale-95"
                  >
                    التالي: رفع الملف
                    <ArrowLeft size={16} />
                  </button>
                </div>
              </motion.div>
            )}

            {/* ── STEP 2: Upload ── */}
            {step === 'upload' && (
              <motion.div key="upload" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
                <div
                  onDrop={handleDrop}
                  onDragOver={e => e.preventDefault()}
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-emerald-300 hover:border-emerald-500 bg-emerald-50 hover:bg-emerald-100 rounded-2xl p-10 text-center cursor-pointer transition-all group"
                >
                  {uploading ? (
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="animate-spin text-emerald-600" size={40} />
                      <p className="text-emerald-700 font-bold">جارٍ التحقق من الملف...</p>
                    </div>
                  ) : (
                    <>
                      <Upload className="mx-auto mb-3 text-emerald-400 group-hover:text-emerald-600 transition-colors" size={48} />
                      <h3 className="text-lg font-black text-slate-700 mb-1">اسحب الملف هنا أو اضغط للاختيار</h3>
                      <p className="text-slate-500 text-sm">ملفات Excel فقط (.xlsx, .xls) - الحجم الأقصى 10 ميجابايت</p>
                    </>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </div>

                {importError && (
                  <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-4 flex items-start gap-3">
                    <XCircle className="text-red-500 shrink-0 mt-0.5" size={20} />
                    <div>
                      <p className="font-bold text-red-700 text-sm">خطأ في التحقق</p>
                      <p className="text-red-600 text-sm mt-1">{importError}</p>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setStep('download')}
                    className="flex items-center gap-2 px-5 py-2.5 border border-slate-300 text-slate-600 hover:bg-slate-50 font-bold rounded-xl transition-all"
                  >
                    <ArrowRight size={16} />
                    السابق
                  </button>
                </div>
              </motion.div>
            )}

            {/* ── STEP 3: Preview ── */}
            {step === 'preview' && validation && (
              <motion.div key="preview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">

                {/* Summary Cards */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-center">
                    <p className="text-3xl font-black text-slate-700">{validation.total}</p>
                    <p className="text-slate-500 text-xs font-bold mt-1">إجمالي الصفوف</p>
                  </div>
                  <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-center">
                    <p className="text-3xl font-black text-emerald-600">{validation.valid}</p>
                    <p className="text-emerald-600 text-xs font-bold mt-1">صفوف صحيحة</p>
                  </div>
                  <div className={`border rounded-2xl p-4 text-center ${validation.errors > 0 ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'}`}>
                    <p className={`text-3xl font-black ${validation.errors > 0 ? 'text-red-600' : 'text-slate-400'}`}>{validation.errors}</p>
                    <p className={`text-xs font-bold mt-1 ${validation.errors > 0 ? 'text-red-600' : 'text-slate-400'}`}>صفوف بها أخطاء</p>
                  </div>
                </div>

                {/* Error alert */}
                {validation.errors > 0 && (
                  <div className="bg-red-50 border-2 border-red-300 rounded-2xl p-4 flex items-start gap-3">
                    <AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={20} />
                    <div>
                      <p className="font-black text-red-700">يوجد {validation.errors} صف {validation.errors === 1 ? 'يحتوي' : 'يحتوون'} على أخطاء</p>
                      <p className="text-red-600 text-sm mt-0.5">لا يمكن رفع البيانات حتى يتم تصحيح جميع الأخطاء. قم بتعديل الملف ورفعه مجدداً.</p>
                    </div>
                  </div>
                )}

                {validation.errors === 0 && (
                  <div className="bg-emerald-50 border-2 border-emerald-300 rounded-2xl p-4 flex items-center gap-3">
                    <CheckCircle className="text-emerald-500 shrink-0" size={20} />
                    <p className="font-bold text-emerald-700">جميع البيانات صحيحة! يمكنك الآن رفع البيانات.</p>
                  </div>
                )}

                {/* Data Table */}
                <div className="border border-slate-200 rounded-2xl overflow-hidden">
                  <div className="bg-slate-50 border-b border-slate-200 px-4 py-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Eye size={16} className="text-slate-500" />
                      <span className="font-bold text-slate-700 text-sm">معاينة البيانات</span>
                    </div>
                    {validation.errors > 0 && (
                      <button
                        onClick={() => setShowOnlyErrors(p => !p)}
                        className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all ${showOnlyErrors ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-slate-200 text-slate-600'}`}
                      >
                        {showOnlyErrors ? 'عرض الكل' : 'عرض الأخطاء فقط'}
                      </button>
                    )}
                  </div>
                  <div className="overflow-x-auto max-h-[340px]">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-100 sticky top-0 z-10">
                        <tr>
                          <th className="px-3 py-2 text-right font-bold text-slate-600 border-l border-slate-200 whitespace-nowrap">رقم الصف</th>
                          <th className="px-3 py-2 text-right font-bold text-slate-600 border-l border-slate-200 whitespace-nowrap">الحالة</th>
                          {validation.columns.map(col => (
                            <th key={col.key} className="px-3 py-2 text-right font-bold text-slate-600 border-l border-slate-200 whitespace-nowrap min-w-[120px]">
                              {col.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {displayedRows.map((row, idx) => {
                          const isError = (row.errors?.length || 0) > 0;
                          return (
                            <React.Fragment key={idx}>
                              <tr className={`${isError ? 'bg-red-50' : idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                                <td className="px-3 py-2 text-slate-500 font-mono font-bold border-l border-slate-100">{row.rowNumber}</td>
                                <td className="px-3 py-2 border-l border-slate-100">
                                  {isError
                                    ? <span className="inline-flex items-center gap-1 text-red-600 font-bold"><XCircle size={12} />خطأ</span>
                                    : <span className="inline-flex items-center gap-1 text-emerald-600 font-bold"><CheckCircle size={12} />صحيح</span>
                                  }
                                </td>
                                {validation.columns.map(col => (
                                  <td key={col.key} className={`px-3 py-2 border-l border-slate-100 whitespace-nowrap ${
                                    isError && (row.errors || []).some(e => e.includes(col.label.replace(' *', '')))
                                      ? 'bg-red-100 text-red-700 font-bold'
                                      : 'text-slate-700'
                                  }`}>
                                    {row.data[col.key] !== null && row.data[col.key] !== undefined ? String(row.data[col.key]) : <span className="text-slate-300">—</span>}
                                  </td>
                                ))}
                              </tr>
                              {isError && (
                                <tr className="bg-red-50 border-b border-red-100">
                                  <td colSpan={validation.columns.length + 2} className="px-4 py-1.5">
                                    <div className="flex items-start gap-2 flex-wrap">
                                      <AlertTriangle size={12} className="text-red-500 shrink-0 mt-0.5" />
                                      {(row.errors || []).map((err, ei) => (
                                        <span key={ei} className="text-red-600 text-xs font-bold bg-red-100 px-2 py-0.5 rounded-lg">{err}</span>
                                      ))}
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {importError && (
                  <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-4 flex items-start gap-3">
                    <XCircle className="text-red-500 shrink-0" size={20} />
                    <div>
                      <p className="font-bold text-red-700 text-sm">فشل الاستيراد</p>
                      <p className="text-red-600 text-sm">{importError}</p>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex items-center justify-between pt-2">
                  <button
                    onClick={() => { setStep('upload'); setValidation(null); setSelectedFile(null); setImportError(''); }}
                    className="flex items-center gap-2 px-5 py-2.5 border border-slate-300 text-slate-600 hover:bg-slate-50 font-bold rounded-xl transition-all"
                  >
                    <RefreshCw size={15} />
                    رفع ملف آخر
                  </button>
                  <button
                    onClick={handleImport}
                    disabled={validation.errors > 0 || importing}
                    className="flex items-center gap-2 px-8 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-black rounded-2xl transition-all active:scale-95 shadow-lg shadow-emerald-100"
                  >
                    {importing ? (
                      <><Loader2 className="animate-spin" size={18} />جارٍ الرفع...</>
                    ) : (
                      <><Upload size={18} />رفع {validation.valid} سجل</>
                    )}
                  </button>
                </div>
              </motion.div>
            )}

            {/* ── STEP 4: Done ── */}
            {step === 'done' && importResult && (
              <motion.div key="done" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-8 space-y-6">
                <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle className="text-emerald-500" size={40} />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-slate-800 mb-2">تم الاستيراد بنجاح!</h3>
                  <p className="text-slate-500">تم رفع البيانات إلى قاعدة البيانات بنجاح</p>
                </div>
                <div className="grid grid-cols-3 gap-4 max-w-sm mx-auto">
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                    <p className="text-2xl font-black text-slate-700">{importResult.total}</p>
                    <p className="text-xs text-slate-500 font-bold">إجمالي</p>
                  </div>
                  <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
                    <p className="text-2xl font-black text-emerald-600">{importResult.inserted}</p>
                    <p className="text-xs text-emerald-600 font-bold">جديد</p>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
                    <p className="text-2xl font-black text-blue-600">{importResult.updated}</p>
                    <p className="text-xs text-blue-600 font-bold">محدّث</p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="inline-flex items-center gap-2 px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl transition-all active:scale-95"
                >
                  <Check size={18} />
                  إغلاق وعرض البيانات
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};

export default ExcelImportWizard;
