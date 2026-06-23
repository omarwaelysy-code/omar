import { WidgetTypeDefinition } from '../types';

export const WIDGET_REGISTRY: WidgetTypeDefinition[] = [
  { type: 'kpi_card', nameEn: 'KPI Card', nameAr: 'بطاقة مؤشر الأداء الرئيسي', defaultW: 3, defaultH: 2, description: 'Displays a single critical metric or key performance indicator.' },
  { type: 'line_chart', nameEn: 'Line Chart', nameAr: 'مخطط خطي', defaultW: 6, defaultH: 4, description: 'Visualizes trend lines over a period of time.' },
  { type: 'bar_chart', nameEn: 'Bar Chart', nameAr: 'مخطط شريطي', defaultW: 6, defaultH: 4, description: 'Compares different categories side by side.' },
  { type: 'pie_chart', nameEn: 'Pie Chart', nameAr: 'مخطط دائري', defaultW: 4, defaultH: 4, description: 'Represents numerical proportion distributions.' },
  { type: 'area_chart', nameEn: 'Area Chart', nameAr: 'مخطط مساحي', defaultW: 6, defaultH: 4, description: 'Visualizes quantitative data over time with filled areas.' },
  { type: 'table', nameEn: 'Data Table', nameAr: 'جدول البيانات', defaultW: 12, defaultH: 4, description: 'Displays raw records in a structured tabular list.' },
  { type: 'calendar', nameEn: 'Calendar', nameAr: 'التقويم', defaultW: 6, defaultH: 4, description: 'Displays schedules, events, and due dates.' },
  { type: 'recent_activities', nameEn: 'Recent Activities', nameAr: 'الأنشطة الأخيرة', defaultW: 4, defaultH: 4, description: 'Chronological timeline of system transactions and logs.' },
  { type: 'notifications', nameEn: 'Notifications', nameAr: 'الإشعارات', defaultW: 4, defaultH: 4, description: 'Real-time system alerts and push messages.' },
  { type: 'sales_summary', nameEn: 'Sales Summary', nameAr: 'ملخص المبيعات', defaultW: 6, defaultH: 4, description: 'KPI cards and mini-charts indicating revenue and conversions.' },
  { type: 'inventory_summary', nameEn: 'Inventory Summary', nameAr: 'ملخص المخزون', defaultW: 6, defaultH: 4, description: 'Overview of stock statuses, valuation, and low stock items.' },
  { type: 'cash_flow', nameEn: 'Cash Flow', nameAr: 'حركة التدفق النقدي', defaultW: 6, defaultH: 4, description: 'Inflow and outflow of cash assets across payment methods.' },
  { type: 'profit', nameEn: 'Profitability', nameAr: 'الأرباح والخسائر', defaultW: 6, defaultH: 4, description: 'Summary of income vs expenses yielding net profit.' },
  { type: 'customers', nameEn: 'Customers Overview', nameAr: 'نظرة عامة على العملاء', defaultW: 6, defaultH: 4, description: 'Highlights customer debt profiles, top buyers, and growth.' },
  { type: 'suppliers', nameEn: 'Suppliers Overview', nameAr: 'نظرة عامة على الموردين', defaultW: 6, defaultH: 4, description: 'Highlights supplier outstanding balances and procurement.' },
  { type: 'text', nameEn: 'Text Label', nameAr: 'نص مخصص', defaultW: 4, defaultH: 2, description: 'Renders custom text labels, headers, or markdown instructions.' }
];
