import React, { useState, useEffect } from 'react';
import { 
  X, Sparkles, AlertCircle, CheckCircle, Clock, Search, Layers, 
  FileText, ShieldCheck, ChevronDown, Check, Loader2 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { apiRequest } from '../services/dbService';
import { useLanguage } from '../contexts/LanguageContext';

export interface EtaCodeRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  companyTaxNumber: string;
  initialCode?: string;
  initialName?: string;
  initialDescription?: string;
  initialCodeType?: 'EGS' | 'GS1';
  initialGpcBrick?: string;
  productId?: string;
  onSuccess: (result: {
    itemCode: string;
    codeType: 'EGS' | 'GS1';
    status: 'Submitted' | 'Approved' | 'Rejected';
    gpcBrick?: string;
  }) => void;
}

interface GpcBrickItem {
  code: string;
  name_ar: string;
  name_en: string;
  category: string;
}

export const EtaCodeRegistrationModal: React.FC<EtaCodeRegistrationModalProps> = ({
  isOpen,
  onClose,
  companyTaxNumber,
  initialCode = '',
  initialName = '',
  initialDescription = '',
  initialCodeType = 'EGS',
  initialGpcBrick = '',
  productId,
  onSuccess
}) => {
  const { language, dir } = useLanguage();
  const isAr = language === 'ar';

  const [codeType, setCodeType] = useState<'EGS' | 'GS1'>(initialCodeType || 'EGS');
  const [internalSuffix, setInternalSuffix] = useState('');
  const [gs1Code, setGs1Code] = useState('');
  const [codeNameAr, setCodeNameAr] = useState('');
  const [codeNameEn, setCodeNameEn] = useState('');
  const [descriptionAr, setDescriptionAr] = useState('');
  const [descriptionEn, setDescriptionEn] = useState('');
  const [activeFrom, setActiveFrom] = useState(new Date().toISOString().slice(0, 10));
  const [activeTo, setActiveTo] = useState('');
  const [requestReason, setRequestReason] = useState('طلب تسجيل كود صنف جديد من نظام ERP');

  // GPC Brick States
  const [selectedGpc, setSelectedGpc] = useState<GpcBrickItem | null>(null);
  const [customGpcCode, setCustomGpcCode] = useState(initialGpcBrick || '');
  const [gpcSearchQuery, setGpcSearchQuery] = useState('');
  const [gpcBricks, setGpcBricks] = useState<GpcBrickItem[]>([]);
  const [isSearchingGpc, setIsSearchingGpc] = useState(false);
  const [showGpcDropdown, setShowGpcDropdown] = useState(false);

  // Status & Submission States
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Initialize form values when modal opens
  useEffect(() => {
    if (isOpen) {
      setCodeType(initialCodeType || 'EGS');
      const cleanCode = initialCode.trim();

      // If initial code is already EGS formatted: EG-123456789-PRD01
      if (cleanCode.startsWith('EG-')) {
        const parts = cleanCode.split('-');
        if (parts.length >= 3) {
          setInternalSuffix(parts.slice(2).join('-'));
        } else {
          setInternalSuffix(cleanCode);
        }
      } else {
        setInternalSuffix(cleanCode || 'ITEM01');
      }

      setGs1Code(initialCodeType === 'GS1' ? cleanCode : '');
      setCodeNameAr(initialName || '');
      setCodeNameEn(initialName || '');
      setDescriptionAr(initialDescription || initialName || '');
      setDescriptionEn(initialDescription || initialName || '');
      setActiveFrom(new Date().toISOString().slice(0, 10));
      setActiveTo('');
      setCustomGpcCode(initialGpcBrick || '');
      setErrorMessage(null);
      setSuccessMessage(null);
      setShowGpcDropdown(false);

      // Load initial GPC bricks
      loadGpcBricks('');
    }
  }, [isOpen, initialCode, initialName, initialDescription, initialCodeType, initialGpcBrick]);

  const loadGpcBricks = async (query: string) => {
    try {
      setIsSearchingGpc(true);
      const url = query ? `/eta/gpc-bricks?q=${encodeURIComponent(query)}` : '/eta/gpc-bricks';
      const res = await apiRequest<{ success: boolean; data: GpcBrickItem[] }>(url, 'GET');
      if (res?.data) {
        setGpcBricks(res.data);
        // If initialGpcBrick exists, try to match it
        if (initialGpcBrick && !selectedGpc) {
          const matched = res.data.find(b => b.code === initialGpcBrick);
          if (matched) setSelectedGpc(matched);
        }
      }
    } catch (err) {
      console.warn('Failed to load GPC bricks:', err);
    } finally {
      setIsSearchingGpc(false);
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setGpcSearchQuery(val);
    setShowGpcDropdown(true);
    loadGpcBricks(val);
  };

  const handleSelectGpc = (brick: GpcBrickItem) => {
    setSelectedGpc(brick);
    setCustomGpcCode(brick.code);
    setShowGpcDropdown(false);
    setGpcSearchQuery('');
  };

  const cleanTaxNumber = (companyTaxNumber || '').replace(/\D/g, '');
  const fullEgsCode = cleanTaxNumber && internalSuffix.trim() 
    ? `EG-${cleanTaxNumber}-${internalSuffix.trim()}` 
    : '';

  const fullItemCode = codeType === 'EGS' ? fullEgsCode : gs1Code.trim();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    // Validations
    if (codeType === 'EGS') {
      if (!cleanTaxNumber) {
        setErrorMessage(isAr ? 'الرقم الضريبي للشركة غير مسجل. يرجى إضافته في إعدادات الشركة أولاً.' : 'Company Tax Number is missing in settings.');
        return;
      }
      if (!internalSuffix.trim()) {
        setErrorMessage(isAr ? 'كود الصنف الداخلي مطلوب لتوليد كود الـ EGS.' : 'Internal item code is required.');
        return;
      }
      const gpcCode = (selectedGpc?.code || customGpcCode || '').trim();
      if (!gpcCode) {
        setErrorMessage(isAr ? 'يرجى اختيار أو كتابة كود تصنيف فئة GPC Brick (إجباري من مصلحة الضرائب).' : 'GPC Brick code is required.');
        return;
      }
    } else {
      if (!gs1Code.trim()) {
        setErrorMessage(isAr ? 'كود صنف GS1 الدولي مطلوب.' : 'GS1 Item Code is required.');
        return;
      }
    }

    if (!codeNameAr.trim() && !codeNameEn.trim()) {
      setErrorMessage(isAr ? 'اسم الصنف بالعربية أو الإنجليزية مطلوب.' : 'Item name in Arabic or English is required.');
      return;
    }

    setLoading(true);
    try {
      const gpcCode = codeType === 'EGS' ? (selectedGpc?.code || customGpcCode || '').trim() : undefined;

      const res = await apiRequest<{
        success: boolean;
        status: 'Submitted' | 'Approved' | 'Rejected';
        itemCode: string;
        message: string;
      }>('/eta/items/register-code', 'POST', {
        codeType,
        itemCode: fullItemCode,
        parentCode: gpcCode,
        codeNameAr: codeNameAr.trim() || codeNameEn.trim(),
        codeNameEn: codeNameEn.trim() || codeNameAr.trim(),
        descriptionAr: descriptionAr.trim() || descriptionEn.trim() || codeNameAr.trim(),
        descriptionEn: descriptionEn.trim() || descriptionAr.trim() || codeNameEn.trim(),
        activeFrom: activeFrom || new Date().toISOString(),
        activeTo: activeTo || undefined,
        productId,
        requestReason: requestReason.trim()
      });

      if (res.success) {
        setSuccessMessage(res.message);
        onSuccess({
          itemCode: fullItemCode,
          codeType,
          status: res.status,
          gpcBrick: gpcCode
        });
        setTimeout(() => {
          onClose();
        }, 1200);
      } else {
        setErrorMessage(res.message || (isAr ? 'رفضت منظومة الضرائب تسجيل الكود.' : 'ETA rejected the code registration.'));
      }
    } catch (err: any) {
      setErrorMessage(err.message || (isAr ? 'حدث خطأ أثناء الاتصال بمنظومة الضرائب.' : 'An error occurred while connecting to ETA.'));
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
        dir={dir}
      >
        <motion.div
          initial={{ scale: 0.96, y: 15 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.96, y: 15 }}
          className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto max-h-[92vh]"
        >
          {/* Header */}
          <div className="px-5 py-3.5 bg-gradient-to-r from-purple-700 via-indigo-700 to-purple-800 text-white flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center text-amber-300 shadow-inner">
                <Sparkles size={18} />
              </div>
              <div>
                <h3 className="text-sm font-black tracking-wide flex items-center gap-1.5">
                  <span>{isAr ? 'تسجيل كود صنف بالضرائب المصرية (ETA)' : 'Register Item Code with ETA'}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/20 text-white font-mono font-bold">
                    Official Portal Sync
                  </span>
                </h3>
                <p className="text-[11px] text-purple-100 font-medium">
                  {isAr ? 'إرسال طلب اعتماد الكود مباشرة إلى بوابة منظومة الفاتورة الإلكترونية' : 'Submit item code request directly to Egyptian Tax Authority portal'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={loading}
              className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Type Selector Tabs */}
          <div className="bg-slate-100 p-2 flex items-center gap-2 border-b border-slate-200">
            <button
              type="button"
              onClick={() => setCodeType('EGS')}
              className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                codeType === 'EGS'
                  ? 'bg-white text-purple-700 shadow-sm border border-purple-200'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Layers size={14} />
              <span>{isAr ? 'EGS (المعيار المصري - برقم التسجيل)' : 'EGS (Egyptian Standard)'}</span>
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-100 text-purple-800 font-black">يتطلب موافقة ⏳</span>
            </button>

            <button
              type="button"
              onClick={() => setCodeType('GS1')}
              className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                codeType === 'GS1'
                  ? 'bg-white text-indigo-700 shadow-sm border border-indigo-200'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <ShieldCheck size={14} />
              <span>{isAr ? 'GS1 (الباركود الدولي)' : 'GS1 (Global Barcode)'}</span>
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 font-black">اعتماد فوري ✅</span>
            </button>
          </div>

          {/* Form Content */}
          <form onSubmit={handleSubmit} className="p-4 overflow-y-auto flex-1 space-y-3 custom-scrollbar text-xs">
            {/* Info Box */}
            {codeType === 'EGS' ? (
              <div className="p-2.5 bg-purple-50/80 border border-purple-200 rounded-xl text-[11px] text-purple-900 flex items-start gap-2">
                <AlertCircle size={15} className="text-purple-600 mt-0.5 flex-shrink-0" />
                <div className="leading-relaxed">
                  <span className="font-bold">{isAr ? 'تنبيه منظومة الضرائب: ' : 'Tax Notice: '}</span>
                  {isAr 
                    ? `كود الـ EGS يتكون إجبارياً من بادئة EG ورقم التسجيل الضريبي لشركتكم (${cleanTaxNumber || 'غير مسجل'}) متبوعاً بكود الصنف الداخلي، ويلزم ربطه برمز فئة GPC Brick.`
                    : `EGS code requires format EG-${cleanTaxNumber || 'TAX'}-[ItemCode] and must be linked to a GPC Brick category.`
                  }
                </div>
              </div>
            ) : (
              <div className="p-2.5 bg-indigo-50/80 border border-indigo-200 rounded-xl text-[11px] text-indigo-900 flex items-start gap-2">
                <ShieldCheck size={15} className="text-indigo-600 mt-0.5 flex-shrink-0" />
                <div className="leading-relaxed">
                  <span className="font-bold">{isAr ? 'تسجيل استخدام GS1: ' : 'GS1 Usage Request: '}</span>
                  {isAr 
                    ? 'أكواد GS1 هي أكواد ترقيم دولية (GTIN) مسجلة مسبقاً، ويتم اعتمادها تلقائياً لدى الضرائب فور إرسالها دون انتظار مراجعة.'
                    : 'GS1 codes are pre-registered GTIN barcodes that are approved immediately upon request.'
                  }
                </div>
              </div>
            )}

            {/* Success / Error Alerts */}
            {successMessage && (
              <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
                <CheckCircle size={16} className="text-emerald-600 flex-shrink-0" />
                <span className="font-bold">{successMessage}</span>
              </div>
            )}

            {errorMessage && (
              <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-xs text-rose-800 flex items-start gap-2">
                <AlertCircle size={16} className="text-rose-600 mt-0.5 flex-shrink-0" />
                <div className="leading-relaxed">
                  <span className="font-bold">{isAr ? 'خطأ من مصلحة الضرائب: ' : 'ETA Error: '}</span>
                  <span>{errorMessage}</span>
                </div>
              </div>
            )}

            {/* 1. Item Code Section */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <label className="block text-[11px] font-bold text-slate-700">
                {isAr ? 'كود الصنف بالضرائب *' : 'Tax Item Code *'}
              </label>

              {codeType === 'EGS' ? (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="px-2.5 py-1.5 bg-purple-100 text-purple-900 rounded-lg font-mono font-black text-xs border border-purple-200">
                      EG-{cleanTaxNumber || 'TAX'}-
                    </span>
                    <input
                      type="text"
                      required
                      placeholder={isAr ? 'كود الصنف الداخلي (مثال: PRD001)' : 'Internal item code (e.g. PRD001)'}
                      value={internalSuffix}
                      onChange={(e) => setInternalSuffix(e.target.value.replace(/\s+/g, ''))}
                      className="flex-1 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
                    />
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                    <span>{isAr ? 'الكود النهائي المرسل للضرائب:' : 'Final Code Sent:'}</span>
                    <span className="font-black text-purple-700">{fullEgsCode || '(غير مكتمل)'}</span>
                  </div>
                </div>
              ) : (
                <div>
                  <input
                    type="text"
                    required
                    placeholder={isAr ? 'أدخل كود باركود GS1 الدولي (مثال: 6221234567890)' : 'Enter GS1 Barcode (e.g. 6221234567890)'}
                    value={gs1Code}
                    onChange={(e) => setGs1Code(e.target.value.trim())}
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              )}
            </div>

            {/* 2. Names (Arabic & English) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-700">
                  {isAr ? 'اسم الكود بالعربية *' : 'Code Name (Arabic) *'}
                </label>
                <input
                  type="text"
                  required
                  placeholder={isAr ? 'اسم الصنف باللغة العربية' : 'Item name in Arabic'}
                  value={codeNameAr}
                  onChange={(e) => setCodeNameAr(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-700">
                  {isAr ? 'اسم الكود بالإنجليزية *' : 'Code Name (English) *'}
                </label>
                <input
                  type="text"
                  required
                  placeholder={isAr ? 'اسم الصنف باللغة الإنجليزية' : 'Item name in English'}
                  value={codeNameEn}
                  onChange={(e) => setCodeNameEn(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 outline-none focus:ring-1 focus:ring-purple-500 font-sans"
                />
              </div>
            </div>

            {/* 3. GPC Brick Selection (Mandatory for EGS) */}
            {codeType === 'EGS' && (
              <div className="p-3 bg-amber-50/50 border border-amber-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-amber-900 flex items-center gap-1">
                    <Layers size={13} className="text-amber-600" />
                    <span>{isAr ? 'فئة GPC عنصر مرتبط (إجباري لـ EGS) *' : 'Linked GPC Brick Category *'}</span>
                  </label>
                  {selectedGpc && (
                    <span className="text-[9px] font-mono font-black text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                      {selectedGpc.code}
                    </span>
                  )}
                </div>

                {/* Selected GPC Banner */}
                {selectedGpc ? (
                  <div className="p-2 bg-white rounded-lg border border-amber-300 flex items-center justify-between gap-2">
                    <div className="space-y-0.5">
                      <div className="font-bold text-slate-900 text-xs flex items-center gap-1">
                        <Check size={13} className="text-emerald-600" />
                        <span>{selectedGpc.name_ar}</span>
                        <span className="text-slate-400 font-normal">({selectedGpc.name_en})</span>
                      </div>
                      <div className="text-[10px] text-amber-700">
                        <span>القسم: {selectedGpc.category} | كود الفئة: {selectedGpc.code}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setSelectedGpc(null); setCustomGpcCode(''); }}
                      className="text-slate-400 hover:text-rose-600 p-1"
                      title={isAr ? 'تغيير الفئة' : 'Change Category'}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="space-y-1.5 relative">
                    {/* Search Input */}
                    <div className="relative">
                      <Search className={`absolute ${dir === 'rtl' ? 'right-2.5' : 'left-2.5'} top-2 text-slate-400`} size={13} />
                      <input
                        type="text"
                        placeholder={isAr ? 'ابحث عن فئة الصنف (مثلاً: نقل، ورق، كرتون، بسكويت، كيماويات، حاسب، قطع غيار...)' : 'Search GPC Brick category...'}
                        value={gpcSearchQuery}
                        onChange={handleSearchChange}
                        onFocus={() => setShowGpcDropdown(true)}
                        className={`w-full ${dir === 'rtl' ? 'pr-7 pl-8' : 'pl-7 pr-8'} py-1.5 bg-white border border-slate-300 rounded-lg text-xs outline-none focus:ring-1 focus:ring-amber-500`}
                      />
                      {isSearchingGpc && (
                        <Loader2 className={`absolute ${dir === 'rtl' ? 'left-2.5' : 'right-2.5'} top-2 text-amber-600 animate-spin`} size={13} />
                      )}
                    </div>

                    {/* Autocomplete Dropdown */}
                    {showGpcDropdown && gpcBricks.length > 0 && (
                      <div className="absolute top-full left-0 right-0 z-20 bg-white border border-slate-200 rounded-xl shadow-xl max-h-48 overflow-y-auto mt-1 custom-scrollbar">
                        {gpcBricks.map((brick) => (
                          <div
                            key={brick.code}
                            onClick={() => handleSelectGpc(brick)}
                            className="p-2 hover:bg-purple-50 cursor-pointer border-b border-slate-100 last:border-0 flex items-center justify-between gap-2 text-right transition-colors"
                          >
                            <div>
                              <div className="font-bold text-slate-800 text-xs">
                                {brick.name_ar}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                {brick.name_en} - ({brick.category})
                              </div>
                            </div>
                            <span className="font-mono text-[10px] font-black bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200">
                              {brick.code}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Or Manual 8-digit Code Input */}
                    <div className="flex items-center gap-2 pt-1">
                      <span className="text-[10px] text-slate-400">{isAr ? 'أو أدخل كود GPC رقمي يدوياً:' : 'Or manual GPC code:'}</span>
                      <input
                        type="text"
                        maxLength={10}
                        placeholder="10000027"
                        value={customGpcCode}
                        onChange={(e) => setCustomGpcCode(e.target.value.replace(/\D/g, ''))}
                        className="w-28 px-2 py-1 bg-white border border-slate-300 rounded text-xs font-mono font-bold outline-none focus:ring-1 focus:ring-amber-500"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 4. Descriptions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-600">
                  {isAr ? 'الوصف بالعربية' : 'Description (Arabic)'}
                </label>
                <textarea
                  rows={2}
                  placeholder={isAr ? 'وصف الصنف بالعربية...' : 'Arabic description...'}
                  value={descriptionAr}
                  onChange={(e) => setDescriptionAr(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-600">
                  {isAr ? 'الوصف بالإنجليزية' : 'Description (English)'}
                </label>
                <textarea
                  rows={2}
                  placeholder={isAr ? 'وصف الصنف بالإنجليزية...' : 'English description...'}
                  value={descriptionEn}
                  onChange={(e) => setDescriptionEn(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs outline-none focus:ring-1 focus:ring-purple-500 font-sans"
                />
              </div>
            </div>

            {/* 5. Dates & Reason */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-600">
                  {isAr ? 'نشط من (تاريخ التفعيل) *' : 'Active From *'}
                </label>
                <input
                  type="date"
                  required
                  value={activeFrom}
                  onChange={(e) => setActiveFrom(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-600">
                  {isAr ? 'نشط إلى (تاريخ الانتهاء - اختياري)' : 'Active To (Optional)'}
                </label>
                <input
                  type="date"
                  value={activeTo}
                  onChange={(e) => setActiveTo(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>
            </div>
          </form>

          {/* Footer Actions */}
          <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2 flex-wrap">
            <div className="text-[11px] text-slate-500 font-mono">
              <span>{isAr ? 'كود الصنف: ' : 'Code: '}</span>
              <span className="font-bold text-slate-800">{fullItemCode || '-'}</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-4 py-1.5 bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl font-bold text-xs transition-colors"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>

              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading}
                className="px-5 py-1.5 bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:from-purple-700 hover:to-indigo-700 active:scale-95 text-white rounded-xl font-black text-xs shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 size={14} className="animate-spin text-white" />
                    <span>{isAr ? 'جاري الإرسال للضرائب...' : 'Submitting to ETA...'}</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={14} className="text-amber-300" />
                    <span>
                      {codeType === 'EGS'
                        ? (isAr ? 'طلب الموافقة / إرسال للضرائب 🚀' : 'Submit for Approval 🚀')
                        : (isAr ? 'إرسال وإنشاء كود GS1 🚀' : 'Send & Create GS1 🚀')
                      }
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
