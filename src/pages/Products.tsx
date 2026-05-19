import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Product, Account } from '../types';
import { Search, Plus, Trash2, X, Package, History, FileText, Paperclip, Lock, LayoutGrid, List, ChevronRight, ChevronLeft, Hash, Wallet, Layers, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
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
import { formatNumber } from '../utils/formatUtils';
import { useViewPreference } from '../hooks/useViewPreference';

export const Products: React.FC = () => {
  const { user } = useAuth();
  const { t, dir, language } = useLanguage();
  const { showNotification } = useNotification();
  const { canView, canCreate, canDelete } = usePermissions('products');
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
  const [view, setView] = useViewPreference('products', 'table');
  const [isAutoCode, setIsAutoCode] = useState(true);

  const [formData, setFormData] = useState({ 
    code: '', 
    name: '', 
    type: 'finished_good' as 'service' | 'finished_good' | 'raw_material' | 'commodity',
    category: '',
    unit: 'قطعة',
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

  const [invoices, setInvoices] = useState<any[]>([]);
  const [returns, setReturns] = useState<any[]>([]);
  const [purchaseInvoices, setPurchaseInvoices] = useState<any[]>([]);
  const [purchaseReturns, setPurchaseReturns] = useState<any[]>([]);

  useEffect(() => {
    if (user) {
      const unsubscribe = dbService.subscribe<Product>('products', user.company_id, (data) => {
        setProducts(data);
        setLoading(false);
      });

      const unsubscribeAccounts = dbService.subscribe<Account>('accounts', user.company_id, (data) => {
        setAccounts(data);
      });

      const unsubscribeInvoices = dbService.subscribe<any>('invoices', user.company_id, setInvoices);
      const unsubscribeReturns = dbService.subscribe<any>('returns', user.company_id, setReturns);
      const unsubscribePurchaseInvoices = dbService.subscribe<any>('purchase_invoices', user.company_id, setPurchaseInvoices);
      const unsubscribePurchaseReturns = dbService.subscribe<any>('purchase_returns', user.company_id, setPurchaseReturns);

      return () => {
        unsubscribe();
        unsubscribeAccounts();
        unsubscribeInvoices();
        unsubscribeReturns();
        unsubscribePurchaseInvoices();
        unsubscribePurchaseReturns();
      };
    }
  }, [user]);

  useEffect(() => {
    if (!editingProduct && formData.type && isModalOpen && isAutoCode) {
      const prefixMap: Record<string, string> = {
        'service': 'SRV',
        'finished_good': 'FG',
        'raw_material': 'RM',
        'commodity': 'CMD'
      };
      
      const prefix = prefixMap[formData.type] || 'PRD';
      const typeProducts = products.filter(p => p.type === formData.type);
      
      let maxNum = 0;
      typeProducts.forEach(p => {
        const parts = p.code?.split('-');
        if (parts && parts.length > 1) {
          const num = parseInt(parts[1]);
          if (!isNaN(num) && num > maxNum) maxNum = num;
        } else if (p.code?.startsWith(prefix)) {
          const numStr = p.code.substring(prefix.length);
          const num = parseInt(numStr);
          if (!isNaN(num) && num > maxNum) maxNum = num;
        }
      });
      
      const nextNum = (maxNum + 1).toString().padStart(4, '0');
      const newCode = `${prefix}-${nextNum}`;
      
      if (formData.code !== newCode) {
        setFormData(prev => ({ ...prev, code: newCode }));
      }
    }
  }, [formData.type, editingProduct, isModalOpen, products, isAutoCode]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type === 'application/pdf') {
        const reader = new FileReader();
        reader.onloadend = () => {
          setFormData({ ...formData, image_url: reader.result as string });
        };
        reader.readAsDataURL(file);
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const MAX_WIDTH = 1200;
          const MAX_HEIGHT = 1200;

          if (width > height) {
            if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
          } else {
            if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          setFormData({ ...formData, image_url: canvas.toDataURL('image/jpeg', 0.8) });
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

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

      let id = '';
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
          { field: 'cost_account_name', label: 'حساب التكلفة' }
        ];
        await dbService.updateWithLog(
          'products', id = editingProduct.id, dataToSave,
          { id: user.id, username: user.username, company_id: user.company_id },
          'تعديل صنف', 'products', fieldsToTrack
        );
      } else {
        id = await dbService.add('products', { ...dataToSave, company_id: user.company_id });
      }

      showNotification(editingProduct ? 'تم تحديث بيانات الصنف بنجاح' : 'تم إضافة الصنف بنجاح', 'success');
      closeModal();

      try {
        if (editingProduct) {
          await dbService.deleteJournalEntryByReference(id, user.company_id);
        } else {
          await dbService.logActivity(user.id, user.username, user.company_id, 'إضافة صنف', `إضافة صنف جديد: ${formData.name}`, 'products', id);
        }

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
                account_id: inventoryAccount?.id || '',
                account_name: inventoryAccount?.name || 'حساب المخزون',
                debit: totalValue,
                credit: 0,
                description: 'مخزون افتتاحي'
              },
              {
                account_id: formData.counter_account_id,
                account_name: counterAccount?.name || 'حساب الطرف الآخر',
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
      } catch (err) { console.error('Post-save failed:', err); }
    } catch (e) { console.error(e); showNotification('حدث خطأ أثناء حفظ البيانات', 'error'); }
  };

  const handleDelete = (id: string) => { setProductToDelete(id); setIsDeleteModalOpen(true); };

  const confirmDelete = async () => {
    if (!productToDelete || !user) return;
    try {
      const hasTransactions = [invoices, returns, purchaseInvoices, purchaseReturns].some(coll => 
        coll.some(doc => doc.items?.some((item: any) => item.product_id === productToDelete))
      );

      if (hasTransactions) {
        showNotification(language === 'ar' ? 'لا يمكن حذف الصنف لوجود معاملات مرتبطة به.' : 'Cannot delete product with associated transactions.', 'error');
        setIsDeleteModalOpen(false); return;
      }

      await dbService.deleteJournalEntryByReference(productToDelete, user.company_id);
      await dbService.delete('products', productToDelete);
      await dbService.logActivity(user.id, user.username, user.company_id, 'حذف صنف', `حذف الصنف`, 'products');
      showNotification('تم حذف الصنف بنجاح', 'success');
      setIsDeleteModalOpen(false); setProductToDelete(null);
    } catch (e: any) { showNotification(e.message || 'حدث خطأ أثناء حذف الصنف', 'error'); }
  };

  const openModal = async (product: Product | null = null) => {
    if (product) {
      try {
        const fullData = await dbService.get<Product>('products', product.id);
        if (!fullData) throw new Error('Product not found');
        setEditingProduct(fullData);
        setIsAutoCode(false);
        setFormData({ 
          code: fullData.code, name: fullData.name, 
          type: (fullData.type as any) === 'product' ? 'finished_good' : fullData.type,
          category: fullData.category || '', unit: fullData.unit || 'قطعة',
          sale_price: fullData.sale_price, cost_price: fullData.cost_price, 
          description: fullData.description || '', image_url: fullData.image_url || '', 
          barcode: fullData.barcode || '', stock: fullData.stock || 0, min_stock: fullData.min_stock || 0,
          revenue_account_id: fullData.revenue_account_id || '', cost_account_id: fullData.cost_account_id || '',
          counter_account_id: fullData.counter_account_id || ''
        });
      } catch (error: any) { showNotification('فشل تحميل بيانات المنتج', 'error'); return; }
    } else {
      setEditingProduct(null); setIsAutoCode(true);
      setFormData({ 
        code: '', name: '', type: 'finished_good', category: '', unit: 'قطعة',
        sale_price: 0, cost_price: 0, description: '', image_url: '', 
        barcode: '', stock: 0, min_stock: 0, revenue_account_id: '', 
        cost_account_id: '', counter_account_id: ''
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => { setIsModalOpen(false); setEditingProduct(null); };

  const handleExportExcel = () => {
    const headers = { 'code': t('products.column_code'), 'name': t('products.column_name'), 'barcode': t('products.form_barcode'), 'sale_price': t('products.column_sale_price'), 'cost_price': t('products.column_cost_price') };
    exportToExcel(formatDataForExcel(products, headers), { filename: 'Products_Inventory', sheetName: t('products.title') });
  };

  const handleExportPDF = async () => { if (tableRef.current) await exportToPDFUtil(tableRef.current, { filename: 'Products_Inventory', reportTitle: t('products.list_title') }); };

  const filteredProducts = products.filter(p => (p.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || (p.code || '').toLowerCase().includes(searchTerm.toLowerCase()));

  if (!canView) return (
    <div className="flex flex-col items-center justify-center h-[60vh] text-zinc-500 gap-4">
      <Lock size={40} />
      <h3 className="text-xl font-bold">عذراً، ليس لديك صلاحية للوصول إلى هذه الصفحة</h3>
    </div>
  );

  return (
    <div className="h-full flex flex-col space-y-6 animate-in fade-in duration-500 overflow-hidden" dir={dir}>
      {!isModalOpen && (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-1">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-emerald-600 text-white rounded-3xl flex items-center justify-center shadow-xl shadow-emerald-500/20">
              <Package size={28} />
            </div>
            <div>
              <h2 className="text-3xl font-black tracking-tight text-slate-900 italic serif">{t('products.title')}</h2>
              <p className="text-slate-500 font-medium">{t('products.subtitle')}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button onClick={() => setIsActivityLogOpen(true)} className="flex items-center justify-center gap-2 px-4 py-3 bg-white text-slate-600 border border-slate-200 rounded-2xl font-bold hover:bg-slate-50 transition-all active:scale-95 shadow-sm">
              <History size={20} />
              <span className="hidden md:inline">{t('common.activity_log')}</span>
            </button>
            <ExportButtons onExportExcel={handleExportExcel} onExportPDF={handleExportPDF} />
            {canCreate && (
              <button onClick={() => openModal()} className="flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-500/20 active:scale-95 border border-emerald-500/50">
                <Plus size={20} />
                {t('products.add')}
              </button>
            )}
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col lg:flex-row gap-6 overflow-hidden pb-4">
        <div className={`flex-1 flex flex-col transition-all duration-700 ease-in-out ${isModalOpen ? 'hidden' : 'w-full'}`}>
          <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full">
            <div className="p-6 border-b border-slate-100 flex items-center gap-4 bg-slate-50/30">
              <div className="relative flex-1 group">
                <Search className={`absolute ${dir === 'rtl' ? 'right-4' : 'left-4'} top-3.5 text-slate-400 group-focus-within:text-emerald-500 transition-colors pointer-events-none`} size={20} />
                <input
                  type="text"
                  placeholder={t('products.search_placeholder')}
                  className={`w-full ${dir === 'rtl' ? 'pr-12 pl-4' : 'pl-12 pr-4'} py-3 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500/50 outline-none font-bold text-slate-900 placeholder:text-slate-400 shadow-sm`}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 shadow-inner">
                <button onClick={() => setView('table')} className={`p-2 rounded-xl transition-all ${view === 'table' ? 'bg-white text-emerald-600 shadow-sm border border-slate-100' : 'text-slate-500 hover:text-slate-700'}`}><List size={22} /></button>
                <button onClick={() => setView('card')} className={`p-2 rounded-xl transition-all ${view === 'card' ? 'bg-white text-emerald-600 shadow-sm border border-slate-100' : 'text-slate-500 hover:text-slate-700'}`}><LayoutGrid size={22} /></button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {view === 'table' ? (
                <div className="hidden md:block overflow-x-auto h-full">
                  <table ref={tableRef} className="w-full">
                    <thead className="sticky top-0 bg-white/80 backdrop-blur-md z-10 border-b border-slate-100">
                      <tr className="text-slate-500 text-[10px] uppercase font-black tracking-[0.2em]">
                        <th className={`px-8 py-6 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('products.column_code')}</th>
                        <th className={`px-8 py-6 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('products.column_name')}</th>
                        <th className={`px-8 py-6 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('products.column_sale_price')}</th>
                        <th className={`px-8 py-6 ${dir === 'rtl' ? 'text-left' : 'text-right'}`}>{t('invoices.column_actions')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {filteredProducts.map((product) => (
                        <tr 
                          key={product.id} 
                          onClick={() => openModal(product)}
                          className="hover:bg-emerald-50/40 transition-all group cursor-pointer"
                        >
                          <td className={`px-8 py-5 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                            <span className="font-mono text-[10px] bg-slate-100 px-3 py-1 rounded-lg text-slate-500 font-black border border-slate-200 group-hover:border-emerald-200 transition-all">{product.code}</span>
                          </td>
                          <td className={`px-8 py-5 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                             <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center overflow-hidden border border-slate-200">
                                  {product.image_url ? <img src={product.image_url} alt="" className="w-full h-full object-cover" /> : <Package size={20} />}
                                </div>
                                <div className="flex flex-col">
                                   <span className="font-black text-slate-900 group-hover:text-emerald-700 transition-colors">{product.name}</span>
                                   <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{t(`products.type_${product.type}`)}</span>
                                </div>
                             </div>
                          </td>
                          <td className={`px-8 py-5 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                            <span className="font-black text-emerald-600 text-lg">{formatNumber(product.sale_price || 0)} <span className="text-[10px] text-slate-400 italic ms-1">{t('invoices.currency')}</span></span>
                          </td>
                          <td className={`px-8 py-5 ${dir === 'rtl' ? 'text-left' : 'text-right'}`}>
                             <div className={`flex items-center ${dir === 'rtl' ? 'justify-start' : 'justify-end'} gap-1 opacity-0 group-hover:opacity-100 transition-all`}>
                                <button onClick={(e) => { e.stopPropagation(); handleDelete(product.id); }} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"><Trash2 size={18} /></button>
                                <div className="p-2 text-emerald-400 bg-emerald-50 rounded-xl">{dir === 'rtl' ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}</div>
                             </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-8 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                  {filteredProducts.map((product) => (
                    <div key={product.id} onClick={() => openModal(product)} className="p-8 space-y-6 rounded-[2.5rem] border bg-slate-50/40 border-slate-100 hover:border-emerald-200 hover:shadow-xl hover:bg-white transition-all cursor-pointer group">
                      <div className="flex justify-between items-start">
                        <div className="flex flex-col gap-2">
                          <span className="font-mono text-[10px] bg-white px-3 py-1 rounded-lg text-slate-500 font-black w-fit border border-slate-200">{product.code}</span>
                          <h4 className="font-black text-slate-900 group-hover:text-emerald-700 transition-colors text-2xl tracking-tighter leading-none">{product.name}</h4>
                          <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{t(`products.type_${product.type}`)}</span>
                        </div>
                        <div className="w-20 h-20 rounded-[2rem] bg-white text-slate-300 flex items-center justify-center overflow-hidden border border-slate-100 group-hover:scale-105 transition-all">
                           {product.image_url ? <img src={product.image_url} alt="" className="w-full h-full object-cover" /> : <Package size={32} />}
                        </div>
                      </div>
                      <div className="pt-6 border-t border-slate-200/5 flex justify-between items-end">
                        <div>
                          <p className="text-slate-400 text-[10px] uppercase font-black tracking-[0.2em] mb-2">{t('products.column_sale_price')}</p>
                          <p className="font-black text-4xl tracking-tighter leading-none text-emerald-600">{formatNumber(product.sale_price || 0)} <span className="text-sm font-normal text-slate-300 italic">{t('invoices.currency')}</span></p>
                        </div>
                        <div className="p-3 bg-white border border-slate-100 rounded-2xl text-slate-300 group-hover:text-emerald-500 transition-all">{dir === 'rtl' ? <ChevronLeft size={24} /> : <ChevronRight size={24} />}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {isModalOpen && (
            <motion.div 
              initial={{ x: dir === 'rtl' ? -500 : 500, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: dir === 'rtl' ? -500 : 500, opacity: 0 }}
              transition={{ type: 'spring', damping: 32, stiffness: 280 }}
              className="w-full flex flex-col lg:flex-row h-full bg-white rounded-[2.5rem] border border-slate-200 shadow-2xl overflow-hidden relative z-[40]"
            >
              <div className="flex-1 flex flex-col overflow-hidden bg-white">
                <div className={`p-8 border-b border-slate-50 flex items-center justify-between sticky top-0 bg-white z-10 ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse'}`}>
                  <div className="flex items-center gap-4 text-right">
                    <div className="w-14 h-14 bg-emerald-600 text-white rounded-[1.5rem] flex items-center justify-center shadow-xl shadow-emerald-500/20">
                       <Package size={28} />
                    </div>
                    <div>
                       <h3 className="text-3xl font-black text-slate-900 tracking-tight leading-none mb-1">{editingProduct ? t('products.edit') : t('products.add')}</h3>
                       <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">{t('products.subtitle')}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button type="submit" form="product-form" className="px-8 py-4 bg-emerald-600 text-white rounded-[1.25rem] font-black hover:bg-emerald-700 transition-all shadow-xl active:scale-95 border border-emerald-500/50">{editingProduct ? t('common.save') : t('common.add')}</button>
                    <button onClick={closeModal} className="text-slate-300 hover:text-slate-900 p-3 hover:bg-slate-50 rounded-full transition-all"><X size={24} /></button>
                  </div>
                </div>
                
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                  <form id="product-form" onSubmit={handleSubmit} className="p-8 md:p-12 space-y-12" dir={dir}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10 text-right">
                      <div className="md:col-span-2">
                        <label className={`block text-[10px] font-black text-slate-400 mb-3 uppercase tracking-widest px-1`}>{t('products.form_name')}</label>
                        <input required type="text" placeholder={language === 'ar' ? 'اسم الصنف / المنتج' : 'Product Name'} className="w-full px-8 py-5 bg-white border border-slate-100 rounded-[1.5rem] text-xl font-black text-slate-900 shadow-sm transition-all outline-none" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
                      </div>
                      <div>
                        <label className={`block text-[10px] font-black text-slate-400 mb-3 uppercase tracking-widest px-1`}>{t('products.form_code')}</label>
                        <div className="relative group">
                          <Hash className={`absolute ${dir === 'rtl' ? 'right-4' : 'left-4'} top-4 text-slate-300`} size={20} />
                          <input required readOnly type="text" className="w-full px-8 py-4 bg-slate-50 border border-slate-200 rounded-[1.25rem] font-mono text-lg font-black text-slate-400 ps-14 tracking-widest" value={formData.code} />
                        </div>
                      </div>
                      <div>
                        <label className={`block text-[10px] font-black text-slate-400 mb-3 uppercase tracking-widest px-1`}>{t('products.form_type')}</label>
                        <div className="relative group">
                          <LayoutGrid className={`absolute ${dir === 'rtl' ? 'right-4' : 'left-4'} top-4 text-slate-300`} size={20} />
                          <select required className="w-full px-8 py-4 bg-white border border-slate-100 rounded-[1.25rem] text-lg font-black text-slate-900 shadow-sm ps-14 appearance-none" value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}>
                            <option value="finished_good">{t('products.type_finished_good')}</option>
                            <option value="service">{t('products.type_service')}</option>
                            <option value="raw_material">{t('products.type_raw_material')}</option>
                            <option value="commodity">{t('products.type_commodity')}</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 mb-3 uppercase tracking-widest px-1">{t('products.form_category')}</label>
                        <input type="text" placeholder={t('products.form_category')} className="w-full px-8 py-4 bg-white border border-slate-100 rounded-[1.25rem] text-lg font-black text-slate-900 shadow-sm" value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 mb-3 uppercase tracking-widest px-1">{t('products.form_unit')}</label>
                        <select className="w-full px-8 py-4 bg-white border border-slate-100 rounded-[1.25rem] text-lg font-black text-slate-900 shadow-sm appearance-none" value={formData.unit} onChange={(e) => setFormData({ ...formData, unit: e.target.value })}>
                          <option value="قطعة">{t('products.unit_piece')}</option>
                          <option value="كيلو">{t('products.unit_kg')}</option>
                          <option value="متر">{t('products.unit_meter')}</option>
                          <option value="لتر">{t('products.unit_liter')}</option>
                        </select>
                      </div>
                      <div className="md:col-span-2 p-10 bg-slate-50/50 rounded-[3rem] border border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-10">
                        <div>
                          <label className="block text-[10px] font-black text-slate-400 mb-4 uppercase tracking-widest px-1">{t('products.form_sale_price')}</label>
                          <div className="relative group">
                            <Wallet className={`absolute ${dir === 'rtl' ? 'right-4' : 'left-4'} top-4 text-emerald-300`} size={20} />
                            <input required type="number" step="0.01" className="w-full px-8 py-5 bg-white border border-emerald-100 rounded-[1.5rem] text-3xl font-black text-emerald-600 ps-14" value={formData.sale_price || ''} onChange={(e) => setFormData({ ...formData, sale_price: parseFloat(e.target.value) || 0 })} />
                          </div>
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-slate-400 mb-4 uppercase tracking-widest px-1">{t('products.form_cost_price')}</label>
                          <div className="relative group">
                            <Wallet className={`absolute ${dir === 'rtl' ? 'right-4' : 'left-4'} top-4 text-slate-300`} size={20} />
                            <input required type="number" step="0.01" className="w-full px-8 py-5 bg-white border border-slate-200 rounded-[1.5rem] text-3xl font-black text-slate-900 ps-14" value={formData.cost_price || ''} onChange={(e) => setFormData({ ...formData, cost_price: parseFloat(e.target.value) || 0 })} />
                          </div>
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 mb-3 uppercase tracking-widest px-1">{t('products.form_stock_quantity')}</label>
                        <input type="number" className="w-full px-8 py-4 bg-white border border-slate-100 rounded-[1.25rem] text-lg font-black" value={formData.stock || ''} onChange={(e) => setFormData({ ...formData, stock: parseFloat(e.target.value) || 0 })} />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 mb-3 uppercase tracking-widest px-1">{t('products.form_min_stock')}</label>
                        <input type="number" className="w-full px-8 py-4 bg-white border border-slate-100 rounded-[1.25rem] text-lg font-black" value={formData.min_stock || ''} onChange={(e) => setFormData({ ...formData, min_stock: parseFloat(e.target.value) || 0 })} />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-[10px] font-black text-slate-400 mb-3 uppercase tracking-widest px-1">{t('products.form_description')}</label>
                        <textarea className="w-full px-8 py-4 bg-white border border-slate-100 rounded-[1.5rem] text-lg font-black min-h-[100px]" rows={2} value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
                      </div>
                      <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-10">
                        <div>
                          <label className="block text-[10px] font-black text-slate-400 mb-3 uppercase tracking-widest px-1">{t('products.form_attachment')}</label>
                          <div className="relative group mb-4">
                            <input type="file" accept="image/*,application/pdf" onChange={handleFileChange} className="hidden" id="product-attachment" />
                            <label htmlFor="product-attachment" className="flex flex-col items-center justify-center gap-4 w-full p-10 bg-slate-50 border-[3px] border-dashed border-slate-100 rounded-[2.5rem] cursor-pointer hover:bg-slate-100 transition-all">
                              <Paperclip size={32} className="text-slate-300" />
                              <span className="text-sm text-slate-400 font-black uppercase tracking-widest">{formData.image_url ? t('common.edit') : t('common.upload')}</span>
                            </label>
                          </div>
                          {formData.image_url && <img src={formData.image_url} alt="" className="max-h-32 mx-auto rounded-lg" />}
                        </div>
                        <div className="space-y-6">
                          <label className="block text-[10px] font-black text-slate-400 mb-3 uppercase tracking-widest px-1">{t('products.form_barcode')}</label>
                          <input type="text" className="w-full px-8 py-4 bg-white border border-slate-100 rounded-[1.25rem] text-lg font-black" value={formData.barcode} onChange={(e) => setFormData({ ...formData, barcode: e.target.value })} />
                          {formData.barcode && <div className="p-4 bg-white border border-slate-100 rounded-2xl flex justify-center"><Barcode value={formData.barcode} width={1.2} height={50} fontSize={12} /></div>}
                        </div>
                      </div>
                      <div className="md:col-span-2 p-10 bg-slate-50/50 rounded-[3rem] border border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-10">
                        <div>
                          <label className="block text-[10px] font-black text-slate-400 mb-4 uppercase tracking-widest px-1">{t('products.form_revenue_account')}</label>
                          <select required className="w-full px-8 py-4 bg-white border border-slate-100 rounded-[1.25rem] text-lg font-black appearance-none" value={formData.revenue_account_id} onChange={(e) => setFormData({ ...formData, revenue_account_id: e.target.value })}>
                            <option value="">{t('common.select_category')}</option>
                            {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-slate-400 mb-4 uppercase tracking-widest px-1">{t('products.form_cost_account')}</label>
                          <select required className="w-full px-8 py-4 bg-white border border-slate-100 rounded-[1.25rem] text-lg font-black appearance-none" value={formData.cost_account_id} onChange={(e) => setFormData({ ...formData, cost_account_id: e.target.value })}>
                            <option value="">{t('common.select_category')}</option>
                            {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>)}
                          </select>
                        </div>
                      </div>
                    </div>
                  </form>
                </div>
              </div>

              {editingProduct && (
                <div className="hidden lg:flex w-[450px] flex-col bg-slate-50 border-s border-white overflow-hidden">
                  <div className="p-8 border-b border-slate-100 bg-white/50 backdrop-blur-sm sticky top-0 z-10 text-right">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">Audit Trail</span>
                    <span className="font-black text-slate-900 text-lg">{t('common.activity_log')}</span>
                  </div>
                  <div className="flex-1 overflow-y-auto custom-scrollbar">
                    <InlineActivityLog category="products" documentId={editingProduct.id} />
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <PageActivityLog category="products" isOpen={isActivityLogOpen} onClose={() => setIsActivityLogOpen(false)} documentId={activityLogDocumentId} />

      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setIsDeleteModalOpen(false)} />
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative bg-white rounded-[2.5rem] p-10 max-w-md w-full shadow-2xl text-center border border-slate-100">
            <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-3xl flex items-center justify-center mx-auto mb-6"><Trash2 size={40} /></div>
            <h3 className="text-2xl font-black text-slate-900 mb-2">{t('common.delete')}؟</h3>
            <p className="text-slate-500 mb-8">{t('common.confirm_action')}</p>
            <div className="flex gap-4">
              <button onClick={() => setIsDeleteModalOpen(false)} className="flex-1 px-6 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold">{t('common.cancel')}</button>
              <button onClick={confirmDelete} className="flex-1 px-6 py-4 bg-rose-600 text-white rounded-2xl font-bold">{t('common.delete')}</button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};
