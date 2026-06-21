import React, { useState, useEffect } from 'react';
import { dbService } from '../services/dbService';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Edit2, Trash2, PieChart, Landmark, DollarSign, X, LayoutGrid, List } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNotification } from '../contexts/NotificationContext';
import { useViewPreference } from '../hooks/useViewPreference';

interface CostCenter {
  id: string;
  code: string;
  name: string;
  description: string;
  department_id: string | null;
  company_id: string;
  budget: number;
  currency: string;
  is_active: boolean;
}

interface Department {
  id: string;
  name: string;
}

export function CostCenters() {
  const { t, dir, language } = useLanguage();
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const [view, setView] = useViewPreference('cost_centers', 'card');
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCC, setEditingCC] = useState<CostCenter | null>(null);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    department_id: '' as string | null,
    budget: 0,
    currency: 'USD',
    is_active: true
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [ccs, depts] = await Promise.all([
        dbService.list<CostCenter>('cost_centers', user?.company_id || ''),
        dbService.list<Department>('departments', user?.company_id || '')
      ]);
      setCostCenters(ccs);
      setDepartments(depts);
    } catch (error) {
      showNotification('Failed to fetch data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const payload = {
      ...formData,
      department_id: formData.department_id || null,
      company_id: user.company_id
    };

    try {
      if (editingCC) {
        await dbService.update('cost_centers', editingCC.id, payload);
        showNotification(t('common.updated_successfully'), 'success');
      } else {
        await dbService.create('cost_centers', payload);
        showNotification(t('common.created_successfully'), 'success');
      }
      setIsModalOpen(false);
      setEditingCC(null);
      fetchData();
    } catch (error) {
      showNotification('Operation failed', 'error');
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
    }).format(amount);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto h-full flex flex-col overflow-hidden">
      <AnimatePresence mode="wait">
        {!isModalOpen ? (
          <motion.div
            key="list"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="flex-1 flex flex-col space-y-8 overflow-hidden"
          >
            <div className={`flex flex-col sm:flex-row items-center justify-between gap-4 mb-2 ${dir === 'rtl' ? 'text-right' : 'text-left'}`} dir={dir}>
              <div>
                <h1 className="text-2xl font-bold text-zinc-900">{t('cost_centers.title') || 'مراكز التكلفة'}</h1>
                <p className="text-zinc-500">{t('cost_centers.subtitle') || 'توزيع المصروفات والميزانيات على مراكز التكلفة'}</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex bg-zinc-100 p-1.5 rounded-2xl gap-1">
                  <button 
                    onClick={() => setView('card')} 
                    className={`p-2 rounded-xl transition-all ${view === 'card' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-700'}`}
                    title={language === 'ar' ? 'عرض كروت' : 'Cards View'}
                  >
                    <LayoutGrid size={18} />
                  </button>
                  <button 
                    onClick={() => setView('table')} 
                    className={`p-2 rounded-xl transition-all ${view === 'table' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-700'}`}
                    title={language === 'ar' ? 'عرض جدول' : 'Table View'}
                  >
                    <List size={18} />
                  </button>
                </div>

                <button
                  onClick={() => {
                    setEditingCC(null);
                    setFormData({
                      code: '',
                      name: '',
                      description: '',
                      department_id: null,
                      budget: 0,
                      currency: 'USD',
                      is_active: true
                    });
                    setIsModalOpen(true);
                  }}
                  className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/20"
                >
                  <Plus size={20} />
                  <span>{t('cost_centers.add') || 'إضافة مركز تكلفة'}</span>
                </button>
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center py-20">
                <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : view === 'table' ? (
              <div className="bg-white border border-zinc-200 rounded-3xl overflow-hidden shadow-sm" dir={dir}>
                <table className={`w-full ${dir === 'rtl' ? 'text-right' : 'text-left'} border-collapse`}>
                  <thead>
                    <tr className="bg-zinc-50 border-b border-zinc-200">
                      <th className="px-6 py-4 text-sm font-bold text-zinc-700">{t('cost_centers.code') || 'كود المركز'}</th>
                      <th className="px-6 py-4 text-sm font-bold text-zinc-700">{t('cost_centers.name') || 'الاسم'}</th>
                      <th className="px-6 py-4 text-sm font-bold text-zinc-700">{t('cost_centers.department') || 'الإدارة'}</th>
                      <th className="px-6 py-4 text-sm font-bold text-zinc-700">{t('cost_centers.budget') || 'الميزانية'}</th>
                      <th className="px-6 py-4 text-sm font-bold text-zinc-700">{t('common.status') || 'الحالة'}</th>
                      <th className={`px-6 py-4 text-sm font-bold text-zinc-700 ${dir === 'rtl' ? 'text-left' : 'text-right'}`}>{t('common.actions') || 'الإجراءات'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 font-medium text-zinc-700">
                    {costCenters.map((cc) => (
                      <tr 
                        key={cc.id}
                        onClick={() => {
                          setEditingCC(cc);
                          setFormData({
                            code: cc.code,
                            name: cc.name,
                            description: cc.description || '',
                            department_id: cc.department_id,
                            budget: cc.budget || 0,
                            currency: cc.currency || 'USD',
                            is_active: cc.is_active
                          });
                          setIsModalOpen(true);
                        }}
                        className="hover:bg-zinc-50/80 transition-colors group cursor-pointer"
                      >
                        <td className="px-6 py-4 font-mono font-bold text-emerald-600 text-sm">
                          {cc.code}
                        </td>
                        <td className="px-6 py-4 font-bold text-zinc-900">
                          {cc.name}
                        </td>
                        <td className="px-6 py-4 text-zinc-500">
                          {departments.find(d => d.id === cc.department_id)?.name || (language === 'ar' ? 'عام' : 'General')}
                        </td>
                        <td className="px-6 py-4 text-emerald-700 font-bold">
                          {formatCurrency(cc.budget, cc.currency)}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${cc.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-zinc-100 text-zinc-500'}`}>
                            {cc.is_active ? 'نشط' : 'معطل'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-left">
                          <div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingCC(cc);
                                setFormData({
                                  code: cc.code,
                                  name: cc.name,
                                  description: cc.description || '',
                                  department_id: cc.department_id,
                                  budget: cc.budget || 0,
                                  currency: cc.currency || 'USD',
                                  is_active: cc.is_active
                                });
                                setIsModalOpen(true);
                              }}
                              className="p-2 text-zinc-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (window.confirm(t('common.confirm_delete'))) {
                                  await dbService.delete('cost_centers', cc.id);
                                  fetchData();
                                }
                              }}
                              className="p-2 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 overflow-y-auto pr-1 ${dir === 'rtl' ? 'text-right' : 'text-left'}`} dir={dir}>
                {costCenters.map((cc) => (
                  <motion.div
                    key={cc.id}
                    layout
                    onClick={() => {
                      setEditingCC(cc);
                      setFormData({
                        code: cc.code,
                        name: cc.name,
                        description: cc.description || '',
                        department_id: cc.department_id,
                        budget: cc.budget || 0,
                        currency: cc.currency || 'USD',
                        is_active: cc.is_active
                      });
                      setIsModalOpen(true);
                    }}
                    className="bg-white border border-zinc-200 rounded-3xl p-6 hover:shadow-xl hover:shadow-zinc-200/50 transition-all group cursor-pointer"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600">
                        <PieChart size={24} />
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingCC(cc);
                            setFormData({
                              code: cc.code,
                              name: cc.name,
                              description: cc.description || '',
                              department_id: cc.department_id,
                              budget: cc.budget || 0,
                              currency: cc.currency || 'USD',
                              is_active: cc.is_active
                            });
                            setIsModalOpen(true);
                          }}
                          className="p-2 text-zinc-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (window.confirm(t('common.confirm_delete'))) {
                              await dbService.delete('cost_centers', cc.id);
                              fetchData();
                            }
                          }}
                          className="p-2 text-zinc-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    <div className={`${dir === 'rtl' ? 'text-right' : 'text-left'}`} dir={dir}>
                      <div className="text-[10px] font-mono text-amber-600 font-bold mb-1">{cc.code}</div>
                      <h3 className="font-bold text-lg text-zinc-900 mb-1">{cc.name}</h3>
                      
                      <div className="mt-4 space-y-3 pt-4 border-t border-zinc-50">
                        <div className="flex items-center justify-between text-xs text-zinc-500">
                          <span className="flex items-center gap-1">
                            <Landmark size={14} />
                            {t('cost_centers.department') || 'الإدارة المرتبطة'}
                          </span>
                          <span className="font-medium text-zinc-900">
                            {departments.find(d => d.id === cc.department_id)?.name || (language === 'ar' ? 'عام' : 'General')}
                          </span>
                        </div>
                        
                        <div className="bg-zinc-50 p-3 rounded-2xl">
                          <div className="text-[10px] text-zinc-400 mb-1">{t('cost_centers.budget') || 'الميزانية المعتمدة'}</div>
                          <div className="flex items-center gap-1 text-emerald-700 font-bold">
                            <DollarSign size={14} />
                            {formatCurrency(cc.budget, cc.currency)}
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-xs">
                          <span>{t('common.status') || 'الحالة'}</span>
                          <span className={`px-2 py-0.5 rounded-full font-bold ${cc.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-zinc-100 text-zinc-500'}`}>
                            {cc.is_active ? (language === 'ar' ? 'نشط' : 'Active') : (language === 'ar' ? 'معطل' : 'Inactive')}
                          </span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="form"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex-1 flex flex-col space-y-8 overflow-hidden max-w-4xl mx-auto w-full p-4"
          >
            <div className="bg-white flex-1 rounded-3xl shadow-xl shadow-slate-200/40 flex flex-col overflow-hidden border border-slate-100 transition-all duration-500">
              <div className="p-6 border-b border-zinc-100 flex items-center justify-between bg-slate-50/50">
                <h2 className="text-xl font-bold text-zinc-900">
                  {editingCC ? (t('cost_centers.edit') || 'تعديل مركز التكلفة') : (t('cost_centers.add_new') || 'إضافة مركز تكلفة جديد')}
                </h2>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="text-slate-400 hover:text-slate-900 p-2 hover:bg-slate-100 rounded-full transition-all"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6">
                <form onSubmit={handleSubmit} className={`space-y-6 ${dir === 'rtl' ? 'text-right' : 'text-left'}`} dir={dir}>
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-semibold text-zinc-700 mb-2">{t('cost_centers.code') || 'كود المركز'}</label>
                      <input
                        type="text"
                        required
                        value={formData.code}
                        onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                        className="w-full p-4 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-mono font-bold"
                        placeholder="CC-400"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-zinc-700 mb-2">{t('cost_centers.name') || 'اسم المركز'}</label>
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                        className="w-full p-4 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-bold"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-semibold text-zinc-700 mb-2">{t('cost_centers.budget') || 'الميزانية'}</label>
                      <input
                        type="number"
                        value={formData.budget}
                        onChange={e => setFormData({ ...formData, budget: parseFloat(e.target.value) || 0 })}
                        className="w-full p-4 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-zinc-700 mb-2">{language === 'ar' ? 'العملة' : 'Currency'}</label>
                      <select
                        value={formData.currency}
                        onChange={e => setFormData({ ...formData, currency: e.target.value })}
                        className="w-full p-4 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-bold"
                      >
                        <option value="USD">USD</option>
                        <option value="">--</option>
                        <option value="EGP">EGP</option>
                        <option value="AED">AED</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-zinc-700 mb-2">{t('cost_centers.department') || 'الإدارة المسؤولة'}</label>
                    <select
                      value={formData.department_id || ''}
                      onChange={e => setFormData({ ...formData, department_id: e.target.value || null })}
                      className="w-full p-4 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-bold"
                    >
                      <option value="">{language === 'ar' ? 'عام (لكافة الإدارات)' : 'General (All Departments)'}</option>
                      {departments.map(dept => (
                        <option key={dept.id} value={dept.id}>{dept.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-zinc-700 mb-2">{t('common.description') || 'الوصف'}</label>
                    <textarea
                      value={formData.description}
                      onChange={e => setFormData({ ...formData, description: e.target.value })}
                      rows={3}
                      className="w-full p-4 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all"
                    />
                  </div>

                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={formData.is_active}
                        onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                        className="w-5 h-5 rounded-lg border-zinc-300 text-emerald-600 focus:ring-emerald-500 transition-all"
                      />
                      <span className="text-zinc-700 font-bold">{t('common.active') || (language === 'ar' ? 'نشط' : 'Active')}</span>
                    </label>
                  </div>

                  <div className="flex items-center gap-4 pt-4 border-t border-zinc-100">
                    <button
                      type="submit"
                      className="flex-1 bg-emerald-600 text-white h-12 rounded-2xl font-bold hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/20"
                    >
                      {t('common.save')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="flex-1 bg-zinc-100 text-zinc-600 h-12 rounded-2xl font-bold hover:bg-zinc-200 transition-colors"
                    >
                      {t('common.cancel')}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
