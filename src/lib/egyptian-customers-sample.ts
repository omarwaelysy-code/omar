// Realistic Egyptian Corporate Customers Generator (Hundreds of Egyptian Companies)

export interface EgyptianCustomerSampleRow {
  code: string;
  manual_code: string;
  name: string;
  mobile: string;
  email: string;
  address: string;
  tax_number: string;
  account_code: string;
  counter_account_code: string;
  opening_balance: number;
  opening_balance_date: string;
  credit_limit: number;
  payment_terms: 'credit' | 'cash';
  payment_terms_days: number;
  advance_percentage: number;
}

const FAMOUS_EGYPTIAN_COMPANIES: { name: string; domain: string; address: string }[] = [
  { name: 'شركة المقاولون العرب لتجارة مواد البناء', domain: 'arabcontractors-eg.com', address: 'القاهرة - مدينة نصر - شارع النصر' },
  { name: 'مجموعة العربي للتجارة والصناعة (توشيبا العربي)', domain: 'elarabygroup.com', address: 'القاهرة - شبرا - جزيرة بدران' },
  { name: 'شركة السويدي إليكتريك للكابلات والمهمات الكهربائية', domain: 'elsewedy.com', address: 'القاهرة - التجمع الخامس - شارع التسعين الشمالي' },
  { name: 'شركة أوراسكوم للإنشاءات والتوريدات الهندسية', domain: 'orascom.com', address: 'القاهرة - كورنيش النيل - أبراج نايل سيتي' },
  { name: 'شركة حسن علام للتجارة والمقاولات المتكاملة', domain: 'hassanallam.com', address: 'القاهرة - مصر الجديدة - شارع الثورة' },
  { name: 'شركة حديد عز لتجارة وتوزيع الصلب', domain: 'ezzsteel.com', address: 'الجيزة - الدقي - شارع مصدق' },
  { name: 'شركة جهينة للصناعات الغذائية والتوزيع', domain: 'juhayna.com', address: 'الجيزة - مدينة 6 أكتوبر - المنطقة الصناعية الأولى' },
  { name: 'شركة إيديتا للصناعات الغذائية والتجارة', domain: 'edita.com.eg', address: 'الجيزة - الشيخ زايد - أركان بلازا' },
  { name: 'شركة عبور لاند للصناعات الغذائية', domain: 'obourland.com', address: 'القليوبية - مدينة العبور - المنطقة الصناعية الأولى' },
  { name: 'شركة دومتي للصناعات الغذائية والتوزيع', domain: 'domty.org', address: 'الجيزة - مدينة 6 أكتوبر - المنطقة الصناعية الثالثة' },
  { name: 'شركة النساجون الشرقيون للسجاد والمفروشات', domain: 'orientalweavers.com', address: 'الشرقية - مدينة العاشر من رمضان - المنطقة الصناعية B1' },
  { name: 'مجموعة سيراميكا كليوباترا للتجارة والتوزيع', domain: 'cleopatragroup.com', address: 'الجيزة - المهندسين - شارع جامعة الدول العربية' },
  { name: 'شركة فريش إليكتريك للأجهزة المنزلية', domain: 'fresh.com.eg', address: 'الشرقية - مدينة العاشر من رمضان - المنطقة الصناعية A2' },
  { name: 'شركة إيبيكو للأدوية والصناعات الكيماوية', domain: 'eipico.com.eg', address: 'الشرقية - مدينة العاشر من رمضان - المنطقة الصناعية الأولى' },
  { name: 'شركة فاركو للأدوية والمستلزمات الطبية', domain: 'pharco.org', address: 'الإسكندرية - العامرية - الكيلو 31 طريق الإسكندرية الصحراوي' },
  { name: 'شركة إيفا فارما للصناعات الدوائية والطبية', domain: 'evapharma.com', address: 'الجيزة - الهرم - شارع الطالبية' },
  { name: 'شركة ابن سينا فارما لتجارة وتوزيع الأدوية', domain: 'ibnsina-pharma.com', address: 'القليوبية - مدينة العبور - المنطقة الصناعية' },
  { name: 'شركة المتحدة للصيادلة وتوزيع الأدوية', domain: 'unitedpharmacists.com', address: 'القاهرة - مدينة نصر - المنطقة الحرة' },
  { name: 'شركة غبور أوتو (جي بي أوتو) لتجارة السيارات', domain: 'gb-auto.com', address: 'الجيزة - أبو رواش - طريق القاهرة الإسكندرية الصحراوي' },
  { name: 'شركة المنصور للسيارات والمعدات الثقيلة', domain: 'mansourgroup.com', address: 'الجيزة - المهندسين - شارع لبنان' },
  { name: 'شركة راية للتجارة والتوزيع والنظم', domain: 'rayacorp.com', address: 'الجيزة - مدينة 6 أكتوبر - المحور المركزي' },
  { name: 'شركة بي تك للتجارة والتوزيع الإلكتروني', domain: 'btech.com', address: 'القاهرة - مدينة نصر - شارع عباس العقاد' },
  { name: 'شركة السويس للأسمنت ومواد البناء', domain: 'suezcement.com.eg', address: 'القاهرة - المعادي - كورنيش النيل' },
  { name: 'شركة لافارج مصر للأسمنت والخرسانة الجاهزة', domain: 'lafarge.com.eg', address: 'القاهرة - التجمع الخامس - كايرو فيستيفال سيتي' },
  { name: 'شركة العربية للأسمنت ومواد البناء', domain: 'arabiancement.com', address: 'القاهرة - التجمع الخامس - شارع التسعين الجنوبي' },
  { name: 'شركة بشاي للصلب والصناعات المعدنية', domain: 'beshaysteel.com', address: 'المنوفية - مدينة السادات - المنطقة الصناعية الخامسة' },
  { name: 'شركة المصريين للصلب وتجارة المعادن', domain: 'egyptiansteel.com', address: 'القاهرة - جاردن سيتي - كورنيش النيل' },
  { name: 'شركة الجارحي للصلب ومواد البناء', domain: 'elgarhy-steel.com', address: 'الجيزة - المهندسين - شارع البطل أحمد عبد العزيز' },
  { name: 'شركة المراكبي للصلب والتوريدات الصناعية', domain: 'elmarakbysteel.com', address: 'الجيزة - مدينة 6 أكتوبر - المنطقة الصناعية الرابعة' },
  { name: 'شركة صافولا مصر للأغذية والزيوت', domain: 'savola.com', address: 'الشرقية - مدينة العاشر من رمضان - المنطقة الصناعية الثالثة' },
  { name: 'شركة أرما للصناعات الغذائية والزيوت', domain: 'arma.com.eg', address: 'الشرقية - مدينة العاشر من رمضان - المنطقة الصناعية A1' },
  { name: 'شركة فرج الله للصناعات الغذائية والتصدير', domain: 'faragalla.com', address: 'الإسكندرية - برج العرب الجديدة - المنطقة الصناعية الأولى' },
  { name: 'شركة حلواني إخوان مصر للصناعات الغذائية', domain: 'halwani.com.eg', address: 'الشرقية - مدينة العاشر من رمضان - المنطقة الصناعية B2' },
  { name: 'شركة الرشيدي الميزان للصناعات الغذائية', domain: 'elrashidielmizan.com', address: 'الجيزة - مدينة 6 أكتوبر - المنطقة الصناعية الثانية' },
  { name: 'شركة الدلتا للسكر والصناعات التكاملية', domain: 'deltasugar.com.eg', address: 'الجيزة - الدقي - شارع محيي الدين أبو العز' },
  { name: 'شركة الفيوم للسكر والتوريدات الغذائية', domain: 'fayoumsugar.com', address: 'الفيوم - مركز إطسا - المنطقة الصناعية' },
  { name: 'شركة الأهرام للمشروبات والتوزيع', domain: 'alahrambeverages.com', address: 'الجيزة - الدقي - شارع ثروت' },
  { name: 'شركة بيتي للصناعات الغذائية والألبان', domain: 'beyti-eygpt.com', address: 'البحيرة - النوبارية الجديدة - الكيلو 75 طريق مصر إسكندرية' },
  { name: 'شركة وادي فوود للصناعات الزراعية والغذائية', domain: 'wadifood.com', address: 'الجيزة - الشيخ زايد - كابيتال بيزنس بارك' },
  { name: 'شركة دالتكس للتنمية الزراعية والتصدير', domain: 'daltexcorp.com', address: 'الجيزة - المهندسين - شارع وادي النيل' },
  { name: 'شركة سيكم للمنتجات الحيوية والزراعية', domain: 'sekem.com', address: 'الشرقية - بلبيس - طريق القاهرة الإسماعيلية الصحراوي' },
  { name: 'شركة يونيون إير جروب للتكييف والأجهزة المنزلية', domain: 'unionaire.com', address: 'الجيزة - مدينة 6 أكتوبر - المنطقة الصناعية الأولى' },
  { name: 'شركة ميراكو كاريير مصر للتكييف والتبريد', domain: 'miraco.com.eg', address: 'الجيزة - أبو رواش - الكيلو 28 طريق مصر إسكندرية الصحراوي' },
  { name: 'شركة كريازي لصناعة الأجهزة الكهربائية', domain: 'kiriazi.com', address: 'القليوبية - مدينة العبور - المنطقة الصناعية الأولى' },
  { name: 'شركة باكين للبويات والصناعات الكيماوية', domain: 'pachin.net', address: 'القاهرة - حدائق القبة - شارع المصانع' },
  { name: 'شركة جوتن مصر للدهانات والكيماويات', domain: 'jotun.com.eg', address: 'الشرقية - مدينة العاشر من رمضان - المنطقة الصناعية A1' },
  { name: 'شركة سايبس للدهانات والكيماويات الحديثة', domain: 'sipes.com.eg', address: 'القليوبية - مدينة العبور - المنطقة الصناعية ب' },
  { name: 'شركة كابسي للدهانات والأحبار الصناعية', domain: 'kapci.com', address: 'بورسعيد - المنطقة الصناعية جنوب بورسعيد' },
  { name: 'شركة جي إل سي (GLC) للدهانات والصناعات الكيماوية', domain: 'glcpaints.com', address: 'القليوبية - مدينة العبور - المنطقة الصناعية الأولى' },
  { name: 'شركة سيكا مصر لكيماويات ومواد البناء', domain: 'sika.com.eg', address: 'القليوبية - مدينة العبور - المنطقة الصناعية الأولى' },
  { name: 'شركة سيدي كرير للبتروكيماويات (سيدبك)', domain: 'sidpec.com', address: 'الإسكندرية - العامرية - طريق النهضة' },
  { name: 'شركة أبوقير للأسمدة والصناعات الكيماوية', domain: 'abuqir.com', address: 'الإسكندرية - أبو قير - خط رشيد' },
  { name: 'شركة موبكو لإنتاج الأسمدة والكيماويات', domain: 'mopco-eg.com', address: 'دمياط - المنطقة الحرة العامة بميناء دمياط' },
  { name: 'شركة كيما للصناعات الكيماوية بأسوان', domain: 'kima-egypt.com', address: 'أسوان - طريق السد العالي شرق' },
  { name: 'شركة المالية والصناعية المصرية للأسمدة', domain: 'efic.com.eg', address: 'الغربية - كفر الزيات - شارع الجيش' },
  { name: 'شركة ليسيكو مصر للأدوات الصحية والسيراميك', domain: 'lecico.com', address: 'الإسكندرية - خورشيد - طريق القاهرة الإسكندرية الزراعي' },
  { name: 'شركة سيراميكا الجوهرة للصناعة والتجارة', domain: 'gemma.com.eg', address: 'المنوفية - مدينة السادات - المنطقة الصناعية الثانية' },
  { name: 'شركة سيراميكا رويال للتجارة والتصدير', domain: 'royalceramica.com', address: 'القليوبية - مدينة العبور - المنطقة الصناعية الأولى' },
  { name: 'شركة ديورافيت مصر للأدوات الصحية', domain: 'duravit.com.eg', address: 'الشرقية - مدينة العاشر من رمضان - المنطقة الصناعية A3' },
  { name: 'شركة إيديال ستاندرد مصر للتوريدات الصحية', domain: 'idealstandard.com.eg', address: 'الشرقية - مدينة العاشر من رمضان - المنطقة الصناعية الثانية' },
  { name: 'شركة الشريف للبلاستيك والصناعات الهندسية', domain: 'elsherif-plastics.com', address: 'الشرقية - مدينة العاشر من رمضان - المنطقة الصناعية الثالثة' },
  { name: 'شركة الأهرام لنظم الأمان والكوالين', domain: 'ahramsecurity.com', address: 'الشرقية - مدينة العاشر من رمضان - المنطقة الصناعية الأولى' },
  { name: 'شركة كريستال عصفور للصناعات والتجارة', domain: 'asfourcrystal.com', address: 'القليوبية - شبرا الخيمة - طريق بيجام' },
  { name: 'شركة ماجد الفطيم هايبر ماركتس مصر (كارفور)', domain: 'carrefouregypt.com', address: 'القاهرة - المعادي - الطريق الدائري' },
  { name: 'شركة هايبر وان للتجارة والتوريدات الغذائية', domain: 'hyperone.com.eg', address: 'الجيزة - الشيخ زايد - مدخل مدينة 6 أكتوبر' },
  { name: 'شركة مترو ماركت للتجارة والتوزيع', domain: 'metro-markets.com', address: 'القاهرة - مدينة نصر - حي السفارات' },
  { name: 'شركة كازيون ماركت للتجارة والتوزيع', domain: 'kazyon.com', address: 'القاهرة - التجمع الخامس - القطاع الأول' },
  { name: 'شركة فتح الله جملة ماركت للتجارة والتوزيع', domain: 'fathalla-gomla.com', address: 'الإسكندرية - سموحة - طريق 14 مايو' },
  { name: 'شركة زهران ماركت للتجارة والتوريدات', domain: 'zahranmarket.com', address: 'الإسكندرية - سيدي جابر - شارع المشير أحمد إسماعيل' },
  { name: 'شركة سعودي ماركت للتجارة والتوزيع', domain: 'seoudi.com', address: 'الجيزة - المهندسين - شارع شهاب' },
  { name: 'شركة سبينيس مصر لتجارة التجزئة والجملة', domain: 'spinneys-egypt.com', address: 'القاهرة - مصر الجديدة - سيتي ستارز' },
  { name: 'شركة المحمل للتجارة والتوريدات الغذائية', domain: 'elmahmal.com', address: 'القاهرة - مدينة نصر - شارع مكرم عبيد' },
  { name: 'شركة الفرجاني للتجارة وتوزيع السلع', domain: 'elfergany.com', address: 'القاهرة - الزيتون - شارع طومان باي' },
  { name: 'شركة الراية ماركت للتجارة والتوريدات', domain: 'elrayamarket.com', address: 'الجيزة - الهرم - شارع العشرين' },
  { name: 'شركة بيم مصر لتجارة التجزئة والجملة', domain: 'bim.com.eg', address: 'القاهرة - مدينة بدر - المنطقة الصناعية' },
  { name: 'شركة بتروجيت للمشروعات الهندسية والبترولية', domain: 'petrojet.com.eg', address: 'القاهرة - التجمع الخامس - شارع التسعين الشمالي' },
  { name: 'شركة إنبي للاستشارات والتوريدات الهندسية', domain: 'enppi.com', address: 'القاهرة - مدينة نصر - شارع عباس العقاد' },
  { name: 'شركة طاقة عربية لتوزيع الغاز والطاقة', domain: 'taqa.com.eg', address: 'القاهرة - التجمع الخامس - القطاع الثاني' },
  { name: 'شركة إيجيترانس للنقل الدولي واللوجستيات', domain: 'egytrans.com', address: 'الإسكندرية - وابور المياه - شارع حسن أمين' },
  { name: 'شركة أرامكس مصر للشحن والخدمات اللوجستية', domain: 'aramex.com.eg', address: 'القاهرة - مطار القاهرة الدولي - قرية البضائع' },
  { name: 'شركة قناة السويس للحاويات والشحن البحري', domain: 'scct.com.eg', address: 'بورسعيد - شرق بورسعيد - المنطقة اللوجستية' },
  { name: 'مجموعة طلعت مصطفى للتوريدات العقارية', domain: 'talaatmoustafa.com', address: 'الجيزة - الدقي - شارع مصدق' },
  { name: 'شركة بالم هيلز للتعمير والمشروعات', domain: 'palmhillsdevelopments.com', address: 'الجيزة - الشيخ زايد - القرية الذكية' },
  { name: 'شركة سوديك للتطوير والاستثمار العقاري', domain: 'sodic.com', address: 'الجيزة - الشيخ زايد - الكيلو 38 طريق مصر إسكندرية' },
  { name: 'شركة مدينة مصر للإسكان والتعمير', domain: 'madinetmasr.com', address: 'القاهرة - مدينة نصر - شارع يوسف عباس' },
  { name: 'شركة مصر الجديدة للإسكان والتوريدات', domain: 'heliopoliscompany.com', address: 'القاهرة - مصر الجديدة - شارع إبراهيم اللقاني' },
  { name: 'شركة المعادي للتنمية والتعمير', domain: 'maadidev.com.eg', address: 'القاهرة - المعادي - شارع الشريفي' },
  { name: 'شركة إعمار مصر للمقاولات والتوريدات', domain: 'emaarmisr.com', address: 'القاهرة - المقطم - أب تاون كايرو' },
  { name: 'شركة الفطيم مصر للتجارة والتوريدات العقارية', domain: 'alfuttaim.com.eg', address: 'القاهرة - التجمع الخامس - كايرو فيستيفال سيتي' },
  { name: 'شركة عز العرب للسيارات والتوكيلات التجارية', domain: 'ezzelarab.com', address: 'الجيزة - أبو رواش - الكيلو 28 طريق مصر إسكندرية' },
  { name: 'شركة أبو غالي موتورز للتجارة والنقل', domain: 'aboughalymotors.com', address: 'القاهرة - طريق مصر الإسماعيلية الصحراوي - الكيلو 28' },
  { name: 'شركة المصرية التجارية وأوتوموتيف', domain: 'eatc-eg.com', address: 'القليوبية - مدينة العبور - المنطقة الصناعية' },
  { name: 'شركة دايس للملابس الجاهزة والتصدير', domain: 'dice.com.eg', address: 'القاهرة - جسر السويس - المنطقة الصناعية' },
  { name: 'شركة قطونيل مصر للملابس والمنسوجات', domain: 'cottonil.com', address: 'القاهرة - جسر السويس - شارع جمال عبد الناصر' },
  { name: 'شركة عرفة جروب للملابس الجاهزة والنسيج', domain: 'arafaholding.com', address: 'الشرقية - مدينة العاشر من رمضان - المنطقة الصناعية الثالثة' },
  { name: 'شركة مصر للغزل والنسيج بالمحلة الكبرى', domain: 'misrspinning.com', address: 'الغربية - المحلة الكبرى - شارع طلعت حرب' },
  { name: 'شركة آمون للأدوية والمستحضرات الطبية', domain: 'amoun.com', address: 'القليوبية - مدينة العبور - المنطقة الصناعية الأولى' },
  { name: 'شركة المهن الطبية للأدوية (MUP)', domain: 'mup-eg.com', address: 'الإسماعيلية - أبو سلطان - المنطقة الصناعية' },
  { name: 'شركة سيديكو للأدوية والصناعات الدوائية', domain: 'sedico.net', address: 'الجيزة - مدينة 6 أكتوبر - المنطقة الصناعية الأولى' },
  { name: 'شركة القاهرة للأدوية والصناعات الكيماوية', domain: 'cairopharma.com', address: 'القاهرة - شبرا - ميدان فيكتوريا' }
];

const EGYPTIAN_COMPANY_PREFIXES = [
  'النيل', 'الأهرام', 'الدلتا', 'الفرعونية', 'الكنانة', 'الصفوة', 'المستقبل', 'الرواد', 'الهدى', 'الرحاب',
  'اليسر', 'الفتح', 'النور', 'البركة', 'التوحيد', 'الأمل', 'المصرية الأوروبية', 'المصرية الألمانية', 'المصرية الإيطالية', 'المصرية الدولية',
  'المصرية العربية', 'المصرية الحديثة', 'المتحدة', 'العالمية', 'الدولية', 'الوطنية', 'الجمهورية', 'وادي النيل', 'سيناء', 'قناة السويس',
  'المعمار', 'التعمير', 'النخبة', 'القمة', 'الإخلاص', 'المروة', 'الصفا', 'الفرسان', 'الأندلس', 'الجزيرة',
  'الشروق', 'التجمع', 'العاشر', 'أكتوبر', 'العبور', 'السادات', 'بدر', 'العامرية', 'برج العرب', 'حورس',
  'إيزيس', 'طيبة', 'منف', 'مصر الخير', 'مصر النور', 'المشرق', 'المحروسة', 'الفيروز', 'الماسة', 'الجوهرة',
  'التاج', 'النسر', 'الصقر', 'البنيان', 'الركائز', 'التميز', 'الإبداع', 'الاتحاد', 'التضامن', 'التكامل',
  'الشمس', 'الفجر', 'الأفق', 'المنار', 'الريادة', 'الإنجاز', 'الوفاء', 'الأمانة', 'الضياء', 'السلام'
];

const EGYPTIAN_BUSINESS_ACTIVITIES = [
  'للتجارة والتوريدات العمومية',
  'للاستيراد والتصدير والتوكيلات التجارية',
  'للمقاولات المتكاملة والتوريدات الهندسية',
  'للصناعات الغذائية والتعبئة والتغليف',
  'لتجارة وتوزيع المواد الغذائية',
  'للصناعات البلاستيكية والكيماوية',
  'لتجارة الحديد ومواد البناء',
  'للأنظمة الكهربائية والكابلات',
  'للتوريدات الطبية والمستلزمات',
  'للصناعات المعدنية وتشكيل المعادن',
  'لتجارة الأخشاب والأثاث المكتبي',
  'للغزل والنسيج والملابس الجاهزة',
  'لتجارة قطع غيار السيارات والمعدات',
  'للشحن الدولي والخدمات اللوجستية',
  'لتكنولوجيا المعلومات والأنظمة الذكية',
  'للتبريد والتكييف والأنظمة الكهروميكانيكية',
  'للرخام والجرانيت ومواد التشطيب',
  'للورق والطباعة ومواد التغليف',
  'للتنمية الزراعية وتجارة الأعلاف',
  'للأدوات الصحية ومهمات السباكة'
];

const EGYPTIAN_LEGAL_SUFFIXES = ['(ش.م.م)', '(ذ.م.م)', ''];

const EGYPTIAN_ADDRESSES = [
  'القاهرة - مدينة نصر - شارع عباس العقاد',
  'القاهرة - مدينة نصر - شارع مكرم عبيد',
  'القاهرة - مدينة نصر - المنطقة الصناعية بالحي السادس',
  'القاهرة - مصر الجديدة - شارع الثورة',
  'القاهرة - مصر الجديدة - شارع الحجاز',
  'القاهرة - مصر الجديدة - ميدان تريومف',
  'القاهرة - التجمع الخامس - شارع التسعين الشمالي',
  'القاهرة - التجمع الخامس - شارع التسعين الجنوبي',
  'القاهرة - التجمع الثالث - المنطقة الصناعية بالقاهرة الجديدة',
  'القاهرة - المعادي - كورنيش النيل',
  'القاهرة - المعادي - الأوتوستراد - منطقة شق الثعبان الصناعية',
  'القاهرة - وسط البلد - شارع طلعت حرب',
  'القاهرة - وسط البلد - شارع قصر النيل',
  'القاهرة - شبرا - شارع خلوصي',
  'القاهرة - جسر السويس - المنطقة الصناعية بقباء',
  'القاهرة - مدينة بدر - المنطقة الصناعية الشرقية',
  'الجيزة - المهندسين - شارع جامعة الدول العربية',
  'الجيزة - المهندسين - شارع البطل أحمد عبد العزيز',
  'الجيزة - الدقي - شارع مصدق',
  'الجيزة - الدقي - شارع التحرير',
  'الجيزة - الهرم - شارع الملك فيصل',
  'الجيزة - مدينة 6 أكتوبر - المنطقة الصناعية الأولى',
  'الجيزة - مدينة 6 أكتوبر - المنطقة الصناعية الثالثة',
  'الجيزة - مدينة 6 أكتوبر - المنطقة الصناعية السادسة',
  'الجيزة - الشيخ زايد - المحور المركزي التجاري',
  'الجيزة - أبو رواش - المنطقة الصناعية واللوجستية',
  'الشرقية - مدينة العاشر من رمضان - المنطقة الصناعية A1',
  'الشرقية - مدينة العاشر من رمضان - المنطقة الصناعية B2',
  'الشرقية - مدينة العاشر من رمضان - المنطقة الصناعية الثالثة',
  'الشرقية - الزقازيق - شارع الجلاء',
  'القليوبية - مدينة العبور - المنطقة الصناعية الأولى',
  'القليوبية - مدينة العبور - المنطقة الصناعية ب و ج',
  'القليوبية - شبرا الخيمة - المنطقة الصناعية ببيجام',
  'القليوبية - بنها - شارع فريد ندا',
  'الإسكندرية - سموحة - شارع فوزي معاذ',
  'الإسكندرية - سيدي جابر - طريق الحرية',
  'الإسكندرية - برج العرب الجديدة - المنطقة الصناعية الثانية',
  'الإسكندرية - برج العرب الجديدة - المنطقة الصناعية الرابعة',
  'الإسكندرية - العامرية - طريق الإسكندرية الصحراوي',
  'الإسكندرية - المنشية - شارع صلاح سالم',
  'المنوفية - مدينة السادات - المنطقة الصناعية الرابعة',
  'المنوفية - مدينة السادات - المنطقة الصناعية السابعة',
  'المنوفية - شبين الكوم - شارع الجلاء البحري',
  'الغربية - طنطا - شارع البحر',
  'الغربية - المحلة الكبرى - المنطقة الصناعية',
  'الدقهلية - المنصورة - شارع الجمهورية',
  'الدقهلية - المنطقة الصناعية بجمصة',
  'دمياط - دمياط الجديدة - المنطقة الصناعية',
  'بورسعيد - المنطقة الحرة العامة للاستثمار',
  'بورسعيد - المنطقة الصناعية جنوب بورسعيد',
  'السويس - العين السخنة - المنطقة الاقتصادية لقناة السويس',
  'الإسماعيلية - المنطقة الصناعية بالقنطرة شرق',
  'البحيرة - دمنهور - شارع عبد السلام الشاذلي',
  'الفيوم - منطقة كوم أوشيم الصناعية',
  'بني سويف - منطقة بياض العرب الصناعية',
  'المنيا - المنيا الجديدة - المنطقة الصناعية',
  'أسيوط - منطقة عرب العوامر الصناعية بأبنوب',
  'سوهاج - منطقة الكوثر الصناعية',
  'قنا - منطقة هو الصناعية بنجع حمادي',
  'أسوان - المنطقة الصناعية بالعلاقي'
];

const MOBILE_PREFIXES = ['010', '011', '012', '015'];
const OPENING_BALANCES = [
  15000, 22500, 35000, 48000, 62500, 75000, 89000, 110000, 135000, 160000,
  185000, 210000, 250000, 320000, 450000, 0, 18500, 42000, 95000, 145000
];
const CREDIT_LIMITS = [
  100000, 150000, 200000, 250000, 300000, 500000, 750000, 1000000, 1500000, 2000000
];
const PAYMENT_DAYS = [15, 30, 45, 60, 90];

export function generateEgyptianCustomersObjects(
  count: number = 500,
  custAccCode: string = '110201',
  capAccCode: string = '3104',
  startIndex: number = 1
): EgyptianCustomerSampleRow[] {
  const rows: EgyptianCustomerSampleRow[] = [];
  const usedNames = new Set<string>();

  for (let i = 0; i < count; i++) {
    const seq = startIndex + i;
    const code = `CUST-${String(seq).padStart(5, '0')}`;
    const manual_code = String(10000 + seq);

    let name = '';
    let email = '';
    let address = '';

    if (i < FAMOUS_EGYPTIAN_COMPANIES.length) {
      const famous = FAMOUS_EGYPTIAN_COMPANIES[i];
      name = famous.name;
      email = `info@${famous.domain}`;
      address = famous.address;
      usedNames.add(name);
    } else {
      const idx = i - FAMOUS_EGYPTIAN_COMPANIES.length;
      const prefix = EGYPTIAN_COMPANY_PREFIXES[idx % EGYPTIAN_COMPANY_PREFIXES.length];
      const activity = EGYPTIAN_COMPANY_ACTIVITIES_HELPER(idx);
      const suffix = EGYPTIAN_LEGAL_SUFFIXES[idx % EGYPTIAN_LEGAL_SUFFIXES.length];
      let candidate = `شركة ${prefix} ${activity}${suffix ? ' ' + suffix : ''}`;
      if (usedNames.has(candidate)) {
        candidate = `شركة ${prefix} ${activity} - فرع ${((idx % 12) + 1)}${suffix ? ' ' + suffix : ''}`;
      }
      usedNames.add(candidate);
      name = candidate;
      email = `sales.eg${seq}@el-${ makeSlug(prefix, seq) }.com.eg`;
      address = EGYPTIAN_ADDRESSES[i % EGYPTIAN_ADDRESSES.length];
    }

    // Deterministic valid 11-digit Egyptian mobile number starting with 010/011/012/015
    const mobPrefix = MOBILE_PREFIXES[i % MOBILE_PREFIXES.length];
    const mobBody = String(10000000 + ((i * 73856 + 192837) % 89999999)).padStart(8, '0').slice(0, 8);
    const mobile = `${mobPrefix}${mobBody}`;

    // Deterministic valid 9-digit Egyptian Tax Number
    const taxNum = String(100000000 + ((i * 1548586 + 20458123) % 799999999)).slice(0, 9);

    const opening_balance = OPENING_BALANCES[i % OPENING_BALANCES.length];
    const credit_limit = CREDIT_LIMITS[i % CREDIT_LIMITS.length];
    const isCash = i % 10 === 9; // 90% credit, 10% cash
    const payment_terms: 'credit' | 'cash' = isCash ? 'cash' : 'credit';
    const payment_terms_days = isCash ? 0 : PAYMENT_DAYS[i % PAYMENT_DAYS.length];
    const advance_percentage = isCash ? 0 : (i % 7 === 0 ? 10 : i % 11 === 0 ? 25 : 0);

    rows.push({
      code,
      manual_code,
      name,
      mobile,
      email,
      address,
      tax_number: taxNum,
      account_code: custAccCode,
      counter_account_code: capAccCode,
      opening_balance,
      opening_balance_date: '2026-01-01',
      credit_limit,
      payment_terms,
      payment_terms_days,
      advance_percentage
    });
  }

  return rows;
}

function EGYPTIAN_COMPANY_ACTIVITIES_HELPER(idx: number): string {
  const pIdx = Math.floor(idx / EGYPTIAN_COMPANY_PREFIXES.length);
  return EGYPTIAN_BUSINESS_ACTIVITIES[(idx + pIdx * 3) % EGYPTIAN_BUSINESS_ACTIVITIES.length];
}

function makeSlug(prefix: string, seq: number): string {
  const map: Record<string, string> = {
    'النيل': 'nile',
    'الأهرام': 'ahram',
    'الدلتا': 'delta',
    'الفرعونية': 'pharaonic',
    'الكنانة': 'kenana',
    'الصفوة': 'safwa',
    'المستقبل': 'mostakbal',
    'الرواد': 'rowad',
    'الهدى': 'hoda',
    'الرحاب': 'rehab',
    'اليسر': 'yosr',
    'الفتح': 'fath',
    'النور': 'nour',
    'البركة': 'baraka',
    'التوحيد': 'tawheed',
    'الأمل': 'amal',
    'المتحدة': 'united',
    'العالمية': 'global',
    'الدولية': 'intl',
    'الوطنية': 'watania',
    'الجمهورية': 'gomhouria',
    'سيناء': 'sinai',
    'المعمار': 'meamar',
    'التعمير': 'taameer',
    'النخبة': 'nokhba',
    'القمة': 'qemma',
    'الإخلاص': 'ekhlas',
    'المروة': 'marwa',
    'الصفا': 'safa',
    'الفرسان': 'forsan',
    'الأندلس': 'andalus',
    'الجزيرة': 'gezira',
    'الشروق': 'shorouk',
    'التجمع': 'tagamoa',
    'العاشر': 'ramadan10',
    'أكتوبر': 'october6',
    'العبور': 'obour',
    'السادات': 'sadat',
    'بدر': 'badr'
  };
  return map[prefix] || `egyptco${seq}`;
}

export function generateEgyptianCustomersAoA(
  count: number = 500,
  custAccCode: string = '110201',
  capAccCode: string = '3104',
  startIndex: number = 1
): any[][] {
  return generateEgyptianCustomersObjects(count, custAccCode, capAccCode, startIndex).map(r => [
    r.code,
    r.manual_code,
    r.name,
    r.mobile,
    r.email,
    r.address,
    r.tax_number,
    r.account_code,
    r.counter_account_code,
    r.opening_balance,
    r.opening_balance_date,
    r.credit_limit,
    r.payment_terms,
    r.payment_terms_days,
    r.advance_percentage
  ]);
}

