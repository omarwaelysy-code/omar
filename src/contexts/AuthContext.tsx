import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, ModulePermissions } from '../types';
import { dbService } from '../services/dbService';
import { computeEffectivePermissions } from '../utils/permissions';

interface AuthContextType {
  user: User | null;
  userMemberships: User[];
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  switchCompany: (companyId: string) => Promise<void>;
  isAuthenticated: boolean;
  isSuperAdmin: boolean;
  isSuperAdminAccount: boolean;
  isCompanyAdmin: boolean;
  isManager: boolean;
  isStandardUser: boolean;
  isSubscriptionExpired: boolean;
  subscriptionExpiredDetails: { expired: boolean; expiryDate: string; companyName: string; reason: string };
  hasPermission: (moduleId: string, action: keyof ModulePermissions) => boolean;
  fetchProfile: (userId: string, email: string) => Promise<void>;
  workspaceMode?: 'super_admin' | 'company';
  setWorkspaceMode?: (mode: 'super_admin' | 'company') => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {

  const [user, setUser] = useState<User | null>(null);
  const [userMemberships, setUserMemberships] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [subscriptionExpiredDetails, setSubscriptionExpiredDetails] = useState<{ expired: boolean; expiryDate: string; companyName: string; reason: string }>({
    expired: false,
    expiryDate: '',
    companyName: '',
    reason: ''
  });
  const [workspaceMode, setWorkspaceModeState] = useState<'super_admin' | 'company'>(() => {
    return (localStorage.getItem('workspace_mode') as any) || 'super_admin';
  });

  const setWorkspaceMode = (mode: 'super_admin' | 'company') => {
    localStorage.setItem('workspace_mode', mode);
    setWorkspaceModeState(mode);
  };

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('auth_token');
      
      if (token) {
        try {
          const response = await fetch('/api/erp/auth/me', {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });

          if (response.ok) {
            const userData = await response.json();
            await fetchProfile(userData.id, userData.email);
          } else {
            throw new Error('Session expired');
          }
        } catch (error) {
          console.error('AuthContext: Error restoring session:', error);
          localStorage.removeItem('auth_user');
          localStorage.removeItem('auth_token');
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const getCompanyHistory = (emailKey: string, userId?: string): string[] => {
    let history: string[] = [];
    try {
      const raw = (emailKey ? localStorage.getItem(`company_history_${emailKey}`) : null) || (userId ? localStorage.getItem(`company_history_${userId}`) : null);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          history = parsed.filter(id => typeof id === 'string' && id.trim().length > 0);
        }
      }
    } catch (e) {
      console.error('AuthContext: Error parsing company history:', e);
    }

    // Fallback to legacy single preferred_company if history is empty
    if (history.length === 0) {
      const pref = (emailKey ? localStorage.getItem(`preferred_company_${emailKey}`) : null) || (userId ? localStorage.getItem(`preferred_company_${userId}`) : null);
      if (pref) {
        history = [pref];
      }
    }
    return history;
  };

  const recordCompanyOpened = (companyId: string, emailKey: string, userId?: string) => {
    if (!companyId || companyId === 'system' || companyId === 'SYSTEM') return;
    const currentHistory = getCompanyHistory(emailKey, userId);
    const updatedHistory = [companyId, ...currentHistory.filter(id => id !== companyId)].slice(0, 20);
    
    if (emailKey) {
      localStorage.setItem(`company_history_${emailKey}`, JSON.stringify(updatedHistory));
      localStorage.setItem(`preferred_company_${emailKey}`, companyId);
    }
    if (userId) {
      localStorage.setItem(`company_history_${userId}`, JSON.stringify(updatedHistory));
      localStorage.setItem(`preferred_company_${userId}`, companyId);
    }
  };

  const checkCompanyExpiry = async (companyId: string): Promise<{ isExpired: boolean; endDateStr: string; companyName: string; reason: string }> => {
    if (!companyId || companyId === 'system' || companyId === 'SYSTEM') {
      return { isExpired: false, endDateStr: '', companyName: '', reason: '' };
    }
    try {
      const comp = await dbService.get<any>('companies', companyId);
      if (comp) {
        const nowStr = new Date().toISOString().slice(0, 10);
        const endDateStr = comp.subscription_end || comp.subscription_expiry ? new Date(comp.subscription_end || comp.subscription_expiry).toISOString().slice(0, 10) : '';
        const isSuspended = comp.company_status === 'suspended' || comp.subscription_status === 'suspended' || comp.subscription_status === 'Suspended';
        const isExpiredStatus = comp.subscription_status === 'expired' || comp.subscription_status === 'Expired';
        const isExpiredDate = Boolean(endDateStr && endDateStr < nowStr);

        if (isSuspended) {
          return { isExpired: true, endDateStr, companyName: comp.name || companyId, reason: 'تم إيقاف هذه الشركة بواسطة إدارة النظام.' };
        }
        if (isExpiredStatus || isExpiredDate) {
          return { isExpired: true, endDateStr, companyName: comp.name || companyId, reason: `انتهى اشتراك الشركة بتاريخ ${endDateStr || 'السابق'}.` };
        }
      }
    } catch (e) {
      console.error('Error checking company expiry:', e);
    }
    return { isExpired: false, endDateStr: '', companyName: '', reason: '' };
  };

  const fetchProfile = async (userId: string, email: string) => {
    try {

      // Query all user documents that have this email or ID
      let membershipsData: any[] = await dbService.query('users', [
        { field: 'email', operator: '==', value: email }
      ]);
      
      if (membershipsData.length === 0) {
        const directDoc = await dbService.get<any>('users', userId);
        if (directDoc) membershipsData.push(directDoc);
      }

      const memberships: User[] = [];
      let hasSuperAdminRole = false;

      for (const userData of membershipsData) {
        let companyName = 'شركة غير معروفة';
        let effectivePerms = userData.permissions || {};
        
        if (userData.role === 'super_admin' || userData.company_id === 'system' || userData.company_id === 'SYSTEM') {
          hasSuperAdminRole = true;
        }

        if (userData.company_id) {
          const company = await dbService.get<any>('companies', userData.company_id);
          if (company) {
            companyName = company.name;
          }
          
          try {
            const companyRoles = await dbService.list<any>('roles', userData.company_id);
            effectivePerms = computeEffectivePermissions(userData, companyRoles);
          } catch (roleErr) {
            console.error('Error computing effective permissions for membership:', roleErr);
          }
        }
        
        memberships.push({
          ...userData,
          permissions: effectivePerms,
          company_name: companyName
        });
      }
      
      setUserMemberships(memberships);

      if (memberships.length > 0) {
        const emailKey = (email || '').toLowerCase().trim();
        const history = getCompanyHistory(emailKey, userId);

        // Build candidate list in strict priority order:
        // 1. Companies from history in MRU order (index 0 = last opened company, index 1 = one before it, etc.)
        // 2. Any other memberships not yet in history
        const candidateCompanyIds: string[] = [];
        for (const compId of history) {
          if (memberships.some(m => m.company_id === compId) && !candidateCompanyIds.includes(compId)) {
            candidateCompanyIds.push(compId);
          }
        }
        for (const m of memberships) {
          if (m.company_id && !candidateCompanyIds.includes(m.company_id)) {
            candidateCompanyIds.push(m.company_id);
          }
        }

        let selectedMembership: User | null = null;
        let selectedExpiryCheck: { isExpired: boolean; endDateStr: string; companyName: string; reason: string } = {
          isExpired: false,
          endDateStr: '',
          companyName: '',
          reason: ''
        };

        // Check each candidate in order: last opened -> previous opened -> ...
        for (const compId of candidateCompanyIds) {
          const m = memberships.find(mem => mem.company_id === compId);
          if (!m) continue;

          const check = await checkCompanyExpiry(compId);
          if (!check.isExpired) {
            selectedMembership = m;
            selectedExpiryCheck = check;
            recordCompanyOpened(compId, emailKey, userId);
            break;
          }
        }
        
        // If ALL companies are expired:
        if (!selectedMembership) {
          if (hasSuperAdminRole) {
            // If user is a super admin, switch automatically to super_admin workspace mode
            setWorkspaceMode('super_admin');
            const superAdminMem = memberships.find(m => m.role === 'super_admin' || m.company_id === 'system' || m.company_id === 'SYSTEM') || memberships[0];
            const finalSuperAdmin = {
              ...superAdminMem,
              must_change_password: superAdminMem.must_change_password || false
            };
            setUser(finalSuperAdmin);
            localStorage.setItem('auth_user', JSON.stringify(finalSuperAdmin));
            if (finalSuperAdmin.company_id) {
              localStorage.setItem('current_company_id', finalSuperAdmin.company_id);
            }
            setSubscriptionExpiredDetails({
              expired: false,
              expiryDate: '',
              companyName: '',
              reason: ''
            });
            return;
          } else {
            // Fallback to the last opened company or first membership so that expiry message displays for it
            const fallbackCompId = candidateCompanyIds[0] || memberships[0]?.company_id;
            selectedMembership = memberships.find(m => m.company_id === fallbackCompId) || memberships[0];
            if (selectedMembership?.company_id) {
              selectedExpiryCheck = await checkCompanyExpiry(selectedMembership.company_id);
            }
          }
        }

        setSubscriptionExpiredDetails({
          expired: selectedExpiryCheck.isExpired,
          expiryDate: selectedExpiryCheck.endDateStr,
          companyName: selectedExpiryCheck.companyName,
          reason: selectedExpiryCheck.reason
        });

        const finalUser = { 
          ...selectedMembership, 
          must_change_password: selectedMembership.must_change_password || false
        };
        setUser(finalUser);
        localStorage.setItem('auth_user', JSON.stringify(finalUser));
        if (finalUser.company_id) {
          localStorage.setItem('current_company_id', finalUser.company_id);
        }
      } else {
        // Fallback for super admin
        const superAdminFallback: User = { 
          id: userId, 
          username: email.split('@')[0], 
          role: 'super_admin', 
          company_id: '',
          status: 'active',
          created_at: new Date().toISOString()
        };
        setUser(superAdminFallback);
        localStorage.setItem('auth_user', JSON.stringify(superAdminFallback));
        localStorage.removeItem('current_company_id');
        if (hasSuperAdminRole) {
          setWorkspaceMode('super_admin');
        }
      }
    } catch (error) {
      console.error('AuthContext: Error fetching profile:', error);
      throw error;
    }
  };

  const login = async (email: string, password: string) => {
    try {
      setLoading(true);
      const response = await fetch('/api/erp/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Login failed');
      }

      const { token, user: loginData } = await response.json();
      localStorage.setItem('auth_token', token);
      localStorage.setItem('auth_user', JSON.stringify(loginData));
      
      await fetchProfile(loginData.id, loginData.email);
    } catch (error) {
      console.error('AuthContext: Login error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const isSuperAdminAccount = React.useMemo(() => {
    return userMemberships.some(m => m.role === 'super_admin' || m.company_id === 'system' || m.company_id === 'SYSTEM') || user?.role === 'super_admin';
  }, [userMemberships, user?.role]);

  const switchCompany = async (companyId: string) => {
    if (!user) return;
    
    try {
      setLoading(true);
      const membership = userMemberships.find(m => m.company_id === companyId);
      if (membership) {
        if (isSuperAdminAccount) {
          setWorkspaceMode('company');
        }
        const updatedUser = {
          ...membership,
          must_change_password: membership.must_change_password || false
        };
        setUser(updatedUser);
        localStorage.setItem('auth_user', JSON.stringify(updatedUser));
        if (companyId) {
          localStorage.setItem('current_company_id', companyId);
        }
        
        const emailKey = (updatedUser.email || user.email || '').toLowerCase().trim();
        recordCompanyOpened(companyId, emailKey, user.id);

        if (companyId) {
          const expiryCheck = await checkCompanyExpiry(companyId);
          setSubscriptionExpiredDetails({
            expired: expiryCheck.isExpired,
            expiryDate: expiryCheck.endDateStr,
            companyName: expiryCheck.companyName,
            reason: expiryCheck.reason
          });
        }
      }
    } finally {
      setLoading(false);
    }
  };

  // Sync user state reliably with localStorage
  useEffect(() => {
    if (user) {
      try {
        if (user.company_id) {
          localStorage.setItem('current_company_id', user.company_id);
        }
        const stored = localStorage.getItem('auth_user');
        const parsed = stored ? JSON.parse(stored) : null;
        if (!parsed || parsed.company_id !== user.company_id || parsed.id !== user.id) {
          localStorage.setItem('auth_user', JSON.stringify(user));
        }
      } catch (e) {
        console.error('AuthContext: Error syncing user to localStorage:', e);
      }
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const sendHeartbeat = async () => {
      try {
        const token = localStorage.getItem('auth_token');
        if (token) {
          await fetch('/api/erp/auth/heartbeat', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            }
          });
        }
      } catch (e) {
        // silent catch
      }
    };

    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, 60000);
    return () => clearInterval(interval);
  }, [user?.id]);

  const logout = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      if (token) {
        await fetch('/api/erp/auth/logout', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        });
      }
    } catch (e) {
      console.error('Logout error:', e);
    }
    localStorage.removeItem('auth_user');
    localStorage.removeItem('auth_token');
    localStorage.removeItem('current_company_id');
    localStorage.removeItem('user_email');
    localStorage.removeItem('user_id');
    // Preserve preferred_company_ on logout so last opened company is remembered upon re-login
    setUser(null);
    setUserMemberships([]);
    window.location.href = '/login';
  };

  const isSuperAdmin = isSuperAdminAccount && workspaceMode === 'super_admin';
  const isCompanyAdmin = (user?.role === 'admin' || user?.role === 'super_admin') && user?.company_id !== 'system';
  const isManager = user?.role === 'manager';
  const isStandardUser = user?.role === 'user';

  const hasPermission = React.useCallback((moduleId: string, action: keyof ModulePermissions): boolean => {
    if (user?.role === 'super_admin' || isCompanyAdmin) return true;
    if (isManager) {
      if (action === 'delete') return false;
      return true;
    }
    if (moduleId === 'dashboard' && action === 'view') return true;
    
    if (!user?.permissions) {
      return action === 'view';
    }
    const modulePerms = user.permissions[moduleId];
    return modulePerms ? modulePerms[action] : false;
  }, [isCompanyAdmin, isManager, user]);

  const isAuthenticated = !!user && (user?.role === 'super_admin' || !!user.company_id);

  const value = React.useMemo(() => ({ 
    user, 
    userMemberships,
    loading, 
    login,
    logout, 
    switchCompany,
    isAuthenticated,
    isSuperAdmin,
    isSuperAdminAccount,
    isCompanyAdmin,
    isManager,
    isStandardUser,
    isSubscriptionExpired: subscriptionExpiredDetails.expired,
    subscriptionExpiredDetails,
    hasPermission,
    fetchProfile,
    workspaceMode,
    setWorkspaceMode
  }), [user, userMemberships, loading, isAuthenticated, isSuperAdmin, isSuperAdminAccount, isCompanyAdmin, isManager, isStandardUser, subscriptionExpiredDetails, hasPermission, workspaceMode]);
  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
