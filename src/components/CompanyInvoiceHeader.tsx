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
    <div className={`flex flex-col md:flex-row items-start justify-between gap-6 mb-10 pb-8 border-b-2 border-slate-900 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
      <div className="flex flex-col md:flex-row items-center md:items-start gap-6 flex-1">
        {company.logo_url ? (
          <div className="w-28 h-28 rounded-2xl bg-white border-2 border-slate-100 overflow-hidden shadow-sm flex items-center justify-center p-3">
            <img 
              src={company.logo_url} 
              alt={company.name} 
              className="max-w-full max-h-full object-contain"
              referrerPolicy="no-referrer"
            />
          </div>
        ) : (
          <div className="w-28 h-28 rounded-2xl bg-slate-50 border-2 border-slate-100 flex items-center justify-center shadow-sm">
            <Building2 className="w-12 h-12 text-slate-300" />
          </div>
        )}
        
        <div className="space-y-2 mt-1">
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase">{company.name}</h1>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-bold text-slate-500">
            {company.commercial_register && (
              <div className="flex items-center gap-2">
                <Hash size={14} className="text-slate-400" />
                <span className="text-slate-400 uppercase tracking-widest text-[10px]">{t('company_settings.commercial_register')}:</span>
                <span className="text-slate-900 font-mono">{company.commercial_register}</span>
              </div>
            )}
            {company.tax_number && (
              <div className="flex items-center gap-2">
                <FileText size={14} className="text-slate-400" />
                <span className="text-slate-400 uppercase tracking-widest text-[10px]">{t('company_settings.tax_number')}:</span>
                <span className="text-slate-900 font-mono">{company.tax_number}</span>
              </div>
            )}
          </div>
          {company.address && (
            <div className="flex items-start gap-2 text-sm font-medium text-slate-600 max-w-md">
              <MapPin size={16} className="text-slate-400 shrink-0 mt-0.5" />
              <span>{company.address}</span>
            </div>
          )}
          {company.phone && (
              <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
                <Globe size={14} className="text-slate-400" />
                <span>{company.phone}</span>
              </div>
          )}
        </div>
      </div>

      <div className="flex flex-col items-center md:items-end gap-3 shrink-0 self-stretch md:self-start">
        <div className="text-center md:text-right space-y-1">
            <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase mb-2">{title || t('invoices.invoice')}</h2>
            <div className="flex flex-col items-center md:items-end">
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('invoices.column_number')}:</span>
                    <span className="text-emerald-600 font-black text-xl font-mono">{documentNumber || '---'}</span>
                </div>
                {documentDate && (
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('invoices.column_date')}:</span>
                    <span className="text-slate-600 font-bold text-sm font-mono">{documentDate}</span>
                  </div>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};
