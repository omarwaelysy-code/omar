-- Migration 054: ETA Item Code Registration & GPC Brick Catalog
-- Adds tracking columns to products table and creates eta_gpc_bricks catalog table

ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "eta_code_status" VARCHAR(50) DEFAULT 'Draft';
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "eta_gpc_brick" VARCHAR(50);
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "eta_rejection_reason" TEXT;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "eta_registered_at" TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS "idx_products_eta_code_status" ON "products" ("eta_code_status");

-- Table for GPC (Global Product Classification) Bricks Catalog
CREATE TABLE IF NOT EXISTS "eta_gpc_bricks" (
    "code" VARCHAR(20) PRIMARY KEY,
    "name_ar" VARCHAR(255) NOT NULL,
    "name_en" VARCHAR(255) NOT NULL,
    "category" VARCHAR(150),
    "is_active" BOOLEAN DEFAULT TRUE,
    "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "idx_eta_gpc_bricks_search" ON "eta_gpc_bricks" ("name_ar", "name_en");

-- Seed prominent GPC Brick codes used widely in Egyptian business sectors
INSERT INTO "eta_gpc_bricks" ("code", "name_ar", "name_en", "category") VALUES
-- 1. خدمات النقل والشحن واللوجستيات
('10000287', 'خدمات شحن ونقل بري', 'Road Freight Transport Services', 'النقل واللوجستيات'),
('10000288', 'خدمات الشحن والتفريغ والتخزين', 'Cargo Handling and Storage Services', 'النقل واللوجستيات'),
('10000289', 'خدمات التخليص الجمركي واللوجستي', 'Customs Clearance & Logistics Services', 'النقل واللوجستيات'),
('10000290', 'خدمات نقل البضائع العامة', 'General Freight Transport Services', 'النقل واللوجستيات'),

-- 2. منتجات الورق والكرتون والتعبئة والتغليف
('10000305', 'صناديق وكراتين من ورق مقوى', 'Corrugated Paper or Paperboard Boxes', 'التعبئة والتغليف والورق'),
('10000306', 'أكياس وحقائب ورقية للتعبئة', 'Paper Sacks and Bags', 'التعبئة والتغليف والورق'),
('10000307', 'أشرطة لاصقة ومستلزمات تغليف', 'Adhesive Tapes and Packaging Materials', 'التعبئة والتغليف والورق'),
('10000308', 'بكر ورول وألواح ورقية', 'Paper Rolls and Paperboard Sheets', 'التعبئة والتغليف والورق'),
('10000309', 'أكياس ورولات بلاستيك للتغليف', 'Plastic Bags and Wrapping Rolls', 'التعبئة والتغليف والورق'),
('10000310', 'مناديل ومصنوعات ورقية صحية', 'Tissue and Paper Sanitary Products', 'التعبئة والتغليف والورق'),

-- 3. تكنولوجيا المعلومات والبرمجيات والاستشارات
('10000210', 'خدمات تطوير ودعم البرمجيات وتطبيقات الويب', 'Software Development & Web Applications', 'تقنية المعلومات والاتصالات'),
('10000211', 'أجهزة حاسب آلي وملحقاتها ومخدمات', 'Computer Hardware, Peripherals & Servers', 'تقنية المعلومات والاتصالات'),
('10000212', 'خدمات الاستشارات الإدارية والفنية', 'Management and Technical Consulting Services', 'الخدمات المهنية'),
('10000213', 'خدمات الدعاية والإعلان والتسويق الرقمي', 'Advertising and Digital Marketing Services', 'الخدمات المهنية'),
('10000214', 'خدمات التدريب المهني وتنمية المهارات', 'Professional Training and Development Services', 'الخدمات المهنية'),

-- 4. المواد الغذائية والمشروبات
('10000027', 'بسكويت وحلويات ومقرمشات مخبوزة', 'Biscuits, Crackers & Baked Confectionery', 'الأغذية والمشروبات'),
('10000028', 'شوكولاتة ومنتجات كاكاو', 'Chocolates and Cocoa Products', 'الأغذية والمشروبات'),
('10000029', 'ألبان وأجبان ومنتجات حليب', 'Milk, Cheese and Dairy Products', 'الأغذية والمشروبات'),
('10000030', 'مياه معدنية ومشروبات غازية وعصائر', 'Mineral Waters, Soft Drinks and Juices', 'الأغذية والمشروبات'),
('10000031', 'زيوت طعام ودهون نباتية', 'Edible Oils and Vegetable Fats', 'الأغذية والمشروبات'),
('10000032', 'أرز وحبوب وبقوليات ومطاحن', 'Rice, Grains and Pulses', 'الأغذية والمشروبات'),
('10000033', 'لحوم ودواجن وأسماك طازجة ومجمدة', 'Fresh and Frozen Meat, Poultry & Fish', 'الأغذية والمشروبات'),
('10000034', 'توابل وبهارات ومكسبات طعم', 'Spices, Seasonings and Flavorings', 'الأغذية والمشروبات'),

-- 5. المنتجات الكيماوية والمنظفات والبلاستيك
('10000150', 'منظفات ومطهرات ومواد نظافة منزلية وصناعية', 'Cleaning, Detergent and Disinfectant Products', 'الكيماويات والمنظفات'),
('10000151', 'منتجات وأدوات بلاستيكية مصنعة', 'Manufactured Plastic Articles & Containers', 'الكيماويات والمنظفات'),
('10000152', 'دهانات وطلاءات ومواد عزل وغراء', 'Paints, Coatings, Adhesives and Sealants', 'الكيماويات والمنظفات'),
('10000153', 'أسمدة ومخصبات زراعية ومبيدات', 'Fertilizers and Agricultural Chemicals', 'الكيماويات والمنظفات'),

-- 6. قطع الغيار ومستلزمات السيارات والمعدات
('10000180', 'قطع غيار سيارات ومحركات ومركبات', 'Motor Vehicle and Engine Spare Parts', 'قطع الغيار والمركبات'),
('10000181', 'زيوت وسوائل تشحيم وهيدروليك للسيارات والمعدات', 'Automotive Lubricants, Motor Oils & Greases', 'قطع الغيار والمركبات'),
('10000182', 'إطارات وبطاريات سيارات وشاحنات', 'Tires, Tubes and Vehicle Batteries', 'قطع الغيار والمركبات'),
('10000183', 'فلاتر هواء وزيت ووقود للسيارات والمعدات', 'Automotive Air, Oil and Fuel Filters', 'قطع الغيار والمركبات'),

-- 7. مواد البناء والتشييد والكهرباء
('10000240', 'حديد تسليح ومصنوعات معدنية وصلب', 'Reinforcing Steel, Metal and Iron Products', 'البناء والتشييد'),
('10000241', 'أسمنت ومونة ومواد خرسانية ومحاجر', 'Cement, Ready Mix Concrete and Aggregate', 'البناء والتشييد'),
('10000242', 'كابلات وأسلاك وتجهيزات كهربائية', 'Electrical Cables, Wires and Wiring Accessories', 'الأدوات الكهربائية'),
('10000243', 'أدوات صحية ومواسير ومحابس وسباكة', 'Sanitary Ware, Pipes, Valves and Plumbing', 'البناء والتشييد'),
('10000244', 'أخشاب ومصنوعات خشبية وألواح MDF', 'Timber, Wood and MDF Panels', 'البناء والتشييد'),
('10000245', 'سيراميك وبورسلين ورخام وأرضيات', 'Ceramic Tiles, Porcelain and Marble', 'البناء والتشييد'),

-- 8. الملابس والأقمشة والمنسوجات
('10000260', 'ملابس جاهزة رجالي وحريمي وأطفال', 'Ready-Made Garments and Clothing', 'الملابس والمنسوجات'),
('10000261', 'أقمشة ومنسوجات وخيوط قطنية وصناعية', 'Fabrics, Textiles and Yarns', 'الملابس والمنسوجات'),
('10000262', 'يونيفورم وملابس أمان وسلامة مهنية', 'Safety Workwear and Professional Uniforms', 'الملابس والمنسوجات'),

-- 9. المستلزمات الطبية والأدوية ومستحضرات التجميل
('10000270', 'مستلزمات ومستهلكات طبية وقفازات وكمامات', 'Medical Consumables, Gloves and Disposables', 'المستلزمات الطبية'),
('10000271', 'مستحضرات تجميل وعناية شخصية', 'Cosmetics, Skincare and Personal Care', 'المستلزمات الطبية'),
('10000272', 'أدوية ومستحضرات صيدلانية وفيتامينات', 'Pharmaceuticals, Medicines and Supplements', 'المستلزمات الطبية')
ON CONFLICT ("code") DO UPDATE SET
  "name_ar" = EXCLUDED."name_ar",
  "name_en" = EXCLUDED."name_en",
  "category" = EXCLUDED."category";
