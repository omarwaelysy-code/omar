import pool from '../lib/postgres';
import { v4 as uuidv4 } from 'uuid';
import { Dashboard, Widget } from '../types';

export class DashboardService {
  /**
   * Helper to parse JSON fields safely
   */
  private static parseJsonField(val: any): any {
    if (val === null || val === undefined) return {};
    if (typeof val === 'object') return val;
    try {
      return JSON.parse(val);
    } catch {
      return {};
    }
  }

  /**
   * Fetches a dashboard and all its widgets
   */
  static async getDashboardWithWidgets(dashboardId: string, companyId: string): Promise<any> {
    const client = await pool.connect();
    try {
      const dashRes = await client.query(
        'SELECT * FROM dashboards WHERE id = $1 AND (company_id = $2 OR company_id = \'SYSTEM\')',
        [dashboardId, companyId]
      );
      const dashboard = dashRes.rows[0];
      if (!dashboard) return null;

      const widgetRes = await client.query(
        'SELECT * FROM widgets WHERE dashboard_id = $1 ORDER BY "order" ASC, created_at ASC',
        [dashboardId]
      );

      const widgets = widgetRes.rows.map((w: any) => ({
        ...w,
        settings: this.parseJsonField(w.settings),
        filters: this.parseJsonField(w.filters)
      }));

      return {
        ...dashboard,
        widgets
      };
    } finally {
      client.release();
    }
  }

  /**
   * Gets user default dashboard or clones system defaults if none exists
   */
  static async getOrCreateDefaultDashboard(companyId: string, userId: string): Promise<any> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Look for user-owned default dashboard
      const userDashRes = await client.query(
        'SELECT id FROM dashboards WHERE company_id = $1 AND owner_user_id = $2 AND is_default = true LIMIT 1',
        [companyId, userId]
      );

      if (userDashRes.rows.length > 0) {
        await client.query('COMMIT');
        return this.getDashboardWithWidgets(userDashRes.rows[0].id, companyId);
      }

      // 2. Look for company-specific template
      let templateDashId: string | null = null;
      const compTemplateRes = await client.query(
        'SELECT id FROM dashboards WHERE company_id = $1 AND owner_user_id IS NULL AND is_default = true LIMIT 1',
        [companyId]
      );

      if (compTemplateRes.rows.length > 0) {
        templateDashId = compTemplateRes.rows[0].id;
      } else {
        // 3. Look for system-wide template
        const sysTemplateRes = await client.query(
          'SELECT id FROM dashboards WHERE company_id = \'SYSTEM\' AND owner_user_id IS NULL AND is_default = true LIMIT 1'
        );
        if (sysTemplateRes.rows.length > 0) {
          templateDashId = sysTemplateRes.rows[0].id;
        }
      }

      const newDashboardId = uuidv4();

      if (templateDashId) {
        // Clone template dashboard header
        const templateRes = await client.query('SELECT * FROM dashboards WHERE id = $1', [templateDashId]);
        const template = templateRes.rows[0];

        await client.query(
          `INSERT INTO dashboards (id, company_id, owner_user_id, name, description, is_default, is_system, icon)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            newDashboardId,
            companyId,
            userId,
            template.name || 'My Dashboard',
            template.description || 'Customized workspace dashboard',
            true,
            false,
            template.icon || 'LayoutDashboard'
          ]
        );

        // Clone template widgets
        const widgetsRes = await client.query('SELECT * FROM widgets WHERE dashboard_id = $1', [templateDashId]);
        for (const w of widgetsRes.rows) {
          await client.query(
            `INSERT INTO widgets (id, dashboard_id, widget_type, title, x, y, w, h, settings, filters, "order", visible, locked)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
            [
              uuidv4(),
              newDashboardId,
              w.widget_type,
              w.title,
              w.x,
              w.y,
              w.w,
              w.h,
              JSON.stringify(w.settings || {}),
              JSON.stringify(w.filters || {}),
              w.order || 0,
              w.visible !== false,
              w.locked === true
            ]
          );
        }
      } else {
        // Fallback: create empty default dashboard
        await client.query(
          `INSERT INTO dashboards (id, company_id, owner_user_id, name, description, is_default, is_system, icon)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            newDashboardId,
            companyId,
            userId,
            'My Dashboard',
            'Customized workspace dashboard',
            true,
            false,
            'LayoutDashboard'
          ]
        );
      }

      await client.query('COMMIT');
      return this.getDashboardWithWidgets(newDashboardId, companyId);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Duplicates an existing dashboard and all its widgets for a user
   */
  static async duplicateDashboard(
    dashboardId: string,
    companyId: string,
    userId: string,
    newName: string,
    newDescription?: string
  ): Promise<any> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const dashRes = await client.query(
        'SELECT * FROM dashboards WHERE id = $1 AND (company_id = $2 OR company_id = \'SYSTEM\')',
        [dashboardId, companyId]
      );
      const original = dashRes.rows[0];
      if (!original) throw new Error('Dashboard not found');

      const newDashboardId = uuidv4();

      await client.query(
        `INSERT INTO dashboards (id, company_id, owner_user_id, name, description, is_default, is_system, icon)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          newDashboardId,
          companyId,
          userId,
          newName,
          newDescription || original.description || `Copy of ${original.name}`,
          false,
          false,
          original.icon || 'LayoutDashboard'
        ]
      );

      // Clone widgets
      const widgetsRes = await client.query('SELECT * FROM widgets WHERE dashboard_id = $1', [dashboardId]);
      for (const w of widgetsRes.rows) {
        await client.query(
          `INSERT INTO widgets (id, dashboard_id, widget_type, title, x, y, w, h, settings, filters, "order", visible, locked)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
          [
            uuidv4(),
            newDashboardId,
            w.widget_type,
            w.title,
            w.x,
            w.y,
            w.w,
            w.h,
            JSON.stringify(w.settings || {}),
            JSON.stringify(w.filters || {}),
            w.order || 0,
            w.visible !== false,
            w.locked === true
          ]
        );
      }

      await client.query('COMMIT');
      return this.getDashboardWithWidgets(newDashboardId, companyId);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Saves a dashboard layout as a reusable template
   */
  static async saveAsTemplate(
    dashboardId: string,
    companyId: string,
    name: string,
    description?: string
  ): Promise<any> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const dashRes = await client.query(
        'SELECT * FROM dashboards WHERE id = $1 AND company_id = $2',
        [dashboardId, companyId]
      );
      const original = dashRes.rows[0];
      if (!original) throw new Error('Dashboard not found');

      const templateId = uuidv4();

      await client.query(
        `INSERT INTO dashboards (id, company_id, owner_user_id, name, description, is_default, is_system, icon)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          templateId,
          companyId,
          null, // Null owner makes it a reusable template
          name,
          description || original.description || `Template created from ${original.name}`,
          false,
          false,
          original.icon || 'LayoutDashboard'
        ]
      );

      // Clone widgets
      const widgetsRes = await client.query('SELECT * FROM widgets WHERE dashboard_id = $1', [dashboardId]);
      for (const w of widgetsRes.rows) {
        await client.query(
          `INSERT INTO widgets (id, dashboard_id, widget_type, title, x, y, w, h, settings, filters, "order", visible, locked)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
          [
            uuidv4(),
            templateId,
            w.widget_type,
            w.title,
            w.x,
            w.y,
            w.w,
            w.h,
            JSON.stringify(w.settings || {}),
            JSON.stringify(w.filters || {}),
            w.order || 0,
            w.visible !== false,
            w.locked === true
          ]
        );
      }

      await client.query('COMMIT');
      return this.getDashboardWithWidgets(templateId, companyId);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Prepares dashboard configuration as a portable JSON object
   */
  static async exportDashboard(dashboardId: string, companyId: string): Promise<any> {
    const data = await this.getDashboardWithWidgets(dashboardId, companyId);
    if (!data) throw new Error('Dashboard not found');

    return {
      name: data.name,
      description: data.description,
      icon: data.icon,
      widgets: data.widgets.map((w: any) => ({
        widget_type: w.widget_type,
        title: w.title,
        x: w.x,
        y: w.y,
        w: w.w,
        h: w.h,
        settings: w.settings,
        filters: w.filters,
        order: w.order,
        visible: w.visible,
        locked: w.locked
      }))
    };
  }

  /**
   * Imports a dashboard and all its widgets from JSON configuration
   */
  static async importDashboard(importData: any, companyId: string, userId: string): Promise<any> {
    if (!importData || !importData.name) {
      throw new Error('Invalid import configuration: name is required');
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const newDashboardId = uuidv4();

      await client.query(
        `INSERT INTO dashboards (id, company_id, owner_user_id, name, description, is_default, is_system, icon)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          newDashboardId,
          companyId,
          userId,
          importData.name,
          importData.description || 'Imported dashboard layout',
          false,
          false,
          importData.icon || 'LayoutDashboard'
        ]
      );

      // Insert widgets
      if (Array.isArray(importData.widgets)) {
        for (const w of importData.widgets) {
          await client.query(
            `INSERT INTO widgets (id, dashboard_id, widget_type, title, x, y, w, h, settings, filters, "order", visible, locked)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
            [
              uuidv4(),
              newDashboardId,
              w.widget_type,
              w.title,
              w.x || 0,
              w.y || 0,
              w.w || 3,
              w.h || 2,
              JSON.stringify(w.settings || {}),
              JSON.stringify(w.filters || {}),
              w.order || 0,
              w.visible !== false,
              w.locked === true
            ]
          );
        }
      }

      await client.query('COMMIT');
      return this.getDashboardWithWidgets(newDashboardId, companyId);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Resets a dashboard layout to template defaults (company default or system default)
   */
  static async resetDashboard(dashboardId: string, companyId: string): Promise<any> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Get original dashboard details
      const dashRes = await client.query(
        'SELECT * FROM dashboards WHERE id = $1 AND company_id = $2',
        [dashboardId, companyId]
      );
      const dashboard = dashRes.rows[0];
      if (!dashboard) throw new Error('Dashboard not found');

      // 2. Find template to reset to
      let templateId: string | null = null;

      // Check company default template first
      const compTemplateRes = await client.query(
        'SELECT id FROM dashboards WHERE company_id = $1 AND owner_user_id IS NULL AND is_default = true LIMIT 1',
        [companyId]
      );
      if (compTemplateRes.rows.length > 0) {
        templateId = compTemplateRes.rows[0].id;
      } else {
        // Fallback to system template
        const sysTemplateRes = await client.query(
          'SELECT id FROM dashboards WHERE company_id = \'SYSTEM\' AND owner_user_id IS NULL AND is_default = true LIMIT 1'
        );
        if (sysTemplateRes.rows.length > 0) {
          templateId = sysTemplateRes.rows[0].id;
        }
      }

      // 3. Clear existing widgets
      await client.query('DELETE FROM widgets WHERE dashboard_id = $1', [dashboardId]);

      // 4. Clone widgets from template if template was found
      if (templateId) {
        const widgetsRes = await client.query('SELECT * FROM widgets WHERE dashboard_id = $1', [templateId]);
        for (const w of widgetsRes.rows) {
          await client.query(
            `INSERT INTO widgets (id, dashboard_id, widget_type, title, x, y, w, h, settings, filters, "order", visible, locked)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
            [
              uuidv4(),
              dashboardId,
              w.widget_type,
              w.title,
              w.x,
              w.y,
              w.w,
              w.h,
              JSON.stringify(w.settings || {}),
              JSON.stringify(w.filters || {}),
              w.order || 0,
              w.visible !== false,
              w.locked === true
            ]
          );
        }
      }

      await client.query('COMMIT');
      return this.getDashboardWithWidgets(dashboardId, companyId);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Updates multiple widgets' position and order in a bulk transaction
   */
  static async reorderWidgets(
    dashboardId: string,
    companyId: string,
    orders: { id: string; x: number; y: number; w: number; h: number; order: number }[]
  ): Promise<boolean> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Verify dashboard ownership/access
      const dashCheck = await client.query(
        'SELECT 1 FROM dashboards WHERE id = $1 AND company_id = $2',
        [dashboardId, companyId]
      );
      if (dashCheck.rows.length === 0) throw new Error('Dashboard access denied or not found');

      for (const item of orders) {
        await client.query(
          `UPDATE widgets 
           SET x = $1, y = $2, w = $3, h = $4, "order" = $5, updated_at = CURRENT_TIMESTAMP
           WHERE id = $6 AND dashboard_id = $7`,
          [item.x, item.y, item.w, item.h, item.order, item.id, dashboardId]
        );
      }

      await client.query('COMMIT');
      return true;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}
