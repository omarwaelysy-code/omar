import React, { useState, useEffect } from 'react';
import { Company } from '../../types';
import { subscriptionApiService } from '../../services/SubscriptionApiService';
import { Search, ToggleLeft, ToggleRight, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface FeatureManagerTabProps {
  companies: Company[];
}

export const FeatureManagerTab: React.FC<FeatureManagerTabProps> = ({ companies }) => {
  const [selectedCompany, setSelectedCompany] = useState<string>('');
  const [features, setFeatures] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    if (selectedCompany) {
      loadFeatures(selectedCompany);
    } else {
      setFeatures([]);
    }
  }, [selectedCompany]);

  const loadFeatures = async (companyId: string) => {
    try {
      setLoading(true);
      const data = await subscriptionApiService.getFeatures(companyId);
      setFeatures(data);
    } catch (err: any) {
      alert(err.message || 'Failed to load features');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (featureName: string, currentState: boolean) => {
    if (!selectedCompany) return;
    try {
      setActionLoading(featureName);
      await subscriptionApiService.toggleFeature(selectedCompany, featureName, !currentState);
      // Optimistic update
      setFeatures(prev => prev.map(f => f.feature_name === featureName ? { ...f, is_enabled: !currentState } : f));
    } catch (err: any) {
      alert(err.message || 'Failed to update feature');
    } finally {
      setActionLoading(null);
    }
  };

  const filteredCompanies = companies.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatFeatureName = (name: string) => {
    const names: Record<string, string> = {
      'inventory': 'المخازن',
      'sales': 'المبيعات',
      'purchases': 'المشتريات',
      'manufacturing': 'التصنيع',
      'crm': 'إدارة علاقات العملاء (CRM)',
      'hr': 'الموارد البشرية (HR)',
      'accounting': 'الحسابات العامة',
      'pos': 'نقاط البيع (POS)',
      'reports': 'التقارير المتقدمة',
      'ai': 'الذكاء الاصطناعي',
      'api': 'الربط البرمجي (API)'
    };
    return names[name] || name;
  };

  return (
    <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6" dir="rtl">
      
      {/* Companies List */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden flex flex-col h-[80vh]">
        <div className="p-4 border-b border-stone-100 bg-stone-50">
          <h3 className="font-black text-stone-800 mb-3 text-lg">الشركات</h3>
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
            <input 
              type="text" 
              placeholder="بحث عن شركة..." 
              className="w-full bg-white border border-stone-200 rounded-xl pr-10 pl-4 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all text-sm font-bold"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {filteredCompanies.map(company => (
            <button
              key={company.id}
              onClick={() => setSelectedCompany(company.id)}
              className={`w-full text-right p-3 rounded-xl mb-1 transition-colors flex items-center justify-between ${selectedCompany === company.id ? 'bg-blue-50 border-blue-200 border text-blue-700' : 'hover:bg-stone-50 border border-transparent text-stone-700'}`}
            >
              <div>
                <div className="font-bold text-sm">{company.name}</div>
                <div className="font-mono text-xs opacity-60">{company.code}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Feature Flags */}
      <div className="md:col-span-2 bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden flex flex-col h-[80vh]">
        <div className="p-4 border-b border-stone-100 bg-stone-50 flex items-center justify-between">
          <div>
            <h3 className="font-black text-stone-800 text-lg">إدارة الميزات (Feature Flags)</h3>
            <p className="text-sm text-stone-500 font-bold mt-1">تفعيل أو إيقاف الميزات للشركة المحددة</p>
          </div>
          {selectedCompany && loading && <RefreshCw className="animate-spin text-blue-500" />}
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 bg-stone-50/30">
          {!selectedCompany ? (
            <div className="flex flex-col items-center justify-center h-full text-stone-400">
              <ToggleLeft className="w-16 h-16 mb-4 opacity-50" />
              <p className="font-bold">يرجى اختيار شركة من القائمة لعرض الميزات.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <AnimatePresence>
                {features.map((feature, idx) => (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    key={feature.feature_name} 
                    className="bg-white border border-stone-200 rounded-xl p-4 flex items-center justify-between shadow-sm hover:shadow transition-shadow"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${feature.is_enabled ? 'bg-emerald-50 text-emerald-500' : 'bg-stone-100 text-stone-400'}`}>
                        {feature.is_enabled ? <CheckCircle2 size={20} /> : <XCircle size={20} />}
                      </div>
                      <div>
                        <div className="font-black text-stone-800 text-sm">{formatFeatureName(feature.feature_name)}</div>
                        <div className="font-mono text-xs text-stone-400 mt-0.5">{feature.feature_name}</div>
                      </div>
                    </div>
                    
                    <button 
                      disabled={actionLoading === feature.feature_name}
                      onClick={() => handleToggle(feature.feature_name, feature.is_enabled)}
                      className={`relative w-12 h-6 rounded-full transition-colors ${feature.is_enabled ? 'bg-blue-500' : 'bg-stone-300'} disabled:opacity-50`}
                    >
                      <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${feature.is_enabled ? 'left-1' : 'left-7'}`} />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
              {features.length === 0 && !loading && (
                <div className="col-span-2 text-center text-stone-500 py-12">
                  لا توجد ميزات مخصصة.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
