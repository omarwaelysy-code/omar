import React, { useState, useRef, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { 
  X, Upload, Download, CheckCircle2, AlertTriangle, AlertCircle, 
  FileSpreadsheet, Calendar, Search, Filter, Layers, ArrowRight, 
  RefreshCw, Check, Info, ShieldCheck, ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Account, AccountType } from '../types';
import { 
  ACCOUNT_USAGE_OPTIONS, 
  ACCOUNT_USAGE_GROUPS, 
  getAllMacroCategories, 
  getMacroCategoryForUsage, 
  getUsagesForMacro, 
  findUsageOptionByText,
  getAccountUsageLabel
} from '../utils/accountUsageUtils';
import { dbService } from '../services/dbService';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { useLanguage } from '../contexts/LanguageContext';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  existingAccounts: Account[];
  existingTypes: AccountType[];
}

export interface ParsedAccountRow {
  id: string;
  rowIndex: number;
  code: string;
  name: string;
  typeCode: string;
  typeName: string;
  section: string; // Macro Category (e.g. 'الميزانية - أصول')
  usage: string;   // Usage key (e.g. 'bank')
  debit: number;
  credit: number;
  rawDebit: any;
  rawCredit: any;
  errors: string[];
  warnings: string[];
}

export interface ParsedTypeRow {
  id: string;
  code: string;
  name: string;
  statement_type: 'balance_sheet' | 'income_statement';
  classification: string;
  isExisting: boolean;
  errors: string[];
}

export const AccountExcelImportModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onSuccess,
  existingAccounts,
  existingTypes
}) => {
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const { language, dir } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [importDate, setImportDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [fileName, setFileName] = useState<string>('');
  const [accountsRows, setAccountsRows] = useState<ParsedAccountRow[]>([]);
  const [typesRows, setTypesRows] = useState<ParsedTypeRow[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'accounts' | 'types' | 'summary'>('accounts');
  const [filterMode, setFilterMode] = useState<'all' | 'errors' | 'warnings'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const macroCategories = useMemo(() => getAllMacroCategories(), []);

  // Classification translator for types
  const getClassificationLabel = (cls: string) => {
    switch (cls) {
      case 'asset': return 'أصل (Asset)';
      case 'liability': return 'التزام (Liability)';
      case 'equity': return 'حقوق ملكية (Equity)';
      case 'revenue': return 'إيراد (Revenue)';
      case 'cost': return 'تكلفة (Cost)';
      case 'expense': return 'مصروف (Expense)';
      default: return cls;
    }
  };

  // ─────────────────────────────────────────────────────────────
  // 1. Download Master Excel Template (.xlsx)
  // ─────────────────────────────────────────────────────────────
  const handleDownloadTemplate = () => {
    try {
      const wb = XLSX.utils.book_new();

      // Sheet 1: دليل الحسابات
      const accountsHeaders = [
        'كود الحساب *',
        'اسم الحساب *',
        'كود نوع الحساب *',
        'اسم نوع الحساب',
        'القسم',
        'استخدام الحساب *',
        'مدين (أرقام فقط)',
        'دائن (أرقام فقط)'
      ];

      const sampleAccounts = [
        ['1101', 'الخزينة الرئيسية', '11', 'أصول متداولة', 'الميزانية - أصول', 'نقدية', 50000, 0],
        ['1102', 'بنك مصر - جاري', '11', 'أصول متداولة', 'الميزانية - أصول', 'بنك', 150000, 0],
        ['1103', 'حساب العملاء التجاريين', '11', 'أصول متداولة', 'الميزانية - أصول', 'عملاء', 75000, 0],
        ['1104', 'مخزون بضاعة المستودع الرئيسي', '11', 'أصول متداولة', 'الميزانية - أصول', 'مخزون', 125000, 0],
        ['1201', 'أصول ثابتة - آلات ومعدات', '12', 'أصول ثابتة', 'الميزانية - أصول', 'أصل ثابت', 100000, 0],
        ['2101', 'حساب الموردين التجاريين', '21', 'التزامات متداولة', 'الميزانية - التزامات', 'موردين', 0, 100000],
        ['2102', 'قروض قصيرة الأجل', '21', 'التزامات متداولة', 'الميزانية - التزامات', 'قرض', 0, 100000],
        ['3101', 'رأس المال المدفوع', '31', 'حقوق الملكية', 'الميزانية - حقوق ملكية', 'رأس المال', 0, 300000]
      ];

      const wsAccounts = XLSX.utils.aoa_to_sheet([accountsHeaders, ...sampleAccounts]);
      wsAccounts['!cols'] = [
        { wch: 15 }, { wch: 30 }, { wch: 16 }, { wch: 22 }, 
        { wch: 25 }, { wch: 20 }, { wch: 18 }, { wch: 18 }
      ];
      XLSX.utils.book_append_sheet(wb, wsAccounts, 'دليل الحسابات');

      // Sheet 2: أنواع الحسابات
      const typesHeaders = [
        'كود نوع الحساب *',
        'اسم نوع الحساب *',
        'القائمة المالية (الميزانية العمومية / قائمة الدخل)',
        'التصنيف (أصل / التزام / حقوق ملكية / إيراد / تكلفة / مصروف)'
      ];

      const sampleTypes = [
        ['11', 'أصول متداولة', 'الميزانية العمومية', 'أصل'],
        ['12', 'أصول ثابتة', 'الميزانية العمومية', 'أصل'],
        ['21', 'التزامات متداولة', 'الميزانية العمومية', 'التزام'],
        ['22', 'التزامات طويلة الأجل', 'الميزانية العمومية', 'التزام'],
        ['31', 'حقوق الملكية', 'الميزانية العمومية', 'حقوق ملكية'],
        ['41', 'إيرادات المبيعات والنشاط', 'قائمة الدخل', 'إيراد'],
        ['51', 'تكلفة البضاعة والمبيعات', 'قائمة الدخل', 'تكلفة'],
        ['61', 'مصروفات عمومية وإدارية', 'قائمة الدخل', 'مصروف']
      ];

      const wsTypes = XLSX.utils.aoa_to_sheet([typesHeaders, ...sampleTypes]);
      wsTypes['!cols'] = [{ wch: 18 }, { wch: 30 }, { wch: 25 }, { wch: 25 }];
      XLSX.utils.book_append_sheet(wb, wsTypes, 'أنواع الحسابات');

      // Sheet 3: دليل الاستخدامات المتاحة
      const usageHeaders = ['القسم الرئيسي (المجموعة)', 'استخدام الحساب المعتمد', 'المفتاح البرمجي'];
      const usageRows: any[][] = [];
      ACCOUNT_USAGE_GROUPS.forEach(group => {
        group.keys.forEach(key => {
          const opt = ACCOUNT_USAGE_OPTIONS.find(o => o.key === key);
          if (opt) {
            usageRows.push([group.macroAr, opt.ar, opt.key]);
          }
        });
      });

      const wsUsageGuide = XLSX.utils.aoa_to_sheet([usageHeaders, ...usageRows]);
      wsUsageGuide['!cols'] = [{ wch: 32 }, { wch: 28 }, { wch: 24 }];
      XLSX.utils.book_append_sheet(wb, wsUsageGuide, 'دليل الاستخدامات المتاحة');

      XLSX.writeFile(wb, 'قالب_استيراد_دليل_الحسابات_المعتمد.xlsx');
      showNotification('تم تنزيل قالب الإكسيل المعتمد بنجاح', 'success');
    } catch (err: any) {
      console.error('Error generating template:', err);
      showNotification('حدث خطأ أثناء تنزيل القالب', 'error');
    }
  };

  // ─────────────────────────────────────────────────────────────
  // 2. Read & Parse Uploaded Excel File
  // ─────────────────────────────────────────────────────────────
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setIsParsing(true);
    setAccountsRows([]);
    setTypesRows([]);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });

        // A) Find Account Types sheet if exists
        const typesSheetName = wb.SheetNames.find(n => 
          n.includes('نوع') || n.includes('أنواع') || n.toLowerCase().includes('type')
        );

        let parsedTypes: ParsedTypeRow[] = [];
        const newTypesMap = new Map<string, ParsedTypeRow>();

        if (typesSheetName && wb.Sheets[typesSheetName]) {
          const typesSheet = wb.Sheets[typesSheetName];
          const rawTypes = XLSX.utils.sheet_to_json<any[]>(typesSheet, { header: 1 });
          if (rawTypes.length > 1) {
            for (let i = 1; i < rawTypes.length; i++) {
              const row = rawTypes[i];
              if (!row || row.length === 0) continue;
              const code = String(row[0] || '').trim();
              const name = String(row[1] || '').trim();
              const stmtRaw = String(row[2] || '').trim();
              const classRaw = String(row[3] || '').trim();

              if (!code && !name) continue;

              const errors: string[] = [];
              if (!code) errors.push('كود نوع الحساب مطلوب');
              if (!name) errors.push('اسم نوع الحساب مطلوب');

              // Determine statement_type
              let statement_type: 'balance_sheet' | 'income_statement' = 'balance_sheet';
              if (stmtRaw.includes('دخل') || stmtRaw.toLowerCase().includes('income')) {
                statement_type = 'income_statement';
              }

              // Determine classification
              let classification = 'asset';
              const clLower = classRaw.toLowerCase();
              if (classRaw.includes('أصل') || clLower.includes('asset')) classification = 'asset';
              else if (classRaw.includes('التزام') || clLower.includes('liability')) classification = 'liability';
              else if (classRaw.includes('ملكية') || clLower.includes('equity')) classification = 'equity';
              else if (classRaw.includes('إيراد') || classRaw.includes('ايراد') || clLower.includes('revenue')) classification = 'revenue';
              else if (classRaw.includes('تكلفة') || clLower.includes('cost')) classification = 'cost';
              else if (classRaw.includes('مصروف') || clLower.includes('expense')) classification = 'expense';

              const isExisting = existingTypes.some(t => t.code === code || t.name === name);

              const parsedType: ParsedTypeRow = {
                id: `type-${i}`,
                code,
                name,
                statement_type,
                classification,
                isExisting,
                errors
              };

              parsedTypes.push(parsedType);
              if (code) newTypesMap.set(code, parsedType);
              if (name) newTypesMap.set(name, parsedType);
            }
          }
        }

        // B) Find Accounts sheet
        const accountsSheetName = wb.SheetNames.find(n => 
          n.includes('دليل') || n.includes('حسابات') || n.toLowerCase().includes('account')
        ) || wb.SheetNames[0];

        const accountsSheet = wb.Sheets[accountsSheetName];
        const rawAccounts = XLSX.utils.sheet_to_json<any[]>(accountsSheet, { header: 1 });

        if (rawAccounts.length <= 1) {
          showNotification('شيت الحسابات فارغ أو لا يحتوي على صفوف بيانات', 'error');
          setIsParsing(false);
          return;
        }

        const headers = rawAccounts[0] as string[];
        const findColIdx = (patterns: string[]) => {
          return headers.findIndex(h => {
            if (!h) return false;
            const str = String(h).trim().toLowerCase();
            return patterns.some(p => str.includes(p.toLowerCase()));
          });
        };

        const codeIdx = findColIdx(['كود الحساب', 'account code', 'code']);
        const nameIdx = findColIdx(['اسم الحساب', 'account name', 'name']);
        const typeCodeIdx = findColIdx(['كود نوع', 'type code']);
        const typeNameIdx = findColIdx(['نوع الحساب', 'اسم نوع', 'type name', 'type']);
        const sectionIdx = findColIdx(['القسم', 'المجموعة', 'section', 'category']);
        const usageIdx = findColIdx(['استخدام', 'usage']);
        const debitIdx = findColIdx(['مدين', 'debit']);
        const creditIdx = findColIdx(['دائن', 'credit']);

        const parsedAccounts: ParsedAccountRow[] = [];
        const seenCodes = new Set<string>();

        for (let i = 1; i < rawAccounts.length; i++) {
          const row = rawAccounts[i];
          if (!row || row.length === 0) continue;

          const rawCode = codeIdx >= 0 ? row[codeIdx] : row[0];
          const rawName = nameIdx >= 0 ? row[nameIdx] : row[1];
          const rawTypeCode = typeCodeIdx >= 0 ? row[typeCodeIdx] : '';
          const rawTypeName = typeNameIdx >= 0 ? row[typeNameIdx] : (typeCodeIdx < 0 ? row[2] : '');
          const rawSection = sectionIdx >= 0 ? row[sectionIdx] : '';
          const rawUsage = usageIdx >= 0 ? row[usageIdx] : '';
          const rawDebit = debitIdx >= 0 ? row[debitIdx] : 0;
          const rawCredit = creditIdx >= 0 ? row[creditIdx] : 0;

          const code = String(rawCode !== undefined && rawCode !== null ? rawCode : '').trim();
          const name = String(rawName !== undefined && rawName !== null ? rawName : '').trim();
          const typeCode = String(rawTypeCode !== undefined && rawTypeCode !== null ? rawTypeCode : '').trim();
          const typeName = String(rawTypeName !== undefined && rawTypeName !== null ? rawTypeName : '').trim();
          const sectionInput = String(rawSection !== undefined && rawSection !== null ? rawSection : '').trim();
          const usageInput = String(rawUsage !== undefined && rawUsage !== null ? rawUsage : '').trim();

          // Skip completely empty lines
          if (!code && !name && !typeCode && !typeName) continue;

          const errors: string[] = [];
          const warnings: string[] = [];

          // Code check
          if (!code) {
            errors.push('كود الحساب مطلوب');
          } else if (seenCodes.has(code)) {
            errors.push(`كود الحساب (${code}) مكرر في الملف`);
          } else {
            seenCodes.add(code);
            const existsInDb = existingAccounts.some(a => a.code === code);
            if (existsInDb) {
              warnings.push(`كود الحساب (${code}) موجود مسبقاً في النظام`);
            }
          }

          // Name check
          if (!name) {
            errors.push('اسم الحساب مطلوب');
          }

          // Type check
          let resolvedType = existingTypes.find(t => 
            (typeCode && t.code === typeCode) || 
            (typeName && t.name.trim().toLowerCase() === typeName.toLowerCase())
          );

          if (!resolvedType) {
            // Check if defined in the new types sheet
            const definedInSheet = newTypesMap.get(typeCode) || newTypesMap.get(typeName);
            if (!definedInSheet && (typeCode || typeName)) {
              // Automatically register as a candidate new type if not existing
              const newTypeCandidate: ParsedTypeRow = {
                id: `type-auto-${parsedTypes.length + 1}`,
                code: typeCode || `T-${code.slice(0, 2) || '01'}`,
                name: typeName || `نوع الحساب ${code.slice(0, 2)}`,
                statement_type: 'balance_sheet',
                classification: 'asset',
                isExisting: false,
                errors: []
              };
              parsedTypes.push(newTypeCandidate);
              newTypesMap.set(newTypeCandidate.code, newTypeCandidate);
              newTypesMap.set(newTypeCandidate.name, newTypeCandidate);
            } else if (!typeCode && !typeName) {
              errors.push('نوع الحساب مطلوب');
            }
          }

          // Usage check
          let resolvedUsage = findUsageOptionByText(usageInput);
          let resolvedSection = sectionInput;

          if (resolvedUsage) {
            if (!resolvedSection) {
              resolvedSection = getMacroCategoryForUsage(resolvedUsage.key);
            }
          } else if (usageInput) {
            errors.push(`استخدام الحساب "${usageInput}" غير صالح أو غير معتمد`);
          } else {
            errors.push('يجب تحديد استخدام الحساب (لا يمكن أن يكون عام أو فارغ)');
          }

          // Numeric Debit & Credit validation
          let debitNum = 0;
          let creditNum = 0;

          if (rawDebit !== undefined && rawDebit !== null && String(rawDebit).trim() !== '') {
            const parsed = Number(rawDebit);
            if (isNaN(parsed) || typeof parsed !== 'number') {
              errors.push(`المدين لا يقبل إلا أرقام (القيمة المدخلة: "${rawDebit}")`);
            } else if (parsed < 0) {
              errors.push(`المدين يجب أن يكون قيمة موجبة أو صفر`);
            } else {
              debitNum = parsed;
            }
          }

          if (rawCredit !== undefined && rawCredit !== null && String(rawCredit).trim() !== '') {
            const parsed = Number(rawCredit);
            if (isNaN(parsed) || typeof parsed !== 'number') {
              errors.push(`الدائن لا يقبل إلا أرقام (القيمة المدخلة: "${rawCredit}")`);
            } else if (parsed < 0) {
              errors.push(`الدائن يجب أن يكون قيمة موجبة أو صفر`);
            } else {
              creditNum = parsed;
            }
          }

          parsedAccounts.push({
            id: `acc-${i}`,
            rowIndex: i + 1,
            code,
            name,
            typeCode: typeCode || resolvedType?.code || '',
            typeName: typeName || resolvedType?.name || '',
            section: resolvedSection,
            usage: resolvedUsage ? resolvedUsage.key : '',
            debit: debitNum,
            credit: creditNum,
            rawDebit,
            rawCredit,
            errors,
            warnings
          });
        }

        setAccountsRows(parsedAccounts);
        setTypesRows(parsedTypes);
        setIsParsing(false);

        const totalErrorsCount = parsedAccounts.reduce((acc, r) => acc + r.errors.length, 0);
        if (totalErrorsCount > 0) {
          showNotification(`تم تحليل الملف، ولكن يوجد ${totalErrorsCount} أخطاء تحتاج للمراجعة`, 'warning');
        } else {
          showNotification('تم تحليل ملف الإكسيل بنجاح وبدون أخطاء', 'success');
        }
      } catch (err: any) {
        console.error('Error parsing excel:', err);
        showNotification('حدث خطأ أثناء قراءة ملف الإكسيل: ' + (err.message || ''), 'error');
        setIsParsing(false);
      }
    };

    reader.readAsBinaryString(file);
  };

  // ─────────────────────────────────────────────────────────────
  // 3. Grid Update Handlers (Inline Edit Section & Usage)
  // ─────────────────────────────────────────────────────────────
  const handleSectionChange = (rowId: string, newSection: string) => {
    setAccountsRows(prev => prev.map(row => {
      if (row.id !== rowId) return row;
      const validUsages = getUsagesForMacro(newSection);
      let newUsage = row.usage;
      const stillValid = validUsages.some(u => u.key === row.usage);
      if (!stillValid) {
        newUsage = validUsages[0]?.key || '';
      }

      const errors = row.errors.filter(e => !e.includes('استخدام الحساب'));
      if (!newUsage) {
        errors.push('يجب تحديد استخدام الحساب');
      }

      return {
        ...row,
        section: newSection,
        usage: newUsage,
        errors
      };
    }));
  };

  const handleUsageChange = (rowId: string, newUsage: string) => {
    setAccountsRows(prev => prev.map(row => {
      if (row.id !== rowId) return row;
      const errors = row.errors.filter(e => !e.includes('استخدام الحساب'));
      if (!newUsage) {
        errors.push('يجب تحديد استخدام الحساب');
      }
      return {
        ...row,
        usage: newUsage,
        errors
      };
    }));
  };

  const handleDebitChange = (rowId: string, val: string) => {
    setAccountsRows(prev => prev.map(row => {
      if (row.id !== rowId) return row;
      const num = Number(val);
      const errors = row.errors.filter(e => !e.includes('المدين'));
      let debitNum = 0;
      if (val.trim() !== '') {
        if (isNaN(num)) {
          errors.push('المدين لا يقبل إلا أرقام');
        } else if (num < 0) {
          errors.push('المدين يجب أن يكون قيمة موجبة أو صفر');
        } else {
          debitNum = num;
        }
      }
      return { ...row, debit: debitNum, rawDebit: val, errors };
    }));
  };

  const handleCreditChange = (rowId: string, val: string) => {
    setAccountsRows(prev => prev.map(row => {
      if (row.id !== rowId) return row;
      const num = Number(val);
      const errors = row.errors.filter(e => !e.includes('الدائن'));
      let creditNum = 0;
      if (val.trim() !== '') {
        if (isNaN(num)) {
          errors.push('الدائن لا يقبل إلا أرقام');
        } else if (num < 0) {
          errors.push('الدائن يجب أن يكون قيمة موجبة أو صفر');
        } else {
          creditNum = num;
        }
      }
      return { ...row, credit: creditNum, rawCredit: val, errors };
    }));
  };

  // ─────────────────────────────────────────────────────────────
  // 4. Totals & Balance Calculations
  // ─────────────────────────────────────────────────────────────
  const totalDebit = useMemo(() => {
    return accountsRows.reduce((sum, r) => sum + (Number(r.debit) || 0), 0);
  }, [accountsRows]);

  const totalCredit = useMemo(() => {
    return accountsRows.reduce((sum, r) => sum + (Number(r.credit) || 0), 0);
  }, [accountsRows]);

  const balanceDiff = useMemo(() => {
    return Math.abs(totalDebit - totalCredit);
  }, [totalDebit, totalCredit]);

  const isBalanced = useMemo(() => {
    return balanceDiff < 0.001;
  }, [balanceDiff]);

  const totalErrors = useMemo(() => {
    const accErrors = accountsRows.reduce((sum, r) => sum + r.errors.length, 0);
    const typeErrors = typesRows.reduce((sum, r) => sum + r.errors.length, 0);
    return accErrors + typeErrors + (!isBalanced ? 1 : 0);
  }, [accountsRows, typesRows, isBalanced]);

  const newTypesToCreate = useMemo(() => {
    return typesRows.filter(t => !t.isExisting);
  }, [typesRows]);

  // Filtered rows for table view
  const filteredAccounts = useMemo(() => {
    return accountsRows.filter(row => {
      if (filterMode === 'errors' && row.errors.length === 0) return false;
      if (filterMode === 'warnings' && row.warnings.length === 0) return false;
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        return (
          row.code.toLowerCase().includes(query) ||
          row.name.toLowerCase().includes(query) ||
          row.typeName.toLowerCase().includes(query) ||
          row.section.toLowerCase().includes(query) ||
          getAccountUsageLabel(row.usage, 'ar').toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [accountsRows, filterMode, searchTerm]);

  // ─────────────────────────────────────────────────────────────
  // 5. Final Save / Import Execution
  // ─────────────────────────────────────────────────────────────
  const handleConfirmImport = async () => {
    if (!user) return;
    if (accountsRows.length === 0) {
      showNotification('لا توجد حسابات لاستيرادها', 'error');
      return;
    }
    if (totalErrors > 0) {
      showNotification('يرجى تصحيح كافة الأخطاء والتحقق من توازن المدين والدائن قبل الحفظ', 'error');
      return;
    }

    setIsSaving(true);
    try {
      // 1. Create new Account Types first
      const typeCodeToIdMap = new Map<string, string>();
      const typeNameToIdMap = new Map<string, string>();

      // Populate existing types
      existingTypes.forEach(t => {
        typeCodeToIdMap.set(t.code, t.id);
        typeNameToIdMap.set(t.name.trim().toLowerCase(), t.id);
      });

      for (const newType of newTypesToCreate) {
        const typeData = {
          code: newType.code,
          name: newType.name,
          statement_type: newType.statement_type,
          classification: newType.classification,
          is_active: true,
          company_id: user.company_id
        };

        const newTypeId = await dbService.add('account_types', typeData);
        typeCodeToIdMap.set(newType.code, newTypeId);
        typeNameToIdMap.set(newType.name.trim().toLowerCase(), newTypeId);

        await dbService.logActivity(
          user.id,
          user.username,
          user.company_id,
          'استيراد نوع حساب من إكسيل',
          `تم إنشاء نوع الحساب: ${newType.name} (كود: ${newType.code})`,
          'account_types',
          newTypeId
        );
      }

      // 2. Insert Accounts
      const insertedAccounts: { id: string; name: string; debit: number; credit: number }[] = [];

      for (const acc of accountsRows) {
        // Resolve type ID
        let typeId = typeCodeToIdMap.get(acc.typeCode) || 
                     typeNameToIdMap.get(acc.typeName.trim().toLowerCase()) || 
                     existingTypes[0]?.id;

        const openingBal = (acc.debit || 0) - (acc.credit || 0);

        const accData = {
          code: acc.code,
          name: acc.name,
          type_id: typeId,
          type_name: acc.typeName,
          is_active: true,
          company_id: user.company_id,
          opening_balance: openingBal,
          opening_balance_date: importDate,
          account_usage: acc.usage || null
        };

        const newAccId = await dbService.add('accounts', accData);
        insertedAccounts.push({
          id: newAccId,
          name: acc.name,
          debit: acc.debit || 0,
          credit: acc.credit || 0
        });

        await dbService.logActivity(
          user.id,
          user.username,
          user.company_id,
          'استيراد حساب من إكسيل',
          `تم استيراد الحساب: ${acc.name} (كود: ${acc.code}) - استخدام: ${getAccountUsageLabel(acc.usage, 'ar')}`,
          'accounts',
          newAccId
        );
      }

      // 3. If there is a balanced opening balance entry (> 0), create opening journal entry
      if (totalDebit > 0 && totalCredit > 0 && isBalanced) {
        const journalItems = insertedAccounts
          .filter(a => a.debit > 0 || a.credit > 0)
          .map(a => ({
            account_id: a.id,
            account_name: a.name,
            debit: a.debit,
            credit: a.credit,
            description: `رصيد افتتاحي - استيراد دليل الحسابات`
          }));

        if (journalItems.length > 0) {
          const entryId = await dbService.add('journal_entries', {
            company_id: user.company_id,
            date: importDate,
            description: `قيد افتتاحي - استيراد دليل الحسابات من إكسيل (${accountsRows.length} حساب)`,
            reference_type: 'opening_balance',
            items: journalItems,
            total_debit: totalDebit,
            total_credit: totalCredit,
            created_at: new Date().toISOString(),
            created_by: user.id
          });

          await dbService.logActivity(
            user.id,
            user.username,
            user.company_id,
            'إنشاء قيد افتتاحي',
            `تم تسجيل القيد الافتتاحي المتزن بقيمة ${totalDebit.toLocaleString()} بتاريخ ${importDate}`,
            'journal_entries',
            entryId
          );
        }
      }

      showNotification(`تم استيراد ${accountsRows.length} حساب و ${newTypesToCreate.length} نوع حساب بنجاح!`, 'success');
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error importing accounts:', err);
      showNotification('حدث خطأ أثناء حفظ البيانات: ' + (err.message || ''), 'error');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-2 md:p-6 overflow-y-auto">
      <motion.div 
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="bg-white w-full max-w-[96vw] xl:max-w-7xl h-[94vh] rounded-[2rem] shadow-2xl flex flex-col overflow-hidden border border-slate-200"
        dir={dir}
      >
        {/* ── Top Header ────────────────────────────────────────── */}
        <div className="p-3.5 md:px-6 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-sm">
              <FileSpreadsheet size={22} />
            </div>
            <div>
              <h2 className="text-base md:text-lg font-black text-slate-900">
                استيراد دليل الحسابات والأنواع من إكسيل
              </h2>
              <p className="text-[11px] font-bold text-slate-500">
                مراجعة الحسابات والأنواع، ضبط الاستخدامات، وتدقيق توازن الأرصدة الافتتاحية قبل الحفظ
              </p>
            </div>
          </div>

          {/* Date Picker & Actions */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-xs">
              <Calendar size={15} className="text-emerald-600" />
              <span className="text-xs font-bold text-slate-600 whitespace-nowrap">تاريخ القيد الافتتاحي:</span>
              <input 
                type="date"
                value={importDate}
                onChange={(e) => setImportDate(e.target.value)}
                className="text-xs font-bold text-slate-800 bg-transparent outline-none cursor-pointer"
              />
            </div>

            <button
              onClick={handleDownloadTemplate}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold transition-all shadow-xs active:scale-95"
            >
              <Download size={14} className="text-emerald-600" />
              <span>تحميل القالب المعتمد</span>
            </button>

            <button 
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-xl transition-all"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ── Upload Area / Toolbar ──────────────────────────────── */}
        <div className="p-3 md:px-6 bg-white border-b border-slate-100 flex items-center justify-between gap-4 flex-wrap shrink-0">
          <div className="flex items-center gap-3">
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              accept=".xlsx, .xls" 
              className="hidden" 
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isParsing || isSaving}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm shadow-emerald-600/20 transition-all active:scale-95 disabled:opacity-50"
            >
              <Upload size={15} />
              <span>{fileName ? 'تغيير ملف الإكسيل' : 'اختيار ملف إكسيل للرفع'}</span>
            </button>

            {fileName && (
              <span className="text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1 rounded-lg border border-slate-200">
                الملف: <strong className="text-slate-900">{fileName}</strong> ({accountsRows.length} حساب)
              </span>
            )}

            {isParsing && (
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700">
                <RefreshCw size={14} className="animate-spin" />
                <span>جاري قراءة وتحليل الإكسيل...</span>
              </div>
            )}
          </div>

          {/* Navigation Tabs (Accounts / Types / Summary) */}
          {accountsRows.length > 0 && (
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
              <button
                onClick={() => setActiveTab('accounts')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'accounts' 
                    ? 'bg-white text-slate-900 shadow-xs' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                دليل الحسابات ({accountsRows.length})
              </button>
              <button
                onClick={() => setActiveTab('types')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'types' 
                    ? 'bg-white text-slate-900 shadow-xs' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                أنواع الحسابات ({typesRows.length})
                {newTypesToCreate.length > 0 && (
                  <span className="mr-1 px-1.5 py-0.2 bg-emerald-100 text-emerald-800 text-[10px] rounded-full">
                    +{newTypesToCreate.length} جديد
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('summary')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'summary' 
                    ? 'bg-white text-slate-900 shadow-xs' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ملخص التأكيد والتدقيق
              </button>
            </div>
          )}
        </div>

        {/* ── Balance & Status Metrics Banner ─────────────────────── */}
        {accountsRows.length > 0 && (
          <div className="px-4 md:px-6 py-2.5 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between gap-4 flex-wrap text-xs font-bold shrink-0">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-1.5 text-slate-700">
                <span className="text-slate-400">إجمالي الحسابات:</span>
                <span className="px-2 py-0.5 bg-white rounded-md border border-slate-200">{accountsRows.length}</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-700">
                <span className="text-slate-400">أنواع جديدة ستضاف:</span>
                <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-md border border-emerald-200">
                  {newTypesToCreate.length}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-700">
                <span className="text-slate-400">إجمالي المدين:</span>
                <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md border border-blue-200 font-mono">
                  {totalDebit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-700">
                <span className="text-slate-400">إجمالي الدائن:</span>
                <span className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded-md border border-purple-200 font-mono">
                  {totalCredit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Balance Status Badge */}
            <div className="flex items-center gap-2">
              {isBalanced ? (
                <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-200">
                  <CheckCircle2 size={15} />
                  <span>المدين والدائن متزنان بنجاح (الفرق: 0.00)</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 px-3 py-1 bg-rose-50 text-rose-700 rounded-xl border border-rose-200 animate-pulse">
                  <AlertCircle size={15} />
                  <span>
                    المدين لا يساوي الدائن! الفرق: {balanceDiff.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              )}

              {totalErrors > 0 && (
                <div className="flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-700 rounded-xl border border-amber-200">
                  <AlertTriangle size={14} />
                  <span>{totalErrors} أخطاء تحتاج للتصحيح</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Main Content Area ───────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 md:p-6 bg-slate-100/40">
          {accountsRows.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-slate-200 rounded-3xl bg-white">
              <div className="w-16 h-16 rounded-3xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4">
                <FileSpreadsheet size={32} />
              </div>
              <h3 className="text-lg font-black text-slate-800 mb-2">
                اختر ملف إكسيل للبدء في استيراد دليل الحسابات
              </h3>
              <p className="text-xs text-slate-500 max-w-md mb-6 leading-relaxed">
                يمكنك تحميل القالب المعتمد المنسق، وملء الحسابات وأنواعها وأرصدتها الافتتاحية، ثم رفعه هنا ليقوم النظام بمراجعته وتدقيقه تلقائياً.
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 shadow-md shadow-emerald-600/20 transition-all flex items-center gap-2"
                >
                  <Upload size={16} />
                  <span>رفع ملف إكسيل</span>
                </button>
                <button
                  onClick={handleDownloadTemplate}
                  className="px-6 py-2.5 bg-white text-slate-700 border border-slate-200 rounded-xl text-xs font-bold hover:bg-slate-50 shadow-xs transition-all flex items-center gap-2"
                >
                  <Download size={16} className="text-emerald-600" />
                  <span>تحميل القالب المعتمد (.xlsx)</span>
                </button>
              </div>
            </div>
          ) : activeTab === 'accounts' ? (
            <div className="space-y-3">
              {/* Filter & Search Bar */}
              <div className="flex items-center justify-between gap-3 bg-white p-2.5 rounded-2xl border border-slate-200 flex-wrap">
                <div className="flex items-center gap-2 flex-1 min-w-[200px] relative">
                  <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="بحث في الحسابات المستوردة (بالكود، الاسم، النوع، الاستخدام)..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pr-9 pl-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-bold text-slate-500">تصفية الصفوف:</span>
                  <button
                    onClick={() => setFilterMode('all')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                      filterMode === 'all' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    الكل ({accountsRows.length})
                  </button>
                  <button
                    onClick={() => setFilterMode('errors')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                      filterMode === 'errors' ? 'bg-rose-600 text-white' : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                    }`}
                  >
                    أخطاء ({accountsRows.filter(r => r.errors.length > 0).length})
                  </button>
                  <button
                    onClick={() => setFilterMode('warnings')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                      filterMode === 'warnings' ? 'bg-amber-600 text-white' : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                    }`}
                  >
                    تحذيرات ({accountsRows.filter(r => r.warnings.length > 0).length})
                  </button>
                </div>
              </div>

              {/* Accounts Table */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-600 font-black">
                        <th className="px-3 py-2.5 text-center w-12">#</th>
                        <th className="px-3 py-2.5 w-16 text-center">الحالة</th>
                        <th className="px-3 py-2.5 w-28">كود الحساب</th>
                        <th className="px-3 py-2.5 min-w-[160px]">اسم الحساب</th>
                        <th className="px-3 py-2.5 min-w-[140px]">نوع الحساب</th>
                        <th className="px-3 py-2.5 min-w-[170px]">القسم (المجموعة)</th>
                        <th className="px-3 py-2.5 min-w-[170px]">استخدام الحساب (إلزامي)</th>
                        <th className="px-3 py-2.5 w-28 text-center">مدين</th>
                        <th className="px-3 py-2.5 w-28 text-center">دائن</th>
                        <th className="px-3 py-2.5 min-w-[200px]">الملاحظات والأخطاء</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-bold">
                      {filteredAccounts.map((row) => {
                        const hasErrors = row.errors.length > 0;
                        const hasWarnings = row.warnings.length > 0;
                        const availableUsages = row.section ? getUsagesForMacro(row.section) : ACCOUNT_USAGE_OPTIONS;

                        return (
                          <tr 
                            key={row.id} 
                            className={`transition-colors ${
                              hasErrors ? 'bg-rose-50/40 hover:bg-rose-50/70' : 'hover:bg-slate-50/80'
                            }`}
                          >
                            <td className="px-3 py-2 text-center text-slate-400 font-mono">
                              {row.rowIndex}
                            </td>

                            <td className="px-3 py-2 text-center">
                              {hasErrors ? (
                                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-rose-100 text-rose-700" title={row.errors.join(' | ')}>
                                  <X size={14} />
                                </span>
                              ) : hasWarnings ? (
                                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 text-amber-700" title={row.warnings.join(' | ')}>
                                  <AlertTriangle size={13} />
                                </span>
                              ) : (
                                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-700">
                                  <Check size={14} />
                                </span>
                              )}
                            </td>

                            <td className="px-3 py-2 font-mono text-emerald-700">
                              {row.code}
                            </td>

                            <td className="px-3 py-2 text-slate-900">
                              {row.name}
                            </td>

                            <td className="px-3 py-2">
                              <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px]">
                                {row.typeName || row.typeCode || 'غير محدد'}
                              </span>
                            </td>

                            {/* Section Dropdown */}
                            <td className="px-3 py-2">
                              <select
                                value={row.section}
                                onChange={(e) => handleSectionChange(row.id, e.target.value)}
                                className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 outline-none focus:ring-1 focus:ring-emerald-500"
                              >
                                <option value="">-- اختر القسم --</option>
                                {macroCategories.map(m => (
                                  <option key={m.macroAr} value={m.macroAr}>{m.macroAr}</option>
                                ))}
                              </select>
                            </td>

                            {/* Usage Dropdown (Filtered by Section) */}
                            <td className="px-3 py-2">
                              <select
                                value={row.usage}
                                onChange={(e) => handleUsageChange(row.id, e.target.value)}
                                className={`w-full px-2 py-1 bg-white border rounded-lg text-xs font-bold outline-none focus:ring-1 ${
                                  !row.usage 
                                    ? 'border-rose-300 text-rose-700 bg-rose-50/30' 
                                    : 'border-slate-200 text-slate-800 focus:ring-emerald-500'
                                }`}
                              >
                                <option value="">-- اختر الاستخدام --</option>
                                {availableUsages.map(u => (
                                  <option key={u.key} value={u.key}>{u.ar}</option>
                                ))}
                              </select>
                            </td>

                            {/* Debit Input */}
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                step="any"
                                min="0"
                                value={row.debit || ''}
                                onChange={(e) => handleDebitChange(row.id, e.target.value)}
                                className="w-full px-2 py-1 text-center font-mono text-xs font-bold bg-white border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-blue-500"
                                placeholder="0"
                              />
                            </td>

                            {/* Credit Input */}
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                step="any"
                                min="0"
                                value={row.credit || ''}
                                onChange={(e) => handleCreditChange(row.id, e.target.value)}
                                className="w-full px-2 py-1 text-center font-mono text-xs font-bold bg-white border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-purple-500"
                                placeholder="0"
                              />
                            </td>

                            {/* Errors / Warnings */}
                            <td className="px-3 py-2">
                              {hasErrors ? (
                                <div className="space-y-1">
                                  {row.errors.map((err, idx) => (
                                    <div key={idx} className="text-[11px] text-rose-600 font-bold flex items-center gap-1">
                                      <span className="w-1.5 h-1.5 rounded-full bg-rose-600 shrink-0" />
                                      <span>{err}</span>
                                    </div>
                                  ))}
                                </div>
                              ) : hasWarnings ? (
                                <div className="space-y-1">
                                  {row.warnings.map((warn, idx) => (
                                    <div key={idx} className="text-[11px] text-amber-600 font-bold flex items-center gap-1">
                                      <span className="w-1.5 h-1.5 rounded-full bg-amber-600 shrink-0" />
                                      <span>{warn}</span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-[11px] text-emerald-600 font-bold">جاهز للاستيراد</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : activeTab === 'types' ? (
            /* Types Review Table */
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-slate-800">
                    مراجعة أنواع الحسابات المكتشفة في الملف ({typesRows.length})
                  </h3>
                  <p className="text-xs text-slate-500">
                    الأنواع غير الموجودة بالنظام سيتم إنشاؤها تلقائياً مع كودها وقائمتها وتصنيفها
                  </p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-black">
                      <th className="px-4 py-3">كود النوع</th>
                      <th className="px-4 py-3">اسم نوع الحساب</th>
                      <th className="px-4 py-3">القائمة المالية</th>
                      <th className="px-4 py-3">التصنيف</th>
                      <th className="px-4 py-3 text-center">حالة النوع في النظام</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-bold">
                    {typesRows.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-mono text-emerald-700">{t.code}</td>
                        <td className="px-4 py-3 text-slate-900">{t.name}</td>
                        <td className="px-4 py-3 text-slate-600">
                          {t.statement_type === 'balance_sheet' ? 'الميزانية العمومية' : 'قائمة الدخل'}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {getClassificationLabel(t.classification)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {t.isExisting ? (
                            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[11px]">
                              موجود مسبقاً
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px]">
                              نوع جديد (سيتم إنشاؤه)
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {typesRows.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-400 font-bold">
                          لم يتم العثور على أنواع حسابات إضافية في الملف. سيتم ربط الحسابات بالأنواع الحالية.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* Summary & Confirmation Tab */
            <div className="space-y-4">
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-6">
                <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <ShieldCheck size={22} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900">
                      ملخص التأكيد النهائي قبل الاستيراد
                    </h3>
                    <p className="text-xs text-slate-500">
                      يرجى مراجعة ملخص الحركات والحسابات التي سيتم إدراجها في قاعدة البيانات
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                    <span className="text-xs font-bold text-slate-500">إجمالي الحسابات الجديدة:</span>
                    <h4 className="text-2xl font-black text-slate-900 mt-1">{accountsRows.length}</h4>
                    <p className="text-[11px] text-slate-400 mt-1">سيتم إضافتها إلى شجرة ودليل الحسابات</p>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                    <span className="text-xs font-bold text-slate-500">أنواع حسابات جديدة:</span>
                    <h4 className="text-2xl font-black text-emerald-700 mt-1">{newTypesToCreate.length}</h4>
                    <p className="text-[11px] text-slate-400 mt-1">سيتم إنشاؤها في جدول أنواع الحسابات</p>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                    <span className="text-xs font-bold text-slate-500">القيد الافتتاحي:</span>
                    <h4 className="text-lg font-black text-blue-700 mt-1 font-mono">
                      {totalDebit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-1">
                      {isBalanced ? 'قيد متزن بتاريخ ' + importDate : 'غير متزن!'}
                    </p>
                  </div>
                </div>

                {/* New types list preview */}
                {newTypesToCreate.length > 0 && (
                  <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100">
                    <h4 className="text-xs font-black text-emerald-900 mb-2">
                      أنواع الحسابات الجديدة التي سيتم إنشاؤها ({newTypesToCreate.length}):
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {newTypesToCreate.map(t => (
                        <span key={t.code} className="px-2.5 py-1 bg-white text-emerald-800 rounded-lg border border-emerald-200 text-xs font-bold">
                          {t.name} (كود: {t.code}) - {getClassificationLabel(t.classification)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Validation summary */}
                {totalErrors > 0 ? (
                  <div className="p-4 bg-rose-50 rounded-2xl border border-rose-200 text-rose-800 text-xs font-bold flex items-start gap-2.5">
                    <AlertCircle size={18} className="shrink-0 text-rose-600 mt-0.5" />
                    <div>
                      <p className="font-black text-rose-900">لا يمكن الحفظ لوجود أخطاء أو عدم توازن في المدين والدائن:</p>
                      <ul className="list-disc list-inside mt-1.5 space-y-1">
                        {!isBalanced && (
                          <li>المدين لا يساوي الدائن (الفرق: {balanceDiff.toLocaleString()}). يجب أن يتساوى إجمالي المدين مع إجمالي الدائن.</li>
                        )}
                        {accountsRows.filter(r => r.errors.length > 0).slice(0, 5).map(r => (
                          <li key={r.id}>الصف {r.rowIndex} ({r.name || r.code}): {r.errors.join('، ')}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
                    <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
                    <span>تم التحقق من كافة البيانات بنجاح، الملف جاهز للاستيراد المباشر.</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ────────────────────────────────────────────── */}
        <div className="p-3.5 md:px-6 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0 flex-wrap gap-3">
          <div className="text-xs text-slate-500 font-bold">
            {accountsRows.length > 0 ? (
              <span>
                تم تحميل <strong>{accountsRows.length}</strong> حساب | 
                الأخطاء المتبقية: <strong className={totalErrors > 0 ? 'text-rose-600' : 'text-emerald-600'}>{totalErrors}</strong>
              </span>
            ) : (
              <span>يرجى اختيار ملف إكسيل للبدء</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 bg-white text-slate-700 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold transition-all"
            >
              إلغاء
            </button>

            <button
              onClick={handleConfirmImport}
              disabled={accountsRows.length === 0 || totalErrors > 0 || isSaving}
              className="flex items-center gap-2 px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <>
                  <RefreshCw size={15} className="animate-spin" />
                  <span>جاري الحفظ والإنشاء...</span>
                </>
              ) : (
                <>
                  <Check size={16} />
                  <span>تأكيد واستيراد الحسابات</span>
                </>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
