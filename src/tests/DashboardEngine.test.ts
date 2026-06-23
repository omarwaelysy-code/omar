import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DashboardService } from '../services/DashboardService';
import pool from '../lib/postgres';

// Mock the postgres pool
vi.mock('../lib/postgres', () => {
  const mockClient = {
    query: vi.fn(),
    release: vi.fn(),
  };
  return {
    default: {
      connect: vi.fn(() => Promise.resolve(mockClient)),
      query: vi.fn(),
    },
  };
});

describe('DashboardService (Unit Tests)', () => {
  let mockClient: any;
  let queryMockResponse: (sql: string, params?: any[]) => any;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockClient = await pool.connect();
    
    // Interceptor to handle BEGIN/COMMIT/ROLLBACK transparently
    // and route other queries to the test-defined queryMockResponse
    mockClient.query.mockImplementation((sql: string, params?: any[]) => {
      const upper = sql.toUpperCase().trim();
      if (upper === 'BEGIN' || upper === 'COMMIT' || upper === 'ROLLBACK') {
        return Promise.resolve({ rows: [], rowCount: 0 });
      }
      if (queryMockResponse) {
        try {
          const res = queryMockResponse(sql, params);
          return Promise.resolve(res);
        } catch (err) {
          return Promise.reject(err);
        }
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });
  });

  describe('getDashboardWithWidgets', () => {
    it('should return null if dashboard does not exist', async () => {
      queryMockResponse = () => ({ rows: [] });

      const result = await DashboardService.getDashboardWithWidgets('dash-1', 'comp-1');

      expect(result).toBeNull();
    });

    it('should return dashboard and its widgets with parsed settings/filters', async () => {
      queryMockResponse = (sql) => {
        if (sql.includes('SELECT * FROM dashboards')) {
          return { rows: [{ id: 'dash-1', company_id: 'comp-1', name: 'Sales Dash', is_default: true }] };
        }
        if (sql.includes('SELECT * FROM widgets')) {
          return {
            rows: [
              { id: 'w-1', dashboard_id: 'dash-1', widget_type: 'kpi_card', title: 'KPI', x: 0, y: 0, w: 3, h: 2, settings: '{"metric":"revenue"}', filters: '{"date":"today"}', order: 0 }
            ]
          };
        }
        return { rows: [] };
      };

      const result = await DashboardService.getDashboardWithWidgets('dash-1', 'comp-1');

      expect(result).not.toBeNull();
      expect(result.id).toBe('dash-1');
      expect(result.widgets).toHaveLength(1);
      expect(result.widgets[0].settings).toEqual({ metric: 'revenue' });
      expect(result.widgets[0].filters).toEqual({ date: 'today' });
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('getOrCreateDefaultDashboard', () => {
    it('should return existing default dashboard if it exists', async () => {
      queryMockResponse = (sql) => {
        if (sql.includes('SELECT id FROM dashboards')) {
          return { rows: [{ id: 'dash-existing' }] };
        }
        if (sql.includes('SELECT * FROM dashboards')) {
          return { rows: [{ id: 'dash-existing', name: 'My Dashboard', is_default: true }] };
        }
        if (sql.includes('SELECT * FROM widgets')) {
          return { rows: [] };
        }
        return { rows: [] };
      };

      const result = await DashboardService.getOrCreateDefaultDashboard('comp-1', 'user-1');

      expect(result.id).toBe('dash-existing');
    });

    it('should clone template when no user default exists', async () => {
      queryMockResponse = (sql, params) => {
        if (sql.includes('owner_user_id = $2')) {
          return { rows: [] }; // no user default
        }
        if (sql.includes('owner_user_id IS NULL')) {
          return { rows: [{ id: 'company-template-id' }] }; // template found
        }
        if (sql.includes('SELECT * FROM dashboards') && sql.includes('WHERE id = $1')) {
          if (params && params[0] === 'company-template-id') {
            return { rows: [{ id: 'company-template-id', name: 'Template Workspace', icon: 'Layout' }] };
          }
          // Final fetch inside getDashboardWithWidgets
          return { rows: [{ id: 'new-dash-id', name: 'Template Workspace', is_default: true }] };
        }
        if (sql.includes('SELECT * FROM widgets')) {
          if (params && params[0] === 'company-template-id') {
            return {
              rows: [
                { widget_type: 'kpi_card', title: 'KPI', x: 0, y: 0, w: 3, h: 2, settings: { a: 1 }, filters: {}, order: 0 }
              ]
            };
          }
          // Final widgets fetch
          return {
            rows: [
              { id: 'new-w-id', widget_type: 'kpi_card', title: 'KPI', x: 0, y: 0, w: 3, h: 2, settings: '{"a":1}', filters: '{}', order: 0 }
            ]
          };
        }
        if (sql.includes('INSERT INTO dashboards') || sql.includes('INSERT INTO widgets')) {
          return { rows: [] };
        }
        return { rows: [] };
      };

      const result = await DashboardService.getOrCreateDefaultDashboard('comp-1', 'user-1');

      expect(result.name).toBe('Template Workspace');
      expect(result.widgets).toHaveLength(1);
      expect(result.widgets[0].settings).toEqual({ a: 1 });
    });
  });

  describe('duplicateDashboard', () => {
    it('should clone dashboard and widgets under a new name', async () => {
      queryMockResponse = (sql, params) => {
        if (sql.includes('SELECT * FROM dashboards') && sql.includes('WHERE id = $1')) {
          if (params && params[0] === 'orig-id') {
            return { rows: [{ id: 'orig-id', name: 'Original', icon: 'Icon', description: 'Desc' }] };
          }
          return { rows: [{ id: 'new-dash-id', name: 'New Copy', is_default: false }] };
        }
        if (sql.includes('SELECT * FROM widgets')) {
          return { rows: [{ widget_type: 'bar_chart', title: 'Chart', x: 0, y: 0, w: 6, h: 4, order: 0 }] };
        }
        if (sql.includes('INSERT INTO dashboards') || sql.includes('INSERT INTO widgets')) {
          return { rows: [] };
        }
        return { rows: [] };
      };

      const result = await DashboardService.duplicateDashboard('orig-id', 'comp-1', 'user-1', 'New Copy');

      expect(result.name).toBe('New Copy');
      expect(result.widgets).toHaveLength(1);
    });
  });

  describe('saveAsTemplate', () => {
    it('should save a copy of the dashboard with owner_user_id set to null', async () => {
      queryMockResponse = (sql, params) => {
        if (sql.includes('SELECT * FROM dashboards') && sql.includes('WHERE id = $1')) {
          if (params && params[0] === 'orig-id') {
            return { rows: [{ id: 'orig-id', name: 'Original', icon: 'Icon' }] };
          }
          return { rows: [{ id: 'template-id', name: 'Template Name', owner_user_id: null, is_default: false }] };
        }
        if (sql.includes('SELECT * FROM widgets')) {
          return { rows: [] };
        }
        if (sql.includes('INSERT INTO dashboards')) {
          return { rows: [] };
        }
        return { rows: [] };
      };

      const result = await DashboardService.saveAsTemplate('orig-id', 'comp-1', 'Template Name');

      expect(result.owner_user_id).toBeNull();
      expect(result.name).toBe('Template Name');
    });
  });

  describe('exportDashboard', () => {
    it('should export dashboard and widgets structure as a clean JSON object', async () => {
      queryMockResponse = (sql) => {
        if (sql.includes('SELECT * FROM dashboards')) {
          return { rows: [{ id: 'dash-1', name: 'Sales Dashboard', description: 'Main Sales', icon: 'Dollar' }] };
        }
        if (sql.includes('SELECT * FROM widgets')) {
          return {
            rows: [
              { widget_type: 'kpi_card', title: 'Sales KPI', x: 0, y: 0, w: 3, h: 2, settings: '{"metric":"sales"}', filters: '{}', order: 0 }
            ]
          };
        }
        return { rows: [] };
      };

      const result = await DashboardService.exportDashboard('dash-1', 'comp-1');

      expect(result).toEqual({
        name: 'Sales Dashboard',
        description: 'Main Sales',
        icon: 'Dollar',
        widgets: [
          {
            widget_type: 'kpi_card',
            title: 'Sales KPI',
            x: 0,
            y: 0,
            w: 3,
            h: 2,
            settings: { metric: 'sales' },
            filters: {},
            order: 0,
            visible: undefined,
            locked: undefined
          }
        ]
      });
    });
  });

  describe('importDashboard', () => {
    it('should recreate dashboard and widgets from imported JSON structure', async () => {
      const importPayload = {
        name: 'Imported Dash',
        description: 'Imported Description',
        icon: 'TrendingUp',
        widgets: [
          { widget_type: 'pie_chart', title: 'Profit Ratio', x: 0, y: 0, w: 4, h: 4, settings: { ratio: true }, filters: {}, order: 0 }
        ]
      };

      queryMockResponse = (sql) => {
        if (sql.includes('INSERT INTO dashboards') || sql.includes('INSERT INTO widgets')) {
          return { rows: [] };
        }
        // Final fetch inside getDashboardWithWidgets
        if (sql.includes('SELECT * FROM dashboards')) {
          return { rows: [{ id: 'new-imported-id', name: 'Imported Dash' }] };
        }
        if (sql.includes('SELECT * FROM widgets')) {
          return {
            rows: [
              { widget_type: 'pie_chart', title: 'Profit Ratio', x: 0, y: 0, w: 4, h: 4, settings: '{"ratio":true}', filters: '{}', order: 0 }
            ]
          };
        }
        return { rows: [] };
      };

      const result = await DashboardService.importDashboard(importPayload, 'comp-1', 'user-1');

      expect(result.name).toBe('Imported Dash');
      expect(result.widgets).toHaveLength(1);
      expect(result.widgets[0].settings).toEqual({ ratio: true });
    });
  });

  describe('resetDashboard', () => {
    it('should delete existing widgets and clone widgets from template default dashboard', async () => {
      queryMockResponse = (sql, params) => {
        if (sql.includes('SELECT * FROM dashboards') && sql.includes('WHERE id = $1')) {
          return { rows: [{ id: 'dash-to-reset', company_id: 'comp-1' }] };
        }
        if (sql.includes('SELECT id FROM dashboards') && sql.includes('owner_user_id IS NULL')) {
          return { rows: [{ id: 'template-default-id' }] };
        }
        if (sql.includes('DELETE FROM widgets')) {
          return { rows: [] };
        }
        if (sql.includes('SELECT * FROM widgets') && sql.includes('WHERE dashboard_id = $1') && !sql.includes('dash-to-reset')) {
          // Fetch template widgets
          return { rows: [{ widget_type: 'kpi_card', title: 'Reset KPI', x: 0, y: 0, w: 3, h: 2, order: 0 }] };
        }
        if (sql.includes('INSERT INTO widgets')) {
          return { rows: [] };
        }
        // Final fetch inside getDashboardWithWidgets
        if (sql.includes('SELECT * FROM dashboards') && sql.includes('company_id = $2')) {
          return { rows: [{ id: 'dash-to-reset' }] };
        }
        if (sql.includes('SELECT * FROM widgets') && sql.includes('dashboard_id = $1')) {
          return {
            rows: [
              { widget_type: 'kpi_card', title: 'Reset KPI', x: 0, y: 0, w: 3, h: 2, settings: '{}', filters: '{}', order: 0 }
            ]
          };
        }
        return { rows: [] };
      };

      const result = await DashboardService.resetDashboard('dash-to-reset', 'comp-1');

      expect(result.id).toBe('dash-to-reset');
      expect(result.widgets).toHaveLength(1);
      expect(result.widgets[0].title).toBe('Reset KPI');
    });
  });

  describe('reorderWidgets', () => {
    it('should update multiple widgets in a transaction', async () => {
      queryMockResponse = (sql) => {
        if (sql.includes('SELECT 1 FROM dashboards')) {
          return { rows: [{ 1: 1 }] };
        }
        if (sql.includes('UPDATE widgets')) {
          return { rows: [], rowCount: 1 };
        }
        return { rows: [] };
      };

      const orders = [
        { id: 'w-1', x: 0, y: 0, w: 3, h: 2, order: 0 },
        { id: 'w-2', x: 3, y: 0, w: 3, h: 2, order: 1 }
      ];

      const success = await DashboardService.reorderWidgets('dash-1', 'comp-1', orders);

      expect(success).toBe(true);
    });
  });
});
