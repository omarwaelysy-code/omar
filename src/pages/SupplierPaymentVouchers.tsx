import React from 'react';
import { PaymentVouchers } from './PaymentVouchers';
import { useLanguage } from '../contexts/LanguageContext';

export const SupplierPaymentVouchers: React.FC = () => {
  const { language } = useLanguage();
  return (
    <PaymentVouchers 
      isSupplierOnly={true} 
      pageTitle={language === 'ar' ? 'سند صرف مورد' : 'Supplier Payment Voucher'} 
    />
  );
};

export default SupplierPaymentVouchers;
