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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 italic serif">{t('users.title')}</h2>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-zinc-500">{t('users.subtitle')}</p>
            <div className="flex items-center gap-2 px-3 py-1 bg-zinc-100 rounded-full border border-zinc-200">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-tighter">{t('users.company_code')}</span>
              <code className="text-xs font-mono font-bold text-zinc-900 select-all cursor-pointer" title={t('users.click_to_copy')} onClick={() => {
                navigator.clipboard.writeText(currentUser?.company_id || '');
                showNotification(t('users.company_code_copied'));
              }}>{currentUser?.company_id}</code>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => {
              setActivityLogDocumentId(undefined);
              setIsActivityLogOpen(true);
            }}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-white text-zinc-600 border border-zinc-200 rounded-2xl font-bold hover:bg-zinc-50 transition-all active:scale-95"
            title={t('common.audit_log')}
          >
            <History size={20} />
            <span className="hidden md:inline">{t('common.audit_log')}</span>
          </button>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-emerald-500 text-white rounded-2xl font-bold hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20"
          >
            <Plus size={20} />
            {t('users.add_user')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {users.map((user) => (
          <div key={user.id} className="bg-white p-6 rounded-3xl border border-zinc-100 shadow-sm hover:shadow-md transition-all group relative">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${user.role === 'admin' ? 'bg-indigo-50 text-indigo-600' : user.role === 'manager' ? 'bg-blue-50 text-blue-600' : 'bg-zinc-50 text-zinc-500'}`}>
                {user.role === 'admin' ? <Shield size={24} /> : <UserIcon size={24} />}
              </div>
              <div className="text-left">
                <h4 className="font-bold text-zinc-900">{user.username}</h4>
                <div className="flex items-center gap-2">
                  <p className="text-xs text-zinc-500 uppercase tracking-widest font-bold">{user.role === 'admin' ? t('common.role_admin') : user.role === 'manager' ? t('common.manager') : t('common.role_user')}</p>
                  {user.role === 'user' && (
                    <span className="text-[10px] bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded-md font-bold">{t('users.custom_permissions')}</span>
                  )}
                </div>
                <p className="text-[10px] text-zinc-400 font-mono">{user.email}</p>
              </div>
            </div>
            
            <div className="mt-6 flex items-center gap-2">
              <button 
                onClick={() => openPermissionsModal(user)}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-zinc-50 text-zinc-600 rounded-xl text-xs font-bold hover:bg-zinc-100 transition-all"
              >
                <Lock size={14} />
                {t('users.permissions')}
              </button>
              <button 
                onClick={() => {
                  setSelectedUser(user);
                  setIsRoleModalOpen(true);
                }}
                className="p-2.5 text-zinc-400 hover:text-blue-500 hover:bg-blue-50 rounded-xl transition-all"
                title={t('users.edit_role')}
              >
                <Edit2 size={18} />
              </button>
              {user.id !== currentUser?.id && (
                <button 
                  onClick={() => handleDelete(user.id)}
                  className="p-2.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
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
                className="p-2 text-zinc-300 hover:text-emerald-500 hover:bg-emerald-50 rounded-xl transition-all"
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
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 md:p-8 bg-zinc-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-6xl h-full max-h-[90vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-zinc-100 flex items-center justify-between bg-stone-50">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
                  <Lock size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-zinc-900">{t('users.user_permissions_title', { username: selectedUser.username })}</h3>
                  <p className="text-xs text-zinc-500 font-bold">{t('users.permissions_desc')}</p>
                </div>
              </div>
              <button onClick={() => setIsPermissionsModalOpen(false)} className="p-2 text-zinc-400 hover:text-zinc-600 transition-colors">
                <X size={24} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {selectedUser.role === 'admin' ? (
                <div className="bg-indigo-50 border border-indigo-100 p-6 rounded-2xl flex items-center gap-4 text-indigo-700">
                  <Shield size={32} className="shrink-0" />
                  <div>
                    <h4 className="font-black text-lg">{t('users.admin_permissions_msg')}</h4>
                    <p className="text-sm font-bold opacity-80">{t('users.admin_permissions_desc')}</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-12 gap-4 px-4 py-2 bg-zinc-100 rounded-xl text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                    <div className="col-span-4">{t('users.module_section')}</div>
                    <div className="col-span-2 text-center">{t('common.view')}</div>
                    <div className="col-span-2 text-center">{t('common.add')}</div>
                    <div className="col-span-2 text-center">{t('common.edit')}</div>
                    <div className="col-span-2 text-center">{t('common.delete')}</div>
                  </div>

                  <div className="space-y-2">
                    {APP_MODULES.map((module) => (
                      <div key={module.id} className="grid grid-cols-12 gap-4 px-4 py-3 bg-white border border-zinc-100 rounded-2xl items-center hover:bg-stone-50 transition-colors group">
                        <div className="col-span-4">
                          <span className="font-bold text-zinc-700">{module.label}</span>
                        </div>
                        <div className="col-span-2 flex justify-center">
                          <button 
                            onClick={() => togglePermission(module.id, 'view')}
                            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${tempPermissions[module.id]?.view ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20' : 'bg-zinc-100 text-zinc-300 hover:bg-zinc-200'}`}
                          >
                            <Check size={16} />
                          </button>
                        </div>
                        <div className="col-span-2 flex justify-center">
                          <button 
                            onClick={() => togglePermission(module.id, 'create')}
                            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${tempPermissions[module.id]?.create ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20' : 'bg-zinc-100 text-zinc-300 hover:bg-zinc-200'}`}
                          >
                            <Check size={16} />
                          </button>
                        </div>
                        <div className="col-span-2 flex justify-center">
                          <button 
                            onClick={() => togglePermission(module.id, 'edit')}
                            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${tempPermissions[module.id]?.edit ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20' : 'bg-zinc-100 text-zinc-300 hover:bg-zinc-200'}`}
                          >
                            <Check size={16} />
                          </button>
                        </div>
                        <div className="col-span-2 flex justify-center">
                          <button 
                            onClick={() => togglePermission(module.id, 'delete')}
                            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${tempPermissions[module.id]?.delete ? 'bg-red-500 text-white shadow-md shadow-red-500/20' : 'bg-zinc-100 text-zinc-300 hover:bg-zinc-200'}`}
                          >
                            <Check size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-zinc-100 bg-stone-50 flex items-center justify-between">
              <div className="flex items-center gap-2 text-zinc-400">
                <AlertCircle size={16} />
                <span className="text-[10px] font-bold">{t('users.changes_applied_instantly')}</span>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => setIsPermissionsModalOpen(false)}
                  className="px-6 py-3 bg-white text-zinc-600 border border-zinc-200 rounded-2xl font-bold hover:bg-zinc-100 transition-all"
                >
                  {t('common.cancel')}
                </button>
                {selectedUser.role !== 'admin' && (
                  <button 
                    onClick={savePermissions}
                    disabled={loading}
                    className="px-8 py-3 bg-emerald-500 text-white rounded-2xl font-bold hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                  >
                    {loading ? t('common.saving') : t('users.save_permissions')}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-0 md:p-4 bg-zinc-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full h-full md:h-auto md:max-w-md md:rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col font-bold">
            <div className="p-6 border-b border-zinc-50 flex items-center justify-between">
              <h3 className="text-xl font-bold text-zinc-900">{t('users.new_user_title')}</h3>
              <button onClick={closeModal} className="text-zinc-400 hover:text-zinc-600"><X size={24} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4 flex-1 overflow-y-auto text-left">
              <div>
                <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">{t('users.username_label')}</label>
                <input
                  required
                  type="email"
                  className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">{t('users.password_label')}</label>
                <input
                  required
                  type="password"
                  minLength={6}
                  className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-mono"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">{t('users.role_label')}</label>
                <select 
                  required
                  className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
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
                  className="w-full py-4 bg-emerald-500 text-white rounded-2xl font-bold hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50"
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
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-zinc-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-6 animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold text-zinc-900 mb-4">{t('users.delete_confirm_title')}</h3>
            <p className="text-zinc-500 mb-6">{t('users.delete_confirm_msg')}</p>
            <div className="flex gap-4">
              <button 
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setUserToDelete(null);
                }}
                className="flex-1 py-3 bg-zinc-100 text-zinc-600 rounded-xl font-bold hover:bg-zinc-200 transition-all"
              >
                {t('common.cancel')}
              </button>
              <button 
                onClick={confirmDelete}
                className="flex-1 py-3 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 transition-all shadow-lg shadow-red-500/20"
              >
                {t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Role Selection Modal */}
      {isRoleModalOpen && selectedUser && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-zinc-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-8 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-blue-500 rounded-2xl flex items-center justify-center text-white">
                <Shield size={24} />
              </div>
              <div>
                <h3 className="text-xl font-black text-zinc-900">{t('users.edit_role_title')}</h3>
                <p className="text-xs text-zinc-500 font-bold">{selectedUser.username}</p>
              </div>
            </div>

            <div className="space-y-4 mb-8">
              <button
                onClick={() => updateRole(selectedUser.id, 'admin')}
                className={`w-full p-4 rounded-2xl border-2 transition-all text-left flex items-center justify-between ${
                  selectedUser.role === 'admin' ? 'border-emerald-500 bg-emerald-50' : 'border-zinc-100 hover:border-zinc-200'
                }`}
              >
                <div>
                  <p className="font-bold text-zinc-900">{t('common.role_admin')}</p>
                  <p className="text-xs text-zinc-500">{t('users.role_description_admin')}</p>
                </div>
                {selectedUser.role === 'admin' && <Check size={16} className="text-emerald-500" />}
              </button>

              <button
                onClick={() => updateRole(selectedUser.id, 'manager')}
                className={`w-full p-4 rounded-2xl border-2 transition-all text-left flex items-center justify-between ${
                  selectedUser.role === 'manager' ? 'border-emerald-500 bg-emerald-50' : 'border-zinc-100 hover:border-zinc-200'
                }`}
              >
                <div>
                  <p className="font-bold text-zinc-900">{t('common.manager')}</p>
                  <p className="text-xs text-zinc-500">{t('users.role_description_manager')}</p>
                </div>
                {selectedUser.role === 'manager' && <Check size={16} className="text-emerald-500" />}
              </button>

              <button
                onClick={() => updateRole(selectedUser.id, 'user')}
                className={`w-full p-4 rounded-2xl border-2 transition-all text-left flex items-center justify-between ${
                  selectedUser.role === 'user' ? 'border-emerald-500 bg-emerald-50' : 'border-zinc-100 hover:border-zinc-200'
                }`}
              >
                <div>
                  <p className="font-bold text-zinc-900">{t('common.role_user')}</p>
                  <p className="text-xs text-zinc-500">{t('users.role_description_user')}</p>
                </div>
                {selectedUser.role === 'user' && <Check size={16} className="text-emerald-500" />}
              </button>
            </div>

            <button 
              onClick={() => {
                setIsRoleModalOpen(false);
                setSelectedUser(null);
              }}
              className="w-full py-4 bg-zinc-100 text-zinc-600 rounded-2xl font-bold hover:bg-zinc-200 transition-all font-bold"
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
