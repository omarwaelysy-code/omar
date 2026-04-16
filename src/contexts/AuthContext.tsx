import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, ModulePermissions } from '../types';
import { dbService } from '../services/dbService';

interface AuthContextType {
  user: User | null;
  userMemberships: User[];
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  switchCompany: (companyId: string) => Promise<void>;
  isAuthenticated: boolean;
  isSuperAdmin: boolean;
  isCompanyAdmin: boolean;
  isManager: boolean;
  isStandardUser: boolean;
  hasPermission: (moduleId: string, action: keyof ModulePermissions) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  console.log("AuthProvider: Rendering...");
  const [user, setUser] = useState<User | null>(null);
  const [userMemberships, setUserMemberships] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

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

  const fetchProfile = async (userId: string, email: string) => {
    try {
      console.log('AuthContext: Fetching profile for ID:', userId);
      
      // Query all user documents that have this email or ID
      let membershipsData: any[] = await dbService.query('users', [
        { field: 'email', operator: '==', value: email }
      ]);
      
      if (membershipsData.length === 0) {
        const directDoc = await dbService.get<any>('users', userId);
        if (directDoc) membershipsData.push(directDoc);
      }

      const memberships: User[] = [];
      for (const userData of membershipsData) {
        let companyName = 'شركة غير معروفة';
        
        if (userData.company_id) {
          const company = await dbService.get<any>('companies', userData.company_id);
          if (company) {
            companyName = company.name;
          }
        }
        
        memberships.push({
          ...userData,
          company_name: companyName
        });
      }
      
      setUserMemberships(memberships);

      if (memberships.length > 0) {
        const preferredCompanyId = localStorage.getItem(`preferred_company_${userId}`);
        const preferredMembership = memberships.find(m => m.company_id === preferredCompanyId);
        
        const activeMembership = preferredMembership || memberships[0];
        setUser({ 
          ...activeMembership, 
          must_change_password: activeMembership.must_change_password || false
        });
      } else {
        // Fallback for super admin
        const isSuperAdminEmail = email === 'omarwaelysy@gmail.com' || email === 'omarwaelsys@gmail.com';
        setUser({ 
          id: userId, 
          username: email.split('@')[0], 
          role: isSuperAdminEmail ? 'admin' : 'user', 
          company_id: isSuperAdminEmail ? 'system' : '',
          status: 'active',
          created_at: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('AuthContext: Error fetching profile:', error);
      throw error;
    }
  };

  const login = async (email: string, password: string) => {
    try {
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
    }
  };

  const switchCompany = async (companyId: string) => {
    if (!user) return;
    
    const membership = userMemberships.find(m => m.company_id === companyId);
    if (membership) {
      setUser({
        ...membership,
        must_change_password: membership.must_change_password || false
      });
      localStorage.setItem(`preferred_company_${user.id}`, companyId);
    }
  };

  const logout = async () => {
    localStorage.removeItem('auth_user');
    localStorage.removeItem('auth_token');
    setUser(null);
    setUserMemberships([]);
  };

  const isSuperAdmin = user?.role === 'admin' && user?.company_id === 'system';
  const isCompanyAdmin = user?.role === 'admin' && user?.company_id !== 'system';
  const isManager = user?.role === 'manager';
  const isStandardUser = user?.role === 'user';

  const hasPermission = (moduleId: string, action: keyof ModulePermissions): boolean => {
    if (isSuperAdmin || isCompanyAdmin) return true;
    if (isManager) {
      // Managers can view and create but maybe not delete
      if (action === 'delete') return false;
      return true;
    }
    if (moduleId === 'dashboard' && action === 'view') return true;
    
    if (!user?.permissions) {
      return action === 'view';
    }
    const modulePerms = user.permissions[moduleId];
    return modulePerms ? modulePerms[action] : false;
  };

  const isAuthenticated = !!user && (isSuperAdmin || !!user.company_id);

  const value = React.useMemo(() => ({ 
    user, 
    userMemberships,
    loading, 
    login,
    logout, 
    switchCompany,
    isAuthenticated,
    isSuperAdmin,
    isCompanyAdmin,
    isManager,
    isStandardUser,
    hasPermission
  }), [user, userMemberships, loading, isAuthenticated, isSuperAdmin, isCompanyAdmin, isManager, isStandardUser, hasPermission]);

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
