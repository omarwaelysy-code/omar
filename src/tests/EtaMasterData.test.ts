import { describe, it, expect } from 'vitest';
import { EXPECTED_SCHEMA } from '../lib/schema-registry';
import { EtaUnitType, EtaTaxType, EtaTaxSubtype, EtaGovernorate } from '../types';

describe('Egyptian E-Invoice (ETA) Master Data Registries — Phase 2', () => {
  it('should include all ETA master data tables in schema registry', () => {
    expect(EXPECTED_SCHEMA.eta_unit_types).toBeDefined();
    expect(EXPECTED_SCHEMA.eta_tax_types).toBeDefined();
    expect(EXPECTED_SCHEMA.eta_tax_subtypes).toBeDefined();
    expect(EXPECTED_SCHEMA.eta_governorates).toBeDefined();

    expect(EXPECTED_SCHEMA.eta_unit_types).toEqual([
      'code', 'name_ar', 'name_en', 'symbol', 'description', 'is_active', 'created_at'
    ]);

    expect(EXPECTED_SCHEMA.eta_tax_types).toEqual([
      'code', 'name_ar', 'name_en', 'description', 'is_active', 'created_at'
    ]);

    expect(EXPECTED_SCHEMA.eta_tax_subtypes).toEqual([
      'code', 'tax_type_code', 'name_ar', 'name_en', 'description', 'default_rate', 'is_active', 'created_at'
    ]);

    expect(EXPECTED_SCHEMA.eta_governorates).toEqual([
      'code', 'name_ar', 'name_en', 'country_code', 'is_active', 'created_at'
    ]);
  });

  it('should validate EtaUnitType TypeScript structure and standard codes', () => {
    const units: EtaUnitType[] = [
      { code: 'EA', name_ar: 'حبة / واحدة', name_en: 'Each', symbol: 'ea', is_active: true },
      { code: 'KGM', name_ar: 'كيلوجرام', name_en: 'Kilogram', symbol: 'kg', is_active: true },
      { code: 'LTR', name_ar: 'لتر', name_en: 'Litre', symbol: 'L', is_active: true },
      { code: 'PCE', name_ar: 'قطعة', name_en: 'Piece', symbol: 'pc', is_active: true }
    ];

    expect(units.length).toBe(4);
    expect(units.find(u => u.code === 'EA')?.name_en).toBe('Each');
    expect(units.find(u => u.code === 'KGM')?.symbol).toBe('kg');
  });

  it('should validate EtaTaxType (T1 - T20) structure', () => {
    const taxTypes: EtaTaxType[] = [
      { code: 'T1', name_ar: 'ضريبة القيمة المضافة', name_en: 'Value Added Tax', is_active: true },
      { code: 'T2', name_ar: 'ضريبة الجدول (نسبية)', name_en: 'Table Tax (Percentage)', is_active: true },
      { code: 'T3', name_ar: 'ضريبة الجدول (قطعية)', name_en: 'Table Tax (Fixed Amount)', is_active: true },
      { code: 'T4', name_ar: 'الخصم والتحصيل تحت حساب الضريبة', name_en: 'Withholding Tax (WHT)', is_active: true }
    ];

    expect(taxTypes.find(t => t.code === 'T1')?.name_ar).toBe('ضريبة القيمة المضافة');
    expect(taxTypes.find(t => t.code === 'T4')?.name_en).toBe('Withholding Tax (WHT)');
  });

  it('should validate EtaTaxSubtype mapping to parent tax type', () => {
    const subtypes: EtaTaxSubtype[] = [
      { code: 'V001', tax_type_code: 'T1', name_ar: 'خاضع بالسعر العام (14%)', name_en: 'Taxable at General Rate (14%)', default_rate: 14.0, is_active: true },
      { code: 'V009', tax_type_code: 'T1', name_ar: 'معفى من الضريبة وفق القانون', name_en: 'Exempt by Law', default_rate: 0.0, is_active: true },
      { code: 'W001', tax_type_code: 'T4', name_ar: 'المقاولات والتوريدات (1%)', name_en: 'Contracting & Supplies (1%)', default_rate: 1.0, is_active: true },
      { code: 'W004', tax_type_code: 'T4', name_ar: 'الخدمات العامة (3%)', name_en: 'Services (3%)', default_rate: 3.0, is_active: true }
    ];

    const vatSubtypes = subtypes.filter(s => s.tax_type_code === 'T1');
    const whtSubtypes = subtypes.filter(s => s.tax_type_code === 'T4');

    expect(vatSubtypes.length).toBe(2);
    expect(whtSubtypes.length).toBe(2);
    expect(vatSubtypes.find(s => s.code === 'V001')?.default_rate).toBe(14.0);
    expect(whtSubtypes.find(s => s.code === 'W004')?.default_rate).toBe(3.0);
  });

  it('should validate EtaGovernorate structure', () => {
    const governorates: EtaGovernorate[] = [
      { code: 'EG-C', name_ar: 'القاهرة', name_en: 'Cairo', country_code: 'EG', is_active: true },
      { code: 'EG-GZ', name_ar: 'الجيزة', name_en: 'Giza', country_code: 'EG', is_active: true },
      { code: 'EG-ALX', name_ar: 'الإسكندرية', name_en: 'Alexandria', country_code: 'EG', is_active: true }
    ];

    expect(governorates.length).toBe(3);
    expect(governorates.find(g => g.code === 'EG-C')?.country_code).toBe('EG');
  });

  it('should verify active and inactive filtering logic', () => {
    const list = [
      { code: 'U1', is_active: true },
      { code: 'U2', is_active: false },
      { code: 'U3', is_active: true }
    ];

    const activeOnly = list.filter(item => item.is_active === true);
    expect(activeOnly.length).toBe(2);
    expect(activeOnly.map(i => i.code)).toEqual(['U1', 'U3']);
  });
});
