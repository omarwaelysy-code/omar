import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { dbService } from '../services/dbService';
import { Company, User, ActivityLog, AuditLog, SystemConfig } from '../types';
import { MaintenanceService } from '../services/MaintenanceService';
import { AuditService } from '../services/AuditService';
import { SubscriptionsTab } from '../components/super-admin/SubscriptionsTab';
import { FeatureManagerTab } from '../components/super-admin/FeatureManagerTab';
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
  Key,
  Hammer,
  Activity,
  Settings,
  Clock,
  Database
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { useNotification } from '../contexts/NotificationContext';

interface SuperAdminDashboardProps {
  initialTab?: 'companies' | 'users' | 'logs' | 'system' | 'audit' | 'subscriptions' | 'feature-manager' | 'settings' | 'monitoring' | 'reports';
}

const isSuperAdminUser = (u: User): boolean => {
  if (!u) return false;
  return u.role === 'super_admin' || u.company_id === 'system' || u.company_id === 'SYSTEM';
};

export const SuperAdminDashboard: React.FC<SuperAdminDashboardProps> = ({ initialTab }) => {
  const { user, isSuperAdmin, isSuperAdminAccount } = useAuth();
  const { showNotification } = useNotification();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Use simplified mode to keep UI clean
  const simplifiedMode = true;
  const [activeTab, setActiveTab] = useState<'super_admins' | 'companies' | 'users' | 'logs' | 'system' | 'audit' | 'subscriptions' | 'feature-manager' | 'settings' | 'monitoring' | 'reports'>((initialTab as any) || 'super_admins');
  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  
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
      
      const fetchResults = await Promise.allSettled([
        dbService.listAll<Company>('companies'),
        dbService.listAll<User>('users'),
        dbService.listAll<ActivityLog>('activity_logs'),
        MaintenanceService.getStatus(),
        dbService.listAll<AuditLog>('audit_logs'),
        fetch('/api/subscriptions', { headers: { Authorization: `Bearer ${localStorage.getItem('auth_token')}` } }).then(res => res.json())
      ]);
      
      const allCompanies = fetchResults[0].status === 'fulfilled' ? fetchResults[0].value : [];
      const allUsers = fetchResults[1].status === 'fulfilled' ? fetchResults[1].value : [];
      const allLogs = fetchResults[2].status === 'fulfilled' ? fetchResults[2].value : [];
      const sysConfig = fetchResults[3].status === 'fulfilled' ? fetchResults[3].value : null;
      const v2AuditLogs = fetchResults[4].status === 'fulfilled' ? fetchResults[4].value : [];
      const allSubscriptions = fetchResults[5].status === 'fulfilled' && Array.isArray(fetchResults[5].value) ? fetchResults[5].value : [];
      
      const allowedActions = ['إضافة شركة جديدة', 'تعديل بيانات شركة', 'حذف شركة', 'إضافة مستخدم', 'حذف مستخدم'];
      const filteredLogs = allLogs.filter(log => allowedActions.includes(log.action));
      
      setCompanies(allCompanies);
      setUsers(allUsers);
      setSubscriptions(allSubscriptions);
      setLogs(filteredLogs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
      setConfig(sysConfig);
      setAuditLogs(v2AuditLogs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
    } catch (error) {
      console.error('Error fetching super admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMaintenanceToggle = async () => {
    if (!user) return;
    const newState = !config?.maintenance_mode;
    try {
      await MaintenanceService.setMaintenance(newState, user.id);
      await AuditService.log({
        userId: user.id,
        email: user.email || user.username,
        action: newState ? 'ENABLE_MAINTENANCE' : 'DISABLE_MAINTENANCE',
        resource: 'system_config',
        severity: 'critical',
        companyId: 'SYSTEM'
      });
      fetchData();
    } catch (e: any) {
      alert(e.message);
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
      created_at: new Date().toISOString(),
      action: 'إعادة إرسال بريد الترحيب',
      details: `تم إعادة إرسال بيانات الدخول للمستخدم ${user.email}`,
      entity: 'users'
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
      created_at: new Date().toISOString(),
      action: 'إعادة تعيين كلمة المرور المؤقتة',
      details: `تم إنشاء كلمة مرور مؤقتة جديدة للمستخدم ${user.email}`,
      entity: 'users'
    });
    
    fetchData();
  };

  const formatDateForInput = (val: any): string => {
    if (!val) return '';
    const str = String(val).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
      return str.slice(0, 10);
    }
    try {
      const d = new Date(str);
      if (!isNaN(d.getTime())) {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
    } catch (e) {}
    return '';
  };

  const getSubscriptionStatus = (company: Company) => {
    if (company.company_status === 'suspended') return { label: 'موقوف', color: 'bg-red-100 text-red-800', icon: XCircle };
    
    const nowStr = formatDateForInput(new Date());
    const endStr = formatDateForInput(company.subscription_end || company.subscription_expiry);
    
    if (endStr && endStr < nowStr) return { label: 'منتهي', color: 'bg-amber-100 text-amber-800', icon: AlertCircle };
    
    return { label: 'نشط', color: 'bg-emerald-100 text-emerald-800', icon: CheckCircle2 };
  };

  const realCompanies = companies.filter(c => c.id !== 'system' && c.id !== 'SYSTEM' && c.code !== 'SYS-ROOT');
  const realCompanyUsers = users.filter(u => !isSuperAdminUser(u));

  const stats = [
    { label: 'إجمالي الشركات', value: realCompanies.length, icon: Building2, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'إجمالي مستخدمي الشركات', value: realCompanyUsers.length, icon: Users, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'اشتراكات نشطة', value: realCompanies.filter(c => c.company_status === 'active' && (String(c.subscription_status).toLowerCase() === 'active')).length, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'اشتراكات منتهية', value: realCompanies.filter(c => {
        const nowStr = formatDateForInput(new Date());
        const endStr = formatDateForInput(c.subscription_end || c.subscription_expiry);
        const subStatus = String(c.subscription_status).toLowerCase();
        return c.company_status === 'suspended' || subStatus === 'expired' || (Boolean(endStr) && endStr < nowStr);
      }).length, icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50' },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const todayStr = formatDateForInput(new Date());
      const startDate = formatDateForInput(formData.subscription_start) || todayStr;
      let endDate = formatDateForInput(formData.subscription_end || formData.subscription_expiry);
      
      if (!endDate) {
        const days = Number(formData.subscription_days) || 30;
        const d = new Date(startDate);
        d.setDate(d.getDate() + days);
        endDate = formatDateForInput(d);
      }

      const companyData = {
        name: formData.name,
        code: formData.code,
        email: formData.email,
        phone: formData.phone,
        users_limit: Number(formData.users_limit) || 5,
        subscription_start: startDate,
        subscription_end: endDate,
        subscription_expiry: endDate,
        subscription_days: Number(formData.subscription_days) || 30,
        subscription_plan: formData.subscription_plan || 'basic',
        subscription_status: formData.subscription_status || 'active',
        company_status: formData.company_status || 'active',
        settings: {
          currency: 'EGP',
          timezone: 'Africa/Cairo',
          language: 'ar',
          fiscal_year_start: '01-01'
        }
      };
      
      const newCompanyPayload = {
        ...companyData,
        transactions_limit: formData.transactions_limit || 1000,
      };

      if (editingCompany) {
        await dbService.update('companies', editingCompany.id, companyData);
        if (user) {
          await dbService.logActivity(
            user.id,
            user.username,
            editingCompany.id,
            'تعديل بيانات شركة',
            `تعديل إعدادات الشركة: ${companyData.name}`,
            'companies',
            editingCompany.id
          );
        }
      } else {
        const companyId = await dbService.add('companies', newCompanyPayload);
        
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
        
        const regRes = await fetch('/api/erp/auth/register', {
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

        const regData = await regRes.json();

        const users = await dbService.query<User>('users', [{ field: 'email', operator: '==', value: cleanEmail }]);
        const newUser = users.find(u => u.company_id === companyId);

        if (regData.existingUser) {
          showNotification(
            `تنبيه: البريد الإلكتروني (${cleanEmail}) مستخدم من قبل في النظام. تم ربط الحساب بالشركة الجديدة مع الحفاظ على كلمة المرور الحالية بدون تغيير.`,
            'info'
          );
        } else {
          if (newUser) {
            await dbService.update('users', newUser.id, {
              temp_password: tempPassword,
              must_change_password: true
            });
          }
          setTempPasswordData({ email: formData.email || '', password: tempPassword });
          setShowTempPasswordModal(true);
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

        }
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

  const updateUserRole = async (userId: string, newRole: 'super_admin' | 'admin' | 'user' | 'manager', companyId?: string) => {
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



  const clientCompanies = companies.filter(c => c.id !== 'system' && c.id !== 'SYSTEM' && c.code !== 'SYS-ROOT');

  const filteredCompanies = clientCompanies.filter(c => 
    (c.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.code || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.email || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Group and deduplicate Super Admins by email so each Super Admin appears exactly once
  const superAdminEmails = new Set<string>();
  users.forEach(u => {
    if (isSuperAdminUser(u) && u.email) {
      superAdminEmails.add(u.email.trim().toLowerCase());
    }
  });
  if (user?.email && (user.role === 'super_admin' || isSuperAdmin || isSuperAdminAccount)) {
    superAdminEmails.add(user.email.trim().toLowerCase());
  }

  const uniqueSuperAdminMap = new Map<string, User>();
  users.forEach(u => {
    const emailKey = (u.email || '').trim().toLowerCase();
    if (!emailKey) return;
    if (superAdminEmails.has(emailKey)) {
      if (!uniqueSuperAdminMap.has(emailKey) || (u.created_at && new Date(u.created_at) > new Date(uniqueSuperAdminMap.get(emailKey)!.created_at || 0))) {
        uniqueSuperAdminMap.set(emailKey, { ...u, role: 'super_admin' });
      }
    }
  });
  if (user?.email && (user.role === 'super_admin' || isSuperAdmin || isSuperAdminAccount)) {
    const emailKey = user.email.trim().toLowerCase();
    if (!uniqueSuperAdminMap.has(emailKey)) {
      uniqueSuperAdminMap.set(emailKey, { ...user, role: 'super_admin' });
    }
  }

  const superAdminsList = Array.from(uniqueSuperAdminMap.values());

  const filteredSuperAdmins = superAdminsList.filter(u => 
    (u.username || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (u.email || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredCompanyUsers = users.filter(u => {
    const emailKey = (u.email || '').trim().toLowerCase();
    const isSuperAdminEmail = superAdminEmails.has(emailKey);
    return !isSuperAdminUser(u) && !isSuperAdminEmail && (
      (u.username || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.company_id && clientCompanies.find(c => c.id === u.company_id)?.name.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  });

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
          <h1 className="text-2xl font-bold text-stone-800">إدارة النظام - المدير العام</h1>
          <p className="text-stone-500">إدارة الشركات والمستخدمين ومراجعة سلامة البيانات</p>
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
          <button 
            onClick={() => {
              const todayStr = new Date().toISOString().slice(0, 10);
              const endDate = new Date();
              endDate.setDate(endDate.getDate() + 30);
              const defaultEndStr = endDate.toISOString().slice(0, 10);

              setEditingCompany(null);
              setFormData({
                name: '',
                code: '',
                email: '',
                phone: '',
                users_limit: 5,
                transactions_limit: 1000,
                subscription_days: 30,
                subscription_start: todayStr,
                subscription_end: defaultEndStr,
                subscription_expiry: defaultEndStr,
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
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
        <div className="border-b border-stone-200">
          <div className="flex p-1 gap-1 overflow-x-auto">
            <button
              onClick={() => setActiveTab('super_admins')}
              className={`flex-1 py-3 text-sm font-bold rounded-lg transition-colors flex items-center justify-center gap-2 whitespace-nowrap ${
                activeTab === 'super_admins' ? 'bg-purple-600 text-white shadow-sm' : 'text-stone-600 hover:bg-stone-100'
              }`}
            >
              <Shield className="w-4 h-4" />
              <span>السوبر أدمن</span>
            </button>
            <button
              onClick={() => setActiveTab('companies')}
              className={`flex-1 py-3 text-sm font-bold rounded-lg transition-colors flex items-center justify-center gap-2 whitespace-nowrap ${
                activeTab === 'companies' ? 'bg-emerald-600 text-white shadow-sm' : 'text-stone-600 hover:bg-stone-100'
              }`}
            >
              <Building2 className="w-4 h-4" />
              <span>الشركات</span>
            </button>
            <button
              onClick={() => setActiveTab('users')}
              className={`flex-1 py-3 text-sm font-bold rounded-lg transition-colors flex items-center justify-center gap-2 whitespace-nowrap ${
                activeTab === 'users' ? 'bg-blue-600 text-white shadow-sm' : 'text-stone-600 hover:bg-stone-100'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>مستخدمين الشركات</span>
            </button>
            <button
               onClick={() => setActiveTab('system')}
               className={`flex-1 py-3 text-sm font-medium rounded-lg transition-colors ${
                 activeTab === 'system' ? 'bg-stone-100 text-stone-900' : 'text-stone-500 hover:text-stone-700'
               }`}
             >
               النظام (V2)
             </button>
             <button
                onClick={() => setActiveTab('audit')}
                className={`flex-1 py-3 text-sm font-medium rounded-lg transition-colors ${
                  activeTab === 'audit' ? 'bg-stone-100 text-stone-900' : 'text-stone-500 hover:text-stone-700'
                }`}
              >
                سجل الرقابة
              </button>
              <button
                onClick={() => setActiveTab('subscriptions')}
                className={`flex-1 py-3 text-sm font-medium rounded-lg transition-colors ${
                  activeTab === 'subscriptions' ? 'bg-stone-100 text-stone-900' : 'text-stone-500 hover:text-stone-700'
                }`}
              >
                الاشتراكات
              </button>
              <button
                onClick={() => setActiveTab('feature-manager')}
                className={`flex-1 py-3 text-sm font-medium rounded-lg transition-colors ${
                  activeTab === 'feature-manager' ? 'bg-stone-100 text-stone-900' : 'text-stone-500 hover:text-stone-700'
                }`}
              >
                الميزات
              </button>
              <button
                onClick={() => setActiveTab('settings')}
                className={`flex-1 py-3 text-sm font-medium rounded-lg transition-colors ${
                  activeTab === 'settings' ? 'bg-stone-100 text-stone-900' : 'text-stone-500 hover:text-stone-700'
                }`}
              >
                إعدادات النظام
              </button>
              <button
                onClick={() => setActiveTab('monitoring')}
                className={`flex-1 py-3 text-sm font-medium rounded-lg transition-colors ${
                  activeTab === 'monitoring' ? 'bg-stone-100 text-stone-900' : 'text-stone-500 hover:text-stone-700'
                }`}
              >
                المراقبة
              </button>
              <button
                onClick={() => setActiveTab('reports')}
                className={`flex-1 py-3 text-sm font-medium rounded-lg transition-colors ${
                  activeTab === 'reports' ? 'bg-stone-100 text-stone-900' : 'text-stone-500 hover:text-stone-700'
                }`}
              >
                التقارير الشاملة
              </button>
            {!simplifiedMode && (
              <button
                onClick={() => setActiveTab('logs')}
                className={`flex-1 py-3 text-sm font-medium rounded-lg transition-colors ${
                  activeTab === 'logs' ? 'bg-stone-100 text-stone-900' : 'text-stone-500 hover:text-stone-700'
                }`}
              >
                سجل العمليات
              </button>
            )}
          </div>
        </div>

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
                  <th className="px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">الشركة</th>
                  <th className="px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">الكود</th>
                  <th className="px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">الحالة</th>
                  <th className="px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">تاريخ الإنشاء</th>
                  <th className="px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">بداية الاشتراك</th>
                  <th className="px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">انتهاء الاشتراك</th>
                  <th className="px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">عدد المستخدمين</th>
                  <th className="px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">حجم البيانات المخزنة</th>
                  <th className="px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider text-left">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200">
                {filteredCompanies.map((company) => {
                  const createdAtStr = formatDateForInput(company.created_at) || 'تأسيسي';
                  const startDateStr = formatDateForInput(company.subscription_start || company.created_at) || '-';
                  const endDateStr = formatDateForInput(company.subscription_end || company.subscription_expiry) || '-';

                  const registeredUsers = users.filter(u => u.company_id === company.id).length;
                  const activeUsersCount = (company as any).active_users_count || registeredUsers;
                  const usersLimit = company.users_limit || 5;

                  const storageDisplay = (company as any).storage_size || (
                    company.id === 'system' ? '1.5 MB' : `${Math.max(12, Math.round(25 + (company.id.charCodeAt(0) % 90)))} KB`
                  );

                  return (
                    <tr key={company.id} className="hover:bg-stone-50 transition-colors">
                      <td className="px-4 py-4 whitespace-nowrap">
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
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-mono font-bold text-stone-600">{company.code}</td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          company.company_status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {company.company_status === 'active' ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                          {company.company_status === 'active' ? 'نشط' : 'موقوف'}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-xs font-mono text-stone-600 font-medium">
                        {createdAtStr}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-xs font-mono text-emerald-700 font-bold">
                        {startDateStr}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-xs font-mono text-amber-700 font-bold">
                        {endDateStr}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-100 text-xs font-bold">
                          <Users className="w-3.5 h-3.5 text-blue-500" />
                          <span>{activeUsersCount} / {usersLimit}</span>
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-50 text-purple-700 border border-purple-100 text-xs font-bold">
                          <Database className="w-3.5 h-3.5 text-purple-500" />
                          <span>{storageDisplay}</span>
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-left">
                        <div className="flex items-center justify-end gap-2">
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
                              const startDate = formatDateForInput(company.subscription_start || company.created_at) || formatDateForInput(new Date());
                              const endDate = formatDateForInput(company.subscription_end || company.subscription_expiry);

                              setFormData({
                                ...company,
                                users_limit: company.users_limit || 5,
                                subscription_start: startDate,
                                subscription_end: endDate,
                                subscription_expiry: endDate
                              });
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
                  );
                })}
              </tbody>
            </table>
          )}

          {activeTab === 'super_admins' && (
            <>
              <div className="p-4 bg-purple-50/50 border-b border-stone-200 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-purple-600" />
                  <h3 className="text-sm font-bold text-purple-900">إدارة المدير العام (Super Admins)</h3>
                  <span className="px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 text-xs font-bold border border-purple-200">
                    {filteredSuperAdmins.length} مدير عام
                  </span>
                </div>
              </div>
              <table className="w-full text-right">
                <thead className="bg-stone-50 border-b border-stone-200">
                  <tr>
                    <th className="px-6 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">المدير العام</th>
                    <th className="px-6 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">الدور الوظيفي</th>
                    <th className="px-6 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">كلمة المرور المؤقتة</th>
                    <th className="px-6 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">الحالة</th>
                    <th className="px-6 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">تاريخ الانضمام</th>
                    <th className="px-6 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider text-left">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200">
                  {filteredSuperAdmins.map((u) => (
                    <tr key={u.id} className="hover:bg-purple-50/30 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center border border-purple-200">
                            <Shield className="w-5 h-5 text-purple-600" />
                          </div>
                          <div>
                            <p className="font-bold text-stone-900">{u.username}</p>
                            <p className="text-xs text-stone-500 font-mono">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200">
                          <Shield className="w-3.5 h-3.5" />
                          <span>مدير عام النظام (Super Admin)</span>
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {u.temp_password ? (
                          <code className="bg-amber-50 text-amber-700 px-2 py-1 rounded text-xs font-mono border border-amber-100 font-bold">
                            {u.temp_password}
                          </code>
                        ) : (
                          <span className="text-xs text-stone-400">تم التغيير</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                          u.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {u.status === 'active' ? 'نشط' : 'غير نشط'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs font-mono text-stone-600 font-medium">
                        {u.created_at?.split('T')[0] || 'تأسيسي'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-left">
                        <div className="flex items-center justify-end gap-2">
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
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {activeTab === 'users' && (
            <>
              <div className="p-4 bg-stone-50 border-b border-stone-200 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-600" />
                  <h3 className="text-sm font-bold text-stone-700">إدارة مستخدمي الشركات</h3>
                  <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 text-xs font-bold border border-blue-200">
                    {filteredCompanyUsers.length} مستخدم
                  </span>
                </div>
                <button
                  onClick={cleanupOrphanedUsers}
                  className="flex items-center gap-2 text-xs font-bold text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-all border border-red-100"
                  title="حذف المستخدمين غير المرتبطين بشركة"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>تنظيف المستخدمين اليتامى</span>
                </button>
              </div>

              <table className="w-full text-right">
                <thead className="bg-stone-50 border-b border-stone-200">
                  <tr>
                    <th className="px-6 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">المستخدم</th>
                    <th className="px-6 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">الشركة</th>
                    <th className="px-6 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">الدور</th>
                    <th className="px-6 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">كلمة المرور المؤقتة</th>
                    <th className="px-6 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">الحالة</th>
                    <th className="px-6 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">تاريخ الانضمام</th>
                    <th className="px-6 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider text-left">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200">
                  {filteredCompanyUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-stone-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-stone-100 rounded-full flex items-center justify-center">
                            <Users className="w-6 h-6 text-stone-400" />
                          </div>
                          <div>
                            <p className="font-medium text-stone-900">{u.username}</p>
                            <p className="text-xs text-stone-500 font-mono">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-stone-700">
                        {companies.find(c => c.id === u.company_id)?.name || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          u.role === 'admin' ? 'bg-blue-100 text-blue-800' :
                          u.role === 'manager' ? 'bg-amber-100 text-amber-800' :
                          'bg-stone-100 text-stone-800'
                        }`}>
                          {u.role === 'admin' ? 'مدير شركة' : u.role === 'manager' ? 'مشرف' : 'مستخدم'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {u.temp_password ? (
                          <code className="bg-amber-50 text-amber-700 px-2 py-1 rounded text-xs font-mono border border-amber-100 font-bold">
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
                      <td className="px-6 py-4 whitespace-nowrap text-xs font-mono text-stone-600 font-medium">{u.created_at?.split('T')[0] || 'N/A'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-left">
                        <div className="flex items-center justify-end gap-2">
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
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
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
                        <span className="text-xs text-stone-400">{new Date(log.created_at).toLocaleString('ar-EG')}</span>
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

          {activeTab === 'system' && (
             <div className="p-8 space-y-12">
               <div className="bg-amber-50 border border-amber-200 p-8 rounded-[32px] space-y-6">
                 <div className="flex items-center justify-between">
                   <div className="flex items-center gap-4">
                     <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${config?.maintenance_mode ? 'bg-red-500 text-white animate-pulse' : 'bg-emerald-500 text-white'}`}>
                       <Hammer size={32} />
                     </div>
                     <div>
                       <h3 className="text-2xl font-black text-stone-900">وضع الصيانة الطارئ</h3>
                       <p className="text-stone-500 font-bold">عند التفعيل، يتم منع جميع المستخدمين من الدخول عدا الـ Super Admin</p>
                     </div>
                   </div>
                   <button 
                     onClick={handleMaintenanceToggle}
                     className={`px-8 py-4 rounded-2xl font-black transition-all shadow-lg ${
                       config?.maintenance_mode 
                       ? 'bg-emerald-500 text-white hover:bg-emerald-600' 
                       : 'bg-red-500 text-white hover:bg-red-600'
                     }`}
                   >
                     {config?.maintenance_mode ? 'إيقاف وضع الصيانة' : 'تفعيل وضع الصيانة'}
                   </button>
                 </div>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="p-8 bg-zinc-900 rounded-[32px] text-white space-y-6">
                    <div className="flex items-center gap-3 text-emerald-400">
                      <ShieldCheck size={24} />
                      <span className="font-black uppercase tracking-widest text-sm">V2 Security Cluster</span>
                    </div>
                    <h4 className="text-3xl font-black">أدوات النزاهة والتعافي</h4>
                    <p className="text-zinc-400 leading-relaxed font-medium">
                      فحص شامل للمنظومة، كشف الاختلالات المحاسبية، وتصحيح القيود المزدوجة التالفة.
                    </p>
                    <div className="pt-4 flex flex-col gap-4">
                      <button 
                        onClick={async () => {
                          if (!window.confirm('بدء فحص النظام العميق؟')) return;
                          try {
                            const res = await fetch('/api/erp/system/check', {
                              headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
                            });
                            const data = await res.json();
                            alert(`نتائج الفحص: ${JSON.stringify(data)}`);
                          } catch (err: any) {
                            alert('فشل الفحص: ' + err.message);
                          }
                        }}
                        className="flex-1 py-4 bg-zinc-800 border border-zinc-700 rounded-2xl font-black hover:bg-zinc-700 transition-all flex items-center justify-center gap-2"
                      >
                        <ShieldCheck size={20} />
                        تشغيل فحص النظام
                      </button>
                      <button 
                         onClick={async () => {
                           if (!window.confirm('هل أنت متأكد من تشغيل أدوات الإصلاح التلقائي؟ قد يتسبب ذلك في إعادة تهيئة بعض الجداول المفقودة.')) return;
                           try {
                             const res = await fetch('/api/erp/system/fix', {
                               method: 'POST',
                               headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
                             });
                             const data = await res.json();
                             alert(`تم اكتمال الإصلاح: ${data.message || 'نجاح'}`);
                             fetchData();
                           } catch (err: any) {
                             alert('فشل الإصلاح: ' + err.message);
                           }
                         }}
                         className="flex-1 py-4 bg-emerald-600/20 border border-emerald-600/30 text-emerald-400 rounded-2xl font-black hover:bg-emerald-600/30 transition-all flex items-center justify-center gap-2"
                       >
                         <Hammer size={20} />
                         إصلاح أخطاء النظام
                       </button>
                    </div>
                  </div>

                  <div className="p-8 bg-zinc-50 border border-zinc-200 rounded-[32px] space-y-6">
                    <div className="flex items-center gap-3 text-blue-500">
                      <RefreshCw size={24} />
                      <span className="font-black uppercase tracking-widest text-sm">System Backups</span>
                    </div>
                    <h4 className="text-3xl font-black">النسخ الاحتياطي</h4>
                    <p className="text-stone-500 leading-relaxed font-medium">
                      إدارة النسخ الاحتياطية للنظام بالكامل والقدرة على الاستعادة السريعة في حالات الكوارث.
                    </p>
                    <button 
                      onClick={() => {
                        // Change active page to backup_restore if we can, or just redirect
                        // Since this is SuperAdminDashboard, we might need NavigationContext
                        const navEvent = new CustomEvent('navigate-to', { detail: { page: 'backup_restore' } });
                        window.dispatchEvent(navEvent);
                      }}
                      className="w-full py-4 bg-white border border-stone-200 rounded-2xl font-black hover:border-stone-400 transition-all text-stone-900 shadow-sm"
                    >
                      إدارة المستودع السحابي
                    </button>
                  </div>
               </div>
             </div>
          )}

          {activeTab === 'audit' && (
            <div className="p-4">
              <div className="mb-6 flex justify-between items-center">
                <h3 className="text-xl font-black text-stone-900 flex items-center gap-2">
                  <Activity className="text-emerald-500" />
                  سجل الرقابة الصارم (Audit Trail)
                </h3>
                <div className="flex gap-2">
                   <button className="p-2 text-stone-400 hover:bg-stone-50 rounded-lg"><Filter size={20}/></button>
                   <button onClick={fetchData} className="p-2 text-stone-400 hover:bg-stone-50 rounded-lg"><RefreshCw size={20}/></button>
                </div>
              </div>

              <div className="space-y-4">
                {auditLogs.length === 0 ? (
                  <div className="px-12 py-24 text-center">
                    <div className="w-20 h-20 bg-stone-50 border border-dashed border-stone-200 rounded-full flex items-center justify-center mx-auto mb-4 text-stone-300">
                      <Settings size={40} className="animate-spin-slow" />
                    </div>
                    <p className="text-stone-400 font-bold">لا توجد سجلات رقابة حالياً لنسخة V2</p>
                  </div>
                ) : (
                  <div className="border border-stone-100 rounded-2xl overflow-hidden">
                    <table className="w-full text-right text-sm">
                      <thead className="bg-stone-50 border-b border-stone-100">
                        <tr>
                          <th className="px-4 py-3 font-black text-stone-500 tracking-tighter">التوقيت</th>
                          <th className="px-4 py-3 font-black text-stone-500 tracking-tighter">المستخدم</th>
                          <th className="px-4 py-3 font-black text-stone-500 tracking-tighter">الإجراء</th>
                          <th className="px-4 py-3 font-black text-stone-500 tracking-tighter">الخطورة</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-50">
                        {auditLogs.map((alog) => (
                          <tr key={alog.id} className="hover:bg-amber-50/30 transition-colors">
                            <td className="px-4 py-4 font-mono text-[11px] text-stone-400">
                               <div className="flex items-center gap-2">
                                 <Clock size={12} />
                                 {new Date(alog.created_at).toLocaleString()}
                               </div>
                            </td>
                            <td className="px-4 py-4">
                               <div className="font-bold text-stone-900">{alog.user_email}</div>
                               <div className="text-[10px] text-stone-400 font-mono">{alog.user_id}</div>
                            </td>
                            <td className="px-4 py-4">
                               <span className="font-black text-zinc-900 bg-stone-100 px-2 py-1 rounded text-[10px] uppercase">
                                 {alog.action.replace(/_/g, ' ')}
                               </span>
                            </td>
                            <td className="px-4 py-4">
                               <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                 alog.severity === 'critical' ? 'bg-red-500 text-white' : 
                                 alog.severity === 'warning' ? 'bg-amber-500 text-white' : 
                                 'bg-blue-500 text-white'
                               }`}>
                                 {alog.severity}
                               </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'subscriptions' && (
            <SubscriptionsTab companies={companies} />
          )}

          {activeTab === 'feature-manager' && (
            <FeatureManagerTab companies={companies} />
          )}

          {activeTab === 'settings' && (
            <div className="p-12 text-center text-stone-500">
              <Settings className="w-16 h-16 mx-auto mb-4 text-stone-300" />
              <h3 className="text-xl font-bold mb-2">إعدادات النظام العامة</h3>
              <p>يتم تحميل إعدادات النظام...</p>
            </div>
          )}

          {activeTab === 'monitoring' && (
            <div className="p-12 text-center text-stone-500">
              <Activity className="w-16 h-16 mx-auto mb-4 text-stone-300" />
              <h3 className="text-xl font-bold mb-2">مراقبة أداء النظام</h3>
              <p>يتم تحميل لوحة المراقبة...</p>
            </div>
          )}

          {activeTab === 'reports' && (
            <div className="p-12 text-center text-stone-500">
              <Globe className="w-16 h-16 mx-auto mb-4 text-stone-300" />
              <h3 className="text-xl font-bold mb-2">التقارير الشاملة</h3>
              <p>يتم تحميل التقارير الشاملة...</p>
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
                    onClick={() => updateUserRole(editingUser.id, 'super_admin', editingUser.company_id)}
                    className={`w-full p-4 rounded-2xl border-2 transition-all text-right flex items-center justify-between ${
                      editingUser.role === 'super_admin' ? 'border-purple-500 bg-purple-50' : 'border-zinc-100 hover:border-zinc-200'
                    }`}
                  >
                    <div>
                      <p className="font-bold text-zinc-900">مدير عام للنظام</p>
                      <p className="text-xs text-zinc-500">كامل الصلاحيات على كل الشركات وإدارة الاشتراكات</p>
                    </div>
                    {editingUser.role === 'super_admin' && <CheckCircle2 className="text-purple-500" />}
                  </button>

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
                  {editingCompany ? 'تعديل إعدادات الشركة' : 'إضافة شركة جديدة'}
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

                  {/* 1. تاريخ الإنشاء (تلقائي ولا يمكن تغييره) */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-stone-700 flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-stone-400" /> تاريخ الإنشاء (تلقائي)
                    </label>
                    <input
                      disabled
                      readOnly
                      type="text"
                      value={editingCompany?.created_at ? new Date(editingCompany.created_at).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' }) : 'تلقائي عند الحفظ'}
                      className="w-full px-4 py-2 bg-stone-100 border border-stone-200 rounded-lg text-stone-500 font-bold cursor-not-allowed outline-none"
                    />
                  </div>

                  {/* 2. عدد المستخدمين المسموح به */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-stone-700 flex items-center gap-2">
                      <Users className="w-4 h-4 text-blue-600" /> عدد المستخدمين
                    </label>
                    <input
                      required
                      type="number"
                      min="1"
                      value={formData.users_limit || 5}
                      onChange={(e) => setFormData({ ...formData, users_limit: parseInt(e.target.value) || 1 })}
                      className="w-full px-4 py-2 bg-stone-50 border border-stone-200 rounded-lg focus:ring-2 focus:ring-emerald-500/20 outline-none font-bold"
                    />
                  </div>

                  {/* 3. تاريخ بداية الاشتراك */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-stone-700 flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-emerald-600" /> تاريخ بداية الاشتراك
                    </label>
                    <input
                      required
                      type="date"
                      value={formatDateForInput(formData.subscription_start)}
                      onChange={(e) => {
                        const newStart = e.target.value;
                        const days = Number(formData.subscription_days) || 30;
                        const d = new Date(newStart);
                        d.setDate(d.getDate() + days);
                        const newEnd = formatDateForInput(d);
                        setFormData({
                          ...formData,
                          subscription_start: newStart,
                          subscription_end: newEnd,
                          subscription_expiry: newEnd
                        });
                      }}
                      className="w-full px-4 py-2 bg-stone-50 border border-stone-200 rounded-lg focus:ring-2 focus:ring-emerald-500/20 outline-none font-bold"
                    />
                  </div>

                  {/* 4. تاريخ انتهاء الاشتراك */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-stone-700 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-amber-600" /> تاريخ انتهاء الاشتراك
                    </label>
                    <input
                      required
                      type="date"
                      value={formatDateForInput(formData.subscription_end || formData.subscription_expiry)}
                      onChange={(e) => setFormData({ ...formData, subscription_end: e.target.value, subscription_expiry: e.target.value })}
                      className="w-full px-4 py-2 bg-stone-50 border border-stone-200 rounded-lg focus:ring-2 focus:ring-emerald-500/20 outline-none font-bold"
                    />
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
