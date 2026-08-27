-- Migration 044: ETA Master Data and Code Registries
-- Creates normalized tables for ETA Unit Types, Tax Types, Tax Subtypes, and Governorates

-- 1. ETA Unit Types Table
CREATE TABLE IF NOT EXISTS "eta_unit_types" (
    "code" VARCHAR(20) PRIMARY KEY,
    "name_ar" VARCHAR(100) NOT NULL,
    "name_en" VARCHAR(100) NOT NULL,
    "symbol" VARCHAR(20),
    "description" TEXT,
    "is_active" BOOLEAN DEFAULT TRUE,
    "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. ETA Tax Types Table (T1 - T20)
CREATE TABLE IF NOT EXISTS "eta_tax_types" (
    "code" VARCHAR(20) PRIMARY KEY,
    "name_ar" VARCHAR(150) NOT NULL,
    "name_en" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN DEFAULT TRUE,
    "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. ETA Tax Subtypes Table
CREATE TABLE IF NOT EXISTS "eta_tax_subtypes" (
    "code" VARCHAR(20) PRIMARY KEY,
    "tax_type_code" VARCHAR(20) NOT NULL REFERENCES "eta_tax_types"("code") ON DELETE CASCADE,
    "name_ar" VARCHAR(255) NOT NULL,
    "name_en" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "default_rate" NUMERIC(6,3),
    "is_active" BOOLEAN DEFAULT TRUE,
    "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "idx_eta_tax_subtypes_type" ON "eta_tax_subtypes"("tax_type_code");

-- 4. ETA Egyptian Governorates / Location Codes Table
CREATE TABLE IF NOT EXISTS "eta_governorates" (
    "code" VARCHAR(20) PRIMARY KEY,
    "name_ar" VARCHAR(100) NOT NULL,
    "name_en" VARCHAR(100) NOT NULL,
    "country_code" VARCHAR(10) DEFAULT 'EG',
    "is_active" BOOLEAN DEFAULT TRUE,
    "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================================
-- SEED ETA UNIT TYPES
-- =========================================================================
INSERT INTO "eta_unit_types" ("code", "name_ar", "name_en", "symbol", "description") VALUES
('EA', 'حبة / واحدة', 'Each', 'ea', 'Individual unit or item'),
('PCE', 'قطعة', 'Piece', 'pc', 'Standard piece unit'),
('KGM', 'كيلوجرام', 'Kilogram', 'kg', 'Metric unit of mass'),
('GRM', 'جرام', 'Gram', 'g', 'Metric unit of mass'),
('TNE', 'طن متري', 'Tonne (Metric Ton)', 't', 'Metric ton (1000 kg)'),
('LTR', 'لتر', 'Litre', 'L', 'Metric unit of liquid volume'),
('MLT', 'مليلتر', 'Millilitre', 'ml', 'Metric unit of liquid volume'),
('MTR', 'متر طولي', 'Metre', 'm', 'Unit of length'),
('CMT', 'سنتيمتر', 'Centimetre', 'cm', 'Unit of length'),
('KMT', 'كيلومتر', 'Kilometre', 'km', 'Unit of length'),
('MTK', 'متر مربع', 'Square Metre', 'm²', 'Unit of area'),
('MTQ', 'متر مكعب', 'Cubic Metre', 'm³', 'Unit of volume'),
('BOX', 'صندوق / كرتونة', 'Box', 'box', 'Box packaging container'),
('BG', 'كيس / شيكارة', 'Bag', 'bg', 'Bag or sack packaging'),
('SET', 'طقم / مجموعة', 'Set', 'set', 'Set of associated articles'),
('PR', 'زوج', 'Pair', 'pr', 'Pair (2 items)'),
('PK', 'طرد / عبوة', 'Package', 'pk', 'Packaged parcel or package'),
('RO', 'لفة / رول', 'Roll', 'roll', 'Roll packaging'),
('CAN', 'علبة صفيح / كانز', 'Can', 'can', 'Can packaging'),
('DRM', 'برميل', 'Drum', 'drum', 'Drum barrel container'),
('BOT', 'زجاجة / قارورة', 'Bottle', 'bt', 'Bottle container'),
('DZN', 'دستة', 'Dozen', 'dz', 'Dozen (12 items)'),
('HUR', 'ساعة عمل', 'Hour', 'hr', 'Time unit for services'),
('DAY', 'يوم عمل', 'Day', 'day', 'Time unit for services'),
('MON', 'شهر', 'Month', 'mon', 'Time unit for services')
ON CONFLICT ("code") DO UPDATE SET
  "name_ar" = EXCLUDED."name_ar",
  "name_en" = EXCLUDED."name_en",
  "symbol" = EXCLUDED."symbol",
  "description" = EXCLUDED."description";

-- =========================================================================
-- SEED ETA TAX TYPES (T1 - T20)
-- =========================================================================
INSERT INTO "eta_tax_types" ("code", "name_ar", "name_en", "description") VALUES
('T1', 'ضريبة القيمة المضافة', 'Value Added Tax', 'Value Added Tax (VAT)'),
('T2', 'ضريبة الجدول (نسبية)', 'Table Tax (Percentage)', 'Table tax applied as percentage'),
('T3', 'ضريبة الجدول (قطعية)', 'Table Tax (Fixed Amount)', 'Table tax applied as specific amount'),
('T4', 'الخصم والتحصيل تحت حساب الضريبة', 'Withholding Tax (WHT)', 'Tax deduction and collection at source'),
('T5', 'ضريبة الدمغة (نسبية)', 'Stamping Tax (Percentage)', 'Percentage based stamping duty'),
('T6', 'ضريبة الدمغة (قطعية)', 'Stamping Tax (Fixed Amount)', 'Fixed amount stamping duty'),
('T7', 'ضريبة الملاهي', 'Entertainment Tax', 'Entertainment tax'),
('T8', 'رسم تنمية الموارد', 'Resource Development Fee', 'State resource development fee'),
('T9', 'رسم خدمة', 'Service Charges', 'Service charges tax'),
('T10', 'رسم المحليات', 'Municipality Fees', 'Local municipality fees'),
('T11', 'رسم التأمين الصحي الشامل', 'Medical Insurance Fee', 'Comprehensive medical insurance fee'),
('T12', 'رسوم أخرى', 'Other Fees', 'Other official government fees'),
('T13', 'ضريبة الدمغة النسبية للمشروبات', 'Proportional Stamp Tax', 'Proportional stamp tax'),
('T14', 'ضريبة الدمغة النوعية', 'Specific Stamp Tax', 'Specific stamp duty'),
('T15', 'رسم النظافة', 'Cleanliness Fee', 'Cleanliness and sanitation fee'),
('T16', 'المساهمة التكافلية للتأمين الصحي (0.25%)', 'Solidarity Contribution Fee (0.25%)', '0.25% revenue solidarity contribution for medical insurance'),
('T17', 'ضريبة النقل الجوي', 'Air Transport Tax', 'Air transport sector tax'),
('T18', 'رسم مغادرة الموانئ', 'Port Departure Fee', 'Port departure fee'),
('T19', 'رسم المجازر', 'Slaughterhouse Fee', 'Slaughterhouse inspection fee'),
('T20', 'ضريبة ورسوم جمركية', 'Customs Tax and Duties', 'Customs and import duties')
ON CONFLICT ("code") DO UPDATE SET
  "name_ar" = EXCLUDED."name_ar",
  "name_en" = EXCLUDED."name_en",
  "description" = EXCLUDED."description";

-- =========================================================================
-- SEED ETA TAX SUBTYPES
-- =========================================================================
INSERT INTO "eta_tax_subtypes" ("code", "tax_type_code", "name_ar", "name_en", "description", "default_rate") VALUES
-- Subtypes for T1 (VAT)
('V001', 'T1', 'خاضع بالسعر العام (14%)', 'Taxable at General Rate (14%)', 'Standard 14% VAT rate', 14.0),
('V002', 'T1', 'خاضع بأسعار أخرى مخفضة / خاصة', 'Taxable at Other Rates', 'Special or reduced VAT rates', NULL),
('V003', 'T1', 'خاضع بسعر صفر (صادرات سلع)', 'Taxable at 0% (Goods Export)', '0% rate for exported goods outside Egypt', 0.0),
('V004', 'T1', 'خاضع بسعر صفر (مناطق حرة واقتصادية)', 'Taxable at 0% (Free Zones)', '0% rate for free zones and special economic zones', 0.0),
('V005', 'T1', 'آلات ومعدات خطوط إنتاج (5%)', 'Machinery & Equipment (5%)', '5% reduced rate for production equipment and machinery', 5.0),
('V006', 'T1', 'خاضع بسعر صفر (صادرات خدمات)', 'Taxable at 0% (Services Export)', '0% rate for exported services outside Egypt', 0.0),
('V007', 'T1', 'خاضع بسعر صفر (اتفاقيات دولية ومشتريات معفاة)', 'Taxable at 0% (International Agreements)', '0% rate under ratified international treaties', 0.0),
('V008', 'T1', 'خاضع بسعر صفر (توريدات خاصة ومشروعات قومية)', 'Taxable at 0% (Special Supplies)', '0% rate for specified national projects', 0.0),
('V009', 'T1', 'معفى من الضريبة وفق القانون', 'Exempt by Law', 'Goods and services legally exempt from VAT', 0.0),
('V010', 'T1', 'غير خاضع للضريبة', 'Non-taxable', 'Transactions outside the scope of VAT', 0.0),

-- Subtypes for T4 (WHT)
('W001', 'T4', 'المقاولات والتوريدات (1%)', 'Contracting & Supplies (1%)', '1% WHT on contracting and supplies', 1.0),
('W002', 'T4', 'التوريدات العامة (1%)', 'General Supplies (1%)', '1% WHT on general supplies', 1.0),
('W003', 'T4', 'المشتريات السلعية (1%)', 'Purchases (1%)', '1% WHT on trade purchases', 1.0),
('W004', 'T4', 'الخدمات العامة (3%)', 'Services (3%)', '3% WHT on services', 3.0),
('W005', 'T4', 'السمسرة والعمولات (5%)', 'Brokerage & Commissions (5%)', '5% WHT on commissions and agency fees', 5.0),
('W006', 'T4', 'المهن غير التجارية والحرة (5%)', 'Professional Non-commercial (5%)', '5% WHT on free professions and consultations', 5.0),
('W007', 'T4', 'التخليص الجمركي (3%)', 'Customs Clearance (3%)', '3% WHT on customs clearance services', 3.0),
('W008', 'T4', 'النقل والتخزين والشحن (1%)', 'Transport & Storage (1%)', '1% WHT on transport and warehousing', 1.0),
('W009', 'T4', 'الوكالة التجارية (5%)', 'Commercial Agency (5%)', '5% WHT on commercial agency contracts', 5.0),
('W010', 'T4', 'الخدمات الإعلانية والدعائية (3%)', 'Advertising Services (3%)', '3% WHT on advertising services', 3.0),
('W011', 'T4', 'تأجير الآلات والمعدات (3%)', 'Equipment Rental (3%)', '3% WHT on machinery and equipment leasing', 3.0),
('W012', 'T4', 'معفى من الخصم والتحصيل', 'Exempt from WHT', 'Entities with tax holiday or legal exemption from WHT', 0.0),

-- Subtypes for T2 (Table Tax Percentage)
('Tbl01', 'T2', 'ضريبة جدول نسبية عامة', 'General Table Tax Percentage', 'Standard table tax percentage', NULL),
('Tbl02', 'T2', 'ضريبة جدول نسبية مخفضة', 'Reduced Table Tax Percentage', 'Reduced table tax percentage', NULL),

-- Subtypes for T3 (Table Tax Fixed)
('Tbl03', 'T3', 'ضريبة جدول قطعية للوحدة', 'Fixed Amount Table Tax', 'Fixed amount table tax per quantity/unit', NULL),

-- Subtypes for T5 & T6 (Stamp Tax)
('ST01', 'T5', 'ضريبة دمغة نسبية على العقود والإعلانات', 'Proportional Stamp Duty', 'Proportional stamp tax on contracts and ads', NULL),
('ST02', 'T6', 'ضريبة دمغة نوعية قطعية', 'Specific Fixed Stamp Duty', 'Fixed amount specific stamp duty', NULL),

-- Subtypes for T16 (Health Insurance Solidarity)
('RD01', 'T16', 'المساهمة التكافلية للتأمين الصحي الشامل (0.25%)', 'Solidarity Contribution (0.25%)', '0.25% revenue contribution to universal health insurance', 0.25)
ON CONFLICT ("code") DO UPDATE SET
  "tax_type_code" = EXCLUDED."tax_type_code",
  "name_ar" = EXCLUDED."name_ar",
  "name_en" = EXCLUDED."name_en",
  "description" = EXCLUDED."description",
  "default_rate" = EXCLUDED."default_rate";

-- =========================================================================
-- SEED ETA GOVERNORATES
-- =========================================================================
INSERT INTO "eta_governorates" ("code", "name_ar", "name_en", "country_code") VALUES
('EG-C', 'القاهرة', 'Cairo', 'EG'),
('EG-GZ', 'الجيزة', 'Giza', 'EG'),
('EG-ALX', 'الإسكندرية', 'Alexandria', 'EG'),
('EG-KB', 'القليوبية', 'Qalyubia', 'EG'),
('EG-DK', 'الدقهلية', 'Dakahlia', 'EG'),
('EG-SHR', 'الشرقية', 'Sharqia', 'EG'),
('EG-MNF', 'المنوفية', 'Menofia', 'EG'),
('EG-GH', 'الغربية', 'Gharbia', 'EG'),
('EG-KFS', 'كفر الشيخ', 'Kafr El-Sheikh', 'EG'),
('EG-BH', 'البحيرة', 'Beheira', 'EG'),
('EG-DT', 'دمياط', 'Damietta', 'EG'),
('EG-PTS', 'بورسعيد', 'Port Said', 'EG'),
('EG-IS', 'الإسماعيلية', 'Ismailia', 'EG'),
('EG-SUZ', 'السويس', 'Suez', 'EG'),
('EG-SIN', 'شمال سيناء', 'North Sinai', 'EG'),
('EG-JS', 'جنوب سيناء', 'South Sinai', 'EG'),
('EG-BA', 'البحر الأحمر', 'Red Sea', 'EG'),
('EG-MT', 'مطروح', 'Matrouh', 'EG'),
('EG-WAD', 'الوادي الجديد', 'New Valley', 'EG'),
('EG-FYM', 'الفيوم', 'Fayoum', 'EG'),
('EG-BNS', 'بني سويف', 'Beni Suef', 'EG'),
('EG-MN', 'المنيا', 'Minya', 'EG'),
('EG-AST', 'أسيوط', 'Asyut', 'EG'),
('EG-SHG', 'سوهاج', 'Sohag', 'EG'),
('EG-QNA', 'قنا', 'Qena', 'EG'),
('EG-LX', 'الأقصر', 'Luxor', 'EG'),
('EG-ASN', 'أسوان', 'Aswan', 'EG')
ON CONFLICT ("code") DO UPDATE SET
  "name_ar" = EXCLUDED."name_ar",
  "name_en" = EXCLUDED."name_en",
  "country_code" = EXCLUDED."country_code";
