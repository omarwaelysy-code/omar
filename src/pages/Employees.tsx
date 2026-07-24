import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Employee, EmployeeDocument, Department } from '../types';
import { 
  Search, Plus, Edit2, Trash2, X, History, FileText, User, 
  Hash, Calendar, Lock, LayoutGrid, List, ChevronRight, ChevronLeft, 
  Upload, Download, File, Printer, AlertCircle, RefreshCw,
  ChevronDown, Paperclip, RotateCcw, Save, FileUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { dbService } from '../services/dbService';
import { PageActivityLog } from '../components/PageActivityLog';
import { ExportButtons } from '../components/ExportButtons';
import { exportToExcel, formatDataForExcel } from '../utils/excelUtils';
import { exportToPDF as exportToPDFUtil } from '../utils/pdfUtils';
import { usePermissions } from '../hooks/usePermissions';
import { useViewPreference } from '../hooks/useViewPreference';
import { ExcelImportWizard } from '../components/ExcelImportWizard';

const COUNTRIES = [
  { code: 'EG', name_ar: 'مصر', name_en: 'Egypt', flag: '🇪🇬' },
  { code: 'SA', name_ar: 'السعودية', name_en: 'Saudi Arabia', flag: '🇸🇦' },
  { code: 'AE', name_ar: 'الإمارات', name_en: 'United Arab Emirates', flag: '🇦🇪' },
  { code: 'KW', name_ar: 'الكويت', name_en: 'Kuwait', flag: '🇰🇼' },
  { code: 'QA', name_ar: 'قطر', name_en: 'Qatar', flag: '🇶🇦' },
  { code: 'OM', name_ar: 'عمان', name_en: 'Oman', flag: '🇴🇲' },
  { code: 'BH', name_ar: 'البحرين', name_en: 'Bahrain', flag: '🇧🇭' },
  { code: 'JO', name_ar: 'الأردن', name_en: 'Jordan', flag: '🇯🇴' },
  { code: 'SY', name_ar: 'سوريا', name_en: 'Syria', flag: '🇸🇾' },
  { code: 'LB', name_ar: 'لبنان', name_en: 'Lebanon', flag: '🇱🇧' },
  { code: 'PS', name_ar: 'فلسطين', name_en: 'Palestine', flag: '🇵🇸' },
  { code: 'IQ', name_ar: 'العراق', name_en: 'Iraq', flag: '🇮🇶' },
  { code: 'YE', name_ar: 'اليمن', name_en: 'Yemen', flag: '🇾🇪' },
  { code: 'LY', name_ar: 'ليبيا', name_en: 'Libya', flag: '🇱🇾' },
  { code: 'TN', name_ar: 'تونس', name_en: 'Tunisia', flag: '🇹🇳' },
  { code: 'DZ', name_ar: 'الجزائر', name_en: 'Algeria', flag: '🇩🇿' },
  { code: 'MA', name_ar: 'المغرب', name_en: 'Morocco', flag: '🇲🇦' },
  { code: 'SD', name_ar: 'السودان', name_en: 'Sudan', flag: '🇸🇩' },
  { code: 'OTHER', name_ar: 'أخرى', name_en: 'Other', flag: '🏳️' }
];

export const Employees: React.FC = () => {
  const { user } = useAuth();
  const { t, dir, language } = useLanguage();
  const { showNotification } = useNotification();
  const { canView, canCreate, canEdit, canDelete } = usePermissions('employees');

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [view, setView] = useViewPreference('employees', 'table');
  const [showImportWizard, setShowImportWizard] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);

  // Filters State
  const [filterGender, setFilterGender] = useState<string>('');
  const [filterContractType, setFilterContractType] = useState<string>('');
  const [filterNationality, setFilterNationality] = useState<string>('');

  // Modals / Drawer States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [viewingEmployee, setViewingEmployee] = useState<Employee | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [employeeToDelete, setEmployeeToDelete] = useState<string | null>(null);
  const [isActivityLogOpen, setIsActivityLogOpen] = useState(false);
  const [activityLogDocumentId, setActivityLogDocumentId] = useState<string | undefined>(undefined);

  // File Upload State
  const [photoBase64, setPhotoBase64] = useState<string>('');
  const [attachedDocs, setAttachedDocs] = useState<EmployeeDocument[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const printAreaRef = useRef<HTMLDivElement>(null);

  // Form Fields
  const [formData, setFormData] = useState({
    name: '',
    nationality: 'EG',
    national_id: '',
    gender: 'male' as 'male' | 'female',
    marital_status: 'single' as 'married' | 'single',
    birth_date: '',
    hire_date: new Date().toISOString().slice(0, 10),
    contract_type: 'permanent' as 'permanent' | 'temporary',
    contract_expiry_date: '',
    job_title: '',
    manager_id: '',
    department_id: '',
  });

  // Subscribe to updates
  useEffect(() => {
    if (user) {
      const unsubscribe = dbService.subscribe<Employee>('employees', user.company_id, (data) => {
        setEmployees(data);
        setLoading(false);
      });
      return () => unsubscribe();
    }
  }, [user]);

  // Fetch departments list
  useEffect(() => {
    if (user) {
      dbService.list<Department>('departments', user.company_id)
        .then(setDepartments)
        .catch(err => console.error('Failed to fetch departments:', err));
    }
  }, [user]);

  const handleExportExcel = () => {
    const headers = {
      'employee_code': t('employees.column_code'),
      'name': t('employees.column_name'),
      'nationality': t('employees.column_nationality'),
      'national_id': t('employees.column_national_id'),
      'gender': t('employees.column_gender'),
      'marital_status': t('employees.column_marital_status'),
      'contract_type': t('employees.column_contract_type'),
      'hire_date': t('employees.column_hire_date')
    };

    const formattedData = employees.map(emp => {
      const nat = COUNTRIES.find(c => c.code === emp.nationality);
      return {
        ...emp,
        nationality: language === 'ar' ? (nat?.name_ar || emp.nationality) : (nat?.name_en || emp.nationality),
        gender: emp.gender === 'male' ? t('employees.gender_male') : t('employees.gender_female'),
        marital_status: emp.marital_status === 'married' ? t('employees.marital_married') : t('employees.marital_single'),
        contract_type: emp.contract_type === 'permanent' ? t('employees.contract_permanent') : t('employees.contract_temporary')
      };
    });

    const excelData = formatDataForExcel(formattedData, headers);
    exportToExcel(excelData, { filename: 'Employees_List', sheetName: t('employees.title') });
  };

  const handleExportPDF = async () => {
    if (tableRef.current) {
      await exportToPDFUtil(tableRef.current, { 
        filename: 'Employees_List',
        reportTitle: t('employees.title')
      });
    }
  };

  const openModal = async (employee: Employee | null = null) => {
    if (employee) {
      try {
        const fullData = await dbService.get<Employee>('employees', employee.id);
        if (!fullData) throw new Error('Employee not found');
        
        setEditingEmployee(fullData);
        setFormData({
          name: fullData.name,
          nationality: fullData.nationality || 'EG',
          national_id: fullData.national_id || '',
          gender: (fullData.gender as any) || 'male',
          marital_status: (fullData.marital_status as any) || 'single',
          birth_date: fullData.birth_date ? fullData.birth_date.slice(0, 10) : '',
          hire_date: fullData.hire_date ? fullData.hire_date.slice(0, 10) : new Date().toISOString().slice(0, 10),
          contract_type: (fullData.contract_type as any) || 'permanent',
          contract_expiry_date: fullData.contract_expiry_date ? fullData.contract_expiry_date.slice(0, 10) : '',
          job_title: fullData.job_title || '',
          manager_id: fullData.manager_id || '',
          department_id: fullData.department_id || '',
        });
        setPhotoBase64(fullData.photo_url || '');
        
        let docsList: EmployeeDocument[] = [];
        if (fullData.documents) {
          docsList = typeof fullData.documents === 'string' 
            ? JSON.parse(fullData.documents) 
            : fullData.documents;
        }
        setAttachedDocs(docsList);
      } catch (error) {
        console.error('Failed to load employee details:', error);
        showNotification(t('common.error'), 'error');
        return;
      }
    } else {
      // Find the latest created employee
      const sortedEmps = [...employees].sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
      const lastEmpId = sortedEmps.length > 0 ? sortedEmps[0].id : '';

      setEditingEmployee(null);
      setFormData({
        name: '',
        nationality: 'EG',
        national_id: '',
        gender: 'male',
        marital_status: 'single',
        birth_date: '',
        hire_date: new Date().toISOString().slice(0, 10),
        contract_type: 'permanent',
        contract_expiry_date: '',
        job_title: '',
        manager_id: lastEmpId,
        department_id: '',
      });
      setPhotoBase64('');
      setAttachedDocs([]);
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingEmployee(null);
  };

  const resizeImage = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const max_width = 800;
          const max_height = 800;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > max_width) {
              height *= max_width / width;
              width = max_width;
            }
          } else {
            if (height > max_height) {
              width *= max_height / height;
              height = max_height;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.7));
        };
      };
    });
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      showNotification(t('common.image_too_large_warning'), 'warning');
    }

    setUploadingPhoto(true);
    try {
      const base64 = await resizeImage(file);
      setPhotoBase64(base64);
    } catch (err) {
      showNotification(t('common.error'), 'error');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingDoc(true);
    try {
      const newDocs: EmployeeDocument[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });

        newDocs.push({
          name: file.name,
          type: file.type,
          data: base64
        });
      }
      setAttachedDocs(prev => [...prev, ...newDocs]);
    } catch (err) {
      showNotification(t('common.error'), 'error');
    } finally {
      setUploadingDoc(false);
    }
  };

  const handleRemoveDoc = (index: number) => {
    setAttachedDocs(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (formData.contract_type === 'temporary' && !formData.contract_expiry_date) {
      showNotification(language === 'ar' ? 'تاريخ انتهاء العقد مطلوب للعقود المؤقتة' : 'Contract expiry date is required for temporary contracts', 'error');
      return;
    }

    const dataToSave = {
      ...formData,
      birth_date: formData.birth_date || null,
      hire_date: formData.hire_date || null,
      contract_expiry_date: formData.contract_expiry_date || null,
      photo_url: photoBase64,
      documents: JSON.stringify(attachedDocs),
      company_id: user.company_id,
      job_title: formData.job_title || null,
      manager_id: formData.manager_id || null,
      department_id: formData.department_id || null,
    };

    try {
      if (editingEmployee) {
        const fieldsToTrack = [
          { field: 'name', label: t('employees.form_name') },
          { field: 'nationality', label: t('employees.form_nationality') },
          { field: 'national_id', label: t('employees.form_national_id') },
          { field: 'gender', label: t('employees.form_gender') },
          { field: 'marital_status', label: t('employees.form_marital_status') },
          { field: 'contract_type', label: t('employees.form_contract_type') },
          { field: 'job_title', label: language === 'ar' ? 'الوظيفة' : 'Job Title' },
          { field: 'manager_id', label: language === 'ar' ? 'المدير' : 'Manager' },
          { field: 'department_id', label: language === 'ar' ? 'الإدارة' : 'Department' }
        ];

        await dbService.updateWithLog(
          'employees',
          editingEmployee.id,
          dataToSave,
          { id: user.id, username: user.username, company_id: user.company_id },
          language === 'ar' ? 'تعديل موظف' : 'Update Employee',
          'employees',
          fieldsToTrack
        );
        showNotification(t('employees.success_update'), 'success');
      } else {
        const id = await dbService.add('employees', dataToSave);
        await dbService.logActivity(
          user.id,
          user.username,
          user.company_id,
          language === 'ar' ? 'إضافة موظف' : 'Add Employee',
          `${language === 'ar' ? 'إضافة الموظف' : 'Added Employee'}: ${formData.name}`,
          'employees',
          id
        );
        showNotification(t('employees.success_add'), 'success');
      }
      closeModal();
    } catch (error: any) {
      console.error(error);
      showNotification(error.message || t('common.error'), 'error');
    }
  };

  const handleDelete = (id: string) => {
    setEmployeeToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!employeeToDelete || !user) return;
    try {
      const employee = employees.find(e => e.id === employeeToDelete);
      await dbService.delete('employees', employeeToDelete);
      await dbService.logActivity(
        user.id,
        user.username,
        user.company_id,
        language === 'ar' ? 'حذف موظف' : 'Delete Employee',
        `${language === 'ar' ? 'حذف الموظف' : 'Deleted Employee'}: ${employee?.name}`,
        'employees'
      );
      showNotification(t('employees.success_delete'), 'success');
      setIsDeleteModalOpen(false);
      setEmployeeToDelete(null);
    } catch (error: any) {
      showNotification(t('common.error'), 'error');
    }
  };

  const handlePrintProfile = () => {
    if (!viewingEmployee) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const nat = COUNTRIES.find(c => c.code === viewingEmployee.nationality);
    const natText = language === 'ar' ? nat?.name_ar : nat?.name_en;
    
    const printManager = employees.find(e => e.id === viewingEmployee.manager_id);
    const printDept = departments.find(d => d.id === viewingEmployee.department_id);

    const docHtml = `
      <html>
        <head>
          <title>${t('employees.print_profile')}</title>
          <style>
            body { font-family: sans-serif; padding: 40px; color: #1e293b; direction: ${dir}; }
            .header { display: flex; align-items: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 30px; }
            .avatar { width: 100px; height: 100px; border-radius: 20px; object-fit: cover; margin-${dir === 'rtl' ? 'left' : 'right'}: 20px; border: 1px solid #cbd5e1; }
            .title { flex-grow: 1; }
            .title h2 { margin: 0; font-size: 24px; color: #0f172a; }
            .title p { margin: 5px 0 0 0; color: #64748b; font-size: 14px; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
            .info-box { background: #f8fafc; border: 1px solid #f1f5f9; padding: 15px; border-radius: 12px; }
            .info-box label { font-size: 11px; text-transform: uppercase; color: #94a3b8; font-weight: bold; display: block; margin-bottom: 5px; }
            .info-box span { font-size: 16px; font-weight: bold; color: #334155; }
            .section-title { font-size: 18px; font-weight: bold; color: #0f172a; border-bottom: 1px solid #f1f5f9; padding-bottom: 8px; margin-bottom: 15px; }
          </style>
        </head>
        <body onload="window.print(); window.close();">
          <div class="header">
            ${viewingEmployee.photo_url ? `<img src="${viewingEmployee.photo_url}" class="avatar"/>` : `<div style="width: 100px; height: 100px; border-radius: 20px; background: #e2e8f0; display: flex; align-items: center; justify-content: center; font-size: 36px; font-weight: bold; margin-${dir === 'rtl' ? 'left' : 'right'}: 20px;">${viewingEmployee.name[0]}</div>`}
            <div class="title">
              <h2>${viewingEmployee.name}</h2>
              <p>${t('employees.column_code')}: ${viewingEmployee.employee_code}</p>
            </div>
          </div>
          
          <div class="section-title">${t('employees.personal_details')}</div>
          <div class="grid">
            <div class="info-box"><label>${t('employees.form_nationality')}</label><span>${nat?.flag || ''} ${natText || ''}</span></div>
            <div class="info-box"><label>${t('employees.form_national_id')}</label><span>${viewingEmployee.national_id || '-'}</span></div>
            <div class="info-box"><label>${t('employees.form_gender')}</label><span>${viewingEmployee.gender === 'male' ? t('employees.gender_male') : t('employees.gender_female')}</span></div>
            <div class="info-box"><label>${t('employees.form_marital_status')}</label><span>${viewingEmployee.marital_status === 'married' ? t('employees.marital_married') : t('employees.marital_single')}</span></div>
            <div class="info-box"><label>${t('employees.form_birth_date')}</label><span>${viewingEmployee.birth_date ? new Date(viewingEmployee.birth_date).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US') : '-'}</span></div>
          </div>

          <div class="section-title">${t('employees.contract_details')}</div>
          <div class="grid">
            <div class="info-box"><label>${t('employees.form_hire_date')}</label><span>${viewingEmployee.hire_date ? new Date(viewingEmployee.hire_date).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US') : '-'}</span></div>
            <div class="info-box"><label>${t('employees.form_contract_type')}</label><span>${viewingEmployee.contract_type === 'permanent' ? t('employees.contract_permanent') : t('employees.contract_temporary')}</span></div>
            ${viewingEmployee.contract_type === 'temporary' ? `<div class="info-box"><label>${t('employees.form_contract_expiry_date')}</label><span>${viewingEmployee.contract_expiry_date ? new Date(viewingEmployee.contract_expiry_date).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US') : '-'}</span></div>` : ''}
            <div class="info-box"><label>${language === 'ar' ? 'الوظيفة' : 'Job Title'}</label><span>${viewingEmployee.job_title || '-'}</span></div>
            <div class="info-box"><label>${language === 'ar' ? 'المدير' : 'Manager'}</label><span>${printManager ? printManager.name : '-'}</span></div>
            <div class="info-box"><label>${language === 'ar' ? 'الإدارة' : 'Department'}</label><span>${printDept ? printDept.name : '-'}</span></div>
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(docHtml);
    printWindow.document.close();
  };

  // Search and filter logic
  const filteredEmployees = employees.filter(emp => {
    const matchesSearch = emp.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          emp.employee_code.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (emp.national_id && emp.national_id.includes(searchTerm));
    
    const matchesGender = filterGender ? emp.gender === filterGender : true;
    const matchesContract = filterContractType ? emp.contract_type === filterContractType : true;
    const matchesNationality = filterNationality ? emp.nationality === filterNationality : true;

    return matchesSearch && matchesGender && matchesContract && matchesNationality;
  });

  if (!canView) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-zinc-500 gap-4" dir={dir}>
        <div className="w-20 h-20 bg-zinc-100 rounded-full flex items-center justify-center text-zinc-400">
          <Lock size={40} />
        </div>
        <h3 className="text-xl font-bold">{language === 'ar' ? 'عذراً، ليس لديك صلاحية للوصول إلى هذه الصفحة' : 'Sorry, you do not have permission to access this page'}</h3>
        <p className="text-sm">{language === 'ar' ? 'يرجى التواصل مع مدير النظام للحصول على الصلاحيات اللازمة.' : 'Please contact the system administrator to obtain the permissions.'}</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col space-y-6 animate-in fade-in duration-500 overflow-hidden" dir={dir}>
      {!isModalOpen ? (
        <>
          {/* Header Panel */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-1">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-emerald-600 text-white rounded-3xl flex items-center justify-center shadow-xl shadow-emerald-500/20">
                <User size={28} />
              </div>
              <div>
                <h2 className="text-3xl font-black tracking-tight text-slate-900 italic serif">{t('employees.title')}</h2>
                <p className="text-slate-500 font-medium">{t('employees.subtitle')}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button 
                onClick={() => {
                  setActivityLogDocumentId(undefined);
                  setIsActivityLogOpen(true);
                }}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-white text-slate-600 border border-slate-200 rounded-2xl font-bold hover:bg-slate-50 transition-all active:scale-95 shadow-sm"
              >
                <History size={20} />
                <span className="hidden md:inline">{language === 'ar' ? 'سجل النشاط' : 'Activity Log'}</span>
              </button>
              <ExportButtons 
                onExportExcel={handleExportExcel} 
                onExportPDF={handleExportPDF} 
              />
              <button
                onClick={() => setShowImportWizard(true)}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-white text-emerald-700 border border-emerald-300 rounded-2xl font-bold hover:bg-emerald-50 transition-all active:scale-95 shadow-sm"
                title="استيراد من Excel"
              >
                <FileUp size={18} />
                <span className="hidden md:inline">استيراد Excel</span>
              </button>
              {canCreate && (
                <button 
                  onClick={() => openModal()}
                  className="flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-500/20 active:scale-95 border border-emerald-500/50"
                >
                  <Plus size={20} />
                  {t('employees.add_new')}
                </button>
              )}
            </div>
          </div>

          {/* Main List Area */}
          <div className="flex-1 flex flex-col lg:flex-row gap-6 overflow-hidden pb-4">
            <div className="flex-1 flex flex-col w-full">
              {/* Filters and Search Bar */}
              <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full">
                <div className="p-6 border-b border-slate-100 flex flex-col gap-4 bg-slate-50/30">
                  <div className="flex flex-col md:flex-row gap-4 items-center">
                    {/* Search */}
                    <div className="relative flex-1 w-full group">
                      <Search className={`absolute ${dir === 'rtl' ? 'right-4' : 'left-4'} top-3.5 text-slate-400 group-focus-within:text-emerald-500 transition-colors pointer-events-none`} size={20} />
                      <input
                        type="text"
                        placeholder={t('employees.search_placeholder')}
                        className={`w-full ${dir === 'rtl' ? 'pr-12 pl-4' : 'pl-12 pr-4'} py-3 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500/50 outline-none transition-all font-bold text-slate-900 placeholder:text-slate-400 shadow-sm`}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>

                    {/* View Switch */}
                    <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 shadow-inner">
                      <button
                        onClick={() => setView('table')}
                        className={`p-2 rounded-xl transition-all ${view === 'table' ? 'bg-white text-emerald-600 shadow-sm border border-slate-100' : 'text-slate-500 hover:text-slate-700'}`}
                      >
                        <List size={22} />
                      </button>
                      <button
                        onClick={() => setView('card')}
                        className={`p-2 rounded-xl transition-all ${view === 'card' ? 'bg-white text-emerald-600 shadow-sm border border-slate-100' : 'text-slate-500 hover:text-slate-700'}`}
                      >
                        <LayoutGrid size={22} />
                      </button>
                    </div>
                  </div>

                  {/* Advanced Filter Pills */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                    <div>
                      <select
                        className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none font-bold text-xs bg-white"
                        value={filterGender}
                        onChange={(e) => setFilterGender(e.target.value)}
                      >
                        <option value="">{language === 'ar' ? 'كل الأنواع' : 'All Genders'}</option>
                        <option value="male">{t('employees.gender_male')}</option>
                        <option value="female">{t('employees.gender_female')}</option>
                      </select>
                    </div>
                    <div>
                      <select
                        className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none font-bold text-xs bg-white"
                        value={filterContractType}
                        onChange={(e) => setFilterContractType(e.target.value)}
                      >
                        <option value="">{language === 'ar' ? 'كل العقود' : 'All Contracts'}</option>
                        <option value="permanent">{t('employees.contract_permanent')}</option>
                        <option value="temporary">{t('employees.contract_temporary')}</option>
                      </select>
                    </div>
                    <div>
                      <select
                        className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none font-bold text-xs bg-white"
                        value={filterNationality}
                        onChange={(e) => setFilterNationality(e.target.value)}
                      >
                        <option value="">{language === 'ar' ? 'كل الجنسيات' : 'All Nationalities'}</option>
                        {COUNTRIES.map(c => (
                          <option key={c.code} value={c.code}>{c.flag} {language === 'ar' ? c.name_ar : c.name_en}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* List / Table Render */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                  {view === 'table' ? (
                    <div className="hidden md:block overflow-x-auto h-full">
                      <table ref={tableRef} className="w-full">
                        <thead className="sticky top-0 bg-white/80 backdrop-blur-md z-10 border-b border-slate-100">
                          <tr className="text-slate-500 text-[10px] uppercase font-black tracking-[0.2em]">
                            <th className={`px-8 py-6 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('employees.column_code')}</th>
                            <th className={`px-8 py-6 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('employees.column_name')}</th>
                            <th className={`px-8 py-6 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{language === 'ar' ? 'الوظيفة' : 'Job Title'}</th>
                            <th className={`px-8 py-6 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{language === 'ar' ? 'الإدارة' : 'Department'}</th>
                            <th className={`px-8 py-6 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('employees.column_nationality')}</th>
                            <th className={`px-8 py-6 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('employees.column_national_id')}</th>
                            <th className={`px-8 py-6 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('employees.column_contract_type')}</th>
                            <th className={`px-8 py-6 ${dir === 'rtl' ? 'text-left' : 'text-right'}`}>{t('common.actions')}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {filteredEmployees.map((emp) => {
                            const nat = COUNTRIES.find(c => c.code === emp.nationality);
                            return (
                              <tr 
                                key={emp.id} 
                                onClick={() => setViewingEmployee(emp)}
                                className="hover:bg-emerald-50/40 transition-all group cursor-pointer"
                              >
                                <td className={`px-8 py-5 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                                  <span className="font-mono text-[10px] bg-slate-100 px-3 py-1 rounded-lg text-slate-500 font-black border border-slate-200 group-hover:border-emerald-200 group-hover:text-emerald-600 transition-all">
                                    {emp.employee_code}
                                  </span>
                                </td>
                                <td className={`px-8 py-5 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                                  <div className="flex items-center gap-3">
                                    {emp.photo_url ? (
                                      <img src={emp.photo_url} alt="" className="w-10 h-10 rounded-xl object-cover border border-slate-200" />
                                    ) : (
                                      <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center font-bold text-slate-500">
                                        {emp.name[0]}
                                      </div>
                                    )}
                                    <span className="font-black text-slate-900 group-hover:text-emerald-700 transition-colors">{emp.name}</span>
                                  </div>
                                </td>
                                <td className={`px-8 py-5 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                                  <span className="text-sm font-bold text-slate-700">{emp.job_title || '-'}</span>
                                </td>
                                <td className={`px-8 py-5 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                                  <span className="text-sm font-bold text-slate-700">
                                    {departments.find(d => d.id === emp.department_id)?.name || '-'}
                                  </span>
                                </td>
                                <td className={`px-8 py-5 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                                  <span className="text-sm font-bold">
                                    {nat?.flag} {language === 'ar' ? nat?.name_ar : nat?.name_en}
                                  </span>
                                </td>
                                <td className={`px-8 py-5 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                                  <span className="text-sm font-bold font-mono text-slate-500">{emp.national_id || '-'}</span>
                                </td>
                                <td className={`px-8 py-5 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${emp.contract_type === 'permanent' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                                    {emp.contract_type === 'permanent' ? t('employees.contract_permanent') : t('employees.contract_temporary')}
                                  </span>
                                </td>
                                <td className={`px-8 py-5 ${dir === 'rtl' ? 'text-left' : 'text-right'}`}>
                                  <div className={`flex items-center ${dir === 'rtl' ? 'justify-start' : 'justify-end'} gap-2 opacity-0 group-hover:opacity-100 transition-all`}>
                                    {canEdit && (
                                      <button
                                        onClick={(e) => { e.stopPropagation(); openModal(emp); }}
                                        className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
                                      >
                                        <Edit2 size={18} />
                                      </button>
                                    )}
                                    {canDelete && (
                                      <button 
                                        onClick={(e) => { e.stopPropagation(); handleDelete(emp.id); }}
                                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                                      >
                                        <Trash2 size={18} />
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      {filteredEmployees.length === 0 && !loading && (
                        <div className="p-20 text-center flex flex-col items-center gap-4">
                          <div className="w-20 h-20 bg-slate-50 text-slate-200 rounded-full flex items-center justify-center">
                            <Search size={40} />
                          </div>
                          <p className="text-slate-400 font-black text-lg italic tracking-tighter">{t('common.no_data')}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-8 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                      {filteredEmployees.map((emp) => {
                        const nat = COUNTRIES.find(c => c.code === emp.nationality);
                        return (
                          <div 
                            key={emp.id} 
                            onClick={() => setViewingEmployee(emp)}
                            className="p-6 space-y-4 rounded-3xl border border-slate-100 bg-slate-50/30 hover:border-emerald-200 hover:shadow-xl hover:shadow-emerald-500/5 hover:bg-white transition-all cursor-pointer group relative overflow-hidden"
                          >
                            <div className="flex justify-between items-start">
                              <div className="flex items-center gap-3">
                                {emp.photo_url ? (
                                  <img src={emp.photo_url} alt="" className="w-14 h-14 rounded-2xl object-cover border border-slate-200" />
                                ) : (
                                  <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center font-bold text-slate-500 text-xl">
                                    {emp.name[0]}
                                  </div>
                                )}
                                <div>
                                  <h4 className="font-black text-slate-900 group-hover:text-emerald-700 transition-colors text-lg leading-tight">{emp.name}</h4>
                                  <p className="text-xs text-slate-500 font-bold mt-1">
                                    {emp.job_title ? `${emp.job_title} | ` : ''}
                                    {departments.find(d => d.id === emp.department_id)?.name || ''}
                                  </p>
                                  <span className="font-mono text-[10px] bg-white px-2 py-0.5 rounded text-slate-400 font-black border border-slate-200 inline-block mt-1">
                                    {emp.employee_code}
                                  </span>
                                </div>
                              </div>
                              <span className={`px-2 py-1 rounded-lg text-[10px] font-bold ${emp.contract_type === 'permanent' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                                {emp.contract_type === 'permanent' ? t('employees.contract_permanent') : t('employees.contract_temporary')}
                              </span>
                            </div>

                            <div className="pt-4 border-t border-slate-200/50 flex justify-between items-center text-xs text-slate-500 font-bold">
                              <span>{nat?.flag} {language === 'ar' ? nat?.name_ar : nat?.name_en}</span>
                              <span className="font-mono">{emp.national_id || '-'}</span>
                            </div>

                            {/* Card Hover Action Buttons Overlay */}
                            <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-all bg-white/90 backdrop-blur rounded-xl p-1 shadow-sm">
                              {canEdit && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); openModal(emp); }}
                                  className="p-1.5 text-slate-500 hover:text-emerald-600 rounded-lg"
                                >
                                  <Edit2 size={14} />
                                </button>
                              )}
                              {canDelete && (
                                <button 
                                  onClick={(e) => { e.stopPropagation(); handleDelete(emp.id); }}
                                  className="p-1.5 text-slate-500 hover:text-rose-600 rounded-lg"
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      {filteredEmployees.length === 0 && !loading && (
                        <div className="col-span-full py-20 text-center text-slate-400 font-black italic tracking-tighter">{t('common.no_data')}</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-md overflow-hidden animate-in slide-in-from-bottom-4 duration-300 flex flex-col min-h-[80vh] relative">
          {/* Form Header */}
          <div className="p-4 md:p-6 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white/80 backdrop-blur-md z-[70]">
            <div className="flex items-center gap-3">
              <button 
                type="button"
                onClick={closeModal} 
                className="flex items-center gap-2 px-4 py-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all font-black text-sm"
              >
                {dir === 'rtl' ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
                <span>{language === 'ar' ? 'العودة للقائمة' : 'Back to List'}</span>
              </button>
            </div>
            
            <div className="flex-1 flex justify-center">
              <button 
                type="button"
                onClick={() => {
                  setActivityLogDocumentId(editingEmployee?.id || undefined);
                  setIsActivityLogOpen(true);
                }}
                className="flex items-center gap-3 px-6 py-2.5 rounded-2xl text-sm font-black transition-all border shadow-sm bg-white text-slate-700 border-slate-200 hover:bg-zinc-50"
              >
                <History size={18} />
                <span>{language === 'ar' ? 'سجل النشاط والتعديلات' : 'Activity Log'}</span>
              </button>
            </div>

            <div>
              <h3 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
                {editingEmployee ? t('employees.edit') : t('employees.add_new')}
              </h3>
            </div>
          </div>

          {/* Form Content */}
          <div className="flex-grow overflow-y-auto custom-scrollbar p-6">
            <form id="employee-form" onSubmit={handleSubmit} className="space-y-8 max-w-4xl mx-auto">
              
              {/* Section 1: الصورة والبيانات الشخصية */}
              <section className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm space-y-6 relative pt-12">
                <div className="absolute top-4 right-4 flex items-center gap-2 text-emerald-600 bg-emerald-50/50 px-3 py-1 rounded-full border border-emerald-100">
                  <User className="w-4 h-4" />
                  <span className="text-xs font-bold">{language === 'ar' ? 'البيانات الشخصية والصورة' : 'Personal Details & Photo'}</span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Photo Uploader */}
                  <div className="flex flex-col items-center justify-center border-b md:border-b-0 md:border-l border-slate-100 pb-6 md:pb-0 md:pl-6">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block self-start px-1">{t('employees.form_photo')}</span>
                    <div 
                      onClick={() => fileInputRef.current?.click()}
                      className="relative w-32 h-32 rounded-3xl border-2 border-dashed border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/10 cursor-pointer transition-all flex flex-col items-center justify-center overflow-hidden group shadow-sm"
                    >
                      {photoBase64 ? (
                        <>
                          <img src={photoBase64} alt="" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-bold transition-opacity">
                            {language === 'ar' ? 'تغيير الصورة' : 'Change Photo'}
                          </div>
                        </>
                      ) : (
                        <div className="flex flex-col items-center text-slate-400 gap-1.5 p-4 text-center">
                          {uploadingPhoto ? (
                            <RefreshCw size={24} className="animate-spin text-emerald-600" />
                          ) : (
                            <>
                              <Upload size={24} />
                              <span className="text-[10px] font-bold leading-tight">{t('employees.drop_photo_here')}</span>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                    <input 
                      type="file"
                      ref={fileInputRef}
                      onChange={handlePhotoUpload}
                      accept="image/*"
                      className="hidden"
                    />
                  </div>

                  {/* Rest of Personal Details */}
                  <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-zinc-400 tracking-tighter mb-2 px-2 uppercase">{t('employees.form_name')}</label>
                      <input
                        required
                        type="text"
                        placeholder="John Doe"
                        className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none font-bold text-zinc-800 text-sm rounded-2xl"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-zinc-400 tracking-tighter mb-2 px-2 uppercase">{t('employees.form_nationality')}</label>
                      <div className="relative">
                        <select
                          className="w-full py-3 px-4 rounded-2xl bg-zinc-50 border border-zinc-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none font-bold text-zinc-800 appearance-none cursor-pointer text-sm"
                          value={formData.nationality}
                          onChange={(e) => setFormData({ ...formData, nationality: e.target.value })}
                        >
                          {COUNTRIES.map(c => (
                            <option key={c.code} value={c.code}>{c.flag} {language === 'ar' ? c.name_ar : c.name_en}</option>
                          ))}
                        </select>
                        <ChevronDown className={`absolute ${dir === 'rtl' ? 'left-4' : 'right-4'} top-3.5 w-5 h-5 text-zinc-400 pointer-events-none`} />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-zinc-400 tracking-tighter mb-2 px-2 uppercase">{t('employees.form_national_id')}</label>
                      <input
                        type="text"
                        className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none font-bold text-zinc-800 text-sm rounded-2xl font-mono"
                        value={formData.national_id}
                        onChange={(e) => setFormData({ ...formData, national_id: e.target.value })}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-zinc-400 tracking-tighter mb-2 px-2 uppercase">{t('employees.form_gender')}</label>
                      <div className="relative">
                        <select
                          className="w-full py-3 px-4 rounded-2xl bg-zinc-50 border border-zinc-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none font-bold text-zinc-800 appearance-none cursor-pointer text-sm"
                          value={formData.gender}
                          onChange={(e) => setFormData({ ...formData, gender: e.target.value as any })}
                        >
                          <option value="male">{t('employees.gender_male')}</option>
                          <option value="female">{t('employees.gender_female')}</option>
                        </select>
                        <ChevronDown className={`absolute ${dir === 'rtl' ? 'left-4' : 'right-4'} top-3.5 w-5 h-5 text-zinc-400 pointer-events-none`} />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-zinc-400 tracking-tighter mb-2 px-2 uppercase">{t('employees.form_marital_status')}</label>
                      <div className="relative">
                        <select
                          className="w-full py-3 px-4 rounded-2xl bg-zinc-50 border border-zinc-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none font-bold text-zinc-800 appearance-none cursor-pointer text-sm"
                          value={formData.marital_status}
                          onChange={(e) => setFormData({ ...formData, marital_status: e.target.value as any })}
                        >
                          <option value="single">{t('employees.marital_single')}</option>
                          <option value="married">{t('employees.marital_married')}</option>
                        </select>
                        <ChevronDown className={`absolute ${dir === 'rtl' ? 'left-4' : 'right-4'} top-3.5 w-5 h-5 text-zinc-400 pointer-events-none`} />
                      </div>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-zinc-400 tracking-tighter mb-2 px-2 uppercase">{t('employees.form_birth_date')}</label>
                      <div className="relative">
                        <input
                          type="date"
                          className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none font-bold text-zinc-800 text-sm rounded-2xl"
                          value={formData.birth_date}
                          onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
                        />
                        <Calendar className={`absolute ${dir === 'rtl' ? 'right-4' : 'left-4'} top-3.5 w-5 h-5 text-zinc-400 pointer-events-none`} />
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Section 2: بيانات الوظيفة والعقد */}
              <section className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm space-y-6 relative pt-12">
                <div className="absolute top-4 right-4 flex items-center gap-2 text-emerald-600 bg-emerald-50/50 px-3 py-1 rounded-full border border-emerald-100">
                  <FileText className="w-4 h-4" />
                  <span className="text-xs font-bold">{language === 'ar' ? 'التعيين والتعاقد' : 'Job & Contract Details'}</span>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {/* Code */}
                  <div>
                    <label className="block text-xs font-bold text-zinc-400 tracking-tighter mb-2 px-2 uppercase">{t('employees.column_code')}</label>
                    <input
                      readOnly
                      type="text"
                      className="w-full px-4 py-3 bg-slate-100 border border-slate-200 rounded-2xl font-mono font-bold text-slate-400 cursor-not-allowed outline-none text-sm"
                      value={editingEmployee ? editingEmployee.employee_code : (language === 'ar' ? 'تلقائي' : 'Auto')}
                    />
                  </div>

                  {/* Hire Date */}
                  <div>
                    <label className="block text-xs font-bold text-zinc-400 tracking-tighter mb-2 px-2 uppercase">{t('employees.form_hire_date')}</label>
                    <div className="relative">
                      <input
                        type="date"
                        className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none font-bold text-zinc-800 text-sm rounded-2xl"
                        value={formData.hire_date}
                        onChange={(e) => setFormData({ ...formData, hire_date: e.target.value })}
                      />
                      <Calendar className={`absolute ${dir === 'rtl' ? 'right-4' : 'left-4'} top-3.5 w-5 h-5 text-zinc-400 pointer-events-none`} />
                    </div>
                  </div>

                  {/* Contract Type */}
                  <div>
                    <label className="block text-xs font-bold text-zinc-400 tracking-tighter mb-2 px-2 uppercase">{t('employees.form_contract_type')}</label>
                    <div className="relative">
                      <select
                        className="w-full py-3 px-4 rounded-2xl bg-zinc-50 border border-zinc-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none font-bold text-zinc-800 appearance-none cursor-pointer text-sm"
                        value={formData.contract_type}
                        onChange={(e) => setFormData({ ...formData, contract_type: e.target.value as any })}
                      >
                        <option value="permanent">{t('employees.contract_permanent')}</option>
                        <option value="temporary">{t('employees.contract_temporary')}</option>
                      </select>
                      <ChevronDown className={`absolute ${dir === 'rtl' ? 'left-4' : 'right-4'} top-3.5 w-5 h-5 text-zinc-400 pointer-events-none`} />
                    </div>
                  </div>

                  {/* Job Title */}
                  <div>
                    <label className="block text-xs font-bold text-zinc-400 tracking-tighter mb-2 px-2 uppercase">{language === 'ar' ? 'الوظيفة' : 'Job Title'}</label>
                    <input
                      type="text"
                      placeholder={language === 'ar' ? 'أدخل الوظيفة' : 'Enter Job Title'}
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none font-bold text-zinc-800 text-sm rounded-2xl"
                      value={formData.job_title}
                      onChange={(e) => setFormData({ ...formData, job_title: e.target.value })}
                    />
                  </div>

                  {/* Manager */}
                  <div>
                    <label className="block text-xs font-bold text-zinc-400 tracking-tighter mb-2 px-2 uppercase">{language === 'ar' ? 'المدير' : 'Manager'}</label>
                    <div className="relative">
                      <select
                        className="w-full py-3 px-4 rounded-2xl bg-zinc-50 border border-zinc-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none font-bold text-zinc-800 appearance-none cursor-pointer text-sm"
                        value={formData.manager_id}
                        onChange={(e) => setFormData({ ...formData, manager_id: e.target.value })}
                      >
                        <option value="">{language === 'ar' ? 'اختر المدير' : 'Select Manager'}</option>
                        {employees
                          .filter(emp => !editingEmployee || emp.id !== editingEmployee.id)
                          .map(emp => (
                            <option key={emp.id} value={emp.id}>{emp.name} ({emp.employee_code})</option>
                          ))}
                      </select>
                      <ChevronDown className={`absolute ${dir === 'rtl' ? 'left-4' : 'right-4'} top-3.5 w-5 h-5 text-zinc-400 pointer-events-none`} />
                    </div>
                  </div>

                  {/* Department */}
                  <div>
                    <label className="block text-xs font-bold text-zinc-400 tracking-tighter mb-2 px-2 uppercase">{language === 'ar' ? 'الإدارة' : 'Department'}</label>
                    <div className="relative">
                      <select
                        className="w-full py-3 px-4 rounded-2xl bg-zinc-50 border border-zinc-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none font-bold text-zinc-800 appearance-none cursor-pointer text-sm"
                        value={formData.department_id}
                        onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
                      >
                        <option value="">{language === 'ar' ? 'اختر الإدارة' : 'Select Department'}</option>
                        {departments.map(dept => (
                          <option key={dept.id} value={dept.id}>{dept.name}</option>
                        ))}
                      </select>
                      <ChevronDown className={`absolute ${dir === 'rtl' ? 'left-4' : 'right-4'} top-3.5 w-5 h-5 text-zinc-400 pointer-events-none`} />
                    </div>
                  </div>

                  {/* Contract Expiry Date (Only if temporary) */}
                  {formData.contract_type === 'temporary' && (
                    <div className="sm:col-span-2 lg:col-span-3 animate-in slide-in-from-top duration-300">
                      <label className="block text-xs font-bold text-rose-600 tracking-tighter mb-2 px-2 uppercase">{t('employees.form_contract_expiry_date')}</label>
                      <div className="relative">
                        <input
                          required
                          type="date"
                          className="w-full px-4 py-3 bg-white border border-rose-200 focus:ring-2 focus:ring-rose-500 focus:border-rose-500 rounded-2xl font-bold text-zinc-800 outline-none transition-all shadow-sm text-sm"
                          value={formData.contract_expiry_date}
                          onChange={(e) => setFormData({ ...formData, contract_expiry_date: e.target.value })}
                        />
                        <Calendar className={`absolute ${dir === 'rtl' ? 'right-4' : 'left-4'} top-3.5 w-5 h-5 text-rose-400 pointer-events-none`} />
                      </div>
                    </div>
                  )}
                </div>
              </section>

              {/* Section 3: المستندات والمرفقات */}
              <section className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm space-y-6 relative pt-12">
                <div className="absolute top-4 right-4 flex items-center gap-2 text-emerald-600 bg-emerald-50/50 px-3 py-1 rounded-full border border-emerald-100">
                  <Paperclip className="w-4 h-4" />
                  <span className="text-xs font-bold">{t('employees.form_documents')}</span>
                </div>
                
                <div className="space-y-4">
                  <div 
                    onClick={() => docInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/10 cursor-pointer rounded-2xl p-6 text-center transition-all flex flex-col items-center justify-center gap-2 group"
                  >
                    {uploadingDoc ? (
                      <RefreshCw size={24} className="animate-spin text-emerald-600" />
                    ) : (
                      <>
                        <Upload size={24} className="text-slate-400 group-hover:text-emerald-600" />
                        <span className="text-xs font-bold text-slate-500">{t('employees.drop_docs_here')}</span>
                      </>
                    )}
                  </div>
                  <input 
                    type="file"
                    ref={docInputRef}
                    onChange={handleDocUpload}
                    multiple
                    className="hidden"
                  />

                  {/* List of uploaded documents in Form */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-60 overflow-y-auto custom-scrollbar">
                    {attachedDocs.map((doc, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-2xl shadow-sm">
                        <div className="flex items-center gap-2 truncate">
                          <File size={16} className="text-slate-400 flex-shrink-0" />
                          <span className="text-xs font-bold text-slate-700 truncate" title={doc.name}>{doc.name}</span>
                        </div>
                        <button 
                          type="button"
                          onClick={() => handleRemoveDoc(idx)}
                          className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 transition-colors"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            </form>
          </div>

          {/* Form Footer */}
          <div className="p-4 md:p-6 border-t border-slate-100 bg-white/80 backdrop-blur-md sticky bottom-0 z-[70] flex items-center justify-between gap-4">
            <button 
              type="button"
              onClick={closeModal}
              className="flex-1 max-w-[200px] py-4 rounded-2xl bg-zinc-100 text-zinc-600 font-black hover:bg-zinc-200 transition-all flex items-center justify-center gap-3 active:scale-95 text-sm"
            >
              <RotateCcw size={20} />
              {t('common.cancel')}
            </button>
            <button 
              type="submit"
              form="employee-form"
              className="flex-1 py-4 rounded-2xl bg-emerald-600 text-white font-black hover:bg-emerald-700 transition-all flex items-center justify-center gap-3 shadow-xl shadow-emerald-600/20 active:scale-95 text-sm"
            >
              <Save size={20} />
              {t('common.save')}
            </button>
          </div>
        </div>
      )}

      {/* Profile Detail Drawer (View Details) */}
      <AnimatePresence>
        {viewingEmployee && (
          <>
            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[200]" onClick={() => setViewingEmployee(null)} />
            <motion.div
              initial={{ x: dir === 'rtl' ? -500 : 500 }}
              animate={{ x: 0 }}
              exit={{ x: dir === 'rtl' ? -500 : 500 }}
              transition={{ type: 'spring', damping: 30 }}
              className={`fixed top-0 bottom-0 ${dir === 'rtl' ? 'left-0' : 'right-0'} w-full max-w-xl bg-white border-l border-slate-200 shadow-2xl z-[210] flex flex-col`}
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <User size={20} className="text-emerald-600" />
                  <span>{t('employees.print_profile')}</span>
                </h3>
                <div className="flex gap-2">
                  <button 
                    onClick={handlePrintProfile}
                    className="p-2.5 hover:bg-slate-50 rounded-xl border border-slate-200 text-slate-600"
                  >
                    <Printer size={18} />
                  </button>
                  <button onClick={() => setViewingEmployee(null)} className="p-2.5 hover:bg-slate-50 rounded-xl text-slate-400">
                    <X size={18} />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
                {/* Header profile */}
                <div className="flex flex-col items-center text-center space-y-4">
                  {viewingEmployee.photo_url ? (
                    <img src={viewingEmployee.photo_url} alt="" className="w-28 h-28 rounded-3xl object-cover border border-slate-200 shadow-md" />
                  ) : (
                    <div className="w-28 h-28 rounded-3xl bg-slate-100 flex items-center justify-center font-bold text-slate-400 text-4xl border border-slate-200">
                      {viewingEmployee.name[0]}
                    </div>
                  )}
                  <div>
                    <h3 className="text-2xl font-black text-slate-900">{viewingEmployee.name}</h3>
                    <p className="font-mono text-xs text-slate-500 font-bold bg-slate-50 border border-slate-200 rounded px-2.5 py-1 inline-block mt-2">
                      {viewingEmployee.employee_code}
                    </p>
                  </div>
                </div>

                {/* Details Section */}
                <div className="space-y-6">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">
                    {t('employees.personal_details')}
                  </h4>
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">{t('employees.form_nationality')}</span>
                      <span className="font-bold text-slate-900">
                        {(() => {
                          const nat = COUNTRIES.find(c => c.code === viewingEmployee.nationality);
                          return `${nat?.flag || ''} ${language === 'ar' ? nat?.name_ar : nat?.name_en}`;
                        })()}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">{t('employees.form_national_id')}</span>
                      <span className="font-bold text-slate-900 font-mono">{viewingEmployee.national_id || '-'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">{t('employees.form_gender')}</span>
                      <span className="font-bold text-slate-900">
                        {viewingEmployee.gender === 'male' ? t('employees.gender_male') : t('employees.gender_female')}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">{t('employees.form_marital_status')}</span>
                      <span className="font-bold text-slate-900">
                        {viewingEmployee.marital_status === 'married' ? t('employees.marital_married') : t('employees.marital_single')}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">{t('employees.form_birth_date')}</span>
                      <span className="font-bold text-slate-900">
                        {viewingEmployee.birth_date ? new Date(viewingEmployee.birth_date).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US') : '-'}
                      </span>
                    </div>
                  </div>

                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2 pt-4">
                    {t('employees.contract_details')}
                  </h4>
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">{t('employees.form_hire_date')}</span>
                      <span className="font-bold text-slate-900">
                        {viewingEmployee.hire_date ? new Date(viewingEmployee.hire_date).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US') : '-'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">{t('employees.form_contract_type')}</span>
                      <span className={`px-2.5 py-0.5 rounded text-xs font-bold inline-block ${viewingEmployee.contract_type === 'permanent' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                        {viewingEmployee.contract_type === 'permanent' ? t('employees.contract_permanent') : t('employees.contract_temporary')}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">{language === 'ar' ? 'الوظيفة' : 'Job Title'}</span>
                      <span className="font-bold text-slate-900">{viewingEmployee.job_title || '-'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">{language === 'ar' ? 'المدير' : 'Manager'}</span>
                      <span className="font-bold text-slate-900">
                        {employees.find(e => e.id === viewingEmployee.manager_id)?.name || '-'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">{language === 'ar' ? 'الإدارة' : 'Department'}</span>
                      <span className="font-bold text-slate-900">
                        {departments.find(d => d.id === viewingEmployee.department_id)?.name || '-'}
                      </span>
                    </div>
                    {viewingEmployee.contract_type === 'temporary' && (
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">{t('employees.form_contract_expiry_date')}</span>
                        <span className="font-bold text-rose-600">
                          {viewingEmployee.contract_expiry_date ? new Date(viewingEmployee.contract_expiry_date).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US') : '-'}
                        </span>
                      </div>
                    )}
                  </div>

                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2 pt-4">
                    {t('employees.form_documents')}
                  </h4>
                  <div className="space-y-2">
                    {(() => {
                      let docsList: EmployeeDocument[] = [];
                      if (viewingEmployee.documents) {
                        docsList = typeof viewingEmployee.documents === 'string'
                          ? JSON.parse(viewingEmployee.documents)
                          : viewingEmployee.documents;
                      }

                      if (docsList.length === 0) {
                        return <p className="text-sm text-slate-400 font-medium italic">{t('employees.no_documents')}</p>;
                      }

                      return docsList.map((doc, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200 rounded-2xl">
                          <div className="flex items-center gap-2 truncate">
                            <File size={18} className="text-slate-400 flex-shrink-0" />
                            <span className="text-sm font-bold text-slate-800 truncate" title={doc.name}>{doc.name}</span>
                          </div>
                          <a 
                            href={doc.data} 
                            download={doc.name}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50"
                          >
                            <Download size={14} />
                            <span>{language === 'ar' ? 'تحميل' : 'Download'}</span>
                          </a>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>



      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {isDeleteModalOpen && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white max-w-md w-full rounded-3xl p-8 border border-slate-100 shadow-2xl space-y-6 text-center"
            >
              <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center text-rose-500 mx-auto border border-rose-100">
                <AlertCircle size={28} />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-slate-900">{t('common.delete_confirm_title')}</h3>
                <p className="text-sm text-slate-500 font-bold leading-relaxed">{t('common.delete_confirm_msg')}</p>
              </div>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => { setIsDeleteModalOpen(false); setEmployeeToDelete(null); }}
                  className="px-6 py-3 border border-slate-200 text-slate-500 rounded-2xl font-bold hover:bg-slate-50"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={confirmDelete}
                  className="px-6 py-3 bg-rose-600 text-white rounded-2xl font-bold hover:bg-rose-700 shadow-lg shadow-rose-500/20"
                >
                  {t('common.delete')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Activity Log Drawer */}
      <PageActivityLog 
        category="employees" 
        isOpen={isActivityLogOpen} 
        onClose={() => {
          setIsActivityLogOpen(false);
          setActivityLogDocumentId(undefined);
        }} 
        documentId={activityLogDocumentId}
      />

      {showImportWizard && (
        <ExcelImportWizard
          module="employees"
          moduleNameAr="الموظفين"
          onClose={() => setShowImportWizard(false)}
          onSuccess={() => setShowImportWizard(false)}
        />
      )}
    </div>
  );
};
