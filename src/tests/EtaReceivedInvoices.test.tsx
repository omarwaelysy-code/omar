import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { EtaReceivedInvoices } from '../pages/EtaReceivedInvoices';
import * as dbServiceModule from '../services/dbService';

const mockOpenTab = vi.fn();
const mockShowNotification = vi.fn();

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'usr-1',
      username: 'admin',
      email: 'admin@company.com',
      company_id: 'comp-test',
      company_name: 'شركة الاختبار',
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
    openTab: mockOpenTab,
    activeTabId: 'eta_received_invoices'
  })
}));

vi.mock('../contexts/NotificationContext', () => ({
  useNotification: () => ({
    showNotification: mockShowNotification
  })
}));

vi.mock('../contexts/LanguageContext', () => ({
  useLanguage: () => ({
    language: 'ar',
    dir: 'rtl',
    t: (key: string) => key
  })
}));

describe('EtaReceivedInvoices Component (Frontend UI & UX)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. should show unconfigured banner when isConfigured is false', async () => {
    vi.spyOn(dbServiceModule, 'apiRequest').mockResolvedValue({
      success: false,
      isConfigured: false,
      environment: 'preprod',
      data: [],
      pagination: { pageSize: 20 }
    });

    render(<EtaReceivedInvoices />);

    await waitFor(() => {
      expect(screen.getByText('لم يتم إعداد الربط مع منظومة ETA لهذه الشركة')).toBeInTheDocument();
    });

    const configureBtn = screen.getByText('إعداد الربط الآن');
    expect(configureBtn).toBeInTheDocument();

    fireEvent.click(configureBtn);
    expect(mockOpenTab).toHaveBeenCalledWith('company_settings', 'إعدادات الشركة');
  });

  it('2. should show empty state message when no invoices match the filter', async () => {
    vi.spyOn(dbServiceModule, 'apiRequest').mockResolvedValue({
      success: true,
      isConfigured: true,
      environment: 'preprod',
      data: [],
      pagination: { pageSize: 20 }
    });

    render(<EtaReceivedInvoices />);

    await waitFor(() => {
      expect(screen.getByText('لا توجد فواتير إلكترونية مستلمة')).toBeInTheDocument();
    });
  });

  it('3. should render invoices table correctly when invoices are returned', async () => {
    const mockInvoices = [
      {
        uuid: 'UUID-INV-001-AAABBB',
        internalId: 'INV-2026-99',
        typeName: 'i',
        documentTypeName: 'فاتورة ضريبية',
        issuerId: '772681716',
        issuerName: 'شركة الإخلاص للتوريدات',
        receiverId: '100200300',
        receiverName: 'شركة الاختبار',
        dateTimeIssued: '2026-08-25T14:30:00Z',
        dateTimeReceived: '2026-08-25T14:35:00Z',
        totalSales: 2000,
        totalDiscount: 200,
        netAmount: 1800,
        taxAmount: 252,
        totalAmount: 2052,
        currency: 'EGP',
        status: 'Valid'
      }
    ];

    vi.spyOn(dbServiceModule, 'apiRequest').mockResolvedValue({
      success: true,
      isConfigured: true,
      environment: 'preprod',
      data: mockInvoices,
      pagination: { pageSize: 20, continuationToken: null }
    });

    render(<EtaReceivedInvoices />);

    await waitFor(() => {
      expect(screen.getByText('INV-2026-99')).toBeInTheDocument();
    });

    expect(screen.getByText('شركة الإخلاص للتوريدات')).toBeInTheDocument();
    expect(screen.getByText('772681716')).toBeInTheDocument();
    expect(screen.getByText('صحيحة')).toBeInTheDocument();
    expect(screen.getByText('التفاصيل')).toBeInTheDocument();
  });

  it('4. should open Read-Only details modal when clicking details button', async () => {
    const mockInvoices = [
      {
        uuid: 'UUID-INV-001-MODAL',
        submissionUuid: 'SUB-UUID-XYZ',
        internalId: 'INV-MODAL-TEST',
        typeName: 'i',
        documentTypeName: 'فاتورة ضريبية',
        issuerId: '99887766',
        issuerName: 'مورد الاختبار',
        receiverId: '11223344',
        receiverName: 'شركتنا',
        dateTimeIssued: '2026-08-20T10:00:00Z',
        dateTimeReceived: '2026-08-20T10:05:00Z',
        totalSales: 500,
        totalDiscount: 0,
        netAmount: 500,
        taxAmount: 70,
        totalAmount: 570,
        currency: 'EGP',
        status: 'Valid'
      }
    ];

    vi.spyOn(dbServiceModule, 'apiRequest').mockResolvedValue({
      success: true,
      isConfigured: true,
      environment: 'preprod',
      data: mockInvoices,
      pagination: { pageSize: 20 }
    });

    render(<EtaReceivedInvoices />);

    await waitFor(() => {
      expect(screen.getByText('INV-MODAL-TEST')).toBeInTheDocument();
    });

    const detailsBtn = screen.getByText('التفاصيل');
    fireEvent.click(detailsBtn);

    // Verify modal appeared
    expect(screen.getByText('تفاصيل الفاتورة الإلكترونية')).toBeInTheDocument();
    expect(screen.getByText('UUID-INV-001-MODAL')).toBeInTheDocument();
    expect(screen.getAllByText('مورد الاختبار').length).toBeGreaterThan(0);
    expect(screen.getByText('إغلاق')).toBeInTheDocument();

    // Close modal
    fireEvent.click(screen.getByText('إغلاق'));
  });

  it('5. should display error banner when API fails and allow retry', async () => {
    vi.spyOn(dbServiceModule, 'apiRequest').mockImplementation(async (path: string) => {
      if (path.includes('/eta/invoices/received')) {
        throw new Error('تعذر الوصول إلى خوادم مصلحة الضرائب المصرية');
      }
      return { environment: 'preprod', isConfigured: true };
    });

    render(<EtaReceivedInvoices />);

    await waitFor(() => {
      expect(screen.getByText('تعذر الوصول إلى خوادم مصلحة الضرائب المصرية')).toBeInTheDocument();
    });

    expect(screen.getAllByText('إعادة المحاولة').length).toBeGreaterThan(0);
  });
});
