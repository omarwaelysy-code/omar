import { dbService } from './dbService';
import { ReceivedCheque, ReceivedChequeStats } from '../types';

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('auth_token');
  const authUserStr = localStorage.getItem('auth_user');
  let companyId = localStorage.getItem('active_company_id') || '';
  if (!companyId && authUserStr) {
    try {
      const parsed = JSON.parse(authUserStr);
      companyId = parsed.company_id || '';
    } catch (e) {}
  }
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (companyId) headers['x-company-id'] = companyId;
  return headers;
}

export const receivedChequeService = {
  /**
   * Fetch all or filtered received cheques
   */
  async list(filters?: { company_id?: string; customer_id?: string; status?: string; search?: string; from_date?: string; to_date?: string }): Promise<ReceivedCheque[]> {
    return dbService.list<ReceivedCheque>('received_cheques', filters);
  },

  /**
   * Get single received cheque by ID
   */
  async get(id: string): Promise<ReceivedCheque | null> {
    return dbService.get<ReceivedCheque>('received_cheques', id);
  },

  /**
   * Create a single draft cheque
   */
  async create(data: Partial<ReceivedCheque>): Promise<string> {
    return dbService.add<ReceivedCheque>('received_cheques', {
      ...data,
      status: 'DRAFT'
    });
  },

  /**
   * Receive multi-cheque receipt (Customer or Other)
   */
  async receiveCheques(payload: {
    receipt_number?: string;
    cheque_type: 'customer' | 'other';
    customer_id?: string;
    customer_name?: string;
    receive_date: string;
    debit_account_id?: string;
    debit_account_name?: string;
    credit_account_id?: string;
    credit_account_name?: string;
    currency?: string;
    exchange_rate?: number;
    purpose?: string;
    notes?: string;
    attachments?: any[];
    settlement_details?: any[];
    cheques: Array<{
      cheque_number: string;
      amount: number;
      due_date: string;
      is_crossed: boolean;
      is_not_negotiable: boolean;
      bank_name: string;
      attachment?: any;
      attachments?: any[];
    }>;
  }): Promise<{ success: boolean; count: number; ids: string[]; receipt_number: string }> {
    const headers = getAuthHeaders();
    const res = await fetch('/api/erp/received_cheques/receive', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || err.message || 'فشل في تسجيل استلام الشيكات');
    }
    window.dispatchEvent(new CustomEvent('db-refresh', { detail: { collection: 'received_cheques' } }));
    return res.json();
  },

  /**
   * Update draft received cheque
   */
  async update(id: string, data: Partial<ReceivedCheque>): Promise<void> {
    return dbService.update('received_cheques', id, data);
  },

  /**
   * Delete draft received cheque
   */
  async delete(id: string): Promise<void> {
    return dbService.delete('received_cheques', id);
  },

  /**
   * Fetch dashboard KPI statistics
   */
  async getDashboardStats(): Promise<ReceivedChequeStats> {
    const headers = getAuthHeaders();
    const res = await fetch('/api/erp/received_cheques/dashboard-stats', { headers });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || err.message || 'Failed to fetch received cheque stats');
    }
    return res.json();
  },

  /**
   * Fetch top upcoming / due received cheques
   */
  async getUpcomingCheques(): Promise<ReceivedCheque[]> {
    const headers = getAuthHeaders();
    const res = await fetch('/api/erp/received_cheques/upcoming', { headers });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || err.message || 'Failed to fetch upcoming received cheques');
    }
    return res.json();
  },

  /**
   * Collect received cheque and deposit to bank/cash
   */
  async collectCheque(id: string, depositAccountId: string, collectionDate?: string, notes?: string): Promise<void> {
    const headers = getAuthHeaders();
    const res = await fetch(`/api/erp/received_cheques/${id}/collect`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        deposit_account_id: depositAccountId,
        collection_date: collectionDate || new Date().toISOString().slice(0, 10),
        notes
      })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || err.message || 'فشل في تحصيل الشيك وإيداعه.');
    }
    window.dispatchEvent(new CustomEvent('db-refresh', { detail: { collection: 'received_cheques' } }));
  },

  /**
   * Postpone due date of received cheque
   */
  async postponeCheque(id: string, newDueDate: string, reason: string): Promise<void> {
    const headers = getAuthHeaders();
    const res = await fetch(`/api/erp/received_cheques/${id}/postpone`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        new_due_date: newDueDate,
        reason
      })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || err.message || 'فشل في تأجيل تاريخ استحقاق الشيك.');
    }
    window.dispatchEvent(new CustomEvent('db-refresh', { detail: { collection: 'received_cheques' } }));
  },

  /**
   * Mark received cheque as returned (مرتد)
   */
  async returnCheque(id: string, returnDate: string, reason: string): Promise<void> {
    const headers = getAuthHeaders();
    const res = await fetch(`/api/erp/received_cheques/${id}/return`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        return_date: returnDate,
        reason
      })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || err.message || 'فشل في إثبات ارتداد الشيك.');
    }
    window.dispatchEvent(new CustomEvent('db-refresh', { detail: { collection: 'received_cheques' } }));
  },

  /**
   * Cancel received cheque
   */
  async cancelCheque(id: string, reason: string): Promise<void> {
    const headers = getAuthHeaders();
    const res = await fetch(`/api/erp/received_cheques/${id}/cancel`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ reason })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || err.message || 'فشل في إلغاء الشيك.');
    }
    window.dispatchEvent(new CustomEvent('db-refresh', { detail: { collection: 'received_cheques' } }));
  }
};
