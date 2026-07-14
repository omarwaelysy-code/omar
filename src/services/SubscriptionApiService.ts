export interface SubscriptionData {
  id?: string;
  company_id: string;
  plan_type: 'Basic' | 'Pro' | 'Enterprise';
  subscription_status: 'Trial' | 'Active' | 'Suspended' | 'Expired';
  start_date?: string;
  end_date?: string;
  trial_until?: string;
  max_users: number;
  max_branches: number;
  max_warehouses: number;
  max_devices: number;
  max_monthly_transactions: number;
  current_users: number;
  current_branches: number;
  current_warehouses: number;
  current_devices: number;
  current_monthly_transactions: number;
  created_at?: string;
  updated_at?: string;
}

const API_BASE = '/api/subscriptions';

class SubscriptionApiService {
  private getHeaders(): Record<string, string> {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : '',
    };
  }

  private async fetchApi<T>(path: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        ...this.getHeaders(),
        ...options.headers,
      },
    });

    if (!response.ok) {
      let errorMessage = 'API Error';
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
      } catch (e) {
        // Ignored
      }
      throw new Error(errorMessage);
    }

    if (response.status === 204) {
      return {} as T;
    }

    return response.json();
  }

  async getAllSubscriptions(): Promise<SubscriptionData[]> {
    return this.fetchApi<SubscriptionData[]>('/');
  }

  async getSubscriptionByCompany(companyId: string): Promise<SubscriptionData> {
    return this.fetchApi<SubscriptionData>(`/${companyId}`);
  }

  async updateSubscriptionLimits(companyId: string, data: Partial<SubscriptionData>): Promise<SubscriptionData> {
    return this.fetchApi<SubscriptionData>(`/${companyId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async activate(companyId: string): Promise<SubscriptionData> {
    return this.fetchApi<SubscriptionData>(`/${companyId}/activate`, { method: 'PATCH' });
  }

  async suspend(companyId: string): Promise<SubscriptionData> {
    return this.fetchApi<SubscriptionData>(`/${companyId}/suspend`, { method: 'PATCH' });
  }

  async expire(companyId: string): Promise<SubscriptionData> {
    return this.fetchApi<SubscriptionData>(`/${companyId}/expire`, { method: 'PATCH' });
  }

  async trial(companyId: string): Promise<SubscriptionData> {
    return this.fetchApi<SubscriptionData>(`/${companyId}/trial`, { method: 'PATCH' });
  }

  // --- Feature Management ---
  async getFeatures(companyId: string): Promise<any[]> {
    return this.fetchApi<any[]>(`/${companyId}/features`);
  }

  async toggleFeature(companyId: string, featureName: string, isEnabled: boolean): Promise<any> {
    return this.fetchApi<any>(`/${companyId}/features/${featureName}`, {
      method: 'PUT',
      body: JSON.stringify({ isEnabled }),
    });
  }
}

export const subscriptionApiService = new SubscriptionApiService();
