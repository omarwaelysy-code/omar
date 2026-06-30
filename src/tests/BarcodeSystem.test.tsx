import { vi } from 'vitest';

// 1. Mock libraries and modules first (hoisted)
vi.stubGlobal('print', vi.fn());

vi.mock('react-barcode', () => {
  return {
    default: ({ value, format }: any) => {
      return (
        <div data-testid="mock-barcode" data-value={value} data-format={format}>
          Barcode: {value}
        </div>
      );
    }
  };
});

vi.mock('react-qr-code', () => {
  return {
    default: ({ value, size }: any) => {
      return (
        <div data-testid="mock-qrcode" data-value={value} data-size={size}>
          QRCode: {value}
        </div>
      );
    }
  };
});

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'test-user-id',
      username: 'testuser',
      email: 'test@example.com',
      company_id: 'test-company-id',
      role: 'admin'
    },
    isAuthenticated: true,
    isSuperAdmin: false,
    isCompanyAdmin: true,
    hasPermission: () => true
  })
}));

vi.mock('../contexts/NavigationContext', () => ({
  useNavigation: () => ({
    activeTabId: 'products',
    setCurrentPage: vi.fn(),
    setPendingViewDoc: vi.fn()
  })
}));

vi.mock('../contexts/LanguageContext', () => ({
  useLanguage: () => ({
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
  })
}));

vi.mock('../contexts/NotificationContext', () => ({
  useNotification: () => ({
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
  })
}));

vi.mock('../hooks/usePermissions', () => ({
  usePermissions: () => ({
    canView: true,
    canCreate: true,
    canDelete: true
  })
}));

vi.mock('../hooks/useViewPreference', () => ({
  useViewPreference: () => ['table', vi.fn()]
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
            company_id: 'test-company-id'
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
            company_id: 'test-company-id'
          }
        ]);
      } else if (collection === 'accounts') {
        callback([]);
      } else if (collection === 'item_groups') {
        callback([]);
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

// 2. Import React and components AFTER mocking
import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Products } from '../pages/Products';
import { dbService } from '../services/dbService';

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

    fireEvent.click(screen.getByText('صنف تجريبي الأول'));
    expect(screen.getByText('تعديل صنف')).toBeInTheDocument();

    const settingsBtn = screen.getByTitle('إعدادات الباركود');
    expect(settingsBtn).toBeInTheDocument();

    fireEvent.click(settingsBtn);
    expect(screen.getByText('إعدادات الباركود')).toBeInTheDocument();
    expect(screen.getByText('نوع الباركود')).toBeInTheDocument();
    expect(screen.getByText('الهوامش (بكسل)')).toBeInTheDocument();
    
    const cancelBtn = screen.getByRole('button', { name: /cancel/i || /إلغاء/i || /common.cancel/i });
    fireEvent.click(cancelBtn);
  });

  it('allows editing barcode settings and saves them to form data state', async () => {
    render(<Products />);

    await waitFor(() => {
      expect(screen.getByText('صنف تجريبي الأول')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('صنف تجريبي الأول'));

    fireEvent.click(screen.getByTitle('إعدادات الباركود'));

    const heightInput = screen.getByLabelText(/ارتفاع الباركود/i || /Barcode Height/i) as HTMLInputElement;
    fireEvent.change(heightInput, { target: { value: '75' } });

    const saveSettingsBtn = screen.getByRole('button', { name: /save/i || /حفظ/i || /common.save/i });
    fireEvent.click(saveSettingsBtn);

    const saveProductBtn = screen.getByRole('button', { name: /common.save/i || /حفظ/i });
    fireEvent.click(saveProductBtn);

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
    fireEvent.click(screen.getByText('صنف تجريبي الأول'));

    const printBtn = screen.getByTitle('طباعة الباركود');
    fireEvent.click(printBtn);

    expect(screen.getByText('خيارات طباعة الباركود')).toBeInTheDocument();

    const executePrintBtn = screen.getByRole('button', { name: /طباعة/i || /Print/i });
    fireEvent.click(executePrintBtn);

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
    fireEvent.click(checkboxes[1]);
    fireEvent.click(checkboxes[2]);

    const bulkPrintBtn = screen.getByText(/طباعة الباركود \(/i);
    expect(bulkPrintBtn).toBeInTheDocument();

    fireEvent.click(bulkPrintBtn);
    expect(screen.getByText('طباعة باركود جماعية')).toBeInTheDocument();

    const executeBulkPrintBtn = screen.getByRole('button', { name: /طباعة/i || /Print/i });
    fireEvent.click(executeBulkPrintBtn);

    await waitFor(() => {
      expect(printSpy).toHaveBeenCalled();
    });
    printSpy.mockRestore();
  });
});
