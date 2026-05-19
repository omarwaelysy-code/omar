import React, { useState, useEffect } from 'react';
import { dbService } from '../services/dbService';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Edit2, Trash2, PieChart, Landmark, DollarSign } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'react-hot-toast';

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
  const { t } = useLanguage();
  const { user } = useAuth();
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
      toast.error('Failed to fetch data');
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
        toast.success(t('common.updated_successfully'));
      } else {
        await dbService.create('cost_centers', payload);
        toast.success(t('common.created_successfully'));
      }
      setIsModalOpen(false);
      setEditingCC(null);
      fetchData();
    } catch (error) {
      toast.error('Operation failed');
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
    }).format(amount);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">مراكز التكلفة</h1>
          <p className="text-zinc-500">توزيع المصروفات والميزانيات على مراكز التكلفة</p>
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
          <span>إضافة مركز تكلفة</span>
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {costCenters.map((cc) => (
            <motion.div
              key={cc.id}
              layout
              className="bg-white border border-zinc-200 rounded-3xl p-6 hover:shadow-xl hover:shadow-zinc-200/50 transition-all group"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600">
                  <PieChart size={24} />
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
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
                    className="p-2 text-zinc-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={async () => {
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

              <div className="text-right" dir="rtl">
                <div className="text-[10px] font-mono text-amber-600 font-bold mb-1">{cc.code}</div>
                <h3 className="font-bold text-lg text-zinc-900 mb-1">{cc.name}</h3>
                
                <div className="mt-4 space-y-3 pt-4 border-t border-zinc-50">
                  <div className="flex items-center justify-between text-xs text-zinc-500">
                    <span className="flex items-center gap-1">
                      <Landmark size={14} />
                      الإدارة المرتبطة
                    </span>
                    <span className="font-medium text-zinc-900">
                      {departments.find(d => d.id === cc.department_id)?.name || 'عام'}
                    </span>
                  </div>
                  
                  <div className="bg-zinc-50 p-3 rounded-2xl">
                    <div className="text-[10px] text-zinc-400 mb-1">الميزانية المعتمدة</div>
                    <div className="flex items-center gap-1 text-emerald-700 font-bold">
                      <DollarSign size={14} />
                      {formatCurrency(cc.budget, cc.currency)}
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span>الحالة</span>
                    <span className={`px-2 py-0.5 rounded-full font-bold ${cc.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-zinc-100 text-zinc-500'}`}>
                      {cc.is_active ? 'نشط' : 'معطل'}
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-zinc-100">
                <h2 className="text-xl font-bold text-zinc-900">
                  {editingCC ? 'تعديل مركز التكلفة' : 'إضافة مركز تكلفة جديد'}
                </h2>
              </div>
              <form onSubmit={handleSubmit} className="p-6 space-y-4 text-right" dir="rtl">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1">كود المركز</label>
                    <input
                      type="text"
                      required
                      value={formData.code}
                      onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                      className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-mono font-bold"
                      placeholder="CC-400"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1">اسم المركز</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={e => setFormData({ ...formData, name: e.target.value })}
                      className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1">الميزانية</label>
                    <input
                      type="number"
                      value={formData.budget}
                      onChange={e => setFormData({ ...formData, budget: parseFloat(e.target.value) || 0 })}
                      className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1">العملة</label>
                    <select
                      value={formData.currency}
                      onChange={e => setFormData({ ...formData, currency: e.target.value })}
                      className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-bold"
                    >
                      <option value="USD">USD</option>
                      <option value="">--</option>
                      <option value="EGP">EGP</option>
                      <option value="AED">AED</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">الإدارة المسؤولة</label>
                  <select
                    value={formData.department_id || ''}
                    onChange={e => setFormData({ ...formData, department_id: e.target.value || null })}
                    className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-bold"
                  >
                    <option value="">عام (لكافة الإدارات)</option>
                    {departments.map(dept => (
                      <option key={dept.id} value={dept.id}>{dept.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">الوصف</label>
                  <textarea
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
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
                    <span className="text-zinc-700 font-bold">نشط</span>
                  </label>
                </div>

                <div className="flex items-center gap-3 mt-8">
                  <button
                    type="submit"
                    className="flex-1 bg-emerald-600 text-white h-12 rounded-xl font-bold hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/20"
                  >
                    {t('common.save')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 bg-zinc-100 text-zinc-600 h-12 rounded-xl font-bold hover:bg-zinc-200 transition-colors"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
