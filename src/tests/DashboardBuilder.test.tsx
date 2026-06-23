import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { DashboardBuilder } from '../pages/DashboardBuilder';
import { dbService } from '../services/dbService';

// Mock contexts
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
    activeTabId: 'dashboard_designer',
    setCurrentPage: vi.fn()
  })
}));

vi.mock('../contexts/LanguageContext', () => ({
  useLanguage: () => ({
    language: 'en',
    t: (key: string) => {
      const keys: { [k: string]: string } = {
        'dashboard.title': 'Dashboard',
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

describe('DashboardBuilder Page - Drag & Drop Visual Designer', () => {
  const mockDashboard = {
    id: 'dash-123',
    company_id: 'test-company-id',
    owner_user_id: 'test-user-id',
    name: 'My Custom Dashboard',
    description: 'Customized layout description',
    is_default: true,
    is_system: false,
    icon: 'LayoutDashboard',
    widgets: [
      {
        id: 'widget-kpi-1',
        dashboard_id: 'dash-123',
        widget_type: 'kpi_card',
        title: 'Net Profit Metric',
        x: 0,
        y: 0,
        w: 3,
        h: 2,
        settings: { dataSource: 'invoices', page: 0 },
        filters: {},
        order: 0,
        visible: true,
        locked: false
      }
    ]
  };

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(dbService.getOrCreateDefaultDashboard).mockResolvedValue(mockDashboard);
    vi.mocked(dbService.list).mockResolvedValue(mockDashboard.widgets);
    vi.mocked(dbService.update).mockResolvedValue(undefined);
    vi.mocked(dbService.addWithId).mockResolvedValue(undefined);
    vi.mocked(dbService.delete).mockResolvedValue(undefined);
    vi.mocked(dbService.getWidgetDataSources).mockResolvedValue({
      invoices: ['id', 'company_id', 'total_amount', 'date', 'customer_name']
    });
  });

  it('renders all designer panels correctly (Properties, Canvas, Library)', async () => {
    render(<DashboardBuilder />);

    // Wait for the mock dashboard layout to load
    await waitFor(() => {
      expect(screen.getByText('Net Profit Metric')).toBeInTheDocument();
    });

    // Check Right Panel (Widget Catalog Library) search & widgets
    expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument();
    expect(screen.getAllByText(/KPI Card/i)[0]).toBeInTheDocument();

    // Check Left Panel (Properties Panel) default header or tabs
    expect(screen.getByText(/Dashboard Properties/i)).toBeInTheDocument();

    // Check Toolbar actions by their title attributes
    expect(screen.getByTitle(/Undo/i)).toBeInTheDocument();
    expect(screen.getByTitle(/Redo/i)).toBeInTheDocument();
  });

  it('selects a widget on click and displays its properties in the Left Panel', async () => {
    render(<DashboardBuilder />);

    await waitFor(() => {
      expect(screen.getByText('Net Profit Metric')).toBeInTheDocument();
    });

    // Click on the widget card in canvas to select it
    const widgetCard = screen.getByText('Net Profit Metric').closest('div');
    expect(widgetCard).toBeTruthy();
    if (widgetCard) {
      fireEvent.click(widgetCard);
    }

    // Verify properties panel updates with widget information
    expect(screen.getByDisplayValue('Net Profit Metric')).toBeInTheDocument();
    
    // Switch properties tab to 'Data' by finding the exact button by text content
    const buttons = screen.getAllByRole('button');
    const dataTabButton = buttons.find(b => b.textContent === 'Data');
    expect(dataTabButton).toBeTruthy();
    if (dataTabButton) {
      fireEvent.click(dataTabButton);
    }
    
    // Check data source select box visible display value
    await waitFor(() => {
      expect(screen.getByDisplayValue('Sales Invoices')).toBeInTheDocument();
    });
  });

  it('supports modifying widget properties (e.g. Title, background color)', async () => {
    render(<DashboardBuilder />);

    await waitFor(() => {
      expect(screen.getByText('Net Profit Metric')).toBeInTheDocument();
    });

    // Select the widget
    const widgetCard = screen.getByText('Net Profit Metric').closest('div');
    if (widgetCard) fireEvent.click(widgetCard);

    // Modify the title input field
    const titleInput = screen.getByDisplayValue('Net Profit Metric') as HTMLInputElement;
    fireEvent.change(titleInput, { target: { value: 'Updated Revenue KPI' } });

    // Verify change is reflected in properties panel and designer canvas
    expect(screen.getByDisplayValue('Updated Revenue KPI')).toBeInTheDocument();
  });

  it('allows adding a widget from the Catalog Library to the Canvas grid', async () => {
    render(<DashboardBuilder />);

    await waitFor(() => {
      expect(screen.getByText('Net Profit Metric')).toBeInTheDocument();
    });

    // Find the Line Chart library card and click its specific "Add to Grid" button
    const lineChartLabel = screen.getByText('Line Chart');
    let cardContainer = lineChartLabel.parentElement;
    while (cardContainer && !cardContainer.querySelector('[title="Add to Grid"]')) {
      cardContainer = cardContainer.parentElement;
    }
    
    const addBtn = within(cardContainer!).getByTitle('Add to Grid');
    fireEvent.click(addBtn);

    // Check that a new widget with title 'Line Chart' is created and added to the canvas list (total 3 occurrences of "Line Chart")
    await waitFor(() => {
      expect(screen.getAllByText(/Line Chart/i).length).toBe(3);
    });
  });
});
