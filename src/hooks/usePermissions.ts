import { useAuth } from '../contexts/AuthContext';
import { ModulePermissions } from '../types';

export const usePermissions = (moduleId: string) => {
  const { user } = useAuth();

  if (!user) {
    return {
      canView: false,
      canCreate: false,
      canEdit: false,
      canDelete: false,
      isAdmin: false
    };
  }

  if (user.role === 'admin') {
    return {
      canView: true,
      canCreate: true,
      canEdit: true,
      canDelete: true,
      isAdmin: true
    };
  }

  const permissions = user.permissions?.[moduleId] || {
    view: false,
    create: false,
    edit: false,
    delete: false
  };

  return {
    canView: permissions.view,
    canCreate: permissions.create,
    canEdit: permissions.edit,
    canDelete: permissions.delete,
    isAdmin: false
  };
};
