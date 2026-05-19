import React, { useState, useEffect } from 'react';
import { dbService } from '../services/dbService';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Edit2, Trash2, Users, Briefcase, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'react-hot-toast';

interface Department {
  id: string;
  code: string;
  name: string;
  description: string;
  parent_id: string | null;
  manager_user_id: string | null;
  company_id: string;
  is_active: boolean;
}

export function Departments() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [managerUsers, setManagerUsers] = useState<{id: string, name: string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    parent_id: '' as string | null,
    manager_user_id: '' as string | null,
    is_active: true
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [depts, users] = await Promise.all([
        dbService.list<Department>('departments', user?.company_id || ''),
        dbService.list<{id: string, name: string}>('users', user?.company_id || '')
      ]);
      setDepartments(depts);
      setManagerUsers(users);
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
      parent_id: formData.parent_id || null,
      manager_user_id: formData.manager_user_id || null,
      company_id: user.company_id
    };

    try {
      if (editingDept) {
        await dbService.update('departments', editingDept.id, payload);
        toast.success(t('common.updated_successfully'));
      } else {
        await dbService.create('departments', payload);
        toast.success(t('common.created_successfully'));
      }
      setIsModalOpen(false);
      setEditingDept(null);
      fetchData();
    } catch (error) {
      toast.error('Operation failed');
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">إدارة الإدارات</h1>
          <p className="text-zinc-500">الهيكل التنظيمي للشركة والإدارات المختلفة</p>
        </div>
        <button
          onClick={() => {
            setEditingDept(null);
            setFormData({
              code: '',
              name: '',
              description: '',
              parent_id: null,
              manager_user_id: null,
              is_active: true
            });
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/20"
        >
          <Plus size={20} />
          <span>إضافة إدارة</span>
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {departments.map((dept) => (
            <motion.div
              key={dept.id}
              layout
              className="bg-white border border-zinc-200 rounded-3xl p-6 hover:shadow-xl hover:shadow-zinc-200/50 transition-all group"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600">
                  <Briefcase size={24} />
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => {
                      setEditingDept(dept);
                      setFormData({
                        code: dept.code,
                        name: dept.name,
                        description: dept.description || '',
                        parent_id: dept.parent_id,
                        manager_user_id: dept.manager_user_id,
                        is_active: dept.is_active
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
                        await dbService.delete('departments', dept.id);
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
                <div className="text-[10px] font-mono text-emerald-600 font-bold mb-1">{dept.code}</div>
                <h3 className="font-bold text-lg text-zinc-900 mb-1">{dept.name}</h3>
                {dept.description && (
                  <p className="text-zinc-500 text-sm mb-4 line-clamp-2">{dept.description}</p>
                )}
                
                <div className="space-y-2 pt-4 border-t border-zinc-50">
                  <div className="flex items-center justify-between text-xs text-zinc-500">
                    <span className="flex items-center gap-1">
                      <Users size={14} />
                      مدير الإدارة
                    </span>
                    <span className="font-medium text-zinc-900">
                      {managerUsers.find(u => u.id === dept.manager_user_id)?.name || 'غير محدد'}
                    </span>
                  </div>
                  {dept.parent_id && (
                    <div className="flex items-center justify-between text-xs text-zinc-500">
                      <span>إدارة عليا</span>
                      <span className="flex items-center gap-1 text-emerald-700 font-medium">
                        {departments.find(d => d.id === dept.parent_id)?.name}
                        <ChevronRight size={14} className="rotate-180" />
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-xs">
                    <span>الحالة</span>
                    <span className={`px-2 py-0.5 rounded-full font-bold ${dept.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-zinc-100 text-zinc-500'}`}>
                      {dept.is_active ? 'نشط' : 'معطل'}
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
                  {editingDept ? 'تعديل الإدارة' : 'إضافة إدارة جديدة'}
                </h2>
              </div>
              <form onSubmit={handleSubmit} className="p-6 space-y-4 text-right" dir="rtl">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1">كود الإدارة</label>
                    <input
                      type="text"
                      required
                      value={formData.code}
                      onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                      className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-mono font-bold"
                      placeholder="DEPT-01"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1">اسم الإدارة</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={e => setFormData({ ...formData, name: e.target.value })}
                      className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-bold"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">مدير الإدارة</label>
                  <select
                    value={formData.manager_user_id || ''}
                    onChange={e => setFormData({ ...formData, manager_user_id: e.target.value || null })}
                    className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-bold"
                  >
                    <option value="">اختر مديراً للمدير</option>
                    {managerUsers.map(user => (
                      <option key={user.id} value={user.id}>{user.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">الإدارة العليا (Parent)</label>
                  <select
                    value={formData.parent_id || ''}
                    onChange={e => setFormData({ ...formData, parent_id: e.target.value || null })}
                    className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  >
                    <option value="">لا يوجد (إدارة رئيسية)</option>
                    {departments.filter(d => d.id !== editingDept?.id).map(dept => (
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
                    <span className="text-zinc-700 font-bold">نشطة</span>
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
