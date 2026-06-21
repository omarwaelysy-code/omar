import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Templates } from '../pages/Templates';
import { dbService } from '../services/dbService';

// Mock contexts
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'test-user-id',
      username: 'testuser',
      email: 'test@example.com',
      company_id: 'test-company-id'
    },
    isAuthenticated: true,
    isSuperAdmin: false,
    hasPermission: () => true
  })
}));

vi.mock('../contexts/LanguageContext', () => ({
  useLanguage: () => ({
    language: 'ar',
    t: (key: string) => key,
    dir: 'rtl'
  })
}));

// Mock dbService
vi.mock('../services/dbService', () => ({
  dbService: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    addWithId: vi.fn()
  },
  apiRequest: vi.fn()
}));

// Mock templateValidation to skip validation popups in test
vi.mock('../utils/templateValidation', () => ({
  validateTemplate: vi.fn().mockReturnValue([]),
  evaluateCondition: vi.fn().mockReturnValue(true)
}));

// Mock motion/react to avoid jsdom layout animation issues
vi.mock('motion/react', () => ({
  motion: {
    div: React.forwardRef(({ children, className, style, onClick, ...props }: any, ref: any) => (
      <div ref={ref} className={className} style={style} onClick={onClick} {...props}>
        {children}
      </div>
    )),
    span: React.forwardRef(({ children, className, style, ...props }: any, ref: any) => (
      <span ref={ref} className={className} style={style} {...props}>
        {children}
      </span>
    ))
  },
  AnimatePresence: ({ children }: any) => <>{children}</>
}));

describe('Templates Page - Designer Integrations', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mock values for dbService.list
    vi.mocked(dbService.list).mockImplementation(async (collection: string) => {
      if (collection === 'templates') return [];
      if (collection === 'paper_sizes') {
        return [
          { id: 'a4', name: 'A4', width: 210, height: 297, unit: 'mm', is_system: true, company_id: null }
        ];
      }
      if (collection === 'operation_categories') return [];
      if (collection === 'print_profiles') return [];
      return [];
    });
  });

  it('should toggle default and active checkboxes on click and render correctly', async () => {
    render(<Templates initialView="create" />);

    // Wait for the designer form elements to load after initial fetch
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/اسم القالب/i)).toBeInTheDocument();
    });

    const defaultCheckbox = screen.getByLabelText(/القالب الافتراضي/i) as HTMLInputElement;
    const activeCheckbox = screen.getByLabelText(/قالب نشط/i) as HTMLInputElement;

    expect(defaultCheckbox).toBeInTheDocument();
    expect(activeCheckbox).toBeInTheDocument();

    // Verify initial values in form state (is_default is false, is_active is true by default)
    expect(defaultCheckbox.checked).toBe(false);
    expect(activeCheckbox.checked).toBe(true);

    // Toggle default template checkbox
    fireEvent.click(defaultCheckbox);
    expect(defaultCheckbox.checked).toBe(true);

    // Toggle active template checkbox
    fireEvent.click(activeCheckbox);
    expect(activeCheckbox.checked).toBe(false);

    // Toggle default template checkbox back to false
    fireEvent.click(defaultCheckbox);
    expect(defaultCheckbox.checked).toBe(false);
  });

  it('should send the correct is_default and is_active values to the API on save', async () => {
    vi.mocked(dbService.create).mockResolvedValue('new-template-id');

    render(<Templates initialView="create" />);

    // Wait for elements to load
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/اسم القالب/i)).toBeInTheDocument();
    });

    // Fill name input
    const nameInput = screen.getByPlaceholderText(/اسم القالب/i);
    fireEvent.change(nameInput, { target: { value: 'My Print Template' } });

    const defaultCheckbox = screen.getByLabelText(/القالب الافتراضي/i) as HTMLInputElement;
    const activeCheckbox = screen.getByLabelText(/قالب نشط/i) as HTMLInputElement;

    // Toggle default template checkbox to true
    fireEvent.click(defaultCheckbox);
    // Toggle active template checkbox to false
    fireEvent.click(activeCheckbox);

    // Click main save design button to trigger validation/save dialog
    const saveDesignButton = screen.getByText(/حفظ التصميم/i);
    fireEvent.click(saveDesignButton);

    // Wait for save modal/dialog option to proceed and click the save version button
    await waitFor(() => {
      expect(screen.getByText(/حفظ الإصدار والتصميم/i)).toBeInTheDocument();
    });

    const proceedButton = screen.getByText(/حفظ الإصدار والتصميم/i);
    fireEvent.click(proceedButton);

    await waitFor(() => {
      expect(dbService.create).toHaveBeenCalled();
    });

    // Check that dbService.create was called with our target payload containing true/false states
    const createCall = vi.mocked(dbService.create).mock.calls.find(call => call[0] === 'templates');
    expect(createCall).toBeDefined();
    
    const payload = createCall![1];
    expect(payload).toEqual(expect.objectContaining({
      name: 'My Print Template',
      is_default: true,
      is_active: false
    }));
  });

  it('should load template dynamically when document type is changed and template exists', async () => {
    const mockOrderTemplate = {
      id: 'order-template-id',
      name: 'Sales Order Template',
      description: 'Order layout',
      paper_size_id: 'a4',
      orientation: 'portrait',
      margin_top: 15,
      margin_bottom: 15,
      margin_left: 15,
      margin_right: 15,
      is_active: true,
      is_default: true,
      document_type: 'sales_orders',
      layout: {
        headerHeight: 80,
        footerHeight: 40,
        header: [{ id: 'el-1', type: 'text', x: 10, y: 10, width: 20, height: 10, properties: { text: 'Sales Order Title' } }],
        details: { mode: 'table', columns: [], properties: {} },
        footer: []
      }
    };

    vi.mocked(dbService.list).mockImplementation(async (collection: string) => {
      if (collection === 'templates') return [mockOrderTemplate];
      if (collection === 'paper_sizes') {
        return [{ id: 'a4', name: 'A4', width: 210, height: 297, unit: 'mm', is_system: true, company_id: null }];
      }
      if (collection === 'operation_categories') {
        return [{ id: 'cat-order-id', name: 'Sales Orders Category', code: 'sales_orders', parent_id: null, is_final: true, company_id: 'test-company-id' }];
      }
      return [];
    });

    render(<Templates initialView="create" />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/اسم القالب/i)).toBeInTheDocument();
    });

    const docTypeSelect = screen.getByLabelText(/نوع المستند/i) as HTMLSelectElement;
    expect(docTypeSelect).toBeInTheDocument();

    // Since the form is empty, hasUnsavedChanges is false, so it should change document type immediately
    fireEvent.change(docTypeSelect, { target: { value: 'sales_orders' } });

    // Verify that the template was loaded into the form
    await waitFor(() => {
      expect(screen.getByDisplayValue('Sales Order Template')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Order layout')).toBeInTheDocument();
    });
  });

  it('should clear canvas and load clean canvas when document type is changed and template does not exist', async () => {
    render(<Templates initialView="create" />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/اسم القالب/i)).toBeInTheDocument();
    });

    const docTypeSelect = screen.getByLabelText(/نوع المستند/i) as HTMLSelectElement;
    
    // Change to purchase returns (which doesn't have any template)
    fireEvent.change(docTypeSelect, { target: { value: 'purchase_returns' } });

    // Verify the name input is blank and document type is purchase_returns
    await waitFor(() => {
      expect((screen.getByPlaceholderText(/اسم القالب/i) as HTMLInputElement).value).toBe('');
      expect(docTypeSelect.value).toBe('purchase_returns');
    });
  });

  it('should show unsaved changes confirmation modal when dirty document type is changed', async () => {
    render(<Templates initialView="create" />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/اسم القالب/i)).toBeInTheDocument();
    });

    // Make the form dirty by changing template name
    const nameInput = screen.getByPlaceholderText(/اسم القالب/i);
    fireEvent.change(nameInput, { target: { value: 'Dirty Template' } });

    const docTypeSelect = screen.getByLabelText(/نوع المستند/i) as HTMLSelectElement;
    
    // Change doc type
    fireEvent.change(docTypeSelect, { target: { value: 'sales_orders' } });

    // Verify unsaved changes modal is displayed
    await waitFor(() => {
      expect(screen.getByText(/تعديلات غير محفوظة/i)).toBeInTheDocument();
    });

    // Discard changes
    const discardButton = screen.getByText(/تجاهل التغييرات/i);
    fireEvent.click(discardButton);

    // Verify modal is closed and doc type switched
    await waitFor(() => {
      expect(screen.queryByText(/تعديلات غير محفوظة/i)).not.toBeInTheDocument();
      expect(docTypeSelect.value).toBe('sales_orders');
    });
  });

  it('should add static elements centered on the canvas when clicked', async () => {
    const { container } = render(<Templates initialView="create" />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/اسم القالب/i)).toBeInTheDocument();
    });

    // Add Text element by clicking it
    const textTool = screen.getByText('نص ثابت');
    const clickableContainer = textTool.closest('.cursor-grab') || textTool;
    fireEvent.click(clickableContainer);

    // Verify text element is rendered
    await waitFor(() => {
      expect(screen.getAllByText('نص ثابت / Text').length).toBeGreaterThanOrEqual(1);
    });

    // Add QR Code element by clicking it
    const qrTool = screen.getByText('QR Code');
    fireEvent.click(qrTool.closest('.cursor-grab') || qrTool);

    // Verify that elements are present in the canvas
    await waitFor(() => {
      const canvasElements = document.querySelectorAll('.cursor-move');
      expect(canvasElements.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('should support Drag & Drop of static elements onto the canvas', async () => {
    const { container } = render(<Templates initialView="create" />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/اسم القالب/i)).toBeInTheDocument();
    });

    // Mock getBoundingClientRect for canvas drop target
    const originalGetBoundingClientRect = Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect = vi.fn().mockImplementation(function (this: Element) {
      if (this.textContent?.includes('Header / الهيدر')) {
        return { left: 100, top: 100, width: 600, height: 300, bottom: 400, right: 700 } as DOMRect;
      }
      return originalGetBoundingClientRect.call(this);
    });

    const dropZone = screen.getByText(/Header \/ الهيدر/i).parentElement;
    expect(dropZone).toBeInTheDocument();

    const dataTransfer = {
      getData: vi.fn().mockImplementation((format: string) => {
        if (format === 'application/json' || format === 'text/plain') {
          return JSON.stringify({ type: 'circle' });
        }
        return '';
      })
    };

    // Create a custom Event to bypass JSDOM read-only property restrictions
    const event = new Event('drop', {
      bubbles: true,
      cancelable: true,
    } as any);
    Object.defineProperty(event, 'clientX', { value: 240 }); // rect.left (100) + 140
    Object.defineProperty(event, 'clientY', { value: 170 }); // rect.top (100) + 70
    Object.defineProperty(event, 'dataTransfer', { value: dataTransfer });

    fireEvent(dropZone!, event);

    // Verify circle element was added to the canvas at coordinates (40, 20) => left: 140px, top: 70px
    await waitFor(() => {
      const circleEl = container.querySelector('[style*="left: 140px"]');
      expect(circleEl).toBeInTheDocument();
    });

    // Restore original getBoundingClientRect
    Element.prototype.getBoundingClientRect = originalGetBoundingClientRect;
  });
});

