import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { Warehouse, Product, WarehouseTransfer, WarehouseTransferItem } from '../types';
import { 
  Search, Plus, Trash2, X, ArrowLeftRight, Pencil, 
  Download, Eye, FileText, History, Printer, 
  Home, Calendar, Hash, Layers, Save,
  Maximize2, Minimize2, ChevronRight, ChevronLeft, RotateCcw, User, LayoutGrid, List
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { dbService } from '../services/dbService';
import { formatNumber, formatDate } from '../utils/formatUtils';
import { useLanguage } from '../contexts/LanguageContext';
import { PaginationControls } from '../components/PaginationControls';

interface TransferItemInput {
  product_id: string;
  quantity: number;
}

export const WarehouseTransfers: React.FC = () => {
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const { t, dir, language } = useLanguage();

  // Data states
  const [transfers, setTransfers] = useState<WarehouseTransfer[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter/Pagination states
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [filterFromWh, setFilterFromWh] = useState('');
  const [filterToWh, setFilterToWh] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');
  const [totalRecords, setTotalRecords] = useState(0);

  // UI state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTransfer, setEditingTransfer] = useState<WarehouseTransfer | null>(null);
  const [viewTransfer, setViewTransfer] = useState<WarehouseTransfer | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [transferToDelete, setTransferToDelete] = useState<string | null>(null);
  const [view, setView] = useState<'table' | 'card'>('table');
  const [isFullScreen, setIsFullScreen] = useState(false);

  // Form states
  const [formData, setFormData] = useState({
    date: new Date().toISOString().slice(0, 10),
    from_warehouse_id: '',
    to_warehouse_id: '',
    description: ''
  });
  const [items, setItems] = useState<TransferItemInput[]>([]);

  // Subscriptions
  useEffect(() => {
    if (user) {
      const filters = {
        company_id: user.company_id,
        _page: page,
        _limit: limit,
        _sortBy: sortBy,
        _sortOrder: sortOrder,
        _search: searchTerm,
        ...(dateFrom && { date_from: dateFrom }),
        ...(dateTo && { date_to: dateTo }),
        ...(filterFromWh && { from_warehouse_id: filterFromWh }),
        ...(filterToWh && { to_warehouse_id: filterToWh }),
      };

      const unsubTransfers = dbService.subscribePaginated('warehouse_transfers', filters, (result: any) => {
        setTransfers(result.data || []);
        setTotalRecords(result.total || 0);
        setLoading(false);
      });

      const unsubWarehouses = dbService.subscribe<Warehouse>('warehouses', user.company_id, setWarehouses);
      
      const unsubProducts = dbService.subscribe<Product>('products', user.company_id, (data) => {
        // Exclude service products (non-physical)
        setProducts((data || []).filter(p => p.type !== 'service'));
      });

      return () => {
        unsubTransfers();
        unsubWarehouses();
        unsubProducts();
      };
    }
  }, [user, page, limit, sortBy, sortOrder, searchTerm, dateFrom, dateTo, filterFromWh, filterToWh]);

  // Reset form
  const resetForm = () => {
    setFormData({
      date: new Date().toISOString().slice(0, 10),
      from_warehouse_id: '',
      to_warehouse_id: '',
      description: ''
    });
    setItems([]);
    setEditingTransfer(null);
  };

  const handleOpenCreateModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const handleOpenEditModal = async (transfer: WarehouseTransfer) => {
    try {
      const fullTransfer = await dbService.get<any>('warehouse_transfers', transfer.id);
      if (fullTransfer) {
        setEditingTransfer(fullTransfer);
        setFormData({
          date: fullTransfer.date ? fullTransfer.date.slice(0, 10) : new Date().toISOString().slice(0, 10),
          from_warehouse_id: fullTransfer.from_warehouse_id,
          to_warehouse_id: fullTransfer.to_warehouse_id,
          description: fullTransfer.description || ''
        });
        setItems(
          (fullTransfer.items || []).map((item: WarehouseTransferItem) => ({
            product_id: item.product_id,
            quantity: Number(item.quantity)
          }))
        );
        setIsModalOpen(true);
      } else {
        showNotification(language === 'ar' ? 'عذراً، تعذر العثور على تفاصيل عملية التحويل' : 'Failed to retrieve transfer details', 'error');
      }
    } catch (e: any) {
      showNotification(e.message || 'Error loading transfer details', 'error');
    }
  };

  const handleOpenViewModal = async (transfer: WarehouseTransfer) => {
    try {
      const fullTransfer = await dbService.get<any>('warehouse_transfers', transfer.id);
      if (fullTransfer) {
        setViewTransfer(fullTransfer);
      } else {
        showNotification(language === 'ar' ? 'عذراً، تعذر العثور على تفاصيل عملية التحويل' : 'Failed to retrieve transfer details', 'error');
      }
    } catch (e: any) {
      showNotification(e.message || 'Error loading transfer details', 'error');
    }
  };

  const handleOpenDeleteModal = (id: string) => {
    setTransferToDelete(id);
    setIsDeleteModalOpen(true);
  };

  // Item helpers
  const handleAddItemRow = () => {
    setItems([...items, { product_id: '', quantity: 1 }]);
  };

  const handleRemoveItemRow = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: keyof TransferItemInput, value: any) => {
    const updated = [...items];
    updated[index] = {
      ...updated[index],
      [field]: value
    };
    setItems(updated);
  };

  // Submit handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!formData.from_warehouse_id || !formData.to_warehouse_id) {
      showNotification(language === 'ar' ? 'يرجى اختيار المخزن المحول منه والمحول إليه' : 'Please select both source and destination warehouses', 'warning');
      return;
    }

    if (formData.from_warehouse_id === formData.to_warehouse_id) {
      showNotification(t('warehouse_transfers.same_warehouse_error') || 'Source and destination warehouses cannot be the same', 'warning');
      return;
    }

    if (items.length === 0) {
      showNotification(language === 'ar' ? 'يجب إضافة صنف واحد على الأكثر لإتمام عملية التحويل' : 'Please add at least one item to transfer', 'warning');
      return;
    }

    // Validate items
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.product_id) {
        showNotification(language === 'ar' ? 'يرجى اختيار صنف صحيح في السطر ' + (i + 1) : 'Please select a valid product on line ' + (i + 1), 'warning');
        return;
      }
      if (item.quantity <= 0) {
        showNotification(language === 'ar' ? 'يرجى إدخال كمية أكبر من صفر في السطر ' + (i + 1) : 'Quantity must be greater than 0 on line ' + (i + 1), 'warning');
        return;
      }
    }

    const payload = {
      date: formData.date,
      from_warehouse_id: formData.from_warehouse_id,
      to_warehouse_id: formData.to_warehouse_id,
      description: formData.description,
      items: items
    };

    try {
      if (editingTransfer) {
        await dbService.update('warehouse_transfers', editingTransfer.id, payload);
        showNotification(language === 'ar' ? 'تم تعديل التحويل بنجاح' : 'Transfer updated successfully', 'success');
      } else {
        await dbService.add('warehouse_transfers', payload);
        showNotification(language === 'ar' ? 'تم تسجيل عملية التحويل بنجاح' : 'Transfer created successfully', 'success');
      }
      setIsModalOpen(false);
      resetForm();
    } catch (error: any) {
      showNotification(error.message || 'Error processing transfer', 'error');
    }
  };

  const handleDelete = async () => {
    if (!transferToDelete || !user) return;
    try {
      await dbService.delete('warehouse_transfers', transferToDelete);
      showNotification(language === 'ar' ? 'تم حذف عملية التحويل بنجاح' : 'Transfer deleted successfully', 'success');
      setIsDeleteModalOpen(false);
      setTransferToDelete(null);
    } catch (error: any) {
      showNotification(error.message || 'Error deleting transfer', 'error');
    }
  };

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC');
    } else {
      setSortBy(field);
      setSortOrder('DESC');
    }
    setPage(1);
  };

  return (
    <div className={`p-6 space-y-6 ${dir === 'rtl' ? 'rtl' : 'ltr'}`} dir={dir}>
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white/60 backdrop-blur-xl p-6 rounded-[2rem] border border-white/20 shadow-xl">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
            <ArrowLeftRight className="text-emerald-500" size={32} />
            {t('warehouse_transfers.title')}
          </h1>
          <p className="text-slate-500 font-bold mt-1 text-sm">{t('warehouse_transfers.subtitle')}</p>
        </div>
        <button
          onClick={handleOpenCreateModal}
          className="flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-[1.5rem] font-black text-base hover:shadow-lg hover:shadow-emerald-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
        >
          <Plus size={20} />
          {t('warehouse_transfers.add')}
        </button>
      </div>

      {/* Filter and search bar */}
      <div className="bg-white/60 backdrop-blur-xl p-6 rounded-[2rem] border border-white/20 shadow-lg space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="relative col-span-1 md:col-span-2">
            <Search className={`absolute ${dir === 'rtl' ? 'right-4' : 'left-4'} top-4 text-slate-400`} size={20} />
            <input
              type="text"
              placeholder={t('warehouse_transfers.search_placeholder')}
              className={`w-full ${dir === 'rtl' ? 'pr-12 pl-4' : 'pl-12 pr-4'} py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none text-slate-700 font-bold focus:bg-white focus:ring-4 focus:ring-emerald-500/5 transition-all`}
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
            />
          </div>
          
          <div>
            <input
              type="date"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none text-slate-700 font-bold focus:bg-white focus:ring-4 focus:ring-emerald-500/5 transition-all"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
            />
          </div>

          <div>
            <input
              type="date"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none text-slate-700 font-bold focus:bg-white focus:ring-4 focus:ring-emerald-500/5 transition-all"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
            />
          </div>

          <div className="flex gap-2">
            <select
              className="w-1/2 px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none text-slate-700 font-bold focus:bg-white focus:ring-4 focus:ring-emerald-500/5 transition-all"
              value={filterFromWh}
              onChange={(e) => { setFilterFromWh(e.target.value); setPage(1); }}
            >
              <option value="">{language === 'ar' ? 'من مخزن...' : 'From warehouse...'}</option>
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
            <select
              className="w-1/2 px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none text-slate-700 font-bold focus:bg-white focus:ring-4 focus:ring-emerald-500/5 transition-all"
              value={filterToWh}
              onChange={(e) => { setFilterToWh(e.target.value); setPage(1); }}
            >
              <option value="">{language === 'ar' ? 'إلى مخزن...' : 'To warehouse...'}</option>
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Main Table / Grid representation */}
      {loading ? (
        <div className="flex items-center justify-center h-64 bg-white/40 backdrop-blur-xl rounded-[2rem] border border-white/10 shadow-xl">
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-slate-500 font-bold">{t('common.loading')}</p>
          </div>
        </div>
      ) : transfers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white/40 backdrop-blur-xl rounded-[2rem] border border-white/10 shadow-xl text-center space-y-4">
          <div className="w-20 h-20 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center">
            <ArrowLeftRight size={40} />
          </div>
          <div>
            <h3 className="text-xl font-black text-slate-700">{t('common.no_data')}</h3>
            <p className="text-slate-400 font-bold mt-1 text-sm">
              {language === 'ar' ? 'لم يتم العثور على أي عمليات تحويل مخزني مطابقة.' : 'No warehouse transfers found.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-white/60 backdrop-blur-xl rounded-[2rem] border border-white/20 shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-right">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-100">
                  <th 
                    onClick={() => handleSort('transfer_number')}
                    className="px-6 py-5 text-sm font-black text-slate-600 uppercase cursor-pointer hover:text-emerald-600 transition-colors"
                  >
                    {t('warehouse_transfers.column_number')}
                  </th>
                  <th 
                    onClick={() => handleSort('date')}
                    className="px-6 py-5 text-sm font-black text-slate-600 uppercase cursor-pointer hover:text-emerald-600 transition-colors"
                  >
                    {t('warehouse_transfers.column_date')}
                  </th>
                  <th className="px-6 py-5 text-sm font-black text-slate-600 uppercase">
                    {t('warehouse_transfers.column_from_warehouse')}
                  </th>
                  <th className="px-6 py-5 text-sm font-black text-slate-600 uppercase">
                    {t('warehouse_transfers.column_to_warehouse')}
                  </th>
                  <th className="px-6 py-5 text-sm font-black text-slate-600 uppercase">
                    {t('warehouse_transfers.column_items_count')}
                  </th>
                  <th className="px-6 py-5 text-sm font-black text-slate-600 uppercase">
                    {language === 'ar' ? 'البيان' : 'Description'}
                  </th>
                  <th className="px-6 py-5 text-sm font-black text-slate-600 uppercase text-center w-36">
                    {t('common.actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transfers.map((tItem) => (
                  <tr key={tItem.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-5 text-base font-black text-slate-800 tracking-wider">
                      {tItem.transfer_number}
                    </td>
                    <td className="px-6 py-5 text-sm font-bold text-slate-500">
                      {formatDate(tItem.date)}
                    </td>
                    <td className="px-6 py-5 text-base font-black text-rose-600">
                      {tItem.from_warehouse_name}
                    </td>
                    <td className="px-6 py-5 text-base font-black text-emerald-600">
                      {tItem.to_warehouse_name}
                    </td>
                    <td className="px-6 py-5 text-sm font-black text-slate-700">
                      {(tItem as any).items_count || 1}
                    </td>
                    <td className="px-6 py-5 text-sm font-bold text-slate-500 max-w-[200px] truncate">
                      {tItem.description || '-'}
                    </td>
                    <td className="px-6 py-5 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleOpenViewModal(tItem)}
                          title={language === 'ar' ? 'عرض التفاصيل' : 'View details'}
                          className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                        >
                          <Eye size={18} />
                        </button>
                        <button
                          onClick={() => handleOpenEditModal(tItem)}
                          title={language === 'ar' ? 'تعديل' : 'Edit'}
                          className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
                        >
                          <Pencil size={18} />
                        </button>
                        <button
                          onClick={() => handleOpenDeleteModal(tItem.id)}
                          title={language === 'ar' ? 'حذف' : 'Delete'}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Pagination Controls */}
          {totalRecords > limit && (
            <div className="p-6 border-t border-slate-100">
              <PaginationControls
                page={page}
                limit={limit}
                total={totalRecords}
                onPageChange={setPage}
                onLimitChange={setLimit}
              />
            </div>
          )}
        </div>
      )}

      {/* Create / Edit Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4 bg-slate-900/60 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-[2.5rem] border border-slate-100 shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between p-6 bg-slate-50 border-b border-slate-100">
                <div>
                  <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                    <ArrowLeftRight className="text-emerald-500" size={24} />
                    {editingTransfer ? t('warehouse_transfers.edit') : t('warehouse_transfers.add')}
                  </h2>
                  <p className="text-slate-400 font-bold text-xs mt-0.5">
                    {editingTransfer ? (language === 'ar' ? 'تعديل تفاصيل التحويل المخزني رقم ' + editingTransfer.transfer_number : 'Modify details of transfer #' + editingTransfer.transfer_number) : (language === 'ar' ? 'إنشاء عملية تحويل جديدة' : 'Create a new warehouse transfer')}
                  </p>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-3 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Modal Body */}
              <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Date Input */}
                  <div className="space-y-2">
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest px-1">
                      {t('warehouse_transfers.form_date')} <span className="text-rose-500 font-bold">*</span>
                    </label>
                    <div className="relative group">
                      <Calendar className="absolute right-4 top-3 text-slate-400" size={20} />
                      <input
                        required
                        type="date"
                        className="w-full pr-12 pl-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none text-slate-800 font-bold focus:bg-white focus:ring-4 focus:ring-emerald-500/5 transition-all shadow-inner"
                        value={formData.date}
                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* From Warehouse */}
                  <div className="space-y-2">
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest px-1">
                      {t('warehouse_transfers.form_from_warehouse')} <span className="text-rose-500 font-bold">*</span>
                    </label>
                    <div className="relative group">
                      <Home className="absolute right-4 top-3 text-rose-500" size={20} />
                      <select
                        required
                        className="w-full pr-12 pl-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none text-slate-800 font-bold appearance-none focus:bg-white focus:ring-4 focus:ring-emerald-500/5 transition-all shadow-inner"
                        value={formData.from_warehouse_id}
                        onChange={(e) => setFormData({ ...formData, from_warehouse_id: e.target.value })}
                      >
                        <option value="">{t('common.select_category')}</option>
                        {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* To Warehouse */}
                  <div className="space-y-2">
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest px-1">
                      {t('warehouse_transfers.form_to_warehouse')} <span className="text-rose-500 font-bold">*</span>
                    </label>
                    <div className="relative group">
                      <Home className="absolute right-4 top-3 text-emerald-500" size={20} />
                      <select
                        required
                        className="w-full pr-12 pl-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none text-slate-800 font-bold appearance-none focus:bg-white focus:ring-4 focus:ring-emerald-500/5 transition-all shadow-inner"
                        value={formData.to_warehouse_id}
                        onChange={(e) => setFormData({ ...formData, to_warehouse_id: e.target.value })}
                      >
                        <option value="">{t('common.select_category')}</option>
                        {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Description input */}
                <div className="space-y-2">
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest px-1">
                    {language === 'ar' ? 'ملاحظات / بيان' : 'Notes / Remarks'}
                  </label>
                  <textarea
                    rows={2}
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none text-slate-800 font-bold focus:bg-white focus:ring-4 focus:ring-emerald-500/5 transition-all shadow-inner"
                    placeholder={language === 'ar' ? 'اكتب أي ملاحظات إضافية هنا...' : 'Write any additional notes here...'}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>

                {/* Items Section */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <h3 className="text-lg font-black text-slate-700 flex items-center gap-2">
                      <Layers size={18} className="text-emerald-500" />
                      {t('warehouse_transfers.form_items')}
                    </h3>
                    <button
                      type="button"
                      onClick={handleAddItemRow}
                      className="flex items-center gap-1.5 px-4 py-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 font-bold text-sm rounded-xl transition-all"
                    >
                      <Plus size={16} />
                      {language === 'ar' ? 'إضافة صنف' : 'Add Item'}
                    </button>
                  </div>

                  {items.length === 0 ? (
                    <div className="text-center py-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                      <p className="text-slate-400 font-bold text-sm">
                        {language === 'ar' ? 'لا يوجد أي أصناف مضافة. انقر فوق إضافة صنف للبدء.' : 'No items added. Click Add Item to start.'}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {items.map((item, index) => {
                        const product = products.find(p => p.id === item.product_id);
                        return (
                          <div 
                            key={index}
                            className="flex flex-col md:flex-row gap-3 p-4 bg-slate-50/75 rounded-2xl border border-slate-100 items-start md:items-center group"
                          >
                            <div className="w-8 h-8 rounded-full bg-slate-200 font-black text-slate-500 text-sm flex items-center justify-center shrink-0">
                              {index + 1}
                            </div>

                            {/* Product Selector */}
                            <div className="flex-1 w-full">
                              <select
                                required
                                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl outline-none font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 transition-all appearance-none"
                                value={item.product_id}
                                onChange={(e) => handleItemChange(index, 'product_id', e.target.value)}
                              >
                                <option value="">{language === 'ar' ? 'اختر صنف مخزني...' : 'Select product...'}</option>
                                {products.map(p => (
                                  <option key={p.id} value={p.id}>
                                    {p.code} - {p.name} {p.stock !== undefined ? `(رصيد: ${p.stock})` : ''}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* Quantity Input */}
                            <div className="w-full md:w-36 flex items-center bg-white border border-slate-200 rounded-xl px-3 shrink-0">
                              <input
                                required
                                type="number"
                                min={0.01}
                                step="any"
                                placeholder={language === 'ar' ? 'الكمية' : 'Qty'}
                                className="w-full py-3 outline-none font-black text-slate-800"
                                value={item.quantity || ''}
                                onChange={(e) => handleItemChange(index, 'quantity', parseFloat(e.target.value) || 0)}
                              />
                              {product?.unit && (
                                <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md shrink-0">
                                  {product.unit}
                                </span>
                              )}
                            </div>

                            {/* Remove action */}
                            <button
                              type="button"
                              onClick={() => handleRemoveItemRow(index)}
                              className="p-3 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all self-end md:self-auto"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Modal Footer Buttons */}
                <div className="flex items-center justify-end gap-3 pt-6 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-6 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-black rounded-xl text-base transition-all"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="submit"
                    className="flex items-center justify-center gap-2 px-8 py-3.5 bg-emerald-500 hover:bg-emerald-600 text-white font-black rounded-xl text-base transition-all shadow-md shadow-emerald-500/10"
                  >
                    <Save size={18} />
                    {t('common.save')}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* View Modal */}
      <AnimatePresence>
        {viewTransfer && (
          <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4 bg-slate-900/60 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-[2.5rem] border border-slate-100 shadow-2xl w-full max-w-3xl overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-6 bg-slate-50 border-b border-slate-100">
                <div>
                  <span className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full font-black text-xs uppercase tracking-wider">
                    {language === 'ar' ? 'سند تحويل مخزني' : 'Warehouse Transfer Document'}
                  </span>
                  <h2 className="text-2xl font-black text-slate-800 mt-2 flex items-center gap-2">
                    <ArrowLeftRight size={22} className="text-emerald-500" />
                    {viewTransfer.transfer_number}
                  </h2>
                </div>
                <button
                  onClick={() => setViewTransfer(null)}
                  className="p-3 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Document Details */}
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-5 bg-slate-50 rounded-2xl">
                  <div>
                    <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('warehouse_transfers.column_date')}</span>
                    <span className="text-slate-700 font-bold text-sm block mt-1">{formatDate(viewTransfer.date)}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('warehouse_transfers.column_from_warehouse')}</span>
                    <span className="text-rose-600 font-black text-base block mt-1">{viewTransfer.from_warehouse_name}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('warehouse_transfers.column_to_warehouse')}</span>
                    <span className="text-emerald-600 font-black text-base block mt-1">{viewTransfer.to_warehouse_name}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">{language === 'ar' ? 'بواسطة' : 'Created By'}</span>
                    <span className="text-slate-700 font-bold text-sm block mt-1">{viewTransfer.created_by || '-'}</span>
                  </div>
                </div>

                {viewTransfer.description && (
                  <div className="space-y-1">
                    <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">{language === 'ar' ? 'ملاحظات / بيان' : 'Notes'}</span>
                    <p className="text-slate-600 font-bold text-sm bg-slate-50/50 p-4 rounded-xl border border-slate-100">{viewTransfer.description}</p>
                  </div>
                )}

                {/* Items Grid */}
                <div className="space-y-3">
                  <h3 className="text-base font-black text-slate-700">{language === 'ar' ? 'تفاصيل الأصناف المحولة' : 'Transferred Items'}</h3>
                  <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-inner">
                    <table className="w-full border-collapse text-right text-sm">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100">
                          <th className="px-4 py-3 font-black text-slate-500 uppercase">{language === 'ar' ? 'كود الصنف' : 'Code'}</th>
                          <th className="px-4 py-3 font-black text-slate-500 uppercase">{language === 'ar' ? 'اسم الصنف' : 'Product Name'}</th>
                          <th className="px-4 py-3 font-black text-slate-500 uppercase text-center">{language === 'ar' ? 'الكمية' : 'Qty'}</th>
                          <th className="px-4 py-3 font-black text-slate-500 uppercase">{language === 'ar' ? 'الوحدة' : 'Unit'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {((viewTransfer as any).items || []).map((item: WarehouseTransferItem) => {
                          const prod = products.find(p => p.id === item.product_id);
                          return (
                            <tr key={item.id} className="hover:bg-slate-50/20">
                              <td className="px-4 py-3.5 font-mono font-bold text-slate-600">{item.product_code || '-'}</td>
                              <td className="px-4 py-3.5 font-black text-slate-800">{item.product_name}</td>
                              <td className="px-4 py-3.5 font-black text-slate-700 text-center">{formatNumber(item.quantity)}</td>
                              <td className="px-4 py-3.5 font-bold text-slate-500">{prod?.unit || '-'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end p-6 border-t border-slate-100 bg-slate-50/50">
                <button
                  onClick={() => setViewTransfer(null)}
                  className="px-6 py-2.5 bg-slate-200 hover:bg-slate-300 font-black text-slate-700 rounded-xl transition-all"
                >
                  {t('common.close')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {isDeleteModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl border border-slate-100 shadow-2xl p-6 w-full max-w-md text-center space-y-6"
            >
              <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <Trash2 size={28} />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-black text-slate-800">{t('common.delete_confirm_title')}</h3>
                <p className="text-slate-400 font-bold text-sm">
                  {t('common.delete_confirm_msg')}
                </p>
              </div>
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="w-1/2 py-3 bg-slate-100 hover:bg-slate-200 font-black text-slate-600 rounded-xl transition-all"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={handleDelete}
                  className="w-1/2 py-3 bg-rose-500 hover:bg-rose-600 font-black text-white rounded-xl shadow-md shadow-rose-500/10 transition-all"
                >
                  {t('common.delete')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
