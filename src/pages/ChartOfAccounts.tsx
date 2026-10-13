import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { Account, AccountType } from '../types';
import { dbService } from '../services/dbService';
import { ChevronDown, ChevronRight, ChevronLeft, BookOpen, PieChart, Folder, FileText, BarChart3, AlertTriangle, Edit2 } from 'lucide-react';
import { useNavigation } from '../contexts/NavigationContext';

interface TreeItemProps {
  label: React.ReactNode;
  icon: React.ElementType;
  children?: React.ReactNode;
  level: number;
  isOpenDefault?: boolean;
}

const TreeItem: React.FC<TreeItemProps> = ({ label, icon: Icon, children, level, isOpenDefault = false }) => {
  const [isOpen, setIsOpen] = useState(isOpenDefault);
  const { dir } = useLanguage();

  return (
    <div className="select-none">
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className={`
          flex items-center gap-2 py-2 px-3 rounded-xl cursor-pointer transition-all
          ${level === 0 ? 'bg-zinc-100 font-bold text-zinc-900 mb-1' : 'hover:bg-zinc-50 text-zinc-700'}
        `}
        style={dir === 'rtl' ? { marginRight: `${level * 24}px` } : { marginLeft: `${level * 24}px` }}
      >
        {children ? (
          isOpen ? (
            <ChevronDown size={16} className="text-zinc-400" />
          ) : (
            dir === 'rtl' ? <ChevronLeft size={16} className="text-zinc-400" /> : <ChevronRight size={16} className="text-zinc-400" />
          )
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
  const { t, dir, language } = useLanguage();
  const { setCurrentPage, setPendingAccountTypeEditId } = useNavigation();
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
    { id: 'asset', label: language === 'ar' ? 'الأصول' : 'Assets', statement: 'balance_sheet' },
    { id: 'liability_equity', label: language === 'ar' ? 'الالتزامات وحقوق الملكية' : 'Liabilities & Equity', statement: 'balance_sheet' },
    { id: 'revenue', label: language === 'ar' ? 'الإيرادات' : 'Revenues', statement: 'income_statement' },
    { id: 'cost', label: language === 'ar' ? 'التكاليف' : 'Costs', statement: 'income_statement' },
    { id: 'expense', label: language === 'ar' ? 'المصروفات' : 'Expenses', statement: 'income_statement' },
    { id: 'other', label: language === 'ar' ? 'أخرى / غير مصنف' : 'Other / Unclassified', statement: 'other' },
  ];

  const subClassifications: Record<string, { id: string; label: string }[]> = {
    asset: [
      { id: 'cash_and_equivalents', label: language === 'ar' ? 'نقدية وما في حكمها' : 'Cash & Cash Equivalents' },
      { id: 'receivables', label: language === 'ar' ? 'عملاء' : 'Customers / Receivables' },
      { id: 'asset', label: language === 'ar' ? 'أصول أخرى' : 'Other Assets' },
    ],
    liability_equity: [
      { id: 'payables', label: language === 'ar' ? 'موردين' : 'Suppliers / Payables' },
      { id: 'liability', label: language === 'ar' ? 'التزامات' : 'Liabilities' },
      { id: 'equity', label: language === 'ar' ? 'حقوق ملكية' : 'Equity' },
      { id: 'liability_equity', label: language === 'ar' ? 'التزام/حقوق ملكية (مشترك)' : 'Liability/Equity (Joint)' },
    ],
    revenue: [
      { id: 'revenue', label: language === 'ar' ? 'إيرادات النشاط' : 'Operating Revenues' },
      { id: 'other_revenue', label: language === 'ar' ? 'إيرادات أخرى' : 'Other Revenues' },
    ],
    cost: [
      { id: 'cost', label: language === 'ar' ? 'التكاليف' : 'Costs' },
    ],
    expense: [
      { id: 'interest_expense', label: language === 'ar' ? 'فوائد مدينة' : 'Debit Interest' },
      { id: 'depreciation', label: language === 'ar' ? 'اهلاكات' : 'Depreciation' },
      { id: 'other_expense', label: language === 'ar' ? 'مصروفات اخرى' : 'Other Expenses' },
      { id: 'expense', label: language === 'ar' ? 'مصروفات تشغيلية وعامة' : 'Operating & General Expenses' },
    ]
  };

  const getAccountTypeDisplay = (name?: string) => {
    if (!name || language === 'ar') return name || '';
    const map: Record<string, string> = {
      'الأصول': 'Assets',
      'أصول': 'Assets',
      'الالتزامات': 'Liabilities',
      'التزامات': 'Liabilities',
      'حقوق ملكية': 'Equity',
      'حقوق الملكية': 'Equity',
      'ايراد': 'Revenue',
      'إيراد': 'Revenue',
      'إيرادات': 'Revenues',
      'ايرادات': 'Revenues',
      'الإيرادات': 'Revenues',
      'تكلفة': 'Cost of Sales',
      'تكلفة المبيعات': 'Cost of Sales',
      'المصروفات': 'Expenses',
      'مصروفات': 'Expenses',
      'مصاريف': 'Expenses',
      'أصول متداولة': 'Current Assets',
      'الأصول المتداولة': 'Current Assets',
      'أصول غير متداولة': 'Non-Current Assets',
      'الأصول غير المتداولة': 'Non-Current Assets',
      'الالتزامات المتداولة': 'Current Liabilities',
      'التزامات متداولة': 'Current Liabilities',
      'الالتزامات غير المتداولة': 'Non-Current Liabilities',
      'التزامات غير متداولة': 'Non-Current Liabilities'
    };
    return map[name.trim()] || name;
  };

  const getTypesBySubCls = (subClsId: string) => {
    return types.filter(t => t.classification === subClsId);
  };

  const renderAccountTree = (parentId: string | null, typeId: string | null, level: number) => {
    const levelAccounts = accounts.filter(a => {
      // If we're looking for root accounts, they either have no parent_id or parent_id is empty/invalid
      if (parentId === null) {
        const isRoot = !a.parent_id || a.parent_id === "" || !accounts.some(potentialParent => potentialParent.id === a.parent_id);
        return a.type_id === typeId && isRoot;
      }
      return a.parent_id === parentId;
    });

    return levelAccounts.map(account => {
      const hasChildren = accounts.some(a => a.parent_id === account.id);
      return (
        <TreeItem 
          key={account.id} 
          label={`${account.code} - ${account.name} (${language === 'ar' ? 'رصيد:' : 'Balance:'} ${account.opening_balance || 0})`} 
          icon={hasChildren ? Folder : FileText} 
          level={level}
        >
          {hasChildren && renderAccountTree(account.id, typeId, level + 1)}
        </TreeItem>
      );
    });
  };

  const filterTypesByCls = (clsId: string) => {
    if (clsId === 'other') {
      const knownClassifications = [
        'asset', 'liability', 'equity', 'liability_equity', 'cash_and_equivalents', 'receivables', 'payables',
        'revenue', 'cost', 'expense', 'interest_expense', 'depreciation', 'other_revenue', 'other_expense'
      ];
      return types.filter(t => !t.classification || !knownClassifications.includes(t.classification));
    }
    return types.filter(t => {
      if (clsId === 'liability_equity') {
        return ['liability', 'equity', 'liability_equity', 'payables'].includes(t.classification);
      }
      if (clsId === 'asset') {
        return ['asset', 'cash_and_equivalents', 'receivables'].includes(t.classification);
      }
      if (clsId === 'revenue') {
        return ['revenue', 'other_revenue'].includes(t.classification);
      }
      if (clsId === 'expense') {
        return ['expense', 'interest_expense', 'depreciation', 'other_expense'].includes(t.classification);
      }
      return t.classification === clsId;
    });
  };

  const renderOrphanedAccounts = () => {
    // Accounts with missing or invalid type
    const orphaned = accounts.filter(a => {
      const typeExists = types.some(t => t.id === a.type_id);
      return !a.type_id || !typeExists;
    });

    if (orphaned.length === 0) return null;

    return (
      <TreeItem label={language === 'ar' ? 'حسابات بدون تصنيف' : 'Unclassified Accounts'} icon={AlertTriangle} level={0}>
        {orphaned.map(a => (
          <TreeItem 
            key={a.id} 
            label={`${a.code} - ${a.name}`} 
            icon={FileText} 
            level={1}
          />
        ))}
      </TreeItem>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500" dir={dir}>
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-zinc-900 italic serif">
          {language === 'ar' ? 'شجرة الحسابات' : 'Chart of Accounts Tree'}
        </h2>
        <p className="text-zinc-500 text-sm">
          {language === 'ar' 
            ? 'عرض هيكلي لكافة الحسابات المالية المصنفة حسب القوائم المالية.' 
            : 'Hierarchical view of all financial accounts classified by financial statements.'}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Balance Sheet Section */}
        <div className="bg-white p-6 rounded-3xl border border-zinc-100 shadow-sm space-y-4">
          <div className="flex items-center gap-3 pb-4 border-b border-zinc-50">
            <div className="w-10 h-10 rounded-xl bg-blue-500 text-white flex items-center justify-center shadow-lg shadow-blue-500/20">
              <PieChart size={20} />
            </div>
            <h3 className="text-xl font-bold text-zinc-900">
              {language === 'ar' ? 'الميزانية العمومية' : 'Balance Sheet'}
            </h3>
          </div>

          <div className="space-y-2">
            {classifications.filter(c => c.statement === 'balance_sheet').map(cls => {
              const hasSubClassifications = subClassifications[cls.id] !== undefined;
              return (
                <TreeItem key={cls.id} label={cls.label} icon={Folder} level={0} isOpenDefault={true}>
                  {hasSubClassifications ? (
                    subClassifications[cls.id].map(sub => {
                      const subTypes = getTypesBySubCls(sub.id);
                      if (subTypes.length === 0) return null;
                      return (
                        <TreeItem key={sub.id} label={sub.label} icon={Folder} level={1} isOpenDefault={true}>
                          {subTypes.map(type => (
                            <TreeItem 
                              key={type.id} 
                              label={
                                <div className="flex items-center gap-2 group/type">
                                  <span>{type.code} - {getAccountTypeDisplay(type.name)}</span>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setPendingAccountTypeEditId(type.id);
                                      setCurrentPage('account_types');
                                    }}
                                    className="p-1 text-zinc-400 hover:text-emerald-600 rounded hover:bg-zinc-200 opacity-0 group-hover/type:opacity-100 transition-opacity"
                                    title={language === 'ar' ? 'تعديل نوع الحساب' : 'Edit Account Type'}
                                  >
                                    <Edit2 size={12} />
                                  </button>
                                </div>
                              } 
                              icon={Folder} 
                              level={2}
                            >
                              {renderAccountTree(null, type.id, 3)}
                            </TreeItem>
                          ))}
                        </TreeItem>
                      );
                    })
                  ) : (
                    filterTypesByCls(cls.id).map(type => (
                      <TreeItem 
                        key={type.id} 
                        label={
                          <div className="flex items-center gap-2 group/type">
                            <span>{type.code} - {getAccountTypeDisplay(type.name)}</span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setPendingAccountTypeEditId(type.id);
                                setCurrentPage('account_types');
                              }}
                              className="p-1 text-zinc-400 hover:text-emerald-600 rounded hover:bg-zinc-200 opacity-0 group-hover/type:opacity-100 transition-opacity"
                              title={language === 'ar' ? 'تعديل نوع الحساب' : 'Edit Account Type'}
                            >
                              <Edit2 size={12} />
                            </button>
                          </div>
                        } 
                        icon={Folder} 
                        level={1}
                      >
                        {renderAccountTree(null, type.id, 2)}
                      </TreeItem>
                    ))
                  )}
                </TreeItem>
              );
            })}
            {renderOrphanedAccounts()}
          </div>
        </div>

        {/* Income Statement Section */}
        <div className="bg-white p-6 rounded-3xl border border-zinc-100 shadow-sm space-y-4">
          <div className="flex items-center gap-3 pb-4 border-b border-zinc-50">
            <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <BarChart3 size={20} />
            </div>
            <h3 className="text-xl font-bold text-zinc-900">
              {language === 'ar' ? 'قائمة الدخل' : 'Income Statement'}
            </h3>
          </div>

          <div className="space-y-2">
            {classifications.filter(c => c.statement === 'income_statement' || c.statement === 'other').map(cls => {
              const hasSubClassifications = subClassifications[cls.id] !== undefined;
              return (
                <TreeItem key={cls.id} label={cls.label} icon={Folder} level={0} isOpenDefault={true}>
                  {hasSubClassifications ? (
                    subClassifications[cls.id].map(sub => {
                      const subTypes = getTypesBySubCls(sub.id);
                      if (subTypes.length === 0) return null;
                      return (
                        <TreeItem key={sub.id} label={sub.label} icon={Folder} level={1} isOpenDefault={true}>
                          {subTypes.map(type => (
                            <TreeItem 
                              key={type.id} 
                              label={
                                <div className="flex items-center gap-2 group/type">
                                  <span>{type.code} - {getAccountTypeDisplay(type.name)}</span>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setPendingAccountTypeEditId(type.id);
                                      setCurrentPage('account_types');
                                    }}
                                    className="p-1 text-zinc-400 hover:text-emerald-600 rounded hover:bg-zinc-200 opacity-0 group-hover/type:opacity-100 transition-opacity"
                                    title={language === 'ar' ? 'تعديل نوع الحساب' : 'Edit Account Type'}
                                  >
                                    <Edit2 size={12} />
                                  </button>
                                </div>
                              } 
                              icon={Folder} 
                              level={2}
                            >
                              {renderAccountTree(null, type.id, 3)}
                            </TreeItem>
                          ))}
                        </TreeItem>
                      );
                    })
                  ) : (
                    filterTypesByCls(cls.id).map(type => (
                      <TreeItem 
                        key={type.id} 
                        label={
                          <div className="flex items-center gap-2 group/type">
                            <span>{type.code} - {getAccountTypeDisplay(type.name)}</span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setPendingAccountTypeEditId(type.id);
                                setCurrentPage('account_types');
                              }}
                              className="p-1 text-zinc-400 hover:text-emerald-600 rounded hover:bg-zinc-200 opacity-0 group-hover/type:opacity-100 transition-opacity"
                              title={language === 'ar' ? 'تعديل نوع الحساب' : 'Edit Account Type'}
                            >
                              <Edit2 size={12} />
                            </button>
                          </div>
                        } 
                        icon={Folder} 
                        level={1}
                      >
                        {renderAccountTree(null, type.id, 2)}
                      </TreeItem>
                    ))
                  )}
                </TreeItem>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
