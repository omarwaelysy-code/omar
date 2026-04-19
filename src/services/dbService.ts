
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

const API_BASE = '/api/erp';

async function apiRequest<T>(path: string, method: string = 'GET', body?: any): Promise<T> {
  const token = localStorage.getItem('auth_token');
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : '',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'API Request failed');
  }

  return response.json();
}

export const dbService = {
  async query<T>(collectionName: string, conditions: { field: string, operator: any, value: any }[]): Promise<T[]> {
    const params = new URLSearchParams();
    conditions.forEach(c => {
      params.append(c.field, c.value);
    });
    return apiRequest<T[]>(`/${collectionName}?${params.toString()}`);
  },

  async listAll<T>(collectionName: string): Promise<T[]> {
    return apiRequest<T[]>(`/${collectionName}`);
  },

  async list<T>(collectionName: string, companyId: string): Promise<T[]> {
    return apiRequest<T[]>(`/${collectionName}?company_id=${companyId}`);
  },

  subscribe<T>(collectionName: string, companyId: string, callback: (data: T[]) => void) {
    const interval = setInterval(async () => {
      try {
        const data = await dbService.list<T>(collectionName, companyId);
        callback(data);
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 5000);
    
    return () => clearInterval(interval);
  },

  async get<T>(collectionName: string, id: string): Promise<T | null> {
    return apiRequest<T>(`/${collectionName}/${id}`);
  },

  async add<T>(collectionName: string, data: any): Promise<string> {
    const result = await apiRequest<{ id: string }>(`/${collectionName}`, 'POST', data);
    return result.id;
  },

  async addWithId<T>(collectionName: string, id: string, data: any): Promise<void> {
    await apiRequest(`/${collectionName}`, 'POST', { ...data, id });
  },

  async update(collectionName: string, id: string, data: any): Promise<void> {
    await apiRequest(`/${collectionName}/${id}`, 'PUT', data);
  },

  async delete(collectionName: string, id: string): Promise<void> {
    await apiRequest(`/${collectionName}/${id}`, 'DELETE');
  },

  async getDocsByFilter<T>(collectionName: string, companyId: string, filters: { field: string, operator: any, value: any }[]): Promise<T[]> {
    const params = new URLSearchParams();
    params.append('company_id', companyId);
    filters.forEach(f => {
      params.append(f.field, f.value);
    });
    return apiRequest<T[]>(`/${collectionName}?${params.toString()}`);
  },

  async logActivity(userId: string, username: string, companyId: string, action: string, details: string, category?: string | string[], documentId?: string, changes?: any[]) {
    try {
      await apiRequest('/activity_logs', 'POST', {
        user_id: userId,
        username,
        company_id: companyId,
        action,
        details,
        category,
        document_id: documentId,
        changes,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Failed to log activity:', error);
    }
  },

  compareObjects(oldData: any, newData: any, fieldsToTrack: { field: string, label: string }[]) {
    const changes: { field: string, old_value: any, new_value: any }[] = [];
    
    fieldsToTrack.forEach(({ field, label }) => {
      const oldValue = oldData[field];
      const newValue = newData[field];
      
      if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        changes.push({
          field: label,
          old_value: oldValue,
          new_value: newValue
        });
      }
    });
    
    return changes;
  },

  async updateWithLog(
    collectionName: string, 
    id: string, 
    newData: any, 
    user: { id: string, username: string, company_id: string },
    actionLabel: string,
    category: string | string[],
    fieldsToTrack: { field: string, label: string }[]
  ): Promise<void> {
    const oldData = await dbService.get<any>(collectionName, id);
    if (!oldData) throw new Error('Document not found');

    const changes = dbService.compareObjects(oldData, newData, fieldsToTrack);
    
    await dbService.update(collectionName, id, newData);

    if (changes.length > 0) {
      await dbService.logActivity(
        user.id, 
        user.username, 
        user.company_id, 
        actionLabel, 
        `${actionLabel} رقم: ${newData.invoice_number || newData.number || id}`,
        category,
        id,
        changes
      );
    }
  },

  async createJournalEntry(entry: any) {
    return apiRequest('/journal_entries', 'POST', entry);
  },

  async updateJournalEntry(id: string, entry: any) {
    return apiRequest(`/journal_entries/${id}`, 'PUT', entry);
  },

  async deleteJournalEntryByReference(referenceId: string, companyId: string) {
    const entries = await dbService.query<any>('journal_entries', [
      { field: 'company_id', operator: '==', value: companyId },
      { field: 'reference_id', operator: '==', value: referenceId }
    ]);
    
    for (const entry of entries) {
      await dbService.delete('journal_entries', entry.id);
    }
  },

  async getJournalEntryByReference(referenceId: string, companyId: string): Promise<any | null> {
    const entries = await dbService.query<any>('journal_entries', [
      { field: 'company_id', operator: '==', value: companyId },
      { field: 'reference_id', operator: '==', value: referenceId }
    ]);
    return entries.length > 0 ? entries[0] : null;
  }
};
