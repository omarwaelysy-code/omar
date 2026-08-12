
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

const API_BASE = '/api/erp';

let lastBypassPassword = '';
let bypassClearTimeout: any = null;

function setBypassPassword(password: string) {
  lastBypassPassword = password;
  if (bypassClearTimeout) {
    clearTimeout(bypassClearTimeout);
  }
  bypassClearTimeout = setTimeout(() => {
    lastBypassPassword = '';
    bypassClearTimeout = null;
  }, 15000);
}

function showPasswordModal(closingDate: string): Promise<string | null> {
  return new Promise((resolve) => {
    const isAr = localStorage.getItem('app_language') === 'ar';
    
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.4)';
    overlay.style.backdropFilter = 'blur(4px)';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.zIndex = '99999';
    overlay.style.fontFamily = 'Cairo, system-ui, sans-serif';

    const modal = document.createElement('div');
    modal.style.backgroundColor = '#ffffff';
    modal.style.borderRadius = '24px';
    modal.style.padding = '30px';
    modal.style.width = '420px';
    modal.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)';
    modal.style.border = '1px solid #f4f4f5';
    modal.style.display = 'flex';
    modal.style.flexDirection = 'column';
    modal.style.gap = '20px';
    modal.style.direction = isAr ? 'rtl' : 'ltr';
    modal.style.textAlign = isAr ? 'right' : 'left';

    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.alignItems = 'center';
    header.style.gap = '12px';
    
    const icon = document.createElement('div');
    icon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>`;
    
    const title = document.createElement('h3');
    title.innerText = isAr ? 'فترة مغلقة محاسبياً' : 'Accounting Period Closed';
    title.style.margin = '0';
    title.style.fontWeight = '800';
    title.style.color = '#18181b';
    title.style.fontSize = '18px';

    header.appendChild(icon);
    header.appendChild(title);
    modal.appendChild(header);

    const msg = document.createElement('p');
    msg.innerText = isAr 
      ? `⚠️ هذه الفترة مغلقة محاسبياً حتى تاريخ ${closingDate}.\nيرجى إدخال كلمة مرور تجاوز الإغلاق لحفظ العملية:`
      : `⚠️ This period is closed until ${closingDate}.\nPlease enter the bypass password to save:`;
    msg.style.margin = '0';
    msg.style.color = '#71717a';
    msg.style.fontSize = '14px';
    msg.style.lineHeight = '1.6';
    modal.appendChild(msg);

    const input = document.createElement('input');
    input.type = 'password';
    input.placeholder = '••••••••';
    input.style.width = '100%';
    input.style.padding = '12px 16px';
    input.style.backgroundColor = '#f4f4f5';
    input.style.border = '1px solid #e4e4e7';
    input.style.borderRadius = '12px';
    input.style.outline = 'none';
    input.style.fontSize = '16px';
    input.style.fontWeight = 'bold';
    input.style.boxSizing = 'border-box';
    input.style.transition = 'border-color 0.2s';
    input.addEventListener('focus', () => {
      input.style.borderColor = '#10b981';
    });
    input.addEventListener('blur', () => {
      input.style.borderColor = '#e4e4e7';
    });
    modal.appendChild(input);

    const btnContainer = document.createElement('div');
    btnContainer.style.display = 'flex';
    btnContainer.style.gap = '10px';
    btnContainer.style.marginTop = '10px';

    const cancelBtn = document.createElement('button');
    cancelBtn.innerText = isAr ? 'إلغاء' : 'Cancel';
    cancelBtn.type = 'button';
    cancelBtn.style.flex = '1';
    cancelBtn.style.padding = '12px';
    cancelBtn.style.border = '1px solid #e4e4e7';
    cancelBtn.style.backgroundColor = '#ffffff';
    cancelBtn.style.color = '#27272a';
    cancelBtn.style.borderRadius = '12px';
    cancelBtn.style.cursor = 'pointer';
    cancelBtn.style.fontWeight = 'bold';
    cancelBtn.style.fontSize = '14px';
    cancelBtn.style.transition = 'background-color 0.2s';
    cancelBtn.addEventListener('mouseenter', () => cancelBtn.style.backgroundColor = '#f4f4f5');
    cancelBtn.addEventListener('mouseleave', () => cancelBtn.style.backgroundColor = '#ffffff');

    const okBtn = document.createElement('button');
    okBtn.innerText = isAr ? 'موافق' : 'OK';
    okBtn.type = 'button';
    okBtn.style.flex = '1';
    okBtn.style.padding = '12px';
    okBtn.style.border = 'none';
    okBtn.style.backgroundColor = '#10b981';
    okBtn.style.color = '#ffffff';
    okBtn.style.borderRadius = '12px';
    okBtn.style.cursor = 'pointer';
    okBtn.style.fontWeight = 'bold';
    okBtn.style.fontSize = '14px';
    okBtn.style.transition = 'background-color 0.2s';
    okBtn.addEventListener('mouseenter', () => okBtn.style.backgroundColor = '#059669');
    okBtn.addEventListener('mouseleave', () => okBtn.style.backgroundColor = '#10b981');

    btnContainer.appendChild(cancelBtn);
    btnContainer.appendChild(okBtn);
    modal.appendChild(btnContainer);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    input.focus();

    const cleanUp = () => {
      document.body.removeChild(overlay);
    };

    okBtn.addEventListener('click', () => {
      cleanUp();
      resolve(input.value);
    });

    cancelBtn.addEventListener('click', () => {
      cleanUp();
      resolve(null);
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        cleanUp();
        resolve(input.value);
      } else if (e.key === 'Escape') {
        cleanUp();
        resolve(null);
      }
    });
  });
}

export async function apiRequest<T>(path: string, method: string = 'GET', body?: any, timeoutMs: number = 30000): Promise<T> {
  const token = localStorage.getItem('auth_token');
  const authUserStr = localStorage.getItem('auth_user');
  let activeCompanyId = '';
  if (authUserStr) {
    try {
      const parsedUser = JSON.parse(authUserStr);
      activeCompanyId = parsedUser.company_id || '';
    } catch (e) {
      console.error(e);
    }
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const headers: any = {
    'Content-Type': 'application/json',
    'Authorization': token ? `Bearer ${token}` : '',
  };
  if (activeCompanyId) {
    headers['x-company-id'] = activeCompanyId;
  }
  if (lastBypassPassword) {
    headers['x-closing-password'] = encodeURIComponent(lastBypassPassword);
  }

  try {
    const response = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown API error' }));
      
      if (error.error === 'PERIOD_CLOSED') {
        const password = await showPasswordModal(error.closingDate);
        if (password !== null && password !== '') {
          setBypassPassword(password);
          
          const retryResponse = await fetch(`${API_BASE}${path}`, {
            method,
            headers: {
              'Content-Type': 'application/json',
              'Authorization': token ? `Bearer ${token}` : '',
              'x-company-id': activeCompanyId,
              'x-closing-password': encodeURIComponent(password)
            },
            body: body ? JSON.stringify(body) : undefined,
            signal: controller.signal
          });
          
          if (retryResponse.ok) {
            clearTimeout(timeoutId);
            return retryResponse.json();
          } else {
            const retryError = await retryResponse.json().catch(() => ({ error: 'Unknown API error' }));
            throw new Error(retryError.message || retryError.error || `API Request failed with status ${retryResponse.status}`);
          }
        }
      }
      
      if (error.error === 'SESSION_INVALIDATED') {
        // Session was invalidated by a force login from another device
        // Clear local storage and redirect to login with a message
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
        // Store the message to show on the login page
        sessionStorage.setItem('session_invalidated_message', error.message || 'تم تسجيل دخولك من مكان آخر. تم إنهاء هذه الجلسة.');
        window.location.href = '/login';
        throw new Error(error.message);
      }
      
      throw new Error(error.message || error.error || `API Request failed with status ${response.status}`);

    }

    return response.json();
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('API Request timed out after ' + (timeoutMs / 1000) + ' seconds');
    }
    throw error;
  }
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

  async list<T>(collectionName: string, options?: string | any[] | { company_id?: string; [key: string]: any }): Promise<T[]> {
    if (Array.isArray(options)) {
      return dbService.query<T>(collectionName, options as any);
    }
    const params = new URLSearchParams();
    if (options) {
      if (typeof options === 'string') {
        params.append('company_id', options);
      } else {
        Object.entries(options).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            params.append(key, typeof value === 'object' ? JSON.stringify(value) : value.toString());
          }
        });
      }
    }
    const queryString = params.toString();
    return apiRequest<T[]>(`/${collectionName}${queryString ? '?' + queryString : ''}`);
  },

  async listPaginated<T>(collectionName: string, options?: string | any[] | { company_id?: string; [key: string]: any }): Promise<{ data: T[], total: number, summary: any, page: number, limit: number }> {
    const params = new URLSearchParams();
    if (options) {
      if (typeof options === 'string') {
        params.append('company_id', options);
      } else if (Array.isArray(options)) {
        options.forEach(c => {
          params.append(c.field, c.value);
        });
      } else {
        Object.entries(options).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            params.append(key, typeof value === 'object' ? JSON.stringify(value) : value.toString());
          }
        });
      }
    }
    const queryString = params.toString();
    return apiRequest<{ data: T[], total: number, summary: any, page: number, limit: number }>(`/${collectionName}${queryString ? '?' + queryString : ''}`);
  },

  async getNextSequence(collectionName: string, dateStr: string): Promise<string> {
    const res = await apiRequest<{nextNumber: string}>(`/utils/next-sequence/${collectionName}?date=${dateStr}`);
    return res.nextNumber;
  },

  subscribePaginated<T>(
    collectionName: string, 
    options: string | { company_id: string; [key: string]: any } | any[], 
    callback: (result: { data: T[], total: number, summary: any, page: number, limit: number }) => void, 
    onError?: (error: Error) => void
  ) {
    let lastData = '';
    let isFetching = false;
    const fetchData = async () => {
      if (isFetching) return;
      isFetching = true;
      try {
        let pollOptions: any = options;
        if (typeof options === 'string') {
          pollOptions = { company_id: options, _polling: 'true' };
        } else if (Array.isArray(options)) {
          pollOptions = [...options, { field: '_polling', operator: '==', value: 'true' }];
        } else if (options && typeof options === 'object') {
          pollOptions = { ...options, _polling: 'true' };
        } else {
          pollOptions = { _polling: 'true' };
        }
        const result = await dbService.listPaginated<T>(collectionName, pollOptions);
        const dataString = JSON.stringify(result);
        if (dataString !== lastData) {
          lastData = dataString;
          callback(result);
        }
      } catch (err: any) {
        if (!err?.message?.includes('timed out') && !err?.message?.includes('AbortError')) {
          console.warn('Polling error:', err?.message || err);
        }
        if (onError) onError(err);
      } finally {
        isFetching = false;
      }
    };

    fetchData(); // Initial fetch
    const interval = setInterval(fetchData, 10000); // Poll every 10 seconds
    
    const handleRefresh = (e: any) => {
      if (e.detail?.collection === collectionName) {
        fetchData();
      }
    };
    window.addEventListener('db-refresh', handleRefresh as EventListener);

    return () => {
      clearInterval(interval);
      window.removeEventListener('db-refresh', handleRefresh as EventListener);
    };
  },

  subscribe<T>(collectionName: string, options: string | { company_id: string; [key: string]: any } | any[], callback: (data: T[]) => void, onError?: (error: Error) => void) {
    let lastData = '';
    let isFetching = false;
    const fetchData = async () => {
      if (isFetching) return;
      isFetching = true;
      try {
        let pollOptions: any = options;
        if (typeof options === 'string') {
          pollOptions = { company_id: options, _polling: 'true' };
        } else if (Array.isArray(options)) {
          pollOptions = [...options, { field: '_polling', operator: '==', value: 'true' }];
        } else if (options && typeof options === 'object') {
          pollOptions = { ...options, _polling: 'true' };
        } else {
          pollOptions = { _polling: 'true' };
        }
        const data = await dbService.list<T>(collectionName, pollOptions);
        const dataString = JSON.stringify(data);
        if (dataString !== lastData) {
          lastData = dataString;
          callback(data);
        }
      } catch (err: any) {
        if (!err?.message?.includes('timed out') && !err?.message?.includes('AbortError')) {
          console.warn('Polling error:', err?.message || err);
        }
        if (onError) onError(err);
      } finally {
        isFetching = false;
      }
    };

    fetchData(); // Initial fetch
    const interval = setInterval(fetchData, 10000); // Poll every 10 seconds
    
    const handleRefresh = (e: any) => {
      if (e.detail?.collection === collectionName) {
        fetchData();
      }
    };
    window.addEventListener('db-refresh', handleRefresh as EventListener);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('db-refresh', handleRefresh as EventListener);
    };
  },

  async get<T>(collectionName: string, id: string): Promise<T | null> {
    return apiRequest<T>(`/${collectionName}/${id}`);
  },

  async add<T>(collectionName: string, data: any): Promise<string> {
    const result = await apiRequest<any>(`/${collectionName}`, 'POST', data);
    window.dispatchEvent(new CustomEvent('db-refresh', { detail: { collection: collectionName } }));
    if (typeof result === 'string') return result;
    if (result && typeof result === 'object') {
      return String(result.id || result.template_id || result.data?.id || result.template?.id || '');
    }
    return String(result || '');
  },

  async create<T>(collectionName: string, data: any): Promise<string> {
    return this.add(collectionName, data);
  },

  async addWithId<T>(collectionName: string, id: string, data: any): Promise<void> {
    await apiRequest(`/${collectionName}`, 'POST', { ...data, id });
    window.dispatchEvent(new CustomEvent('db-refresh', { detail: { collection: collectionName } }));
  },

  async update(collectionName: string, id: string, data: any): Promise<void> {
    await apiRequest(`/${collectionName}/${id}`, 'PUT', data);
    window.dispatchEvent(new CustomEvent('db-refresh', { detail: { collection: collectionName } }));
  },

  async delete(collectionName: string, id: string): Promise<void> {
    await apiRequest(`/${collectionName}/${id}`, 'DELETE');
    window.dispatchEvent(new CustomEvent('db-refresh', { detail: { collection: collectionName } }));
  },

  async getDocsByFilter<T>(collectionName: string, companyId: string, filters: { field: string, operator: any, value: any }[]): Promise<T[]> {
    const params = new URLSearchParams();
    params.append('company_id', companyId);
    filters.forEach(f => {
      params.append(f.field, f.value);
    });
    return apiRequest<T[]>(`/${collectionName}?${params.toString()}`);
  },

  async logActivity(userId: string, username: string, companyId: string, action: string, details: string, entity?: string | string[], documentId?: string, changes?: any[]) {
    try {
      await apiRequest('/activity_logs', 'POST', {
        user_id: userId,
        username,
        company_id: companyId,
        action,
        details,
        entity,
        document_id: documentId,
        changes,
        created_at: new Date().toISOString()
      });
      // Trigger immediate refresh for subscribers
      window.dispatchEvent(new CustomEvent('db-refresh', { detail: { collection: 'activity_logs' } }));
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
    entity: string | string[],
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
        entity,
        id,
        changes
      );
    }
  },

  async createJournalEntry(entry: any) {
    if (!entry.entry_number && entry.reference_id) {
      const preserved = (dbService as any)._recentDeletedJEs?.[entry.reference_id];
      if (preserved && preserved.entry_number) {
        entry.entry_number = preserved.entry_number;
      }
    }
    const result = await apiRequest('/journal_entries', 'POST', entry);
    if (entry.reference_id && (dbService as any)._recentDeletedJEs?.[entry.reference_id]) {
      delete (dbService as any)._recentDeletedJEs[entry.reference_id];
    }
    window.dispatchEvent(new CustomEvent('db-refresh', { detail: { collection: 'journal_entries' } }));
    return result;
  },

  async updateJournalEntry(id: string, entry: any) {
    const result = await apiRequest(`/journal_entries/${id}`, 'PUT', entry);
    window.dispatchEvent(new CustomEvent('db-refresh', { detail: { collection: 'journal_entries' } }));
    return result;
  },

  async deleteJournalEntryByReference(referenceId: string, companyId: string) {
    try {
      const entries = await dbService.query<any>('journal_entries', [
        { field: 'company_id', operator: '==', value: companyId },
        { field: 'reference_id', operator: '==', value: referenceId }
      ]);
      
      let preserved = null;
      for (const entry of entries) {
        if (!preserved) {
           preserved = { entry_number: entry.entry_number, date: entry.date, reference_type: entry.reference_type };
           (dbService as any)._recentDeletedJEs = (dbService as any)._recentDeletedJEs || {};
           (dbService as any)._recentDeletedJEs[referenceId] = preserved;
        }
        try {
          await dbService.delete('journal_entries', entry.id);
        } catch (err) {
          console.warn('[dbService] Silently ignored journal entry deletion error:', err);
        }
      }
      return preserved;
    } catch (e) {
      console.warn('[dbService] Error in deleteJournalEntryByReference:', e);
      return null;
    }
  },

  async getJournalEntryByReference(referenceId: string, companyId: string): Promise<any | null> {
    const entries = await dbService.query<any>('journal_entries', [
      { field: 'company_id', operator: '==', value: companyId },
      { field: 'reference_id', operator: '==', value: referenceId }
    ]);
    return entries.length > 0 ? entries[0] : null;
  },

  listen<T>(collectionName: string, id: string, callback: (data: T | null) => void) {
    let lastData = '';
    let isFetching = false;
    const fetchData = async () => {
      if (isFetching) return;
      isFetching = true;
      try {
        const data = await dbService.get<T>(collectionName, id);
        const dataString = JSON.stringify(data);
        if (dataString !== lastData) {
          lastData = dataString;
          callback(data);
        }
      } catch (err: any) {
        if (!err?.message?.includes('timed out') && !err?.message?.includes('AbortError')) {
          console.warn('Listen polling error:', err?.message || err);
        }
      } finally {
        isFetching = false;
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 10000);
    
    const handleRefresh = (e: any) => {
      if (e.detail?.collection === collectionName) {
        fetchData();
      }
    };
    window.addEventListener('db-refresh', handleRefresh as EventListener);

    return () => {
      clearInterval(interval);
      window.removeEventListener('db-refresh', handleRefresh as EventListener);
    };
  },

  async getOrCreateDefaultDashboard(companyId: string, userId: string): Promise<any> {
    return apiRequest<any>('/dashboards/user/my-default');
  },

  async saveAsTemplate(dashboardId: string, companyId: string, name: string): Promise<any> {
    return apiRequest<any>(`/dashboards/${dashboardId}/save-template`, 'POST', { name });
  },

  async resetDashboard(dashboardId: string, companyId: string): Promise<any> {
    return apiRequest<any>(`/dashboards/${dashboardId}/reset`, 'POST');
  },

  async exportDashboard(dashboardId: string, companyId: string): Promise<any> {
    return apiRequest<any>(`/dashboards/${dashboardId}/export`);
  },

  async importDashboard(json: any, companyId: string, userId: string): Promise<any> {
    return apiRequest<any>('/dashboards/import', 'POST', json);
  },
  
  async getWidgetDataSources(): Promise<{ [tableName: string]: string[] }> {
    return apiRequest<{ [tableName: string]: string[] }>('/widgets/data-sources');
  },
  
  async queryWidgetData(payload: any): Promise<any[]> {
    return apiRequest<any[]>('/widgets/query', 'POST', payload);
  },

  async logClientAudit(action: string, moduleName: string, details: string, metadata?: any) {
    try {
      const authUserStr = localStorage.getItem('auth_user');
      const user = authUserStr ? JSON.parse(authUserStr) : null;
      await apiRequest('/audit_logs', 'POST', {
        action,
        module: moduleName.toUpperCase(),
        details,
        metadata: metadata || {},
        user_id: user?.id || user?.user?.id,
        username: user?.username || user?.user?.username,
        user_email: user?.email || user?.user?.email,
        company_id: user?.company_id || user?.user?.company_id,
        branch: user?.branch || user?.branch_name || user?.user?.branch_name
      });
    } catch (error) {
      console.error('Failed to log client audit:', error);
    }
  },

  // Contact Messages APIs
  async sendContactMessage(data: { name: string; email: string; phone?: string; message: string }): Promise<any> {
    return apiRequest<any>('/contact-messages', 'POST', data);
  },

  async getContactMessages(): Promise<any[]> {
    return apiRequest<any[]>('/contact-messages');
  },

  async getUnreadContactMessagesCount(): Promise<{ count: number }> {
    return apiRequest<{ count: number }>('/contact-messages/unread-count');
  },

  async updateContactMessageStatus(id: string, status: 'new' | 'read' | 'archived'): Promise<any> {
    return apiRequest<any>(`/contact-messages/${id}/status`, 'PUT', { status });
  },

  async updateContactMessageNotes(id: string, notes: string): Promise<any> {
    return apiRequest<any>(`/contact-messages/${id}/notes`, 'PUT', { notes });
  },

  async deleteContactMessage(id: string): Promise<any> {
    return apiRequest<any>(`/contact-messages/${id}`, 'DELETE');
  }
};
