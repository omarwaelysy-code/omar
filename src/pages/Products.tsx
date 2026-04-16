import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Product, Account } from '../types';
import { Search, Plus, Edit2, Trash2, X, Package, History, FileText, Paperclip, Lock } from 'lucide-react';
import { dbService } from '../services/dbService';
import { PageActivityLog } from '../components/PageActivityLog';
import { InlineActivityLog } from '../components/InlineActivityLog';
import { JournalEntryPreview } from '../components/JournalEntryPreview';
import { ExportButtons } from '../components/ExportButtons';
import { exportToExcel, formatDataForExcel } from '../utils/excelUtils';
import { exportToPDF as exportToPDFUtil } from '../utils/pdfUtils';
import { useRef } from 'react';
import Barcode from 'react-barcode';
import { usePermissions } from '../hooks/usePermissions';

export const Products: React.FC = () => {
  const { user } = useAuth();
  const { t, dir, language } = useLanguage();
  const { showNotification } = useNotification();
  const { canView, canCreate, canEdit, canDelete } = usePermissions('products');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<string | null>(null);
  const [isActivityLogOpen, setIsActivityLogOpen] = useState(false);
  const [activityLogDocumentId, setActivityLogDocumentId] = useState<string | undefined>(undefined);
  const tableRef = useRef<HTMLTableElement>(null);

  const handleExportExcel = () => {
    const headers = {
      'code': t('products.column_code'),
      'name': t('products.column_name'),
      'barcode': t('products.form_barcode'),
      'sale_price': t('products.column_sale_price'),
      'cost_price': t('products.column_cost_price'),
      'description': t('products.form_description')
    };
    const formattedData = formatDataForExcel(products, headers);
    exportToExcel(formattedData, { filename: 'Products_Inventory', sheetName: t('products.title') });
  };

  const handleExportPDF = async () => {
    if (tableRef.current) {
      await exportToPDFUtil(tableRef.current, { 
        filename: 'Products_Inventory',
        reportTitle: t('products.list_title')
      });
    }
  };
  const [formData, setFormData] = useState({ 
    code: '', 
    name: '', 
    type: 'product' as 'service' | 'product' | 'commodity',
    sale_price: 0, 
    cost_price: 0, 
    description: '',
    image_url: '',
    barcode: '',
    stock: 0,
    min_stock: 0,
    revenue_account_id: '',
    cost_account_id: '',
    counter_account_id: ''
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, image_url: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  useEffect(() => {
    if (user) {
      const unsubscribe = dbService.subscribe<Product>('products', user.company_id, (data) => {
        setProducts(data);
        setLoading(false);
      });

      const unsubscribeAccounts = dbService.subscribe<Account>('accounts', user.company_id, (data) => {
        setAccounts(data);
      });

      return () => {
        unsubscribe();
        unsubscribeAccounts();
      };
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      if (!formData.revenue_account_id || !formData.cost_account_id) {
        showNotification('يجب اختيار حساب الإيرادات وحساب التكلفة للصنف', 'error');
        return;
      }

      const revenueAccount = accounts.find(a => a.id === formData.revenue_account_id);
      const costAccount = accounts.find(a => a.id === formData.cost_account_id);
      
      const dataToSave = {
        ...formData,
        revenue_account_name: revenueAccount?.name || '',
        cost_account_name: costAccount?.name || ''
      };

      if (editingProduct) {
        const fieldsToTrack = [
          { field: 'code', label: 'كود الصنف' },
          { field: 'name', label: 'اسم الصنف' },
          { field: 'type', label: 'نوع الصنف' },
          { field: 'sale_price', label: 'سعر البيع' },
          { field: 'cost_price', label: 'سعر التكلفة' },
          { field: 'description', label: 'الوصف' },
          { field: 'barcode', label: 'الباركود' },
          { field: 'revenue_account_name', label: 'حساب الإيرادات' },
          { field: 'cost_account_name', label: 'حساب التكلفة' },
          { field: 'counter_account_id', label: 'حساب الطرف الآخر' }
        ];
        await dbService.updateWithLog(
          'products', 
          editingProduct.id, 
          dataToSave,
          { id: user.id, username: user.username, company_id: user.company_id },
          'تعديل صنف',
          'products',
          fieldsToTrack
        );

        // Always handle journal entry to ensure consistency
        await dbService.deleteJournalEntryByReference(editingProduct.id, user.company_id);

        if (formData.stock > 0 && formData.cost_price > 0) {
          const totalValue = formData.stock * formData.cost_price;
          const inventoryAccount = accounts.find(a => a.name.includes('مخزون') || a.name.includes('بضاعة'));
          const counterAccount = accounts.find(a => a.id === formData.counter_account_id);

          await dbService.add('journal_entries', {
            company_id: user.company_id,
            date: new Date().toISOString().slice(0, 10),
            description: `مخزون افتتاحي للصنف: ${formData.name}`,
            reference_id: editingProduct.id,
            reference_type: 'initial_stock',
            items: [
              {
                account_id: inventoryAccount?.id || 'inventory_account_default',
                account_name: inventoryAccount?.name || 'حساب المخزون (افتراضي)',
                debit: totalValue,
                credit: 0,
                description: 'مخزون افتتاحي'
              },
              {
                account_id: formData.counter_account_id,
                account_name: counterAccount?.name || 'حساب الميزانية الافتتاحية',
                debit: 0,
                credit: totalValue,
                description: `مخزون افتتاحي للصنف: ${formData.name}`
              }
            ],
            total_debit: totalValue,
            total_credit: totalValue,
            created_at: new Date().toISOString(),
            created_by: user.id
          });
        }
      } else {
        const id = await dbService.add('products', { 
          ...dataToSave, 
          company_id: user.company_id 
        });
        await dbService.logActivity(user.id, user.username, user.company_id, 'إضافة صنف', `إضافة صنف جديد: ${formData.name}`, 'products', id);

        // Create initial stock entry
        if (formData.stock > 0 && formData.cost_price > 0) {
          const totalValue = formData.stock * formData.cost_price;
          const inventoryAccount = accounts.find(a => a.name.includes('مخزون') || a.name.includes('بضاعة'));
          const counterAccount = accounts.find(a => a.id === formData.counter_account_id);

          await dbService.add('journal_entries', {
            company_id: user.company_id,
            date: new Date().toISOString().slice(0, 10),
            description: `مخزون افتتاحي للصنف: ${formData.name}`,
            reference_id: id,
            reference_type: 'initial_stock',
            items: [
              {
                account_id: inventoryAccount?.id || 'inventory_account_default',
                account_name: inventoryAccount?.name || 'حساب المخزون (افتراضي)',
                debit: totalValue,
                credit: 0,
                description: 'مخزون افتتاحي'
              },
              {
                account_id: formData.counter_account_id,
                account_name: counterAccount?.name || 'حساب الميزانية الافتتاحية',
                debit: 0,
                credit: totalValue,
                description: `مخزون افتتاحي للصنف: ${formData.name}`
              }
            ],
            total_debit: totalValue,
            total_credit: totalValue,
            created_at: new Date().toISOString(),
            created_by: user.id
          });
        }
      }
      closeModal();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = (id: string) => {
    setProductToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!productToDelete || !user) return;
    try {
      const product = products.find(p => p.id === productToDelete);
      
      // Delete associated journal entry first
      await dbService.deleteJournalEntryByReference(productToDelete, user.company_id);
      
      await dbService.delete('products', productToDelete);
      await dbService.logActivity(user.id, user.username, user.company_id, 'حذف صنف', `حذف الصنف: ${product?.name}`, 'products');
      showNotification('تم حذف الصنف بنجاح', 'success');
      setIsDeleteModalOpen(false);
      setProductToDelete(null);
    } catch (e: any) {
      console.error(e);
      showNotification(e.message || 'حدث خطأ أثناء حذف الصنف', 'error');
    }
  };

  const openModal = (product: Product | null = null) => {
    if (product) {
      setEditingProduct(product);
      setFormData({ 
        code: product.code, 
        name: product.name, 
        type: product.type || 'product',
        sale_price: product.sale_price, 
        cost_price: product.cost_price, 
        description: product.description || '',
        image_url: product.image_url || '',
        barcode: product.barcode || '',
        stock: product.stock || 0,
        min_stock: product.min_stock || 0,
        revenue_account_id: product.revenue_account_id || '',
        cost_account_id: product.cost_account_id || '',
        counter_account_id: product.counter_account_id || ''
      });
    } else {
      setEditingProduct(null);
      setFormData({ 
        code: '', 
        name: '', 
        type: 'product',
        sale_price: 0, 
        cost_price: 0, 
        description: '', 
        image_url: '', 
        barcode: '',
        stock: 0,
        min_stock: 0,
        revenue_account_id: '',
        cost_account_id: '',
        counter_account_id: ''
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingProduct(null);
  };

  const filteredProducts = products.filter(p => 
    (p.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) || 
    (p.code?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  );

  if (!canView) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-zinc-500 gap-4">
        <div className="w-20 h-20 bg-zinc-100 rounded-full flex items-center justify-center text-zinc-400">
          <Lock size={40} />
        </div>
        <h3 className="text-xl font-bold">عذراً، ليس لديك صلاحية للوصول إلى هذه الصفحة</h3>
        <p className="text-sm">يرجى التواصل مع مدير النظام للحصول على الصلاحيات اللازمة.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500" dir={dir}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 italic serif">{t('products.title')}</h2>
          <p className="text-zinc-500">{t('products.subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button 
            onClick={() => setIsActivityLogOpen(true)}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-white text-zinc-600 border border-zinc-200 rounded-2xl font-bold hover:bg-zinc-50 transition-all active:scale-95 shadow-sm"
            title={language === 'ar' ? 'سجل النشاط' : 'Activity Log'}
          >
            <History size={20} />
            <span className="hidden md:inline">{language === 'ar' ? 'سجل النشاط' : 'Activity Log'}</span>
          </button>
          <ExportButtons 
            onExportExcel={handleExportExcel} 
            onExportPDF={handleExportPDF} 
          />
          {canCreate && (
            <button 
              onClick={() => openModal()}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-2xl font-bold hover:from-orange-600 hover:to-orange-700 transition-all active:scale-95 shadow-lg shadow-orange-200"
            >
              <Plus size={20} />
              {t('products.add')}
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-zinc-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-zinc-50 flex items-center gap-4">
          <div className="relative flex-1">
            <Search className={`absolute ${dir === 'rtl' ? 'left-3' : 'right-3'} top-3 text-zinc-400`} size={18} />
            <input
              type="text"
              placeholder={t('products.search_placeholder')}
              className={`w-full ${dir === 'rtl' ? 'pl-10 pr-4' : 'pr-10 pl-4'} py-2 bg-zinc-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 transition-all`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto hidden md:block">
          <table ref={tableRef} className="w-full">
            <thead>
              <tr className="bg-zinc-50/50 text-zinc-500 text-xs uppercase tracking-wider">
                <th className={`px-6 py-4 font-bold ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('products.column_code')}</th>
                <th className={`px-6 py-4 font-bold ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('products.column_name')}</th>
                <th className={`px-6 py-4 font-bold ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('products.column_type')}</th>
                <th className={`px-6 py-4 font-bold ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('products.column_sale_price')}</th>
                <th className={`px-6 py-4 font-bold ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('products.column_cost_price')}</th>
                <th className={`px-6 py-4 font-bold ${dir === 'rtl' ? 'text-left' : 'text-right'}`}>{t('invoices.column_actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {filteredProducts.map((product) => (
                <tr key={product.id} className="hover:bg-zinc-50/50 transition-colors group">
                  <td className={`px-6 py-4 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                    <span className="font-mono text-xs bg-zinc-100 px-2 py-1 rounded text-zinc-600">{product.code}</span>
                  </td>
                  <td className={`px-6 py-4 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                    <div className={`flex items-center gap-3 ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse justify-end'}`}>
                      <div className="w-10 h-10 rounded-lg bg-zinc-100 text-zinc-400 flex items-center justify-center overflow-hidden border border-zinc-50">
                        {product.image_url ? (
                          product.image_url.startsWith('data:application/pdf') ? (
                            <FileText size={20} className="text-red-500" />
                          ) : (
                            <img 
                              src={product.image_url} 
                              alt={product.name} 
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          )
                        ) : (
                          <Package size={20} />
                        )}
                      </div>
                      <span className="font-bold text-zinc-900">{product.name}</span>
                    </div>
                  </td>
                  <td className={`px-6 py-4 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                    <span className="text-xs font-bold text-zinc-500 bg-zinc-100 px-2 py-1 rounded-lg">
                      {product.type === 'service' ? t('products.type_service') : product.type === 'commodity' ? t('products.type_commodity') : t('products.type_product')}
                    </span>
                  </td>
                  <td className={`px-6 py-4 font-bold text-emerald-600 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{(Number(product.sale_price) || 0).toLocaleString()} {t('invoices.currency')}</td>
                  <td className={`px-6 py-4 text-zinc-500 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{(Number(product.cost_price) || 0).toLocaleString()} {t('invoices.currency')}</td>
                  <td className={`px-6 py-4 ${dir === 'rtl' ? 'text-left' : 'text-right'}`}>
                    <div className={`flex items-center ${dir === 'rtl' ? 'justify-start' : 'justify-end'} gap-2 opacity-0 group-hover:opacity-100 transition-opacity no-pdf`}>
                      <button 
                        onClick={() => {
                          setActivityLogDocumentId(product.id);
                          setIsActivityLogOpen(true);
                        }}
                        className="p-2 text-zinc-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-lg transition-all"
                        title={language === 'ar' ? 'سجل النشاط' : 'Activity Log'}
                      >
                        <History size={18} />
                      </button>
                      {canEdit && (
                        <button 
                          onClick={() => openModal(product)}
                          className="p-2 text-zinc-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all"
                        >
                          <Edit2 size={18} />
                        </button>
                      )}
                      {canDelete && (
                        <button 
                          onClick={() => handleDelete(product.id)}
                          className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredProducts.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-zinc-500 italic">{language === 'ar' ? 'لا توجد أصناف.' : 'No products found.'}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile List View */}
        <div className="md:hidden divide-y divide-zinc-50">
          {filteredProducts.map((product) => (
            <div key={product.id} className="p-4 space-y-4" dir={dir}>
              <div className={`flex justify-between items-start ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse'}`}>
                <div className={`flex items-center gap-3 ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse text-left'}`}>
                  <div className="w-12 h-12 rounded-2xl bg-zinc-100 text-zinc-400 flex items-center justify-center overflow-hidden border border-zinc-50">
                    {product.image_url ? (
                      product.image_url.startsWith('data:application/pdf') ? (
                        <FileText size={24} className="text-red-500" />
                      ) : (
                        <img 
                          src={product.image_url} 
                          alt={product.name} 
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      )
                    ) : (
                      <Package size={24} />
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="font-mono text-[10px] bg-zinc-100 px-2 py-1 rounded text-zinc-600 font-bold w-fit">{product.code}</span>
                    <h4 className="font-bold text-zinc-900 text-lg">{product.name}</h4>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => {
                      setActivityLogDocumentId(product.id);
                      setIsActivityLogOpen(true);
                    }}
                    className="p-3 text-zinc-500 bg-zinc-50 rounded-2xl border border-zinc-100 active:scale-95 transition-transform"
                    title={language === 'ar' ? 'سجل النشاط' : 'Activity Log'}
                  >
                    <History size={18} />
                  </button>
                  {canEdit && (
                    <button 
                      onClick={() => openModal(product)}
                      className="p-3 text-blue-500 bg-blue-50 rounded-2xl border border-blue-100 active:scale-95 transition-transform"
                    >
                      <Edit2 size={18} />
                    </button>
                  )}
                  {canDelete && (
                    <button 
                      onClick={() => handleDelete(product.id)}
                      className="p-3 text-red-500 bg-red-50 rounded-2xl border border-red-100 active:scale-95 transition-transform"
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>
              </div>
              <div className={`flex justify-between items-center pt-2 ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse'}`}>
                <div className="space-y-1">
                  <p className={`text-zinc-400 text-[10px] uppercase font-bold tracking-wider ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('products.column_sale_price')}</p>
                  <p className="font-bold text-emerald-600 text-lg">{(Number(product.sale_price) || 0).toLocaleString()} {t('invoices.currency')}</p>
                </div>
                <div className={`space-y-1 ${dir === 'rtl' ? 'text-left' : 'text-right'}`}>
                  <p className={`text-zinc-400 text-[10px] uppercase font-bold tracking-wider ${dir === 'rtl' ? 'text-left' : 'text-right'}`}>{t('products.column_cost_price')}</p>
                  <p className="font-bold text-zinc-700 text-lg">{(Number(product.cost_price) || 0).toLocaleString()} {t('invoices.currency')}</p>
                </div>
              </div>
            </div>
          ))}
          {filteredProducts.length === 0 && !loading && (
            <div className="p-8 text-center text-zinc-500 italic">{language === 'ar' ? 'لا توجد أصناف حالياً' : 'No products available currently'}</div>
          )}
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center md:p-4 bg-zinc-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full h-full md:h-auto md:max-w-6xl md:rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
            <div className={`p-4 md:p-6 border-b border-zinc-50 flex items-center justify-between sticky top-0 bg-white z-10 ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse'}`}>
              <h3 className="text-lg md:text-xl font-bold text-zinc-900">{editingProduct ? t('products.edit') : t('products.add')}</h3>
              <button onClick={closeModal} className="text-zinc-400 hover:text-zinc-600 p-2 hover:bg-zinc-100 rounded-xl transition-all"><X size={24} /></button>
            </div>
            
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
              <form onSubmit={handleSubmit} className="p-4 md:p-8 space-y-5 flex-1 overflow-y-auto pb-32 md:pb-8" dir={dir}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className={`block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('products.form_code')}</label>
                    <input
                      required
                      type="text"
                      className={`w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all ${dir === 'rtl' ? 'text-right' : 'text-left'}`}
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className={`block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('products.form_name')}</label>
                    <input
                      required
                      type="text"
                      className={`w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all ${dir === 'rtl' ? 'text-right' : 'text-left'}`}
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <label className={`block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('products.form_type')}</label>
                  <select
                    required
                    className={`w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all ${dir === 'rtl' ? 'text-right' : 'text-left'}`}
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                  >
                    <option value="product">{t('products.type_product')}</option>
                    <option value="service">{t('products.type_service')}</option>
                    <option value="commodity">{t('products.type_commodity')}</option>
                  </select>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className={`block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('products.form_sale_price')}</label>
                    <input
                      required
                      type="number"
                      step="0.01"
                      className={`w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all ${dir === 'rtl' ? 'text-right' : 'text-left'}`}
                      value={isNaN(formData.sale_price) ? '' : formData.sale_price}
                      onChange={(e) => setFormData({ ...formData, sale_price: parseFloat(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label className={`block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('products.form_cost_price')}</label>
                    <input
                      required
                      type="number"
                      step="0.01"
                      className={`w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all ${dir === 'rtl' ? 'text-right' : 'text-left'}`}
                      value={isNaN(formData.cost_price) ? '' : formData.cost_price}
                      onChange={(e) => setFormData({ ...formData, cost_price: parseFloat(e.target.value) })}
                    />
                  </div>
                </div>
                <div>
                  <label className={`block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('products.form_description')}</label>
                  <textarea
                    className={`w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all ${dir === 'rtl' ? 'text-right' : 'text-left'}`}
                    rows={3}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className={`block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('products.form_attachment')}</label>
                    <div className="relative group">
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        onChange={handleFileChange}
                        className="hidden"
                        id="product-attachment"
                      />
                      <label 
                        htmlFor="product-attachment"
                        className={`flex items-center justify-center gap-2 w-full px-4 py-3 bg-zinc-50 border border-zinc-200 border-dashed rounded-xl cursor-pointer hover:bg-zinc-100 hover:border-emerald-500 transition-all ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse'}`}
                      >
                        <Paperclip size={18} className="text-zinc-400 group-hover:text-emerald-500" />
                        <span className="text-sm text-zinc-500 group-hover:text-emerald-900 font-bold">
                          {formData.image_url ? (language === 'ar' ? 'تغيير المرفق' : 'Change Attachment') : (language === 'ar' ? 'اختر ملفاً...' : 'Choose file...')}
                        </span>
                      </label>
                    </div>
                    {formData.image_url && (
                      <div className="mt-2 relative flex justify-center bg-white p-2 rounded-lg border border-zinc-100 overflow-hidden">
                        <button 
                          type="button"
                          onClick={() => setFormData({ ...formData, image_url: '' })}
                          className={`absolute top-1 ${dir === 'rtl' ? 'right-1' : 'left-1'} text-red-500 hover:bg-red-50 p-1 rounded-full bg-white/80 backdrop-blur-sm shadow-sm z-10`}
                        >
                          <X size={14} />
                        </button>
                        {formData.image_url.startsWith('data:application/pdf') ? (
                          <div className="flex flex-col items-center gap-1">
                            <FileText size={24} className="text-red-500" />
                            <span className="text-[10px] font-bold text-zinc-500">PDF</span>
                          </div>
                        ) : (
                          <img 
                            src={formData.image_url} 
                            alt="Preview" 
                            className="h-10 w-auto rounded object-contain"
                            referrerPolicy="no-referrer"
                          />
                        )}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className={`block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('products.form_barcode')}</label>
                    <input
                      type="text"
                      className={`w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all ${dir === 'rtl' ? 'text-right' : 'text-left'}`}
                      value={formData.barcode}
                      onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                    />
                    {formData.barcode && (
                      <div className="mt-2 flex justify-center bg-white p-2 rounded-lg border border-zinc-100 overflow-hidden">
                        <Barcode 
                          value={formData.barcode} 
                          width={1} 
                          height={40} 
                          fontSize={10}
                          background="transparent"
                        />
                      </div>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className={`block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('products.form_revenue_account')}</label>
                    <select
                      required
                      className={`w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all ${dir === 'rtl' ? 'text-right' : 'text-left'}`}
                      value={formData.revenue_account_id}
                      onChange={(e) => setFormData({ ...formData, revenue_account_id: e.target.value })}
                    >
                      <option value="">{language === 'ar' ? 'اختر الحساب...' : 'Select account...'}</option>
                      {accounts.map(account => (
                        <option key={account.id} value={account.id}>
                          {account.code} - {account.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={`block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('products.form_cost_account')}</label>
                    <select
                      required
                      className={`w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all ${dir === 'rtl' ? 'text-right' : 'text-left'}`}
                      value={formData.cost_account_id}
                      onChange={(e) => setFormData({ ...formData, cost_account_id: e.target.value })}
                    >
                      <option value="">{language === 'ar' ? 'اختر الحساب...' : 'Select account...'}</option>
                      {accounts.map(account => (
                        <option key={account.id} value={account.id}>
                          {account.code} - {account.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                {formData.stock > 0 && (
                  <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 space-y-4 animate-in slide-in-from-top-2 duration-200">
                    <p className={`text-xs font-black text-emerald-800 uppercase tracking-widest ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('products.form_stock_settings')}</p>
                    <div>
                      <label className={`block text-sm font-bold text-emerald-700 mb-1 uppercase tracking-tighter ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('customers.form_counter_account')}</label>
                      <select
                        required
                        className={`w-full px-4 py-3 bg-white border border-emerald-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all ${dir === 'rtl' ? 'text-right' : 'text-left'}`}
                        value={formData.counter_account_id}
                        onChange={(e) => setFormData({ ...formData, counter_account_id: e.target.value })}
                      >
                        <option value="">{language === 'ar' ? 'اختر حساب الطرف الآخر...' : 'Select counter account...'}</option>
                        {accounts.map(account => (
                          <option key={account.id} value={account.id}>
                            {account.code} - {account.name}
                          </option>
                        ))}
                      </select>
                      <p className={`text-[10px] text-emerald-600 mt-1 font-medium italic ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{language === 'ar' ? 'سيتم إنشاء قيد يومية آلي لموازنة قيمة المخزون الافتتاحي.' : 'An automatic journal entry will be created to balance the opening stock value.'}</p>
                    </div>
                    {formData.counter_account_id && (
                      <JournalEntryPreview 
                        title={language === 'ar' ? 'معاينة قيد المخزون الافتتاحي' : 'Opening Stock Entry Preview'}
                        items={[
                          {
                            account_name: accounts.find(a => a.name.includes('مخزون') || a.name.includes('بضاعة'))?.name || (language === 'ar' ? 'حساب المخزون' : 'Inventory Account'),
                            debit: formData.stock * formData.cost_price,
                            credit: 0,
                            description: language === 'ar' ? 'مخزون افتتاحي' : 'Opening Stock'
                          },
                          {
                            account_name: accounts.find(a => a.id === formData.counter_account_id)?.name || (language === 'ar' ? 'حساب الطرف الآخر' : 'Counter Account'),
                            debit: 0,
                            credit: formData.stock * formData.cost_price,
                            description: language === 'ar' ? `مخزون افتتاحي للصنف: ${formData.name}` : `Opening stock for product: ${formData.name}`
                          }
                        ]}
                      />
                    )}
                  </div>
                )}
                <div className="pt-4 flex gap-3">
                  <button 
                    type="submit"
                    className="flex-1 py-4 bg-emerald-500 text-white rounded-2xl font-bold hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
                  >
                    {editingProduct ? (language === 'ar' ? 'تحديث الصنف' : 'Update Product') : (language === 'ar' ? 'حفظ الصنف' : 'Save Product')}
                  </button>
                  <button 
                    type="button"
                    onClick={closeModal}
                    className="px-8 py-4 bg-zinc-100 text-zinc-600 rounded-2xl font-bold hover:bg-zinc-200 transition-all active:scale-95"
                  >
                    {language === 'ar' ? 'إلغاء' : 'Cancel'}
                  </button>
                </div>
              </form>

              <div className="hidden md:block w-80 border-r border-zinc-100 bg-zinc-50/30">
                <InlineActivityLog category="products" documentId={editingProduct?.id} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-zinc-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-6 animate-in zoom-in-95 duration-200" dir={dir}>
            <h3 className="text-xl font-bold text-zinc-900 mb-4">{t('common.delete_confirm')}</h3>
            <p className="text-zinc-500 mb-6">{language === 'ar' ? 'هل أنت متأكد من رغبتك في حذف هذا الصنف؟ لا يمكن التراجع عن هذا الإجراء.' : 'Are you sure you want to delete this product? This action cannot be undone.'}</p>
            <div className="flex gap-4">
              <button 
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setProductToDelete(null);
                }}
                className="flex-1 py-3 bg-zinc-100 text-zinc-600 rounded-xl font-bold hover:bg-zinc-200 transition-all"
              >
                {language === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
              <button 
                onClick={confirmDelete}
                className="flex-1 py-3 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 transition-all shadow-lg shadow-red-500/20"
              >
                {language === 'ar' ? 'حذف' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      <PageActivityLog 
        category="products" 
        isOpen={isActivityLogOpen} 
        onClose={() => {
          setIsActivityLogOpen(false);
          setActivityLogDocumentId(undefined);
        }} 
        documentId={activityLogDocumentId}
      />
    </div>
  );
};
