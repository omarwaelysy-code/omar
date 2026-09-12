import { dbService } from './dbService';
import { Product, Invoice } from '../types';

export const notificationService = {
  async checkLowStock(companyId: string) {
    try {
      const products = await dbService.list<Product>('products', companyId);
      return products.filter(p => {
        // Services do not have physical inventory or stock tracking
        if (p.type === 'service' || (p as any).is_service === true) {
          return false;
        }
        return Number(p.stock) <= Number(p.min_stock);
      });
    } catch (error) {
      console.error('Error checking low stock:', error);
      return [];
    }
  },

  async checkOverdueInvoices(companyId: string) {
    try {
      const today = new Date().toISOString().split('T')[0];
      // Use targeted query to reduce reads
      const overdueInvoices = await dbService.query<Invoice>('invoices', [
        { field: 'company_id', operator: '==', value: companyId },
        { field: 'payment_type', operator: '==', value: 'credit' },
        { field: 'status', operator: '!=', value: 'paid' },
        { field: 'due_date', operator: '<', value: today }
      ]);
      
      return overdueInvoices;
    } catch (error) {
      console.error('Error checking overdue invoices:', error);
      return [];
    }
  }
};
