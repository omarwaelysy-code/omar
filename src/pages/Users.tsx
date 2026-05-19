import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { useLanguage } from '../contexts/LanguageContext';
import { User, UserPermissions, ModulePermissions } from '../types';
import { Search, Plus, Trash2, X, Shield, User as UserIcon, History, Lock, Check, AlertCircle, Edit2 } from 'lucide-react';
import { dbService } from '../services/dbService';
import { PageActivityLog } from '../components/PageActivityLog';

export const Users: React.FC = () => {
  const { user: currentUser } = useAuth();
  const { showNotification } = useNotification();
  const { t } = useLanguage();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);
  const [isActivityLogOpen, setIsActivityLogOpen] = useState(false);
  const [activityLogDocumentId, setActivityLogDocumentId] = useState<string | undefined>(undefined);
  const [formData, setFormData] = useState({ email: '', password: '', role: 'user' as 'admin' | 'user' | 'manager' });
  
  // Permissions State
  const [isPermissionsModalOpen, setIsPermissionsModalOpen] = useState(false);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [tempPermissions, setTempPermissions] = useState<UserPermissions>({});

  const APP_MODULES = [
    { id: 'dashboard', label: t('nav.dashboard') },
    { id: 'customers', label: t('nav.customers') },
    { id: 'suppliers', label: t('nav.suppliers') },
    { id: 'products', label: t('nav.products') },
    { id: 'expenses', label: t('nav.expenses') },
    { id: 'payment_methods', label: t('nav.payment_methods') },
    { id: 'discount_settings', label: t('nav.discount_settings') },
    { id: 'invoices', label: t('nav.invoices') },
    { id: 'returns', label: t('nav.returns') },
    { id: 'purchase_invoices', label: t('nav.purchase_invoices') },
    { id: 'purchase_returns', label: t('nav.purchase_returns') },
    { id: 'customer_discounts', label: t('nav.customer_discounts') },
    { id: 'supplier_discounts', label: t('nav.supplier_discounts') },
    { id: 'receipts', label: t('nav.receipts') },
    { id: 'payment_vouchers', label: t('nav.payment_vouchers') },
    { id: 'cash_transfers', label: t('nav.cash_transfers') },
    { id: 'account_types', label: t('nav.account_types') },
    { id: 'accounts', label: t('nav.accounts') },
    { id: 'chart_of_accounts', label: t('nav.chart_of_accounts') },
    { id: 'create_journal_entry', label: t('nav.create_journal_entry') },
    { id: 'journal_entries', label: t('nav.journal_entries') },
    { id: 'general_ledger_report', label: t('nav.general_ledger_report') },
    { id: 'trial_balance', label: t('nav.trial_balance') },
    { id: 'income_statement', label: t('nav.income_statement') },
    { id: 'balance_sheet', label: t('nav.balance_sheet') },
    { id: 'customer_statement', label: t('nav.customer_statement') },
    { id: 'supplier_statement', label: t('nav.supplier_statement') },
    { id: 'customer_balances', label: t('nav.customer_balances') },
    { id: 'supplier_balances', label: t('nav.supplier_balances') },
    { id: 'sales_report', label: t('nav.sales_report') },
    { id: 'expenses_report', label: t('nav.expenses_report') },
    { id: 'cash_report', label: t('nav.cash_report') },
    { id: 'cash_balances', label: t('nav.cash_balances') },
    { id: 'users', label: t('nav.users') },
    { id: 'backup_restore', label: t('nav.backup_restore') },
    { id: 'activity_log', label: t('nav.activity_log') },
  ];

  useEffect(() => {
    if (currentUser) {
      setLoading(true);
      const unsub = dbService.subscribe<User>('users', currentUser.company_id, (data) => {
        setUsers(data);
        setLoading(false);
      });
      return () => unsub();
    }
  }, [currentUser]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    const cleanEmail = formData.email.trim().toLowerCase();

    // Check if user already exists in the company list
    if (users.some(u => u.email?.toLowerCase() === cleanEmail)) {
      showNotification(t('users.user_exists'), 'error');
      return;
    }

    setLoading(true);
    try {
      // 1. Create user via our backend API
      const response = await fetch('/api/erp/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: cleanEmail,
          email: cleanEmail,
          password: formData.password,
          company_id: currentUser.company_id,
          role: formData.role
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || t('common.error'));
      }

      const newUser = await response.json();

      // Default permissions for new user
      const defaultPermissions: UserPermissions = {};
      APP_MODULES.forEach(module => {
        defaultPermissions[module.id] = {
          view: true,
          create: false,
          edit: false,
          delete: false
        };
      });

      // 2. Update user with permissions if not admin
      if (formData.role !== 'admin') {
        await dbService.update('users', newUser.id, { 
          permissions: defaultPermissions
        });
      }

      await dbService.logActivity(currentUser.id, currentUser.username, currentUser.company_id, t('users.add_user_log'), t('users.add_user_new', { email: cleanEmail }), 'users', newUser.id);
      showNotification(t('users.add_success'), 'success');
      closeModal();
    } catch (e: any) {
      console.error(e);
      showNotification(e.message || t('users.add_error'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (id: string) => {
    if (id === currentUser?.id) {
      showNotification(t('users.delete_self_error'), "error");
      return;
    }
    setUserToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!userToDelete || !currentUser) return;
    setLoading(true);
    try {
      const userToDeleteObj = users.find(u => u.id === userToDelete);
      
      // 1. Delete from database
      await dbService.delete('users', userToDelete);
      
      await dbService.logActivity(currentUser.id, currentUser.username, currentUser.company_id, t('users.delete_user_log'), t('users.delete_user_details', { username: userToDeleteObj?.username }), 'users', userToDelete);
      showNotification(t('users.delete_success'));
      setIsDeleteModalOpen(false);
      setUserToDelete(null);
    } catch (e: any) {
      console.error(e);
      showNotification(e.message || t('users.delete_error'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const openPermissionsModal = (user: User) => {
    setSelectedUser(user);
    // Initialize temp permissions from user or defaults
    const initialPermissions: UserPermissions = user.permissions || {};
    
    // Ensure all modules exist in temp permissions
    APP_MODULES.forEach(module => {
      if (!initialPermissions[module.id]) {
        initialPermissions[module.id] = {
          view: user.role === 'admin',
          create: user.role === 'admin',
          edit: user.role === 'admin',
          delete: user.role === 'admin'
        };
      }
    });
    
    setTempPermissions(JSON.parse(JSON.stringify(initialPermissions)));
    setIsPermissionsModalOpen(true);
  };

  const togglePermission = (moduleId: string, permission: keyof ModulePermissions) => {
    setTempPermissions(prev => {
      const current = prev[moduleId] || { view: false, create: false, edit: false, delete: false };
      return {
        ...prev,
        [moduleId]: {
          ...current,
          [permission]: !current[permission]
        }
      };
    });
  };

  const savePermissions = async () => {
    if (!selectedUser || !currentUser) return;
    setLoading(true);
    try {
      await dbService.update('users', selectedUser.id, {
        permissions: tempPermissions
      });
      
      await dbService.logActivity(
        currentUser.id, 
        currentUser.username, 
        currentUser.company_id, 
        t('users.permissions_log'), 
        t('users.permissions_details', { username: selectedUser.username }), 
        'users', 
        selectedUser.id
      );
      
      showNotification(t('users.permissions_success'));
      setIsPermissionsModalOpen(false);
    } catch (e: any) {
      console.error(e);
      showNotification(t('users.permissions_error'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const updateRole = async (userId: string, newRole: 'admin' | 'user' | 'manager') => {
    if (!currentUser) return;
    setLoading(true);
    try {
      await dbService.update('users', userId, { role: newRole });
      await dbService.logActivity(
        currentUser.id, 
        currentUser.username, 
        currentUser.company_id, 
        t('users.role_log'), 
        t('users.role_details', { role: newRole === 'admin' ? t('common.role_admin') : newRole === 'manager' ? t('common.manager') : t('common.role_user') }), 
        'users', 
        userId
      );
      showNotification(t('users.role_success'));
      setIsRoleModalOpen(false);
      setSelectedUser(null);
    } catch (e: any) {
      console.error(e);
      showNotification(t('users.role_error'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setFormData({ email: '', password: '', role: 'user' });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-emerald-600 text-white rounded-3xl flex items-center justify-center shadow-xl shadow-emerald-500/20">
            <UserIcon size={28} />
          </div>
          <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tighter italic serif">{t('users.title')}</h2>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-slate-500 font-medium">{t('users.subtitle')}</p>
              <div className="flex items-center gap-2 px-3 py-1 bg-slate-100/50 rounded-full border border-slate-200">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{t('users.company_code')}</span>
                <code className="text-xs font-mono font-bold text-slate-900 select-all cursor-pointer" title={t('users.click_to_copy')} onClick={() => {
                  navigator.clipboard.writeText(currentUser?.company_id || '');
                  showNotification(t('users.company_code_copied'));
                }}>{currentUser?.company_id}</code>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => {
              setActivityLogDocumentId(undefined);
              setIsActivityLogOpen(true);
            }}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-white text-slate-600 border border-slate-200 rounded-2xl font-bold hover:bg-slate-50 transition-all active:scale-95 shadow-sm"
            title={t('common.audit_log')}
          >
            <History size={20} />
            <span className="hidden md:inline">{t('common.audit_log')}</span>
          </button>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-500/20 active:scale-95"
          >
            <Plus size={20} />
            {t('users.add_user')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {users.map((user) => (
          <div key={user.id} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all group relative">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 ${user.role === 'admin' ? 'bg-emerald-50 text-emerald-600 shadow-inner' : user.role === 'manager' ? 'bg-blue-50 text-blue-600 shadow-inner' : 'bg-slate-50 text-slate-400 shadow-inner'}`}>
                {user.role === 'admin' ? <Shield size={24} /> : <UserIcon size={24} />}
              </div>
              <div className="text-right flex-1 min-w-0">
                <h4 className="font-bold text-slate-900 truncate">{user.username}</h4>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-[10px] text-slate-400 uppercase tracking-widest font-black">{user.role === 'admin' ? t('common.role_admin') : user.role === 'manager' ? t('common.manager') : t('common.role_user')}</p>
                  {user.role === 'user' && (
                    <span className="text-[9px] bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded-md font-black border border-emerald-100">{t('users.custom_permissions')}</span>
                  )}
                </div>
                <p className="text-[10px] text-slate-300 font-mono mt-1 truncate">{user.email}</p>
              </div>
            </div>
            
            <div className="mt-6 flex items-center gap-2">
              <button 
                onClick={() => openPermissionsModal(user)}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-slate-50 text-slate-600 border border-slate-100 rounded-xl text-xs font-bold hover:bg-slate-100 transition-all active:scale-95"
              >
                <Lock size={14} />
                {t('users.permissions')}
              </button>
              <button 
                onClick={() => {
                  setSelectedUser(user);
                  setIsRoleModalOpen(true);
                }}
                className="p-3 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded-xl transition-all active:scale-90"
                title={t('users.edit_role')}
              >
                <Edit2 size={18} />
              </button>
              {user.id !== currentUser?.id && (
                <button 
                  onClick={() => handleDelete(user.id)}
                  className="p-3 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all active:scale-90"
                >
                  <Trash2 size={18} />
                </button>
              )}
            </div>

            <div className={`absolute top-6 ${t('dir') === 'rtl' ? 'left-6' : 'right-6'} opacity-0 group-hover:opacity-100 transition-opacity`}>
              <button 
                onClick={() => {
                  setActivityLogDocumentId(user.id);
                  setIsActivityLogOpen(true);
                }}
                className="p-2 text-slate-300 hover:text-emerald-500 hover:bg-emerald-50 rounded-xl transition-all"
                title={t('common.audit_log')}
              >
                <History size={18} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Permissions Modal */}
      {isPermissionsModalOpen && selectedUser && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 md:p-8 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200" dir="rtl">
          <div className="bg-white w-full max-w-6xl h-full max-h-[90vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 border border-slate-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-emerald-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
                  <Lock size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900">{t('users.user_permissions_title', { username: selectedUser.username })}</h3>
                  <p className="text-[11px] text-slate-500 font-bold uppercase tracking-tight">{t('users.permissions_desc')}</p>
                </div>
              </div>
              <button onClick={() => setIsPermissionsModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-50 rounded-full transition-all">
                <X size={24} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30 custom-scrollbar">
              {selectedUser.role === 'admin' ? (
                <div className="bg-emerald-50/50 border border-emerald-100 p-8 rounded-3xl flex flex-col items-center justify-center text-center gap-4 text-emerald-700">
                  <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-2">
                    <Shield size={40} className="shrink-0" />
                  </div>
                  <div className="max-w-md">
                    <h4 className="font-black text-2xl tracking-tight mb-2">{t('users.admin_permissions_msg')}</h4>
                    <p className="text-sm font-bold opacity-70 leading-relaxed">{t('users.admin_permissions_desc')}</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-white border border-slate-200 rounded-2xl text-[10px] font-black text-slate-400 uppercase tracking-widest shadow-sm sticky top-0 z-10">
                    <div className="col-span-4">{t('users.module_section')}</div>
                    <div className="col-span-2 text-center">{t('common.view')}</div>
                    <div className="col-span-2 text-center">{t('common.add')}</div>
                    <div className="col-span-2 text-center">{t('common.edit')}</div>
                    <div className="col-span-2 text-center">{t('common.delete')}</div>
                  </div>

                  <div className="space-y-3">
                    {APP_MODULES.map((module) => (
                      <div key={module.id} className="grid grid-cols-12 gap-4 px-6 py-4 bg-white border border-slate-100 rounded-2xl items-center hover:border-slate-300 transition-all shadow-sm group">
                        <div className="col-span-4">
                          <span className="font-bold text-slate-700 tracking-tight">{module.label}</span>
                        </div>
                        <div className="col-span-2 flex justify-center">
                          <button 
                            onClick={() => togglePermission(module.id, 'view')}
                            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all active:scale-90 ${tempPermissions[module.id]?.view ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20' : 'bg-slate-100 text-slate-300 hover:bg-slate-200'}`}
                          >
                            <Check size={18} />
                          </button>
                        </div>
                        <div className="col-span-2 flex justify-center">
                          <button 
                            onClick={() => togglePermission(module.id, 'create')}
                            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all active:scale-90 ${tempPermissions[module.id]?.create ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20' : 'bg-slate-100 text-slate-300 hover:bg-slate-200'}`}
                          >
                            <Check size={18} />
                          </button>
                        </div>
                        <div className="col-span-2 flex justify-center">
                          <button 
                            onClick={() => togglePermission(module.id, 'edit')}
                            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all active:scale-90 ${tempPermissions[module.id]?.edit ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20' : 'bg-slate-100 text-slate-300 hover:bg-slate-200'}`}
                          >
                            <Check size={18} />
                          </button>
                        </div>
                        <div className="col-span-2 flex justify-center">
                          <button 
                            onClick={() => togglePermission(module.id, 'delete')}
                            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all active:scale-90 ${tempPermissions[module.id]?.delete ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20' : 'bg-slate-100 text-slate-300 hover:bg-slate-200'}`}
                          >
                            <Check size={18} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-slate-100 bg-white flex flex-col md:flex-row items-center justify-between gap-4 shrink-0">
              <div className="flex items-center gap-2 text-slate-400">
                <AlertCircle size={16} />
                <span className="text-[10px] font-bold uppercase tracking-tight">{t('users.changes_applied_instantly')}</span>
              </div>
              <div className="flex gap-3 w-full md:w-auto">
                <button 
                  onClick={() => setIsPermissionsModalOpen(false)}
                  className="flex-1 md:flex-none px-6 py-3 bg-slate-50 text-slate-600 border border-slate-200 rounded-2xl font-bold hover:bg-slate-100 transition-all"
                >
                  {t('common.cancel')}
                </button>
                {selectedUser.role !== 'admin' && (
                  <button 
                    onClick={savePermissions}
                    disabled={loading}
                    className="flex-1 md:flex-none px-8 py-3 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-500/20 disabled:opacity-50 active:scale-95"
                  >
                    {loading ? t('common.saving') : t('users.save_permissions')}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New User Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-0 md:p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200" dir="rtl">
          <div className="bg-white w-full h-full md:h-auto md:max-w-md md:rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col border border-slate-200">
            <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-white shrink-0">
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">{t('users.new_user_title')}</h3>
              <button onClick={closeModal} className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-50 rounded-full transition-all"><X size={24} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-8 space-y-6 flex-1 overflow-y-auto text-right">
              <div className="space-y-2">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">{t('users.username_label')}</label>
                <input
                  required
                  type="email"
                  className="premium-input font-bold"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="name@company.com"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">{t('users.password_label')}</label>
                <input
                  required
                  type="password"
                  minLength={6}
                  className="premium-input font-mono font-bold"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="••••••••"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">{t('users.role_label')}</label>
                <select 
                  required
                  className="premium-input font-bold appearance-none bg-no-repeat bg-[1rem_center]"
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as 'admin' | 'user' | 'manager' })}
                >
                  <option value="user">{t('common.role_user')}</option>
                  <option value="manager">{t('common.manager')}</option>
                  <option value="admin">{t('common.role_admin')}</option>
                </select>
              </div>
              <div className="pt-4">
                <button 
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold text-lg hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-500/20 disabled:opacity-50 active:scale-95"
                >
                  {loading ? t('common.processing') : t('users.create_user')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200" dir="rtl">
          <div className="bg-white w-full max-w-md rounded-[2rem] shadow-2xl p-8 animate-in zoom-in-95 duration-200 border border-slate-200 text-center">
            <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
              <Trash2 size={32} />
            </div>
            <h3 className="text-2xl font-black text-slate-900 mb-2 tracking-tight">{t('users.delete_confirm_title')}</h3>
            <p className="text-slate-500 mb-8 font-medium">{t('users.delete_confirm_msg')}</p>
            <div className="flex gap-3">
              <button 
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setUserToDelete(null);
                }}
                className="flex-1 py-4 bg-slate-50 text-slate-600 rounded-2xl font-bold hover:bg-slate-100 transition-all active:scale-95"
              >
                {t('common.cancel')}
              </button>
              <button 
                onClick={confirmDelete}
                className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-500/20 active:scale-95"
              >
                {t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Role Selection Modal */}
      {isRoleModalOpen && selectedUser && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200" dir="rtl">
          <div className="bg-white w-full max-w-md rounded-[2rem] shadow-2xl p-8 animate-in zoom-in-95 duration-200 border border-slate-200">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-14 h-14 bg-sky-50 text-sky-600 rounded-2xl flex items-center justify-center shadow-inner">
                <Shield size={28} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-2xl font-black text-slate-900 tracking-tight leading-tight">{t('users.edit_role_title')}</h3>
                <p className="text-[11px] text-slate-500 font-bold uppercase truncate">{selectedUser.username}</p>
              </div>
            </div>

            <div className="space-y-3 mb-8">
              {(['admin', 'manager', 'user'] as const).map((role) => (
                <button
                  key={role}
                  onClick={() => updateRole(selectedUser.id, role)}
                  className={`w-full p-5 rounded-2xl border-2 transition-all text-right flex items-center justify-between group ${
                    selectedUser.role === role 
                      ? 'border-emerald-600 bg-emerald-50 shadow-md shadow-emerald-500/5' 
                      : 'border-slate-100 hover:border-slate-200 bg-slate-50/50'
                  }`}
                >
                  <div className="flex-1">
                    <p className={`font-black text-sm tracking-tight ${selectedUser.role === role ? 'text-emerald-700' : 'text-slate-900'}`}>
                      {role === 'admin' ? t('common.role_admin') : role === 'manager' ? t('common.manager') : t('common.role_user')}
                    </p>
                    <p className={`text-[10px] font-medium mt-0.5 leading-tight ${selectedUser.role === role ? 'text-emerald-600/70' : 'text-slate-500'}`}>
                      {role === 'admin' ? t('users.role_description_admin') : role === 'manager' ? t('users.role_description_manager') : t('users.role_description_user')}
                    </p>
                  </div>
                  {selectedUser.role === role && (
                    <div className="w-6 h-6 bg-emerald-600 text-white rounded-lg flex items-center justify-center shadow-lg shadow-emerald-500/20">
                      <Check size={14} />
                    </div>
                  )}
                </button>
              ))}
            </div>

            <button 
              onClick={() => {
                setIsRoleModalOpen(false);
                setSelectedUser(null);
              }}
              className="w-full py-4 bg-slate-50 text-slate-500 rounded-2xl font-bold hover:bg-slate-100 transition-all active:scale-95"
            >
              {t('common.cancel')}
            </button>
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
