import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { useLanguage } from '../contexts/LanguageContext';
import { User, UserPermissions, ModulePermissions } from '../types';
import { 
  Search, Plus, Trash2, X, Shield, User as UserIcon, History, Lock, Check,
  AlertCircle, Edit2, ChevronDown, ChevronUp, Copy, HelpCircle, RefreshCw, Info,
  ChevronLeft, ChevronRight, Save
} from 'lucide-react';
import { dbService } from '../services/dbService';
import { PageActivityLog } from '../components/PageActivityLog';
import { PERMISSION_GROUPS, MODULE_PERMISSIONS_META, SPECIAL_PERMISSIONS_DESC, DOCUMENT_BUSINESS_PERMISSIONS } from '../constants/permissions';
import { getInitialPermissionsState, getDefaultRolePermissions, computeEffectivePermissions } from '../utils/permissions';

interface Role {
  id: string;
  name: string;
  description: string;
  permissions: UserPermissions;
}

const ROLE_NAME_TRANSLATIONS: Record<string, { ar: string; en: string }> = {
  'مدير النظام': { ar: 'مدير النظام', en: 'System Admin' },
  'مدير مالي': { ar: 'مدير مالي', en: 'Financial Manager' },
  'محاسب': { ar: 'محاسب', en: 'Accountant' },
  'أمين مخزن': { ar: 'أمين مخزن', en: 'Warehouse Keeper' },
  'مشتريات': { ar: 'مشتريات', en: 'Purchasing' },
  'مبيعات': { ar: 'مبيعات', en: 'Sales' },
  'كاشير': { ar: 'كاشير', en: 'Cashier' }
};

const ROLE_DESC_TRANSLATIONS: Record<string, { ar: string; en: string }> = {
  'له كامل الصلاحيات لإدارة النظام والإعدادات والمستخدمين': {
    ar: 'له كامل الصلاحيات لإدارة النظام والإعدادات والمستخدمين',
    en: 'Has full permissions to manage the system, settings, and users'
  },
  'إدارة الحسابات العامة، التقارير المالية، والقيود اليومية والاعتمادات': {
    ar: 'إدارة الحسابات العامة، التقارير المالية، والقيود اليومية والاعتمادات',
    en: 'Manage general ledger, financial reports, journal entries, and approvals'
  },
  'إدارة الحسابات العامة التقارير المالية، والقيود اليومية والاعتمادات': {
    ar: 'إدارة الحسابات العامة التقارير المالية، والقيود اليومية والاعتمادات',
    en: 'Manage general ledger, financial reports, journal entries, and approvals'
  },
  'تسجيل القيود اليومية، مراجعة الحسابات، وإعداد كشوفات الحساب': {
    ar: 'تسجيل القيود اليومية، مراجعة الحسابات، وإعداد كشوفات الحساب',
    en: 'Record journal entries, audit accounts, and prepare account statements'
  },
  'تسجيل القيود اليومية مراجعة الحسابات، وإعداد كشوفات الحساب': {
    ar: 'تسجيل القيود اليومية مراجعة الحسابات، وإعداد كشوفات الحساب',
    en: 'Record journal entries, audit accounts, and prepare account statements'
  },
  'إدارة المخازن، استلام البضائع، التحويلات المخزنية، والجرد': {
    ar: 'إدارة المخازن، استلام البضائع، التحويلات المخزنية، والجرد',
    en: 'Manage warehouses, receive goods, warehouse transfers, and inventory'
  },
  'إدارة المخازن، استلام البضائع، التحويلات المخزنية والجرد': {
    ar: 'إدارة المخازن، استلام البضائع، التحويلات المخزنية والجرد',
    en: 'Manage warehouses, receive goods, warehouse transfers, and inventory'
  },
  'إدارة الموردين، أوامر الشراء، وفواتير المشتريات': {
    ar: 'إدارة الموردين، أوامر الشراء، وفواتير المشتريات',
    en: 'Manage suppliers, purchase orders, and purchase invoices'
  },
  'إدارة الموردين، أوامر الشراء وفواتير المشتريات': {
    ar: 'إدارة الموردين، أوامر الشراء وفواتير المشتريات',
    en: 'Manage suppliers, purchase orders, and purchase invoices'
  },
  'إدارة العملاء، عروض الأسعار، أوامر البيع، وفواتير المبيعات': {
    ar: 'إدارة العملاء، عروض الأسعار، أوامر البيع، وفواتير المبيعات',
    en: 'Manage customers, price offers, sales orders, and sales invoices'
  },
  'إدارة العملاء، عروض الأسعار، أوامر البيع وفواتير المبيعات': {
    ar: 'إدارة العملاء، عروض الأسعار، أوامر البيع وفواتير المبيعات',
    en: 'Manage customers, price offers, sales orders, and sales invoices'
  },
  'إصدار فواتير مبيعات نقدية وسندات قبض وصرف يومية': {
    ar: 'إصدار فواتير مبيعات نقدية وسندات قبض وصرف يومية',
    en: 'Issue cash sales invoices, daily receipt and payment vouchers'
  }
};

const translateRoleName = (name: string, lang: string) => {
  if (!name) return '';
  return lang === 'ar' ? (ROLE_NAME_TRANSLATIONS[name]?.ar || name) : (ROLE_NAME_TRANSLATIONS[name]?.en || name);
};

const translateRoleDesc = (desc: string, lang: string) => {
  if (!desc) return '';
  return lang === 'ar' ? (ROLE_DESC_TRANSLATIONS[desc]?.ar || desc) : (ROLE_DESC_TRANSLATIONS[desc]?.en || desc);
};

export const Users: React.FC = () => {
  const { user: currentUser, fetchProfile } = useAuth();
  const { showNotification } = useNotification();
  const { t, language } = useLanguage();
  
  const [activeTab, setActiveTab] = useState<'users' | 'roles'>('users');
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modals state
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);
  const [isActivityLogOpen, setIsActivityLogOpen] = useState(false);
  const [activityLogDocumentId, setActivityLogDocumentId] = useState<string | undefined>(undefined);
  
  const [userFormData, setUserFormData] = useState({ email: '', password: '', role: 'user' as 'admin' | 'user' | 'manager' });
  
  // Role Modals state
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [roleFormData, setRoleFormData] = useState({ name: '', description: '' });
  const [isRoleDeleteModalOpen, setIsRoleDeleteModalOpen] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<string | null>(null);
  
  // Permissions Modal state
  const [isPermissionsModalOpen, setIsPermissionsModalOpen] = useState(false);
  const [permissionsTargetType, setPermissionsTargetType] = useState<'user' | 'role'>('user');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  
  const [tempPermissions, setTempPermissions] = useState<any>({});
  const [tempUserRoleIds, setTempUserRoleIds] = useState<string[]>([]);
  const [permissionsTab, setPermissionsTab] = useState<'basic' | 'documents'>('basic');
  const [warehousesList, setWarehousesList] = useState<any[]>([]);
  const [paymentMethodsList, setPaymentMethodsList] = useState<any[]>([]);
  const [departmentsList, setDepartmentsList] = useState<any[]>([]);
  const [costCentersList, setCostCentersList] = useState<any[]>([]);
  
  // Accordions and filters state
  const [expandedSections, setExpandedSections] = useState<{ [key: string]: boolean }>({
    dashboard: true,
    master_data: true
  });
  const [permSearchTerm, setPermSearchTerm] = useState('');
  const [userSearchTerm, setUserSearchTerm] = useState('');

  // Subscribe to users and roles
  useEffect(() => {
    if (currentUser) {
      setLoading(true);
      const unsubUsers = dbService.subscribe<User>('users', currentUser.company_id, (data) => {
        setUsers(data);
        setLoading(false);
      });
      const unsubRoles = dbService.subscribe<Role>('roles', currentUser.company_id, (data) => {
        setRoles(data);
      });
      return () => {
        unsubUsers();
        unsubRoles();
      };
    }
  }, [currentUser]);

  useEffect(() => {
    if (isPermissionsModalOpen && currentUser) {
      dbService.list('warehouses', currentUser.company_id)
        .then(setWarehousesList)
        .catch(err => console.error("Error loading warehouses for permissions:", err));
      dbService.list('payment_methods', currentUser.company_id)
        .then(setPaymentMethodsList)
        .catch(err => console.error("Error loading payment methods for permissions:", err));
      dbService.list('departments', currentUser.company_id)
        .then(setDepartmentsList)
        .catch(err => console.error("Error loading departments for permissions:", err));
      dbService.list('cost_centers', currentUser.company_id)
        .then(setCostCentersList)
        .catch(err => console.error("Error loading cost centers for permissions:", err));
    }
  }, [isPermissionsModalOpen, currentUser]);

  // Section Toggle
  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };

  // CRUD Toggle
  const togglePermission = (moduleId: string, permissionKey: string) => {
    setTempPermissions(prev => {
      const current = prev[moduleId] || {};
      const val = current[permissionKey];
      return {
        ...prev,
        [moduleId]: {
          ...current,
          [permissionKey]: val === true ? false : val === false ? undefined : true // 3-state for overrides (true, false, inherit/undefined)
        }
      };
    });
  };

  const setAllPermissionVal = (moduleId: string, permissionKey: string, val: boolean | undefined) => {
    setTempPermissions(prev => {
      const current = prev[moduleId] || {};
      return {
        ...prev,
        [moduleId]: {
          ...current,
          [permissionKey]: val
        }
      };
    });
  };

  // Section-wise check
  const toggleSectionAll = (modules: string[], checked: boolean) => {
    setTempPermissions(prev => {
      const updated = { ...prev };
      modules.forEach(modId => {
        const meta = MODULE_PERMISSIONS_META[modId];
        if (!updated[modId]) updated[modId] = {};
        
        if (meta.hasCrud) {
          updated[modId].view = checked ? true : undefined;
          updated[modId].create = checked ? true : undefined;
          updated[modId].edit = checked ? true : undefined;
          updated[modId].delete = checked ? true : undefined;
        }
        if (meta.special) {
          meta.special.forEach(sp => {
            updated[modId][sp] = checked ? true : undefined;
          });
        }
      });
      return updated;
    });
  };

  // Column-wise check
  const toggleColumnAll = (permissionKey: string, checked: boolean) => {
    setTempPermissions(prev => {
      const updated = { ...prev };
      Object.keys(MODULE_PERMISSIONS_META).forEach(modId => {
        const meta = MODULE_PERMISSIONS_META[modId];
        if (permissionKey === 'view' || permissionKey === 'create' || permissionKey === 'edit' || permissionKey === 'delete') {
          if (meta.hasCrud) {
            if (!updated[modId]) updated[modId] = {};
            updated[modId][permissionKey] = checked ? true : undefined;
          }
        } else {
          if (meta.special?.includes(permissionKey)) {
            if (!updated[modId]) updated[modId] = {};
            updated[modId][permissionKey] = checked ? true : undefined;
          }
        }
      });
      return updated;
    });
  };

  // Users Handlers
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    const cleanEmail = userFormData.email.trim().toLowerCase();
    if (users.some(u => u.email?.toLowerCase() === cleanEmail)) {
      showNotification(t('users.user_exists') || 'المستخدم موجود بالفعل', 'error');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/erp/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: cleanEmail,
          email: cleanEmail,
          password: userFormData.password,
          company_id: currentUser.company_id,
          role: userFormData.role
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || data.error || 'فشلت عملية إنشاء الحساب');
      }

      const newUser = await response.json();
      
      // Initialize with default permissions (inherit from roles, role_ids starts empty)
      await dbService.update('users', newUser.id, { 
        permissions: {},
        role_ids: []
      });

      await dbService.logActivity(currentUser.id, currentUser.username, currentUser.company_id, 'إضافة مستخدم', `${language === 'ar' ? 'إضافة مستخدم جديد' : 'Add New User'}: ${cleanEmail}`, 'users', newUser.id);
      
      if (newUser.existingUser) {
        showNotification(
          `تنبيه: البريد الإلكتروني (${cleanEmail}) مستخدم من قبل في النظام. تم ربط المستخدم بشركتك مع الحفاظ على كلمة المرور الحالية بدون تغيير.`,
          'info'
        );
      } else {
        showNotification(t('users.add_success') || 'تمت إضافة المستخدم بنجاح', 'success');
      }

      setIsUserModalOpen(false);
      setUserFormData({ email: '', password: '', role: 'user' });
    } catch (e: any) {
      console.error(e);
      showNotification(e.message || 'خطأ أثناء إضافة المستخدم', 'error');
    } finally {
      setLoading(false);
    }
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete || !currentUser) return;
    setLoading(true);
    try {
      const targetUser = users.find(u => u.id === userToDelete);
      await dbService.delete('users', userToDelete);
      await dbService.logActivity(currentUser.id, currentUser.username, currentUser.company_id, 'حذف مستخدم', `حذف المستخدم: ${targetUser?.username}`, 'users', userToDelete);
      showNotification(t('users.delete_success') || 'تم حذف المستخدم بنجاح');
      setIsDeleteModalOpen(false);
      setUserToDelete(null);
    } catch (e: any) {
      console.error(e);
      showNotification(e.message || 'خطأ أثناء حذف المستخدم', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Roles Handlers
  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setLoading(true);
    try {
      if (editingRole) {
        await dbService.update('roles', editingRole.id, {
          name: roleFormData.name,
          description: roleFormData.description
        });
        await dbService.logActivity(currentUser.id, currentUser.username, currentUser.company_id, 'تعديل دور', `تعديل الدور: ${roleFormData.name}`, 'roles', editingRole.id);
        showNotification('تم تعديل الدور بنجاح');
      } else {
        const newRoleId = crypto.randomUUID();
        const initialPerms = getInitialPermissionsState();
        
        await dbService.addWithId('roles', newRoleId, {
          id: newRoleId,
          name: roleFormData.name,
          description: roleFormData.description,
          permissions: initialPerms,
          company_id: currentUser.company_id
        });
        
        await dbService.logActivity(currentUser.id, currentUser.username, currentUser.company_id, 'إضافة دور', `{language === 'ar' ? 'إضافة دور جديد' : 'Add New Role'}: ${roleFormData.name}`, 'roles', newRoleId);
        showNotification('تمت إضافة الدور بنجاح');
      }
      setIsRoleModalOpen(false);
      setEditingRole(null);
      setRoleFormData({ name: '', description: '' });
    } catch (err: any) {
      console.error(err);
      showNotification(err.message || 'فشلت عملية حفظ الدور', 'error');
    } finally {
      setLoading(false);
    }
  };

  const confirmDeleteRole = async () => {
    if (!roleToDelete || !currentUser) return;
    setLoading(true);
    try {
      const targetRole = roles.find(r => r.id === roleToDelete);
      await dbService.delete('roles', roleToDelete);
      await dbService.logActivity(currentUser.id, currentUser.username, currentUser.company_id, 'حذف دور', `حذف الدور: ${targetRole?.name}`, 'roles', roleToDelete);
      showNotification('تم حذف الدور بنجاح');
      setIsRoleDeleteModalOpen(false);
      setRoleToDelete(null);
    } catch (err: any) {
      console.error(err);
      showNotification(err.message || 'فشل حذف الدور', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Open Permissions
  const openUserPermissions = (user: User) => {









    setSelectedUser(user);
    setPermissionsTargetType('user');
    setTempPermissions(JSON.parse(JSON.stringify(user.permissions || {})));
    const cleanRoleIds = Array.isArray(user.role_ids) ? user.role_ids : [];
    setTempUserRoleIds(cleanRoleIds);
    setIsPermissionsModalOpen(true);
  };

  const openRolePermissions = (role: Role) => {
    setSelectedRole(role);
    setPermissionsTargetType('role');
    setTempPermissions(JSON.parse(JSON.stringify(role.permissions || {})));
    setIsPermissionsModalOpen(true);
  };

  const savePermissions = async () => {
    if (!currentUser) return;
    setLoading(true);








    const cleanSaveRoleIds = Array.isArray(tempUserRoleIds) ? tempUserRoleIds : [];
    try {
      if (permissionsTargetType === 'user' && selectedUser) {
        await dbService.update('users', selectedUser.id, {
          permissions: tempPermissions,
          role_ids: cleanSaveRoleIds
        });
        
        await dbService.logActivity(
          currentUser.id, 
          currentUser.username, 
          currentUser.company_id, 
          'تعديل صلاحيات مستخدم', 
          `تعديل صلاحيات المستخدم: ${selectedUser.username}`, 
          'users', 
          selectedUser.id
        );
        
        // Refresh active user profile if modifying current user
        if (selectedUser.id === currentUser.id) {
          await fetchProfile(currentUser.id, currentUser.email);
        }
        
        showNotification('تم حفظ صلاحيات المستخدم بنجاح', 'success');
      } else if (permissionsTargetType === 'role' && selectedRole) {
        // Enforce true values properly
        await dbService.update('roles', selectedRole.id, {
          permissions: tempPermissions
        });
        
        await dbService.logActivity(
          currentUser.id, 
          currentUser.username, 
          currentUser.company_id, 
          'تعديل صلاحيات دور', 
          `{language === 'ar' ? '\u062a\u0639\u062f\u064a\u0644 \u0635\u0644\u0627\u062d\u064a\u0627\u062a \u0627\u0644\u062f\u0648\u0631' : 'Edit Role Permissions'}: ${translateRoleName(selectedRole.name, language)}`,
          'roles', 
          selectedRole.id
        );
        
        // Refresh active user profile since roles changed
        await fetchProfile(currentUser.id, currentUser.email);
        
        showNotification('تم حفظ صلاحيات الدور بنجاح', 'success');
      }
      setIsPermissionsModalOpen(false);
    } catch (e: any) {
      console.error(e);
      showNotification('خطأ أثناء حفظ الصلاحيات', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Copy Permissions
  const handleCopyPermissions = (fromUserId: string) => {
    const fromUser = users.find(u => u.id === fromUserId);
    if (fromUser) {
      setTempPermissions(JSON.parse(JSON.stringify(fromUser.permissions || {})));
      setTempUserRoleIds(fromUser.role_ids || []);
      showNotification('تم نسخ صلاحيات وأدوار المستخدم المختار إلى الشاشة الحالية');
    }
  };

  // Toggle Role Assignment in User Permissions Modal
  const toggleUserRoleAssignment = (roleId: string) => {
    setTempUserRoleIds(prev => {
      const prevVal = prev as any;
      const roleIds = Array.isArray(prevVal) 
        ? prevVal 
        : (typeof prevVal === 'string' 
            ? (prevVal.startsWith('[') ? JSON.parse(prevVal) : (prevVal ? [prevVal] : [])) 
            : []);
      return roleIds.includes(roleId) ? roleIds.filter((id: string) => id !== roleId) : [...roleIds, roleId];
    });


  };

  // Restore defaults (clear overrides)
  const handleRestoreDefaults = () => {
    setTempPermissions({});
    showNotification('تمت استعادة الصلاحيات لقيم الأدوار الافتراضية');
  };

  // Search filter implementation
  const filteredModules = (sectionModules: string[]) => {
    return sectionModules.filter(modId => {
      const meta = MODULE_PERMISSIONS_META[modId];
      if (!meta) return false;
      const search = permSearchTerm.toLowerCase();
      const nameMatch = meta.labelAr.toLowerCase().includes(search) || meta.labelEn.toLowerCase().includes(search);
      const idMatch = modId.toLowerCase().includes(search);
      return nameMatch || idMatch;
    });
  };

  // Calculations for UI state
  const getUserAssignedRoleNames = (user: User) => {
    const idsVal = user.role_ids as any;
    const ids = Array.isArray(idsVal) 
      ? idsVal 
      : (typeof idsVal === 'string' 
          ? (idsVal.startsWith('[') ? JSON.parse(idsVal) : (idsVal ? [idsVal] : [])) 
          : []);
    console.log("getUserAssignedRoleNames details:", {
      typeofVal: typeof idsVal,
      value: idsVal,
      isArray: Array.isArray(idsVal),
      parsedIds: ids
    });
    return roles.filter(r => ids.includes(r.id)).map(r => translateRoleName(r.name, language)).join(language === 'ar' ? '\u060c ' : ', ') || (language === 'ar' ? '\u0644\u0627 \u064a\u0648\u062c\u062f \u0623\u062f\u0648\u0627\u0631' : 'No roles');
  };

  const getInheritedPermissionState = (modId: string, permKey: string) => {
    if (permissionsTargetType === 'role') return false;
    const roleIdsVal = tempUserRoleIds as any;
    const roleIds = Array.isArray(roleIdsVal) 
      ? roleIdsVal 
      : (typeof roleIdsVal === 'string' 
          ? (roleIdsVal.startsWith('[') ? JSON.parse(roleIdsVal) : (roleIdsVal ? [roleIdsVal] : [])) 
          : []);
    const assignedRoles = roles.filter(r => roleIds.includes(r.id));
    return assignedRoles.some(r => r.permissions[modId]?.[permKey] === true);
  };

  const getInheritedListState = (modId: string, listKey: string): string[] => {
    if (permissionsTargetType === 'role') return [];
    const roleIdsVal = tempUserRoleIds as any;
    const roleIds = Array.isArray(roleIdsVal) 
      ? roleIdsVal 
      : (typeof roleIdsVal === 'string' 
          ? (roleIdsVal.startsWith('[') ? JSON.parse(roleIdsVal) : (roleIdsVal ? [roleIdsVal] : [])) 
          : []);
    const assignedRoles = roles.filter(r => roleIds.includes(r.id));
    const merged: string[] = [];
    assignedRoles.forEach(r => {
      const ids = r.permissions?.[modId]?.[listKey] || [];
      if (Array.isArray(ids)) {
        ids.forEach((id: string) => {
          if (!merged.includes(id)) merged.push(id);
        });
      }
    });
    return merged;
  };

  return (
    <div className={`space-y-6 animate-in fade-in duration-500 ${language === 'ar' ? 'text-right' : 'text-left'}`} dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {isPermissionsModalOpen ? (
        /* Inline Permissions Screen Container */
        <div className="bg-white w-full rounded-3xl border border-slate-200 shadow-md overflow-hidden flex flex-col min-h-[80vh] relative animate-in slide-in-from-bottom-4 duration-300" dir={language === 'ar' ? 'rtl' : 'ltr'}>
        {/* Permissions & Roles View Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 sticky top-0 z-[70] flex-wrap gap-4 shrink-0">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsPermissionsModalOpen(false)}
              className="flex items-center gap-1 px-3 py-1.5 bg-white text-slate-650 border border-slate-200 hover:bg-slate-50 hover:text-slate-900 rounded-xl transition-all font-bold text-xs shadow-sm"
            >
              {language === 'ar' ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
              <span>{language === 'ar' ? 'العودة للقائمة' : 'Return to List'}</span>
            </button>
            <div className="w-px h-6 bg-slate-200" />
            <div>
              <h3 className="text-lg font-black text-slate-900 leading-tight">
                {permissionsTargetType === 'user' && selectedUser 
                  ? `${language === 'ar' ? 'صلاحيات وأدوار المستخدم:' : 'User Permissions & Roles:'} ${selectedUser.username}` 
                  : `${language === 'ar' ? 'صلاحيات الدور الوظيفي:' : 'Job Role Permissions:'} ${translateRoleName(selectedRole?.name || '', language)}`}
              </h3>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tight mt-0.5">{language === 'ar' ? 'حدد الصلاحيات العامة والخاصة والأدوار الوظيفية' : 'Select general & business permissions and job roles'}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsPermissionsModalOpen(false)}
              className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all border border-slate-200 active:scale-95 text-xs"
            >
              {language === 'ar' ? 'إلغاء' : 'Cancel'}
            </button>
            {!(permissionsTargetType === 'user' && (selectedUser?.role === 'admin' || selectedUser?.role === 'super_admin')) && (
              <button
                onClick={savePermissions}
                disabled={loading}
                className="px-6 py-2 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 disabled:opacity-50 transition-all shadow-md active:scale-95 text-xs flex items-center gap-2"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Save size={14} />
                )}
                <span>{loading ? (language === 'ar' ? 'جاري الحفظ...' : 'Saving...') : (language === 'ar' ? 'حفظ التعديلات وتطبيقها' : 'Save & Apply Changes')}</span>
              </button>
            )}
          </div>
        </div>

          {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 bg-slate-50/40 custom-scrollbar space-y-6">
              {permissionsTargetType === 'user' && selectedUser && (selectedUser.role === 'admin' || selectedUser.role === 'super_admin') ? (
                <div className="bg-emerald-50/50 border border-emerald-100 p-8 rounded-3xl flex flex-col items-center justify-center text-center gap-4 text-emerald-700">
                  <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-2">
                    <Shield size={40} className="shrink-0" />
                  </div>
                  <div className="max-w-md">
                    <h4 className="font-black text-2xl tracking-tight mb-2">{language === 'ar' ? 'مدير عام للنظام' : 'System Administrator'}</h4>
                    <p className="text-sm font-bold opacity-70 leading-relaxed">{language === 'ar' ? '\u0627\u0644\u0645\u0634\u0631\u0641\u064a\u0646 \u0627\u0644\u0639\u0627\u0645\u064a\u0646 \u064a\u0645\u062a\u0644\u0643\u0648\u0646 \u062a\u0644\u062a\u0627\u0626\u064a\u0627\u064b \u0635\u0644\u0627\u062d\u064a\u0627\u062a \u0643\u0627\u0645\u0644\u0629 \u0639\u0644\u0649 \u0643\u0644 \u0627\u0644\u0634\u0627\u0634\u0627\u062a \u0648\u0627\u0644\u0645\u0633\u062a\u0646\u062f\u0627\u062a \u0648\u0644\u0627 \u064a\u0645\u0643\u0646 \u062a\u0642\u064a\u064a\u062f \u0635\u0644\u0627\u062d\u064a\u0627\u062a\u0647\u0645.' : 'Administrators possess full permissions over all screens and documents and cannot be restricted.'}</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Top Bar Actions: Copy / Inherit / Search */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                    {/* Search */}
                    <div className="relative">
                      <input 
                        type="text"
                        placeholder={language === 'ar' ? 'البحث السريع عن شاشة أو صلاحية...' : 'Quick search for screen or permission...'}
                        className="premium-input pr-10 w-full text-xs font-bold py-3"
                        value={permSearchTerm}
                        onChange={e => setPermSearchTerm(e.target.value)}
                      />
                      <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    </div>

                    {/* Copy Permissions */}
                    {permissionsTargetType === 'user' && (
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-bold text-slate-500 whitespace-nowrap">{language === 'ar' ? 'نسخ من:' : 'Copy from:'}</label>
                        <select 
                          className="premium-input py-2.5 text-xs font-bold w-full bg-slate-50"
                          defaultValue=""
                          onChange={(e) => {
                            if (e.target.value) {
                              handleCopyPermissions(e.target.value);
                              e.target.value = "";
                            }
                          }}
                        >
                          <option value="">{language === 'ar' ? '-- اختر مستخدماً للنسخ --' : '-- Choose a user to copy --'}</option>
                          {users
                            .filter(u => u.id !== selectedUser?.id && u.role !== 'admin' && u.role !== 'super_admin')
                            .map(u => (
                              <option key={u.id} value={u.id}>{u.username}</option>
                            ))}
                        </select>
                      </div>
                    )}

                    {/* Restore Defaults */}
                    {permissionsTargetType === 'user' && (
                      <div className="flex justify-end">
                        <button 
                          onClick={handleRestoreDefaults}
                          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-650 border border-slate-250 rounded-xl text-xs font-bold transition-all"
                        >
                          <RefreshCw size={14} />
                          {language === 'ar' ? 'استعادة قيم الأدوار الافتراضية' : 'Restore Default Role Values'}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Role Selection (Only for User Target) */}
                  {permissionsTargetType === 'user' && (
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                      <h4 className="font-black text-sm text-slate-900 flex items-center gap-2">
                        <Shield className="text-emerald-600" size={18} />
                        {language === 'ar' ? '\u0627\u0644\u0623\u062f\u0648\u0627\u0631 \u0627\u0644\u0648\u0638\u064a\u0641\u064a\u0629 \u0644\u0644\u0645\u0633\u062a\u062e\u062f\u0645' : 'User Job Roles'}
                      </h4>
                      <p className="text-xs text-slate-550">{language === 'ar' ? '\u0642\u0645 \u0628\u062a\u062d\u062f\u064a\u062f \u062f\u0648\u0631 \u0648\u0627\u062d\u062f \u0623\u0648 \u0623\u0643\u062b\u0631 \u0644\u0644\u0645\u0633\u062a\u062e\u062f\u0645 \u0644\u064a\u0642\u0648\u0645 \u0628\u0648\u0631\u0627\u062b\u0629 \u0635\u0644\u0627\u062d\u064a\u0627\u062a\u0647 \u062a\u0644\u0642\u0627\u0626\u064a\u0627\u064b\u060c \u0648\u064a\u0645\u0643\u0646\u0643 \u062a\u0639\u064a\u064a\u0646 \u0635\u0644\u0627\u062d\u064a\u0627\u062a \u0645\u062e\u0635\u0635\u0629 \u0628\u0627\u0644\u0623\u0633\u0641\u0644.' : 'Select one or more job roles for the user to inherit their permissions automatically. You can customize permissions below.'}</p>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {roles.map(role => (
                          <label 
                            key={role.id}
                            className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer hover:bg-slate-50 transition-all ${
                              (() => {
                                const roleIdsVal = tempUserRoleIds;
                                return Array.isArray(roleIdsVal) && roleIdsVal.includes(role.id);
                              })() 
                                ? 'border-emerald-500 bg-emerald-50/40 text-emerald-900 font-bold' 
                                : 'border-slate-200 text-slate-700'
                            }`}
                          >
                            <span className="text-xs">{translateRoleName(role.name, language)}</span>
                            <input 
                              type="checkbox"
                              checked={(() => {
                                const roleIdsVal = tempUserRoleIds;







                                return Array.isArray(roleIdsVal) && roleIdsVal.includes(role.id);
                              })()}
                              onChange={() => toggleUserRoleAssignment(role.id)}
                              className="w-4 h-4 accent-emerald-600"
                            />
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Tab Switcher */}
                  <div className="flex border-b border-slate-200 mb-6 bg-slate-50/50 p-1 rounded-2xl">
                    <button
                      type="button"
                      onClick={() => setPermissionsTab('basic')}
                      className={`flex-1 py-3 text-xs font-black rounded-xl transition-all ${
                        permissionsTab === 'basic'
                          ? 'bg-white text-emerald-700 shadow-sm'
                          : 'text-slate-500 hover:text-slate-900'
                      }`}
                    >
                      {language === 'ar' ? 'صلاحيات الشاشات الأساسية (CRUD)' : 'Basic Screen Permissions (CRUD)'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPermissionsTab('documents')}
                      className={`flex-1 py-3 text-xs font-black rounded-xl transition-all ${
                        permissionsTab === 'documents'
                          ? 'bg-white text-emerald-700 shadow-sm'
                          : 'text-slate-500 hover:text-slate-900'
                      }`}
                    >
                      {language === 'ar' ? 'صلاحيات المستندات والحقول (Business Permissions)' : 'Document & Field Permissions (Business Permissions)'}
                    </button>
                  </div>

                  {permissionsTab === 'basic' ? (
                    <div className="space-y-6">
                      {/* Batch Select Actions Columns */}
                      <div className="bg-white p-4 rounded-xl border border-slate-200 text-xs font-bold flex flex-wrap gap-4 items-center justify-between shadow-sm">
                        <span className="text-slate-500">{language === 'ar' ? 'تحديد أعمدة كاملة بضغطة واحدة:' : 'Select entire columns with one click:'}</span>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => toggleColumnAll('view', true)} className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg">{language === 'ar' ? 'تحديد كل العرض' : 'Select All View'}</button>
                          <button type="button" onClick={() => toggleColumnAll('view', false)} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-750 rounded-lg">{language === 'ar' ? 'إلغاء كل العرض' : 'Clear All View'}</button>
                          <span className="border-l border-slate-200 mx-1"></span>
                          <button type="button" onClick={() => toggleColumnAll('create', true)} className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg">{language === 'ar' ? 'تحديد كل الإضافة' : 'Select All Create'}</button>
                          <button type="button" onClick={() => toggleColumnAll('create', false)} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-750 rounded-lg">{language === 'ar' ? 'إلغاء كل الإضافة' : 'Clear All Create'}</button>
                          <span className="border-l border-slate-200 mx-1"></span>
                          <button type="button" onClick={() => toggleColumnAll('edit', true)} className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg">{language === 'ar' ? 'تحديد كل التعديل' : 'Select All Edit'}</button>
                          <button type="button" onClick={() => toggleColumnAll('edit', false)} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-750 rounded-lg">{language === 'ar' ? 'إلغاء كل التعديل' : 'Clear All Edit'}</button>
                          <span className="border-l border-slate-200 mx-1"></span>
                          <button type="button" onClick={() => toggleColumnAll('delete', true)} className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg">{language === 'ar' ? 'تحديد كل الحذف' : 'Select All Delete'}</button>
                          <button type="button" onClick={() => toggleColumnAll('delete', false)} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-750 rounded-lg">{language === 'ar' ? 'إلغاء كل الحذف' : 'Clear All Delete'}</button>
                        </div>
                      </div>

                      {/* Accordion List of Groups */}
                      <div className="space-y-4">
                        {PERMISSION_GROUPS.map((group) => {
                          const matchedModules = filteredModules(group.modules);
                          if (matchedModules.length === 0 && permSearchTerm) return null;

                          const isExpanded = !!expandedSections[group.id];
                          
                          return (
                            <div key={group.id} className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden transition-all">
                              {/* Accordion Header */}
                              <div 
                                onClick={() => toggleSection(group.id)}
                                className="p-5 flex items-center justify-between bg-slate-50/50 hover:bg-slate-50 cursor-pointer border-b border-slate-100 transition-all select-none"
                              >
                                <div className="flex items-center gap-3">
                                  <span className="font-black text-slate-800 text-base">{language === 'ar' ? group.nameAr : group.nameEn}</span>
                                  <span className="text-[10px] text-slate-400 font-bold uppercase font-mono">({matchedModules.length})</span>
                                </div>
                                
                                {/* Section Batch Select Actions */}
                                <div className="flex items-center gap-4" onClick={e => e.stopPropagation()}>
                                  <button 
                                    type="button"
                                    onClick={() => toggleSectionAll(group.modules, true)}
                                    className="text-xs text-emerald-650 hover:text-emerald-700 font-bold bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-sm hover:bg-slate-50 transition-all active:scale-95"
                                  >
                                    {language === 'ar' ? 'تحديد الكل بالقسم' : 'Select All in Section'}
                                  </button>
                                  <button 
                                    type="button"
                                    onClick={() => toggleSectionAll(group.modules, false)}
                                    className="text-xs text-slate-600 hover:text-slate-800 font-bold bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-sm hover:bg-slate-50 transition-all active:scale-95"
                                  >
                                    {language === 'ar' ? 'إلغاء الكل بالقسم' : 'Clear All in Section'}
                                  </button>
                                  <div className="text-slate-300">|</div>
                                  <div className="text-slate-400 transition-transform duration-200">
                                    {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                  </div>
                                </div>
                              </div>

                              {/* Accordion Content */}
                              {isExpanded && (
                                <div className="p-6 bg-white space-y-4">
                                  {matchedModules.map(modId => {
                                    const meta = MODULE_PERMISSIONS_META[modId];
                                    if (!meta) return null;
                                    
                                    return (
                                      <div key={modId} className="p-4 bg-slate-50/40 rounded-2xl border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                        <div className="flex items-center gap-2 max-w-sm">
                                          <span className="font-bold text-sm text-slate-900">{language === 'ar' ? meta.labelAr : meta.labelEn}</span>
                                          <span className="text-[10px] text-slate-350 font-mono font-bold tracking-tight">({modId})</span>
                                          <div className="relative group inline-block">
                                            <HelpCircle className="w-4 h-4 text-slate-400 cursor-pointer" />
                        <div className={`absolute z-[100] hidden group-hover:block bg-slate-900 text-white text-xs rounded-xl p-3 w-64 shadow-xl border border-slate-700 -top-2 right-6 ${language === 'ar' ? 'dir-rtl text-right' : 'dir-ltr text-left'} font-medium leading-relaxed`}>
                                              {language === 'ar' ? `لوحة أو مستند ${meta.labelAr} لتسجيل وإدارة ومتابعة العمليات.` : `Page/Document ${meta.labelEn}.`}
                                            </div>
                                          </div>
                                        </div>

                                        {meta.hasCrud ? (
                                          <div className="flex flex-wrap gap-3">
                                            {(['view', 'create', 'edit', 'delete'] as const).map(actionKey => {
                                              const inherited = getInheritedPermissionState(modId, actionKey);
                                              const overrideValue = tempPermissions[modId]?.[actionKey];
                                              const effectiveValue = overrideValue !== undefined ? overrideValue : inherited;
                                              const labelMap = language === 'ar' ? { view: 'عرض', create: 'إضافة', edit: 'تعديل', delete: 'حذف' } : { view: 'View', create: 'Create', edit: 'Edit', delete: 'Delete' };

                                              return (
                                                <button
                                                  key={actionKey}
                                                  type="button"
                                                  onClick={() => togglePermission(modId, actionKey)}
                                                  className={`flex items-center gap-2 px-3 py-2 border rounded-xl text-xs font-bold transition-all relative ${
                                                    effectiveValue 
                                                      ? 'border-emerald-600 bg-emerald-50/50 text-emerald-900 shadow-sm' 
                                                      : 'border-slate-200 text-slate-400 hover:bg-slate-50'
                                                  }`}
                                                >
                                                  <div className={`w-4 h-4 rounded flex items-center justify-center border transition-all ${
                                                    effectiveValue 
                                                      ? 'border-emerald-600 bg-emerald-600 text-white' 
                                                      : 'border-slate-300'
                                                  }`}>
                                                    {effectiveValue && <Check size={12} />}
                                                  </div>
                                                  <span>{labelMap[actionKey]}</span>

                                                  {permissionsTargetType === 'user' && (
                                                    <>
                                                      {overrideValue !== undefined ? (
                                                        <span className="w-1.5 h-1.5 bg-blue-500 rounded-full absolute -top-1 -left-1" title={language === 'ar' ? "صلاحية مخصصة (تم تعديلها يدوياً)" : "Custom permission (modified manually)"} />
                                                      ) : inherited ? (
                                                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full absolute -top-1 -left-1" title={language === 'ar' ? "موروث من الأدوار الوظيفية للمستخدم" : "Inherited from user job roles"} />
                                                      ) : null}
                                                    </>
                                                  )}
                                                </button>
                                              );
                                            })}
                                          </div>
                                        ) : (
                                          <div className="text-xs text-slate-400 italic">{language === 'ar' ? 'هذه الشاشة/التقرير لا تدعم الإدخال الأساسي CRUD' : 'This screen/report does not support basic CRUD entry'}</div>
                                        )}

                                        {meta.special && meta.special.length > 0 && (
                                          <div className="w-full mt-3 p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-2">
                                            <span className="text-[9px] text-slate-455 font-bold uppercase tracking-wider block">{language === 'ar' ? 'تراخيص إضافية:' : 'Additional Permissions:'}</span>
                                            <div className="flex flex-wrap gap-2">
                                              {meta.special.map(spKey => {
                                                const descObj = SPECIAL_PERMISSIONS_DESC[spKey];
                                                const inherited = getInheritedPermissionState(modId, spKey);
                                                const overrideValue = tempPermissions[modId]?.[spKey];
                                                const effectiveValue = overrideValue !== undefined ? overrideValue : inherited;

                                                return (
                                                  <div key={spKey} className="relative group/tooltip">
                                                    <button
                                                      type="button"
                                                      onClick={() => togglePermission(modId, spKey)}
                                                      className={`flex items-center gap-2 px-2.5 py-1.5 border rounded-lg text-[11px] font-bold transition-all relative ${
                                                        effectiveValue
                                                          ? 'border-purple-600 bg-purple-50 text-purple-950 shadow-sm'
                                                          : 'border-slate-200 text-slate-400'
                                                      }`}
                                                    >
                                                      <input 
                                                        type="checkbox"
                                                        checked={effectiveValue}
                                                        onChange={() => {}}
                                                        className="w-3.5 h-3.5 accent-purple-600 pointer-events-none rounded"
                                                      />
                                                      <span>{(language === 'ar' ? descObj?.ar : descObj?.en) || spKey}</span>
                                                      
                                                      {permissionsTargetType === 'user' && (
                                                        <>
                                                          {overrideValue !== undefined ? (
                                                            <span className="w-1 h-1 bg-blue-500 rounded-full absolute -top-0.5 -left-0.5" />
                                                          ) : inherited ? (
                                                            <span className="w-1 h-1 bg-emerald-500 rounded-full absolute -top-0.5 -left-0.5" />
                                                          ) : null}
                                                        </>
                                                      )}
                                                    </button>
                                                    
                                                    {descObj && (
                        <div className={`absolute z-[110] hidden group-hover/tooltip:block bg-slate-900 text-white text-[10px] rounded-lg p-2.5 w-56 shadow-2xl border border-slate-700 -top-2 right-6 ${language === 'ar' ? 'dir-rtl text-right' : 'dir-ltr text-left'} font-medium leading-relaxed`}>
                                                        {language === 'ar' ? descObj.descAr : descObj.descEn}
                                                      </div>
                                                    )}
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    /* Document specific permissions tab */
                    <div className={`space-y-4 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
                      {Object.keys(DOCUMENT_BUSINESS_PERMISSIONS).map(modId => {
                        const permList = DOCUMENT_BUSINESS_PERMISSIONS[modId];
                        const label = language === 'ar' ? (MODULE_PERMISSIONS_META[modId]?.labelAr || modId) : (MODULE_PERMISSIONS_META[modId]?.labelEn || modId);
                        const isExpanded = !!expandedSections[`doc_${modId}`];

                        return (
                          <div key={modId} className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden transition-all">
                            <div 
                              onClick={() => {
                                setExpandedSections(prev => ({ ...prev, [`doc_${modId}`]: !prev[`doc_${modId}`] }));
                              }}
                              className="p-5 flex items-center justify-between bg-slate-50/50 hover:bg-slate-50 cursor-pointer border-b border-slate-100 transition-all select-none"
                            >
                              <div className="flex items-center gap-3">
                                <span className="font-black text-slate-800 text-base">{label}</span>
                                <span className="text-[10px] text-slate-400 font-bold uppercase font-mono">({permList.length})</span>
                              </div>
                              <div className="text-slate-400">
                                {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                              </div>
                            </div>

                            {isExpanded && (
                              <div className="p-6 bg-white space-y-6 divide-y divide-slate-100">
                                {permList.map(perm => {
                                  if (perm.type === 'boolean') {
                                    const roleVal = getInheritedPermissionState(modId, perm.id);
                                    const overrideVal = tempPermissions[modId]?.[perm.id];
                                    const isOverridden = overrideVal !== undefined;
                                    const activeVal = overrideVal !== undefined ? overrideVal : roleVal;

                                    return (
                                      <div key={perm.id} className="pt-4 first:pt-0 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                        <div className={`max-w-xl ${language === 'ar' ? 'text-right' : 'text-left'}`}>
                                          <h5 className="font-extrabold text-sm text-slate-900">{language === 'ar' ? perm.labelAr : perm.labelEn}</h5>
                                          <p className="text-xs text-slate-455 mt-1 leading-relaxed">{language === 'ar' ? perm.descriptionAr : perm.descriptionEn}</p>
                                        </div>

                                        <div>
                                          {permissionsTargetType === 'user' ? (
                                            <select
                                              value={overrideVal === undefined ? 'inherit' : overrideVal.toString()}
                                              onChange={(e) => {
                                                const value = e.target.value;
                                                setTempPermissions((prev) => {
                                                  const current = prev[modId] || {};
                                                  return {
                                                    ...prev,
                                                    [modId]: {
                                                      ...current,
                                                      [perm.id]: value === 'inherit' ? undefined : value === 'true'
                                                    }
                                                  };
                                                });
                                              }}
                                              className={`text-xs font-bold px-3 py-2 rounded-xl border ${
                                                isOverridden 
                                                  ? 'border-blue-300 bg-blue-50/50 text-blue-900' 
                                                  : 'border-slate-200 bg-white text-slate-700'
                                              }`}
                                            >
                                              <option value="inherit">{language === 'ar' ? `موروث (${roleVal ? 'سماح' : 'منع'})` : `Inherited (${roleVal ? 'Allow' : 'Deny'})`}</option>
                                              <option value="true">{language === 'ar' ? 'سماح (نعم)' : 'Allow (Yes)'}</option>
                                              <option value="false">{language === 'ar' ? 'منع (لا)' : 'Deny (No)'}</option>
                                            </select>
                                          ) : (
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setTempPermissions((prev) => {
                                                  const current = prev[modId] || {};
                                                  return {
                                                    ...prev,
                                                    [modId]: {
                                                      ...current,
                                                      [perm.id]: !current[perm.id]
                                                    }
                                                  };
                                                });
                                              }}
                                              className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-bold transition-all ${
                                                activeVal 
                                                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                                                  : 'bg-slate-50 border-slate-200 text-slate-400'
                                              }`}
                                            >
                                              <input 
                                                type="checkbox"
                                                checked={activeVal}
                                                onChange={() => {}}
                                                className="pointer-events-none"
                                              />
                                              {language === 'ar' ? 'مسموح' : 'Allowed'}
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  } else {
                                    // Selection / checklist permissions
                                    const restrictionKey = perm.id;
                                    const allowedIdsKey = perm.selectionType === 'warehouses' 
                                      ? 'allowed_warehouse_ids' 
                                      : perm.selectionType === 'cash_balances' 
                                        ? 'allowed_safe_ids' 
                                        : perm.selectionType === 'banks'
                                          ? 'allowed_bank_ids'
                                          : perm.selectionType === 'departments'
                                            ? 'allowed_department_ids'
                                            : perm.selectionType === 'cost_centers'
                                              ? 'allowed_cost_center_ids'
                                              : perm.selectionType === 'payment_methods'
                                                ? 'allowed_payment_method_ids'
                                                : '';

                                    const isRestrictedRole = tempPermissions[modId]?.[restrictionKey] === true;
                                     const allowedIdsRoleRaw = tempPermissions[modId]?.[allowedIdsKey] || [];
                                     const allowedIdsRole = Array.isArray(allowedIdsRoleRaw)
                                       ? allowedIdsRoleRaw
                                       : (typeof allowedIdsRoleRaw === 'string'
                                           ? (allowedIdsRoleRaw.startsWith('[') ? JSON.parse(allowedIdsRoleRaw) : (allowedIdsRoleRaw ? [allowedIdsRoleRaw] : []))
                                           : []);

                                    // Inherit references
                                    const isRestrictedInherited = getInheritedPermissionState(modId, restrictionKey) === true;
                                    const allowedIdsInherited = getInheritedListState(modId, allowedIdsKey);

                                    // User override refs
                                    const userOverrideRestrict = tempPermissions[modId]?.[restrictionKey];
                                    const isOverridden = userOverrideRestrict !== undefined;

                                    const activeRestrict = userOverrideRestrict !== undefined 
                                      ? userOverrideRestrict 
                                      : isRestrictedInherited;

                                     const activeAllowedIdsRaw = userOverrideRestrict !== undefined
                                       ? (tempPermissions[modId]?.[allowedIdsKey] || [])
                                       : allowedIdsInherited;
                                     const activeAllowedIds = Array.isArray(activeAllowedIdsRaw)
                                       ? activeAllowedIdsRaw
                                       : (typeof activeAllowedIdsRaw === 'string'
                                           ? (activeAllowedIdsRaw.startsWith('[') ? JSON.parse(activeAllowedIdsRaw) : (activeAllowedIdsRaw ? [activeAllowedIdsRaw] : []))
                                           : []);

                                    // Fetch list records
                                    const listResources = perm.selectionType === 'warehouses' 
                                       ? warehousesList 
                                       : perm.selectionType === 'cash_balances'
                                         ? paymentMethodsList.filter(pm => pm.type === 'cash' || pm.type === 'wallet')
                                         : perm.selectionType === 'banks'
                                           ? paymentMethodsList.filter(pm => pm.type === 'bank')
                                           : perm.selectionType === 'departments'
                                             ? departmentsList
                                             : perm.selectionType === 'cost_centers'
                                               ? costCentersList
                                               : perm.selectionType === 'payment_methods'
                                                 ? paymentMethodsList
                                                 : [];

                                    return (
                                      <div key={perm.id} className="pt-4 first:pt-0 flex flex-col gap-4">
                                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                          <div className={`max-w-xl ${language === 'ar' ? 'text-right' : 'text-left'}`}>
                                            <h5 className="font-extrabold text-sm text-slate-900">{language === 'ar' ? perm.labelAr : perm.labelEn}</h5>
                                            <p className="text-xs text-slate-455 mt-1 leading-relaxed">{language === 'ar' ? perm.descriptionAr : perm.descriptionEn}</p>
                                          </div>

                                          <div>
                                            {permissionsTargetType === 'user' ? (
                                              <select
                                                value={userOverrideRestrict === undefined ? 'inherit' : userOverrideRestrict ? 'restrict' : 'all'}
                                                onChange={(e) => {
                                                  const val = e.target.value;
                                                  setTempPermissions((prev) => {
                                                    const current = prev[modId] || {};
                                                    if (val === 'inherit') {
                                                      const updated = { ...current };
                                                      delete updated[restrictionKey];
                                                      delete updated[allowedIdsKey];
                                                      return { ...prev, [modId]: updated };
                                                    } else if (val === 'restrict') {
                                                      return {
                                                        ...prev,
                                                        [modId]: {
                                                          ...current,
                                                          [restrictionKey]: true,
                                                          [allowedIdsKey]: allowedIdsInherited
                                                        }
                                                      };
                                                    } else {
                                                      return {
                                                        ...prev,
                                                        [modId]: {
                                                          ...current,
                                                          [restrictionKey]: false,
                                                          [allowedIdsKey]: []
                                                        }
                                                      };
                                                    }
                                                  });
                                                }}
                                                className={`text-xs font-bold px-3 py-2 rounded-xl border ${
                                                  isOverridden 
                                                    ? 'border-blue-300 bg-blue-50/50 text-blue-900' 
                                                    : 'border-slate-200 bg-white text-slate-700'
                                                }`}
                                              >
                                                <option value="inherit">{language === 'ar' ? `موروث (${isRestrictedInherited ? 'تقييد' : 'سماح بالكل'})` : `Inherited (${isRestrictedInherited ? 'Restricted' : 'Allow All'})`}</option>
                                                <option value="restrict">{language === 'ar' ? 'تخصيص (تقييد بسجلات محددة)' : 'Customize (Restrict to specific records)'}</option>
                                                <option value="all">{language === 'ar' ? 'سماح بالكل (غير مقيد)' : 'Allow All (Unrestricted)'}</option>
                                              </select>
                                            ) : (
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  setTempPermissions((prev) => {
                                                    const current = prev[modId] || {};
                                                    const nextRestricted = !current[restrictionKey];
                                                    return {
                                                      ...prev,
                                                      [modId]: {
                                                        ...current,
                                                        [restrictionKey]: nextRestricted,
                                                        [allowedIdsKey]: nextRestricted ? (current[allowedIdsKey] || []) : []
                                                      }
                                                    };
                                                  });
                                                }}
                                                className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-bold transition-all ${
                                                  isRestrictedRole 
                                                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                                                    : 'bg-slate-50 border-slate-200 text-slate-450'
                                                }`}
                                              >
                                                <input 
                                                  type="checkbox"
                                                  checked={isRestrictedRole}
                                                  onChange={() => {}}
                                                  className="pointer-events-none"
                                                />
                                                {language === 'ar' ? 'تقييد الوصول' : 'Restrict Access'}
                                              </button>
                                            )}
                                          </div>
                                        </div>

                                        {/* Records Checklist */}
                                        {activeRestrict && (
                                          <div className={`bg-slate-50/60 p-5 rounded-2xl border border-slate-200 space-y-3 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
                                            <span className="text-xs font-black text-slate-500">{language === 'ar' ? 'السجلات المسموح بها للمستخدم:' : 'Allowed records for this user:'}</span>
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                              {listResources.map(item => {







                                                 const isChecked = Array.isArray(activeAllowedIds) && activeAllowedIds.includes(item.id);
                                                const isChangeDisabled = permissionsTargetType === 'user' && userOverrideRestrict !== true;

                                                return (
                                                  <label 
                                                    key={item.id} 
                                                    className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all bg-white text-xs font-bold ${
                                                      isChecked 
                                                        ? 'border-emerald-500 bg-emerald-50/40 text-emerald-950' 
                                                        : 'border-slate-200 text-slate-650 hover:bg-slate-50/50'
                                                    } ${isChangeDisabled ? 'opacity-60 cursor-not-allowed' : ''}`}
                                                  >
                                                    <span>{item.name}</span>
                                                    <input 
                                                      type="checkbox"
                                                      checked={isChecked}
                                                      disabled={isChangeDisabled}
                                                      onChange={(e) => {
                                                        const checked = e.target.checked;
                                                        setTempPermissions((prev) => {
                                                          const current = prev[modId] || {};
                                                          const currentList = current[allowedIdsKey] || [];
                                                          let nextList = [...currentList];
                                                          if (checked) {
                                                            if (!nextList.includes(item.id)) nextList.push(item.id);
                                                          } else {
                                                            nextList = nextList.filter(id => id !== item.id);
                                                          }
                                                          return {
                                                            ...prev,
                                                            [modId]: {
                                                              ...current,
                                                              [allowedIdsKey]: nextList
                                                            }
                                                          };
                                                        });
                                                      }}
                                                      className="w-4 h-4 accent-emerald-600"
                                                    />
                                                  </label>
                                                );
                                              })}
                                            </div>
                                            {listResources.length === 0 && (
                                              <p className="text-xs font-bold text-slate-400 text-center">{language === 'ar' ? 'لا توجد سجلات مسجلة حالياً.' : 'No records registered currently.'}</p>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  }
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-slate-100 bg-white flex flex-col md:flex-row items-center justify-between gap-4 shrink-0">
              <div className="flex items-center gap-2 text-slate-400">
                <AlertCircle size={16} />
                <span className="text-[10px] font-bold uppercase tracking-tight">{language === 'ar' ? 'سيتم تطبيق التغييرات فور الحفظ وتحديث الجلسات.' : 'Changes will take effect immediately upon saving.'}</span>
              </div>
              <div className="flex gap-3 w-full md:w-auto">
                <button 
                  onClick={() => setIsPermissionsModalOpen(false)}
                  className="flex-1 md:flex-none px-6 py-3 bg-slate-50 text-slate-650 border border-slate-200 rounded-2xl font-bold hover:bg-slate-100 transition-all"
                >
                  {language === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
                {!(permissionsTargetType === 'user' && (selectedUser?.role === 'admin' || selectedUser?.role === 'super_admin')) && (
                  <button 
                    onClick={savePermissions}
                    disabled={loading}
                    className="flex-1 md:flex-none px-8 py-3 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-500/20 disabled:opacity-50 active:scale-95"
                  >
                    {loading ? (language === 'ar' ? 'جاري الحفظ...' : 'Saving...') : (language === 'ar' ? 'حفظ التعديلات وتطبيقها' : 'Save & Apply Changes')}
                  </button>
                )}
              </div>
            </div>
        </div>
      ) : (
        /* Users & Job Roles List Screen */
        <>
          {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-emerald-600 text-white rounded-3xl flex items-center justify-center shadow-xl shadow-emerald-500/20">
            <Lock size={28} />
          </div>
          <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tighter italic serif">{language === 'ar' ? 'الصلاحيات والأدوار' : 'Permissions & Roles'}</h2>
            <p className="text-slate-500 font-medium mt-1">{language === 'ar' ? 'تعديل صلاحيات المستخدمين والأدوار الوظيفية داخل النظام بالكامل' : 'Modify user permissions and job roles across the entire system'}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => {
              setActivityLogDocumentId(undefined);
              setIsActivityLogOpen(true);
            }}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-white text-slate-600 border border-slate-200 rounded-2xl font-bold hover:bg-slate-50 transition-all active:scale-95 shadow-sm"
          >
            <History size={20} />
            <span>{language === 'ar' ? 'سجل الرقابة' : 'Audit Log'}</span>
          </button>
          
          {activeTab === 'users' ? (
            <button 
              onClick={() => setIsUserModalOpen(true)}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-500/20 active:scale-95"
            >
              <Plus size={20} />
              {language === 'ar' ? 'إضافة مستخدم جديد' : 'Add New User'}
            </button>
          ) : (
            <button 
              onClick={() => {
                setEditingRole(null);
                setRoleFormData({ name: '', description: '' });
                setIsRoleModalOpen(true);
              }}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-500/20 active:scale-95"
            >
              <Plus size={20} />
              {language === 'ar' ? 'إضافة دور جديد' : 'Add New Role'}
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-6 border-b border-slate-200">
        <button 
          onClick={() => setActiveTab('users')} 
          className={`pb-4 px-2 font-black text-lg border-b-4 transition-all relative ${
            activeTab === 'users' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          {language === 'ar' ? 'المستخدمين' : 'Users'}
        </button>
        <button 
          onClick={() => setActiveTab('roles')} 
          className={`pb-4 px-2 font-black text-lg border-b-4 transition-all relative ${
            activeTab === 'roles' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          {language === 'ar' ? 'الأدوار الوظيفية' : 'Job Roles'}
        </button>
      </div>

      {/* Content Panel */}
      {activeTab === 'users' ? (
        <div className="space-y-6">
          {/* User Search Input */}
          <div className="relative w-full max-w-md">
            <input 
              type="text"
              placeholder={language === 'ar' ? 'البحث عن مستخدم...' : 'Search for user...'}
              className={`premium-input w-full font-bold ${language === 'ar' ? 'pr-12' : 'pl-12'}`}
              value={userSearchTerm}
              onChange={e => setUserSearchTerm(e.target.value)}
            />
            <Search className={`absolute top-1/2 -translate-y-1/2 text-slate-450 ${language === 'ar' ? 'right-4' : 'left-4'}`} size={20} />
          </div>

          {/* Users Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {users
              .filter(u => u.username.toLowerCase().includes(userSearchTerm.toLowerCase()) || u.email?.toLowerCase().includes(userSearchTerm.toLowerCase()))
              .map((user) => (
                <div key={user.id} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all group relative">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 ${user.role === 'admin' || user.role === 'super_admin' ? 'bg-emerald-50 text-emerald-600 shadow-inner' : user.role === 'manager' ? 'bg-blue-50 text-blue-600 shadow-inner' : 'bg-slate-50 text-slate-400 shadow-inner'}`}>
                      {user.role === 'admin' || user.role === 'super_admin' ? <Shield size={24} /> : <UserIcon size={24} />}
                    </div>
                    <div className="text-right flex-1 min-w-0">
                      <h4 className="font-bold text-slate-900 truncate">{user.username}</h4>
                      <p className="text-[10px] text-slate-450 font-mono mt-0.5 truncate">{user.email}</p>
                      
                      <div className="flex flex-wrap gap-1 mt-2">
                        <span className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-black">
                          {user.role === 'super_admin' ? (language === 'ar' ? 'مدير عام النظام' : 'System Super Admin') : user.role === 'admin' ? (language === 'ar' ? 'مدير عام' : 'Super Admin') : user.role === 'manager' ? (language === 'ar' ? 'مدير' : 'Manager') : (language === 'ar' ? 'مستخدم' : 'User')}
                        </span>
                        {user.role !== 'admin' && user.role !== 'super_admin' && (
                          <span className="text-[9px] bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded font-black border border-emerald-100/50 truncate max-w-[150px]" title={getUserAssignedRoleNames(user)}>
                            {language === 'ar' ? 'أدوار' : 'Roles'}: {getUserAssignedRoleNames(user)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-6 flex items-center gap-2">
                    <button 
                      onClick={() => openUserPermissions(user)}
                      className="flex-1 flex items-center justify-center gap-2 py-3 bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100 rounded-xl text-xs font-bold transition-all active:scale-95"
                    >
                      <Lock size={14} />
                      {language === 'ar' ? 'تعديل الصلاحيات والأدوار' : 'Edit Permissions & Roles'}
                    </button>
                    {user.id !== currentUser?.id && (
                      <button 
                        onClick={() => {
                          setUserToDelete(user.id);
                          setIsDeleteModalOpen(true);
                        }}
                        className="p-3 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all active:scale-90"
                        title={language === 'ar' ? "حذف المستخدم" : "Delete User"}
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>

                  <div className="absolute top-6 left-6 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => {
                        setActivityLogDocumentId(user.id);
                        setIsActivityLogOpen(true);
                      }}
                      className="p-2 text-slate-300 hover:text-emerald-500 hover:bg-emerald-50 rounded-xl transition-all"
                      title={language === 'ar' ? "سجل تعديلات المستخدم" : "User Edit Log"}
                    >
                      <History size={18} />
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Roles Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {roles.map((role) => (
              <div key={role.id} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all group relative flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-50 text-slate-500 rounded-xl flex items-center justify-center font-bold shadow-inner">
                      <Shield size={20} />
                    </div>
                    <div>
                      <h4 className="font-black text-lg text-slate-900 leading-tight">{translateRoleName(role.name, language)}</h4>
                      <p className="text-[10px] text-slate-400 font-bold uppercase">{language === 'ar' ? 'دور وظيفي' : 'Job Role'}</p>
                    </div>
                  </div>
                  <p className="text-sm text-slate-500 font-medium leading-relaxed min-h-[40px]">{translateRoleDesc(role.description, language) || (language === 'ar' ? '\u0644\u0627 \u064a\u0648\u062c\u062f \u0648\u0635\u0641 \u0644\u0647\u0630\u0627 \u0627\u0644\u062f\u0648\u0631' : 'No description for this role')}</p>
                </div>
                
                <div className="mt-6 flex items-center gap-2 pt-2 border-t border-slate-50">
                  <button 
                    onClick={() => openRolePermissions(role)}
                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100 rounded-xl text-xs font-bold transition-all active:scale-95"
                  >
                    <Lock size={14} />
                    {language === 'ar' ? 'تعديل صلاحيات الدور' : 'Edit Role Permissions'}
                  </button>
                  <button 
                    onClick={() => {
                      setEditingRole(role);
                      setRoleFormData({ name: role.name, description: role.description });
                      setIsRoleModalOpen(true);
                    }}
                    className="p-3 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all active:scale-90"
                    title={language === 'ar' ? "تعديل الدور" : "Edit Role"}
                  >
                    <Edit2 size={16} />
                  </button>
                  <button 
                    onClick={() => {
                      setRoleToDelete(role.id);
                      setIsRoleDeleteModalOpen(true);
                    }}
                    className="p-3 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all active:scale-90"
                    title={language === 'ar' ? "حذف الدور" : "Delete Role"}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      </>
      )}

      {/* New/Edit User Modal */}
      {isUserModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col border border-slate-200">
            <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-white shrink-0">
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">{language === 'ar' ? 'إنشاء حساب مستخدم جديد' : 'Create New User Account'}</h3>
              <button onClick={() => setIsUserModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-50 rounded-full transition-all"><X size={24} /></button>
            </div>
            <form onSubmit={handleCreateUser} className={`p-8 space-y-6 flex-1 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
              <div className="space-y-2">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">{language === 'ar' ? 'البريد الإلكتروني / اسم المستخدم' : 'Email / Username'}</label>
                <input
                  required
                  type="email"
                  className="premium-input font-bold w-full"
                  value={userFormData.email}
                  onChange={(e) => setUserFormData({ ...userFormData, email: e.target.value })}
                  placeholder="name@company.com"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">{language === 'ar' ? 'كلمة المرور الافتراضية' : 'Default Password'}</label>
                <input
                  required
                  type="password"
                  minLength={6}
                  className="premium-input font-mono font-bold w-full"
                  value={userFormData.password}
                  onChange={(e) => setUserFormData({ ...userFormData, password: e.target.value })}
                  placeholder="••••••••"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">{language === 'ar' ? 'الرتبة في النظام' : 'System Role'}</label>
                <select 
                  required
                  className="premium-input font-bold appearance-none bg-no-repeat bg-[1rem_center] w-full"
                  value={userFormData.role}
                  onChange={(e) => setUserFormData({ ...userFormData, role: e.target.value as any })}
                >
                  <option value="user">{language === 'ar' ? 'مستخدم قياسي (يرث من صلاحيات الأدوار)' : 'Standard User (Inherits from Roles)'}</option>
                  <option value="manager">{language === 'ar' ? 'مدير قسم (لديه صلاحية واسعة تلقائياً)' : 'Department Manager (Has broad permissions automatically)'}</option>
                  <option value="admin">{language === 'ar' ? 'مدير عام للشركة (له كامل صلاحيات النظام)' : 'Super Admin (Has full system permissions)'}</option>
                </select>
              </div>
              <div className="pt-4">
                <button 
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold text-lg hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-500/20 disabled:opacity-50 active:scale-95"
                >
                  {loading ? (language === 'ar' ? 'جاري المعالجة...' : 'Processing...') : (language === 'ar' ? 'تأكيد إنشاء الحساب' : 'Confirm Account Creation')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete User Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-[2rem] shadow-2xl p-8 animate-in zoom-in-95 duration-200 border border-slate-200 text-center">
            <div className="w-20 h-20 bg-red-50 text-red-650 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner animate-bounce">
              <Trash2 size={32} />
            </div>
            <h3 className="text-2xl font-black text-slate-900 mb-2 tracking-tight">{language === 'ar' ? 'تأكيد حذف الحساب' : 'Confirm Account Deletion'}</h3>
            <p className="text-slate-500 mb-8 font-medium">{language === 'ar' ? 'هل أنت متأكد من رغبتك في حذف حساب هذا المستخدم نهائياً؟ لا يمكن التراجع عن هذا الإجراء.' : 'Are you sure you want to permanently delete this user account? This action cannot be undone.'}</p>
            <div className="flex gap-3">
              <button 
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setUserToDelete(null);
                }}
                className="flex-1 py-4 bg-slate-50 text-slate-600 rounded-2xl font-bold hover:bg-slate-100 transition-all active:scale-95"
              >
                {language === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
              <button 
                onClick={confirmDeleteUser}
                className="flex-1 py-4 bg-red-650 text-white rounded-2xl font-bold hover:bg-red-700 transition-all shadow-xl shadow-red-500/20 active:scale-95"
              >
                {language === 'ar' ? 'حذف الحساب' : 'Delete Account'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New/Edit Role Modal */}
      {isRoleModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col border border-slate-200">
            <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-white shrink-0">
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                {editingRole ? (language === 'ar' ? 'تعديل بيانات الدور الوظيفي' : 'Edit Job Role Details') : (language === 'ar' ? 'إنشاء دور وظيفي جديد' : 'Create New Job Role')}
              </h3>
              <button onClick={() => setIsRoleModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-50 rounded-full transition-all"><X size={24} /></button>
            </div>
            <form onSubmit={handleSaveRole} className={`p-8 space-y-6 flex-1 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
              <div className="space-y-2">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">{language === 'ar' ? 'اسم الدور الوظيفي' : 'Job Role Name'}</label>
                <input
                  required
                  type="text"
                  className="premium-input font-bold w-full"
                  value={roleFormData.name}
                  onChange={(e) => setRoleFormData({ ...roleFormData, name: e.target.value })}
                  placeholder={language === 'ar' ? 'مثال: مدير المبيعات، كاشير الفروع...' : 'e.g., Sales Manager, Branch Cashier...'}
                />
              </div>
              <div className="space-y-2">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">{language === 'ar' ? 'الوصف العام للدور' : 'General Role Description'}</label>
                <textarea
                  className="premium-input font-bold w-full min-h-[100px] py-4"
                  value={roleFormData.description}
                  onChange={(e) => setRoleFormData({ ...roleFormData, description: e.target.value })}
                  placeholder={language === 'ar' ? 'اكتب وصفاً مختصراً يوضح طبيعة هذا الدور والهدف منه...' : 'Write a brief description explaining the nature and purpose of this role...'}
                />
              </div>
              <div className="pt-4">
                <button 
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold text-lg hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-500/20 disabled:opacity-50 active:scale-95"
                >
                  {loading ? (language === 'ar' ? 'جاري المعالجة...' : 'Processing...') : editingRole ? (language === 'ar' ? 'حفظ التعديلات' : 'Save Changes') : (language === 'ar' ? 'تأكيد إنشاء الدور' : 'Confirm Role Creation')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Role Modal */}
      {isRoleDeleteModalOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-[2rem] shadow-2xl p-8 animate-in zoom-in-95 duration-200 border border-slate-200 text-center">
            <div className="w-20 h-20 bg-red-50 text-red-650 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner animate-bounce">
              <Trash2 size={32} />
            </div>
            <h3 className="text-2xl font-black text-slate-900 mb-2 tracking-tight">{language === 'ar' ? 'حذف الدور الوظيفي' : 'Delete Job Role'}</h3>
            <p className="text-slate-500 mb-8 font-medium">{language === 'ar' ? '\u0647\u0644 \u0623\u0646\u062a \u0645\u062a\u0623\u0643\u062f \u0645\u0646 \u0631\u063a\u0628\u062a\u0643 \u0641\u064a \u062d\u0630\u0641 \u0647\u0630\u0627 \u0627\u0644\u062f\u0648\u0631 \u0646\u0647\u0627\u0626\u064a\u0627\u064b\u061f \u0633\u064a\u062a\u0645 \u0625\u0644\u063a\u0627\u0621 \u0627\u0631\u062a\u0628\u0627\u0637\u0647 \u0628\u062c\u0645\u064a\u0639 \u0627\u0644\u0645\u0633\u062a\u062e\u062f\u0645\u064a\u0646 \u0627\u0644\u0630\u064a\u0646 \u064a\u0646\u062a\u0645\u0648\u0646 \u0625\u0644\u064a\u0647 \u062d\u0627\u0644\u064a\u0627\u064b.' : 'Are you sure you want to permanently delete this role? Its association with all users belonging to it will be removed.'}</p>
            <div className="flex gap-3">
              <button 
                onClick={() => {
                  setIsRoleDeleteModalOpen(false);
                  setRoleToDelete(null);
                }}
                className="flex-1 py-4 bg-slate-50 text-slate-600 rounded-2xl font-bold hover:bg-slate-100 transition-all active:scale-95"
              >
                {language === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
              <button 
                onClick={confirmDeleteRole}
                className="flex-1 py-4 bg-red-650 text-white rounded-2xl font-bold hover:bg-red-700 transition-all shadow-xl shadow-red-500/20 active:scale-95"
              >
                {language === 'ar' ? 'تأكيد حذف الدور' : 'Confirm Role Deletion'}
              </button>
            </div>
          </div>
        </div>
      )}

      <PageActivityLog 
        isOpen={isActivityLogOpen} 
        onClose={() => {
          setIsActivityLogOpen(false);
          setActivityLogDocumentId(undefined);
        }} 
        category="users"
        documentId={activityLogDocumentId}
      />
    </div>
  );
};
