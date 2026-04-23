import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { dbService } from '../services/dbService';
import { Company, User, ActivityLog } from '../types';
import { 
  Building2, 
  Users, 
  ShieldCheck, 
  CreditCard, 
  Plus, 
  Search, 
  MoreVertical,
  CheckCircle2,
  XCircle,
  AlertCircle,
  TrendingUp,
  Globe,
  RefreshCw,
  Edit2,
  Trash2,
  PauseCircle,
  PlayCircle,
  Calendar,
  Hash,
  Mail,
  Phone,
  Filter,
  History,
  ArrowLeftRight,
  Lock,
  Shield,
  Send,
  Key
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface SuperAdminDashboardProps {
  initialTab?: 'companies' | 'users' | 'logs';
}

export const SuperAdminDashboard: React.FC<SuperAdminDashboardProps> = ({ initialTab }) => {
  const { user, isSuperAdmin } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Set default tab to 'users' and implement minimal mode flag
  const minimalMode = true; 
  const [activeTab, setActiveTab] = useState<'companies' | 'users' | 'logs'>(initialTab || (minimalMode ? 'users' : 'companies'));
  
  const [showModal, setShowModal] = useState(false);
  const [showUserRoleModal, setShowUserRoleModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [formData, setFormData] = useState<Partial<Company>>({
    name: '',
    code: '',
    email: '',
    phone: '',
    users_limit: 5,
    transactions_limit: 1000,
    subscription_days: 30,
    subscription_plan: 'basic',
    company_status: 'active',
    subscription_status: 'active'
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [allCompanies, allUsers, allLogs] = await Promise.all([
        dbService.listAll<Company>('companies'),
        dbService.listAll<User>('users'),
        dbService.listAll<ActivityLog>('activity_logs')
      ]);
      
      const allowedActions = ['إضافة شركة جديدة', 'تعديل بيانات شركة', 'حذف شركة', 'إضافة مستخدم', 'حذف مستخدم'];
      const filteredLogs = allLogs.filter(log => allowedActions.includes(log.action));
      
      setCompanies(allCompanies);
      setUsers(allUsers);
      setLogs(filteredLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
    } catch (error) {
      console.error('Error fetching super admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const [showTempPasswordModal, setShowTempPasswordModal] = useState(false);
  const [tempPasswordData, setTempPasswordData] = useState<{ email: string, password: string } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [companyToDelete, setCompanyToDelete] = useState<string | null>(null);
  const [sendEmailOnCreate, setSendEmailOnCreate] = useState(true);

  const handleResendEmail = async (user: User) => {
    // Simulate sending email
    alert(`تم إرسال بيانات الدخول إلى ${user.email} بنجاح! \n\n (محاكاة: تم إرسال البريد الإلكتروني بنجاح)`);
    
    // Log the action
    await dbService.add('activity_logs', {
      user_id: 'system',
      username: 'Super Admin',
      company_id: user.company_id,
      timestamp: new Date().toISOString(),
      action: 'إعادة إرسال بريد الترحيب',
      details: `تم إعادة إرسال بيانات الدخول للمستخدم ${user.email}`
    });
  };

  const handleResetPassword = async (user: User) => {
    const newTempPassword = 'User@' + Math.floor(1000 + Math.random() * 9000);
    await dbService.update('users', user.id, {
      temp_password: newTempPassword,
      must_change_password: true
    });
    
    setTempPasswordData({ email: user.email || '', password: newTempPassword });
    setShowTempPasswordModal(true);
    
    // Log the action
    await dbService.add('activity_logs', {
      user_id: 'system',
      username: 'Super Admin',
      company_id: user.company_id,
      timestamp: new Date().toISOString(),
      action: 'إعادة تعيين كلمة المرور المؤقتة',
      details: `تم إنشاء كلمة مرور مؤقتة جديدة للمستخدم ${user.email}`
    });
    
    fetchData();
  };

  const getSubscriptionStatus = (company: Company) => {
    if (company.company_status === 'suspended') return { label: 'موقوف', color: 'bg-red-100 text-red-800', icon: XCircle };
    
    const now = new Date();
    const expiry = new Date(company.subscription_end || '');
    if (expiry < now) return { label: 'منتهي', color: 'bg-amber-100 text-amber-800', icon: AlertCircle };
    
    return { label: 'نشط', color: 'bg-emerald-100 text-emerald-800', icon: CheckCircle2 };
  };

  const stats = minimalMode ? [
    { label: 'إجمالي المستخدمين', value: users.length, icon: Users, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  ] : [
    { label: 'إجمالي الشركات', value: companies.length, icon: Building2, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'إجمالي المستخدمين', value: users.length, icon: Users, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'اشتراكات نشطة', value: companies.filter(c => getSubscriptionStatus(c).label === 'نشط').length, icon: ShieldCheck, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'اشتراكات منتهية', value: companies.filter(c => getSubscriptionStatus(c).label === 'منتهي').length, icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50' },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const now = new Date();
      const expiry = new Date();
      expiry.setDate(now.getDate() + (formData.subscription_days || 30));

      const companyData = {
        ...formData,
        subscription_start: now.toISOString(),
        subscription_end: expiry.toISOString(),
        subscription_expiry: expiry.toISOString(),
        created_at: now.toISOString(),
        settings: {
          currency: 'EGP',
          timezone: 'Africa/Cairo',
          language: 'ar',
          fiscal_year_start: '01-01'
        }
      };

      if (editingCompany) {
        await dbService.update('companies', editingCompany.id, companyData);
        if (user) {
          await dbService.logActivity(
            user.id,
            user.username,
            editingCompany.id,
            'تعديل بيانات شركة',
            `تعديل بيانات الشركة: ${companyData.name}`,
            'companies',
            editingCompany.id
          );
        }
      } else {
        const companyId = await dbService.add('companies', companyData);
        
        if (user) {
          await dbService.logActivity(
            user.id,
            user.username,
            companyId,
            'إضافة شركة جديدة',
            `إضافة شركة جديدة: ${companyData.name}`,
            'companies',
            companyId
          );
        }
        
        // Create initial admin user for the company
        const tempPassword = 'User@' + Math.floor(1000 + Math.random() * 9000);
        
        const cleanEmail = formData.email!.trim().toLowerCase();
        
        await fetch('/api/erp/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: cleanEmail,
            email: cleanEmail,
            password: tempPassword,
            company_id: companyId,
            role: 'admin'
          })
        });

        // Update user with temp_password and must_change_password
        // We need to find the user ID first
        const users = await dbService.query<User>('users', [{ field: 'email', operator: '==', value: cleanEmail }]);
        const newUser = users.find(u => u.company_id === companyId);
        if (newUser) {
          await dbService.update('users', newUser.id, {
            temp_password: tempPassword,
            must_change_password: true
          });
        }

        if (user) {
          await dbService.logActivity(
            user.id,
            user.username,
            companyId,
            'إضافة مستخدم',
            `إضافة مستخدم جديد (مدير شركة): ${cleanEmail}`,
            'users',
            newUser?.id || 'new_user'
          );
        }

        if (sendEmailOnCreate) {
          // Simulate sending email
          console.log(`Sending welcome email to ${formData.email} with password ${tempPassword}`);
        }

        setTempPasswordData({ email: formData.email || '', password: tempPassword });
        setShowTempPasswordModal(true);
      }
      
      const [allCompanies, allUsers] = await Promise.all([
        dbService.listAll<Company>('companies'),
        dbService.listAll<User>('users')
      ]);
      setCompanies(allCompanies);
      setUsers(allUsers);
      setShowModal(false);
      setEditingCompany(null);
      setFormData({
        name: '',
        code: '',
        email: '',
        phone: '',
        users_limit: 5,
        transactions_limit: 1000,
        subscription_days: 30,
        subscription_plan: 'basic',
        company_status: 'active',
        subscription_status: 'active'
      });
      alert('تم حفظ الشركة بنجاح');
    } catch (error: any) {
      console.error('Error saving company:', error);
      alert('حدث خطأ أثناء حفظ الشركة: ' + (error.message || 'خطأ غير معروف'));
    }
  };

  const toggleStatus = async (company: Company) => {
    const newStatus = company.company_status === 'active' ? 'suspended' : 'active';
    try {
      await dbService.update('companies', company.id, { 
        company_status: newStatus,
        subscription_status: newStatus === 'suspended' ? 'suspended' : 'active'
      });
      const allCompanies = await dbService.listAll<Company>('companies');
      setCompanies(allCompanies);
    } catch (error) {
      console.error('Error toggling status:', error);
    }
  };

  const deleteCompany = async (id: string) => {
    setCompanyToDelete(id);
    setShowDeleteConfirm(true);
  };

  const confirmDeleteCompany = async () => {
    if (!companyToDelete) return;
    try {
      // Delete associated users first
      const companyUsers = users.filter(u => u.company_id === companyToDelete);
      for (const u of companyUsers) {
        await dbService.delete('users', u.id);
      }

      const company = companies.find(c => c.id === companyToDelete);
      await dbService.delete('companies', companyToDelete);
      
      if (user && company) {
        await dbService.logActivity(
          user.id,
          user.username,
          companyToDelete,
          'حذف شركة',
          `حذف الشركة: ${company.name}`,
          'companies',
          companyToDelete
        );
      }
      
      const [allCompanies, allUsers] = await Promise.all([
        dbService.listAll<Company>('companies'),
        dbService.listAll<User>('users')
      ]);
      setCompanies(allCompanies);
      setUsers(allUsers);
      setShowDeleteConfirm(false);
      setCompanyToDelete(null);
    } catch (error) {
      console.error('Error deleting company:', error);
    }
  };

  const deleteUser = async (id: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا المستخدم؟')) return;
    try {
      const userToDeleteObj = users.find(u => u.id === id);
      await dbService.delete('users', id);
      
      if (user && userToDeleteObj) {
        await dbService.logActivity(
          user.id,
          user.username,
          userToDeleteObj.company_id || 'system',
          'حذف مستخدم',
          `حذف المستخدم: ${userToDeleteObj.username}`,
          'users',
          id
        );
      }
      
      const allUsers = await dbService.listAll<User>('users');
      setUsers(allUsers);
    } catch (error) {
      console.error('Error deleting user:', error);
    }
  };

  const updateUserRole = async (userId: string, newRole: 'admin' | 'user' | 'manager', companyId?: string) => {
    try {
      const updateData: any = { role: newRole };
      if (companyId) updateData.company_id = companyId;
      
      await dbService.update('users', userId, updateData);
      const allUsers = await dbService.listAll<User>('users');
      setUsers(allUsers);
      setShowUserRoleModal(false);
      setEditingUser(null);
    } catch (error) {
      console.error('Error updating user role:', error);
    }
  };

  const cleanupOrphanedUsers = async () => {
    const orphaned = users.filter(u => !(u.role === 'admin' && u.company_id === 'system') && (!u.company_id || !companies.find(c => c.id === u.company_id)));
    if (orphaned.length === 0) {
      alert('لا يوجد مستخدمين غير مرتبطين بشركات حالياً.');
      return;
    }
    
    if (!window.confirm(`هل أنت متأكد من حذف ${orphaned.length} مستخدم غير مرتبط بشركة؟`)) return;
    
    try {
      for (const u of orphaned) {
        await dbService.delete('users', u.id);
      }
      const allUsers = await dbService.listAll<User>('users');
      setUsers(allUsers);
      alert('تم تنظيف المستخدمين بنجاح.');
    } catch (error) {
      console.error('Error cleaning up users:', error);
    }
  };

  const renewSubscription = async (company: Company) => {
    try {
      const now = new Date();
      const expiry = new Date(company.subscription_end || now);
      if (expiry < now) expiry.setTime(now.getTime());
      expiry.setDate(expiry.getDate() + (company.subscription_days || 30));

      await dbService.update('companies', company.id, {
        subscription_end: expiry.toISOString(),
        subscription_expiry: expiry.toISOString(),
        subscription_status: 'active',
        company_status: 'active'
      });
      const allCompanies = await dbService.listAll<Company>('companies');
      setCompanies(allCompanies);
    } catch (error) {
      console.error('Error renewing subscription:', error);
    }
  };

  const filteredCompanies = companies.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!isSuperAdmin) {
    return (
      <div className="p-12 text-center space-y-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-50 text-red-500 mb-4">
          <Shield size={32} />
        </div>
        <h2 className="text-2xl font-bold text-stone-800">عذراً، لا تملك صلاحية الوصول</h2>
        <p className="text-stone-500">هذه الصفحة مخصصة للمدير العام فقط.</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">
            {minimalMode ? 'إدارة المستخدمين - المدير العام' : 'لوحة تحكم المدير العام'}
          </h1>
          <p className="text-stone-500">
            {minimalMode 
              ? 'إدارة مستخدمي النظام ومراجعة سلامة البيانات' 
              : 'إدارة الشركات والمستخدمين والاشتراكات عبر النظام بالكامل'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchData}
            disabled={loading}
            className="p-2 text-stone-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
            title="تحديث البيانات"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {!minimalMode && (
            <button 
              onClick={() => {
                setEditingCompany(null);
                setFormData({
                  name: '',
                  code: '',
                  email: '',
                  phone: '',
                  users_limit: 5,
                  transactions_limit: 1000,
                  subscription_days: 30,
                  subscription_plan: 'basic',
                  company_status: 'active',
                  subscription_status: 'active'
                });
                setShowModal(true);
              }}
              className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors shadow-sm"
            >
              <Plus className="w-5 h-5" />
              <span>إضافة شركة جديدة</span>
            </button>
          )}
        </div>
      </div>

      <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-${minimalMode ? '2' : '4'} gap-6`}>
        {stats.map((stat, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-white p-6 rounded-xl border border-stone-200 shadow-sm"
          >
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-lg ${stat.bg}`}>
                <stat.icon className={`w-6 h-6 ${stat.color}`} />
              </div>
              <div>
                <p className="text-sm text-stone-500">{stat.label}</p>
                <p className="text-2xl font-bold text-stone-800">{stat.value}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
        {!minimalMode && (
          <div className="border-b border-stone-200">
            <div className="flex p-1">
              <button
                onClick={() => setActiveTab('companies')}
                className={`flex-1 py-3 text-sm font-medium rounded-lg transition-colors ${
                  activeTab === 'companies' ? 'bg-stone-100 text-stone-900' : 'text-stone-500 hover:text-stone-700'
                }`}
              >
                الشركات
              </button>
              <button
                onClick={() => setActiveTab('users')}
                className={`flex-1 py-3 text-sm font-medium rounded-lg transition-colors ${
                  activeTab === 'users' ? 'bg-stone-100 text-stone-900' : 'text-stone-500 hover:text-stone-700'
                }`}
              >
                المستخدمين
              </button>
              <button
                onClick={() => setActiveTab('logs')}
                className={`flex-1 py-3 text-sm font-medium rounded-lg transition-colors ${
                  activeTab === 'logs' ? 'bg-stone-100 text-stone-900' : 'text-stone-500 hover:text-stone-700'
                }`}
              >
                سجل العمليات
              </button>
            </div>
          </div>
        )}

        <div className="p-4 border-b border-stone-200 bg-stone-50/50 flex justify-between items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
            <input
              type="text"
              placeholder="بحث عن شركة، كود، أو بريد إلكتروني..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pr-10 pl-4 py-2 bg-white border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>
          {activeTab === 'users' && (
            <button
              onClick={cleanupOrphanedUsers}
              className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors font-bold text-sm border border-red-100"
            >
              <Trash2 className="w-4 h-4" />
              <span>حذف المستخدمين غير المرتبطين بشركة</span>
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          {activeTab === 'companies' && (
            <table className="w-full text-right">
              <thead className="bg-stone-50 border-b border-stone-200">
                <tr>
                  <th className="px-6 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">الشركة</th>
                  <th className="px-6 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">الكود</th>
                  <th className="px-6 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">الحالة</th>
                  <th className="px-6 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">الاشتراك</th>
                  <th className="px-6 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">المستخدمين</th>
                  <th className="px-6 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">الحركات</th>
                  <th className="px-6 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200">
                {filteredCompanies.map((company) => (
                  <tr key={company.id} className="hover:bg-stone-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-stone-100 rounded-lg flex items-center justify-center">
                          <Building2 className="w-6 h-6 text-stone-400" />
                        </div>
                        <div>
                          <p className="font-medium text-stone-900">{company.name}</p>
                          <p className="text-xs text-stone-500">{company.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-stone-600">{company.code}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {(() => {
                        const status = getSubscriptionStatus(company);
                        return (
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${status.color}`}>
                            <status.icon className="w-3 h-3" />
                            {status.label}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm">
                        <p className="text-stone-900 font-medium">{company.subscription_plan === 'enterprise' ? 'مؤسسة' : company.subscription_plan === 'pro' ? 'احترافي' : 'أساسي'}</p>
                        <p className="text-xs text-stone-500">ينتهي: {company.subscription_end?.split('T')[0]}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-stone-600">{company.users_limit} مستخدم</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-stone-600">{company.transactions_limit} حركة</td>
                    <td className="px-6 py-4 whitespace-nowrap text-left">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => renewSubscription(company)}
                          className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                          title="تجديد الاشتراك"
                        >
                          <Calendar className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={() => toggleStatus(company)}
                          className={`p-2 rounded-lg transition-colors ${
                            company.company_status === 'active' ? 'text-amber-600 hover:bg-amber-50' : 'text-emerald-600 hover:bg-emerald-50'
                          }`}
                          title={company.company_status === 'active' ? 'إيقاف مؤقت' : 'تفعيل'}
                        >
                          {company.company_status === 'active' ? <PauseCircle className="w-5 h-5" /> : <PlayCircle className="w-5 h-5" />}
                        </button>
                        <button 
                          onClick={() => {
                            setEditingCompany(company);
                            setFormData({ ...company });
                            setShowModal(true);
                          }}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="تعديل"
                        >
                          <Edit2 className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={() => deleteCompany(company.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="حذف"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeTab === 'users' && (
            <div className="p-4 bg-stone-50 border-b border-stone-200 flex justify-between items-center">
              <h3 className="text-sm font-bold text-stone-600">إدارة المستخدمين</h3>
              <button
                onClick={cleanupOrphanedUsers}
                className="flex items-center gap-2 text-xs font-bold text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-all border border-red-100"
                title="حذف المستخدمين غير المرتبطين بشركة"
              >
                <Trash2 className="w-4 h-4" />
                <span>تنظيف المستخدمين اليتامى</span>
              </button>
            </div>
          )}
          {activeTab === 'users' && (
            <table className="w-full text-right">
              <thead className="bg-stone-50 border-b border-stone-200">
                <tr>
                  <th className="px-6 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">المستخدم</th>
                  <th className="px-6 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">الشركة</th>
                  <th className="px-6 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">الدور</th>
                  <th className="px-6 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">كلمة المرور المؤقتة</th>
                  <th className="px-6 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">الحالة</th>
                  <th className="px-6 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">تاريخ الانضمام</th>
                  <th className="px-6 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-stone-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-stone-100 rounded-full flex items-center justify-center">
                          <Users className="w-6 h-6 text-stone-400" />
                        </div>
                        <div>
                          <p className="font-medium text-stone-900">{u.username}</p>
                          <p className="text-xs text-stone-500">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-stone-600">
                      {companies.find(c => c.id === u.company_id)?.name || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        u.role === 'admin' && u.company_id === 'system' ? 'bg-purple-100 text-purple-800' :
                        u.role === 'admin' ? 'bg-blue-100 text-blue-800' :
                        u.role === 'manager' ? 'bg-amber-100 text-amber-800' :
                        'bg-stone-100 text-stone-800'
                      }`}>
                        {u.role === 'admin' && u.company_id === 'system' ? 'مدير عام' :
                         u.role === 'admin' ? 'مدير شركة' : u.role === 'manager' ? 'مشرف' : 'مستخدم'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {u.temp_password ? (
                        <code className="bg-amber-50 text-amber-700 px-2 py-1 rounded text-xs font-mono border border-amber-100">
                          {u.temp_password}
                        </code>
                      ) : (
                        <span className="text-xs text-stone-400">تم التغيير</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        u.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {u.status === 'active' ? 'نشط' : 'غير نشط'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-stone-600">{u.created_at?.split('T')[0] || 'N/A'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-left">
                      <div className="flex items-center justify-end gap-2">
                        {!(u.role === 'admin' && u.company_id === 'system') && (
                          <>
                            {u.temp_password && (
                              <button 
                                onClick={() => handleResendEmail(u)}
                                className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                title="إرسال بيانات الدخول"
                              >
                                <Send className="w-5 h-5" />
                              </button>
                            )}
                            <button 
                              onClick={() => handleResetPassword(u)}
                              className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                              title="إعادة تعيين كلمة المرور"
                            >
                              <Key className="w-5 h-5" />
                            </button>
                            <button 
                              onClick={() => {
                                setEditingUser(u);
                                setShowUserRoleModal(true);
                              }}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="تعديل الدور"
                            >
                              <Edit2 className="w-5 h-5" />
                            </button>
                            <button 
                              onClick={() => deleteUser(u.id)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="حذف"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeTab === 'logs' && (
            <div className="divide-y divide-stone-200">
              {logs.length === 0 ? (
                <div className="p-12 text-center text-stone-400">
                  <History className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  <p>لا توجد عمليات مسجلة حالياً</p>
                </div>
              ) : (
                logs.map((log) => (
                  <div key={log.id} className="p-4 hover:bg-stone-50 transition-colors flex items-start gap-4">
                    <div className={`p-2 rounded-lg ${
                      log.action.includes('حذف') ? 'bg-red-50 text-red-500' : 
                      log.action.includes('إضافة') ? 'bg-emerald-50 text-emerald-500' : 
                      'bg-blue-50 text-blue-500'
                    }`}>
                      <History className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-stone-900">{log.action}</p>
                          <span className="text-[10px] px-2 py-0.5 bg-stone-100 text-stone-600 rounded-full font-bold">
                            {companies.find(c => c.id === log.company_id)?.name || 'نظام'}
                          </span>
                        </div>
                        <span className="text-xs text-stone-400">{new Date(log.timestamp).toLocaleString('ar-EG')}</span>
                      </div>
                      <p className="text-sm text-stone-600 mt-1">{log.details}</p>
                      <div className="flex items-center gap-4 mt-2">
                        <span className="text-xs text-stone-400 flex items-center gap-1">
                          <Users className="w-3 h-3" /> {log.username}
                        </span>
                        <span className="text-xs text-stone-400 flex items-center gap-1">
                          <Hash className="w-3 h-3" /> {log.company_id}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Temporary Password Modal */}
      {showTempPasswordModal && tempPasswordData && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-zinc-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-8 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center text-white">
                <Lock size={24} />
              </div>
              <div>
                <h3 className="text-xl font-black text-zinc-900">تم إضافة الشركة بنجاح</h3>
                <p className="text-xs text-zinc-500 font-bold">يرجى تزويد المدير ببيانات الدخول التالية</p>
              </div>
            </div>

            <div className="space-y-4 mb-8">
              <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                <p className="text-[10px] text-zinc-400 font-bold uppercase mb-1">البريد الإلكتروني</p>
                <p className="font-mono font-bold text-zinc-900 select-all">{tempPasswordData.email}</p>
              </div>
              <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                <p className="text-[10px] text-zinc-400 font-bold uppercase mb-1">كلمة المرور المؤقتة</p>
                <p className="font-mono font-bold text-emerald-600 select-all">{tempPasswordData.password}</p>
              </div>
            </div>

            <button 
              onClick={() => setShowTempPasswordModal(false)}
              className="w-full py-4 bg-zinc-900 text-white rounded-2xl font-bold hover:bg-zinc-800 transition-all"
            >
              فهمت، إغلاق
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-zinc-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-8 animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-black text-zinc-900 mb-4">تأكيد حذف الشركة</h3>
            <p className="text-zinc-500 mb-8 font-bold">هل أنت متأكد من حذف هذه الشركة؟ سيتم حذف جميع البيانات المرتبطة بها بما في ذلك جميع المستخدمين. لا يمكن التراجع عن هذا الإجراء.</p>
            
            <div className="flex gap-4">
              <button 
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setCompanyToDelete(null);
                }}
                className="flex-1 py-4 bg-zinc-100 text-zinc-600 rounded-2xl font-bold hover:bg-zinc-200 transition-all"
              >
                إلغاء
              </button>
              <button 
                onClick={confirmDeleteCompany}
                className="flex-1 py-4 bg-red-500 text-white rounded-2xl font-bold hover:bg-red-600 transition-all shadow-lg shadow-red-500/20"
              >
                حذف نهائي
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Role Modal */}
      {showUserRoleModal && editingUser && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-zinc-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-8 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-blue-500 rounded-2xl flex items-center justify-center text-white">
                <Shield size={24} />
              </div>
              <div>
                <h3 className="text-xl font-black text-zinc-900">تعديل دور المستخدم</h3>
                <p className="text-xs text-zinc-500 font-bold">{editingUser.username}</p>
              </div>
            </div>

            <div className="space-y-4 mb-8">
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-400 uppercase">الشركة المرتبطة</label>
                <select
                  value={editingUser.company_id || ''}
                  onChange={(e) => setEditingUser({ ...editingUser, company_id: e.target.value })}
                  className="w-full p-4 bg-zinc-50 border border-zinc-100 rounded-2xl font-bold text-zinc-900 outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="">غير مرتبط بشركة</option>
                  {companies.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-400 uppercase">الدور الوظيفي</label>
                <div className="grid grid-cols-1 gap-3">
                  <button
                    onClick={() => updateUserRole(editingUser.id, 'admin', editingUser.company_id)}
                    className={`w-full p-4 rounded-2xl border-2 transition-all text-right flex items-center justify-between ${
                      editingUser.role === 'admin' ? 'border-emerald-500 bg-emerald-50' : 'border-zinc-100 hover:border-zinc-200'
                    }`}
                  >
                    <div>
                      <p className="font-bold text-zinc-900">مدير</p>
                      <p className="text-xs text-zinc-500">صلاحيات كاملة داخل الشركة</p>
                    </div>
                    {editingUser.role === 'admin' && <CheckCircle2 className="text-emerald-500" />}
                  </button>

                  <button
                    onClick={() => updateUserRole(editingUser.id, 'manager', editingUser.company_id)}
                    className={`w-full p-4 rounded-2xl border-2 transition-all text-right flex items-center justify-between ${
                      editingUser.role === 'manager' ? 'border-emerald-500 bg-emerald-50' : 'border-zinc-100 hover:border-zinc-200'
                    }`}
                  >
                    <div>
                      <p className="font-bold text-zinc-900">مشرف</p>
                      <p className="text-xs text-zinc-500">صلاحيات متوسطة</p>
                    </div>
                    {editingUser.role === 'manager' && <CheckCircle2 className="text-emerald-500" />}
                  </button>

                  <button
                    onClick={() => updateUserRole(editingUser.id, 'user', editingUser.company_id)}
                    className={`w-full p-4 rounded-2xl border-2 transition-all text-right flex items-center justify-between ${
                      editingUser.role === 'user' ? 'border-emerald-500 bg-emerald-50' : 'border-zinc-100 hover:border-zinc-200'
                    }`}
                  >
                    <div>
                      <p className="font-bold text-zinc-900">مستخدم عادي</p>
                      <p className="text-xs text-zinc-500">صلاحيات محدودة حسب التخصيص</p>
                    </div>
                    {editingUser.role === 'user' && <CheckCircle2 className="text-emerald-500" />}
                  </button>
                </div>
              </div>
            </div>

            <button 
              onClick={() => {
                setShowUserRoleModal(false);
                setEditingUser(null);
              }}
              className="w-full py-4 bg-zinc-100 text-zinc-600 rounded-2xl font-bold hover:bg-zinc-200 transition-all"
            >
              إلغاء
            </button>
          </div>
        </div>
      )}

      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-stone-200 flex justify-between items-center bg-stone-50">
                <h2 className="text-xl font-bold text-stone-800">
                  {editingCompany ? 'تعديل بيانات الشركة' : 'إضافة شركة جديدة'}
                </h2>
                <button 
                  onClick={() => setShowModal(false)}
                  className="p-2 text-stone-400 hover:text-stone-600 rounded-lg hover:bg-stone-100 transition-colors"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-stone-700 flex items-center gap-2">
                      <Building2 className="w-4 h-4" /> اسم الشركة
                    </label>
                    <input
                      required
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-2 bg-stone-50 border border-stone-200 rounded-lg focus:ring-2 focus:ring-emerald-500/20 outline-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-stone-700 flex items-center gap-2">
                      <Hash className="w-4 h-4" /> كود الشركة
                    </label>
                    <input
                      required
                      type="text"
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                      className="w-full px-4 py-2 bg-stone-50 border border-stone-200 rounded-lg focus:ring-2 focus:ring-emerald-500/20 outline-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-stone-700 flex items-center gap-2">
                      <Mail className="w-4 h-4" /> البريد الإلكتروني للمدير
                    </label>
                    <input
                      required
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-4 py-2 bg-stone-50 border border-stone-200 rounded-lg focus:ring-2 focus:ring-emerald-500/20 outline-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-stone-700 flex items-center gap-2">
                      <Phone className="w-4 h-4" /> رقم الهاتف
                    </label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-4 py-2 bg-stone-50 border border-stone-200 rounded-lg focus:ring-2 focus:ring-emerald-500/20 outline-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-stone-700 flex items-center gap-2">
                      <Users className="w-4 h-4" /> حد المستخدمين
                    </label>
                    <input
                      required
                      type="number"
                      value={formData.users_limit}
                      onChange={(e) => setFormData({ ...formData, users_limit: parseInt(e.target.value) })}
                      className="w-full px-4 py-2 bg-stone-50 border border-stone-200 rounded-lg focus:ring-2 focus:ring-emerald-500/20 outline-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-stone-700 flex items-center gap-2">
                      <ArrowLeftRight className="w-4 h-4" /> حد الحركات
                    </label>
                    <input
                      required
                      type="number"
                      value={formData.transactions_limit}
                      onChange={(e) => setFormData({ ...formData, transactions_limit: parseInt(e.target.value) })}
                      className="w-full px-4 py-2 bg-stone-50 border border-stone-200 rounded-lg focus:ring-2 focus:ring-emerald-500/20 outline-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-stone-700 flex items-center gap-2">
                      <Calendar className="w-4 h-4" /> أيام الاشتراك
                    </label>
                    <input
                      required
                      type="number"
                      value={formData.subscription_days}
                      onChange={(e) => setFormData({ ...formData, subscription_days: parseInt(e.target.value) })}
                      className="w-full px-4 py-2 bg-stone-50 border border-stone-200 rounded-lg focus:ring-2 focus:ring-emerald-500/20 outline-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-stone-700 flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4" /> خطة الاشتراك
                    </label>
                    <select
                      value={formData.subscription_plan}
                      onChange={(e) => setFormData({ ...formData, subscription_plan: e.target.value as any })}
                      className="w-full px-4 py-2 bg-stone-50 border border-stone-200 rounded-lg focus:ring-2 focus:ring-emerald-500/20 outline-none"
                    >
                      <option value="basic">أساسي</option>
                      <option value="pro">احترافي</option>
                      <option value="enterprise">مؤسسة</option>
                    </select>
                  </div>
                </div>

                {!editingCompany && (
                  <div className="flex items-center gap-2 pt-2">
                    <input
                      type="checkbox"
                      id="sendEmail"
                      checked={sendEmailOnCreate}
                      onChange={(e) => setSendEmailOnCreate(e.target.checked)}
                      className="w-4 h-4 text-emerald-600 border-stone-300 rounded focus:ring-emerald-500"
                    />
                    <label htmlFor="sendEmail" className="text-sm text-stone-700">إرسال بيانات الدخول تلقائياً للبريد الإلكتروني</label>
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-6 border-t border-stone-200">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-6 py-2 text-stone-600 hover:bg-stone-100 rounded-lg transition-colors"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors shadow-sm"
                  >
                    {editingCompany ? 'حفظ التعديلات' : 'إضافة الشركة'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
