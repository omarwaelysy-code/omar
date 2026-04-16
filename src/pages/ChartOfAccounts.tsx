import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Account, AccountType } from '../types';
import { dbService } from '../services/dbService';
import { ChevronDown, ChevronRight, BookOpen, PieChart, Folder, FileText, BarChart3 } from 'lucide-react';

interface TreeItemProps {
  label: string;
  icon: React.ElementType;
  children?: React.ReactNode;
  level: number;
  isOpenDefault?: boolean;
}

const TreeItem: React.FC<TreeItemProps> = ({ label, icon: Icon, children, level, isOpenDefault = false }) => {
  const [isOpen, setIsOpen] = useState(isOpenDefault);

  return (
    <div className="select-none">
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className={`
          flex items-center gap-2 py-2 px-3 rounded-xl cursor-pointer transition-all
          ${level === 0 ? 'bg-zinc-100 font-bold text-zinc-900 mb-1' : 'hover:bg-zinc-50 text-zinc-700'}
        `}
        style={{ marginRight: `${level * 24}px` }}
      >
        {children ? (
          isOpen ? <ChevronDown size={16} className="text-zinc-400" /> : <ChevronRight size={16} className="text-zinc-400" />
        ) : (
          <div className="w-4" />
        )}
        <Icon size={18} className={level === 0 ? 'text-emerald-600' : 'text-zinc-400'} />
        <span>{label}</span>
      </div>
      {isOpen && children && (
        <div className="mt-1">
          {children}
        </div>
      )}
    </div>
  );
};

export const ChartOfAccounts: React.FC = () => {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [types, setTypes] = useState<AccountType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      const unsubAccounts = dbService.subscribe<Account>('accounts', user.company_id, setAccounts);
      const unsubTypes = dbService.subscribe<AccountType>('account_types', user.company_id, setTypes);
      setLoading(false);
      return () => {
        unsubAccounts();
        unsubTypes();
      };
    }
  }, [user]);

  const classifications = [
    { id: 'asset', label: 'الأصول', statement: 'balance_sheet' },
    { id: 'liability_equity', label: 'الالتزامات وحقوق الملكية', statement: 'balance_sheet' },
    { id: 'revenue', label: 'الإيرادات', statement: 'income_statement' },
    { id: 'cost', label: 'التكاليف', statement: 'income_statement' },
    { id: 'expense', label: 'المصروفات', statement: 'income_statement' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-zinc-900 italic serif">شجرة الحسابات</h2>
        <p className="text-zinc-500 text-sm">عرض هيكلي لكافة الحسابات المالية المصنفة حسب القوائم المالية.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Balance Sheet Section */}
        <div className="bg-white p-6 rounded-3xl border border-zinc-100 shadow-sm space-y-4">
          <div className="flex items-center gap-3 pb-4 border-b border-zinc-50">
            <div className="w-10 h-10 rounded-xl bg-blue-500 text-white flex items-center justify-center shadow-lg shadow-blue-500/20">
              <PieChart size={20} />
            </div>
            <h3 className="text-xl font-bold text-zinc-900">الميزانية العمومية</h3>
          </div>

          <div className="space-y-2">
            {classifications.filter(c => c.statement === 'balance_sheet').map(cls => (
              <TreeItem key={cls.id} label={cls.label} icon={Folder} level={0} isOpenDefault={true}>
                {types.filter(t => t.classification === cls.id).map(type => (
                  <TreeItem key={type.id} label={`${type.code} - ${type.name}`} icon={Folder} level={1}>
                    {accounts.filter(a => a.type_id === type.id).map(account => (
                      <TreeItem key={account.id} label={`${account.code} - ${account.name}`} icon={FileText} level={2} />
                    ))}
                  </TreeItem>
                ))}
              </TreeItem>
            ))}
          </div>
        </div>

        {/* Income Statement Section */}
        <div className="bg-white p-6 rounded-3xl border border-zinc-100 shadow-sm space-y-4">
          <div className="flex items-center gap-3 pb-4 border-b border-zinc-50">
            <div className="w-10 h-10 rounded-xl bg-orange-500 text-white flex items-center justify-center shadow-lg shadow-orange-500/20">
              <BarChart3 size={20} />
            </div>
            <h3 className="text-xl font-bold text-zinc-900">قائمة الدخل</h3>
          </div>

          <div className="space-y-2">
            {classifications.filter(c => c.statement === 'income_statement').map(cls => (
              <TreeItem key={cls.id} label={cls.label} icon={Folder} level={0} isOpenDefault={true}>
                {types.filter(t => t.classification === cls.id).map(type => (
                  <TreeItem key={type.id} label={`${type.code} - ${type.name}`} icon={Folder} level={1}>
                    {accounts.filter(a => a.type_id === type.id).map(account => (
                      <TreeItem key={account.id} label={`${account.code} - ${account.name}`} icon={FileText} level={2} />
                    ))}
                  </TreeItem>
                ))}
              </TreeItem>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
