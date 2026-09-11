import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  ShoppingCart,
  RotateCcw,
  Building2,
  Package,
  Lock,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Link2,
  Plus,
  Trash2,
  Save,
  HelpCircle,
  FileText,
  Warehouse,
  Coins,
  CreditCard,
  Layers,
  ChevronDown
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { apiRequest, dbService } from '../services/dbService';
import { formatMoney } from '../utils/formatUtils';
import { EtaReceivedInvoice } from '../pages/EtaReceivedInvoices';

interface CreatePurchaseFromEtaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (registeredInfo: { id: string; docNumber: string; docType: 'purchase_invoice' | 'purchase_return' }) => void;
  invoice: EtaReceivedInvoice | null;
  docType: 'purchase_invoice' | 'purchase_return';
}

interface PurchaseItemRow {
  id: string;
  etaItemCode?: string;
  etaItemName?: string;
  etaItemType?: string;
  product_id: string;
  product_name: string;
  product_code: string;
  quantity: number;
  unit_price: number;
  total: number;
  vat_rate: number;
  vat_amount: number;
  isAutoMatched?: boolean;
}

export const CreatePurchaseFromEtaModal: React.FC<CreatePurchaseFromEtaModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  invoice,
  docType
}) => {
  const { language } = useLanguage();
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const isAr = language === 'ar';
  const isInvoice = docType === 'purchase_invoice';

  // Catalogs & Form state
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [saving, setSaving] = useState(false);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [supplierMappings, setSupplierMappings] = useState<any[]>([]);
  const [itemMappings, setItemMappings] = useState<any[]>([]);

  // Selected values
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('');
  const [paymentType, setPaymentType] = useState<'credit' | 'cash'>('credit');
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [items, setItems] = useState<PurchaseItemRow[]>([]);

  // Mapping confirmation modal prompt
  const [showMappingPrompt, setShowMappingPrompt] = useState(false);
  const [unmappedSupplierTax, setUnmappedSupplierTax] = useState<string | null>(null);
  const [unmappedItemsList, setUnmappedItemsList] = useState<Array<{ etaCode: string; productId: string; etaName: string }>>([]);

  // Load catalogs on open
  useEffect(() => {
    if (!isOpen || !user?.company_id) return;

    let isMounted = true;
    const loadCatalogs = async () => {
      try {
        const [sups, prods, whs, pms, sMapRes, iMapRes] = await Promise.all([
          dbService.list<any>('suppliers', user.company_id),
          dbService.list<any>('products', user.company_id),
          dbService.list<any>('warehouses', user.company_id),
          dbService.list<any>('payment_methods', user.company_id),
          apiRequest<{ success: boolean; suppliers?: any[] }>(`/eta/suppliers/mapping?company_id=${user.company_id}`).catch(() => ({ success: false, suppliers: [] })),
          apiRequest<{ success: boolean; items?: any[] }>(`/eta/items/mapping?direction=Received&company_id=${user.company_id}`).catch(() => ({ success: false, items: [] }))
        ]);

        if (!isMounted) return;
        setSuppliers(sups || []);
        setProducts(prods || []);
        setWarehouses(whs || []);
        setPaymentMethods(pms || []);
        setSupplierMappings(sMapRes?.suppliers || []);
        setItemMappings(iMapRes?.items || []);

        if (whs && whs.length > 0 && !selectedWarehouseId) {
          setSelectedWarehouseId(whs[0].id);
        }
      } catch (err) {
        console.warn('Error loading purchase catalogs:', err);
      }
    };

    loadCatalogs();
    return () => {
      isMounted = false;
    };
  }, [isOpen, user?.company_id]);

  // When invoice changes, initialize form and parse items
  useEffect(() => {
    if (!isOpen || !invoice) return;

    let isMounted = true;
    setLoadingDetails(true);

    const initInvoiceData = async () => {
      try {
        // 1. Check Supplier auto-match
        const issuerTax = String(invoice.issuerId || '').trim();
        let matchedSupplierId = '';

        // Check eta_supplier_mappings
        const mapEntry = supplierMappings.find(m => m.taxNumber === issuerTax || m.etaTaxNumber === issuerTax);
        if (mapEntry && mapEntry.linkedSupplier?.id) {
          matchedSupplierId = mapEntry.linkedSupplier.id;
        } else if (mapEntry && mapEntry.supplier_id) {
          matchedSupplierId = mapEntry.supplier_id;
        }

        // If not in mapping, match by tax_number in suppliers list
        if (!matchedSupplierId && suppliers.length > 0) {
          const directMatch = suppliers.find(s => String(s.tax_number || '').trim() === issuerTax);
          if (directMatch) {
            matchedSupplierId = directMatch.id;
          } else {
            // Match by name
            const cleanInvName = (invoice.issuerName || '').trim().toLowerCase();
            const nameMatch = suppliers.find(s => s.name && cleanInvName.includes(s.name.trim().toLowerCase()));
            if (nameMatch) matchedSupplierId = nameMatch.id;
          }
        }

        if (isMounted && matchedSupplierId) {
          setSelectedSupplierId(matchedSupplierId);
        }

        // 2. Fetch full invoice details if lines are not present
        let rawLines: any[] = [];
        if (invoice.taxTotals && Array.isArray((invoice as any).raw_data?.invoiceLines)) {
          rawLines = (invoice as any).raw_data.invoiceLines;
        } else {
          try {
            const detailsRes = await apiRequest<{ success: boolean; data?: any }>(
              `/eta/invoices/${encodeURIComponent(invoice.uuid)}/details?company_id=${user?.company_id}`
            );
            if (detailsRes?.data?.document?.invoiceLines) {
              rawLines = detailsRes.data.document.invoiceLines;
            } else if (detailsRes?.data?.rawDocument?.invoiceLines) {
              rawLines = detailsRes.data.rawDocument.invoiceLines;
            }
          } catch (e) {
            console.warn('Could not fetch online ETA lines:', e);
          }
        }

        // 3. Map line items to ERP products
        const parsedRows: PurchaseItemRow[] = [];
        if (rawLines && rawLines.length > 0) {
          rawLines.forEach((l: any, idx: number) => {
            const etaCode = String(l.itemCode || '').trim();
            const etaName = l.itemDescription || l.description || l.itemName || `بند رقم ${idx + 1}`;
            const etaType = l.itemType || 'EGS';
            const qty = Number(l.quantity) || 1;
            const price = Number(l.unitValue?.amountEGP || l.unitPrice || l.unitValue?.amountSold || 0);
            const total = Number(l.totalSales || (qty * price) || 0);
            const vatAmt = Number(l.taxableItems?.find((t: any) => t.taxType === 'T1')?.amount || 0);

            // Find matching product
            let matchedProd: any = null;
            // A. From eta_item_mappings
            const itemMap = itemMappings.find(m => m.itemCode === etaCode || m.etaItemCode === etaCode);
            if (itemMap && itemMap.linkedProduct?.id) {
              matchedProd = products.find(p => p.id === itemMap.linkedProduct.id);
            }

            // B. Direct by tax_item_code or code or barcode
            if (!matchedProd) {
              matchedProd = products.find(p => 
                (p.tax_item_code && String(p.tax_item_code).trim() === etaCode) ||
                (p.code && String(p.code).trim() === etaCode) ||
                (p.barcode && String(p.barcode).trim() === etaCode)
              );
            }

            // C. Direct by name similarity
            if (!matchedProd) {
              matchedProd = products.find(p => p.name && (p.name.includes(etaName) || etaName.includes(p.name)));
            }

            parsedRows.push({
              id: `row-${idx}-${Date.now()}`,
              etaItemCode: etaCode,
              etaItemName: etaName,
              etaItemType: etaType,
              product_id: matchedProd?.id || '',
              product_name: matchedProd?.name || etaName,
              product_code: matchedProd?.code || etaCode,
              quantity: qty,
              unit_price: price,
              total,
              vat_rate: 14,
              vat_amount: vatAmt,
              isAutoMatched: Boolean(matchedProd)
            });
          });
        } else {
          // Fallback single line representing document summary
          parsedRows.push({
            id: `row-single-${Date.now()}`,
            etaItemCode: '',
            etaItemName: invoice.documentTypeName || 'بند الفاتورة',
            etaItemType: 'EGS',
            product_id: '',
            product_name: invoice.documentTypeName || 'بند الفاتورة',
            product_code: '',
            quantity: 1,
            unit_price: Number(invoice.totalSales || invoice.netAmount || 0),
            total: Number(invoice.totalSales || invoice.netAmount || 0),
            vat_rate: 14,
            vat_amount: Number(invoice.taxAmount || 0),
            isAutoMatched: false
          });
        }

        if (isMounted) {
          setItems(parsedRows);
          setNotes(`تم إنشاؤها تلقائياً من وثيقة مصلحة الضرائب المصرية (رقم: ${invoice.internalId || invoice.uuid.slice(0, 8)})`);
        }
      } catch (err: any) {
        console.error('Error initializing ETA document data:', err);
      } finally {
        if (isMounted) setLoadingDetails(false);
      }
    };

    initInvoiceData();
    return () => {
      isMounted = false;
    };
  }, [isOpen, invoice, supplierMappings, itemMappings, suppliers, products, user?.company_id]);

  // Locked Official Totals from ETA (Strict Rule)
  const lockedTotals = useMemo(() => {
    if (!invoice) return { gross: 0, discount: 0, net: 0, tax: 0, grandTotal: 0 };
    return {
      gross: Number(invoice.totalSales || invoice.netAmount || 0),
      discount: Number(invoice.totalDiscount || 0),
      net: Number(invoice.netAmount || 0),
      tax: Number(invoice.taxAmount || 0),
      grandTotal: Number(invoice.totalAmount || 0),
      currency: invoice.currency || 'EGP'
    };
  }, [invoice]);

  // Row update handlers
  const handleItemProductChange = (rowId: string, productId: string) => {
    const prod = products.find(p => p.id === productId);
    setItems(prev => prev.map(item => {
      if (item.id === rowId) {
        return {
          ...item,
          product_id: productId,
          product_name: prod?.name || item.product_name,
          product_code: prod?.code || item.product_code,
          unit_price: item.unit_price || Number(prod?.cost_price || 0),
          isAutoMatched: false
        };
      }
      return item;
    }));
  };

  const handleItemQtyChange = (rowId: string, qty: number) => {
    setItems(prev => prev.map(item => {
      if (item.id === rowId) {
        const total = qty * item.unit_price;
        return {
          ...item,
          quantity: qty,
          total,
          vat_amount: Number((total * 0.14).toFixed(2))
        };
      }
      return item;
    }));
  };

  const handleItemPriceChange = (rowId: string, price: number) => {
    setItems(prev => prev.map(item => {
      if (item.id === rowId) {
        const total = item.quantity * price;
        return {
          ...item,
          unit_price: price,
          total,
          vat_amount: Number((total * 0.14).toFixed(2))
        };
      }
      return item;
    }));
  };

  const handleAddItemRow = () => {
    setItems(prev => [
      ...prev,
      {
        id: `row-new-${Date.now()}`,
        product_id: '',
        product_name: '',
        product_code: '',
        quantity: 1,
        unit_price: 0,
        total: 0,
        vat_rate: 14,
        vat_amount: 0,
        isAutoMatched: false
      }
    ]);
  };

  const handleRemoveItemRow = (rowId: string) => {
    if (items.length <= 1) {
      showNotification(isAr ? 'يجب أن تحتوي الفاتورة على بند واحد على الأقل' : 'At least one item is required', 'warning');
      return;
    }
    setItems(prev => prev.filter(i => i.id !== rowId));
  };

  // Pre-save validation and check for unmapped elements
  const handlePreSave = () => {
    if (!invoice) return;
    if (!selectedSupplierId) {
      showNotification(isAr ? 'يرجى اختيار المورد في النظام أولاً' : 'Please select the ERP supplier', 'error');
      return;
    }

    const unselected = items.filter(i => !i.product_id);
    if (unselected.length > 0) {
      showNotification(
        isAr
          ? `يرجى تحديد الصنف في النظام لجميع البنود (${unselected.length} بند غير محدد)`
          : 'Please map all items to an ERP product',
        'error'
      );
      return;
    }

    // Check if supplier is already linked
    const issuerTax = String(invoice.issuerId || '').trim();
    const isSupLinked = supplierMappings.some(m => (m.taxNumber === issuerTax || m.etaTaxNumber === issuerTax) && (m.linkedSupplier?.id === selectedSupplierId || m.supplier_id === selectedSupplierId));

    // Check which items are unlinked
    const unlinkedItems: Array<{ etaCode: string; productId: string; etaName: string }> = [];
    items.forEach(it => {
      if (it.etaItemCode && it.product_id) {
        const isLinked = itemMappings.some(m => (m.itemCode === it.etaItemCode || m.etaItemCode === it.etaItemCode) && (m.linkedProduct?.id === it.product_id || m.product_id === it.product_id));
        if (!isLinked) {
          unlinkedItems.push({
            etaCode: it.etaItemCode,
            productId: it.product_id,
            etaName: it.etaItemName || it.product_name
          });
        }
      }
    });

    if (!isSupLinked || unlinkedItems.length > 0) {
      setUnmappedSupplierTax(!isSupLinked ? issuerTax : null);
      setUnmappedItemsList(unlinkedItems);
      setShowMappingPrompt(true);
    } else {
      // Direct save without linking prompt
      executeSaveDocument(false);
    }
  };

  // Execute Save
  const executeSaveDocument = async (shouldLinkMappings: boolean) => {
    if (!invoice || !user?.company_id) return;
    setSaving(true);
    setShowMappingPrompt(false);

    try {
      // 1. Optionally save mappings
      if (shouldLinkMappings) {
        if (unmappedSupplierTax && selectedSupplierId) {
          try {
            await apiRequest('/eta/suppliers/mapping/link', 'POST', {
              company_id: user.company_id,
              etaTaxNumber: unmappedSupplierTax,
              supplierId: selectedSupplierId,
              etaSupplierName: invoice.issuerName,
              notes: isAr ? 'ربط تلقائي عند تحويل فاتورة مشتريات' : 'Auto-linked from purchase invoice creation'
            });
          } catch (mErr) {
            console.warn('Could not auto-link supplier:', mErr);
          }
        }

        for (const unlinked of unmappedItemsList) {
          try {
            await apiRequest('/eta/items/mapping/link', 'POST', {
              company_id: user.company_id,
              etaItemCode: unlinked.etaCode,
              productId: unlinked.productId,
              etaItemName: unlinked.etaName,
              etaItemType: 'EGS',
              direction: 'Received',
              notes: isAr ? 'ربط تلقائي عند تحويل فاتورة مشتريات' : 'Auto-linked from purchase invoice creation'
            });
          } catch (mErr) {
            console.warn('Could not auto-link item:', unlinked.etaCode, mErr);
          }
        }
      }

      // 2. Prepare payload with strictly LOCKED ETA Totals
      const selectedSup = suppliers.find(s => s.id === selectedSupplierId);
      const selectedWh = warehouses.find(w => w.id === selectedWarehouseId);
      const selectedPm = paymentMethods.find(pm => pm.id === selectedPaymentMethodId);

      const docDate = (invoice.dateTimeIssued || '').slice(0, 10) || new Date().toISOString().slice(0, 10);

      const sanitizedLines = items.map(item => {
        const prod = products.find(p => p.id === item.product_id);
        return {
          product_id: item.product_id,
          product_name: prod?.name || item.product_name,
          product_code: prod?.code || item.product_code,
          quantity: Number(item.quantity) || 1,
          unit_price: Number(item.unit_price) || 0,
          total: Number(item.total) || 0,
          vat_rate: 14,
          vat_amount: Number(item.vat_amount) || 0
        };
      });

      if (isInvoice) {
        // Create Purchase Invoice
        const invoicePayload = {
          company_id: user.company_id,
          supplier_id: selectedSupplierId,
          supplier_name: selectedSup?.name || invoice.issuerName,
          warehouse_id: selectedWarehouseId || null,
          warehouse_name: selectedWh?.name || null,
          date: docDate,
          // Financial Totals strictly locked to ETA values
          subtotal: lockedTotals.net,
          discount_amount: lockedTotals.discount,
          tax_amount: lockedTotals.tax,
          total_amount: lockedTotals.grandTotal,
          payment_type: paymentType,
          payment_method_id: paymentType === 'cash' ? selectedPaymentMethodId : null,
          payment_method_name: paymentType === 'cash' ? (selectedPm?.name || null) : null,
          eta_uuid: invoice.uuid,
          description: `فاتورة مشتريات مسجلة من منظومة الضرائب الإلكترونية (ETA UUID: ${invoice.uuid.slice(0, 8)})`,
          notes: notes || `رقم الفاتورة في منظومة الضرائب: ${invoice.internalId || invoice.uuid.slice(0, 8)}`,
          items: sanitizedLines
        };

        const res = await apiRequest<{ id: string; invoice_number?: string }>('/purchase_invoices', 'POST', invoicePayload);
        const savedId = res?.id;
        const savedNum = res?.invoice_number || `PINV-${savedId?.slice(0, 6)}`;

        showNotification(
          isAr
            ? `تم تسجيل فاتورة المشتريات رقم ${savedNum} بنجاح ومطابقتها مع منظومة الضرائب!`
            : `Purchase invoice ${savedNum} created successfully!`,
          'success'
        );

        onSuccess({
          id: savedId,
          docNumber: savedNum,
          docType: 'purchase_invoice'
        });
      } else {
        // Create Purchase Return (Credit Note)
        const returnPayload = {
          company_id: user.company_id,
          supplier_id: selectedSupplierId,
          supplier_name: selectedSup?.name || invoice.issuerName,
          warehouse_id: selectedWarehouseId || null,
          warehouse_name: selectedWh?.name || null,
          date: docDate,
          // Financial Totals strictly locked to ETA values
          subtotal: lockedTotals.net,
          discount_amount: lockedTotals.discount,
          tax_amount: lockedTotals.tax,
          total_amount: lockedTotals.grandTotal,
          payment_type: paymentType,
          payment_method_id: paymentType === 'cash' ? selectedPaymentMethodId : null,
          payment_method_name: paymentType === 'cash' ? (selectedPm?.name || null) : null,
          eta_uuid: invoice.uuid,
          description: `مرتجع مشتريات مسجل من إشعار دائن الضرائب (ETA UUID: ${invoice.uuid.slice(0, 8)})`,
          notes: notes || `رقم الإشعار في منظومة الضرائب: ${invoice.internalId || invoice.uuid.slice(0, 8)}`,
          items: sanitizedLines
        };

        const res = await apiRequest<{ id: string; return_number?: string }>('/purchase_returns', 'POST', returnPayload);
        const savedId = res?.id;
        const savedNum = res?.return_number || `PRET-${savedId?.slice(0, 6)}`;

        showNotification(
          isAr
            ? `تم تسجيل مرتجع المشتريات رقم ${savedNum} بنجاح ومطابقته مع منظومة الضرائب!`
            : `Purchase return ${savedNum} created successfully!`,
          'success'
        );

        onSuccess({
          id: savedId,
          docNumber: savedNum,
          docType: 'purchase_return'
        });
      }

      onClose();
    } catch (err: any) {
      console.error('Error creating purchase document from ETA:', err);
      showNotification(
        err.message || (isAr ? 'فشل حفظ المستند في النظام' : 'Failed to save document'),
        'error'
      );
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen || !invoice) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 15 }}
          className="bg-white dark:bg-zinc-900 w-full max-w-5xl rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col max-h-[92vh] overflow-hidden"
          dir={isAr ? 'rtl' : 'ltr'}
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-gradient-to-r from-emerald-500/10 via-zinc-50 to-transparent dark:from-emerald-500/20 dark:via-zinc-900/50">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl ${isInvoice ? 'bg-emerald-600 text-white' : 'bg-amber-600 text-white'} shadow-md`}>
                {isInvoice ? <ShoppingCart className="w-5 h-5" /> : <RotateCcw className="w-5 h-5" />}
              </div>
              <div>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  {isInvoice
                    ? (isAr ? 'إضافة فاتورة مشتريات من الفاتورة الإلكترونية' : 'Create Purchase Invoice from ETA')
                    : (isAr ? 'إضافة مرتجع مشتريات من إشعار الدائن' : 'Create Purchase Return from ETA Credit Note')}
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                    {invoice.internalId ? `#${invoice.internalId}` : invoice.uuid.slice(0, 8)}
                  </span>
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  {isAr 
                    ? 'المستند معتمد من مصلحة الضرائب المصرية — يتم قفل الإجماليات والضرائب تلقائياً لتطابق الإقرار'
                    : 'Official ETA verified document — totals and taxes are locked to match tax declaration'}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              disabled={saving}
              className="p-2 rounded-xl text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body Content */}
          <div className="p-6 overflow-y-auto space-y-6 flex-1">
            {/* ETA Locked Financial Banner (Strict Financial Rule) */}
            <div className="bg-gradient-to-r from-emerald-50 via-emerald-50/50 to-teal-50 dark:from-emerald-950/30 dark:via-zinc-900 dark:to-teal-950/20 border border-emerald-200/80 dark:border-emerald-800/50 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold text-sm">
                  <Lock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>
                    {isAr
                      ? 'قاعدة مالية هامة: إجماليات الوثيقة والخصم وضريبة القيمة المضافة مقفلة ومعتمدة رسمياً'
                      : 'Strict Rule: Document Totals, Discount, and Taxes are officially locked'}
                  </span>
                </div>
                <span className="text-[11px] font-medium bg-emerald-200/70 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded-full">
                  ETA Certified
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
                <div className="bg-white/80 dark:bg-zinc-800/80 p-2.5 rounded-xl border border-emerald-100 dark:border-zinc-700">
                  <div className="text-[11px] text-zinc-500 dark:text-zinc-400">{isAr ? 'إجمالي المبيعات' : 'Gross Sales'}</div>
                  <div className="text-sm font-black text-zinc-900 dark:text-zinc-100 mt-0.5">{formatMoney(lockedTotals.gross)}</div>
                </div>

                <div className="bg-white/80 dark:bg-zinc-800/80 p-2.5 rounded-xl border border-emerald-100 dark:border-zinc-700">
                  <div className="text-[11px] text-zinc-500 dark:text-zinc-400">{isAr ? 'الخصم' : 'Discount'}</div>
                  <div className="text-sm font-black text-amber-600 dark:text-amber-400 mt-0.5">{formatMoney(lockedTotals.discount)}</div>
                </div>

                <div className="bg-white/80 dark:bg-zinc-800/80 p-2.5 rounded-xl border border-emerald-100 dark:border-zinc-700">
                  <div className="text-[11px] text-zinc-500 dark:text-zinc-400">{isAr ? 'الصافي' : 'Net Amount'}</div>
                  <div className="text-sm font-black text-zinc-900 dark:text-zinc-100 mt-0.5">{formatMoney(lockedTotals.net)}</div>
                </div>

                <div className="bg-white/80 dark:bg-zinc-800/80 p-2.5 rounded-xl border border-emerald-100 dark:border-zinc-700">
                  <div className="text-[11px] text-zinc-500 dark:text-zinc-400">{isAr ? 'الضريبة (14%)' : 'Tax (14%)'}</div>
                  <div className="text-sm font-black text-blue-600 dark:text-blue-400 mt-0.5">{formatMoney(lockedTotals.tax)}</div>
                </div>

                <div className="col-span-2 sm:col-span-1 bg-emerald-600 text-white p-2.5 rounded-xl shadow-md">
                  <div className="text-[11px] text-emerald-100">{isAr ? 'القيمة النهائية' : 'Total Amount'}</div>
                  <div className="text-sm font-black mt-0.5">{formatMoney(lockedTotals.grandTotal)} {lockedTotals.currency}</div>
                </div>
              </div>
            </div>

            {/* Document Header Controls */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Supplier Selection */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-zinc-500" />
                  <span>{isAr ? 'المورد في النظام' : 'ERP Supplier'}</span>
                  <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <select
                    value={selectedSupplierId}
                    onChange={e => setSelectedSupplierId(e.target.value)}
                    className="w-full bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-300 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">{isAr ? '-- اختر المورد --' : '-- Select Supplier --'}</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name} {s.tax_number ? `(${s.tax_number})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="text-[11px] text-zinc-500 flex items-center justify-between">
                  <span>{isAr ? 'المورد بالفاتورة: ' : 'ETA Issuer: '} {invoice.issuerName}</span>
                  <span className="font-mono">{invoice.issuerId}</span>
                </div>
              </div>

              {/* Warehouse Selection */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                  <Warehouse className="w-3.5 h-3.5 text-zinc-500" />
                  <span>{isAr ? 'المخزن المستلم' : 'Receiving Warehouse'}</span>
                  <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedWarehouseId}
                  onChange={e => setSelectedWarehouseId(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-300 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">{isAr ? '-- اختر المخزن --' : '-- Select Warehouse --'}</option>
                  {warehouses.map(w => (
                    <option key={w.id} value={w.id}>
                      {w.name} {w.code ? `(${w.code})` : ''}
                    </option>
                  ))}
                </select>
                <div className="text-[11px] text-zinc-500">
                  {isAr ? 'تاريخ الإصدار: ' : 'Date: '} {(invoice.dateTimeIssued || '').slice(0, 10)}
                </div>
              </div>

              {/* Payment Type & Method */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-zinc-500" />
                  <span>{isAr ? 'طريقة السداد' : 'Payment Mode'}</span>
                </label>
                <div className="flex gap-2">
                  <select
                    value={paymentType}
                    onChange={e => setPaymentType(e.target.value as any)}
                    className="w-1/2 bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-300 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="credit">{isAr ? 'آجل (ذمم)' : 'Credit'}</option>
                    <option value="cash">{isAr ? 'نقدي' : 'Cash'}</option>
                  </select>

                  {paymentType === 'cash' && (
                    <select
                      value={selectedPaymentMethodId}
                      onChange={e => setSelectedPaymentMethodId(e.target.value)}
                      className="w-1/2 bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-300 dark:border-zinc-700 rounded-xl px-2 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="">{isAr ? '-- الخزينة / البنك --' : '-- Method --'}</option>
                      {paymentMethods.map(pm => (
                        <option key={pm.id} value={pm.id}>{pm.name}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            </div>

            {/* Line Items Table */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  <Package className="w-4 h-4 text-emerald-600" />
                  <span>{isAr ? 'بنود الوثيقة وتطابق الأصناف' : 'Document Line Items & Product Mapping'}</span>
                  <span className="text-xs font-normal text-zinc-500">
                    ({items.length} {isAr ? 'بند' : 'items'})
                  </span>
                </h4>

                <button
                  type="button"
                  onClick={handleAddItemRow}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 bg-emerald-50 dark:bg-emerald-950/50 px-3 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isAr ? 'إضافة بند يدوي' : 'Add Item'}</span>
                </button>
              </div>

              {loadingDetails ? (
                <div className="p-8 text-center text-zinc-500 border border-dashed border-zinc-300 dark:border-zinc-700 rounded-2xl">
                  <div className="animate-spin w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full mx-auto mb-2" />
                  <span>{isAr ? 'جاري قراءة بنود الفاتورة ومطابقة الأصناف...' : 'Loading and matching items...'}</span>
                </div>
              ) : (
                <div className="border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
                  <div className="overflow-x-auto max-h-[300px]">
                    <table className="w-full text-xs text-right" dir={isAr ? 'rtl' : 'ltr'}>
                      <thead className="bg-zinc-100 dark:bg-zinc-800/80 text-zinc-700 dark:text-zinc-300 sticky top-0 font-bold z-10">
                        <tr>
                          <th className="p-2.5 w-10 text-center">#</th>
                          <th className="p-2.5 min-w-[180px]">{isAr ? 'بيان الصنف في الفاتورة' : 'ETA Item Details'}</th>
                          <th className="p-2.5 min-w-[240px]">{isAr ? 'الصنف في النظام (ERP)' : 'Matched ERP Product'}</th>
                          <th className="p-2.5 w-24 text-center">{isAr ? 'الكمية' : 'Quantity'}</th>
                          <th className="p-2.5 w-28 text-center">{isAr ? 'السعر' : 'Unit Price'}</th>
                          <th className="p-2.5 w-28 text-center">{isAr ? 'الإجمالي' : 'Total'}</th>
                          <th className="p-2.5 w-12 text-center"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 bg-white dark:bg-zinc-900">
                        {items.map((row, index) => (
                          <tr key={row.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors">
                            <td className="p-2.5 text-center text-zinc-400 font-mono">
                              {index + 1}
                            </td>

                            {/* ETA item info */}
                            <td className="p-2.5">
                              <div className="font-medium text-zinc-900 dark:text-zinc-100">
                                {row.etaItemName || row.product_name}
                              </div>
                              {row.etaItemCode && (
                                <div className="text-[10px] text-zinc-400 font-mono mt-0.5 flex items-center gap-1">
                                  <span className="px-1.5 py-0.2 rounded bg-zinc-100 dark:bg-zinc-800">{row.etaItemType || 'EGS'}</span>
                                  <span>{row.etaItemCode}</span>
                                </div>
                              )}
                            </td>

                            {/* ERP Product Selector */}
                            <td className="p-2.5">
                              <div className="space-y-1">
                                <select
                                  value={row.product_id}
                                  onChange={e => handleItemProductChange(row.id, e.target.value)}
                                  className={`w-full bg-zinc-50 dark:bg-zinc-800 border rounded-xl px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-emerald-500 ${
                                    row.product_id
                                      ? 'border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100'
                                      : 'border-amber-400 bg-amber-50/50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300'
                                  }`}
                                >
                                  <option value="">{isAr ? '-- اختر الصنف المربوط --' : '-- Select ERP Product --'}</option>
                                  {products.map(p => (
                                    <option key={p.id} value={p.id}>
                                      {p.name} {p.code ? `(${p.code})` : ''}
                                    </option>
                                  ))}
                                </select>

                                {row.isAutoMatched && (
                                  <div className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                    <Sparkles className="w-3 h-3" />
                                    <span>{isAr ? 'مطابق تلقائياً استناداً إلى كود الضرائب' : 'Auto-matched by ETA code'}</span>
                                  </div>
                                )}
                              </div>
                            </td>

                            {/* Quantity */}
                            <td className="p-2.5 text-center">
                              <input
                                type="number"
                                min="0.001"
                                step="any"
                                value={row.quantity}
                                onChange={e => handleItemQtyChange(row.id, parseFloat(e.target.value) || 0)}
                                className="w-20 text-center bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg px-2 py-1 text-xs text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-emerald-500"
                              />
                            </td>

                            {/* Unit Price */}
                            <td className="p-2.5 text-center">
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={row.unit_price}
                                onChange={e => handleItemPriceChange(row.id, parseFloat(e.target.value) || 0)}
                                className="w-24 text-center bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg px-2 py-1 text-xs text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-emerald-500"
                              />
                            </td>

                            {/* Total */}
                            <td className="p-2.5 text-center font-bold text-zinc-900 dark:text-zinc-100">
                              {formatMoney(row.total)}
                            </td>

                            {/* Actions */}
                            <td className="p-2.5 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveItemRow(row.id)}
                                className="p-1 text-zinc-400 hover:text-red-600 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-zinc-500" />
                <span>{isAr ? 'ملاحظات المستند' : 'Notes'}</span>
              </label>
              <input
                type="text"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder={isAr ? 'أي ملاحظات إضافية...' : 'Additional notes...'}
                className="w-full bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-300 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/80 flex items-center justify-between">
            <div className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>
                {isAr
                  ? 'سيتم تسجيل الوثيقة وربطها برقم UUID الضرائب لمنع تكرار تسجيلها'
                  : 'Document will be linked to ETA UUID preventing duplication'}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>

              <button
                type="button"
                onClick={handlePreSave}
                disabled={saving || loadingDetails}
                className={`px-5 py-2.5 rounded-xl text-xs font-bold text-white shadow-lg flex items-center gap-2 transition-all ${
                  isInvoice
                    ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
                    : 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/20'
                } disabled:opacity-50`}
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>{isAr ? 'جاري الحفظ...' : 'Saving...'}</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>
                      {isInvoice
                        ? (isAr ? 'حفظ فاتورة المشتريات' : 'Save Purchase Invoice')
                        : (isAr ? 'حفظ مرتجع المشتريات' : 'Save Purchase Return')}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>

        {/* Confirmation Modal to Save Mapping (Prompt Rule) */}
        {showMappingPrompt && (
          <div className="fixed inset-0 z-60 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white dark:bg-zinc-900 max-w-md w-full rounded-2xl p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800 text-center"
              dir={isAr ? 'rtl' : 'ltr'}
            >
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 flex items-center justify-center mx-auto mb-4">
                <Link2 className="w-6 h-6" />
              </div>

              <h4 className="text-base font-bold text-zinc-900 dark:text-zinc-100 mb-2">
                {isAr ? 'حفظ ربط المورد والأصناف تلقائياً؟' : 'Save Supplier & Item Mappings?'}
              </h4>

              <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed mb-6">
                {isAr
                  ? 'تم اكتشاف مورد أو أصناف غير مربوطة سابقاً مع منظومة الضرائب. هل ترغب في حفظ الربط الآن لاستخدامه تلقائياً في جميع الفواتير والوثائق القادمة؟'
                  : 'Unlinked supplier or items detected. Would you like to link them now so future ETA documents auto-match?'}
              </p>

              <div className="flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={() => executeSaveDocument(true)}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md transition-colors flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isAr ? 'نعم، احفظ المستند واربط المورد والأصناف' : 'Yes, Save and Link'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => executeSaveDocument(false)}
                  className="w-full py-2.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-bold rounded-xl transition-colors"
                >
                  <span>{isAr ? 'احفظ المستند فقط دون ربط' : 'Save Document Only Without Linking'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowMappingPrompt(false)}
                  className="w-full py-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-xs font-medium"
                >
                  {isAr ? 'العودة لتعديل الفاتورة' : 'Back to Editing'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </AnimatePresence>
  );
};
