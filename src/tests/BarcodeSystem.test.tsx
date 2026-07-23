import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { Products } from '../pages/Products';
import { dbService } from '../services/dbService';

// Mock values defined outside to preserve reference identity and prevent infinite render loops
const mockUser = {
  id: 'test-user-id',
  username: 'testuser',
  email: 'test@example.com',
  company_id: 'test-company-id',
  role: 'admin'
};

const mockAuthValue = {
  user: mockUser,
  isAuthenticated: true,
  isSuperAdmin: false,
  isCompanyAdmin: true,
  hasPermission: () => true
};

const mockNavigationValue = {
  activeTabId: 'products',
  setCurrentPage: vi.fn(),
  setPendingViewDoc: vi.fn()
};

const mockLanguageValue = {
  language: 'ar',
  t: (key: string) => {
    const keys: { [k: string]: string } = {
      'products.title': 'الأصناف والمخزون',
      'products.add': 'إضافة صنف',
      'products.edit': 'تعديل صنف',
      'products.form_barcode': 'الباركود',
      'common.save': 'حفظ',
      'common.cancel': 'إلغاء',
      'common.confirm_delete': 'هل أنت متأكد من الحذف؟',
      'common.deleted_successfully': 'تم الحذف بنجاح'
    };
    return keys[key] || key;
  },
  dir: 'rtl'
};

const mockNotificationValue = {
  showNotification: vi.fn(),
  addPersistentNotification: vi.fn(),
  notifications: [],
  unreadCount: 0,
  markAsRead: vi.fn(),
  dismissNotification: vi.fn(),
  markAllAsRead: vi.fn(),
  clearAll: vi.fn(),
  isCenterOpen: false,
  setIsCenterOpen: vi.fn()
};

const mockPermissionsValue = {
  canView: true,
  canCreate: true,
  canDelete: true
};

const mockViewPreferenceValue = ['table', vi.fn()] as const;

// 1. Mock libraries and modules first (hoisted)
vi.stubGlobal('print', vi.fn());

vi.mock('react-barcode', () => ({
  default: () => null
}));

vi.mock('react-qr-code', () => ({
  default: () => null
}));

vi.mock('../utils/pdfUtils', () => ({
  exportToPDF: vi.fn(),
  printElement: vi.fn()
}));

vi.mock('../utils/excelUtils', () => ({
  exportToExcel: vi.fn(),
  formatDataForExcel: vi.fn()
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => mockAuthValue
}));

vi.mock('../contexts/NavigationContext', () => ({
  useNavigation: () => mockNavigationValue
}));

vi.mock('../contexts/LanguageContext', () => ({
  useLanguage: () => mockLanguageValue
}));

vi.mock('../contexts/NotificationContext', () => ({
  useNotification: () => mockNotificationValue
}));

vi.mock('../hooks/usePermissions', () => ({
  usePermissions: () => mockPermissionsValue
}));

vi.mock('../hooks/useViewPreference', () => ({
  useViewPreference: () => mockViewPreferenceValue
}));

vi.mock('../components/PageActivityLog', () => ({
  PageActivityLog: () => null
}));

vi.mock('../components/InlineActivityLog', () => ({
  InlineActivityLog: () => null
}));

vi.mock('../components/PaginationControls', () => ({
  PaginationControls: () => null
}));

vi.mock('../components/ExportButtons', () => ({
  ExportButtons: () => null
}));

vi.mock('../components/FormattedNumberInput', () => ({
  FormattedNumberInput: ({ value, onChange, ...props }: any) => (
    <input type="number" value={value} onChange={(e) => onChange && onChange(Number(e.target.value))} {...props} />
  )
}));

vi.mock('../services/dbService', () => ({
  dbService: {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    add: vi.fn(),
    listen: vi.fn().mockImplementation((collection, id, callback) => {
      if (collection === 'companies') {
        callback({
          id: 'test-company-id',
          name: 'Test Company',
          settings: { vat_enabled: true }
        });
      }
      return () => {};
    }),
    subscribe: vi.fn().mockImplementation((collection, companyId, callback) => {
      if (collection === 'products') {
        callback([
          {
            id: 'prod-1',
            code: 'P001',
            name: 'صنف تجريبي الأول',
            type: 'finished_good',
            sale_price: 100,
            cost_price: 70,
            barcode: '123456789012',
            barcode_settings: {
              type: 'CODE128',
              width: 2,
              height: 40,
              fontSize: 12,
              displayValue: true
            },
            is_active: true,
            company_id: 'test-company-id',
            item_group_id: 'group-1',
            revenue_account_id: 'acc-revenue',
            cost_account_id: 'acc-cost',
            inventory_account_id: 'acc-inventory'
          },
          {
            id: 'prod-2',
            code: 'P002',
            name: 'صنف تجريبي الثاني',
            type: 'finished_good',
            sale_price: 200,
            cost_price: 140,
            barcode: '9876543210',
            is_active: true,
            company_id: 'test-company-id',
            item_group_id: 'group-1',
            revenue_account_id: 'acc-revenue',
            cost_account_id: 'acc-cost',
            inventory_account_id: 'acc-inventory'
          }
        ]);
      } else if (collection === 'accounts') {
        callback([
          { id: 'acc-revenue', name: 'Revenue Account', account_usage: 'sales_revenue' },
          { id: 'acc-cost', name: 'Cost Account', account_usage: 'cost_of_sales' },
          { id: 'acc-inventory', name: 'Inventory Account', account_usage: 'inventory' }
        ]);
      } else if (collection === 'item_groups') {
        callback([
          { id: 'group-1', name: 'Default Group' }
        ]);
      }
      return () => {};
    })
  },
  apiRequest: vi.fn()
}));

vi.mock('motion/react', () => ({
  motion: {
    div: React.forwardRef(({ children, className, style, onClick, ...props }: any, ref: any) => (
      <div ref={ref} className={className} style={style} onClick={onClick} {...props}>
        {children}
      </div>
    )),
    button: React.forwardRef(({ children, className, style, onClick, ...props }: any, ref: any) => (
      <button ref={ref} className={className} style={style} onClick={onClick} {...props}>
        {children}
      </button>
    )),
    span: React.forwardRef(({ children, className, style, ...props }: any, ref: any) => (
      <span ref={ref} className={className} style={style} {...props}>
        {children}
      </span>
    ))
  },
  AnimatePresence: ({ children }: any) => <>{children}</>
}));

describe('Barcode System integration in Products screen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(dbService.update).mockResolvedValue(undefined as any);
    vi.mocked(dbService.add).mockResolvedValue(undefined as any);
  });

  it('renders products list correctly and shows bulk selection checkboxes', async () => {
    render(<Products />);
    
    await waitFor(() => {
      expect(screen.getByText('صنف تجريبي الأول')).toBeInTheDocument();
      expect(screen.getByText('صنف تجريبي الثاني')).toBeInTheDocument();
    });

    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
    expect(checkboxes.length).toBe(3);
  });

  it('opens barcode settings modal from product creation/edit form', async () => {
    render(<Products />);

    await waitFor(() => {
      expect(screen.getByText('صنف تجريبي الأول')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByText('صنف تجريبي الأول'));
    });
    expect(screen.getByText('تعديل صنف')).toBeInTheDocument();

    const settingsBtn = screen.getByTitle('إعدادات الباركود');
    expect(settingsBtn).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(settingsBtn);
    });
    expect(screen.getByText('إعدادات الباركود')).toBeInTheDocument();
    expect(screen.getByText('نوع الباركود')).toBeInTheDocument();
    expect(screen.getByText('الهوامش (بكسل)')).toBeInTheDocument();
    
    const cancelBtn = screen.getByRole('button', { name: /cancel|إلغاء/i });
    await act(async () => {
      fireEvent.click(cancelBtn);
    });
  });

  it('allows editing barcode settings and saves them to form data state', async () => {
    render(<Products />);

    await waitFor(() => {
      expect(screen.getByText('صنف تجريبي الأول')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByText('صنف تجريبي الأول'));
    });

    await act(async () => {
      fireEvent.click(screen.getByTitle('إعدادات الباركود'));
    });

    const heightInput = screen.getByText(/ارتفاع الباركود/i).parentElement?.querySelector('input') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(heightInput, { target: { value: '75' } });
    });

    const saveSettingsBtn = screen.getAllByRole('button', { name: /save|حفظ/i }).find(btn => !btn.getAttribute('form')) as HTMLButtonElement;
    await act(async () => {
      fireEvent.click(saveSettingsBtn);
    });

    const form = document.getElementById('product-form') as HTMLFormElement;
    await act(async () => {
      fireEvent.submit(form);
    });

    await waitFor(() => {
      expect(dbService.update).toHaveBeenCalled();
      const updatedData = vi.mocked(dbService.update).mock.calls[0][2] as any;
      expect(updatedData.barcode_settings.height).toBe(75);
    });
  });

  it('triggers browser print when executing single barcode print', async () => {
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
    render(<Products />);

    await waitFor(() => {
      expect(screen.getByText('صنف تجريبي الأول')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByText('صنف تجريبي الأول'));
    });

    const printBtn = screen.getByTitle('طباعة الباركود');
    await act(async () => {
      fireEvent.click(printBtn);
    });

    expect(screen.getByText('خيارات طباعة الباركود')).toBeInTheDocument();

    const executePrintBtn = screen.getByRole('button', { name: /^طباعة$|^Print$/ });
    await act(async () => {
      fireEvent.click(executePrintBtn);
    });

    await waitFor(() => {
      expect(printSpy).toHaveBeenCalled();
    });
    printSpy.mockRestore();
  });

  it('shows bulk print button when selecting multiple products and executes print', async () => {
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
    render(<Products />);

    await waitFor(() => {
      expect(screen.getByText('صنف تجريبي الأول')).toBeInTheDocument();
    });

    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
    await act(async () => {
      fireEvent.click(checkboxes[1]);
      fireEvent.click(checkboxes[2]);
    });

    const bulkPrintBtn = screen.getByText(/طباعة الباركود \(/i);
    expect(bulkPrintBtn).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(bulkPrintBtn);
    });
    expect(screen.getByText('طباعة باركود جماعية')).toBeInTheDocument();

    const executeBulkPrintBtn = screen.getByRole('button', { name: /^طباعة$|^Print$/ });
    await act(async () => {
      fireEvent.click(executeBulkPrintBtn);
    });

    await waitFor(() => {
      expect(printSpy).toHaveBeenCalled();
    });
    printSpy.mockRestore();
  });
});
