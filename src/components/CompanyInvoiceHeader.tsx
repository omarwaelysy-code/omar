import React from 'react';
import { Building2, FileText, MapPin, Hash, Globe } from 'lucide-react';
import { Company } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

interface CompanyInvoiceHeaderProps {
  company: Company | null;
  documentNumber?: string;
  documentDate?: string;
  title?: string;
}

export const CompanyInvoiceHeader: React.FC<CompanyInvoiceHeaderProps> = ({ 
  company, 
  documentNumber, 
  documentDate,
  title 
}) => {
  const { t, language, dir } = useLanguage();

  if (!company) return null;

  return (
    <div className={`flex flex-col md:flex-row items-start justify-between gap-6 mb-8 p-6 bg-slate-50/50 rounded-3xl border border-slate-100 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
      <div className="flex flex-col md:flex-row items-center md:items-start gap-4 flex-1">
        {company.logo_url ? (
          <div className="w-24 h-24 rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-sm flex items-center justify-center p-2">
            <img 
              src={company.logo_url} 
              alt={company.name} 
              className="max-w-full max-h-full object-contain"
              referrerPolicy="no-referrer"
            />
          </div>
        ) : (
          <div className="w-24 h-24 rounded-2xl bg-white border border-slate-200 flex items-center justify-center shadow-sm">
            <Building2 className="w-10 h-10 text-slate-300" />
          </div>
        )}
        
        <div className="space-y-1">
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">{company.name}</h1>
          <div className="flex flex-wrap gap-4 text-sm font-medium text-slate-500">
            {company.commercial_register && (
              <div className="flex items-center gap-1.5">
                <Hash size={14} className="text-slate-400" />
                <span>{t('company_settings.commercial_register')}:</span>
                <span className="text-slate-900 font-bold">{company.commercial_register}</span>
              </div>
            )}
            {company.tax_number && (
              <div className="flex items-center gap-1.5">
                <FileText size={14} className="text-slate-400" />
                <span>{t('company_settings.tax_number')}:</span>
                <span className="text-slate-900 font-bold">{company.tax_number}</span>
              </div>
            )}
          </div>
          {company.address && (
            <div className="flex items-center gap-1.5 text-sm font-medium text-slate-500 pt-1">
              <MapPin size={14} className="text-slate-400" />
              <span className="italic">{company.address}</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col items-center md:items-end gap-2 shrink-0 self-stretch md:self-start">
        <div className="px-6 py-4 bg-white border border-slate-200 rounded-2xl shadow-sm text-center min-w-[160px]">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{title || t('invoices.invoice')}</p>
            <p className="text-indigo-600 font-black text-xl font-mono mb-1">{documentNumber || '---'}</p>
            {documentDate && (
              <p className="text-xs font-bold text-slate-500 font-mono border-t border-slate-50 pt-1 mt-1">{documentDate}</p>
            )}
        </div>
      </div>
    </div>
  );
};
