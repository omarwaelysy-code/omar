import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Dashboard } from '../pages/Dashboard';
import { dbService } from '../services/dbService';

// Mock contexts
const mockUser = {
  id: 'test-user-id',
  username: 'testuser',
  email: 'test@example.com',
  company_id: 'test-company-id',
  role: 'admin'
};

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
    isAuthenticated: true,
    isSuperAdmin: false,
    isCompanyAdmin: true,
    hasPermission: () => true
  })
}));

vi.mock('../contexts/NavigationContext', () => ({
  useNavigation: () => ({
    activeTabId: 'dashboard',
    setCurrentPage: vi.fn()
  }),
  pageLabels: {
    'dashboard': 'لوحة التحكم',
    'customers': 'العملاء',
    'suppliers': 'الموردين',
    'products': 'الأصناف',
    'invoices': 'فواتير مبيعات'
  }
}));

vi.mock('../contexts/LanguageContext', () => ({
  useLanguage: () => ({
    language: 'en',
    t: (key: string) => {
      const keys: { [k: string]: string } = {
        'dashboard.title': 'Dashboard',
        'dashboard.net_profit': 'Net Profit',
        'dashboard.total_invoices': 'Total Invoices',
        'dashboard.receipt_vouchers': 'Receipt Vouchers',
        'dashboard.total_expenses': 'Total Expenses',
        'dashboard.recent_transactions': 'Recent Transactions',
        'common.save': 'Save',
        'common.cancel': 'Cancel',
        'common.search': 'Search',
        'common.loading': 'Loading...'
      };
      return keys[key] || key;
    },
    dir: 'ltr'
  })
}));

// Mock dbService
vi.mock('../services/dbService', () => ({
  dbService: {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    addWithId: vi.fn(),
    getOrCreateDefaultDashboard: vi.fn(),
    saveAsTemplate: vi.fn(),
    resetDashboard: vi.fn(),
    exportDashboard: vi.fn(),
    importDashboard: vi.fn(),
    getWidgetDataSources: vi.fn(),
    queryWidgetData: vi.fn()
  },
  apiRequest: vi.fn()
}));

// Mock framer-motion or animation tags
vi.mock('framer-motion', () => ({
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

describe('Dashboard Page Customization Mode and Templates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    
    // Default mocks for dbService lists
    vi.mocked(dbService.list).mockImplementation((collection: string) => {
      if (collection === 'dashboards') {
        return Promise.resolve([
          {
            id: 'dash-custom-1',
            company_id: 'test-company-id',
            owner_user_id: 'test-user-id',
            name: 'My Custom View',
            description: 'Custom description',
            is_default: true,
            is_system: false,
            icon: 'LayoutDashboard',
            allowed_roles: null
          }
        ]);
      }
      return Promise.resolve([]);
    });

    vi.mocked(dbService.get).mockImplementation((collection: string, id: string) => {
      if (collection === 'dashboards' && id === 'dash-custom-1') {
        return Promise.resolve({
          id: 'dash-custom-1',
          company_id: 'test-company-id',
          owner_user_id: 'test-user-id',
          name: 'My Custom View',
          description: 'Custom description',
          is_default: true,
          is_system: false,
          icon: 'LayoutDashboard'
        });
      }
      return Promise.resolve(null);
    });

    vi.mocked(dbService.getWidgetDataSources).mockResolvedValue({
      invoices: ['id', 'total_amount', 'date'],
      products: ['id', 'name', 'stock']
    });

    vi.mocked(dbService.queryWidgetData).mockResolvedValue([]);
  });

  it('renders fallback bento grid dashboard by default', async () => {
    render(<Dashboard />);
    
    // Recharts and data loading might cause async state ticks
    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      // Should show the default bento items or layout dropdown switcher
      expect(screen.getByRole('combobox')).toBeInTheDocument();
      expect(screen.getByText('Default Dashboard')).toBeInTheDocument();
    });
  });

  it('enters customization mode when clicking Customize button', async () => {
    render(<Dashboard />);
    
    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    const customizeBtn = screen.getByText('Customize');
    expect(customizeBtn).toBeInTheDocument();
    
    fireEvent.click(customizeBtn);

    // Should render the customization workspace (e.g. Save, Cancel and Restore buttons)
    await waitFor(() => {
      expect(screen.getByText('Save')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
      expect(screen.getByText('Restore Default')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Dashboard Name')).toBeInTheDocument();
    });
  });

  it('saves custom dashboard and widgets and exits customization mode', async () => {
    vi.mocked(dbService.addWithId).mockResolvedValue(undefined);
    vi.mocked(dbService.update).mockResolvedValue(undefined);
    
    render(<Dashboard />);
    
    await waitFor(() => {
      expect(screen.getByText('Customize')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Customize'));

    // Change dashboard name in text field
    const nameInput = screen.getByPlaceholderText('Dashboard Name') as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: 'My Awesome Customized Dashboard' } });
    
    const saveBtn = screen.getByText('Save');
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(dbService.addWithId).toHaveBeenCalled();
      expect(screen.queryByText('Restore Default')).not.toBeInTheDocument();
    });
  });

  it('cancels customization and discards current edits', async () => {
    render(<Dashboard />);
    
    await waitFor(() => {
      expect(screen.getByText('Customize')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Customize'));
    
    const cancelBtn = screen.getByText('Cancel');
    fireEvent.click(cancelBtn);

    await waitFor(() => {
      expect(screen.queryByText('Restore Default')).not.toBeInTheDocument();
    });
  });

  it('restores default layout and clears database record', async () => {
    vi.mocked(dbService.delete).mockResolvedValue(undefined);
    // Mock user having a custom dashboard loaded active
    localStorage.setItem('active_dashboard_test-user-id', 'dash-custom-1');

    render(<Dashboard />);
    
    await waitFor(() => {
      expect(screen.getByText('Customize')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Customize'));
    
    // Mock window confirm to pass true
    const confirmSpy = vi.spyOn(window, 'confirm').mockImplementation(() => true);
    
    const restoreBtn = screen.getByText('Restore Default');
    fireEvent.click(restoreBtn);

    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalled();
      expect(dbService.delete).toHaveBeenCalledWith('dashboards', 'dash-custom-1');
      expect(localStorage.getItem('active_dashboard_test-user-id')).toBe('default');
    });
  });

  it('duplicates template successfully', async () => {
    vi.mocked(dbService.addWithId).mockResolvedValue(undefined);
    vi.mocked(dbService.list).mockResolvedValue([]);
    
    render(<Dashboard />);
    
    await waitFor(() => {
      expect(screen.getByText('Customize')).toBeInTheDocument();
    });

    const promptSpy = vi.spyOn(window, 'prompt').mockImplementation(() => 'My Duplicate Layout');
    const duplicateBtn = screen.getByTitle('Duplicate Layout');
    fireEvent.click(duplicateBtn);

    await waitFor(() => {
      expect(promptSpy).toHaveBeenCalled();
      expect(dbService.addWithId).toHaveBeenCalledWith('dashboards', expect.stringContaining('dash-'), expect.objectContaining({
        name: 'My Duplicate Layout'
      }));
    });
  });

  it('deletes template layout successfully', async () => {
    vi.mocked(dbService.delete).mockResolvedValue(undefined);
    vi.mocked(dbService.list).mockResolvedValue([]);
    localStorage.setItem('active_dashboard_test-user-id', 'dash-custom-1');

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByTitle('Delete Layout')).toBeInTheDocument();
    });

    const confirmSpy = vi.spyOn(window, 'confirm').mockImplementation(() => true);
    const deleteBtn = screen.getByTitle('Delete Layout');
    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalled();
      expect(dbService.delete).toHaveBeenCalledWith('dashboards', 'dash-custom-1');
      expect(localStorage.getItem('active_dashboard_test-user-id')).toBe('default');
    });
  });

  it('exports template successfully', async () => {
    vi.mocked(dbService.list).mockResolvedValue([]);
    const appendSpy = vi.spyOn(document.body, 'appendChild');

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByTitle('Export Template')).toBeInTheDocument();
    });

    const exportBtn = screen.getByTitle('Export Template');
    fireEvent.click(exportBtn);

    expect(appendSpy).toHaveBeenCalled();
  });

  it('imports template successfully', async () => {
    vi.mocked(dbService.addWithId).mockResolvedValue(undefined);
    
    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByTitle('Import Template')).toBeInTheDocument();
    });

    const fileInput = document.getElementById('import-dashboard-file-input') as HTMLInputElement;
    expect(fileInput).toBeInTheDocument();

    const fileContents = JSON.stringify({
      name: 'Imported Layout Test',
      widgets: [
        {
          widget_type: 'kpi_card',
          title: 'KPI test',
          x: 0, y: 0, w: 3, h: 2,
          settings: {},
          filters: {},
          order: 0,
          visible: true,
          locked: false
        }
      ]
    });
    const file = new File([fileContents], 'test.json', { type: 'application/json' });

    const readAsTextSpy = vi.spyOn(FileReader.prototype, 'readAsText').mockImplementation(function(this: FileReader) {
      if (this.onload) {
        this.onload({ target: { result: fileContents } } as any);
      }
    });

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(dbService.addWithId).toHaveBeenCalledWith('dashboards', expect.stringContaining('dash-'), expect.objectContaining({
        name: expect.stringContaining('Imported Layout Test')
      }));
    });
  });

  it('allows customizing Quick Access cards (replace, duplicate, delete)', async () => {
    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('Customize')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Customize'));

    // Select the shortcuts widget on canvas to open properties panel
    await waitFor(() => {
      expect(screen.getByText('Quick Access Shortcuts')).toBeInTheDocument();
    });
    const shortcutsWidget = screen.getByText('Quick Access Shortcuts').closest('.group');
    expect(shortcutsWidget).toBeInTheDocument();
    fireEvent.click(shortcutsWidget!);

    // Verify Customize Quick Access is displayed in properties panel
    await waitFor(() => {
      expect(screen.getByText('Customize Quick Access')).toBeInTheDocument();
    });

    // Test Deletion
    const deleteButtons = screen.getAllByRole('button');
    const crossButtons = deleteButtons.filter(b => b.textContent === '×');
    expect(crossButtons.length).toBeGreaterThan(0);
    
    // Delete the first card
    fireEvent.click(crossButtons[0]);

    // Test Duplication
    const duplicateButtons = screen.getAllByTitle('Duplicate');
    expect(duplicateButtons.length).toBeGreaterThan(0);
    fireEvent.click(duplicateButtons[0]);

    // Test Replace Page
    const replaceButtons = screen.getAllByText('Replace Page');
    expect(replaceButtons.length).toBeGreaterThan(0);
    fireEvent.click(replaceButtons[0]);

    // Search and select a page in searchable popup
    const searchInputs = screen.getAllByPlaceholderText('Search page to replace...');
    expect(searchInputs.length).toBeGreaterThan(0);
    fireEvent.change(searchInputs[0], { target: { value: 'Invoices' } });

    const pageOption = screen.getByText('Invoices');
    expect(pageOption).toBeInTheDocument();
    fireEvent.click(pageOption);
  });
});

