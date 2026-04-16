import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Search, Calendar, Download, BarChart3, TrendingUp, ShoppingBag, Users, FileText, History } from 'lucide-react';
import { exportToPDF as exportToPDFUtil } from '../utils/pdfUtils';
import { exportToExcel, formatDataForExcel } from '../utils/excelUtils';
import { dbService } from '../services/dbService';
import { ExportButtons } from '../components/ExportButtons';
import { Invoice, Return, Customer, Product } from '../types';

export const SalesReport: React.FC = () => {
  const { user } = useAuth();
  const { t, dir } = useLanguage();
  const reportRef = useRef<HTMLDivElement>(null);
  const [startDate, setStartDate] = useState<string>(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [customerSales, setCustomerSales] = useState<any[]>([]);
  const [productSales, setProductSales] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([]);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<'customer' | 'product' | 'transactions'>('customer');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (user) {
      const fetchLists = async () => {
        const [custs, prods] = await Promise.all([
          dbService.list<Customer>('customers', user.company_id),
          dbService.list<Product>('products', user.company_id)
        ]);
        setCustomers(custs);
        setProducts(prods);
      };
      fetchLists();
    }
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [invoices, returns, discounts] = await Promise.all([
        dbService.list<Invoice>('invoices', user.company_id),
        dbService.list<Return>('returns', user.company_id),
        dbService.list<any>('customer_discounts', user.company_id)
      ]);

      let filteredInvoices = invoices.filter(i => i.date >= startDate && i.date <= endDate);
      let filteredReturns = returns.filter(r => r.date >= startDate && r.date <= endDate);
      let filteredDiscounts = discounts.filter(d => d.date >= startDate && d.date <= endDate);

      if (selectedCustomerIds.length > 0) {
        filteredInvoices = filteredInvoices.filter(i => selectedCustomerIds.includes(i.customer_id));
        filteredReturns = filteredReturns.filter(r => selectedCustomerIds.includes(r.customer_id));
        filteredDiscounts = filteredDiscounts.filter(d => selectedCustomerIds.includes(d.customer_id));
      }

      // Transactions (All movements)
      const allTransactions: any[] = [];
      filteredInvoices.forEach(inv => {
        const cust = customers.find(c => c.id === inv.customer_id);
        inv.items?.forEach((item: any) => {
          if (selectedProductIds.length === 0 || selectedProductIds.includes(item.product_id)) {
            const prod = products.find(p => p.id === item.product_id);
            allTransactions.push({
              date: inv.date,
              type: t('invoices.title'),
              number: inv.invoice_number,
              customer: cust?.name || t('common.unknown'),
              product: prod?.name || t('common.unknown'),
              quantity: item.quantity,
              price: item.price,
              total: item.quantity * item.price,
              isReturn: false
            });
          }
        });
      });

      filteredReturns.forEach(ret => {
        const cust = customers.find(c => c.id === ret.customer_id);
        ret.items?.forEach((item: any) => {
          if (selectedProductIds.length === 0 || selectedProductIds.includes(item.product_id)) {
            const prod = products.find(p => p.id === item.product_id);
            allTransactions.push({
              date: ret.date,
              type: t('returns.title'),
              number: ret.return_number,
              customer: cust?.name || t('common.unknown'),
              product: prod?.name || t('common.unknown'),
              quantity: -item.quantity,
              price: item.price,
              total: -(item.quantity * item.price),
              isReturn: true
            });
          }
        });
      });

      setTransactions(allTransactions.sort((a, b) => b.date.localeCompare(a.date)));

      // Customer Sales
      const custData = customers
        .filter(c => selectedCustomerIds.length === 0 || selectedCustomerIds.includes(c.id))
        .map((c: any) => {
          const cInvoices = filteredInvoices.filter((i: any) => i.customer_id === c.id);
          const cReturns = filteredReturns.filter((r: any) => r.customer_id === c.id);
          const cDiscounts = filteredDiscounts.filter((d: any) => d.customer_id === c.id);

          let totalSales = 0;
          let totalReturns = 0;
          let totalQuantity = 0;

          cInvoices.forEach(inv => {
            inv.items?.forEach((item: any) => {
              if (selectedProductIds.length === 0 || selectedProductIds.includes(item.product_id)) {
                totalSales += item.quantity * item.price;
                totalQuantity += item.quantity;
              }
            });
          });

          cReturns.forEach(ret => {
            ret.items?.forEach((item: any) => {
              if (selectedProductIds.length === 0 || selectedProductIds.includes(item.product_id)) {
                totalReturns += item.quantity * item.price;
              }
            });
          });

          const totalDiscounts = cDiscounts.reduce((sum: number, d: any) => sum + d.amount, 0);
          
          return {
            code: c.code,
            name: c.name,
            totalQuantity,
            totalSales,
            totalReturns,
            totalDiscounts,
            net: totalSales - totalReturns - totalDiscounts,
            avgPrice: totalQuantity > 0 ? (totalSales / totalQuantity) : 0
          };
        }).filter((c: any) => c.totalSales > 0 || c.totalReturns > 0);

      // Product Sales
      const prodData = products
        .filter(p => selectedProductIds.length === 0 || selectedProductIds.includes(p.id))
        .map((p: any) => {
          let totalSales = 0;
          let totalReturns = 0;
          let totalQuantity = 0;
          let totalReturnQuantity = 0;

          filteredInvoices.forEach(inv => {
            const items = inv.items?.filter((i: any) => i.product_id === p.id) || [];
            items.forEach((item: any) => {
              totalSales += item.quantity * item.price;
              totalQuantity += item.quantity;
            });
          });

          filteredReturns.forEach(ret => {
            const items = ret.items?.filter((i: any) => i.product_id === p.id) || [];
            items.forEach((item: any) => {
              totalReturns += item.quantity * item.price;
              totalReturnQuantity += item.quantity;
            });
          });

          return {
            code: p.code,
            name: p.name,
            totalQuantity,
            totalReturnQuantity,
            totalSales,
            totalReturns,
            net: totalSales - totalReturns,
            avgPrice: totalQuantity > 0 ? (totalSales / totalQuantity) : 0
          };
        }).filter((p: any) => p.totalSales > 0 || p.totalReturns > 0);

      setCustomerSales(custData);
      setProductSales(prodData);

    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [startDate, endDate, user, selectedCustomerIds, selectedProductIds]);

    const handleExportExcel = () => {
    const data = view === 'customer' ? customerSales : view === 'product' ? productSales : transactions;
    const headers = view === 'customer' ? {
      'code': t('customers.column_code'),
      'name': t('customers.column_name'),
      'totalQuantity': t('reports.quantity_sold'),
      'avgPrice': t('reports.avg_price'),
      'totalSales': t('reports.total_sales'),
      'totalReturns': t('reports.total_returns'),
      'totalDiscounts': t('reports.total_discounts'),
      'net': t('reports.total_net')
    } : view === 'product' ? {
      'code': t('products.column_code'),
      'name': t('products.column_name'),
      'totalQuantity': t('reports.quantity_sold'),
      'totalReturnQuantity': t('reports.quantity_returned'),
      'avgPrice': t('reports.avg_price'),
      'totalSales': t('reports.total_sales'),
      'totalReturns': t('reports.total_returns'),
      'net': t('reports.total_net')
    } : {
      'date': t('common.date'),
      'type': t('reports.transaction_type'),
      'number': t('common.number'),
      'customer': t('customers.title'),
      'product': t('products.title'),
      'quantity': t('common.quantity'),
      'price': t('common.price'),
      'total': t('common.total')
    };
    const formattedData = formatDataForExcel(data, headers);
    exportToExcel(formattedData, { filename: `Sales_Report_${view}`, sheetName: t('reports.sales') });
  };

  const handleExportPDF = async () => {
    if (reportRef.current) {
      await exportToPDFUtil(reportRef.current, { 
        filename: `Sales_Report_${view}`, 
        orientation: 'landscape',
        reportTitle: `${t('reports.sales')} - ${t('reports.view_by')} ${view === 'customer' ? t('reports.by_customer') : view === 'product' ? t('reports.by_product') : t('reports.by_transactions')}`
      });
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 p-4" dir={dir}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 italic serif">{t('reports.sales_title')}</h2>
          <p className="text-zinc-500">{t('reports.sales_subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ExportButtons 
            onExportExcel={handleExportExcel} 
            onExportPDF={handleExportPDF} 
          />
          <button 
            onClick={fetchData}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-orange-600 text-white rounded-2xl font-bold hover:bg-orange-700 transition-all active:scale-95 shadow-lg shadow-orange-200"
          >
            <TrendingUp size={20} />
            {t('reports.update_report')}
          </button>
        </div>
      </div>

      <div className="bg-white p-8 rounded-3xl border border-zinc-100 shadow-sm space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div>
            <label className="block text-sm font-bold text-zinc-700 mb-2 uppercase tracking-tighter">{t('reports.from_date')}</label>
            <input 
              type="date" 
              className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-zinc-700 mb-2 uppercase tracking-tighter">{t('reports.to_date')}</label>
            <input 
              type="date" 
              className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-zinc-700 mb-2 uppercase tracking-tighter flex justify-between items-center">
              <span>{t('reports.filter_customers')}</span>
              <div className="flex gap-2">
                <button 
                  onClick={() => setSelectedCustomerIds(customers.map(c => c.id))} 
                  className="text-emerald-600 hover:text-emerald-700 text-[10px] font-bold"
                >
                  {t('reports.select_all')}
                </button>
                <button 
                  onClick={() => setSelectedCustomerIds([])} 
                  className="text-red-600 hover:text-red-700 text-[10px] font-bold"
                >
                  {t('reports.deselect_all')}
                </button>
              </div>
            </label>
            <div className="space-y-2">
              <div className="relative">
                <Search className={`absolute ${dir === 'rtl' ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-zinc-400`} size={14} />
                <input 
                  type="text"
                  placeholder={t('reports.search_customer')}
                  className={`w-full ${dir === 'rtl' ? 'pr-9 pl-3' : 'pl-9 pr-3'} py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-emerald-500`}
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                />
              </div>
              <div className="w-full h-32 overflow-y-auto bg-zinc-50 border border-zinc-200 rounded-xl p-2 space-y-1 custom-scrollbar">
                {customers.filter(c => c.name.toLowerCase().includes(customerSearch.toLowerCase())).map(c => (
                  <label key={c.id} className="flex items-center gap-2 p-1.5 hover:bg-white rounded-lg cursor-pointer transition-all group">
                    <input 
                      type="checkbox" 
                      checked={selectedCustomerIds.includes(c.id)}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedCustomerIds([...selectedCustomerIds, c.id]);
                        else setSelectedCustomerIds(selectedCustomerIds.filter(id => id !== c.id));
                      }}
                      className="w-4 h-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500 transition-all cursor-pointer"
                    />
                    <span className="text-xs text-zinc-600 font-bold group-hover:text-zinc-900">{c.name}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <div>
            <label className="block text-sm font-bold text-zinc-700 mb-2 uppercase tracking-tighter flex justify-between items-center">
              <span>{t('reports.filter_products')}</span>
              <div className="flex gap-2">
                <button 
                  onClick={() => setSelectedProductIds(products.map(p => p.id))} 
                  className="text-emerald-600 hover:text-emerald-700 text-[10px] font-bold"
                >
                  {t('reports.select_all')}
                </button>
                <button 
                  onClick={() => setSelectedProductIds([])} 
                  className="text-red-600 hover:text-red-700 text-[10px] font-bold"
                >
                  {t('reports.deselect_all')}
                </button>
              </div>
            </label>
            <div className="space-y-2">
              <div className="relative">
                <Search className={`absolute ${dir === 'rtl' ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-zinc-400`} size={14} />
                <input 
                  type="text"
                  placeholder={t('reports.search_product')}
                  className={`w-full ${dir === 'rtl' ? 'pr-9 pl-3' : 'pl-9 pr-3'} py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-emerald-500`}
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                />
              </div>
              <div className="w-full h-32 overflow-y-auto bg-zinc-50 border border-zinc-200 rounded-xl p-2 space-y-1 custom-scrollbar">
                {products.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase())).map(p => (
                  <label key={p.id} className="flex items-center gap-2 p-1.5 hover:bg-white rounded-lg cursor-pointer transition-all group">
                    <input 
                      type="checkbox" 
                      checked={selectedProductIds.includes(p.id)}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedProductIds([...selectedProductIds, p.id]);
                        else setSelectedProductIds(selectedProductIds.filter(id => id !== p.id));
                      }}
                      className="w-4 h-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500 transition-all cursor-pointer"
                    />
                    <span className="text-xs text-zinc-600 font-bold group-hover:text-zinc-900">{p.name}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="flex justify-center">
          <div className="w-full md:w-3/4">
            <label className="block text-sm font-bold text-zinc-700 mb-2 uppercase tracking-tighter text-center">{t('reports.view_by')}</label>
            <div className="grid grid-cols-3 gap-2">
              <button 
                onClick={() => setView('customer')}
                className={`py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${view === 'customer' ? 'bg-zinc-900 text-white shadow-lg' : 'bg-zinc-50 text-zinc-500 border border-zinc-200 hover:bg-zinc-100'}`}
              >
                <Users size={18} />
                {t('reports.by_customer')}
              </button>
              <button 
                onClick={() => setView('product')}
                className={`py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${view === 'product' ? 'bg-zinc-900 text-white shadow-lg' : 'bg-zinc-50 text-zinc-500 border border-zinc-200 hover:bg-zinc-100'}`}
              >
                <ShoppingBag size={18} />
                {t('reports.by_product')}
              </button>
              <button 
                onClick={() => setView('transactions')}
                className={`py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${view === 'transactions' ? 'bg-zinc-900 text-white shadow-lg' : 'bg-zinc-50 text-zinc-500 border border-zinc-200 hover:bg-zinc-100'}`}
              >
                <FileText size={18} />
                {t('reports.by_transactions')}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div ref={reportRef} id="report-capture-area" className="bg-white rounded-3xl border border-zinc-100 shadow-sm overflow-hidden p-8">
        <div className="text-center mb-8 border-b border-zinc-100 pb-6">
          <h3 className="text-2xl font-bold text-zinc-900 mb-2">
            {view === 'customer' ? t('reports.sales_by_customer') : view === 'product' ? t('reports.sales_by_product') : t('reports.sales_by_transactions')}
          </h3>
          <div className="flex justify-center gap-8 text-sm text-zinc-500">
            <p>{t('reports.from_date')}: <span className="font-bold text-zinc-900">{startDate}</span> {t('reports.to_date')}: <span className="font-bold text-zinc-900">{endDate}</span></p>
          </div>
        </div>

        <div className="overflow-x-auto">
          {view === 'transactions' ? (
            <table className={`w-full border-collapse ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
              <thead>
                <tr className="bg-[rgba(244,244,245,0.5)] border-b border-zinc-100 text-[10px]">
                  <th className="px-4 py-4 text-sm font-bold text-zinc-500 uppercase tracking-tighter">{t('common.date')}</th>
                  <th className="px-4 py-4 text-sm font-bold text-zinc-500 uppercase tracking-tighter">{t('reports.transaction_type')}</th>
                  <th className="px-4 py-4 text-sm font-bold text-zinc-500 uppercase tracking-tighter">{t('common.number')}</th>
                  <th className="px-4 py-4 text-sm font-bold text-zinc-500 uppercase tracking-tighter">{t('customers.title')}</th>
                  <th className="px-4 py-4 text-sm font-bold text-zinc-500 uppercase tracking-tighter">{t('products.title')}</th>
                  <th className="px-4 py-4 text-sm font-bold text-zinc-500 uppercase tracking-tighter">{t('common.quantity')}</th>
                  <th className="px-4 py-4 text-sm font-bold text-zinc-500 uppercase tracking-tighter">{t('common.price')}</th>
                  <th className="px-4 py-4 text-sm font-bold text-zinc-500 uppercase tracking-tighter">{t('common.total')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {loading ? (
                  [1,2,3,4,5].map(i => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={8} className="px-6 py-4 h-16 bg-[rgba(244,244,245,0.2)]" />
                    </tr>
                  ))
                ) : transactions.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-zinc-400 italic">{t('reports.no_transactions')}</td>
                  </tr>
                ) : transactions.map((item, index) => (
                  <tr key={index} className="hover:bg-[rgba(244,244,245,0.5)] transition-colors text-xs">
                    <td className="px-4 py-4 font-mono">{item.date}</td>
                    <td className="px-4 py-4">
                      <div className={`flex items-center gap-2 px-2 py-1 rounded-lg font-bold w-fit ${item.isReturn ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                        {item.isReturn ? <History size={12} /> : <ShoppingBag size={12} />}
                        <span>{item.type}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 font-bold">{item.number}</td>
                    <td className="px-4 py-4">{item.customer}</td>
                    <td className="px-4 py-4">{item.product}</td>
                    <td className={`px-4 py-4 font-bold ${item.isReturn ? 'text-red-600' : 'text-zinc-600'}`}>{item.quantity}</td>
                    <td className="px-4 py-4">{item.price.toLocaleString()} {t('invoices.currency')}</td>
                    <td className={`px-4 py-4 font-bold ${item.isReturn ? 'text-red-600' : 'text-emerald-600'}`}>{item.total.toLocaleString()} {t('invoices.currency')}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-zinc-900 text-white font-bold text-sm">
                  <td colSpan={7} className={`px-4 py-4 ${dir === 'rtl' ? 'text-left' : 'text-right'}`}>{t('reports.total_net')}</td>
                  <td className="px-4 py-4">{transactions.reduce((sum, item) => sum + item.total, 0).toLocaleString()} {t('invoices.currency')}</td>
                </tr>
              </tfoot>
            </table>
          ) : (
            <table className={`w-full border-collapse ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
              <thead>
                <tr className="bg-[rgba(244,244,245,0.5)] border-b border-zinc-100 text-[10px]">
                  <th className="px-4 py-4 text-sm font-bold text-zinc-500 uppercase tracking-tighter">{view === 'customer' ? t('customers.column_code') : t('products.column_code')}</th>
                  <th className="px-4 py-4 text-sm font-bold text-zinc-500 uppercase tracking-tighter">{view === 'customer' ? t('customers.column_name') : t('products.column_name')}</th>
                  <th className="px-4 py-4 text-sm font-bold text-zinc-500 uppercase tracking-tighter">{t('common.quantity')}</th>
                  <th className="px-4 py-4 text-sm font-bold text-zinc-500 uppercase tracking-tighter">{t('reports.avg_price')}</th>
                  <th className="px-4 py-4 text-sm font-bold text-zinc-500 uppercase tracking-tighter">{t('reports.total_sales')}</th>
                  <th className="px-4 py-4 text-sm font-bold text-zinc-500 uppercase tracking-tighter">{t('reports.total_returns')}</th>
                  {view === 'customer' && <th className="px-4 py-4 text-sm font-bold text-zinc-500 uppercase tracking-tighter">{t('reports.total_discounts')}</th>}
                  <th className="px-4 py-4 text-sm font-bold text-zinc-500 uppercase tracking-tighter">{t('reports.total_net')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {loading ? (
                  [1,2,3,4,5].map(i => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={view === 'customer' ? 8 : 7} className="px-6 py-4 h-16 bg-[rgba(244,244,245,0.2)]" />
                    </tr>
                  ))
                ) : (view === 'customer' ? customerSales : productSales).length === 0 ? (
                  <tr>
                    <td colSpan={view === 'customer' ? 8 : 7} className="px-6 py-12 text-center text-zinc-400 italic">{t('reports.no_data')}</td>
                  </tr>
                ) : (view === 'customer' ? customerSales : productSales).map((item, index) => (
                  <tr key={index} className="hover:bg-[rgba(244,244,245,0.5)] transition-colors">
                    <td className="px-4 py-4">
                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg uppercase tracking-wider">{item.code}</span>
                    </td>
                    <td className="px-4 py-4 font-bold text-zinc-900 text-sm">{item.name}</td>
                    <td className="px-4 py-4 font-bold text-zinc-600">{item.totalQuantity.toLocaleString()}</td>
                    <td className="px-4 py-4 text-zinc-500">{item.avgPrice.toLocaleString()} {t('invoices.currency')}</td>
                    <td className="px-4 py-4 text-emerald-600 font-bold">{item.totalSales.toLocaleString()} {t('invoices.currency')}</td>
                    <td className="px-4 py-4 text-red-600 font-bold">{item.totalReturns.toLocaleString()} {t('invoices.currency')}</td>
                    {view === 'customer' && <td className="px-4 py-4 text-amber-600 font-bold">{item.totalDiscounts.toLocaleString()} {t('invoices.currency')}</td>}
                    <td className="px-4 py-4 font-bold text-zinc-900 bg-[rgba(244,244,245,0.3)]">{item.net.toLocaleString()} {t('invoices.currency')}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-zinc-900 text-white font-bold text-sm">
                  <td colSpan={2} className={`px-4 py-4 ${dir === 'rtl' ? 'text-left' : 'text-right'}`}>{t('reports.total_overall')}</td>
                  <td className="px-4 py-4">{(view === 'customer' ? customerSales : productSales).reduce((sum, item) => sum + item.totalQuantity, 0).toLocaleString()}</td>
                  <td className="px-4 py-4">-</td>
                  <td className="px-4 py-4">{(view === 'customer' ? customerSales : productSales).reduce((sum, item) => sum + item.totalSales, 0).toLocaleString()} {t('invoices.currency')}</td>
                  <td className="px-4 py-4">{(view === 'customer' ? customerSales : productSales).reduce((sum, item) => sum + item.totalReturns, 0).toLocaleString()} {t('invoices.currency')}</td>
                  {view === 'customer' && <td className="px-4 py-4">{customerSales.reduce((sum, item) => sum + item.totalDiscounts, 0).toLocaleString()} {t('invoices.currency')}</td>}
                  <td className="px-4 py-4">{(view === 'customer' ? customerSales : productSales).reduce((sum, item) => sum + item.net, 0).toLocaleString()} {t('invoices.currency')}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
