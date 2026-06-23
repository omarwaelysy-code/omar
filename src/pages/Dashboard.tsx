import React, { useState, useEffect, useRef } from 'react';
import { 
  TrendingUp, 
  FileText, 
  Receipt as ReceiptIcon, 
  ArrowUpRight, 
  Search,
  Sparkles,
  Clock,
  ArrowDownRight,
  Zap,
  Users as UsersIcon,
  Calendar,
  Calendar as CalendarIcon,
  Wallet,
  Truck,
  Package,
  CreditCard,
  Settings,
  Bell,
  List,
  Layout,
  BarChart2,
  LineChart as LineChartIcon,
  PieChart as PieIcon,
  Table as TableIcon,
  Plus,
  Trash2,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Save,
  Undo2,
  Redo2,
  Copy,
  Share2,
  X as XIcon,
  HelpCircle,
  Smartphone,
  Tablet as TabletIcon,
  Laptop as LaptopIcon,
  Monitor
} from 'lucide-react';
import * as Lucide from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ScatterChart,
  Scatter
} from 'recharts';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { useNavigation, pageLabels } from '../contexts/NavigationContext';
import { useLanguage } from '../contexts/LanguageContext';
import { 
  DashboardStats, 
  Invoice, 
  Return, 
  ReceiptVoucher, 
  PaymentVoucher, 
  Customer, 
  Supplier, 
  DashboardTransaction,
  PurchaseInvoice,
  PurchaseReturn,
  CustomerDiscount,
  SupplierDiscount,
  Account,
  AccountType,
  Widget
} from '../types';
import { smartSearch } from '../services/geminiService';
import { dbService } from '../services/dbService';
import { AccountingEngine } from '../services/AccountingEngine';
import { formatNumber, formatMoney, formatDate } from '../utils/formatUtils';
import { WIDGET_REGISTRY } from '../constants/widgets';

// Global cache for dashboard stats to reduce reads on tab switches
let statsCache: { [companyId: string]: { stats: DashboardStats, timestamp: number } } = {};
const CACHE_DURATION = 1000 * 30; // 30 seconds

// Listen for database changes GLOBALLY to invalidate cache even if Dashboard is not mounted
if (typeof window !== 'undefined') {
  window.addEventListener('db-refresh', () => {
    statsCache = {};
  });
}

export const clearDashboardCache = () => {
  statsCache = {};
};

const StatCard = ({ title, value, subtitle, icon: Icon, trend, colorClass }: any) => (
  <motion.div 
    whileHover={{ y: -5 }}
    className="bg-white border border-slate-200 rounded-2xl p-6 relative overflow-hidden group shadow-sm transition-all"
  >
    <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${colorClass} opacity-[0.03] rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500`} />
    
    <div className="flex items-center justify-between mb-4 relative z-10">
            <div className={`p-3 rounded-xl bg-slate-50 border border-slate-100 group-hover:scale-110 transition-transform`}>
        <Icon size={24} className={colorClass && typeof colorClass === 'string' ? colorClass.split(' ')[0].replace('from-', 'text-') : ''} />
      </div>
      {trend && (
        <span className={`text-[10px] font-bold px-2 py-1 rounded-md flex items-center gap-1 ${trend > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
          {trend > 0 ? <TrendingUp size={12} /> : <ArrowDownRight size={12} />}
          {Math.abs(trend)}%
        </span>
      )}
    </div>
    
    <div className="relative z-10">
      <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">{title}</p>
      <h3 className="text-2xl font-bold text-slate-900 tracking-tight">{value}</h3>
      {subtitle && <p className="text-[10px] text-slate-400 font-medium mt-1 uppercase tracking-tight">{subtitle}</p>}
    </div>
  </motion.div>
);

const DynamicWidgetRenderer: React.FC<{ widget: Widget }> = ({ widget }) => {
  const { language } = useLanguage();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const payload = {
        source: widget.settings?.dataSource,
        fields: widget.settings?.fields || [],
        filters: [
          ...(widget.filters?.custom || []),
          ...(widget.filters?.warehouseId ? [{ field: 'warehouse_id', operator: '=', value: widget.filters.warehouseId }] : [])
        ],
        dateRange: widget.filters?.dateRange || 'this_month',
        sorting: widget.settings?.sorting,
        grouping: widget.settings?.grouping || [],
        aggregation: widget.settings?.aggregation
      };

      const result = await dbService.queryWidgetData(payload);
      setData(Array.isArray(result) ? result : []);
    } catch (err: any) {
      console.error('Error fetching widget query:', err);
      setError(err.message || 'Error loading widget data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    
    let interval: any;
    if (widget.settings?.autoRefresh) {
      const intervalMs = Math.max(10, widget.settings?.refreshInterval || 60) * 1000;
      interval = setInterval(fetchData, intervalMs);
    }

    const handleDbRefresh = (e: any) => {
      if (e.detail?.collection === widget.settings?.dataSource) {
        fetchData();
      }
    };
    window.addEventListener('db-refresh', handleDbRefresh);

    return () => {
      if (interval) clearInterval(interval);
      window.removeEventListener('db-refresh', handleDbRefresh);
    };
  }, [widget]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-5 h-5 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-rose-500 text-[10px] p-2 text-center leading-normal">
        {error}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400 text-[10px]">
        No data found
      </div>
    );
  }

  const chartType = widget.settings?.chartType || 'line';

  switch (chartType) {
    case 'kpi_card': {
      const firstRow = data[0] || {};
      const value = firstRow.value !== undefined ? firstRow.value : (firstRow.current !== undefined ? firstRow.current : 0);
      const isMoney = !widget.settings?.aggregation?.field?.includes('count') && !widget.settings?.aggregation?.field?.includes('id');
      const formattedVal = isMoney ? formatMoney(value) : formatNumber(value);

      return (
        <div className="flex flex-col justify-center h-full py-1 relative">
          <p className="text-2xl font-extrabold text-slate-900 truncate tracking-tight">{formattedVal}</p>
          
          {firstRow.growth !== undefined && (
            <div className="flex items-center gap-1.5 mt-2">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg flex items-center gap-0.5 ${
                firstRow.growth >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
              }`}>
                {firstRow.growth >= 0 ? '▲' : '▼'} {Math.abs(firstRow.growth)}%
              </span>
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">vs prev period</span>
            </div>
          )}
          
          {firstRow.previous !== undefined && (
            <p className="text-[9px] text-slate-400 font-semibold mt-1">
              Previous: {isMoney ? formatMoney(firstRow.previous) : formatNumber(firstRow.previous)}
            </p>
          )}
        </div>
      );
    }

    case 'line':
      return (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey={widget.settings?.grouping?.[0] || 'date'} tick={{ fontSize: 9, fill: '#94a3b8' }} />
            <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} />
            <Tooltip contentStyle={{ fontSize: 10 }} />
            {widget.settings?.showLegend !== false && <Legend iconSize={8} wrapperStyle={{ fontSize: 8 }} />}
            <Line type="monotone" dataKey="value" stroke={widget.settings?.color || '#3b82f6'} strokeWidth={2} dot={{ r: 2 }} />
          </LineChart>
        </ResponsiveContainer>
      );

    case 'bar':
      return (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey={widget.settings?.grouping?.[0] || 'date'} tick={{ fontSize: 9, fill: '#94a3b8' }} />
            <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} />
            <Tooltip contentStyle={{ fontSize: 10 }} />
            {widget.settings?.showLegend !== false && <Legend iconSize={8} wrapperStyle={{ fontSize: 8 }} />}
            <Bar dataKey="value" fill={widget.settings?.color || '#10b981'} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      );

    case 'area':
      return (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
            <defs>
              <linearGradient id={`gradient-${widget.id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={widget.settings?.color || '#10b981'} stopOpacity={0.2}/>
                <stop offset="95%" stopColor={widget.settings?.color || '#10b981'} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey={widget.settings?.grouping?.[0] || 'date'} tick={{ fontSize: 9, fill: '#94a3b8' }} />
            <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} />
            <Tooltip contentStyle={{ fontSize: 10 }} />
            {widget.settings?.showLegend !== false && <Legend iconSize={8} wrapperStyle={{ fontSize: 8 }} />}
            <Area type="monotone" dataKey="value" stroke={widget.settings?.color || '#10b981'} strokeWidth={2} fill={`url(#gradient-${widget.id})`} />
          </AreaChart>
        </ResponsiveContainer>
      );

    case 'pie':
    case 'donut': {
      const isDonut = chartType === 'donut';
      const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];
      return (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie 
              data={data} 
              cx="50%" 
              cy="50%" 
              innerRadius={isDonut ? 20 : 0} 
              outerRadius={35} 
              paddingAngle={2} 
              dataKey="value"
              nameKey={widget.settings?.grouping?.[0] || 'date'}
            >
              {data.map((entry, idx) => (
                <Cell key={`cell-${idx}`} fill={COLORS[idx % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={{ fontSize: 10 }} />
            {widget.settings?.showLegend !== false && <Legend iconSize={6} wrapperStyle={{ fontSize: 7 }} />}
          </PieChart>
        </ResponsiveContainer>
      );
    }

    case 'radar': {
      const radarColor = widget.settings?.color || '#8b5cf6';
      return (
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
            <PolarGrid stroke="#f1f5f9" />
            <PolarAngleAxis dataKey={widget.settings?.grouping?.[0] || 'date'} tick={{ fontSize: 8 }} />
            <PolarRadiusAxis angle={30} domain={[0, 'auto']} tick={{ fontSize: 8 }} />
            <Radar name="Value" dataKey="value" stroke={radarColor} fill={radarColor} fillOpacity={0.4} />
            <Tooltip contentStyle={{ fontSize: 9 }} />
          </RadarChart>
        </ResponsiveContainer>
      );
    }

    case 'scatter':
      return (
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis type="category" dataKey={widget.settings?.grouping?.[0] || 'date'} tick={{ fontSize: 8 }} name="Group" />
            <YAxis type="number" dataKey="value" name="Value" tick={{ fontSize: 8 }} />
            <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ fontSize: 9 }} />
            <Scatter name="Data Points" data={data} fill={widget.settings?.color || '#f59e0b'} />
          </ScatterChart>
        </ResponsiveContainer>
      );

    case 'heatmap': {
      const valMax = Math.max(...data.map(d => Number(d.value || 0)), 1);
      return (
        <div className="w-full h-full overflow-auto text-[9px] custom-scrollbar">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5 p-1">
            {data.slice(0, 16).map((item, idx) => {
              const val = Number(item.value || 0);
              const label = item[widget.settings?.grouping?.[0] || 'date'] || item.date || `Item ${idx+1}`;
              const ratio = Math.min(1, val / valMax);
              return (
                <div 
                  key={idx}
                  className="p-2.5 rounded-xl border flex flex-col justify-between h-14 font-semibold text-slate-800 transition-all shadow-sm hover:scale-[1.02]"
                  style={{
                    backgroundColor: `rgba(99, 102, 241, ${Math.max(0.05, ratio * 0.4)})`,
                    borderColor: `rgba(99, 102, 241, ${Math.max(0.1, ratio * 0.5)})`
                  }}
                >
                  <span className="truncate block opacity-85">{label}</span>
                  <span className="font-extrabold text-[11px] mt-1 text-indigo-950 block">{formatNumber(val)}</span>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    case 'gauge': {
      const firstRow = data[0] || {};
      const val = Number(firstRow.value !== undefined ? firstRow.value : 0);
      const limitVal = widget.settings?.gaugeLimit || Math.max(100, val * 1.2);
      
      const gaugeData = [
        { name: 'Progress', value: val, color: widget.settings?.color || '#3b82f6' },
        { name: 'Remaining', value: Math.max(0, limitVal - val), color: '#e2e8f0' }
      ];

      return (
        <div className="relative w-full h-full flex flex-col items-center justify-center">
          <ResponsiveContainer width="100%" height="80%">
            <PieChart>
              <Pie
                data={gaugeData}
                cx="50%"
                cy="80%"
                startAngle={180}
                endAngle={0}
                innerRadius={30}
                outerRadius={45}
                dataKey="value"
              >
                {gaugeData.map((entry, idx) => (
                  <Cell key={`cell-${idx}`} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute bottom-[20%] text-center">
            <span className="text-sm font-extrabold text-slate-800 block leading-none">{formatNumber(val)}</span>
            <span className="text-[7px] text-slate-400 uppercase font-black block mt-0.5">Target {formatNumber(limitVal)}</span>
          </div>
        </div>
      );
    }

    case 'table': {
      const cols = data.length > 0 ? Object.keys(data[0]) : [];
      return (
        <div className="w-full h-full overflow-auto text-[9px] border border-slate-100 rounded-xl bg-slate-50/30 custom-scrollbar">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-bold sticky top-0">
                {cols.map(c => (
                  <th key={c} className="text-left p-1.5 capitalize">{c.replace(/_/g, ' ')}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((row, idx) => (
                <tr key={idx} className="border-b border-slate-100 last:border-0 hover:bg-slate-100/50">
                  {cols.map(c => {
                    const val = row[c];
                    const displayVal = typeof val === 'number' ? formatNumber(val) : String(val || '');
                    return (
                      <td key={c} className="p-1.5 font-medium text-slate-700 max-w-[120px] truncate">{displayVal}</td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    case 'pivot': {
      const pivotRowKey = widget.settings?.grouping?.[0] || Object.keys(data[0] || {}).find(k => k !== 'value') || 'date';
      const pivotColKey = Object.keys(data[0] || {}).find(k => k !== pivotRowKey && k !== 'value') || '';

      const pivotRows = Array.from(new Set(data.map(d => String(d[pivotRowKey] || ''))));
      const pivotCols = pivotColKey ? Array.from(new Set(data.map(d => String(d[pivotColKey] || '')))) : ['Value'];

      return (
        <div className="w-full h-full overflow-auto text-[9px] border border-slate-100 rounded-xl bg-slate-50/30 custom-scrollbar">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-bold sticky top-0">
                <th className="text-left p-1.5 capitalize">{pivotRowKey.replace(/_/g, ' ')}</th>
                {pivotCols.map(c => (
                  <th key={c} className="text-right p-1.5 capitalize">{c.replace(/_/g, ' ')}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pivotRows.map(rowVal => {
                return (
                  <tr key={rowVal} className="border-b border-slate-100 last:border-0 hover:bg-slate-100/50">
                    <td className="p-1.5 font-bold text-slate-700">{rowVal}</td>
                    {pivotCols.map(colVal => {
                      const item = data.find(d => String(d[pivotRowKey] || '') === rowVal && (!pivotColKey || String(d[pivotColKey] || '') === colVal));
                      const val = item ? Number(item.value || 0) : 0;
                      return (
                        <td key={colVal} className="p-1.5 text-right font-semibold text-slate-900">{formatNumber(val)}</td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      );
    }

    case 'text':
      return (
        <div className="flex flex-col justify-center h-full py-1 text-slate-700">
          <p className="text-xs font-semibold whitespace-pre-wrap leading-normal">
            {widget.settings?.text || widget.settings?.description || widget.title || 'Text Widget'}
          </p>
        </div>
      );

    default:
      return <div className="text-slate-400 text-[10px] flex items-center justify-center h-full">Unsupported Chart: {chartType}</div>;
  }
};

const masterDataItems = [
  { id: 'customers', label: 'العملاء', icon: UsersIcon, color: 'from-blue-500/20 to-blue-600/20', iconColor: 'text-blue-600' },
  { id: 'suppliers', label: 'الموردين', icon: Truck, color: 'from-emerald-500/20 to-emerald-600/20', iconColor: 'text-emerald-600' },
  { id: 'products', label: 'المنتجات', icon: Package, color: 'from-amber-500/20 to-amber-600/20', iconColor: 'text-amber-600' },
  { id: 'accounts', label: 'الحسابات', icon: Wallet, color: 'from-purple-500/20 to-purple-600/20', iconColor: 'text-purple-600' },
  { id: 'payment_methods', label: 'وسائل الدفع', icon: CreditCard, color: 'from-indigo-500/20 to-indigo-600/20', iconColor: 'text-indigo-600' },
  { id: 'company_settings', label: 'الإعدادات', icon: Settings, color: 'from-slate-500/20 to-slate-600/20', iconColor: 'text-slate-600' },
];

interface WidgetRendererProps {
  widget: Widget;
  stats: DashboardStats | null;
  onToggleGroupCollapse?: (widgetId: string, groupId: string) => void;
  isEditing?: boolean;
  onCardClick?: (widgetId: string, item: any) => void;
  onAddCardClick?: (widgetId: string) => void;
  onReorderCards?: (widgetId: string, dragId: string, dropId: string) => void;
}

const WidgetRenderer: React.FC<WidgetRendererProps> = ({ 
  widget, 
  stats, 
  onToggleGroupCollapse,
  isEditing = false,
  onCardClick,
  onAddCardClick,
  onReorderCards
}) => {
  const { t, dir, language } = useLanguage();
  const { setCurrentPage } = useNavigation();
  
  if (widget.settings?.dataSource) {
    return <DynamicWidgetRenderer widget={widget} />;
  }

  if (!stats) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400 text-xs">
        {t('common.loading') || 'Loading...'}
      </div>
    );
  }

  const { widget_type, settings } = widget;

  switch (widget_type) {
    case 'shortcuts': {
      const qaSettings = widget.settings?.quickAccess || {
        useCustom: true,
        items: [
          { id: 'customers', label: language === 'ar' ? 'العملاء' : 'Customers', icon: 'Users', color: 'from-blue-500/20 to-blue-600/20', iconColor: 'text-blue-600', size: 'medium', pinned: false },
          { id: 'suppliers', label: language === 'ar' ? 'الموردين' : 'Suppliers', icon: 'Truck', color: 'from-emerald-500/20 to-emerald-600/20', iconColor: 'text-emerald-600', size: 'medium', pinned: false },
          { id: 'products', label: language === 'ar' ? 'الأصناف' : 'Products', icon: 'Package', color: 'from-amber-500/20 to-amber-600/20', iconColor: 'text-amber-600', size: 'medium', pinned: false },
          { id: 'accounts', label: language === 'ar' ? 'الحسابات' : 'Accounts', icon: 'Wallet', color: 'from-purple-500/20 to-purple-600/20', iconColor: 'text-purple-600', size: 'medium', pinned: false },
          { id: 'payment_methods', label: language === 'ar' ? 'وسائل الدفع' : 'Payment Methods', icon: 'CreditCard', color: 'from-indigo-500/20 to-indigo-600/20', iconColor: 'text-indigo-600', size: 'medium', pinned: false },
          { id: 'company_settings', label: language === 'ar' ? 'الإعدادات' : 'Settings', icon: 'Settings', color: 'from-slate-500/20 to-slate-600/20', iconColor: 'text-slate-600', size: 'medium', pinned: false }
        ],
        groups: []
      };

      const items: any[] = qaSettings.items || [];
      const groups: any[] = qaSettings.groups || [];
      
      const getGroupItems = (groupId?: string) => {
        const filtered = items.filter(item => item.groupId === groupId);
        return filtered.sort((a, b) => {
          if (a.pinned && !b.pinned) return -1;
          if (!a.pinned && b.pinned) return 1;
          return 0;
        });
      };

      const handleCardDragStart = (e: React.DragEvent, cardId: string) => {
        if (!isEditing) return;
        e.stopPropagation();
        e.dataTransfer.setData('cardId', cardId);
        e.dataTransfer.setData('widgetId', widget.id);
      };

      const handleCardDrop = (e: React.DragEvent, targetCardId: string) => {
        if (!isEditing) return;
        e.preventDefault();
        e.stopPropagation();
        const dragCardId = e.dataTransfer.getData('cardId');
        const dragWidgetId = e.dataTransfer.getData('widgetId');
        if (dragWidgetId === widget.id && dragCardId !== targetCardId) {
          onReorderCards?.(widget.id, dragCardId, targetCardId);
        }
      };

      const renderShortcutItem = (item: any) => {
        let sizeClasses = "relative flex items-center bg-slate-50/50 hover:bg-white border border-slate-100 rounded-xl hover:shadow-md hover:border-indigo-500/30 transition-all overflow-hidden cursor-pointer";
        let iconWrapper = "rounded-lg bg-white flex items-center justify-center shadow-sm border border-slate-100 shrink-0";
        let textClass = "font-bold text-slate-600 group-hover:text-slate-900 transition-colors uppercase tracking-tight";
        
        if (item.size === 'small') {
          sizeClasses += " p-2 flex-row gap-2 h-10 w-full";
          iconWrapper += " w-6 h-6";
          textClass += " text-[8px] truncate";
        } else if (item.size === 'large') {
          sizeClasses += " p-4 flex-col justify-between items-start h-28 w-full";
          iconWrapper += " w-10 h-10 mb-2";
          textClass += " text-[10px] line-clamp-2 text-left";
        } else { // medium
          sizeClasses += " p-3 flex-col justify-center items-center h-20 w-full text-center";
          iconWrapper += " w-8 h-8 mb-1";
          textClass += " text-[9px] line-clamp-2";
        }

        return (
          <button
            key={item.id}
            onClick={(e) => {
              if (isEditing) {
                e.stopPropagation();
                onCardClick?.(widget.id, item);
              } else {
                setCurrentPage(item.id);
              }
            }}
            draggable={isEditing}
            onDragStart={(e) => handleCardDragStart(e, item.id)}
            onDragOver={(e) => { if (isEditing) e.preventDefault(); }}
            onDrop={(e) => handleCardDrop(e, item.id)}
            className={`group ${sizeClasses}`}
            type="button"
          >
            <div className={`absolute top-0 right-0 w-16 h-16 bg-gradient-to-br ${item.color || 'from-slate-500/20 to-slate-600/20'} rounded-full -mr-8 -mt-8 opacity-40 group-hover:scale-150 transition-transform duration-500`} />
            
            <div className={iconWrapper}>
              {renderLucideIcon(item.icon || 'HelpCircle', item.size === 'small' ? 12 : item.size === 'large' ? 20 : 16, item.iconColor || 'text-slate-600')}
            </div>
            
            <span className={textClass}>
              {item.label}
            </span>
            
            {item.pinned && (
              <span className="absolute top-1 left-1 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
              </span>
            )}

            {isEditing && (
              <div className="absolute top-1 right-1 opacity-40 group-hover:opacity-100 transition-opacity">
                <Lucide.Settings size={10} className="text-indigo-600" />
              </div>
            )}
          </button>
        );
      };

      const ungroupedItems = getGroupItems(undefined);

      return (
        <div className="w-full h-full overflow-y-auto custom-scrollbar flex flex-col gap-4 pr-1">
          {items.some(i => i.pinned) && (
            <div className="border border-indigo-100 bg-indigo-50/10 p-3 rounded-2xl">
              <div className="flex items-center gap-1.5 mb-2">
                {renderLucideIcon('Pin', 12, 'text-indigo-600')}
                <span className="text-[10px] font-black uppercase text-indigo-700 tracking-wider">
                  {language === 'ar' ? 'البطاقات المثبتة' : 'Pinned shortcuts'}
                </span>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                {items.filter(i => i.pinned).map(renderShortcutItem)}
              </div>
            </div>
          )}

          {(ungroupedItems.length > 0 || isEditing) && (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
              {ungroupedItems.map(renderShortcutItem)}
              {isEditing && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddCardClick?.(widget.id);
                  }}
                  className="group relative flex flex-col justify-center items-center p-3 h-20 w-full text-center border-2 border-dashed border-slate-200 hover:border-indigo-500 rounded-xl bg-slate-50/20 hover:bg-white text-slate-400 hover:text-indigo-600 transition-all cursor-pointer"
                  type="button"
                >
                  <Lucide.Plus size={16} className="mb-1 transition-transform group-hover:scale-110" />
                  <span className="text-[9px] font-bold uppercase tracking-tight">{language === 'ar' ? 'إضافة بطاقة' : 'Add Card'}</span>
                </button>
              )}
            </div>
          )}

          {groups.map(group => {
            const groupItems = getGroupItems(group.id);
            return (
              <div key={group.id} className="border border-slate-100 bg-slate-50/20 p-3 rounded-2xl flex flex-col gap-2">
                <button 
                  onClick={() => {
                    onToggleGroupCollapse?.(widget.id, group.id);
                  }}
                  className="flex items-center justify-between w-full hover:bg-slate-50 p-1.5 rounded-lg text-slate-700 transition-colors"
                  type="button"
                >
                  <span className="text-[10px] font-extrabold uppercase tracking-wider">{group.name}</span>
                  {group.collapsed ? renderLucideIcon('ChevronDown', 14) : renderLucideIcon('ChevronUp', 14)}
                </button>
                
                {!group.collapsed && (
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3 pt-1">
                    {groupItems.length > 0 ? (
                      groupItems.map(renderShortcutItem)
                    ) : (
                      <div className="col-span-full text-center py-2 text-[9px] text-slate-400">
                        {language === 'ar' ? 'لا توجد عناصر في هذه المجموعة' : 'No items in this group'}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      );
    }

    case 'card_cash':
      return (
        <div className="flex flex-col justify-between h-full relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 scale-150 group-hover:scale-[1.7] transition-transform duration-1000 rotate-12 pointer-events-none">
            <Wallet size={80} />
          </div>
          <div className="relative z-10">
            <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center mb-2">
              <Wallet className="text-white" size={16} />
            </div>
            <p className="text-white/60 text-[9px] font-bold uppercase tracking-wider mb-1">رصيد النقدية</p>
            <h3 className="text-xl md:text-2xl font-bold tracking-tight">
              {formatMoney(stats?.totalCashBalance || 0)} 
            </h3>
          </div>
          <div className="flex items-center gap-1.5 text-white text-[8px] font-bold uppercase tracking-wider relative z-10 bg-white/10 self-start px-2.5 py-1 rounded-full border border-white/20">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
            سيولة نقدية
          </div>
        </div>
      );

    case 'card_customers':
      return (
        <div className="flex flex-col justify-between h-full relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 scale-150 group-hover:scale-[1.7] transition-transform duration-1000 rotate-12 pointer-events-none">
            <UsersIcon size={80} />
          </div>
          <div className="relative z-10">
            <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center mb-2">
              <TrendingUp className="text-emerald-400" size={16} />
            </div>
            <p className="text-white/40 text-[9px] font-bold uppercase tracking-wider mb-1">{t('dashboard.customer_balances')}</p>
            <h3 className="text-xl md:text-2xl font-bold tracking-tight">
              {formatMoney(stats?.totalCustomerBalances || 0)} 
            </h3>
          </div>
          <div className="flex items-center gap-1.5 text-emerald-400 text-[8px] font-bold uppercase tracking-wider relative z-10 bg-emerald-400/10 self-start px-2.5 py-1 rounded-full border border-emerald-400/20">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            {t('dashboard.active_receivables')}
          </div>
        </div>
      );

    case 'card_suppliers':
      return (
        <div className="flex flex-col justify-between h-full relative overflow-hidden group text-slate-900">
          <div className="absolute top-0 right-0 p-4 opacity-[0.02] scale-150 group-hover:scale-[1.7] transition-transform duration-1000 -rotate-12 pointer-events-none">
            <ReceiptIcon size={80} />
          </div>
          <div className="relative z-10">
            <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center mb-2 border border-slate-100">
              <ReceiptIcon className="text-slate-400" size={16} />
            </div>
            <p className="text-slate-400 text-[9px] font-bold uppercase tracking-wider mb-1">{t('dashboard.supplier_balances')}</p>
            <h3 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900">
              {formatMoney(stats?.totalSupplierBalances || 0)} 
            </h3>
          </div>
          <div className="flex items-center gap-1.5 text-emerald-500 text-[8px] font-bold uppercase tracking-wider relative z-10 bg-emerald-50 self-start px-2.5 py-1 rounded-full border border-emerald-100">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            {t('dashboard.outstanding_debts')}
          </div>
        </div>
      );

    case 'chart_sales':
      return (
        <div className="w-full h-full flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="text-sm font-bold text-slate-900 tracking-tight">{t('dashboard.sales_performance')}</h4>
              <p className="text-[8px] text-slate-400 font-bold uppercase tracking-wider">Monthly Net Revenue</p>
            </div>
          </div>
          <div className="flex-1 min-h-0 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats?.salesByMonth} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                <defs>
                  <linearGradient id="premiumGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="6 6" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="month" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fill: '#94a3b8', fontSize: 8, fontWeight: 600}} 
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fill: '#94a3b8', fontSize: 8, fontWeight: 600}} 
                />
                <Tooltip 
                  contentStyle={{
                    borderRadius: '8px', 
                    border: '1px solid #e2e8f0', 
                    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
                    backgroundColor: '#fff',
                    fontSize: '10px'
                  }}
                  itemStyle={{ color: '#10b981', fontWeight: 600 }}
                />
                <Area 
                  type="monotone" 
                  dataKey="total" 
                  stroke="#10b981" 
                  strokeWidth={2} 
                  fillOpacity={1} 
                  fill="url(#premiumGradient)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      );

    case 'list_transactions':
      return (
        <div className="w-full h-full flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="text-sm font-bold text-slate-900 tracking-tight">{t('dashboard.recent_transactions')}</h4>
              <p className="text-[8px] text-slate-400 font-bold uppercase tracking-wider">Live Feed</p>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-1">
            {stats?.recentTransactions.map((tx) => (
              <div 
                key={`${tx.type}-${tx.id}`} 
                className={`flex items-center justify-between p-2.5 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-all ${dir === 'rtl' ? 'text-right' : 'text-left'}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center bg-slate-50 border border-slate-100 text-slate-500`}>
                    {tx.type === 'invoice' || tx.type === 'receipt' ? <TrendingUp size={14} /> : 
                     tx.type === 'return' || tx.type === 'payment' ? <TrendingUp size={14} className="rotate-180" /> :
                     <FileText size={14} />}
                  </div>
                  <div>
                    <p className="font-bold text-slate-900 text-xs tracking-tight truncate max-w-[100px]">{tx.customer_name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[8px] font-bold uppercase tracking-wider text-slate-400">#{tx.number}</span>
                    </div>
                  </div>
                </div>
                <div className={`text-right ${dir === 'rtl' ? 'text-left' : 'text-right'}`}>
                  <p className="font-bold text-xs text-slate-900">
                    {tx.type === 'invoice' || tx.type === 'receipt' ? '' : '-'}{formatMoney(tx.total_amount || 0)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      );

    case 'kpi_card': {
      const source = settings?.dataSource || 'net_profit';
      let val = 0;
      let isMoney = true;
      let title = '';

      switch (source) {
        case 'net_profit':
          val = stats.netProfit;
          title = language === 'ar' ? 'صافي الأرباح' : 'Net Profit';
          break;
        case 'total_invoices':
          val = stats.totalInvoices;
          isMoney = false;
          title = language === 'ar' ? 'إجمالي الفواتير' : 'Total Invoices';
          break;
        case 'total_receipts':
          val = stats.totalReceipts;
          title = language === 'ar' ? 'سندات القبض' : 'Receipt Vouchers';
          break;
        case 'total_expenses':
          val = stats.totalExpenses;
          title = language === 'ar' ? 'المصروفات' : 'Total Expenses';
          break;
        case 'total_customer_balances':
          val = stats.totalCustomerBalances;
          title = language === 'ar' ? 'أرصدة العملاء' : 'Customer Balances';
          break;
        case 'total_supplier_balances':
          val = stats.totalSupplierBalances;
          title = language === 'ar' ? 'أرصدة الموردين' : 'Supplier Balances';
          break;
        case 'total_cash_balance':
          val = stats.totalCashBalance;
          title = language === 'ar' ? 'رصيد النقدية' : 'Cash Balance';
          break;
      }

      const formattedVal = isMoney ? formatMoney(val) : formatNumber(val);

      return (
        <div className="flex flex-col justify-center h-full py-2">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{title}</p>
          <p className="text-2xl font-extrabold text-slate-900 mt-1 truncate">{formattedVal}</p>
          {settings?.description && (
            <p className="text-[9px] text-slate-400 mt-1 truncate">{settings.description}</p>
          )}
        </div>
      );
    }

    case 'line_chart':
      return (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={stats.salesByMonth} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="month" tick={{ fontSize: 9, fill: '#94a3b8' }} />
            <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} />
            <Tooltip contentStyle={{ fontSize: 10 }} />
            <Line type="monotone" dataKey="total" stroke="#3b82f6" strokeWidth={2} dot={{ r: 2 }} />
          </LineChart>
        </ResponsiveContainer>
      );

    case 'bar_chart':
      return (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={stats.salesByMonth} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="month" tick={{ fontSize: 9, fill: '#94a3b8' }} />
            <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} />
            <Tooltip contentStyle={{ fontSize: 10 }} />
            <Bar dataKey="total" fill="#10b981" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      );

    case 'pie_chart': {
      const pieData = [
        { name: language === 'ar' ? 'السيولة' : 'Cash', value: Math.max(0, stats.totalCashBalance), color: '#10b981' },
        { name: language === 'ar' ? 'العملاء' : 'Receivables', value: Math.max(0, stats.totalCustomerBalances), color: '#3b82f6' },
        { name: language === 'ar' ? 'الموردين' : 'Payables', value: Math.max(0, stats.totalSupplierBalances), color: '#ef4444' }
      ];
      return (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={pieData} cx="50%" cy="50%" innerRadius={25} outerRadius={40} paddingAngle={3} dataKey="value">
              {pieData.map((entry, idx) => (
                <Cell key={`cell-${idx}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip contentStyle={{ fontSize: 10 }} />
            <Legend layout="horizontal" verticalAlign="bottom" align="center" iconSize={8} wrapperStyle={{ fontSize: 8 }} />
          </PieChart>
        </ResponsiveContainer>
      );
    }

    case 'area_chart':
      return (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={stats.salesByMonth} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
            <defs>
              <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="month" tick={{ fontSize: 9, fill: '#94a3b8' }} />
            <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} />
            <Tooltip contentStyle={{ fontSize: 10 }} />
            <Area type="monotone" dataKey="total" stroke="#10b981" strokeWidth={2} fill="url(#areaGradient)" />
          </AreaChart>
        </ResponsiveContainer>
      );

    case 'table':
      return (
        <div className="w-full h-full overflow-auto text-[10px]">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 font-bold">
                <th className="text-left pb-1.5">{language === 'ar' ? 'المستند' : 'Doc'}</th>
                <th className="text-left pb-1.5">{language === 'ar' ? 'الاسم' : 'Name'}</th>
                <th className="text-right pb-1.5">{language === 'ar' ? 'المبلغ' : 'Amount'}</th>
              </tr>
            </thead>
            <tbody>
              {stats.recentTransactions.slice(0, 4).map((tx: any) => (
                <tr key={`${tx.type}-${tx.id}`} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                  <td className="py-1.5 font-bold text-slate-700">#{tx.number}</td>
                  <td className="py-1.5 text-slate-500 truncate max-w-[85px]">{tx.customer_name}</td>
                  <td className="py-1.5 text-right font-semibold text-slate-900">{formatMoney(tx.total_amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    case 'calendar': {
      const now = new Date();
      const currentDay = now.getDate();
      const currentMonth = now.toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US', { month: 'long' });
      return (
        <div className="flex flex-col items-center justify-center h-full text-center py-1">
          <div className="w-12 h-12 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-xl flex flex-col items-center justify-center shadow-sm">
            <span className="text-[10px] font-bold uppercase leading-none text-indigo-500">{currentMonth.slice(0, 3)}</span>
            <span className="text-lg font-black leading-none mt-0.5">{currentDay}</span>
          </div>
          <p className="text-[10px] font-bold text-slate-700 mt-2">
            {now.toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', { weekday: 'long' })}
          </p>
        </div>
      );
    }

    case 'recent_activities':
      return (
        <div className="w-full h-full overflow-y-auto space-y-2 text-[10px] pr-1">
          {stats.recentTransactions.slice(0, 4).map((tx: any) => (
            <div key={`${tx.type}-${tx.id}`} className="flex items-center justify-between border-b border-slate-50 pb-1.5 last:border-0 last:pb-0">
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                <div>
                  <p className="font-bold text-slate-800">{tx.customer_name}</p>
                  <p className="text-[8px] text-slate-400">#{tx.number}</p>
                </div>
              </div>
              <span className="text-[9px] font-bold text-indigo-600">{formatMoney(tx.total_amount)}</span>
            </div>
          ))}
        </div>
      );

    case 'notifications':
      return (
        <div className="w-full h-full flex flex-col justify-center gap-2 text-[10px]">
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 p-2 rounded-lg text-amber-800">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1 shrink-0" />
            <p className="font-medium leading-normal">{language === 'ar' ? 'تحقق من الأرصدة المستحقة للعملاء' : 'Review outstanding customer debts'}</p>
          </div>
          <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 p-2 rounded-lg text-blue-800">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1 shrink-0" />
            <p className="font-medium leading-normal">{language === 'ar' ? 'التقارير المالية الشهرية جاهزة' : 'Monthly financial summaries are ready'}</p>
          </div>
        </div>
      );

    case 'sales_summary':
      return (
        <div className="flex flex-col justify-between h-full py-1">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[9px] font-bold text-slate-400">{language === 'ar' ? 'صافي المبيعات' : 'Net Sales'}</p>
              <h4 className="text-base font-extrabold text-slate-900">{formatMoney(stats.netSales)}</h4>
            </div>
            <div className="text-right">
              <p className="text-[9px] font-bold text-slate-400">{language === 'ar' ? 'الفواتير' : 'Invoices'}</p>
              <h4 className="text-base font-extrabold text-slate-900">{stats.totalInvoices}</h4>
            </div>
          </div>
          <div className="h-10 mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.salesByMonth.slice(-4)}>
                <Area type="monotone" dataKey="total" stroke="#3b82f6" fill="#eff6ff" strokeWidth={1.5} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      );

    case 'inventory_summary':
      return (
        <div className="flex flex-col justify-center h-full py-1 gap-2">
          <div className="flex items-center justify-between border-b border-slate-50 pb-1">
            <span className="text-[10px] text-slate-500">{language === 'ar' ? 'حالة المخزون' : 'Stock Status'}</span>
            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">{language === 'ar' ? 'مستقر' : 'Stable'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-500">{language === 'ar' ? 'أصناف منخفضة' : 'Low Stock Items'}</span>
            <span className="text-sm font-bold text-slate-900">0</span>
          </div>
        </div>
      );

    case 'cash_flow':
      return (
        <div className="flex flex-col justify-between h-full py-1">
          <div className="flex items-center justify-between border-b border-slate-50 pb-1">
            <span className="text-[10px] text-slate-500">{language === 'ar' ? 'تدفقات نقدية داخلة' : 'Cash Inflow'}</span>
            <span className="text-[10px] font-bold text-emerald-600">{formatMoney(stats.totalReceipts)}</span>
          </div>
          <div className="flex items-center justify-between pt-1">
            <span className="text-[10px] text-slate-500">{language === 'ar' ? 'مصروفات نقدية' : 'Cash Outflow'}</span>
            <span className="text-[10px] font-bold text-rose-600">{formatMoney(stats.totalExpenses)}</span>
          </div>
        </div>
      );

    case 'profit': {
      const margin = stats.netSales > 0 ? ((stats.netProfit / stats.netSales) * 100).toFixed(1) : '0.0';
      return (
        <div className="flex flex-col justify-center h-full py-1 text-center">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{language === 'ar' ? 'هامش الربح' : 'Profit Margin'}</p>
          <p className="text-2xl font-black text-emerald-600 mt-0.5">{margin}%</p>
          <p className="text-[8px] text-slate-400 mt-1">{language === 'ar' ? 'صافي الربح مقارنة بالمبيعات' : 'Net profit relative to revenues'}</p>
        </div>
      );
    }

    case 'customers':
      return (
        <div className="flex flex-col justify-center h-full py-1">
          <p className="text-[9px] font-bold text-slate-400 uppercase">{language === 'ar' ? 'مديونية العملاء' : 'Customer Receivables'}</p>
          <p className="text-base font-extrabold text-slate-900 mt-1">{formatMoney(stats.totalCustomerBalances)}</p>
          <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
            <div className="bg-blue-500 h-full rounded-full" style={{ width: '60%' }} />
          </div>
        </div>
      );

    case 'suppliers':
      return (
        <div className="flex flex-col justify-center h-full py-1">
          <p className="text-[9px] font-bold text-slate-400 uppercase">{language === 'ar' ? 'مستحقات الموردين' : 'Supplier Payables'}</p>
          <p className="text-base font-extrabold text-slate-900 mt-1">{formatMoney(stats.totalSupplierBalances)}</p>
          <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
            <div className="bg-red-500 h-full rounded-full" style={{ width: '40%' }} />
          </div>
        </div>
      );

    case 'text':
      return (
        <div className="flex flex-col justify-center h-full py-1 text-slate-700">
          <p className="text-xs font-semibold whitespace-pre-wrap leading-normal">
            {settings?.text || settings?.description || widget.title || 'Text Widget'}
          </p>
        </div>
      );

    default:
      return (
        <div className="flex items-center justify-center h-full text-slate-400 text-[10px]">
          {widget_type}
        </div>
      );
  }
};

const getWidgetIcon = (type: string) => {
  switch (type) {
    case 'kpi_card': return TrendingUp;
    case 'line_chart': return LineChartIcon;
    case 'bar_chart': return BarChart2;
    case 'pie_chart': return PieIcon;
    case 'table': return TableIcon;
    case 'calendar': return CalendarIcon;
    case 'recent_activities': return List;
    case 'notifications': return Bell;
    case 'sales_summary': return TrendingUp;
    case 'inventory_summary': return Sparkles;
    case 'cash_flow': return Wallet;
    case 'profit': return TrendingUp;
    case 'customers': return UsersIcon;
    case 'suppliers': return Truck;
    case 'shortcuts': return Layout;
    case 'card_cash': return Wallet;
    case 'card_customers': return UsersIcon;
    case 'card_suppliers': return Truck;
    case 'chart_sales': return TrendingUp;
    case 'list_transactions': return List;
    default: return Layout;
  }
};

const renderLucideIcon = (name: string, size = 16, className = '') => {
  let cleanName = name;
  if (name === 'UsersIcon') cleanName = 'Users';
  if (name === 'CalendarIcon') cleanName = 'Calendar';
  if (name === 'TableIcon') cleanName = 'Table';
  if (name === 'LineChartIcon') cleanName = 'LineChart';
  if (name === 'PieIcon') cleanName = 'PieChart';
  if (name === 'ReceiptIcon') cleanName = 'Receipt';
  if (name === 'TabletIcon') cleanName = 'Tablet';
  if (name === 'LaptopIcon') cleanName = 'Laptop';
  if (name === 'XIcon') cleanName = 'X';

  const IconComp = (Lucide as any)[cleanName] || (Lucide as any)[name] || Lucide.HelpCircle;
  return React.createElement(IconComp, { size, className });
};

const COLOR_PRESETS = [
  { name: 'Blue', bg: 'from-blue-500/20 to-blue-600/20', text: 'text-blue-600' },
  { name: 'Emerald', bg: 'from-emerald-500/20 to-emerald-600/20', text: 'text-emerald-600' },
  { name: 'Amber', bg: 'from-amber-500/20 to-amber-600/20', text: 'text-amber-600' },
  { name: 'Purple', bg: 'from-purple-500/20 to-purple-600/20', text: 'text-purple-600' },
  { name: 'Indigo', bg: 'from-indigo-500/20 to-indigo-600/20', text: 'text-indigo-600' },
  { name: 'Rose', bg: 'from-rose-500/20 to-rose-600/20', text: 'text-rose-600' },
  { name: 'Slate', bg: 'from-slate-500/20 to-slate-600/20', text: 'text-slate-600' },
];

const ICON_OPTIONS = [
  'Users', 'Truck', 'Package', 'Wallet', 'CreditCard', 'Settings', 'FileText', 'Percent',
  'PlusCircle', 'Scale', 'TrendingUp', 'Home', 'Folder', 'List', 'Bell', 'Clock',
  'Printer', 'BookOpen', 'Activity', 'Globe', 'Target', 'Layers', 'GitFork', 'ChevronDown',
  'ChevronUp', 'Pin', 'Heart', 'HelpCircle'
];

interface ERPPageItem {
  id: string;
  nameEn: string;
  nameAr: string;
  category: string;
  defaultIcon: string;
  defaultColor: string;
}

const getErpPagesDirectory = (t: (key: string) => string): ERPPageItem[] => {
  return Object.keys(pageLabels).map(key => {
    const nameAr = pageLabels[key];
    const navKey = `nav.${key}`;
    const nameEnTranslated = t(navKey);
    const nameEn = (nameEnTranslated && nameEnTranslated !== navKey) 
      ? nameEnTranslated 
      : key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    
    let category = 'system';
    if (['accounts', 'chart_of_accounts', 'account_types', 'journal_entries', 'create_journal_entry', 'general_ledger_report', 'trial_balance', 'income_statement', 'balance_sheet'].includes(key)) {
      category = 'accounting';
    } else if (['customers', 'invoices', 'sales_orders', 'returns', 'customer_discounts', 'customer_settlements', 'customer_statement', 'customer_balances', 'sales_report'].includes(key)) {
      category = 'sales';
    } else if (['suppliers', 'purchase_invoices', 'purchase_orders', 'purchase_returns', 'supplier_discounts', 'supplier_settlements', 'supplier_statement', 'supplier_balances'].includes(key)) {
      category = 'purchases';
    } else if (['products', 'warehouses', 'item_groups', 'warehouse_transfers', 'opening_stock_balances', 'stock_adjustments', 'stock_card_report', 'stock_balances_report', 'general_stock_movements_report'].includes(key)) {
      category = 'inventory';
    }

    let defaultIcon = 'HelpCircle';
    if (key.includes('invoice') || key === 'invoices') defaultIcon = 'FileText';
    else if (key.includes('order')) defaultIcon = 'FileSpreadsheet';
    else if (key.includes('return')) defaultIcon = 'RotateCcw';
    else if (key.includes('report') || key.includes('balance') || key === 'income_statement' || key === 'balance_sheet') defaultIcon = 'BarChart2';
    else if (key === 'customers') defaultIcon = 'Users';
    else if (key === 'suppliers') defaultIcon = 'Truck';
    else if (key === 'products') defaultIcon = 'Package';
    else if (key === 'warehouses') defaultIcon = 'Home';
    else if (key === 'employees') defaultIcon = 'User';
    else if (key === 'expenses') defaultIcon = 'Zap';
    else if (key === 'payment_methods') defaultIcon = 'CreditCard';
    else if (key === 'accounts' || key === 'chart_of_accounts') defaultIcon = 'Wallet';
    else if (key === 'settings' || key === 'company_settings') defaultIcon = 'Settings';
    else if (key === 'templates') defaultIcon = 'Printer';
    else if (key === 'users') defaultIcon = 'Users';

    let defaultColor = 'from-slate-500/20 to-slate-600/20';
    if (category === 'accounting') defaultColor = 'from-purple-500/20 to-purple-600/20';
    else if (category === 'sales') defaultColor = 'from-blue-500/20 to-blue-600/20';
    else if (category === 'purchases') defaultColor = 'from-emerald-500/20 to-emerald-600/20';
    else if (category === 'inventory') defaultColor = 'from-amber-500/20 to-amber-600/20';

    return {
      id: key,
      nameEn,
      nameAr,
      category,
      defaultIcon,
      defaultColor
    };
  });
};

interface DashboardProps {
  initialEditMode?: boolean;
}

export const Dashboard: React.FC<DashboardProps> = ({ initialEditMode = false }) => {
  const { user, isSuperAdmin, isCompanyAdmin } = useAuth();
  const { activeTabId, setCurrentPage } = useNavigation();
  const { t, dir, language } = useLanguage();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [isAiSearching, setIsAiSearching] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Custom Dashboard States
  const [customDashboard, setCustomDashboard] = useState<any>(null);
  const [customWidgets, setCustomWidgets] = useState<Widget[]>([]);
  const [activeDashboardPage, setActiveDashboardPage] = useState<number>(0);
  const [pages, setPages] = useState<string[]>(['Main Page']);
  const [deviceSize, setDeviceSize] = useState<'desktop' | 'laptop' | 'tablet' | 'mobile'>('desktop');

  // Customization Edit Mode States
  const [isEditing, setIsEditing] = useState(false);
  const [tempWidgets, setTempWidgets] = useState<Widget[]>([]);
  const [selectedWidgetId, setSelectedWidgetId] = useState<string | null>(null);
  const [dashboardsList, setDashboardsList] = useState<any[]>([]);
  const [currentDashboard, setCurrentDashboard] = useState<any>(null); // null = Default static layout
  const [dashboardName, setDashboardName] = useState('');
  const [dashboardDescription, setDashboardDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showWidgetLibrary, setShowWidgetLibrary] = useState(false);

  // Sharing states
  const [isTemplateShared, setIsTemplateShared] = useState(false);
  const [sharedRoles, setSharedRoles] = useState<string[]>([]);
  const [sharedUsers, setSharedUsers] = useState<string[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [dataSources, setDataSources] = useState<{ [tableName: string]: string[] }>({});

  // Drag, Resize & Snap State
  const canvasRef = useRef<HTMLDivElement>(null);
  const [draggedWidget, setDraggedWidget] = useState<Widget | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [resizingWidget, setResizingWidget] = useState<Widget | null>(null);

  // Edit History
  const [editHistory, setEditHistory] = useState<Widget[][]>([]);
  const [editHistoryIndex, setEditHistoryIndex] = useState<number>(-1);

  // Widget Catalog Search
  const [widgetSearchQuery, setWidgetSearchQuery] = useState('');
  const [widgetCategory, setWidgetCategory] = useState('all');

  // Quick Access Customization States
  const [qaSearchQuery, setQaSearchQuery] = useState('');
  const [newGroupName, setNewGroupName] = useState('');
  const [replacingCardId, setReplacingCardId] = useState<string | null>(null);
  const [replacingSearchQuery, setReplacingSearchQuery] = useState('');

  // Card customization modal popup states
  const [editingCard, setEditingCard] = useState<{ widgetId: string; card: any } | null>(null);
  const [replacingPopupSearchQuery, setReplacingPopupSearchQuery] = useState('');
  const [showReplacePopupList, setShowReplacePopupList] = useState(false);

  const handleCardClick = (widgetId: string, item: any) => {
    setEditingCard({ widgetId, card: { ...item } });
    setReplacingPopupSearchQuery('');
    setShowReplacePopupList(false);
  };

  const handleAddCardClickOnCanvas = (widgetId: string) => {
    setEditingCard({
      widgetId,
      card: {
        id: '',
        label: '',
        icon: 'HelpCircle',
        color: 'from-slate-500/20 to-slate-600/20',
        iconColor: 'text-slate-600',
        size: 'medium',
        pinned: false,
        isNew: true
      }
    });
    setReplacingPopupSearchQuery('');
    setShowReplacePopupList(true);
  };

  const handleReorderCardsOnCanvas = (widgetId: string, dragId: string, dropId: string) => {
    setTempWidgets(prev => {
      const next = prev.map(w => {
        if (w.id === widgetId) {
          const qa = w.settings?.quickAccess || { items: [], groups: [], useCustom: true };
          const items = [...(qa.items || [])];
          
          const dragIdx = items.findIndex((i: any) => i.id === dragId);
          const dropIdx = items.findIndex((i: any) => i.id === dropId);
          
          if (dragIdx !== -1 && dropIdx !== -1) {
            const [draggedItem] = items.splice(dragIdx, 1);
            items.splice(dropIdx, 0, draggedItem);
          }
          
          return { ...w, settings: { ...w.settings, quickAccess: { ...qa, items } } };
        }
        return w;
      });
      pushEditHistory(next);
      return next;
    });
  };

  const updateQuickAccessSettingsFromModal = (widgetId: string, updater: (qa: any) => any) => {
    setTempWidgets(prev => {
      const next = prev.map(w => {
        if (w.id === widgetId) {
          const qa = w.settings?.quickAccess || { items: [], groups: [], useCustom: true };
          const updatedQa = { ...qa, ...updater(qa), useCustom: true };
          return { ...w, settings: { ...w.settings, quickAccess: updatedQa } };
        }
        return w;
      });
      pushEditHistory(next);
      return next;
    });
  };

  const handleToggleGroupCollapse = async (widgetId: string, groupId: string) => {
    if (isEditing) {
      const updated = tempWidgets.map(w => {
        if (w.id === widgetId) {
          const quickAccess = w.settings?.quickAccess || {};
          const groups = (quickAccess.groups || []).map((g: any) => 
            g.id === groupId ? { ...g, collapsed: !g.collapsed } : g
          );
          return { ...w, settings: { ...w.settings, quickAccess: { ...quickAccess, groups } } };
        }
        return w;
      });
      setTempWidgets(updated);
      pushEditHistory(updated);
    } else {
      const updated = customWidgets.map(w => {
        if (w.id === widgetId) {
          const quickAccess = w.settings?.quickAccess || {};
          const groups = (quickAccess.groups || []).map((g: any) => 
            g.id === groupId ? { ...g, collapsed: !g.collapsed } : g
          );
          return { ...w, settings: { ...w.settings, quickAccess: { ...quickAccess, groups } } };
        }
        return w;
      });
      setCustomWidgets(updated);
      setCustomDashboard(prev => prev ? { ...prev, widgets: updated } : null);
      
      const targetWidget = updated.find(w => w.id === widgetId);
      if (targetWidget) {
        await dbService.update('widgets', widgetId, { settings: targetWidget.settings });
      }
    }
  };

  const updateQuickAccessSettings = (updater: (qa: any) => any, shouldPushHistory = false) => {
    setTempWidgets(prev => {
      const next = prev.map(w => {
        if (w.id === selectedWidgetId) {
          const qa = w.settings?.quickAccess || { items: [], groups: [], useCustom: true };
          const updatedQa = { ...qa, ...updater(qa), useCustom: true };
          return { ...w, settings: { ...w.settings, quickAccess: updatedQa } };
        }
        return w;
      });
      if (shouldPushHistory) {
        pushEditHistory(next);
      }
      return next;
    });
  };

  const handleAddQuickAccessItem = (page: ERPPageItem) => {
    updateQuickAccessSettings(qa => {
      const currentItems = qa.items || [];
      if (currentItems.some((i: any) => i.id === page.id)) {
        return qa;
      }
      
      const newItem = {
        id: page.id,
        label: language === 'ar' ? page.nameAr : page.nameEn,
        icon: page.defaultIcon,
        color: page.defaultColor,
        iconColor: page.defaultColor.split(' ')[0].replace('from-', 'text-').split('/')[0],
        size: 'medium',
        pinned: false
      };
      
      return { ...qa, items: [...currentItems, newItem] };
    }, true);
    setQaSearchQuery('');
  };

  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth;
      if (w < 640) setDeviceSize('mobile');
      else if (w < 1024) setDeviceSize('tablet');
      else if (w < 1280) setDeviceSize('laptop');
      else setDeviceSize('desktop');
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const getGridConfig = () => {
    switch (deviceSize) {
      case 'mobile': return { cols: 2, rowHeight: 80 };
      case 'tablet': return { cols: 6, rowHeight: 80 };
      case 'laptop': return { cols: 10, rowHeight: 85 };
      default: return { cols: 12, rowHeight: 90 };
    }
  };
  const gridConfig = getGridConfig();

  const getNextAvailableRow = () => {
    const sourceWidgets = isEditing ? tempWidgets : customWidgets;
    let maxY = 0;
    sourceWidgets.forEach(w => {
      if (w.visible && (w.settings?.page || 0) === activeDashboardPage) {
        const bottom = w.y + w.h;
        if (bottom > maxY) maxY = bottom;
      }
    });
    return maxY;
  };

  const getInitialDefaultWidgets = (customDashId?: string): Widget[] => {
    const dashId = customDashId || currentDashboard?.id || 'temp-id';
    return [
      {
        id: 'w-shortcuts',
        dashboard_id: dashId,
        widget_type: 'shortcuts',
        title: language === 'ar' ? 'الوصول السريع' : 'Quick Access Shortcuts',
        x: 0, y: 0, w: 12, h: 2,
        settings: { page: 0 },
        filters: {},
        order: 0,
        visible: true,
        locked: false
      },
      {
        id: 'w-kpi-profit',
        dashboard_id: dashId,
        widget_type: 'kpi_card',
        title: language === 'ar' ? 'صافي الأرباح' : 'Net Profit',
        x: 0, y: 2, w: 3, h: 2,
        settings: { dataSource: 'net_profit', page: 0 },
        filters: {},
        order: 1,
        visible: true,
        locked: false
      },
      {
        id: 'w-kpi-invoices',
        dashboard_id: dashId,
        widget_type: 'kpi_card',
        title: language === 'ar' ? 'إجمالي الفواتير' : 'Total Invoices',
        x: 3, y: 2, w: 3, h: 2,
        settings: { dataSource: 'total_invoices', page: 0 },
        filters: {},
        order: 2,
        visible: true,
        locked: false
      },
      {
        id: 'w-kpi-receipts',
        dashboard_id: dashId,
        widget_type: 'kpi_card',
        title: language === 'ar' ? 'سندات القبض' : 'Receipt Vouchers',
        x: 6, y: 2, w: 3, h: 2,
        settings: { dataSource: 'total_receipts', page: 0 },
        filters: {},
        order: 3,
        visible: true,
        locked: false
      },
      {
        id: 'w-kpi-expenses',
        dashboard_id: dashId,
        widget_type: 'kpi_card',
        title: language === 'ar' ? 'المصروفات' : 'Total Expenses',
        x: 9, y: 2, w: 3, h: 2,
        settings: { dataSource: 'total_expenses', page: 0 },
        filters: {},
        order: 4,
        visible: true,
        locked: false
      },
      {
        id: 'w-card-cash',
        dashboard_id: dashId,
        widget_type: 'card_cash',
        title: language === 'ar' ? 'رصيد النقدية' : 'Cash Balance',
        x: 0, y: 4, w: 4, h: 3,
        settings: { page: 0 },
        filters: {},
        order: 5,
        visible: true,
        locked: false
      },
      {
        id: 'w-card-customers',
        dashboard_id: dashId,
        widget_type: 'card_customers',
        title: language === 'ar' ? 'أرصدة العملاء' : 'Customer Balances',
        x: 4, y: 4, w: 4, h: 3,
        settings: { page: 0 },
        filters: {},
        order: 6,
        visible: true,
        locked: false
      },
      {
        id: 'w-card-suppliers',
        dashboard_id: dashId,
        widget_type: 'card_suppliers',
        title: language === 'ar' ? 'مستحقات الموردين' : 'Supplier Payables',
        x: 8, y: 4, w: 4, h: 3,
        settings: { page: 0 },
        filters: {},
        order: 7,
        visible: true,
        locked: false
      },
      {
        id: 'w-chart-sales',
        dashboard_id: dashId,
        widget_type: 'chart_sales',
        title: language === 'ar' ? 'أداء المبيعات' : 'Sales Performance',
        x: 0, y: 7, w: 8, h: 6,
        settings: { page: 0 },
        filters: {},
        order: 8,
        visible: true,
        locked: false
      },
      {
        id: 'w-list-transactions',
        dashboard_id: dashId,
        widget_type: 'list_transactions',
        title: language === 'ar' ? 'آخر العمليات' : 'Recent Transactions',
        x: 8, y: 7, w: 4, h: 6,
        settings: { page: 0 },
        filters: {},
        order: 9,
        visible: true,
        locked: false
      }
    ];
  };

  const loadActiveDashboard = async () => {
    if (!user || isSuperAdmin) return;
    try {
      const activeId = localStorage.getItem(`active_dashboard_${user.id}`);
      if (!activeId || activeId === 'default') {
        setCustomDashboard(null);
        setCustomWidgets([]);
        return;
      }

      const dash = await dbService.get<any>('dashboards', activeId);
      if (dash) {
        const widgets = await dbService.list<Widget>('widgets', { dashboard_id: activeId });
        setCustomDashboard({ ...dash, widgets });
        setCustomWidgets(widgets);
        setCurrentDashboard({ ...dash, widgets });

        let loadedPages = ['Main Page'];
        if (widgets.length > 0) {
          const pageIndices = widgets
            .map((w: any) => w.settings?.page || 0)
            .filter((val: number, idx: number, arr: number[]) => arr.indexOf(val) === idx)
            .sort();
          if (pageIndices.length > 0) {
            loadedPages = pageIndices.map((p: number) => `Page ${p + 1}`);
          }
        }
        setPages(loadedPages);
      } else {
        localStorage.removeItem(`active_dashboard_${user.id}`);
        setCustomDashboard(null);
        setCustomWidgets([]);
        setCurrentDashboard(null);
      }
    } catch (err) {
      console.error('Error loading active dashboard:', err);
    }
  };

  const fetchDashboards = async () => {
    if (!user || isSuperAdmin) return;
    try {
      const list = await dbService.list<any>('dashboards');
      const filtered = list.filter(dash => {
        if (dash.company_id !== user.company_id) return false;
        if (dash.owner_user_id === user.id) return true;
        if (!dash.owner_user_id) {
          if (dash.allowed_roles) {
            const roles = dash.allowed_roles.split(',').map((r: string) => r.trim());
            if (!roles.includes(user.role)) return false;
          }
          if (dash.allowed_users) {
            const users = dash.allowed_users.split(',').map((u: string) => u.trim());
            if (!users.includes(user.id)) return false;
          }
          return true;
        }
        return false;
      });
      setDashboardsList(filtered);
    } catch (err) {
      console.error('Failed to fetch dashboards list:', err);
    }
  };

  useEffect(() => {
    const fetchDataSources = async () => {
      try {
        const sources = await dbService.getWidgetDataSources();
        setDataSources(sources);
      } catch (err) {
        console.error('Failed to load data sources:', err);
      }
    };
    if (isEditing) {
      fetchDataSources();
    }
  }, [isEditing]);

  const handleStartCustomizing = () => {
    let initialWidgets: Widget[] = [];
    if (customWidgets.length > 0) {
      initialWidgets = [...customWidgets];
    } else {
      initialWidgets = getInitialDefaultWidgets();
    }

    initialWidgets = initialWidgets.map(w => {
      if (w.widget_type === 'shortcuts' && !w.settings?.quickAccess) {
        const defaultItems = masterDataItems.map(item => ({
          id: item.id,
          label: item.label,
          icon: item.icon === UsersIcon ? 'Users' :
                item.icon === Truck ? 'Truck' :
                item.icon === Package ? 'Package' :
                item.icon === Wallet ? 'Wallet' :
                item.icon === CreditCard ? 'CreditCard' :
                item.icon === Settings ? 'Settings' : 'HelpCircle',
          color: item.color,
          iconColor: item.iconColor,
          size: 'medium' as const,
          pinned: false
        }));
        return {
          ...w,
          settings: {
            ...w.settings,
            quickAccess: {
              useCustom: true,
              items: defaultItems,
              groups: []
            }
          }
        };
      }
      return w;
    });

    setTempWidgets(initialWidgets);

    if (currentDashboard) {
      setDashboardName(currentDashboard.name);
      setDashboardDescription(currentDashboard.description || '');
      setIsTemplateShared(currentDashboard.owner_user_id === null);
      setSharedRoles(currentDashboard.allowed_roles ? currentDashboard.allowed_roles.split(',') : []);
      setSharedUsers(currentDashboard.allowed_users ? currentDashboard.allowed_users.split(',') : []);
    } else {
      setDashboardName(language === 'ar' ? 'لوحة تحكم مخصصة' : 'My Customized Dashboard');
      setDashboardDescription('');
      setIsTemplateShared(false);
      setSharedRoles([]);
      setSharedUsers([]);
    }

    setEditHistory([initialWidgets]);
    setEditHistoryIndex(0);
    setIsEditing(true);
    setSelectedWidgetId(null);
  };

  const handleCancelCustomizing = () => {
    setIsEditing(false);
    setSelectedWidgetId(null);
  };

  const handleSaveLayout = async () => {
    if (!user) return;
    try {
      setIsSaving(true);
      let dashId = currentDashboard?.id;

      if (!dashId) {
        const newDashId = `dash-${uuidv4()}`;
        const newDashPayload = {
          id: newDashId,
          company_id: user.company_id,
          owner_user_id: isTemplateShared ? null : user.id,
          name: dashboardName,
          description: dashboardDescription || 'Customized layout',
          is_default: true,
          is_system: false,
          icon: 'LayoutDashboard',
          allowed_roles: sharedRoles.length > 0 ? sharedRoles.join(',') : null,
          allowed_users: sharedUsers.length > 0 ? sharedUsers.join(',') : null
        };
        await dbService.addWithId('dashboards', newDashId, newDashPayload);
        dashId = newDashId;
      } else {
        const updatePayload: any = {
          name: dashboardName,
          description: dashboardDescription,
          owner_user_id: isTemplateShared ? null : user.id,
          allowed_roles: sharedRoles.length > 0 ? sharedRoles.join(',') : null,
          allowed_users: sharedUsers.length > 0 ? sharedUsers.join(',') : null
        };
        await dbService.update('dashboards', dashId, updatePayload);
      }

      const dbWidgets = await dbService.list<Widget>('widgets', { dashboard_id: dashId });
      const dbWidgetIds = dbWidgets.map(w => w.id);
      const currentWidgetIds = tempWidgets.map(w => w.id);

      const toDelete = dbWidgetIds.filter(id => !currentWidgetIds.includes(id));
      for (const id of toDelete) {
        await dbService.delete('widgets', id);
      }

      for (const w of tempWidgets) {
        const payload = {
          dashboard_id: dashId,
          widget_type: w.widget_type,
          title: w.title,
          x: w.x,
          y: w.y,
          w: w.w,
          h: w.h,
          settings: w.settings || {},
          filters: w.filters || {},
          order: w.order,
          visible: w.visible,
          locked: w.locked
        };

        if (dbWidgetIds.includes(w.id)) {
          await dbService.update('widgets', w.id, payload);
        } else {
          const finalId = w.id.startsWith('w-temp-') ? `w-${uuidv4()}` : w.id;
          await dbService.addWithId('widgets', finalId, payload);
        }
      }

      localStorage.setItem(`active_dashboard_${user.id}`, dashId);
      await loadActiveDashboard();
      await fetchDashboards();
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to save dashboard customization:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRestoreDefaultLayout = async () => {
    if (!user) return;
    if (!window.confirm(language === 'ar' ? 'هل أنت متأكد من استعادة التنسيق الافتراضي الأساسي بالكامل؟ سيتم مسح التعديلات المخصصة الحالية.' : 'Are you sure you want to restore the default dashboard layout? Your customized widgets will be lost.')) return;
    
    try {
      if (currentDashboard && currentDashboard.owner_user_id === user.id) {
        await dbService.delete('dashboards', currentDashboard.id);
      }
      localStorage.setItem(`active_dashboard_${user.id}`, 'default');
      await loadActiveDashboard();
      await fetchDashboards();
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to restore default layout:', err);
    }
  };

  const handleDuplicateDashboard = async () => {
    if (!user) return;
    const currentName = currentDashboard ? currentDashboard.name : (language === 'ar' ? 'لوحة التحكم الافتراضية' : 'Default Dashboard');
    const promptMsg = language === 'ar' 
      ? `أدخل اسماً للوحة التحكم المكررة:` 
      : `Enter a name for the duplicated dashboard layout:`;
    const newName = window.prompt(promptMsg, `${currentName} - ${language === 'ar' ? 'نسخة' : 'Copy'}`);
    if (!newName || !newName.trim()) return;

    try {
      setLoading(true);
      const newDashId = `dash-${uuidv4()}`;
      
      // Get current widgets
      let widgetsToCopy: Widget[] = [];
      if (currentDashboard) {
        widgetsToCopy = await dbService.list<Widget>('widgets', { dashboard_id: currentDashboard.id });
      } else {
        widgetsToCopy = getInitialDefaultWidgets(newDashId);
      }

      const newDashPayload = {
        id: newDashId,
        company_id: user.company_id,
        owner_user_id: user.id,
        name: newName.trim(),
        description: currentDashboard?.description || 'Duplicated layout',
        is_default: false,
        is_system: false,
        icon: currentDashboard?.icon || 'LayoutDashboard',
        allowed_roles: null,
        allowed_users: null
      };

      await dbService.addWithId('dashboards', newDashId, newDashPayload);

      for (const w of widgetsToCopy) {
        const widgetPayload = {
          dashboard_id: newDashId,
          widget_type: w.widget_type,
          title: w.title,
          x: w.x,
          y: w.y,
          w: w.w,
          h: w.h,
          settings: w.settings || {},
          filters: w.filters || {},
          order: w.order,
          visible: w.visible,
          locked: w.locked
        };
        await dbService.addWithId('widgets', `w-${uuidv4()}`, widgetPayload);
      }

      localStorage.setItem(`active_dashboard_${user.id}`, newDashId);
      await loadActiveDashboard();
      await fetchDashboards();
    } catch (err) {
      console.error('Failed to duplicate dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDashboard = async () => {
    if (!user || !currentDashboard) return;
    if (currentDashboard.owner_user_id === null && !isCompanyAdmin) {
      alert(language === 'ar' ? 'القوالب المشتركة لا يمكن حذفها إلا بواسطة مسؤولي النظام.' : 'Shared templates can only be deleted by administrators.');
      return;
    }

    const confirmMsg = language === 'ar'
      ? `هل أنت متأكد من حذف لوحة التحكم هذه؟`
      : `Are you sure you want to delete this dashboard template?`;
    if (!window.confirm(confirmMsg)) return;

    try {
      setLoading(true);
      await dbService.delete('dashboards', currentDashboard.id);
      
      const widgetsToDelete = await dbService.list<Widget>('widgets', { dashboard_id: currentDashboard.id });
      for (const w of widgetsToDelete) {
        await dbService.delete('widgets', w.id);
      }

      localStorage.setItem(`active_dashboard_${user.id}`, 'default');
      await loadActiveDashboard();
      await fetchDashboards();
    } catch (err) {
      console.error('Failed to delete dashboard template:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExportDashboard = async () => {
    if (!user) return;
    try {
      let exportWidgets: Widget[] = [];
      let name = '';
      let description = '';
      
      if (currentDashboard) {
        name = currentDashboard.name;
        description = currentDashboard.description || '';
        exportWidgets = await dbService.list<Widget>('widgets', { dashboard_id: currentDashboard.id });
      } else {
        name = language === 'ar' ? 'لوحة التحكم الافتراضية' : 'Default Dashboard';
        description = 'Default ERP dashboard layout';
        exportWidgets = getInitialDefaultWidgets();
      }

      const exportData = {
        name,
        description,
        icon: currentDashboard?.icon || 'LayoutDashboard',
        allowed_roles: currentDashboard?.allowed_roles || null,
        allowed_users: currentDashboard?.allowed_users || null,
        widgets: exportWidgets.map(w => ({
          widget_type: w.widget_type,
          title: w.title,
          x: w.x,
          y: w.y,
          w: w.w,
          h: w.h,
          settings: w.settings || {},
          filters: w.filters || {},
          order: w.order,
          visible: w.visible,
          locked: w.locked
        }))
      };

      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `dashboard-template-${name.toLowerCase().replace(/\s+/g, '-')}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch (err) {
      console.error('Failed to export dashboard layout:', err);
    }
  };

  const handleImportDashboard = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user || !e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        
        if (!parsed.name || !Array.isArray(parsed.widgets)) {
          alert(language === 'ar' ? 'ملف القالب غير صالح.' : 'Invalid template file structure.');
          return;
        }

        setLoading(true);
        const newDashId = `dash-${uuidv4()}`;
        const newDashPayload = {
          id: newDashId,
          company_id: user.company_id,
          owner_user_id: user.id,
          name: `${parsed.name} (${language === 'ar' ? 'مستورد' : 'Imported'})`,
          description: parsed.description || 'Imported dashboard layout',
          icon: parsed.icon || 'LayoutDashboard',
          allowed_roles: parsed.allowed_roles || null,
          allowed_users: parsed.allowed_users || null
        };

        await dbService.addWithId('dashboards', newDashId, newDashPayload);

        for (const w of parsed.widgets) {
          const widgetPayload = {
            dashboard_id: newDashId,
            widget_type: w.widget_type,
            title: w.title,
            x: w.x,
            y: w.y,
            w: w.w,
            h: w.h,
            settings: w.settings || {},
            filters: w.filters || {},
            order: w.order,
            visible: w.visible,
            locked: w.locked
          };
          await dbService.addWithId('widgets', `w-${uuidv4()}`, widgetPayload);
        }

        localStorage.setItem(`active_dashboard_${user.id}`, newDashId);
        await loadActiveDashboard();
        await fetchDashboards();
      } catch (err) {
        console.error('Failed to import dashboard template:', err);
        alert(language === 'ar' ? 'فشل استيراد قالب لوحة التحكم.' : 'Failed to import dashboard template.');
      } finally {
        setLoading(false);
        e.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  const pushEditHistory = (widgetsList: Widget[]) => {
    const nextHistory = editHistory.slice(0, editHistoryIndex + 1);
    setEditHistory([...nextHistory, widgetsList]);
    setEditHistoryIndex(nextHistory.length);
  };

  const handleUndo = () => {
    if (editHistoryIndex > 0) {
      const prevIndex = editHistoryIndex - 1;
      setTempWidgets(editHistory[prevIndex]);
      setEditHistoryIndex(prevIndex);
    }
  };

  const handleRedo = () => {
    if (editHistoryIndex < editHistory.length - 1) {
      const nextIndex = editHistoryIndex + 1;
      setTempWidgets(editHistory[nextIndex]);
      setEditHistoryIndex(nextIndex);
    }
  };

  const uuidv4 = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };

  // Canvas Grid actions
  const handleDragStart = (e: React.DragEvent, w: Widget) => {
    if (w.locked) return;
    setDraggedWidget(w);
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!draggedWidget || !canvasRef.current) return;

    const canvasRect = canvasRef.current.getBoundingClientRect();
    const clientX = e.clientX - canvasRect.left - dragOffset.x;
    const clientY = e.clientY - canvasRect.top - dragOffset.y;

    const colWidth = canvasRect.width / gridConfig.cols;
    let gridX = Math.round(clientX / colWidth);
    let gridY = Math.round(clientY / gridConfig.rowHeight);

    gridX = Math.max(0, Math.min(gridX, gridConfig.cols - draggedWidget.w));
    gridY = Math.max(0, gridY);

    if (draggedWidget.x !== gridX || draggedWidget.y !== gridY) {
      const updated = tempWidgets.map(w => 
        w.id === draggedWidget.id ? { ...w, x: gridX, y: gridY } : w
      );
      setTempWidgets(updated);
    }
  };

  const handleDragEnd = () => {
    if (draggedWidget) {
      pushEditHistory(tempWidgets);
      setDraggedWidget(null);
    }
  };

  const handleResizeStart = (e: React.MouseEvent, w: Widget) => {
    e.preventDefault();
    e.stopPropagation();
    if (w.locked) return;

    setResizingWidget(w);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!canvasRef.current) return;
      const canvasRect = canvasRef.current.getBoundingClientRect();
      const colWidth = canvasRect.width / gridConfig.cols;
      
      const deltaX = moveEvent.clientX - e.clientX;
      const deltaY = moveEvent.clientY - e.clientY;

      const gridDeltaX = Math.round(deltaX / colWidth);
      const gridDeltaY = Math.round(deltaY / gridConfig.rowHeight);

      let newW = Math.max(1, Math.min(w.w + gridDeltaX, gridConfig.cols - w.x));
      let newH = Math.max(1, w.h + gridDeltaY);

      setTempWidgets(prev => prev.map(item => 
        item.id === w.id ? { ...item, w: newW, h: newH } : item
      ));
    };

    const handleMouseUp = () => {
      pushEditHistory(tempWidgets);
      setResizingWidget(null);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleAddWidget = (def: any) => {
    const dashId = currentDashboard?.id || 'temp-id';
    const newWidget: Widget = {
      id: `w-temp-${uuidv4()}`,
      dashboard_id: dashId,
      widget_type: def.type,
      title: language === 'ar' ? def.nameAr : def.nameEn,
      x: 0,
      y: getNextAvailableRow(),
      w: Math.min(def.defaultW, gridConfig.cols),
      h: def.defaultH,
      settings: { page: activeDashboardPage },
      filters: {},
      order: tempWidgets.length,
      visible: true,
      locked: false
    };

    const newWidgets = [...tempWidgets, newWidget];
    setTempWidgets(newWidgets);
    setSelectedWidgetId(newWidget.id);
    pushEditHistory(newWidgets);
  };

  const handleDeleteWidget = (id: string) => {
    const newWidgets = tempWidgets.filter(w => w.id !== id);
    setTempWidgets(newWidgets);
    if (selectedWidgetId === id) setSelectedWidgetId(null);
    pushEditHistory(newWidgets);
  };

  const handleToggleLockWidget = (id: string) => {
    const newWidgets = tempWidgets.map(w => w.id === id ? { ...w, locked: !w.locked } : w);
    setTempWidgets(newWidgets);
    pushEditHistory(newWidgets);
  };

  const handleToggleVisibleWidget = (id: string) => {
    const newWidgets = tempWidgets.map(w => w.id === id ? { ...w, visible: !w.visible } : w);
    setTempWidgets(newWidgets);
    pushEditHistory(newWidgets);
  };

  const handleDuplicateWidget = (w: Widget) => {
    const newWidget: Widget = {
      ...w,
      id: `w-temp-${uuidv4()}`,
      title: `${w.title} (${language === 'ar' ? 'نسخة' : 'Copy'})`,
      x: (w.x + w.w <= gridConfig.cols - w.w) ? w.x + w.w : 0,
      y: (w.x + w.w <= gridConfig.cols - w.w) ? w.y : getNextAvailableRow(),
      order: tempWidgets.length
    };

    const newWidgets = [...tempWidgets, newWidget];
    setTempWidgets(newWidgets);
    setSelectedWidgetId(newWidget.id);
    pushEditHistory(newWidgets);
  };

  const handleAddPage = () => {
    const newPages = [...pages, `Page ${pages.length + 1}`];
    setPages(newPages);
    setActiveDashboardPage(newPages.length - 1);
  };

  const handleDeletePage = (idx: number) => {
    if (pages.length <= 1) return;
    if (!window.confirm(language === 'ar' ? 'هل أنت متأكد من مسح هذه الصفحة وكافة بطاقاتها؟' : 'Are you sure you want to delete this page and all its widgets?')) return;
    
    const newPages = pages.filter((_, i) => i !== idx);
    const newWidgets = tempWidgets
      .filter(w => (w.settings?.page || 0) !== idx)
      .map(w => {
        const pageNum = w.settings?.page || 0;
        if (pageNum > idx) {
          return { ...w, settings: { ...w.settings, page: pageNum - 1 } };
        }
        return w;
      });

    setPages(newPages);
    setTempWidgets(newWidgets);
    pushEditHistory(newWidgets);
    setActiveDashboardPage(Math.max(0, idx - 1));
  };

  const handleRenamePage = (idx: number) => {
    const currentName = pages[idx];
    const newName = window.prompt(language === 'ar' ? 'أدخل الاسم الجديد للصفحة:' : 'Enter new page name:', currentName);
    if (newName && newName.trim()) {
      const newPages = [...pages];
      newPages[idx] = newName.trim();
      setPages(newPages);
    }
  };

  useEffect(() => {
    if (user && !isSuperAdmin) {
      const companyId = user.company_id;
      const cacheKey = `${user.id}_${companyId}`;
      const cached = statsCache[cacheKey];
      
      if (cached && (Date.now() - cached.timestamp < CACHE_DURATION)) {
        setStats(cached.stats);
        setLoading(false);
      } else {
        fetchStats();
      }
      loadActiveDashboard();
      fetchDashboards();

      if (isCompanyAdmin) {
        dbService.list<any>('users')
          .then(list => {
            setUsersList((list || []).filter(u => u.company_id === user.company_id));
          })
          .catch(err => console.error("Failed to load users list:", err));
      }
    } else if (isSuperAdmin) {
      setLoading(false);
    }
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);

    const handleFocus = () => {
      fetchStats(false);
      loadActiveDashboard();
      fetchDashboards();
    };
    const handleDbRefresh = () => {
      if (user) {
        const cacheKey = `${user.id}_${user.company_id}`;
        delete statsCache[cacheKey];
      }
      fetchStats(false);
      loadActiveDashboard();
      fetchDashboards();
    };

    window.addEventListener('db-refresh', handleDbRefresh);
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(timer);
      window.removeEventListener('db-refresh', handleDbRefresh);
      window.removeEventListener('focus', handleFocus);
    };
  }, [user?.id, user?.company_id, isSuperAdmin, activeTabId]);

  useEffect(() => {
    if (initialEditMode && !loading) {
      handleStartCustomizing();
    }
  }, [initialEditMode, loading]);

  const fetchStats = async (showLoading = true) => {
    if (!user || isSuperAdmin) return;
    const companyId = user.company_id;
    
    try {
      if (showLoading) setLoading(true);
      
      const results = await Promise.allSettled([
        dbService.list<Invoice>('invoices', user.company_id),
        dbService.list<Return>('returns', user.company_id),
        dbService.list<ReceiptVoucher>('receipt_vouchers', user.company_id),
        dbService.list<PaymentVoucher>('payment_vouchers', user.company_id),
        dbService.list<Customer>('customers', user.company_id),
        dbService.list<Supplier>('suppliers', user.company_id),
        dbService.list<PurchaseInvoice>('purchase_invoices', user.company_id),
        dbService.list<PurchaseReturn>('purchase_returns', user.company_id),
        dbService.list<CustomerDiscount>('customer_discounts', user.company_id),
        dbService.list<SupplierDiscount>('supplier_discounts', user.company_id),
        dbService.list<any>('journal_entries', user.company_id),
        dbService.list<Account>('accounts', user.company_id),
        dbService.list<AccountType>('account_types', user.company_id),
        dbService.list<any>('payment_methods', user.company_id)
      ]);

      const [
        invoices, returns, receipts, payments, customers, suppliers,
        purchaseInvoices, purchaseReturns, customerDiscounts, supplierDiscounts,
        journalEntries, accounts, accountTypes, paymentMethods
      ] = results.map(r => r.status === 'fulfilled' ? r.value : []) as [
        Invoice[], Return[], ReceiptVoucher[], PaymentVoucher[], Customer[], Supplier[],
        PurchaseInvoice[], PurchaseReturn[], CustomerDiscount[], SupplierDiscount[],
        any[], Account[], AccountType[], any[]
      ];

      const now = new Date();
      const statsMonth = now.getMonth();
      const statsYear = now.getFullYear();
      
      const startOfMonth = `${statsYear}-${String(statsMonth + 1).padStart(2, '0')}-01`;
      const today = now.toISOString().split('T')[0];

      const incomeStatement = AccountingEngine.calculateIncomeStatement(accounts, accountTypes, journalEntries, startOfMonth, today);
      const balanceSheet = AccountingEngine.calculateBalanceSheet(accounts, accountTypes, journalEntries, today);

      const netProfit = incomeStatement.netProfit;
      const netSales = incomeStatement.totalRevenues;
      const totalExpensesValue = incomeStatement.totalExpenses + incomeStatement.totalCosts;
      
      const monthInvoices = invoices.filter(inv => {
        if (!inv.date) return false;
        const [y, m] = inv.date.split('-').map(Number);
        return (m - 1) === statsMonth && y === statsYear;
      });

      const monthReceipts = receipts.filter(r => {
        if (!r.date) return false;
        const [y, m] = r.date.split('-').map(Number);
        return (m - 1) === statsMonth && y === statsYear;
      });

      const totalReceipts = receipts
        .filter(r => {
          if (!r.date) return false;
          const [y, m] = r.date.split('-').map(Number);
          return (m - 1) === statsMonth && y === statsYear;
        })
        .reduce((sum, r: any) => {
          // If header amount exists, use it. Otherwise sum items (for multi-receipt)
          if (r.amount && Number(r.amount) > 0) return sum + Number(r.amount);
          if (r.voucher_type === 'multi' && r.items && Array.isArray(r.items)) {
            return sum + r.items.reduce((s: number, item: any) => s + (Number(item.amount) || 0), 0);
          }
          return sum;
        }, 0);

      const totalCustomerBalances = balanceSheet.assets
        .filter(a => {
          const acc = accounts.find(account => account.id === a.id);
          return acc?.name.includes('عملاء') || acc?.name.includes('العملاء') || customers.some(c => c.account_id === a.id);
        })
        .reduce((sum, a) => sum + a.balance, 0);

      const totalSupplierBalances = balanceSheet.liabilities
        .filter(l => {
          const acc = accounts.find(account => account.id === l.id);
          return acc?.name.includes('موردين') || acc?.name.includes('الموردين') || suppliers.some(s => s.account_id === l.id);
        })
        .reduce((sum, l) => sum + l.balance, 0);

      const totalCashBalance = balanceSheet.assets
        .filter(a => {
          const acc = accounts.find(account => account.id === a.id);
          return acc?.name.includes('نقدية') || acc?.name.includes('صندوق') || acc?.name.includes('خزينة') || acc?.name.includes('بنك') || paymentMethods.some(p => p.account_id === a.id);
        })
        .reduce((sum, a) => sum + a.balance, 0);

      const monthKeys = ['months.jan', 'months.feb', 'months.mar', 'months.apr', 'months.may', 'months.jun', 'months.jul', 'months.aug', 'months.sep', 'months.oct', 'months.nov', 'months.dec'];
      const salesByMonth = monthKeys.map((key, index) => {
        const monthInvoices = invoices.filter((inv: Invoice) => (new Date(inv.date).getUTCMonth() === index));
        const monthReturns = returns.filter((ret: Return) => (new Date(ret.date).getUTCMonth() === index));
        const total = monthInvoices.reduce((sum: number, inv: Invoice) => sum + (Number(inv.total_amount) || 0), 0) - 
                      monthReturns.reduce((sum: number, ret: Return) => sum + (Number(ret.total_amount) || 0), 0);
        return { month: t(key), total };
      });

      const recentTransactions: DashboardTransaction[] = [
        ...invoices.map((inv: Invoice) => ({ id: inv.id, type: 'invoice' as const, number: inv.invoice_number, customer_name: inv.customer_name || t('dashboard.unknown_customer'), date: inv.date, total_amount: Number(inv.total_amount) || 0 })),
        ...returns.map((ret: Return) => ({ id: ret.id, type: 'return' as const, number: ret.return_number, customer_name: ret.customer_name || t('dashboard.unknown_customer'), date: ret.date, total_amount: Number(ret.total_amount) || 0 })),
        ...receipts.map((r: ReceiptVoucher) => ({ id: r.id, type: 'receipt' as const, number: r.voucher_number || r.id.slice(-6), customer_name: r.customer_name || t('dashboard.unknown_customer'), date: r.date, total_amount: Number(r.amount) || 0 })),
        ...payments.map((p: PaymentVoucher) => ({ id: p.id, type: 'payment' as const, number: p.voucher_number || p.id.slice(-6), customer_name: p.supplier_name || p.description || t('dashboard.unknown_supplier'), date: p.date, total_amount: Number(p.amount) || 0 }))
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5);

      const newStats: DashboardStats = { netProfit, netSales, totalInvoices: monthInvoices.length, totalReceipts, totalExpenses: totalExpensesValue, totalCustomerBalances, totalSupplierBalances, totalCashBalance, salesByMonth, recentTransactions };
      setStats(newStats);
      
      const cacheKey = `${user.id}_${companyId}`;
      statsCache[cacheKey] = { stats: newStats, timestamp: Date.now() };
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleAiSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsAiSearching(true);
    try {
      const response = await smartSearch(searchQuery, stats);
      setAiResponse(response || t('dashboard.no_answer'));
    } catch (e: any) {
      setAiResponse(`${t('dashboard.ai_search_error')}: ${e.message}`);
    } finally {
      setIsAiSearching(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-full p-20"><div className="w-10 h-10 border-4 border-brand-primary border-t-transparent rounded-full animate-spin" /></div>;

  if (isEditing) {
    const WIDGET_CATALOG = [
      ...WIDGET_REGISTRY,
      { type: 'shortcuts', nameEn: 'Quick Access Shortcuts', nameAr: 'الوصول السريع', defaultW: 12, defaultH: 2, description: 'Links to ERP lists.' },
      { type: 'card_cash', nameEn: 'Cash Balance', nameAr: 'رصيد النقدية', defaultW: 4, defaultH: 3, description: 'Shows total cash.' },
      { type: 'card_customers', nameEn: 'Customer Balances', nameAr: 'أرصدة العملاء', defaultW: 4, defaultH: 3, description: 'Receivables.' },
      { type: 'card_suppliers', nameEn: 'Supplier Balances', nameAr: 'مستحقات الموردين', defaultW: 4, defaultH: 3, description: 'Payables.' },
      { type: 'chart_sales', nameEn: 'Sales Performance Area', nameAr: 'أداء المبيعات', defaultW: 8, defaultH: 6, description: 'Area chart.' },
      { type: 'list_transactions', nameEn: 'Recent Transactions List', nameAr: 'آخر العمليات', defaultW: 4, defaultH: 6, description: 'Feed of operations.' }
    ];

    const filteredCatalog = WIDGET_CATALOG.filter(def => {
      const cat = def.type.includes('kpi') || def.type === 'profit' ? 'kpi' :
                  def.type.includes('chart') || def.type === 'cash_flow' ? 'charts' :
                  def.type === 'table' || def.type === 'customers' || def.type === 'suppliers' ? 'tables' : 'custom';
      
      const matchesSearch = def.nameEn.toLowerCase().includes(widgetSearchQuery.toLowerCase()) || 
                            def.nameAr.includes(widgetSearchQuery);
      const matchesCategory = widgetCategory === 'all' || cat === widgetCategory;
      return matchesSearch && matchesCategory;
    });

    const selectedWidget = tempWidgets.find(w => w.id === selectedWidgetId);
    const qa = selectedWidget?.settings?.quickAccess || { items: [], groups: [] };

    return (
      <>
        <div className="flex flex-col h-[calc(100vh-100px)] bg-slate-50 border border-slate-200 rounded-3xl overflow-hidden font-sans shadow-lg select-none" dir={dir}>
        {/* Top Header toolbar */}
        <div className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4 flex-shrink-0 z-20 shadow-sm">
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
            <input
              type="text"
              value={dashboardName}
              onChange={(e) => setDashboardName(e.target.value)}
              placeholder={language === 'ar' ? 'اسم لوحة التحكم' : 'Dashboard Name'}
              className="text-sm font-bold border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-brand-primary bg-white text-slate-800 w-full sm:w-60"
            />
            <input
              type="text"
              value={dashboardDescription}
              onChange={(e) => setDashboardDescription(e.target.value)}
              placeholder={language === 'ar' ? 'الوصف' : 'Description'}
              className="text-xs border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-brand-primary bg-white text-slate-500 w-full sm:w-80"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
            <button
              onClick={() => setShowWidgetLibrary(!showWidgetLibrary)}
              className={`flex items-center gap-1.5 px-3.5 py-2 border rounded-xl text-xs font-bold transition-all ${
                showWidgetLibrary 
                  ? 'bg-indigo-50 border-indigo-200 text-indigo-700 shadow-sm' 
                  : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900'
              }`}
            >
              <Plus size={14} />
              {language === 'ar' ? 'مكتبة البطاقات' : 'Widget Library'}
            </button>

            <div className="w-[1px] h-5 bg-slate-200 hidden sm:block" />

            <div className="flex items-center gap-1">
              <button
                onClick={handleUndo}
                disabled={editHistoryIndex <= 0}
                className="p-2 border border-slate-200 rounded-xl bg-white hover:bg-slate-50 disabled:opacity-40 text-slate-600 transition-colors"
                title="Undo"
              >
                <Undo2 size={14} />
              </button>
              <button
                onClick={handleRedo}
                disabled={editHistoryIndex >= editHistory.length - 1}
                className="p-2 border border-slate-200 rounded-xl bg-white hover:bg-slate-50 disabled:opacity-40 text-slate-600 transition-colors"
                title="Redo"
              >
                <Redo2 size={14} />
              </button>
            </div>

            <div className="w-[1px] h-5 bg-slate-200 hidden sm:block" />

            <button
              onClick={handleRestoreDefaultLayout}
              className="flex items-center gap-1.5 px-3 py-2 bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-100 rounded-xl text-xs font-bold transition-all"
            >
              <Trash2 size={14} />
              {language === 'ar' ? 'استعادة الافتراضي' : 'Restore Default'}
            </button>
            
            <button
              onClick={handleCancelCustomizing}
              className="px-3.5 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-colors"
            >
              {language === 'ar' ? 'إلغاء' : 'Cancel'}
            </button>
            
            <button
              onClick={handleSaveLayout}
              disabled={isSaving || !dashboardName.trim()}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-sm transition-all active:scale-95"
            >
              <Save size={14} />
              {isSaving ? (language === 'ar' ? 'جاري الحفظ...' : 'Saving...') : (language === 'ar' ? 'حفظ التغييرات' : 'Save')}
            </button>
          </div>
        </div>

        {/* Admin templates banner */}
        {isCompanyAdmin && (
          <div className="bg-slate-100 border-b border-slate-200 px-6 py-2 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-xs text-slate-700 font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={isTemplateShared}
                  onChange={(e) => setIsTemplateShared(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                {language === 'ar' ? 'مشاركة كقالب مشترك للشركة' : 'Share as company template'}
              </label>
              
              {isTemplateShared && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-400 font-bold uppercase">{language === 'ar' ? 'الأدوار المسموحة:' : 'Allowed Roles:'}</span>
                  <div className="flex gap-1.5">
                    {['admin', 'user'].map(role => (
                      <label key={role} className="flex items-center gap-1 text-[10px] bg-white border border-slate-200 rounded-md px-1.5 py-0.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={sharedRoles.includes(role)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSharedRoles([...sharedRoles, role]);
                            } else {
                              setSharedRoles(sharedRoles.filter(r => r !== role));
                            }
                          }}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-3 h-3"
                        />
                        {role.toUpperCase()}
                      </label>
                    ))}
                  </div>
                  {usersList.length > 0 && (
                    <div className="flex items-center gap-2 border-l border-slate-200 pl-3">
                      <span className="text-[10px] text-slate-400 font-bold uppercase">{language === 'ar' ? 'المستخدمين المسموحين:' : 'Allowed Users:'}</span>
                      <select
                        multiple
                        value={sharedUsers}
                        onChange={(e) => {
                          const options = Array.from(e.target.selectedOptions).map(o => o.value);
                          setSharedUsers(options);
                        }}
                        className="text-[9px] bg-white border border-slate-200 rounded-md p-1 min-w-[120px] max-h-[30px] overflow-y-auto outline-none"
                      >
                        {usersList.map(u => (
                          <option key={u.id} value={u.id}>{u.username}</option>
                        ))}
                      </select>
                      <span className="text-[8px] text-slate-400">({language === 'ar' ? 'Ctrl+اضغط للتحديد المتعدد' : 'Ctrl+Click to select multiple'})</span>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="text-[10px] text-slate-400 font-semibold">
              {language === 'ar' ? 'تعديل وحفظ القوالب المشتركة متاح للمشرفين فقط' : 'Shared templates can only be managed by admins'}
            </div>
          </div>
        )}

        {/* Workspace Body */}
        <div className="flex-1 flex overflow-hidden relative">
          {/* Widget Catalog Sidebar */}
          {showWidgetLibrary && (
            <div className="w-80 border-r border-slate-200 bg-white flex flex-col flex-shrink-0 z-10 shadow-sm">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider">{language === 'ar' ? 'إضافة بطاقات' : 'Widget Catalog'}</h3>
                <button onClick={() => setShowWidgetLibrary(false)} className="text-slate-400 hover:text-slate-800">
                  <XIcon size={16} />
                </button>
              </div>

              <div className="p-3 bg-slate-50/50 border-b border-slate-100 flex gap-1 overflow-x-auto">
                {[
                  { id: 'all', nameAr: 'الكل', nameEn: 'All' },
                  { id: 'kpi', nameAr: 'مؤشرات', nameEn: 'KPIs' },
                  { id: 'charts', nameAr: 'مخططات', nameEn: 'Charts' },
                  { id: 'tables', nameAr: 'جداول', nameEn: 'Tables' },
                  { id: 'custom', nameAr: 'الافتراضية', nameEn: 'Defaults' }
                ].map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setWidgetCategory(cat.id)}
                    className={`px-2.5 py-1 text-[10px] font-bold rounded-lg whitespace-nowrap transition-all ${
                      widgetCategory === cat.id 
                        ? 'bg-slate-900 text-white' 
                        : 'bg-white text-slate-500 hover:text-slate-800 border border-slate-200'
                    }`}
                  >
                    {language === 'ar' ? cat.nameAr : cat.nameEn}
                  </button>
                ))}
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                {filteredCatalog.map(def => {
                  const IconComponent = getWidgetIcon(def.type);
                  return (
                    <div 
                      key={def.type}
                      className="border border-slate-100 hover:border-brand-primary/40 rounded-xl p-3 bg-slate-50/50 hover:bg-white hover:shadow-md cursor-pointer transition-all group flex items-start justify-between"
                      onClick={() => handleAddWidget(def)}
                    >
                      <div className="flex gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-white border border-slate-100 flex items-center justify-center text-indigo-500 shrink-0">
                          <IconComponent size={16} />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-slate-800 truncate">{language === 'ar' ? def.nameAr : def.nameEn}</h4>
                          <p className="text-[9px] text-slate-400 mt-0.5 line-clamp-2 leading-relaxed">{def.description}</p>
                        </div>
                      </div>
                      <button className="p-1 rounded-md bg-white border border-slate-100 hover:bg-slate-100 text-slate-400 hover:text-indigo-600 transition-colors">
                        <Plus size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Grid Canvas */}
          <div className="flex-1 overflow-auto flex flex-col h-full bg-slate-100">
            <div className="bg-white border-b border-slate-200 px-6 py-2 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-1">
                {pages.map((pName, idx) => (
                  <div key={idx} className="flex items-center group">
                    <button
                      onClick={() => setActiveDashboardPage(idx)}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                        activeDashboardPage === idx 
                          ? 'bg-indigo-50 text-indigo-600 border border-indigo-100 shadow-sm shadow-indigo-50/50' 
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      {pName}
                    </button>
                    {activeDashboardPage === idx && (
                      <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity ml-1 gap-0.5">
                        <button onClick={() => handleRenamePage(idx)} className="text-[10px] text-slate-400 hover:text-slate-700 font-bold px-1">Rename</button>
                        {pages.length > 1 && (
                          <button onClick={() => handleDeletePage(idx)} className="text-[10px] text-rose-500 hover:text-rose-700 font-bold px-1">Delete</button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                <button 
                  onClick={handleAddPage}
                  className="p-1 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg ml-2 transition-all"
                  title="Add Page"
                >
                  <Plus size={16} />
                </button>
              </div>
              
              <div className="text-xs text-slate-400 font-medium">
                {deviceSize.toUpperCase()} MODE &bull; {gridConfig.cols} COLUMNS
              </div>
            </div>

            <div className="flex-1 p-6 flex items-start justify-center overflow-auto min-h-0">
              <div 
                className="bg-white border border-slate-200 shadow-xl rounded-3xl relative p-6 flex-shrink-0 select-none transition-all w-full"
                style={{ minHeight: '450px' }}
              >
                <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none opacity-[0.03]"
                  style={{
                    backgroundImage: `radial-gradient(circle, #000 1px, transparent 1px)`,
                    backgroundSize: `calc(100% / ${gridConfig.cols}) ${gridConfig.rowHeight}px`
                  }}
                />

                <div 
                  ref={canvasRef}
                  onDragOver={handleDragOver}
                  className="relative w-full transition-all"
                  style={{ 
                    height: `${Math.max(6, getNextAvailableRow()) * gridConfig.rowHeight}px`,
                    minHeight: '400px'
                  }}
                >
                  {tempWidgets
                    .filter(w => (w.settings?.page || 0) === activeDashboardPage)
                    .map(w => {
                      const isSelected = selectedWidgetId === w.id;
                      const colWidthPct = 100 / gridConfig.cols;
                      
                      let finalX = w.x;
                      let finalW = w.w;
                      if (gridConfig.cols === 2) {
                        finalX = w.x % 2;
                        finalW = Math.min(2, w.w);
                      } else if (gridConfig.cols === 6) {
                        finalX = Math.min(5, w.x);
                        finalW = Math.min(6 - finalX, w.w);
                      }

                      return (
                        <div
                          key={w.id}
                          draggable={!w.locked}
                          onDragStart={(e) => handleDragStart(e, w)}
                          onDragEnd={handleDragEnd}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedWidgetId(w.id);
                          }}
                          className={`absolute group cursor-move ${isSelected ? 'ring-2 ring-indigo-500 z-30 shadow-lg' : 'hover:shadow-md'}`}
                          style={{
                            left: `${finalX * colWidthPct}%`,
                            width: `${finalW * colWidthPct}%`,
                            top: `${w.y * gridConfig.rowHeight}px`,
                            height: `${w.h * gridConfig.rowHeight}px`,
                            padding: '6px'
                          }}
                        >
                          <div 
                            className={`bg-white border rounded-2xl h-full w-full overflow-hidden flex flex-col p-4 relative transition-all ${
                              !w.visible ? 'opacity-40 border-dashed border-slate-300' : 'border-slate-200'
                            }`}
                            style={{
                              backgroundColor: w.settings?.backgroundColor || undefined,
                              borderRadius: w.settings?.borderRadius ? `${w.settings.borderRadius}px` : undefined
                            }}
                          >
                            <div className="flex items-center justify-between mb-3 pb-1.5 border-b border-slate-100 flex-shrink-0">
                              <h5 className="text-[10px] font-black text-slate-800 flex items-center gap-1.5 truncate pr-10">
                                {React.createElement(getWidgetIcon(w.widget_type), { size: 12, className: 'text-indigo-600' })}
                                {w.title}
                              </h5>
                              <div className="flex items-center gap-1 shrink-0">
                                {w.locked && <Lock size={10} className="text-slate-400" />}
                                {!w.visible && <EyeOff size={10} className="text-slate-400" />}
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteWidget(w.id);
                                  }} 
                                  className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded transition-all"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </div>

                            <div className={`flex-1 min-h-0 w-full select-none ${w.widget_type === 'shortcuts' ? 'pointer-events-auto' : 'pointer-events-none'}`}>
                              <WidgetRenderer 
                                widget={w} 
                                stats={stats} 
                                onToggleGroupCollapse={handleToggleGroupCollapse} 
                                isEditing={true}
                                onCardClick={(widgetId, item) => handleCardClick(widgetId, item)}
                                onAddCardClick={(widgetId) => handleAddCardClickOnCanvas(widgetId)}
                                onReorderCards={(widgetId, dragId, dropId) => handleReorderCardsOnCanvas(widgetId, dragId, dropId)}
                              />
                            </div>

                            {!w.locked && (
                              <div 
                                onMouseDown={(e) => handleResizeStart(e, w)}
                                className="absolute bottom-1 right-1 w-3.5 h-3.5 cursor-se-resize flex items-end justify-end opacity-40 group-hover:opacity-100"
                              >
                                <svg width="8" height="8" viewBox="0 0 8 8" className="text-slate-500 fill-current">
                                  <line x1="6" y1="0" x2="6" y2="8" stroke="currentColor" strokeWidth="1" />
                                  <line x1="3" y1="3" x2="3" y2="8" stroke="currentColor" strokeWidth="1" />
                                  <line x1="0" y1="6" x2="6" y2="6" stroke="currentColor" strokeWidth="1" />
                                </svg>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          </div>

          {/* Properties Panel Sidebar */}
          <div className="w-80 border-l border-slate-200 bg-white flex flex-col flex-shrink-0 z-10 shadow-sm">
            {selectedWidget ? (
              <div className="flex flex-col h-full overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
                  <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider">{language === 'ar' ? 'خصائص البطاقة' : 'Widget Properties'}</h3>
                  <button onClick={() => setSelectedWidgetId(null)} className="text-slate-400 hover:text-slate-800">
                    <XIcon size={16} />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar text-xs">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      {language === 'ar' ? 'عنوان البطاقة' : 'Widget Title'}
                    </label>
                    <input
                      type="text"
                      value={selectedWidget.title}
                      onChange={(e) => {
                        const val = e.target.value;
                        setTempWidgets(prev => prev.map(w => w.id === selectedWidget.id ? { ...w, title: val } : w));
                      }}
                      className="w-full border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-indigo-500 focus:outline-none bg-white text-slate-800"
                    />
                  </div>

                  {selectedWidget.widget_type === 'text' && (
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        {language === 'ar' ? 'محتوى النص' : 'Text Content'}
                      </label>
                      <textarea
                        rows={4}
                        value={selectedWidget.settings?.text || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setTempWidgets(prev => prev.map(w => w.id === selectedWidget.id ? { ...w, settings: { ...w.settings, text: val } } : w));
                        }}
                        className="w-full border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-indigo-500 focus:outline-none bg-white text-slate-800"
                      />
                    </div>
                  )}

                  {selectedWidget.widget_type === 'kpi_card' && (
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        {language === 'ar' ? 'مصدر البيانات' : 'Data Source'}
                      </label>
                      <select
                        value={selectedWidget.settings?.dataSource || 'net_profit'}
                        onChange={(e) => {
                          const val = e.target.value;
                          setTempWidgets(prev => prev.map(w => w.id === selectedWidget.id ? { ...w, settings: { ...w.settings, dataSource: val } } : w));
                        }}
                        className="w-full border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-indigo-500 focus:outline-none bg-white text-slate-700"
                      >
                        <option value="net_profit">{language === 'ar' ? 'صافي الأرباح' : 'Net Profit'}</option>
                        <option value="total_invoices">{language === 'ar' ? 'إجمالي الفواتير' : 'Total Invoices'}</option>
                        <option value="total_receipts">{language === 'ar' ? 'سندات القبض' : 'Receipt Vouchers'}</option>
                        <option value="total_expenses">{language === 'ar' ? 'المصروفات' : 'Total Expenses'}</option>
                        <option value="total_customer_balances">{language === 'ar' ? 'أرصدة العملاء' : 'Customer Balances'}</option>
                        <option value="total_supplier_balances">{language === 'ar' ? 'أرصدة الموردين' : 'Supplier Balances'}</option>
                        <option value="total_cash_balance">{language === 'ar' ? 'رصيد النقدية' : 'Cash Balance'}</option>
                      </select>
                    </div>
                  )}

                  {selectedWidget.widget_type === 'shortcuts' && (
                    <div className="space-y-4 border-t border-slate-100 pt-3">
                      <div>
                        <h4 className="font-extrabold text-[10px] uppercase text-indigo-600 mb-2">
                          {language === 'ar' ? 'تخصيص الوصول السريع' : 'Customize Quick Access'}
                        </h4>
                        
                        {/* Search ERP pages */}
                        <div className="space-y-1">
                          <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                            {language === 'ar' ? 'بحث وإضافة صفحة' : 'Search & Add Page'}
                          </label>
                          <input
                            type="text"
                            placeholder={language === 'ar' ? 'اكتب للبحث...' : 'Type to search...'}
                            value={qaSearchQuery}
                            onChange={(e) => setQaSearchQuery(e.target.value)}
                            className="w-full border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-indigo-500 focus:outline-none bg-white text-slate-800"
                          />
                          {qaSearchQuery.trim() && (
                            <div className="border border-slate-200 rounded-lg bg-white max-h-40 overflow-y-auto mt-1 shadow-md p-1 space-y-1">
                              {getErpPagesDirectory(t).filter(p => 
                                p.nameEn.toLowerCase().includes(qaSearchQuery.toLowerCase()) || 
                                p.nameAr.includes(qaSearchQuery)
                              ).slice(0, 5).map(page => (
                                <button
                                  key={page.id}
                                  onClick={() => handleAddQuickAccessItem(page)}
                                  className="w-full text-left flex items-center justify-between p-1.5 hover:bg-slate-50 rounded text-[10px] text-slate-700 font-semibold"
                                >
                                  <span>{language === 'ar' ? page.nameAr : page.nameEn}</span>
                                  <span className="text-[8px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">{page.category}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Group Management */}
                      <div className="space-y-2 border-t border-slate-100 pt-3">
                        <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                          {language === 'ar' ? 'إدارة المجموعات' : 'Groups Management'}
                        </label>
                        <div className="flex gap-1.5">
                          <input
                            type="text"
                            placeholder={language === 'ar' ? 'اسم المجموعة...' : 'Group name...'}
                            value={newGroupName}
                            onChange={(e) => setNewGroupName(e.target.value)}
                            className="flex-1 border border-slate-200 rounded-lg p-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[10px]"
                          />
                          <button
                            onClick={() => {
                              if (!newGroupName.trim()) return;
                              updateQuickAccessSettings(qa => {
                                const newGroup = {
                                  id: `g-${uuidv4()}`,
                                  name: newGroupName.trim(),
                                  collapsed: false
                                };
                                return { ...qa, groups: [...(qa.groups || []), newGroup] };
                              }, true);
                              setNewGroupName('');
                            }}
                            className="bg-indigo-600 text-white px-2.5 py-1.5 rounded-lg font-bold text-[10px] hover:bg-indigo-700 transition-colors"
                          >
                            +
                          </button>
                        </div>

                        {/* List of created groups with delete option */}
                        {(qa.groups || []).length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {(qa.groups || []).map((g: any) => (
                              <div key={g.id} className="flex items-center gap-1 bg-slate-100 text-slate-600 text-[9px] px-2 py-0.5 rounded-full border border-slate-200">
                                <span>{g.name}</span>
                                <button
                                  onClick={() => {
                                    // Remove group and ungroup its items
                                    updateQuickAccessSettings(qa => {
                                      const nextGroups = (qa.groups || []).filter((group: any) => group.id !== g.id);
                                      const nextItems = (qa.items || []).map((item: any) => 
                                        item.groupId === g.id ? { ...item, groupId: undefined } : item
                                      );
                                      return { ...qa, groups: nextGroups, items: nextItems };
                                    }, true);
                                  }}
                                  className="text-rose-500 hover:text-rose-700 font-bold ml-1"
                                >
                                  &times;
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Customize Items */}
                      <div className="space-y-2 border-t border-slate-100 pt-3">
                        <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                          {language === 'ar' ? 'العناصر الحالية' : 'Shortcut Items'}
                        </label>
                        
                        {(qa.items || []).length === 0 ? (
                          <p className="text-[10px] text-slate-400 italic">No shortcuts added yet.</p>
                        ) : (
                          <div className="space-y-3 max-h-80 overflow-y-auto pr-1 custom-scrollbar">
                            {(qa.items || []).map((item: any, idx: number) => (
                              <div key={item.id} className="p-2 border border-slate-100 rounded-xl bg-slate-50/50 space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-[10px] text-slate-700 truncate max-w-[120px]">{item.label}</span>
                                  <div className="flex items-center gap-1">
                                    {/* Move up / down */}
                                    <button
                                      disabled={idx === 0}
                                      onClick={() => {
                                        updateQuickAccessSettings(qa => {
                                          const nextItems = [...qa.items];
                                          const temp = nextItems[idx];
                                          nextItems[idx] = nextItems[idx - 1];
                                          nextItems[idx - 1] = temp;
                                          return { ...qa, items: nextItems };
                                        }, true);
                                      }}
                                      className="p-1 hover:bg-slate-200 disabled:opacity-30 rounded text-[9px]"
                                      type="button"
                                    >
                                      &uarr;
                                    </button>
                                    <button
                                      disabled={idx === (qa.items || []).length - 1}
                                      onClick={() => {
                                        updateQuickAccessSettings(qa => {
                                          const nextItems = [...qa.items];
                                          const temp = nextItems[idx];
                                          nextItems[idx] = nextItems[idx + 1];
                                          nextItems[idx + 1] = temp;
                                          return { ...qa, items: nextItems };
                                        }, true);
                                      }}
                                      className="p-1 hover:bg-slate-200 disabled:opacity-30 rounded text-[9px]"
                                      type="button"
                                    >
                                      &darr;
                                    </button>
                                    
                                    {/* Duplicate Card */}
                                    <button
                                      onClick={() => {
                                        updateQuickAccessSettings(qa => {
                                          const cardToCopy = qa.items[idx];
                                          const duplicatedCard = {
                                            ...cardToCopy,
                                            id: `${cardToCopy.id}-dup-${uuidv4().substring(0, 4)}`,
                                            label: `${cardToCopy.label} (${language === 'ar' ? 'نسخة' : 'Copy'})`
                                          };
                                          const nextItems = [...qa.items];
                                          nextItems.splice(idx + 1, 0, duplicatedCard);
                                          return { ...qa, items: nextItems };
                                        }, true);
                                      }}
                                      className="p-1 hover:bg-slate-200 rounded text-[9px] flex items-center justify-center"
                                      title={language === 'ar' ? 'تكرار' : 'Duplicate'}
                                      type="button"
                                    >
                                      <Copy size={10} />
                                    </button>

                                    <button
                                      onClick={() => {
                                        updateQuickAccessSettings(qa => {
                                          const nextItems = qa.items.filter((i: any) => i.id !== item.id);
                                          return { ...qa, items: nextItems };
                                        }, true);
                                      }}
                                      className="p-1 hover:bg-rose-100 text-rose-500 rounded text-[9px]"
                                      type="button"
                                    >
                                      &times;
                                    </button>
                                  </div>
                                </div>

                                {/* Custom Label & size */}
                                <div className="grid grid-cols-2 gap-1.5">
                                  <div>
                                    <label className="block text-[8px] text-slate-400 font-bold uppercase">{language === 'ar' ? 'العنوان' : 'Title'}</label>
                                    <input
                                      type="text"
                                      value={item.label}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        updateQuickAccessSettings(qa => {
                                          const nextItems = qa.items.map((i: any) => i.id === item.id ? { ...i, label: val } : i);
                                          return { ...qa, items: nextItems };
                                        });
                                      }}
                                      className="w-full border border-slate-200 rounded p-1 text-[9px] bg-white"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[8px] text-slate-400 font-bold uppercase">{language === 'ar' ? 'الحجم' : 'Size'}</label>
                                    <select
                                      value={item.size}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        updateQuickAccessSettings(qa => {
                                          const nextItems = qa.items.map((i: any) => i.id === item.id ? { ...i, size: val } : i);
                                          return { ...qa, items: nextItems };
                                        }, true);
                                      }}
                                      className="w-full border border-slate-200 rounded p-1 text-[9px] bg-white text-slate-700"
                                    >
                                      <option value="small">{language === 'ar' ? 'صغير' : 'Small'}</option>
                                      <option value="medium">{language === 'ar' ? 'متوسط' : 'Medium'}</option>
                                      <option value="large">{language === 'ar' ? 'كبير' : 'Large'}</option>
                                    </select>
                                  </div>
                                </div>

                                {/* Icon, Color, Group, Pin */}
                                <div className="grid grid-cols-2 gap-1.5">
                                  <div>
                                    <label className="block text-[8px] text-slate-400 font-bold uppercase">{language === 'ar' ? 'الأيقونة' : 'Icon'}</label>
                                    <select
                                      value={item.icon}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        updateQuickAccessSettings(qa => {
                                          const nextItems = qa.items.map((i: any) => i.id === item.id ? { ...i, icon: val } : i);
                                          return { ...qa, items: nextItems };
                                        }, true);
                                      }}
                                      className="w-full border border-slate-200 rounded p-1 text-[9px] bg-white text-slate-700"
                                    >
                                      {ICON_OPTIONS.map(icon => (
                                        <option key={icon} value={icon}>{icon}</option>
                                      ))}
                                    </select>
                                  </div>
                                  <div>
                                    <label className="block text-[8px] text-slate-400 font-bold uppercase">{language === 'ar' ? 'اللون' : 'Color'}</label>
                                    <select
                                      value={COLOR_PRESETS.find(p => p.bg === item.color)?.name || 'Slate'}
                                      onChange={(e) => {
                                        const preset = COLOR_PRESETS.find(p => p.name === e.target.value) || COLOR_PRESETS[6];
                                        updateQuickAccessSettings(qa => {
                                          const nextItems = qa.items.map((i: any) => i.id === item.id ? { ...i, color: preset.bg, iconColor: preset.text } : i);
                                          return { ...qa, items: nextItems };
                                        }, true);
                                      }}
                                      className="w-full border border-slate-200 rounded p-1 text-[9px] bg-white text-slate-700"
                                    >
                                      {COLOR_PRESETS.map(p => (
                                        <option key={p.name} value={p.name}>{p.name}</option>
                                      ))}
                                    </select>
                                  </div>
                                </div>

                                <div className="grid grid-cols-2 gap-1.5 items-center">
                                  <div>
                                    <label className="block text-[8px] text-slate-400 font-bold uppercase">{language === 'ar' ? 'المجموعة' : 'Group'}</label>
                                    <select
                                      value={item.groupId || ''}
                                      onChange={(e) => {
                                        const val = e.target.value || undefined;
                                        updateQuickAccessSettings(qa => {
                                          const nextItems = qa.items.map((i: any) => i.id === item.id ? { ...i, groupId: val } : i);
                                          return { ...qa, items: nextItems };
                                        }, true);
                                      }}
                                      className="w-full border border-slate-200 rounded p-1 text-[9px] bg-white text-slate-700"
                                    >
                                      <option value="">{language === 'ar' ? 'بدون مجموعة' : 'Ungrouped'}</option>
                                      {(qa.groups || []).map((g: any) => (
                                        <option key={g.id} value={g.id}>{g.name}</option>
                                      ))}
                                    </select>
                                  </div>
                                  <label className="flex items-center gap-1.5 cursor-pointer mt-3">
                                    <input
                                      type="checkbox"
                                      checked={item.pinned === true}
                                      onChange={(e) => {
                                        const val = e.target.checked;
                                        updateQuickAccessSettings(qa => {
                                          const nextItems = qa.items.map((i: any) => i.id === item.id ? { ...i, pinned: val } : i);
                                          return { ...qa, items: nextItems };
                                        }, true);
                                      }}
                                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-3 h-3"
                                    />
                                    <span className="text-[9px] font-bold text-slate-500 uppercase">{language === 'ar' ? 'تثبيت' : 'Pin'}</span>
                                  </label>
                                </div>

                                {/* Replace Page Trigger */}
                                <div className="pt-1.5 border-t border-slate-100/50">
                                  <button
                                    onClick={() => {
                                      setReplacingCardId(replacingCardId === item.id ? null : item.id);
                                      setReplacingSearchQuery('');
                                    }}
                                    className="w-full py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg text-[9px] transition-colors flex items-center justify-center gap-1"
                                    type="button"
                                  >
                                    <Lucide.RefreshCw size={10} />
                                    {language === 'ar' ? 'استبدال الصفحة' : 'Replace Page'}
                                  </button>
                                  
                                  {replacingCardId === item.id && (
                                    <div className="mt-1.5 border border-slate-200 rounded-lg bg-white p-2 shadow-sm space-y-1.5 z-10 relative">
                                      <input
                                        type="text"
                                        placeholder={language === 'ar' ? 'ابحث عن صفحة لتبديلها...' : 'Search page to replace...'}
                                        value={replacingSearchQuery}
                                        onChange={(e) => setReplacingSearchQuery(e.target.value)}
                                        className="w-full border border-slate-200 rounded p-1 text-[9px] bg-slate-50 focus:bg-white outline-none"
                                      />
                                      <div className="max-h-24 overflow-y-auto space-y-1 custom-scrollbar">
                                        {getErpPagesDirectory(t).filter(p => 
                                          p.nameEn.toLowerCase().includes(replacingSearchQuery.toLowerCase()) || 
                                          p.nameAr.includes(replacingSearchQuery)
                                        ).map(page => (
                                          <button
                                            key={page.id}
                                            onClick={() => {
                                              updateQuickAccessSettings(qa => {
                                                const nextItems = qa.items.map((i: any) => i.id === item.id ? { 
                                                  ...i, 
                                                  id: page.id, 
                                                  label: language === 'ar' ? page.nameAr : page.nameEn,
                                                  icon: page.defaultIcon,
                                                  color: page.defaultColor,
                                                  iconColor: page.defaultColor.split(' ')[0].replace('from-', 'text-').split('/')[0]
                                                } : i);
                                                return { ...qa, items: nextItems };
                                              }, true);
                                              setReplacingCardId(null);
                                            }}
                                            className="w-full text-left flex items-center justify-between p-1 hover:bg-slate-50 rounded text-[9px] font-bold text-slate-600"
                                            type="button"
                                          >
                                            <span>{language === 'ar' ? page.nameAr : page.nameEn}</span>
                                            <span className="text-[7px] bg-slate-100 px-1 rounded text-slate-400">{page.category}</span>
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        
                        <button
                          onClick={() => {
                            if (!window.confirm(language === 'ar' ? 'هل أنت متأكد من استعادة اختصارات الوصول السريع الافتراضية؟' : 'Are you sure you want to restore default Quick Access shortcuts?')) return;
                            updateQuickAccessSettings(qa => {
                              const defaultItems = masterDataItems.map(item => ({
                                id: item.id,
                                label: item.label,
                                icon: item.icon === UsersIcon ? 'Users' :
                                      item.icon === Truck ? 'Truck' :
                                      item.icon === Package ? 'Package' :
                                      item.icon === Wallet ? 'Wallet' :
                                      item.icon === CreditCard ? 'CreditCard' :
                                      item.icon === Settings ? 'Settings' : 'HelpCircle',
                                color: item.color,
                                iconColor: item.iconColor,
                                size: 'medium' as const,
                                pinned: false
                              }));
                              return { ...qa, items: defaultItems, groups: [] };
                            }, true);
                          }}
                          className="w-full mt-2 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-lg text-[9px] transition-colors"
                        >
                          {language === 'ar' ? 'استعادة الوصول السريع الافتراضي' : 'Restore Default Quick Access'}
                        </button>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      {language === 'ar' ? 'لون الخلفية' : 'Background Color'}
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { color: '#ffffff', label: 'White' },
                        { color: '#f8fafc', label: 'Slate' },
                        { color: '#eff6ff', label: 'Blue' },
                        { color: '#ecfdf5', label: 'Green' },
                        { color: '#fffbeb', label: 'Yellow' },
                        { color: '#fdf2f8', label: 'Pink' }
                      ].map(c => (
                        <button
                          key={c.color}
                          onClick={() => {
                            setTempWidgets(prev => prev.map(w => w.id === selectedWidget.id ? { ...w, settings: { ...w.settings, backgroundColor: c.color } } : w));
                          }}
                          className={`w-6 h-6 rounded-full border shadow-sm transition-transform ${
                            selectedWidget.settings?.backgroundColor === c.color ? 'scale-110 ring-2 ring-indigo-500' : 'hover:scale-105'
                          }`}
                          style={{ backgroundColor: c.color }}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2 border-t border-slate-100 pt-3">
                    <label className="flex items-center justify-between cursor-pointer">
                      <span className="text-slate-600 font-semibold">{language === 'ar' ? 'قفل العنصر' : 'Lock widget'}</span>
                      <input
                        type="checkbox"
                        checked={selectedWidget.locked === true}
                        onChange={(e) => handleToggleLockWidget(selectedWidget.id)}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                    </label>
                    <label className="flex items-center justify-between cursor-pointer">
                      <span className="text-slate-600 font-semibold">{language === 'ar' ? 'مرئي للجميع' : 'Visible'}</span>
                      <input
                        type="checkbox"
                        checked={selectedWidget.visible !== false}
                        onChange={(e) => handleToggleVisibleWidget(selectedWidget.id)}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                    </label>
                  </div>
                </div>

                <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between flex-shrink-0">
                  <button
                    onClick={() => handleDuplicateWidget(selectedWidget)}
                    className="px-3 py-1.5 border border-slate-200 hover:bg-white text-slate-700 font-bold rounded-xl flex items-center gap-1.5 transition-all bg-white"
                  >
                    <Copy size={13} />
                    {language === 'ar' ? 'تكرار' : 'Duplicate'}
                  </button>
                  <button
                    onClick={() => handleDeleteWidget(selectedWidget.id)}
                    className="px-3 py-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-100 font-bold rounded-xl flex items-center gap-1.5 transition-all"
                  >
                    <Trash2 size={13} />
                    {language === 'ar' ? 'حذف' : 'Remove'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-5 flex flex-col justify-center items-center h-full text-center text-slate-400">
                <HelpCircle size={32} className="mb-2 text-slate-300" />
                <h4 className="font-bold text-xs">{language === 'ar' ? 'لم يتم تحديد بطاقة' : 'No widget selected'}</h4>
                <p className="text-[10px] mt-1 leading-relaxed">{language === 'ar' ? 'اضغط على أي بطاقة لتعديل خصائصها ومظهرها بشكل كامل.' : 'Click on any widget on the canvas to configure its settings and appearance.'}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {editingCard && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setEditingCard(null)}>
          <div 
            className="bg-white rounded-3xl border border-slate-100 shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Lucide.Settings size={16} className="text-indigo-600 animate-spin-slow" />
                {language === 'ar' ? 'تعديل الرابط المفضل' : 'Edit Favorite Link'}
              </h3>
              <button 
                onClick={() => setEditingCard(null)}
                className="text-slate-400 hover:text-slate-600 transition-colors p-1 hover:bg-slate-50 rounded-lg"
              >
                <Lucide.X size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto space-y-5 custom-scrollbar text-slate-700" dir={dir}>
              {/* Card Title */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  {language === 'ar' ? 'العنوان' : 'Title'}
                </label>
                <input
                  type="text"
                  value={editingCard.card.label}
                  onChange={(e) => setEditingCard({ ...editingCard, card: { ...editingCard.card, label: e.target.value } })}
                  className="w-full border border-slate-200 rounded-xl p-2.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-slate-50 hover:bg-slate-100/50 focus:bg-white text-slate-800 text-xs font-bold transition-all"
                />
              </div>

              {/* Size Selector */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  {language === 'ar' ? 'الحجم' : 'Size'}
                </label>
                <select
                  value={editingCard.card.size || 'medium'}
                  onChange={(e) => setEditingCard({ ...editingCard, card: { ...editingCard.card, size: e.target.value } })}
                  className="w-full border border-slate-200 rounded-xl p-2.5 bg-slate-50 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-700 text-xs font-bold transition-all"
                >
                  <option value="small">{language === 'ar' ? 'صغير' : 'Small'}</option>
                  <option value="medium">{language === 'ar' ? 'متوسط' : 'Medium'}</option>
                  <option value="large">{language === 'ar' ? 'كبير' : 'Large'}</option>
                </select>
              </div>

              {/* Icon & Color (Grid) */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    {language === 'ar' ? 'الأيقونة' : 'Icon'}
                  </label>
                  <select
                    value={editingCard.card.icon}
                    onChange={(e) => setEditingCard({ ...editingCard, card: { ...editingCard.card, icon: e.target.value } })}
                    className="w-full border border-slate-200 rounded-xl p-2.5 bg-slate-50 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-700 text-xs font-bold transition-all"
                  >
                    {ICON_OPTIONS.map(icon => (
                      <option key={icon} value={icon}>{icon}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    {language === 'ar' ? 'اللون' : 'Color'}
                  </label>
                  <select
                    value={COLOR_PRESETS.find(p => p.bg === editingCard.card.color)?.name || 'Slate'}
                    onChange={(e) => {
                      const preset = COLOR_PRESETS.find(p => p.name === e.target.value) || COLOR_PRESETS[6];
                      setEditingCard({
                        ...editingCard,
                        card: {
                          ...editingCard.card,
                          color: preset.bg,
                          iconColor: preset.text
                        }
                      });
                    }}
                    className="w-full border border-slate-200 rounded-xl p-2.5 bg-slate-50 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-700 text-xs font-bold transition-all"
                  >
                    {COLOR_PRESETS.map(p => (
                      <option key={p.name} value={p.name}>{p.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Pin Checkbox */}
              <label className="flex items-center gap-2.5 cursor-pointer p-3 bg-slate-50 rounded-xl border border-slate-100 hover:bg-slate-100/50 transition-colors">
                <input
                  type="checkbox"
                  checked={editingCard.card.pinned === true}
                  onChange={(e) => setEditingCard({ ...editingCard, card: { ...editingCard.card, pinned: e.target.checked } })}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                />
                <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wide">
                  {language === 'ar' ? 'تثبيت في المفضلات' : 'Pin to favorites'}
                </span>
              </label>

              {/* Replace Page Trigger */}
              <div className="pt-4 border-t border-slate-100 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-slate-500 tracking-tight">
                    {editingCard.card.id ? (language === 'ar' ? `الوجهة الحالية: ${pageLabels[editingCard.card.id] || editingCard.card.id}` : `Current destination: ${pageLabels[editingCard.card.id] || editingCard.card.id}`) : (language === 'ar' ? 'لم يتم تحديد وجهة' : 'No destination selected')}
                  </span>
                  <button
                    onClick={() => setShowReplacePopupList(!showReplacePopupList)}
                    className="px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-black rounded-xl text-[10px] transition-colors flex items-center gap-1.5 shadow-sm uppercase tracking-tight"
                    type="button"
                  >
                    <Lucide.RefreshCw size={11} className={showReplacePopupList ? 'rotate-180 duration-300' : 'duration-300'} />
                    {language === 'ar' ? 'استبدال الصفحة' : 'Replace Page'}
                  </button>
                </div>

                {showReplacePopupList && (
                  <div className="border border-slate-200 rounded-2xl bg-white p-3 shadow-md space-y-2.5 animate-in fade-in slide-in-from-top-2 duration-150">
                    <input
                      type="text"
                      placeholder={language === 'ar' ? 'ابحث عن صفحة...' : 'Search page...'}
                      value={replacingPopupSearchQuery}
                      onChange={(e) => setReplacingPopupSearchQuery(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl p-2 text-xs bg-slate-50 focus:bg-white outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-semibold"
                    />
                    <div className="max-h-40 overflow-y-auto space-y-1.5 custom-scrollbar pr-1">
                      {getErpPagesDirectory(t).filter(p => 
                        p.nameEn.toLowerCase().includes(replacingPopupSearchQuery.toLowerCase()) || 
                        p.nameAr.includes(replacingPopupSearchQuery)
                      ).map(page => (
                        <button
                          key={page.id}
                          onClick={() => {
                            setEditingCard({
                              ...editingCard,
                              card: {
                                ...editingCard.card,
                                id: page.id,
                                label: language === 'ar' ? page.nameAr : page.nameEn,
                                icon: page.defaultIcon,
                                color: page.defaultColor,
                                iconColor: page.defaultColor.split(' ')[0].replace('from-', 'text-').split('/')[0]
                              }
                            });
                            setShowReplacePopupList(false);
                          }}
                          className="w-full text-left flex items-center justify-between p-2 hover:bg-slate-50 rounded-xl text-xs font-bold text-slate-600 transition-colors"
                          type="button"
                        >
                          <span>{language === 'ar' ? page.nameAr : page.nameEn}</span>
                          <span className="text-[8px] bg-slate-100 px-2 py-0.5 rounded-full text-slate-400 font-extrabold uppercase">{page.category}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-5 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <button
                onClick={() => setEditingCard(null)}
                className="px-4 py-2 border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold rounded-xl text-xs transition-colors"
                type="button"
              >
                {language === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                onClick={() => {
                  if (!editingCard.card.id) {
                    alert(language === 'ar' ? 'يرجى اختيار صفحة أولاً' : 'Please select a page first');
                    return;
                  }
                  if (editingCard.card.isNew) {
                    updateQuickAccessSettingsFromModal(editingCard.widgetId, qa => {
                      const currentItems = qa.items || [];
                      const newItem = {
                        ...editingCard.card,
                        isNew: undefined
                      };
                      return { ...qa, items: [...currentItems, newItem] };
                    });
                  } else {
                    updateQuickAccessSettingsFromModal(editingCard.widgetId, qa => {
                      const nextItems = qa.items.map((i: any) => i.id === editingCard.card.id ? editingCard.card : i);
                      return { ...qa, items: nextItems };
                    });
                  }
                  setEditingCard(null);
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-colors"
                type="button"
              >
                {language === 'ar' ? 'حفظ' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
      </>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-8 font-sans px-2 md:px-0" 
      dir={dir}
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-8 bg-brand-primary rounded-full shadow-sm" />
            <h2 className="text-3xl font-bold tracking-tight text-slate-900">{t('dashboard.title')}</h2>
          </div>
          <div className="flex items-center gap-4 mt-2">
            <div className="flex items-center gap-2 text-slate-500 bg-white px-3 py-1.5 rounded-full border border-slate-200 shadow-sm">
              <Calendar size={14} className="text-brand-primary" />
              <p className="text-[10px] font-bold uppercase tracking-wider">
                {currentTime.toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </p>
              <div className="w-[1px] h-3 bg-slate-200" />
              <span className="text-slate-900 font-mono text-xs font-bold leading-none">{currentTime.toLocaleTimeString(language === 'ar' ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            {isCompanyAdmin && (
              <div className="flex items-center gap-2 group cursor-pointer" onClick={() => {
                navigator.clipboard.writeText(user.company_id);
                setAiResponse(t('dashboard.copied'));
              }}>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-full border border-slate-200 hover:bg-slate-200 transition-all">
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">{t('dashboard.company_code')}</span>
                  <code className="text-[10px] font-mono font-bold text-slate-900">{user.company_id}</code>
                </div>
              </div>
            )}
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto">
          {/* Dropdown Layout Switcher & Customize Button */}
          {user && !isSuperAdmin && (
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={currentDashboard?.id || 'default'}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === 'default') {
                    localStorage.setItem(`active_dashboard_${user.id}`, 'default');
                  } else {
                    localStorage.setItem(`active_dashboard_${user.id}`, val);
                  }
                  loadActiveDashboard();
                }}
                className="px-3.5 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full sm:w-auto min-w-[160px]"
              >
                <option value="default">{language === 'ar' ? 'لوحة التحكم الافتراضية' : 'Default Dashboard'}</option>
                {dashboardsList.map(dash => (
                  <option key={dash.id} value={dash.id}>
                    {dash.name} {dash.owner_user_id === null ? `(${language === 'ar' ? 'قالب مشترك' : 'Shared'})` : ''}
                  </option>
                ))}
              </select>

              {/* Duplicate Layout */}
              <button
                onClick={handleDuplicateDashboard}
                className="p-3 bg-white border border-slate-200 text-slate-600 hover:text-slate-900 rounded-2xl shadow-sm transition-all hover:bg-slate-50 flex items-center justify-center shrink-0"
                title={language === 'ar' ? 'تكرار لوحة التحكم' : 'Duplicate Layout'}
                type="button"
              >
                <Copy size={14} />
              </button>

              {/* Export Layout */}
              <button
                onClick={handleExportDashboard}
                className="p-3 bg-white border border-slate-200 text-slate-600 hover:text-slate-900 rounded-2xl shadow-sm transition-all hover:bg-slate-50 flex items-center justify-center shrink-0"
                title={language === 'ar' ? 'تصدير القالب' : 'Export Template'}
                type="button"
              >
                <Lucide.Download size={14} />
              </button>

              {/* Import Layout */}
              <button
                onClick={() => document.getElementById('import-dashboard-file-input')?.click()}
                className="p-3 bg-white border border-slate-200 text-slate-600 hover:text-slate-900 rounded-2xl shadow-sm transition-all hover:bg-slate-50 flex items-center justify-center shrink-0"
                title={language === 'ar' ? 'استيراد قالب' : 'Import Template'}
                type="button"
              >
                <Lucide.Upload size={14} />
              </button>
              <input
                id="import-dashboard-file-input"
                type="file"
                accept=".json"
                onChange={handleImportDashboard}
                className="hidden"
              />

              {/* Delete Layout */}
              {currentDashboard && (
                <button
                  onClick={handleDeleteDashboard}
                  className="p-3 bg-white border border-slate-200 text-rose-600 hover:text-rose-700 hover:border-rose-300 rounded-2xl shadow-sm transition-all hover:bg-rose-50 flex items-center justify-center shrink-0"
                  title={language === 'ar' ? 'حذف لوحة التحكم' : 'Delete Layout'}
                  type="button"
                >
                  <Trash2 size={14} />
                </button>
              )}

              <button
                onClick={handleStartCustomizing}
                className="flex items-center gap-2 px-4 py-3 bg-slate-900 text-white rounded-2xl hover:bg-slate-800 transition-all font-bold text-xs uppercase tracking-wider shadow-sm active:scale-95 whitespace-nowrap"
              >
                <Settings size={14} />
                {language === 'ar' ? 'تخصيص' : 'Customize'}
              </button>
            </div>
          )}

          {(isCompanyAdmin || isSuperAdmin) && (
            <button 
              onClick={() => {
                localStorage.setItem('templates_active_subtab', 'dashboard_designer');
                setCurrentPage('templates');
              }}
              className="flex items-center gap-2 px-4 py-3 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 transition-all font-bold text-xs uppercase tracking-wider shadow-sm active:scale-95 w-full sm:w-auto justify-center"
            >
              <Settings size={14} />
              {language === 'ar' ? 'تصميم لوحة التحكم' : 'Design Layout'}
            </button>
          )}

          <form onSubmit={handleAiSearch} className="relative w-full lg:w-[420px] group">
            <input
              type="text"
              placeholder={t('dashboard.ask_ai')}
              className={`relative w-full ${dir === 'rtl' ? 'pl-10 pr-12' : 'pr-10 pl-12'} py-4 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-brand-primary/10 focus:border-brand-primary outline-none transition-all shadow-sm text-sm font-medium text-slate-900 placeholder:text-slate-400`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <Search className={`absolute ${dir === 'rtl' ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-brand-primary transition-colors`} size={18} />
            <button 
              type="submit"
              disabled={isAiSearching}
              className={`absolute ${dir === 'rtl' ? 'left-2' : 'right-2'} top-2 bottom-2 w-10 bg-slate-900 text-white rounded-xl hover:bg-brand-primary transition-all active:scale-95 flex items-center justify-center disabled:opacity-50`}
            >
              {isAiSearching ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Sparkles size={18} />}
            </button>
          </form>
        </div>
      </div>

      {aiResponse && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white border border-slate-200 p-6 rounded-2xl flex gap-4 shadow-xl relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-brand-primary/5 blur-3xl rounded-full -mr-16 -mt-16" />
          <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center shrink-0 border border-slate-100">
            <Sparkles className="text-brand-primary" size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-slate-400 font-bold uppercase tracking-wider text-[10px] mb-2 flex items-center gap-2">
              <Zap size={12} className="text-brand-primary" />
              {t('dashboard.ai_assistant')}
            </p>
            <p className="text-slate-700 leading-relaxed font-medium text-sm">{aiResponse}</p>
            <button onClick={() => setAiResponse(null)} className="text-[10px] text-brand-primary font-bold uppercase tracking-wider mt-4 hover:text-brand-primary-dark transition-colors">
              {t('dashboard.close')} [ESC]
            </button>
          </div>
        </motion.div>
      )}

      {/* Page Selector Tabs for Multi-page Dashboard */}
      {customWidgets.length > 0 && pages.length > 1 && (
        <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
          {pages.map((pageName, idx) => (
            <button
              key={idx}
              onClick={() => setActiveDashboardPage(idx)}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
                activeDashboardPage === idx
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-white text-slate-500 hover:text-slate-900 hover:bg-slate-50 border border-slate-200'
              }`}
            >
              {language === 'ar' ? `الصفحة ${idx + 1}` : pageName}
            </button>
          ))}
        </div>
      )}

      {customWidgets.length > 0 ? (
        /* Custom Dashboard Layout */
        <div 
          className="relative w-full transition-all duration-300"
          style={{ 
            height: `${Math.max(6, getNextAvailableRow()) * gridConfig.rowHeight}px`,
            minHeight: '450px'
          }}
        >
          {customWidgets
            .filter(w => w.visible && (w.settings?.page || 0) === activeDashboardPage)
            .map(w => {
              const colWidthPct = 100 / gridConfig.cols;
              return (
                <div
                  key={w.id}
                  className="absolute transition-all duration-300"
                  style={{
                    left: `${w.x * colWidthPct}%`,
                    width: `${w.w * colWidthPct}%`,
                    top: `${w.y * gridConfig.rowHeight}px`,
                    height: `${w.h * gridConfig.rowHeight}px`,
                    padding: '6px'
                  }}
                >
                  <div 
                    className="bg-white border border-slate-200 shadow-sm rounded-2xl h-full w-full overflow-hidden flex flex-col p-4 relative hover:shadow-md transition-shadow"
                    style={{
                      backgroundColor: w.settings?.backgroundColor || undefined,
                      borderRadius: w.settings?.borderRadius ? `${w.settings.borderRadius}px` : undefined,
                      boxShadow: w.settings?.shadow === 'none' ? 'none' : 
                                 w.settings?.shadow === 'md' ? '0 4px 6px -1px rgba(0,0,0,0.1)' : 
                                 w.settings?.shadow === 'lg' ? '0 10px 15px -3px rgba(0,0,0,0.1)' : undefined
                    }}
                  >
                    {/* Widget Title Bar */}
                    <div className="flex items-center justify-between mb-3 pb-1.5 border-b border-slate-100/50">
                      <h5 className="text-[11px] font-extrabold text-slate-800 flex items-center gap-2">
                        {React.createElement(getWidgetIcon(w.widget_type), { size: 14, className: 'text-indigo-600' })}
                        {w.title}
                      </h5>
                      {w.settings?.description && (
                        <span className="text-[9px] text-slate-400 font-bold max-w-[150px] truncate">{w.settings.description}</span>
                      )}
                    </div>

                    {/* Widget Content */}
                    <div className="flex-1 min-h-0 w-full">
                      <WidgetRenderer widget={w} stats={stats} onToggleGroupCollapse={handleToggleGroupCollapse} />
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      ) : (
        /* Fallback Default Static Dashboard */
        <>
          {/* Dynamic Quick Access Integration */}
          <div className="bg-white border border-slate-200 shadow-sm rounded-3xl p-6 relative hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100/50">
              <h5 className="text-[11px] font-black text-slate-800 flex items-center gap-2">
                <Lucide.Layout size={14} className="text-indigo-600" />
                {language === 'ar' ? 'الوصول السريع' : 'Quick Access Shortcuts'}
              </h5>
            </div>
            <div className="min-h-[80px]">
              <WidgetRenderer 
                widget={{
                  id: 'w-shortcuts-default',
                  dashboard_id: 'default',
                  widget_type: 'shortcuts',
                  title: language === 'ar' ? 'الوصول السريع' : 'Quick Access Shortcuts',
                  x: 0, y: 0, w: 12, h: 2,
                  settings: {},
                  filters: {},
                  order: 0,
                  visible: true,
                  locked: false
                }} 
                stats={stats} 
                onToggleGroupCollapse={handleToggleGroupCollapse} 
              />
            </div>
          </div>

          {/* Stats Cards Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard 
              title={t('dashboard.net_profit')} 
              value={formatMoney(stats?.netProfit || 0)} 
              subtitle={t('dashboard.after_returns')}
              icon={TrendingUp} 
              trend={12.4}
              colorClass="from-emerald-500 to-emerald-600 text-emerald-500"
            />
            <StatCard 
              title={t('dashboard.total_invoices')} 
              value={stats?.totalInvoices || 0} 
              subtitle="عدد المستندات المصدرة"
              icon={FileText} 
              colorClass="from-blue-500 to-blue-600 text-blue-500"
            />
            <StatCard 
              title={t('dashboard.receipt_vouchers')} 
              value={formatMoney(stats?.totalReceipts || 0)} 
              subtitle="إجمالي سندات القبض"
              icon={ReceiptIcon} 
              colorClass="from-amber-500 to-amber-600 text-amber-500"
            />
            <StatCard 
              title={t('dashboard.total_expenses')} 
              value={formatMoney(stats?.totalExpenses || 0)} 
              subtitle="التكاليف والمصروفات"
              icon={Zap} 
              trend={-2.1}
              colorClass="from-emerald-500 to-emerald-600 text-emerald-500"
            />
          </div>

          {/* Major Analytics Bento Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <motion.div 
                  whileHover={{ scale: 1.01 }}
                  className="bg-brand-primary p-6 rounded-3xl text-white relative overflow-hidden group shadow-lg h-[220px] flex flex-col justify-between"
                >
                  <div className="absolute top-0 right-0 p-8 opacity-5 scale-150 group-hover:scale-[1.7] transition-transform duration-1000 rotate-12">
                    <Wallet size={120} />
                  </div>
                  <div className="relative z-10">
                    <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center mb-4">
                      <Wallet className="text-white" size={20} />
                    </div>
                    <p className="text-white/60 text-[10px] font-bold uppercase tracking-wider mb-2">رصيد النقدية</p>
                    <h3 className="text-2xl md:text-3xl font-bold tracking-tight">
                      {formatMoney(stats?.totalCashBalance || 0)} 
                    </h3>
                  </div>
                  <div className="flex items-center gap-2 text-white text-[9px] font-bold uppercase tracking-wider relative z-10 bg-white/10 self-start px-3 py-1.5 rounded-full border border-white/20">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
                    سيولة نقدية
                  </div>
                </motion.div>

                <motion.div 
                  whileHover={{ scale: 1.01 }}
                  className="bg-slate-900 p-6 rounded-3xl text-white relative overflow-hidden group shadow-xl h-[220px] flex flex-col justify-between"
                >
                  <div className="absolute top-0 right-0 p-8 opacity-5 scale-150 group-hover:scale-[1.7] transition-transform duration-1000 rotate-12">
                    <UsersIcon size={120} />
                  </div>
                  <div className="relative z-10">
                    <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center mb-4">
                      <TrendingUp className="text-emerald-400" size={20} />
                    </div>
                    <p className="text-white/40 text-[10px] font-bold uppercase tracking-wider mb-2">{t('dashboard.customer_balances')}</p>
                    <h3 className="text-2xl md:text-3xl font-bold tracking-tight">
                      {formatMoney(stats?.totalCustomerBalances || 0)} 
                    </h3>
                  </div>
                  <div className="flex items-center gap-2 text-emerald-400 text-[9px] font-bold uppercase tracking-wider relative z-10 bg-emerald-400/10 self-start px-3 py-1.5 rounded-full border border-emerald-400/20">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    {t('dashboard.active_receivables')}
                  </div>
                </motion.div>

                <motion.div 
                  whileHover={{ scale: 1.01 }}
                  className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden group h-[220px] flex flex-col justify-between"
                >
                  <div className="absolute top-0 right-0 p-8 opacity-[0.02] scale-150 group-hover:scale-[1.7] transition-transform duration-1000 -rotate-12">
                    <ReceiptIcon size={120} />
                  </div>
                  <div className="relative z-10">
                    <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center mb-4 border border-slate-100">
                      <ReceiptIcon className="text-slate-400" size={20} />
                    </div>
                    <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-2">{t('dashboard.supplier_balances')}</p>
                    <h3 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">
                      {formatMoney(stats?.totalSupplierBalances || 0)} 
                    </h3>
                  </div>
                  <div className="flex items-center gap-2 text-emerald-500 text-[9px] font-bold uppercase tracking-wider relative z-10 bg-emerald-50 self-start px-3 py-1.5 rounded-full border border-emerald-100">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    {t('dashboard.outstanding_debts')}
                  </div>
                </motion.div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h4 className="text-lg font-bold text-slate-900 tracking-tight">{t('dashboard.sales_performance')}</h4>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">Monthly Analytics Breakdown</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-brand-primary" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Net Revenue</span>
                  </div>
                </div>
                <div className="w-full h-[300px]">
                  {activeTabId === 'dashboard' && (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={stats?.salesByMonth} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="premiumGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="6 6" vertical={false} stroke="#f1f5f9" />
                        <XAxis 
                          dataKey="month" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 600}} 
                          dy={10} 
                        />
                        <YAxis 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 600}} 
                        />
                        <Tooltip 
                          contentStyle={{
                            borderRadius: '12px', 
                            border: '1px solid #e2e8f0', 
                            boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
                            backgroundColor: '#fff',
                            fontSize: '12px'
                          }}
                          itemStyle={{ color: '#10b981', fontWeight: 600 }}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="total" 
                          stroke="#10b981" 
                          strokeWidth={3} 
                          fillOpacity={1} 
                          fill="url(#premiumGradient)" 
                          animationDuration={1500}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm flex flex-col">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h4 className="text-lg font-bold text-slate-900 tracking-tight">{t('dashboard.recent_transactions')}</h4>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">Live Feed</p>
                </div>
                <button className="p-2 hover:bg-slate-50 rounded-lg transition-all text-slate-400">
                  <ArrowUpRight size={18} />
                </button>
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto custom-scrollbar pr-1 h-[550px]">
                {stats?.recentTransactions.map((tx, idx) => (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    key={`${tx.type}-${tx.id}`} 
                    className={`group flex items-center justify-between p-4 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-all cursor-pointer ${dir === 'rtl' ? 'text-right' : 'text-left'}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110 shadow-sm ${
                        tx.type === 'invoice' || tx.type === 'receipt' ? 'bg-emerald-50 text-emerald-600' : 
                        tx.type === 'return' || tx.type === 'payment' ? 'bg-emerald-50 text-emerald-600' : 
                        'bg-slate-50 text-slate-600'
                      }`}>
                        {tx.type === 'invoice' || tx.type === 'receipt' ? <TrendingUp size={20} /> : 
                         tx.type === 'return' || tx.type === 'payment' ? <TrendingUp size={20} className="rotate-180" /> :
                         <FileText size={20} />}
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 text-sm tracking-tight">{tx.customer_name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                            tx.type === 'invoice' ? 'bg-emerald-100 text-emerald-700' : 
                            tx.type === 'return' ? 'bg-emerald-100 text-emerald-700' : 
                            'bg-slate-100 text-slate-600'
                          }`}>
                            {tx.type === 'invoice' ? t('dashboard.invoice') : 
                             tx.type === 'return' ? t('dashboard.return') : 
                             tx.type === 'receipt' ? t('dashboard.receipt') : 
                             tx.type === 'payment' ? t('dashboard.payment') : 
                             t('dashboard.manual_journal')}
                          </span>
                          <span className="text-[9px] text-slate-400 font-bold font-mono">#{tx.number}</span>
                        </div>
                      </div>
                    </div>
                    <div className={`text-right ${dir === 'rtl' ? 'text-left' : 'text-right'}`}>
                      <p className={`font-bold text-sm tracking-tight ${tx.type === 'invoice' || tx.type === 'receipt' ? 'text-slate-900' : 'text-emerald-600'}`}>
                        {tx.type === 'invoice' || tx.type === 'receipt' ? '' : '-'}{formatMoney(tx.total_amount || 0)}
                      </p>
                      <p className="text-[9px] text-slate-400 font-bold uppercase mt-0.5">{formatDate(tx.date)}</p>
                    </div>
                  </motion.div>
                ))}
                {!stats?.recentTransactions.length && (
                  <div className="flex flex-col items-center justify-center py-20 opacity-20">
                    <FileText size={40} className="mb-4 text-slate-400" />
                    <p className="font-bold uppercase tracking-wider text-[10px] text-slate-400">{t('dashboard.no_recent')}</p>
                  </div>
                )}
              </div>

              <button className="w-full mt-4 py-3 bg-slate-50 hover:bg-slate-100 text-slate-400 rounded-xl font-bold uppercase tracking-wider text-[10px] transition-all">
                {t('dashboard.view_all')}
              </button>
            </div>
          </div>
        </>
      )}
    </motion.div>
  );
};
