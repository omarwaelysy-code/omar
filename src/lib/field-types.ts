import { 
  Type, 
  AlignLeft, 
  FileText, 
  Tags, 
  Link as LinkIcon, 
  Mail, 
  Phone, 
  Hash, 
  DollarSign, 
  Percent, 
  Binary, 
  Calculator, 
  Calendar, 
  Clock, 
  CalendarClock, 
  CheckSquare, 
  Layers, 
  ToggleLeft, 
  CircleDot, 
  User, 
  Users, 
  Truck, 
  Package, 
  FolderSearch, 
  ExternalLink, 
  File, 
  Image as ImageIcon, 
  Barcode, 
  QrCode, 
  Signature, 
  MapPin, 
  Navigation, 
  Building2, 
  Globe
} from 'lucide-react';

export interface FieldTypeDefinition {
  id: string;
  label_ar: string;
  label_en: string;
  icon: any;
  category: 'text' | 'number' | 'date' | 'choice' | 'relation' | 'media' | 'location';
  description_ar: string;
  description_en: string;
  example_ar: string;
  example_en: string;
}

export interface FieldCategory {
  id: string;
  label_ar: string;
  label_en: string;
  icon: any;
  color: string;
}

export const FIELD_CATEGORIES: FieldCategory[] = [
  { id: 'text', label_ar: 'الحقول النصية', label_en: 'Text Fields', icon: AlignLeft, color: 'text-blue-600' },
  { id: 'number', label_ar: 'الحقول الرقمية', label_en: 'Numeric Fields', icon: Hash, color: 'text-amber-600' },
  { id: 'date', label_ar: 'التاريخ والوقت', label_en: 'Date & Time', icon: Calendar, color: 'text-rose-600' },
  { id: 'choice', label_ar: 'الاختيارات', label_en: 'Choice Fields', icon: CheckSquare, color: 'text-emerald-600' },
  { id: 'relation', label_ar: 'العلاقات والربط', label_en: 'Relations', icon: LinkIcon, color: 'text-indigo-600' },
  { id: 'media', label_ar: 'الملفات والوسائط', label_en: 'Media & Files', icon: File, color: 'text-purple-600' },
  { id: 'location', label_ar: 'الموقع والخرائط', label_en: 'Location', icon: MapPin, color: 'text-orange-600' },
];

export const FIELD_TYPES: FieldTypeDefinition[] = [
  // Text
  {
    id: 'text',
    category: 'text',
    label_ar: 'نص قصير',
    label_en: 'Short Text',
    icon: Type,
    description_ar: 'حقل نصي لسطر واحد (الاسم، العنوان، إلخ).',
    description_en: 'Single-line text field (Name, Title, etc.)',
    example_ar: 'أحمد محمد',
    example_en: 'John Doe'
  },
  {
    id: 'textarea',
    category: 'text',
    label_ar: 'نص طويل',
    label_en: 'Long Text',
    icon: AlignLeft,
    description_ar: 'مساحة نصية لعدة أسطر (ملاحظات، وصف).',
    description_en: 'Multi-line text area (Notes, Description)',
    example_ar: 'هذا النص تجريبي للوصف المطول...',
    example_en: 'Detailed description goes here...'
  },
  {
    id: 'rich_text',
    category: 'text',
    label_ar: 'محرر نصوص',
    label_en: 'Rich Text Editor',
    icon: FileText,
    description_ar: 'محرر نصوص متقدم يدعم التنسيق والخطوط.',
    description_en: 'Advanced text editor with formatting.',
    example_ar: '<b>نص عريض</b>',
    example_en: '<b>Bold Text</b>'
  },
  {
    id: 'tags',
    category: 'text',
    label_ar: 'Tags',
    label_en: 'Tags',
    icon: Tags,
    description_ar: 'إضافة وسوم متعددة مفصولة بفواصل.',
    description_en: 'Multiple tags separated by commas.',
    example_ar: 'شحن، بري، عاجل',
    example_en: 'shipment, land, urgent'
  },
  {
    id: 'url',
    category: 'text',
    label_ar: 'رابط URL',
    label_en: 'URL Link',
    icon: LinkIcon,
    description_ar: 'رابط لموقع إلكتروني أو صفحة.',
    description_en: 'Website link or page URL.',
    example_ar: 'https://example.com',
    example_en: 'https://example.com'
  },
  {
    id: 'email',
    category: 'text',
    label_ar: 'بريد إلكتروني',
    label_en: 'Email',
    icon: Mail,
    description_ar: 'عنوان بريد إلكتروني صحيح.',
    description_en: 'Valid email address.',
    example_ar: 'user@example.com',
    example_en: 'user@example.com'
  },
  {
    id: 'phone',
    category: 'text',
    label_ar: 'رقم هاتف',
    label_en: 'Phone Number',
    icon: Phone,
    description_ar: 'رقم جوال أو هاتف ثابت.',
    description_en: 'Mobile or landline phone number.',
    example_ar: '+966500000000',
    example_en: '+1234567890'
  },

  // Number
  {
    id: 'number',
    category: 'number',
    label_ar: 'رقم',
    label_en: 'Number',
    icon: Hash,
    description_ar: 'إدخال قيم رقمية (أعداد صحيحة أو عشرية).',
    description_en: 'Numeric inputs (Interger or Decimal).',
    example_ar: '150',
    example_en: '150'
  },
  {
    id: 'currency',
    category: 'number',
    label_ar: 'عملة',
    label_en: 'Currency',
    icon: DollarSign,
    description_ar: 'قيم مالية مع رمز العملة.',
    description_en: 'Financial values with currency symbol.',
    example_ar: '1,500.00 ر.س',
    example_en: '$1,500.00'
  },
  {
    id: 'percentage',
    category: 'number',
    label_ar: 'نسبة مئوية',
    label_en: 'Percentage',
    icon: Percent,
    description_ar: 'قيم مئوية (مثل الخصم أو الضريبة).',
    description_en: 'Percentage values (Discount, VAT).',
    example_ar: '15%',
    example_en: '15%'
  },
  {
    id: 'auto_number',
    category: 'number',
    label_ar: 'رقم تلقائي',
    label_en: 'Auto Number',
    icon: Binary,
    description_ar: 'مسلسل يتم إنشاؤه تلقائياً بواسطة النظام.',
    description_en: 'Sequential number generated by system.',
    example_ar: 'INV-0001',
    example_en: 'INV-0001'
  },
  {
    id: 'formula',
    category: 'number',
    label_ar: 'معادلة محسوبة',
    label_en: 'Formula',
    icon: Calculator,
    description_ar: 'ناتج عملية حسابية بين حقول أخرى.',
    description_en: 'Result of calculations between fields.',
    example_ar: 'السعر × الكمية',
    example_en: 'Price * Quantity'
  },

  // Date
  {
    id: 'date',
    category: 'date',
    label_ar: 'تاريخ',
    label_en: 'Date',
    icon: Calendar,
    description_ar: 'اختيار تاريخ محدد من التقويم.',
    description_en: 'Select a specific date from calendar.',
    example_ar: '2024-05-08',
    example_en: '2024-05-08'
  },
  {
    id: 'time',
    category: 'date',
    label_ar: 'وقت',
    label_en: 'Time',
    icon: Clock,
    description_ar: 'تحديد وقت (ساعة:دقيقة).',
    description_en: 'Specify time (Hour:Minute).',
    example_ar: '14:30',
    example_en: '14:30'
  },
  {
    id: 'datetime',
    category: 'date',
    label_ar: 'تاريخ ووقت',
    label_en: 'Date & Time',
    icon: CalendarClock,
    description_ar: 'اختيار التاريخ والوقت معاً.',
    description_en: 'Select both date and time.',
    example_ar: '2024-05-08 14:30',
    example_en: '2024-05-08 14:30'
  },

  // Choice
  {
    id: 'select',
    category: 'choice',
    label_ar: 'قائمة منسدلة',
    label_en: 'Dropdown List',
    icon: Layers,
    description_ar: 'اختيار قيمة واحدة من قائمة خيارات.',
    description_en: 'Select one value from a list.',
    example_ar: 'نشط، غير نشط',
    example_en: 'Active, Inactive'
  },
  {
    id: 'multi_select',
    category: 'choice',
    label_ar: 'Multi Select',
    label_en: 'Multi Select',
    icon: CheckSquare,
    description_ar: 'اختيار أكثر من قيمة من القائمة.',
    description_en: 'Select multiple values from a list.',
    example_ar: 'خيار 1، خيار 2',
    example_en: 'Option 1, Option 2'
  },
  {
    id: 'boolean',
    category: 'choice',
    label_ar: 'نعم / لا',
    label_en: 'Yes / No',
    icon: ToggleLeft,
    description_ar: 'حقل منطقي للتبديل بين حالتين (Switch).',
    description_en: 'Boolean toggle between two states.',
    example_ar: 'نعم',
    example_en: 'Yes'
  },
  {
    id: 'radio',
    category: 'choice',
    label_ar: 'Radio Buttons',
    label_en: 'Radio Buttons',
    icon: CircleDot,
    description_ar: 'اختيار خيار واحد تظهر جميعها أمام المستخدم.',
    description_en: 'Select one option from visible list.',
    example_ar: '● خيار أ ○ خيار ب',
    example_en: '● Option A ○ Option B'
  },

  // Relation
  {
    id: 'user',
    category: 'relation',
    label_ar: 'مستخدم',
    label_en: 'System User',
    icon: User,
    description_ar: 'ربط الحقل بمستخدم من النظام.',
    description_en: 'Link field to a system user.',
    example_ar: 'المدير المالي',
    example_en: 'Finance Manager'
  },
  {
    id: 'customer',
    category: 'relation',
    label_ar: 'عميل',
    label_en: 'Customer',
    icon: Users,
    description_ar: 'ربط الحقل بقاعدة بيانات العملاء.',
    description_en: 'Link field to customers database.',
    example_ar: 'شركة الأمل للتجارة',
    example_en: 'Hope Trading Co.'
  },
  {
    id: 'supplier',
    category: 'relation',
    label_ar: 'مورد',
    label_en: 'Supplier',
    icon: Truck,
    description_ar: 'ربط الحقل بقاعدة بيانات الموردين.',
    description_en: 'Link field to suppliers database.',
    example_ar: 'شركة المجد للصناعة',
    example_en: 'Majd Ind.'
  },
  {
    id: 'product',
    category: 'relation',
    label_ar: 'منتج',
    label_en: 'Product',
    icon: Package,
    description_ar: 'ربط الحقل بمنتج أو خدمة من المخزن.',
    description_en: 'Link field to a product or service.',
    example_ar: 'هاتف ذكي 128 جيجا',
    example_en: 'Smartphone 128GB'
  },
  {
    id: 'category',
    category: 'relation',
    label_ar: 'تصنيف',
    label_en: 'Category',
    icon: FolderSearch,
    description_ar: 'ربط الحقل بتصنيف عملية آخر.',
    description_en: 'Link field to another category.',
    example_ar: 'تصنيف فرعي للشحن',
    example_en: 'Sub-category for shipping'
  },
  {
    id: 'record_link',
    category: 'relation',
    label_ar: 'ربط بسجل آخر',
    label_en: 'Record Link',
    icon: ExternalLink,
    description_ar: 'ربط الحقل بسجل بيانات من أي جدول آخر.',
    description_en: 'Link field to a record in another table.',
    example_ar: '#REC-1002',
    example_en: '#REC-1002'
  },

  // Media
  {
    id: 'file',
    category: 'media',
    label_ar: 'رفع ملف',
    label_en: 'File Upload',
    icon: File,
    description_ar: 'رفع ملفات (PDF, Doc, إلخ).',
    description_en: 'Upload files (PDF, Doc, etc.).',
    example_ar: 'contract.pdf',
    example_en: 'contract.pdf'
  },
  {
    id: 'image',
    category: 'media',
    label_ar: 'صورة',
    label_en: 'Image',
    icon: ImageIcon,
    description_ar: 'رفع صورة ومعاينتها مباشرة.',
    description_en: 'Upload and preview image.',
    example_ar: 'profile.jpg',
    example_en: 'profile.jpg'
  },
  {
    id: 'barcode',
    category: 'media',
    label_ar: 'باركود',
    label_en: 'Barcode',
    icon: Barcode,
    description_ar: 'توليد أو مسح كود باركود.',
    description_en: 'Generate or scan barcode.',
    example_ar: '123456789',
    example_en: '123456789'
  },
  {
    id: 'qr',
    category: 'media',
    label_ar: 'QR Code',
    label_en: 'QR Code',
    icon: QrCode,
    description_ar: 'توليد رمز استجابة سريعة.',
    description_en: 'Generate QR code.',
    example_ar: 'QR-Code-Link',
    example_en: 'QR-Code-Link'
  },
  {
    id: 'signature',
    category: 'media',
    label_ar: 'توقيع',
    label_en: 'Signature',
    icon: Signature,
    description_ar: 'حقل توقيع إلكتروني يدوي.',
    description_en: 'Manual digital signature field.',
    example_ar: 'Signed by User',
    example_en: 'Signed by User'
  },

  // Location
  {
    id: 'gps',
    category: 'location',
    label_ar: 'GPS',
    label_en: 'GPS Coordinates',
    icon: MapPin,
    description_ar: 'تحديد إحداثيات الموقع ف الخريطة.',
    description_en: 'Pin location coordinates on map.',
    example_ar: '24.7136° N, 46.6753° E',
    example_en: '24.7136° N, 46.6753° E'
  },
  {
    id: 'address',
    category: 'location',
    label_ar: 'عنوان',
    label_en: 'Address Container',
    icon: Navigation,
    description_ar: 'حقل بحث عن عنوان كامل.',
    description_en: 'Full address search field.',
    example_ar: 'حي الملقا، الرياض',
    example_en: 'Malqa, Riyadh'
  },
  {
    id: 'city',
    category: 'location',
    label_ar: 'مدينة',
    label_en: 'City',
    icon: Building2,
    description_ar: 'قائمة اختيار المدن.',
    description_en: 'City selection list.',
    example_ar: 'جدة',
    example_en: 'Jeddah'
  },
  {
    id: 'country',
    category: 'location',
    label_ar: 'دولة',
    label_en: 'Country',
    icon: Globe,
    description_ar: 'قائمة اختيار الدول مع الأعلام.',
    description_en: 'Country selection with flags.',
    example_ar: 'السعودية',
    example_en: 'Saudi Arabia'
  }
];
