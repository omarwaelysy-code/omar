import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  Trash2, 
  Settings, 
  Lock, 
  Unlock, 
  Eye, 
  EyeOff, 
  Copy, 
  Save, 
  Undo2, 
  Redo2, 
  ZoomIn, 
  ZoomOut, 
  FileDown, 
  FileUp, 
  RefreshCw, 
  Search, 
  Star, 
  Layout, 
  Smartphone, 
  Tablet as TabletIcon, 
  Laptop as LaptopIcon, 
  Monitor, 
  ChevronLeft, 
  ChevronRight, 
  HelpCircle,
  FileText,
  LineChart,
  BarChart2,
  PieChart as PieIcon,
  Table as TableIcon,
  Calendar as CalendarIcon,
  List,
  Bell,
  Sparkles,
  ArrowLeft
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigation } from '../contexts/NavigationContext';
import { useLanguage } from '../contexts/LanguageContext';
import { dbService } from '../services/dbService';
import { Dashboard, Widget, WidgetTypeDefinition } from '../types';
import { WIDGET_REGISTRY } from '../constants/widgets';

interface HistoryState {
  widgets: Widget[];
  dashboard: Dashboard;
}

export const DashboardBuilder: React.FC = () => {
  const { user } = useAuth();
  const { setCurrentPage } = useNavigation();
  const { t, dir, language } = useLanguage();
  
  // Dashboard & Widget States
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [selectedWidgetId, setSelectedWidgetId] = useState<string | null>(null);
  const [activePage, setActivePage] = useState<number>(0);
  const [pages, setPages] = useState<string[]>(['Main Page']);
  const [dataSources, setDataSources] = useState<{ [tableName: string]: string[] }>({});

  useEffect(() => {
    const fetchDataSources = async () => {
      try {
        const sources = await dbService.getWidgetDataSources();
        setDataSources(sources);
      } catch (err) {
        console.error('Failed to load data sources:', err);
      }
    };
    fetchDataSources();
  }, []);
  
  // UI Control States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [favorites, setFavorites] = useState<string[]>([]);
  const [devicePreview, setDevicePreview] = useState<'desktop' | 'laptop' | 'tablet' | 'mobile'>('desktop');
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [isLoading, setIsLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'dirty'>('saved');
  const [propertiesTab, setPropertiesTab] = useState<'general' | 'data' | 'display' | 'behavior' | 'visibility'>('general');
  
  // Drag, Resize, Snap State
  const canvasRef = useRef<HTMLDivElement>(null);
  const [draggedWidget, setDraggedWidget] = useState<Widget | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [resizingWidget, setResizingWidget] = useState<Widget | null>(null);
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, w: 0, h: 0 });
  
  // Undo/Redo History
  const [history, setHistory] = useState<HistoryState[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  // Widget Categories mapping
  const widgetCategories = [
    { id: 'all', nameAr: 'الكل', nameEn: 'All' },
    { id: 'kpi', nameAr: 'مؤشرات الأداء', nameEn: 'KPIs' },
    { id: 'charts', nameAr: 'المخططات البيانية', nameEn: 'Charts' },
    { id: 'tables', nameAr: 'الجداول والتقارير', nameEn: 'Tables & Lists' },
    { id: 'utilities', nameAr: 'أدوات مساعدة', nameEn: 'Utilities' }
  ];

  // Map widget type to category
  const getWidgetCategory = (type: string): string => {
    if (type.includes('kpi') || type === 'profit') return 'kpi';
    if (type.includes('chart') || type === 'cash_flow') return 'charts';
    if (type === 'table' || type === 'customers' || type === 'suppliers' || type === 'sales_summary' || type === 'inventory_summary') return 'tables';
    return 'utilities'; // calendar, notifications, recent_activities
  };

  const getFriendlyTableName = (name: string, lang: string) => {
    const mapping: { [key: string]: { ar: string, en: string } } = {
      invoices: { ar: 'فواتير المبيعات', en: 'Sales Invoices' },
      purchase_invoices: { ar: 'فواتير المشتريات', en: 'Purchase Invoices' },
      receipt_vouchers: { ar: 'سندات القبض', en: 'Receipt Vouchers' },
      payment_vouchers: { ar: 'سندات الصرف', en: 'Payment Vouchers' },
      products: { ar: 'المخزون والمنتجات', en: 'Inventory Stock' },
      customers: { ar: 'دفتر العملاء', en: 'Customers Ledger' },
      suppliers: { ar: 'دفتر الموردين', en: 'Suppliers Ledger' },
      journal_entries: { ar: 'قيود اليومية', en: 'Journal Entries' },
      accounts: { ar: 'شجرة الحسابات', en: 'Chart of Accounts' },
      employees: { ar: 'الموظفين', en: 'Employees' },
      attendance: { ar: 'الحضور والانصراف', en: 'Attendance' },
      payroll: { ar: 'الرواتب والأجور', en: 'Payroll' },
      assets: { ar: 'الأصول الثابتة', en: 'Fixed Assets' },
      operations: { ar: 'العمليات التشغيلية', en: 'Operations' }
    };
    if (mapping[name]) {
      return lang === 'ar' ? mapping[name].ar : mapping[name].en;
    }
    return name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  };

  // Get Widget Icons mapping
  const getWidgetIcon = (type: string) => {
    switch (type) {
      case 'kpi_card': return FileText;
      case 'line_chart': return LineChart;
      case 'bar_chart': return BarChart2;
      case 'pie_chart': return PieIcon;
      case 'area_chart': return LineChart;
      case 'table': return TableIcon;
      case 'calendar': return CalendarIcon;
      case 'recent_activities': return List;
      case 'notifications': return Bell;
      case 'profit': return Sparkles;
      default: return Layout;
    }
  };

  // Load Dashboard Data
  useEffect(() => {
    const loadDashboard = async () => {
      if (!user) return;
      try {
        setIsLoading(true);
        // Provision or fetch the default custom dashboard
        const data = await dbService.getOrCreateDefaultDashboard(user.company_id, user.id);
        
        // Parse pages from widget settings if any page exists, or create default
        let loadedPages = ['Main Page'];
        if (data.widgets && data.widgets.length > 0) {
          const pageIndices = data.widgets
            .map((w: any) => w.settings?.page || 0)
            .filter((val: number, idx: number, arr: number[]) => arr.indexOf(val) === idx)
            .sort();
          if (pageIndices.length > 0) {
            loadedPages = pageIndices.map((p: number) => `Page ${p + 1}`);
          }
        }

        setDashboard(data);
        setWidgets(data.widgets || []);
        setPages(loadedPages);
        
        // Initialize History
        const initialState = { widgets: data.widgets || [], dashboard: data };
        setHistory([initialState]);
        setHistoryIndex(0);
        setSaveStatus('saved');
      } catch (err) {
        console.error('Failed to load dashboard builder:', err);
      } finally {
        setIsLoading(false);
      }
    };
    loadDashboard();
  }, [user?.company_id, user?.id]);

  // Auto-Save Layout
  useEffect(() => {
    if (saveStatus !== 'dirty' || !dashboard) return;
    const saveTimer = setTimeout(() => {
      handleSave();
    }, 5000); // Save after 5 seconds of inactivity
    return () => clearTimeout(saveTimer);
  }, [saveStatus, widgets, dashboard]);

  // History state push helper
  const pushHistory = (newWidgets: Widget[], newDashboard?: Dashboard) => {
    const nextDashboard = newDashboard || dashboard!;
    const nextState = { widgets: newWidgets, dashboard: nextDashboard };
    const nextHistory = history.slice(0, historyIndex + 1);
    
    setHistory([...nextHistory, nextState]);
    setHistoryIndex(nextHistory.length);
    setSaveStatus('dirty');
  };

  // Grid Configuration based on device preview
  const getGridConfig = () => {
    switch (devicePreview) {
      case 'mobile': return { cols: 2, width: '380px', rowHeight: 80 };
      case 'tablet': return { cols: 6, width: '768px', rowHeight: 80 };
      case 'laptop': return { cols: 10, width: '1024px', rowHeight: 85 };
      default: return { cols: 12, width: '100%', rowHeight: 90 };
    }
  };

  const gridConfig = getGridConfig();

  // Undo / Redo
  const handleUndo = () => {
    if (historyIndex > 0) {
      const prevIndex = historyIndex - 1;
      const state = history[prevIndex];
      setWidgets(state.widgets);
      setDashboard(state.dashboard);
      setHistoryIndex(prevIndex);
      setSaveStatus('dirty');
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const nextIndex = historyIndex + 1;
      const state = history[nextIndex];
      setWidgets(state.widgets);
      setDashboard(state.dashboard);
      setHistoryIndex(nextIndex);
      setSaveStatus('dirty');
    }
  };

  // Manual save layout back to database
  const handleSave = async () => {
    if (!dashboard) return;
    try {
      setSaveStatus('saving');
      
      // Update Dashboard Header
      await dbService.update('dashboards', dashboard.id, {
        name: dashboard.name,
        description: dashboard.description,
        icon: dashboard.icon,
        is_default: dashboard.is_default
      });

      // Fetch existing database widgets to compare and sync
      const dbWidgets = await dbService.list<Widget>('widgets', { dashboard_id: dashboard.id });
      const dbWidgetIds = dbWidgets.map(w => w.id);
      const currentWidgetIds = widgets.map(w => w.id);

      // 1. Delete removed widgets
      const toDelete = dbWidgetIds.filter(id => !currentWidgetIds.includes(id));
      for (const id of toDelete) {
        await dbService.delete('widgets', id);
      }

      // 2. Insert or update current widgets
      for (const w of widgets) {
        const payload = {
          dashboard_id: w.dashboard_id,
          widget_type: w.widget_type,
          title: w.title,
          x: w.x,
          y: w.y,
          w: w.w,
          h: w.h,
          settings: w.settings,
          filters: w.filters,
          order: w.order,
          visible: w.visible,
          locked: w.locked
        };

        if (dbWidgetIds.includes(w.id)) {
          await dbService.update('widgets', w.id, payload);
        } else {
          await dbService.addWithId('widgets', w.id, payload);
        }
      }

      setSaveStatus('saved');
    } catch (err) {
      console.error('Failed to save dashboard layout:', err);
      setSaveStatus('dirty');
    }
  };

  // Add Widget
  const handleAddWidget = (def: WidgetTypeDefinition) => {
    if (!dashboard) return;
    const newWidget: Widget = {
      id: `w-${uuidv4()}`,
      dashboard_id: dashboard.id,
      widget_type: def.type,
      title: language === 'ar' ? def.nameAr : def.nameEn,
      x: 0,
      y: getNextAvailableRow(),
      w: Math.min(def.defaultW, gridConfig.cols),
      h: def.defaultH,
      settings: { page: activePage },
      filters: {},
      order: widgets.length,
      visible: true,
      locked: false
    };

    const newWidgets = [...widgets, newWidget];
    setWidgets(newWidgets);
    setSelectedWidgetId(newWidget.id);
    pushHistory(newWidgets);
  };

  // Helper to generate UUID inside client-side component
  const uuidv4 = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };

  // Finds next open row offset to place the newly added widget cleanly
  const getNextAvailableRow = (): number => {
    const pageWidgets = widgets.filter(w => (w.settings?.page || 0) === activePage);
    if (pageWidgets.length === 0) return 0;
    return Math.max(...pageWidgets.map(w => w.y + w.h));
  };

  // Duplicate Widget
  const handleDuplicateWidget = (w: Widget) => {
    const def = WIDGET_REGISTRY.find(item => item.type === w.widget_type);
    const newWidget: Widget = {
      ...w,
      id: `w-${uuidv4()}`,
      title: `${w.title} (${language === 'ar' ? 'نسخة' : 'Copy'})`,
      x: (w.x + w.w <= gridConfig.cols - w.w) ? w.x + w.w : 0,
      y: (w.x + w.w <= gridConfig.cols - w.w) ? w.y : getNextAvailableRow(),
      order: widgets.length
    };

    const newWidgets = [...widgets, newWidget];
    setWidgets(newWidgets);
    setSelectedWidgetId(newWidget.id);
    pushHistory(newWidgets);
  };

  // Delete Widget
  const handleDeleteWidget = (id: string) => {
    const newWidgets = widgets.filter(w => w.id !== id);
    setWidgets(newWidgets);
    if (selectedWidgetId === id) setSelectedWidgetId(null);
    pushHistory(newWidgets);
  };

  // Toggle lock widget
  const handleToggleLockWidget = (id: string) => {
    const newWidgets = widgets.map(w => w.id === id ? { ...w, locked: !w.locked } : w);
    setWidgets(newWidgets);
    pushHistory(newWidgets);
  };

  // Toggle visible widget
  const handleToggleVisibleWidget = (id: string) => {
    const newWidgets = widgets.map(w => w.id === id ? { ...w, visible: !w.visible } : w);
    setWidgets(newWidgets);
    pushHistory(newWidgets);
  };

  // Reset Layout back to default seeded templates
  const handleResetLayout = async () => {
    if (!dashboard) return;
    if (!window.confirm(language === 'ar' ? 'هل أنت متأكد من إعادة تعيين لوحة التحكم للوضع الافتراضي؟ سيتم مسح كافة التغييرات الخاصة بك.' : 'Are you sure you want to reset your dashboard layout? All your changes will be lost.')) return;
    try {
      setIsLoading(true);
      const data = await dbService.resetDashboard(dashboard.id, user?.company_id || '');
      setWidgets(data.widgets || []);
      pushHistory(data.widgets || []);
      setSaveStatus('saved');
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // Export Layout Configuration
  const handleExportLayout = async () => {
    if (!dashboard) return;
    try {
      const config = await dbService.exportDashboard(dashboard.id, user?.company_id || '');
      const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${dashboard.name.replace(/\s+/g, '_')}_layout.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
    }
  };

  // Import Layout Configuration
  const handleImportLayout = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!dashboard || !e.target.files?.[0]) return;
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const json = JSON.parse(evt.target?.result as string);
        if (!json.widgets) throw new Error('Invalid layout file');
        
        setIsLoading(true);
        const imported = await dbService.importDashboard(json, user?.company_id || '', user?.id || '');
        setDashboard(imported);
        setWidgets(imported.widgets || []);
        pushHistory(imported.widgets || [], imported);
        setSaveStatus('saved');
      } catch (err: any) {
        alert(language === 'ar' ? 'فشل استيراد التنسيق: ملف غير صالح' : `Failed to import layout: ${err.message}`);
      } finally {
        setIsLoading(false);
      }
    };
    reader.readAsText(file);
  };

  // Properties form value updates
  const handleUpdateWidgetProperty = (key: string, value: any) => {
    if (!selectedWidgetId) return;
    const newWidgets = widgets.map(w => {
      if (w.id !== selectedWidgetId) return w;
      if (key.startsWith('settings.')) {
        const subKey = key.split('.')[1];
        return {
          ...w,
          settings: { ...w.settings, [subKey]: value }
        };
      }
      if (key.startsWith('filters.')) {
        const subKey = key.split('.')[1];
        return {
          ...w,
          filters: { ...w.filters, [subKey]: value }
        };
      }
      return { ...w, [key]: value };
    });
    setWidgets(newWidgets);
    pushHistory(newWidgets);
  };

  // Duplicate entire dashboard layout as a template
  const handleSaveAsTemplate = async () => {
    if (!dashboard) return;
    const name = window.prompt(language === 'ar' ? 'أدخل اسم القالب الجديد:' : 'Enter new template name:', `${dashboard.name} Template`);
    if (!name) return;
    try {
      setIsLoading(true);
      await dbService.saveAsTemplate(dashboard.id, user?.company_id || '', name);
      alert(language === 'ar' ? 'تم حفظ التنسيق كقالب متاح للجميع بنجاح!' : 'Layout successfully saved as a template!');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Page Management
  const handleAddPage = () => {
    const newPageNum = pages.length;
    const newPageName = `Page ${newPageNum + 1}`;
    setPages([...pages, newPageName]);
    setActivePage(newPageNum);
  };

  const handleRenamePage = (idx: number) => {
    const currentName = pages[idx];
    const newName = window.prompt(language === 'ar' ? 'أدخل الاسم الجديد للصفحة:' : 'Enter new page name:', currentName);
    if (!newName) return;
    const newPages = [...pages];
    newPages[idx] = newName;
    setPages(newPages);
  };

  const handleDeletePage = (idx: number) => {
    if (pages.length <= 1) return;
    if (!window.confirm(language === 'ar' ? 'هل أنت متأكد من مسح هذه الصفحة وجميع محتوياتها من البطاقات؟' : 'Are you sure you want to delete this page and all its widgets?')) return;
    
    const newPages = pages.filter((_, i) => i !== idx);
    const newWidgets = widgets
      .filter(w => (w.settings?.page || 0) !== idx)
      .map(w => {
        const pageNum = w.settings?.page || 0;
        if (pageNum > idx) {
          return { ...w, settings: { ...w.settings, page: pageNum - 1 } };
        }
        return w;
      });

    setPages(newPages);
    setWidgets(newWidgets);
    pushHistory(newWidgets);
    setActivePage(Math.max(0, idx - 1));
  };

  // --- HTML5 Custom Drag and Drop Snapping Logic ---
  
  const handleDragStart = (e: React.DragEvent, w: Widget) => {
    if (w.locked) return;
    setDraggedWidget(w);
    
    // Calculate exact pixel offset of mouse relative to widget top-left
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
    
    // Create an invisible drag image or standard ghost
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!draggedWidget || !canvasRef.current) return;

    const canvasRect = canvasRef.current.getBoundingClientRect();
    const clientX = e.clientX - canvasRect.left - dragOffset.x;
    const clientY = e.clientY - canvasRect.top - dragOffset.y;

    // Convert pixel to grid index
    const colWidth = canvasRect.width / gridConfig.cols;
    let gridX = Math.round(clientX / colWidth);
    let gridY = Math.round(clientY / gridConfig.rowHeight);

    // Bounding checks
    gridX = Math.max(0, Math.min(gridX, gridConfig.cols - draggedWidget.w));
    gridY = Math.max(0, gridY);

    if (draggedWidget.x !== gridX || draggedWidget.y !== gridY) {
      const updatedWidgets = widgets.map(w => 
        w.id === draggedWidget.id ? { ...w, x: gridX, y: gridY } : w
      );
      setWidgets(updatedWidgets);
    }
  };

  const handleDragEnd = () => {
    if (draggedWidget) {
      pushHistory(widgets);
      setDraggedWidget(null);
    }
  };

  // --- Resize Handle mouse listeners ---
  
  const handleResizeStart = (e: React.MouseEvent, w: Widget) => {
    e.preventDefault();
    e.stopPropagation();
    if (w.locked) return;

    setResizingWidget(w);
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      w: w.w,
      h: w.h
    });

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

      setWidgets(prev => prev.map(item => 
        item.id === w.id ? { ...item, w: newW, h: newH } : item
      ));
    };

    const handleMouseUp = () => {
      pushHistory(widgets);
      setResizingWidget(null);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Filter Catalog widgets
  const filteredCatalog = WIDGET_REGISTRY.filter(def => {
    const matchesSearch = 
      def.nameEn.toLowerCase().includes(searchQuery.toLowerCase()) || 
      def.nameAr.includes(searchQuery) ||
      (def.description && def.description.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesCategory = selectedCategory === 'all' || getWidgetCategory(def.type) === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  const selectedWidget = widgets.find(w => w.id === selectedWidgetId);

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-slate-50 overflow-hidden font-sans">
      
      {/* 1. Designer Header/Toolbar */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between flex-shrink-0 z-20 shadow-sm">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setCurrentPage('dashboard')}
            className="p-2 text-slate-500 hover:text-slate-900 rounded-xl hover:bg-slate-50 border border-slate-100 transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-md font-bold text-slate-900 flex items-center gap-2">
              {dashboard?.name || 'Dashboard Visual Builder'}
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                saveStatus === 'saved' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                saveStatus === 'saving' ? 'bg-amber-50 text-amber-600 border border-amber-100 animate-pulse' :
                'bg-rose-50 text-rose-600 border border-rose-100'
              }`}>
                {saveStatus === 'saved' ? (language === 'ar' ? 'تم الحفظ' : 'Saved') :
                 saveStatus === 'saving' ? (language === 'ar' ? 'جاري الحفظ...' : 'Saving...') :
                 (language === 'ar' ? 'تغييرات غير محفوظة' : 'Unsaved Changes')}
              </span>
            </h1>
            <p className="text-slate-400 text-xs mt-0.5">{dashboard?.description || 'Custom dashboard visual manager'}</p>
          </div>
        </div>

        {/* Toolbar Controls */}
        <div className="flex items-center gap-2">
          {/* Undo/Redo */}
          <div className="flex items-center border border-slate-200 rounded-xl bg-slate-50 p-0.5">
            <button 
              disabled={historyIndex <= 0}
              onClick={handleUndo}
              className="p-1.5 text-slate-500 hover:text-slate-900 disabled:opacity-40 disabled:hover:text-slate-500 rounded-lg hover:bg-white transition-all"
              title="Undo (Ctrl+Z)"
            >
              <Undo2 size={16} />
            </button>
            <button 
              disabled={historyIndex >= history.length - 1}
              onClick={handleRedo}
              className="p-1.5 text-slate-500 hover:text-slate-900 disabled:opacity-40 disabled:hover:text-slate-500 rounded-lg hover:bg-white transition-all"
              title="Redo (Ctrl+Y)"
            >
              <Redo2 size={16} />
            </button>
          </div>

          {/* Zoom */}
          <div className="flex items-center border border-slate-200 rounded-xl bg-slate-50 p-0.5">
            <button 
              onClick={() => setZoomLevel(prev => Math.max(50, prev - 10))}
              className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-white transition-all"
            >
              <ZoomOut size={16} />
            </button>
            <span className="text-[10px] font-bold text-slate-600 px-1 min-w-[36px] text-center">{zoomLevel}%</span>
            <button 
              onClick={() => setZoomLevel(prev => Math.min(150, prev + 10))}
              className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-white transition-all"
            >
              <ZoomIn size={16} />
            </button>
          </div>

          {/* Device Preview Sizer */}
          <div className="flex items-center border border-slate-200 rounded-xl bg-slate-50 p-0.5">
            <button 
              onClick={() => setDevicePreview('desktop')}
              className={`p-1.5 rounded-lg transition-all ${devicePreview === 'desktop' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
              title="Desktop Layout (12 Cols)"
            >
              <Monitor size={16} />
            </button>
            <button 
              onClick={() => setDevicePreview('laptop')}
              className={`p-1.5 rounded-lg transition-all ${devicePreview === 'laptop' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
              title="Laptop Layout (10 Cols)"
            >
              <LaptopIcon size={16} />
            </button>
            <button 
              onClick={() => setDevicePreview('tablet')}
              className={`p-1.5 rounded-lg transition-all ${devicePreview === 'tablet' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
              title="Tablet Layout (6 Cols)"
            >
              <TabletIcon size={16} />
            </button>
            <button 
              onClick={() => setDevicePreview('mobile')}
              className={`p-1.5 rounded-lg transition-all ${devicePreview === 'mobile' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
              title="Mobile Layout (2 Cols)"
            >
              <Smartphone size={16} />
            </button>
          </div>

          {/* Action buttons */}
          <div className="h-6 w-px bg-slate-200 mx-1" />

          <button 
            onClick={handleSave}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-sm shadow-indigo-200"
          >
            <Save size={14} />
            {language === 'ar' ? 'حفظ يدوي' : 'Save'}
          </button>
          
          <button 
            onClick={handleSaveAsTemplate}
            className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all bg-white"
          >
            <Copy size={14} />
            {language === 'ar' ? 'حفظ كقالب' : 'Save as Template'}
          </button>

          <button 
            onClick={handleExportLayout}
            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-all"
            title={language === 'ar' ? 'تصدير التنسيق' : 'Export Layout'}
          >
            <FileDown size={16} />
          </button>

          <label className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg cursor-pointer transition-all" title={language === 'ar' ? 'استيراد التنسيق' : 'Import Layout'}>
            <FileUp size={16} />
            <input type="file" accept=".json" onChange={handleImportLayout} className="hidden" />
          </label>

          <button 
            onClick={handleResetLayout}
            className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-all"
            title={language === 'ar' ? 'إعادة ضبط' : 'Reset Defaults'}
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* 2. Main Three-Panel Workspace Layout */}
      <div className="flex flex-1 overflow-hidden relative">
        
        {/* Left Panel: Widget Properties Panel */}
        <div className="w-80 bg-white border-r border-slate-200 flex flex-col flex-shrink-0 z-10 shadow-sm overflow-y-auto">
          {selectedWidget ? (
            <div className="flex flex-col h-full">
              {/* Properties Header */}
              <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">{language === 'ar' ? 'خصائص البطاقة' : 'Widget Properties'}</h3>
                  <span className="text-[10px] text-indigo-600 font-semibold">{selectedWidget.widget_type.toUpperCase()}</span>
                </div>
                <button 
                  onClick={() => setSelectedWidgetId(null)}
                  className="text-xs text-slate-400 hover:text-slate-700"
                >
                  {language === 'ar' ? 'إلغاء التحديد' : 'Deselect'}
                </button>
              </div>

              {/* Property Tabs */}
              <div className="flex border-b border-slate-100 overflow-x-auto scrollbar-none flex-shrink-0 bg-slate-50/30">
                {(['general', 'data', 'display', 'behavior', 'visibility'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setPropertiesTab(tab)}
                    className={`px-3 py-2 text-xs font-bold whitespace-nowrap transition-all border-b-2 flex-1 text-center ${
                      propertiesTab === tab ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-700'
                    }`}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                ))}
              </div>

              {/* Properties Form Body */}
              <div className="p-4 flex-1 space-y-4">
                
                {/* A. General Settings */}
                {propertiesTab === 'general' && (
                  <>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{language === 'ar' ? 'العنوان' : 'Title'}</label>
                      <input 
                        type="text"
                        value={selectedWidget.title}
                        onChange={(e) => handleUpdateWidgetProperty('title', e.target.value)}
                        className="w-full text-xs border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-indigo-500 focus:outline-none bg-white text-slate-800 font-medium"
                      />
                    </div>
                    {selectedWidget.widget_type === 'text' && (
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{language === 'ar' ? 'محتوى النص' : 'Text Content'}</label>
                        <textarea 
                          rows={4}
                          value={selectedWidget.settings?.text || ''}
                          onChange={(e) => handleUpdateWidgetProperty('settings.text', e.target.value)}
                          className="w-full text-xs border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-indigo-500 focus:outline-none bg-white text-slate-800 font-medium"
                        />
                      </div>
                    )}
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{language === 'ar' ? 'شرح ووصف' : 'Description'}</label>
                      <textarea 
                        rows={3}
                        value={selectedWidget.settings?.description || ''}
                        onChange={(e) => handleUpdateWidgetProperty('settings.description', e.target.value)}
                        className="w-full text-xs border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-indigo-500 focus:outline-none bg-white text-slate-800 font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{language === 'ar' ? 'اللون الخلفي' : 'Background Color'}</label>
                      <select 
                        value={selectedWidget.settings?.bgColor || 'bg-white'}
                        onChange={(e) => handleUpdateWidgetProperty('settings.bgColor', e.target.value)}
                        className="w-full text-xs border border-slate-200 rounded-lg p-2 bg-white text-slate-800 font-medium"
                      >
                        <option value="bg-white">White</option>
                        <option value="bg-slate-50 border-slate-200">Slate Gray</option>
                        <option value="bg-indigo-50/50 border-indigo-100">Light Indigo</option>
                        <option value="bg-emerald-50/50 border-emerald-100">Light Emerald</option>
                        <option value="bg-amber-50/50 border-amber-100">Light Amber</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{language === 'ar' ? 'حجم الزاوية (انحناء)' : 'Border Radius'}</label>
                      <select 
                        value={selectedWidget.settings?.borderRadius || 'rounded-2xl'}
                        onChange={(e) => handleUpdateWidgetProperty('settings.borderRadius', e.target.value)}
                        className="w-full text-xs border border-slate-200 rounded-lg p-2 bg-white text-slate-800 font-medium"
                      >
                        <option value="rounded-none">None (Sharp)</option>
                        <option value="rounded-lg">Small (lg)</option>
                        <option value="rounded-2xl">Medium (2xl)</option>
                        <option value="rounded-3xl">Large (3xl)</option>
                      </select>
                    </div>
                  </>
                )}

                {/* B. Data Source & Filtering */}
                {propertiesTab === 'data' && (
                  <>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{language === 'ar' ? 'مصدر البيانات' : 'Data Source'}</label>
                      <select 
                        value={selectedWidget.settings?.dataSource || ''}
                        onChange={(e) => {
                          const table = e.target.value;
                          handleUpdateWidgetProperty('settings.dataSource', table);
                          handleUpdateWidgetProperty('settings.fields', []);
                          handleUpdateWidgetProperty('settings.grouping', []);
                          handleUpdateWidgetProperty('settings.aggregation', {});
                        }}
                        className="w-full text-xs border border-slate-200 rounded-lg p-2 bg-white text-slate-800 font-medium capitalize"
                      >
                        <option value="">-- Choose Data Source --</option>
                        {Object.keys(dataSources).map(table => (
                          <option key={table} value={table}>{getFriendlyTableName(table, language)}</option>
                        ))}
                      </select>
                    </div>

                    {selectedWidget.settings?.dataSource && dataSources[selectedWidget.settings.dataSource] && (
                      <>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{language === 'ar' ? 'الحقول المختارة' : 'Selected Fields'}</label>
                          <div className="border border-slate-200 rounded-lg p-2 max-h-32 overflow-y-auto bg-slate-50 space-y-1">
                            {dataSources[selectedWidget.settings.dataSource].map(col => {
                              const isChecked = (selectedWidget.settings?.fields || []).includes(col);
                              return (
                                <label key={col} className="flex items-center gap-2 text-xs text-slate-700 font-medium cursor-pointer">
                                  <input 
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={(e) => {
                                      const currentFields = selectedWidget.settings?.fields || [];
                                      const newFields = e.target.checked 
                                        ? [...currentFields, col]
                                        : currentFields.filter((f: string) => f !== col);
                                      handleUpdateWidgetProperty('settings.fields', newFields);
                                    }}
                                    className="h-3.5 w-3.5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                                  />
                                  {col}
                                </label>
                              );
                            })}
                          </div>
                        </div>

                        <div className="border border-slate-100 rounded-xl p-3 bg-slate-50/50 space-y-3">
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">{language === 'ar' ? 'العمليات الحسابية' : 'Aggregations & Math'}</span>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[9px] font-bold text-slate-400 mb-1">Type</label>
                              <select 
                                value={selectedWidget.settings?.aggregation?.type || ''}
                                onChange={(e) => {
                                  const currentAgg = selectedWidget.settings?.aggregation || {};
                                  handleUpdateWidgetProperty('settings.aggregation', { ...currentAgg, type: e.target.value });
                                }}
                                className="w-full text-[11px] border border-slate-200 rounded-lg p-1.5 bg-white text-slate-800 font-medium"
                              >
                                <option value="">None (Raw)</option>
                                <option value="SUM">SUM</option>
                                <option value="COUNT">COUNT</option>
                                <option value="AVG">AVG</option>
                                <option value="MIN">MIN</option>
                                <option value="MAX">MAX</option>
                                <option value="DISTINCT">DISTINCT</option>
                                <option value="RUNNING_TOTAL">Running Total</option>
                                <option value="GROWTH">Growth %</option>
                                <option value="COMPARISON">Comparison</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-[9px] font-bold text-slate-400 mb-1">Column</label>
                              <select 
                                value={selectedWidget.settings?.aggregation?.field || ''}
                                onChange={(e) => {
                                  const currentAgg = selectedWidget.settings?.aggregation || {};
                                  handleUpdateWidgetProperty('settings.aggregation', { ...currentAgg, field: e.target.value });
                                }}
                                className="w-full text-[11px] border border-slate-200 rounded-lg p-1.5 bg-white text-slate-800 font-medium"
                              >
                                <option value="">-- Choose Col --</option>
                                {dataSources[selectedWidget.settings.dataSource].map(col => (
                                  <option key={col} value={col}>{col}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{language === 'ar' ? 'تجميع حسب' : 'Group By'}</label>
                            <select 
                              value={selectedWidget.settings?.grouping?.[0] || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                handleUpdateWidgetProperty('settings.grouping', val ? [val] : []);
                              }}
                              className="w-full text-xs border border-slate-200 rounded-lg p-2 bg-white text-slate-800 font-medium"
                            >
                              <option value="">None</option>
                              {dataSources[selectedWidget.settings.dataSource].map(col => (
                                <option key={col} value={col}>{col}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{language === 'ar' ? 'ترتيب حسب' : 'Sort By'}</label>
                            <select 
                              value={selectedWidget.settings?.sorting?.field || ''}
                              onChange={(e) => {
                                const currentSort = selectedWidget.settings?.sorting || {};
                                handleUpdateWidgetProperty('settings.sorting', { ...currentSort, field: e.target.value });
                              }}
                              className="w-full text-xs border border-slate-200 rounded-lg p-2 bg-white text-slate-800 font-medium"
                            >
                              <option value="">None</option>
                              {dataSources[selectedWidget.settings.dataSource].map(col => (
                                <option key={col} value={col}>{col}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {selectedWidget.settings?.sorting?.field && (
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Sort Direction</label>
                            <select 
                              value={selectedWidget.settings?.sorting?.order || 'ASC'}
                              onChange={(e) => {
                                const currentSort = selectedWidget.settings?.sorting || {};
                                handleUpdateWidgetProperty('settings.sorting', { ...currentSort, order: e.target.value });
                              }}
                              className="w-full text-xs border border-slate-200 rounded-lg p-2 bg-white text-slate-800 font-medium"
                            >
                              <option value="ASC">Ascending (A-Z)</option>
                              <option value="DESC">Descending (Z-A)</option>
                            </select>
                          </div>
                        )}
                      </>
                    )}

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{language === 'ar' ? 'الفترة الزمنية' : 'Date Range'}</label>
                      <select 
                        value={selectedWidget.filters?.dateRange || 'this_month'}
                        onChange={(e) => handleUpdateWidgetProperty('filters.dateRange', e.target.value)}
                        className="w-full text-xs border border-slate-200 rounded-lg p-2 bg-white text-slate-800 font-medium"
                      >
                        <option value="today">Today</option>
                        <option value="this_week">This Week</option>
                        <option value="this_month">This Month</option>
                        <option value="last_30_days">Last 30 Days</option>
                        <option value="this_year">This Year</option>
                        <option value="all_time">All Time</option>
                      </select>
                    </div>

                    {selectedWidget.settings?.dataSource && dataSources[selectedWidget.settings.dataSource] && (
                      <div className="border-t border-slate-100 pt-3 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{language === 'ar' ? 'فلاتر مخصصة' : 'Custom Filters'}</span>
                          <button
                            type="button"
                            onClick={() => {
                              const currentCustom = selectedWidget.filters?.custom || [];
                              const newFilter = { field: dataSources[selectedWidget.settings.dataSource][0], operator: '=', value: '' };
                              handleUpdateWidgetProperty('filters.custom', [...currentCustom, newFilter]);
                            }}
                            className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                          >
                            <Plus size={10} /> Add Filter
                          </button>
                        </div>

                        <div className="space-y-2">
                          {(selectedWidget.filters?.custom || []).map((filter: any, idx: number) => (
                            <div key={idx} className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 p-2 rounded-lg relative group">
                              <div className="flex-1 space-y-1.5">
                                <select
                                  value={filter.field || ''}
                                  onChange={(e) => {
                                    const currentCustom = [...(selectedWidget.filters?.custom || [])];
                                    currentCustom[idx] = { ...currentCustom[idx], field: e.target.value };
                                    handleUpdateWidgetProperty('filters.custom', currentCustom);
                                  }}
                                  className="w-full text-[10px] border border-slate-200 rounded p-1 bg-white text-slate-800 font-semibold"
                                >
                                  {dataSources[selectedWidget.settings.dataSource].map(col => (
                                    <option key={col} value={col}>{col}</option>
                                  ))}
                                </select>
                                <div className="flex gap-1">
                                  <select
                                    value={filter.operator || '='}
                                    onChange={(e) => {
                                      const currentCustom = [...(selectedWidget.filters?.custom || [])];
                                      currentCustom[idx] = { ...currentCustom[idx], operator: e.target.value };
                                      handleUpdateWidgetProperty('filters.custom', currentCustom);
                                    }}
                                    className="w-16 text-[10px] border border-slate-200 rounded p-1 bg-white text-slate-800 font-semibold shrink-0"
                                  >
                                    <option value="=">=</option>
                                    <option value="!=">&ne;</option>
                                    <option value=">">&gt;</option>
                                    <option value=">=">&ge;</option>
                                    <option value="<">&lt;</option>
                                    <option value="<=">&le;</option>
                                    <option value="contains">Like</option>
                                  </select>
                                  <input
                                    type="text"
                                    placeholder="Value"
                                    value={filter.value || ''}
                                    onChange={(e) => {
                                      const currentCustom = [...(selectedWidget.filters?.custom || [])];
                                      currentCustom[idx] = { ...currentCustom[idx], value: e.target.value };
                                      handleUpdateWidgetProperty('filters.custom', currentCustom);
                                    }}
                                    className="flex-1 text-[10px] border border-slate-200 rounded p-1 bg-white text-slate-800 font-semibold"
                                  />
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  const currentCustom = selectedWidget.filters?.custom || [];
                                  const newCustom = currentCustom.filter((_: any, i: number) => i !== idx);
                                  handleUpdateWidgetProperty('filters.custom', newCustom);
                                }}
                                className="text-rose-500 hover:text-rose-700 p-1 rounded shrink-0 self-center"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          ))}
                          {(!selectedWidget.filters?.custom || selectedWidget.filters.custom.length === 0) && (
                            <p className="text-[9px] text-slate-400 text-center py-1">No custom filters configured.</p>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* C. Display / Styling settings */}
                {propertiesTab === 'display' && (
                  <>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{language === 'ar' ? 'نوع الرسم التخطيطي' : 'Chart Display Type'}</label>
                      <select 
                        value={selectedWidget.settings?.chartType || 'line'}
                        onChange={(e) => handleUpdateWidgetProperty('settings.chartType', e.target.value)}
                        className="w-full text-xs border border-slate-200 rounded-lg p-2 bg-white text-slate-800 font-medium"
                      >
                        <option value="line">Line Chart</option>
                        <option value="bar">Bar Chart</option>
                        <option value="area">Area Chart</option>
                        <option value="pie">Pie Chart</option>
                        <option value="donut">Donut Chart</option>
                        <option value="radar">Radar Chart</option>
                        <option value="scatter">Scatter Plot</option>
                        <option value="heatmap">Heatmap</option>
                        <option value="gauge">Gauge Meter</option>
                        <option value="kpi_card">KPI Card</option>
                        <option value="table">Data Table</option>
                        <option value="pivot">Pivot Table</option>
                      </select>
                    </div>
                    <div className="flex items-center justify-between py-1">
                      <span className="text-xs text-slate-600 font-medium">{language === 'ar' ? 'إظهار وسيلة الإيضاح' : 'Show Legend'}</span>
                      <input 
                        type="checkbox"
                        checked={selectedWidget.settings?.showLegend !== false}
                        onChange={(e) => handleUpdateWidgetProperty('settings.showLegend', e.target.checked)}
                        className="h-4 w-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                      />
                    </div>
                    <div className="flex items-center justify-between py-1">
                      <span className="text-xs text-slate-600 font-medium">{language === 'ar' ? 'إظهار التسميات' : 'Show Grid Labels'}</span>
                      <input 
                        type="checkbox"
                        checked={selectedWidget.settings?.showLabels !== false}
                        onChange={(e) => handleUpdateWidgetProperty('settings.showLabels', e.target.checked)}
                        className="h-4 w-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                      />
                    </div>
                  </>
                )}

                {/* D. Refresh & Auto polling Behaviors */}
                {propertiesTab === 'behavior' && (
                  <>
                    <div className="flex items-center justify-between py-1">
                      <span className="text-xs text-slate-600 font-medium">{language === 'ar' ? 'تحديث تلقائي' : 'Auto Refresh Data'}</span>
                      <input 
                        type="checkbox"
                        checked={selectedWidget.settings?.autoRefresh === true}
                        onChange={(e) => handleUpdateWidgetProperty('settings.autoRefresh', e.target.checked)}
                        className="h-4 w-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{language === 'ar' ? 'معدل التحديث (ثانية)' : 'Refresh Rate (Seconds)'}</label>
                      <input 
                        type="number"
                        min={10}
                        value={selectedWidget.settings?.refreshInterval || 60}
                        onChange={(e) => handleUpdateWidgetProperty('settings.refreshInterval', parseInt(e.target.value, 10))}
                        className="w-full text-xs border border-slate-200 rounded-lg p-2 bg-white text-slate-800 font-medium"
                      />
                    </div>
                  </>
                )}

                {/* E. Visibility, Locking, Hidden */}
                {propertiesTab === 'visibility' && (
                  <>
                    <div className="flex items-center justify-between py-2 border-b border-slate-50">
                      <div>
                        <span className="text-xs text-slate-700 font-semibold block">{language === 'ar' ? 'قفل العنصر' : 'Lock Widget'}</span>
                        <span className="text-[10px] text-slate-400 block">Prevents moving or resizing.</span>
                      </div>
                      <button 
                        onClick={() => handleToggleLockWidget(selectedWidget.id)}
                        className={`p-2 rounded-xl border transition-all ${
                          selectedWidget.locked 
                            ? 'bg-rose-50 border-rose-100 text-rose-600' 
                            : 'bg-slate-50 border-slate-100 text-slate-500 hover:text-slate-900'
                        }`}
                      >
                        {selectedWidget.locked ? <Lock size={16} /> : <Unlock size={16} />}
                      </button>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-slate-50">
                      <div>
                        <span className="text-xs text-slate-700 font-semibold block">{language === 'ar' ? 'إخفاء العنصر' : 'Hide Widget'}</span>
                        <span className="text-[10px] text-slate-400 block">Hides widget from non-admin dashboard view.</span>
                      </div>
                      <button 
                        onClick={() => handleToggleVisibleWidget(selectedWidget.id)}
                        className={`p-2 rounded-xl border transition-all ${
                          !selectedWidget.visible 
                            ? 'bg-amber-50 border-amber-100 text-amber-600' 
                            : 'bg-slate-50 border-slate-100 text-slate-500 hover:text-slate-900'
                        }`}
                      >
                        {!selectedWidget.visible ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </>
                )}

              </div>

              {/* Properties Footer */}
              <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex-shrink-0 flex items-center justify-between">
                <button
                  onClick={() => handleDuplicateWidget(selectedWidget)}
                  className="px-3 py-1.5 border border-slate-200 hover:bg-white text-slate-700 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all bg-slate-50"
                >
                  <Copy size={13} />
                  {language === 'ar' ? 'تكرار' : 'Duplicate'}
                </button>
                <button
                  onClick={() => handleDeleteWidget(selectedWidget.id)}
                  className="px-3 py-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-100 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all"
                >
                  <Trash2 size={13} />
                  {language === 'ar' ? 'حذف' : 'Remove'}
                </button>
              </div>
            </div>
          ) : (
            // Dashboard settings view if no widget selected
            <div className="p-5 flex flex-col gap-5 h-full">
              <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{language === 'ar' ? 'خصائص اللوحة' : 'Dashboard Properties'}</h3>
                <h2 className="text-sm font-bold text-slate-800">{dashboard?.name || 'Dashboard'}</h2>
              </div>
              <hr className="border-slate-100" />
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{language === 'ar' ? 'اسم اللوحة' : 'Dashboard Name'}</label>
                  <input 
                    type="text"
                    value={dashboard?.name || ''}
                    onChange={(e) => setDashboard(prev => prev ? { ...prev, name: e.target.value } : null)}
                    className="w-full text-xs border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-indigo-500 focus:outline-none bg-white text-slate-800 font-medium"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{language === 'ar' ? 'وصف تفصيلي' : 'Detailed Description'}</label>
                  <textarea 
                    rows={3}
                    value={dashboard?.description || ''}
                    onChange={(e) => setDashboard(prev => prev ? { ...prev, description: e.target.value } : null)}
                    className="w-full text-xs border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-indigo-500 focus:outline-none bg-white text-slate-800 font-medium"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-600 font-medium">{language === 'ar' ? 'لوحة التحكم الرئيسية' : 'Default Dashboard'}</span>
                  <input 
                    type="checkbox"
                    checked={dashboard?.is_default === true}
                    onChange={(e) => setDashboard(prev => prev ? { ...prev, is_default: e.target.checked } : null)}
                    className="h-4 w-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Design instructions */}
              <div className="mt-auto p-4 bg-indigo-50/50 border border-indigo-100/50 rounded-2xl">
                <h4 className="text-xs font-bold text-indigo-900 flex items-center gap-1.5 mb-1.5">
                  <HelpCircle size={14} className="text-indigo-600" />
                  {language === 'ar' ? 'كيفية التصميم' : 'Design Instructions'}
                </h4>
                <ul className="text-[10px] text-indigo-700/80 leading-relaxed list-disc list-inside space-y-1">
                  <li>{language === 'ar' ? 'اضغط على البطاقات في اللوحة لتعديل خصائصها' : 'Click on widgets on the canvas to configure properties.'}</li>
                  <li>{language === 'ar' ? 'اضغط على رمز الإضافة في القائمة الجانبية لإضافة بطاقة جديدة' : 'Click the plus icon on widgets in the right library to add.'}</li>
                  <li>{language === 'ar' ? 'اسحب البطاقة من المقبض العلوي لنقلها' : 'Drag widgets from their headers to reposition.'}</li>
                  <li>{language === 'ar' ? 'اسحب زاوية البطاقة السفلية لتغيير حجمها' : 'Drag the bottom-right handle to resize widgets.'}</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Center Panel: Dashboard Grid Canvas */}
        <div className="flex-1 overflow-auto flex flex-col h-full bg-slate-100">
          
          {/* Canvas Pages Tab Bar */}
          <div className="bg-white border-b border-slate-200 px-6 py-2 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-1">
              {pages.map((pName, idx) => (
                <div key={idx} className="flex items-center group">
                  <button
                    onClick={() => setActivePage(idx)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                      activePage === idx 
                        ? 'bg-indigo-50 text-indigo-600 border border-indigo-100 shadow-sm shadow-indigo-50/50' 
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {pName}
                  </button>
                  {activePage === idx && (
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
              {devicePreview.toUpperCase()} MODE &bull; {gridConfig.cols} COLUMNS
            </div>
          </div>

          {/* Canvas Scrollable Wrapper */}
          <div className="flex-1 p-8 flex items-start justify-center overflow-auto min-h-0">
            {isLoading ? (
              <div className="m-auto flex flex-col items-center gap-2">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
                <span className="text-xs text-slate-500 font-bold">Loading layout canvas...</span>
              </div>
            ) : (
              <div 
                style={{ 
                  width: gridConfig.width,
                  transform: `scale(${zoomLevel / 100})`,
                  transformOrigin: 'top center',
                  transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                }}
                className="bg-white border border-slate-200 shadow-xl rounded-3xl relative p-6 flex-shrink-0 select-none transition-all"
              >
                {/* Grid Dots Overlay inside Canvas */}
                <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none opacity-[0.03]"
                  style={{
                    backgroundImage: `radial-gradient(circle, #000 1px, transparent 1px)`,
                    backgroundSize: `calc(100% / ${gridConfig.cols}) ${gridConfig.rowHeight}px`
                  }}
                />

                {/* Widgets Grid Container */}
                <div 
                  ref={canvasRef}
                  onDragOver={handleDragOver}
                  className="relative w-full transition-all"
                  style={{ 
                    // Calculate container height dynamically based on widgets present
                    height: `${Math.max(6, getNextAvailableRow()) * gridConfig.rowHeight}px`,
                    minHeight: '400px'
                  }}
                >
                  {widgets
                    .filter(w => (w.settings?.page || 0) === activePage)
                    .map(w => {
                      const isSelected = selectedWidgetId === w.id;
                      const colWidthPct = 100 / gridConfig.cols;
                      
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
                          style={{
                            left: `${w.x * colWidthPct}%`,
                            width: `${w.w * colWidthPct}%`,
                            top: `${w.y * gridConfig.rowHeight}px`,
                            height: `${w.h * gridConfig.rowHeight}px`,
                            padding: '4px',
                            cursor: w.locked ? 'pointer' : 'grab',
                            zIndex: isSelected ? 10 : 1
                          }}
                          className="absolute transition-all duration-75 select-none"
                        >
                          <div className={`w-full h-full rounded-2xl border flex flex-col p-4 relative overflow-hidden transition-all group ${
                            isSelected 
                              ? 'bg-white border-indigo-600 shadow-lg shadow-indigo-100/50 ring-1 ring-indigo-600' 
                              : `${w.settings?.bgColor || 'bg-white'} border-slate-200 hover:border-slate-300 hover:shadow-sm`
                          } ${!w.visible ? 'opacity-50 border-dashed' : ''}`}>
                            
                            {/* Widget Hover Actions Overlay Header */}
                            <div className="flex items-center justify-between mb-2 relative z-10">
                              <div className="flex items-center gap-1.5 overflow-hidden">
                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider truncate max-w-[120px]">
                                  {w.title}
                                </span>
                              </div>
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                                <button 
                                  onClick={(e) => { e.stopPropagation(); handleToggleLockWidget(w.id); }}
                                  className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-50"
                                >
                                  {w.locked ? <Lock size={12} /> : <Unlock size={12} />}
                                </button>
                                <button 
                                  onClick={(e) => { e.stopPropagation(); handleToggleVisibleWidget(w.id); }}
                                  className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-50"
                                >
                                  {!w.visible ? <EyeOff size={12} /> : <Eye size={12} />}
                                </button>
                                <button 
                                  onClick={(e) => { e.stopPropagation(); handleDeleteWidget(w.id); }}
                                  className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </div>

                            {/* Dummy widget preview content rendering inside builder */}
                            <div className="flex-1 flex flex-col items-center justify-center relative z-10 border border-slate-100 border-dashed rounded-xl bg-slate-50/50 p-2">
                              {React.createElement(getWidgetIcon(w.widget_type), {
                                size: 24,
                                className: 'text-slate-400 mb-1.5'
                              })}
                              <span className="text-[10px] font-bold text-slate-500 text-center uppercase tracking-wide truncate max-w-full">
                                {w.widget_type.replace(/_/g, ' ')}
                              </span>
                              {w.settings?.dataSource && (
                                <span className="text-[9px] text-indigo-500 font-semibold mt-0.5">
                                  Src: {w.settings.dataSource}
                                </span>
                              )}
                            </div>

                            {/* Snapping Resize Handle in bottom right */}
                            {!w.locked && (
                              <div 
                                onMouseDown={(e) => handleResizeStart(e, w)}
                                className="absolute bottom-1 right-1 w-3 h-3 cursor-se-resize flex items-center justify-center opacity-40 hover:opacity-100"
                              >
                                <svg width="8" height="8" viewBox="0 0 8 8" className="text-slate-600">
                                  <path d="M6 0 L8 0 L8 8 L0 8 L0 6 L6 6 Z" fill="currentColor" />
                                </svg>
                              </div>
                            )}

                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel: Widget Catalog Library */}
        <div className="w-80 bg-white border-l border-slate-200 flex flex-col flex-shrink-0 z-10 shadow-sm">
          
          {/* Catalog Search & Filters */}
          <div className="p-4 border-b border-slate-200 space-y-3 flex-shrink-0 bg-slate-50/50">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">{language === 'ar' ? 'مكتبة البطاقات' : 'Widget Library'}</h3>
            
            {/* Search */}
            <div className="relative">
              <input 
                type="text"
                placeholder={language === 'ar' ? 'بحث عن بطاقة...' : 'Search widgets...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs border border-slate-200 rounded-xl pl-8 pr-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 font-medium"
              />
              <Search className="absolute left-2.5 top-2.5 text-slate-400" size={14} />
            </div>

            {/* Category selection */}
            <div className="flex gap-1 overflow-x-auto scrollbar-none py-1">
              {widgetCategories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-2 py-1 text-[10px] font-bold rounded-lg whitespace-nowrap transition-all border ${
                    selectedCategory === cat.id 
                      ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm' 
                      : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {language === 'ar' ? cat.nameAr : cat.nameEn}
                </button>
              ))}
            </div>
          </div>

          {/* Catalog List Scroll area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {filteredCatalog.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs">
                {language === 'ar' ? 'لا توجد نتائج مطابقة' : 'No widgets match search'}
              </div>
            ) : (
              filteredCatalog.map(def => {
                const isFavorite = favorites.includes(def.type);
                const IconComponent = getWidgetIcon(def.type);
                
                return (
                  <div
                    key={def.type}
                    className="p-3 bg-white border border-slate-200 hover:border-slate-300 rounded-2xl flex items-start justify-between group transition-all"
                  >
                    <div className="flex items-start gap-3 overflow-hidden">
                      <div className="p-2 rounded-xl bg-slate-50 border border-slate-100 flex-shrink-0">
                        <IconComponent size={18} className="text-slate-500" />
                      </div>
                      <div className="overflow-hidden">
                        <h4 className="text-xs font-bold text-slate-800 leading-tight truncate">
                          {language === 'ar' ? def.nameAr : def.nameEn}
                        </h4>
                        <p className="text-[9px] text-slate-400 mt-0.5 leading-snug line-clamp-2">
                          {def.description || 'Customizable layout widgets'}
                        </p>
                        <span className="inline-block text-[8px] bg-slate-100 text-slate-500 font-bold px-1.5 py-0.5 rounded-full mt-1.5">
                          {def.defaultW}x{def.defaultH} Default
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0 ml-2">
                      <button 
                        onClick={() => {
                          setFavorites(prev => 
                            isFavorite ? prev.filter(f => f !== def.type) : [...prev, def.type]
                          );
                        }}
                        className={`text-slate-300 hover:text-amber-500 transition-colors ${isFavorite ? 'text-amber-500' : ''}`}
                      >
                        <Star size={14} fill={isFavorite ? 'currentColor' : 'none'} />
                      </button>
                      <button
                        onClick={() => handleAddWidget(def)}
                        className="p-1 bg-indigo-50 hover:bg-indigo-600 border border-indigo-100 hover:border-indigo-600 text-indigo-600 hover:text-white rounded-lg transition-all shadow-sm"
                        title="Add to Grid"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

    </div>
  );
};
export default DashboardBuilder;
