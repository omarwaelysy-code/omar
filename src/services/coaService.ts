import { dbService } from './dbService';
import { STANDARD_COA_TEMPLATE, TemplateType, TemplateAccount } from '../utils/coaTemplates';


export const generateDefaultCOA = async (
  company_id: string,
  user_id: string,
  username: string,
  lang: 'ar' | 'en',
  business_type: 'commercial' | 'service' | 'all',
  onProgress?: (message: string) => void
) => {
  try {
    if (onProgress) onProgress(lang === 'ar' ? 'جاري بناء أنواع الحسابات...' : 'Building Account Types...');

    // 1. Insert Account Types
    const typeIdMap: Record<string, string> = {}; // code -> type_id

    for (const type of STANDARD_COA_TEMPLATE) {
      // Create type
      const typeData = {
        code: type.code,
        name: lang === 'ar' ? type.name_ar : type.name_en, // Uses requested language
        statement_type: type.statement_type,
        classification: type.classification,
        is_active: true,
        company_id
      };
      
      const typeId = await dbService.add('account_types', typeData);
      typeIdMap[type.code] = typeId;
      
      // Log activity
      await dbService.logActivity(user_id, username, company_id, 'إضافة نوع حساب تلقائي', `تم إضافة نوع حساب: ${type.name_ar}`, 'account_types', typeId);
    }

    if (onProgress) onProgress(lang === 'ar' ? 'جاري بناء الحسابات...' : 'Building Accounts...');

    // 2. Insert Accounts Recursively
    const insertAccounts = async (accounts: TemplateAccount[], typeId: string, parentId: string | null = null) => {
      for (const acc of accounts) {
        // Check if this account should be skipped based on business_type
        if (acc.business_type && acc.business_type !== business_type && business_type !== 'all') {
          continue;
        }

        const typeRef = STANDARD_COA_TEMPLATE.find(t => Object.keys(typeIdMap).find(k => typeIdMap[k] === typeId) === t.code);
        
        const accData = {
          code: acc.code,
          name: lang === 'ar' ? acc.name_ar : acc.name_en,
          type_id: typeId,
          type_name: typeRef ? (lang === 'ar' ? typeRef.name_ar : typeRef.name_en) : '',
          parent_id: parentId,
          is_active: true,
          company_id,
          opening_balance: 0,
          required_sub_account: !!(acc.children && acc.children.length > 0),
          account_usage: acc.usage || 'other'
        };

        const newAccId = await dbService.add('accounts', accData);
        await dbService.logActivity(user_id, username, company_id, 'إضافة حساب تلقائي', `تم إضافة حساب: ${acc.name_ar}`, 'accounts', newAccId);

        // Insert children if any
        if (acc.children && acc.children.length > 0) {
          await insertAccounts(acc.children, typeId, newAccId);
        }
      }
    };

    let count = 0;
    const totalTypes = STANDARD_COA_TEMPLATE.length;

    for (const type of STANDARD_COA_TEMPLATE) {
      count++;
      if (onProgress) onProgress(lang === 'ar' ? `جاري بناء الحسابات (${count}/${totalTypes})...` : `Building Accounts (${count}/${totalTypes})...`);
      
      const typeId = typeIdMap[type.code];
      if (typeId) {
        await insertAccounts(type.accounts, typeId, null);
      }
    }

    if (onProgress) onProgress(lang === 'ar' ? 'اكتمل بناء الدليل المحاسبي بنجاح' : 'Chart of Accounts built successfully');
    return true;
  } catch (error) {
    console.error('Error generating COA:', error);
    throw error;
  }
};
