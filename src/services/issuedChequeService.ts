import { dbService } from './dbService';
import { IssuedCheque, IssuedChequeStats } from '../types';

export const issuedChequeService = {
  /**
   * Fetch all or filtered cheques
   */
  async list(filters?: { company_id?: string; supplier_id?: string; bank_account_id?: string; status?: string; search?: string; from_date?: string; to_date?: string }): Promise<IssuedCheque[]> {
    return dbService.list<IssuedCheque>('issued_cheques', filters);
  },

  /**
   * Get single cheque by ID
   */
  async get(id: string): Promise<IssuedCheque | null> {
    return dbService.get<IssuedCheque>('issued_cheques', id);
  },

  /**
   * Create a new draft cheque
   */
  async create(data: Partial<IssuedCheque>): Promise<string> {
    return dbService.add<IssuedCheque>('issued_cheques', {
      ...data,
      status: 'DRAFT'
    });
  },

  /**
   * Update draft cheque
   */
  async update(id: string, data: Partial<IssuedCheque>): Promise<void> {
    return dbService.update('issued_cheques', id, data);
  },

  /**
   * Delete draft cheque
   */
  async delete(id: string): Promise<void> {
    return dbService.delete('issued_cheques', id);
  },

  /**
   * Fetch real dashboard KPI statistics
   */
  async getDashboardStats(): Promise<IssuedChequeStats> {
    const token = localStorage.getItem('auth_token');
    const activeCompanyId = localStorage.getItem('active_company_id');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (activeCompanyId) headers['x-company-id'] = activeCompanyId;

    const res = await fetch('/api/erp/issued-cheques/dashboard-stats', { headers });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || err.message || 'Failed to fetch cheque stats');
    }
    return res.json();
  },

  /**
   * Fetch top upcoming / due cheques
   */
  async getUpcomingCheques(): Promise<IssuedCheque[]> {
    const token = localStorage.getItem('auth_token');
    const activeCompanyId = localStorage.getItem('active_company_id');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (activeCompanyId) headers['x-company-id'] = activeCompanyId;

    const res = await fetch('/api/erp/issued-cheques/upcoming', { headers });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || err.message || 'Failed to fetch upcoming cheques');
    }
    return res.json();
  },

  /**
   * Issue / Approve Cheque (DRAFT -> ISSUED) + Journal Entry
   */
  async issueCheque(id: string): Promise<{ success: boolean; message: string; journal_entry_id?: string }> {
    const token = localStorage.getItem('auth_token');
    const activeCompanyId = localStorage.getItem('active_company_id');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (activeCompanyId) headers['x-company-id'] = activeCompanyId;

    const res = await fetch(`/api/erp/issued-cheques/${id}/issue`, {
      method: 'POST',
      headers
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || err.message || 'Failed to issue cheque');
    }
    window.dispatchEvent(new CustomEvent('db-refresh', { detail: { collection: 'issued_cheques' } }));
    window.dispatchEvent(new CustomEvent('db-refresh', { detail: { collection: 'journal_entries' } }));
    return res.json();
  },

  /**
   * Pay / Cash Cheque from Bank (ISSUED / POSTPONED -> PAID) + Journal Entry
   */
  async payCheque(id: string, paymentDate?: string, notes?: string): Promise<{ success: boolean; message: string; journal_entry_id?: string }> {
    const token = localStorage.getItem('auth_token');
    const activeCompanyId = localStorage.getItem('active_company_id');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (activeCompanyId) headers['x-company-id'] = activeCompanyId;

    const res = await fetch(`/api/erp/issued-cheques/${id}/pay`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ payment_date: paymentDate, notes })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || err.message || 'Failed to pay cheque');
    }
    window.dispatchEvent(new CustomEvent('db-refresh', { detail: { collection: 'issued_cheques' } }));
    window.dispatchEvent(new CustomEvent('db-refresh', { detail: { collection: 'journal_entries' } }));
    return res.json();
  },

  /**
   * Postpone Cheque Due Date (ISSUED / POSTPONED -> POSTPONED)
   */
  async postponeCheque(id: string, newDueDate: string, reason?: string): Promise<{ success: boolean; message: string }> {
    const token = localStorage.getItem('auth_token');
    const activeCompanyId = localStorage.getItem('active_company_id');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (activeCompanyId) headers['x-company-id'] = activeCompanyId;

    const res = await fetch(`/api/erp/issued-cheques/${id}/postpone`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ new_due_date: newDueDate, reason })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || err.message || 'Failed to postpone cheque');
    }
    window.dispatchEvent(new CustomEvent('db-refresh', { detail: { collection: 'issued_cheques' } }));
    return res.json();
  },

  /**
   * Return Cheque from Bank (ISSUED / POSTPONED -> RETURNED) + Reversal Entry
   */
  async returnCheque(id: string, returnDate?: string, reason?: string): Promise<{ success: boolean; message: string; journal_entry_id?: string }> {
    const token = localStorage.getItem('auth_token');
    const activeCompanyId = localStorage.getItem('active_company_id');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (activeCompanyId) headers['x-company-id'] = activeCompanyId;

    const res = await fetch(`/api/erp/issued-cheques/${id}/return`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ return_date: returnDate, reason })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || err.message || 'Failed to return cheque');
    }
    window.dispatchEvent(new CustomEvent('db-refresh', { detail: { collection: 'issued_cheques' } }));
    window.dispatchEvent(new CustomEvent('db-refresh', { detail: { collection: 'journal_entries' } }));
    return res.json();
  },

  /**
   * Cancel Cheque (DRAFT / ISSUED / POSTPONED -> CANCELLED) + Reversal Entry if issued
   */
  async cancelCheque(id: string, reason?: string): Promise<{ success: boolean; message: string }> {
    const token = localStorage.getItem('auth_token');
    const activeCompanyId = localStorage.getItem('active_company_id');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (activeCompanyId) headers['x-company-id'] = activeCompanyId;

    const res = await fetch(`/api/erp/issued-cheques/${id}/cancel`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ reason })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || err.message || 'Failed to cancel cheque');
    }
    window.dispatchEvent(new CustomEvent('db-refresh', { detail: { collection: 'issued_cheques' } }));
    window.dispatchEvent(new CustomEvent('db-refresh', { detail: { collection: 'journal_entries' } }));
    return res.json();
  }
};
