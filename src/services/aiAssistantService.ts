import { GoogleGenAI, Type, FunctionDeclaration, GenerateContentResponse } from "@google/genai";
import { dbService } from "./dbService";
import { User } from "../types";

const getAI = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("GEMINI_API_KEY is missing from process.env in aiAssistantService");
    throw new Error("Gemini API Key is missing");
  }
  return new GoogleGenAI({ apiKey });
};

const tools: FunctionDeclaration[] = [
  {
    name: "addCustomer",
    description: "إضافة عميل جديد إلى النظام",
    parameters: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING, description: "اسم العميل" },
        mobile: { type: Type.STRING, description: "رقم الموبايل" },
        email: { type: Type.STRING, description: "البريد الإلكتروني" },
        address: { type: Type.STRING, description: "العنوان" },
        opening_balance: { type: Type.NUMBER, description: "الرصيد الافتتاحي" },
        opening_balance_date: { type: Type.STRING, description: "تاريخ الرصيد الافتتاحي (YYYY-MM-DD)" },
      },
      required: ["name"],
    },
  },
  {
    name: "addSupplier",
    description: "إضافة مورد جديد إلى النظام",
    parameters: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING, description: "اسم المورد" },
        mobile: { type: Type.STRING, description: "رقم الموبايل" },
        email: { type: Type.STRING, description: "البريد الإلكتروني" },
        address: { type: Type.STRING, description: "العنوان" },
        opening_balance: { type: Type.NUMBER, description: "الرصيد الافتتاحي" },
        opening_balance_date: { type: Type.STRING, description: "تاريخ الرصيد الافتتاحي (YYYY-MM-DD)" },
      },
      required: ["name"],
    },
  },
  {
    name: "addProduct",
    description: "إضافة صنف (منتج) جديد إلى النظام",
    parameters: {
      type: Type.OBJECT,
      properties: {
        code: { type: Type.STRING, description: "كود الصنف" },
        name: { type: Type.STRING, description: "اسم الصنف" },
        sale_price: { type: Type.NUMBER, description: "سعر البيع" },
        cost_price: { type: Type.NUMBER, description: "سعر التكلفة" },
        description: { type: Type.STRING, description: "وصف الصنف" },
      },
      required: ["code", "name", "sale_price", "cost_price"],
    },
  },
  {
    name: "addExpenseCategory",
    description: "إضافة بند مصروف جديد",
    parameters: {
      type: Type.OBJECT,
      properties: {
        code: { type: Type.STRING, description: "كود البند" },
        name: { type: Type.STRING, description: "اسم البند" },
        description: { type: Type.STRING, description: "وصف البند" },
      },
      required: ["code", "name"],
    },
  },
  {
    name: "addPaymentMethod",
    description: "إضافة طريقة سداد جديدة (خزينة، بنك، إلخ)",
    parameters: {
      type: Type.OBJECT,
      properties: {
        code: { type: Type.STRING, description: "كود الطريقة" },
        name: { type: Type.STRING, description: "اسم الطريقة" },
        opening_balance: { type: Type.NUMBER, description: "الرصيد الافتتاحي" },
        opening_balance_date: { type: Type.STRING, description: "تاريخ الرصيد الافتتاحي (YYYY-MM-DD)" },
      },
      required: ["code", "name"],
    },
  },
  {
    name: "getCustomers",
    description: "الحصول على قائمة العملاء للبحث عن IDs",
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: "getSuppliers",
    description: "الحصول على قائمة الموردين للبحث عن IDs",
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: "getProducts",
    description: "الحصول على قائمة الأصناف للبحث عن IDs",
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: "getPaymentMethods",
    description: "الحصول على قائمة طرق السداد للبحث عن IDs",
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: "getInvoices",
    description: "الحصول على قائمة فواتير المبيعات",
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: "getPurchaseInvoices",
    description: "الحصول على قائمة فواتير المشتريات",
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: "getReturns",
    description: "الحصول على قائمة مرتجعات المبيعات",
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: "getPurchaseReturns",
    description: "الحصول على قائمة مرتجعات المشتريات",
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: "getCustomerDiscounts",
    description: "الحصول على قائمة خصومات العملاء",
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: "getSupplierDiscounts",
    description: "الحصول على قائمة خصومات الموردين",
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: "createReturn",
    description: "إنشاء مرتجع مبيعات جديد من عميل",
    parameters: {
      type: Type.OBJECT,
      properties: {
        customer_id: { type: Type.STRING, description: "ID العميل" },
        date: { type: Type.STRING, description: "التاريخ (YYYY-MM-DD)" },
        items: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              product_id: { type: Type.STRING, description: "ID الصنف" },
              quantity: { type: Type.NUMBER, description: "الكمية" },
              price: { type: Type.NUMBER, description: "السعر" },
              total: { type: Type.NUMBER, description: "الإجمالي" },
            },
            required: ["product_id", "quantity", "price", "total"],
          },
        },
      },
      required: ["customer_id", "date", "items"],
    },
  },
  {
    name: "createPurchaseReturn",
    description: "إنشاء مرتجع مشتريات جديد لمورد",
    parameters: {
      type: Type.OBJECT,
      properties: {
        supplier_id: { type: Type.STRING, description: "ID المورد" },
        date: { type: Type.STRING, description: "التاريخ (YYYY-MM-DD)" },
        payment_method_id: { type: Type.STRING, description: "ID طريقة السداد (لاسترداد المبلغ)" },
        items: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              product_id: { type: Type.STRING, description: "ID الصنف" },
              quantity: { type: Type.NUMBER, description: "الكمية" },
              cost_price: { type: Type.NUMBER, description: "سعر التكلفة" },
            },
            required: ["product_id", "quantity", "cost_price"],
          },
        },
        notes: { type: Type.STRING, description: "ملاحظات" },
      },
      required: ["supplier_id", "date", "payment_method_id", "items"],
    },
  },
  {
    name: "createCustomerDiscount",
    description: "إضافة خصم لعميل",
    parameters: {
      type: Type.OBJECT,
      properties: {
        customer_id: { type: Type.STRING, description: "ID العميل" },
        amount: { type: Type.NUMBER, description: "قيمة الخصم" },
        date: { type: Type.STRING, description: "التاريخ (YYYY-MM-DD)" },
        payment_method_id: { type: Type.STRING, description: "ID طريقة السداد (اختياري)" },
        notes: { type: Type.STRING, description: "ملاحظات" },
      },
      required: ["customer_id", "amount", "date"],
    },
  },
  {
    name: "createSupplierDiscount",
    description: "إضافة خصم من مورد",
    parameters: {
      type: Type.OBJECT,
      properties: {
        supplier_id: { type: Type.STRING, description: "ID المورد" },
        amount: { type: Type.NUMBER, description: "قيمة الخصم" },
        date: { type: Type.STRING, description: "التاريخ (YYYY-MM-DD)" },
        payment_method_id: { type: Type.STRING, description: "ID طريقة السداد (اختياري)" },
        notes: { type: Type.STRING, description: "ملاحظات" },
      },
      required: ["supplier_id", "amount", "date"],
    },
  },
];

export async function processAIRequest(prompt: string, user: User): Promise<{ text: string, operationPerformed: boolean }> {
  const ai = getAI();
  const model = "gemini-1.5-flash";
  let operationPerformed = false;

  const systemInstruction = `أنت مساعد ذكي لنظام محاسبي متكامل. يمكنك مساعدة المستخدم في تنفيذ كافة العمليات المحاسبية وإدارة البيانات الأساسية.
      العمليات المتاحة:
      1. إدارة البيانات الأساسية: إضافة (عملاء، موردين، أصناف، بنود مصروفات، طرق سداد).
      2. المبيعات: إنشاء فواتير مبيعات، سندات قبض، مرتجعات مبيعات، وخصومات عملاء.
      3. المشتريات: إنشاء فواتير مشتريات، سندات صرف، مرتجعات مشتريات، وخصومات موردين.
      4. التقارير والاستعلامات: يمكنك البحث عن البيانات وعرض القوائم.
      5. التنقل بين الصفحات: يمكنك توجيه المستخدم لصفحات معينة.
      
      قواعد هامة:
      - إذا طلب المستخدم تنفيذ عملية، استخدم الأدوات المتاحة.
      - إذا كنت بحاجة لـ ID (لعميل، مورد، صنف، إلخ)، استخدم أدوات الـ get المناسبة أولاً للبحث عن الـ ID بالاسم.
      - إذا لم تجد الاسم في القائمة، اطلب من المستخدم توضيح أو اقترح إضافة البيانات الأساسية أولاً.
      - تحدث باللغة العربية بلهجة مهنية وودودة.
      - تأكد من صحة البيانات قبل إرسالها.
      - عندما يطلب المستخدم الذهاب لصفحة معينة أو تنفيذ عملية في صفحة معينة، أضف الكود التالي في نهاية ردك: [NAVIGATE:page_name]
      
      أسماء الصفحات المتاحة (page_name):
      - dashboard (الرئيسية)
      - customers (العملاء)
      - suppliers (الموردين)
      - products (الأصناف)
      - expenses (المصروفات)
      - payment_methods (طرق السداد)
      - invoices (فواتير المبيعات)
      - purchase_invoices (فواتير المشتريات)
      - receipts (سندات القبض)
      - payment_vouchers (سندات الصرف)
      - returns (مرتجع المبيعات)
      - purchase_returns (مرتجع المشتريات)
      - customer_discounts (خصم العملاء)
      - supplier_discounts (خصم الموردين)
      - customer_statement (كشف حساب عميل)
      - supplier_statement (كشف حساب مورد)
      - customer_balances (أرصدة العملاء)
      - supplier_balances (أرصدة الموردين)
      - sales_report (تقرير المبيعات)
      - expenses_report (تقرير المصروفات)
      - cash_report (تقرير الخزينة والبنك)
      - activity_log (سجل الأنشطة)
      - users (المستخدمين)
      - settings (الإعدادات)
      
      مثال: "حاضر، سأنتقل بك إلى صفحة العملاء. [NAVIGATE:customers]"`;

  const contents: any[] = [
    { role: 'user', parts: [{ text: prompt }] }
  ];

  let response: GenerateContentResponse = await ai.models.generateContent({
    model,
    contents,
    config: {
      systemInstruction,
      tools: [{ functionDeclarations: tools }],
    },
  });
  
  // Handle function calls
  while (response.functionCalls) {
    // Add model's turn to history
    contents.push({ role: 'model', parts: response.candidates[0].content.parts });

    const functionResponses = [];
    for (const call of response.functionCalls) {
      const { name, args: callArgs } = call;
      const args = callArgs as any;
      let result;

      try {
        switch (name) {
          case "addCustomer":
            result = await dbService.add("customers", { ...args, company_id: user.company_id });
            await dbService.logActivity(user.id, user.username, user.company_id, 'إضافة عميل', `إضافة عميل: ${args.name} عبر المساعد الذكي`);
            operationPerformed = true;
            break;
          case "addSupplier":
            result = await dbService.add("suppliers", { ...args, company_id: user.company_id });
            await dbService.logActivity(user.id, user.username, user.company_id, 'إضافة مورد', `إضافة مورد: ${args.name} عبر المساعد الذكي`);
            operationPerformed = true;
            break;
          case "addProduct":
            result = await dbService.add("products", { ...args, company_id: user.company_id });
            await dbService.logActivity(user.id, user.username, user.company_id, 'إضافة صنف', `إضافة صنف: ${args.name} عبر المساعد الذكي`);
            operationPerformed = true;
            break;
          case "addExpenseCategory":
            result = await dbService.add("expense_categories", { ...args, company_id: user.company_id });
            await dbService.logActivity(user.id, user.username, user.company_id, 'إضافة بند مصروف', `إضافة بند مصروف: ${args.name} عبر المساعد الذكي`);
            operationPerformed = true;
            break;
          case "addPaymentMethod":
            result = await dbService.add("payment_methods", { ...args, company_id: user.company_id });
            await dbService.logActivity(user.id, user.username, user.company_id, 'إضافة طريقة سداد', `إضافة طريقة سداد: ${args.name} عبر المساعد الذكي`);
            operationPerformed = true;
            break;
          case "getCustomers":
            result = await dbService.list("customers", user.company_id);
            break;
          case "getSuppliers":
            result = await dbService.list("suppliers", user.company_id);
            break;
          case "getProducts":
            result = await dbService.list("products", user.company_id);
            break;
          case "getPaymentMethods":
            result = await dbService.list("payment_methods", user.company_id);
            break;
          case "getExpenseCategories":
            result = await dbService.list("expense_categories", user.company_id);
            break;
          case "getInvoices":
            result = await dbService.list("invoices", user.company_id);
            break;
          case "getPurchaseInvoices":
            result = await dbService.list("purchase_invoices", user.company_id);
            break;
          case "getReturns":
            result = await dbService.list("returns", user.company_id);
            break;
          case "getPurchaseReturns":
            result = await dbService.list("purchase_returns", user.company_id);
            break;
          case "getCustomerDiscounts":
            result = await dbService.list("customer_discounts", user.company_id);
            break;
          case "getSupplierDiscounts":
            result = await dbService.list("supplier_discounts", user.company_id);
            break;
          case "createInvoice":
            const invNum = `INV-${Date.now().toString().slice(-6)}`;
            result = await dbService.add("invoices", { ...args, invoice_number: invNum, company_id: user.company_id });
            await dbService.logActivity(user.id, user.username, user.company_id, 'إضافة فاتورة مبيعات', `إضافة فاتورة مبيعات رقم: ${invNum} عبر المساعد الذكي`);
            operationPerformed = true;
            break;
          case "createReceipt":
            const recNum = `REC-${Date.now().toString().slice(-6)}`;
            result = await dbService.add("receipt_vouchers", { ...args, receipt_number: recNum, company_id: user.company_id });
            await dbService.logActivity(user.id, user.username, user.company_id, 'إضافة سند قبض', `إضافة سند قبض رقم: ${recNum} عبر المساعد الذكي`);
            operationPerformed = true;
            break;
          case "createPurchaseInvoice":
            const purInvNum = `PINV-${Date.now().toString().slice(-6)}`;
            result = await dbService.add("purchase_invoices", { ...args, invoice_number: purInvNum, company_id: user.company_id });
            await dbService.logActivity(user.id, user.username, user.company_id, 'إضافة فاتورة مشتريات', `إضافة فاتورة مشتريات رقم: ${purInvNum} عبر المساعد الذكي`);
            operationPerformed = true;
            break;
          case "createPaymentVoucher":
            const vouNum = `VOU-${Date.now().toString().slice(-6)}`;
            result = await dbService.add("payment_vouchers", { ...args, voucher_number: vouNum, company_id: user.company_id });
            await dbService.logActivity(user.id, user.username, user.company_id, 'إضافة سند صرف', `إضافة سند صرف رقم: ${vouNum} عبر المساعد الذكي`);
            operationPerformed = true;
            break;
          case "createReturn":
            const retNum = `RET-${Date.now().toString().slice(-6)}`;
            const customer = (await dbService.list("customers", user.company_id) as any[]).find((c: any) => c.id === args.customer_id);
            const total_amount = args.items.reduce((sum: number, item: any) => sum + item.total, 0);
            result = await dbService.add("returns", { 
              ...args, 
              return_number: retNum, 
              customer_name: (customer as any)?.name || '',
              total_amount,
              company_id: user.company_id 
            });
            await dbService.logActivity(user.id, user.username, user.company_id, 'إضافة مرتجع', `إضافة مرتجع رقم: ${retNum} عبر المساعد الذكي`);
            operationPerformed = true;
            break;
          case "createPurchaseReturn":
            const pretNum = `PRET-${Date.now().toString().slice(-6)}`;
            const supplier = (await dbService.list("suppliers", user.company_id) as any[]).find((s: any) => s.id === args.supplier_id);
            const pm = (await dbService.list("payment_methods", user.company_id) as any[]).find((p: any) => p.id === args.payment_method_id);
            const pTotal = args.items.reduce((sum: number, item: any) => sum + (item.quantity * item.cost_price), 0);
            const pItems = await Promise.all(args.items.map(async (item: any) => {
              const product = (await dbService.list("products", user.company_id) as any[]).find((p: any) => p.id === item.product_id);
              return {
                ...item,
                product_name: (product as any)?.name || '',
                price: item.cost_price,
                total: item.quantity * item.cost_price
              };
            }));
            result = await dbService.add("purchase_returns", { 
              ...args, 
              return_number: pretNum, 
              supplier_name: (supplier as any)?.name || '',
              payment_method_name: (pm as any)?.name || '',
              total_amount: pTotal,
              items: pItems,
              company_id: user.company_id 
            });
            await dbService.logActivity(user.id, user.username, user.company_id, 'إضافة مرتجع مشتريات', `إضافة مرتجع مشتريات رقم: ${pretNum} عبر المساعد الذكي`);
            operationPerformed = true;
            break;
          case "createCustomerDiscount":
            const cdiscNum = `CDISC-${Date.now().toString().slice(-6)}`;
            const discCustomer = (await dbService.list("customers", user.company_id) as any[]).find((c: any) => c.id === args.customer_id);
            const discPM = args.payment_method_id ? (await dbService.list("payment_methods", user.company_id) as any[]).find((p: any) => p.id === args.payment_method_id) : null;
            result = await dbService.add("customer_discounts", { 
              ...args, 
              number: cdiscNum, 
              customer_name: (discCustomer as any)?.name || '',
              payment_method_name: (discPM as any)?.name || '',
              company_id: user.company_id 
            });
            await dbService.logActivity(user.id, user.username, user.company_id, 'إضافة خصم عميل', `إضافة خصم للعميل: ${(discCustomer as any)?.name} بمبلغ: ${args.amount} عبر المساعد الذكي`);
            operationPerformed = true;
            break;
          case "createSupplierDiscount":
            const sdiscNum = `SDISC-${Date.now().toString().slice(-6)}`;
            const discSupplier = (await dbService.list("suppliers", user.company_id) as any[]).find((s: any) => s.id === args.supplier_id);
            const sdiscPM = args.payment_method_id ? (await dbService.list("payment_methods", user.company_id) as any[]).find((p: any) => p.id === args.payment_method_id) : null;
            result = await dbService.add("supplier_discounts", { 
              ...args, 
              number: sdiscNum, 
              supplier_name: (discSupplier as any)?.name || '',
              payment_method_name: (sdiscPM as any)?.name || '',
              company_id: user.company_id 
            });
            await dbService.logActivity(user.id, user.username, user.company_id, 'إضافة خصم مورد', `إضافة خصم للمورد: ${(discSupplier as any)?.name} بمبلغ: ${args.amount} عبر المساعد الذكي`);
            operationPerformed = true;
            break;
          default:
            result = { error: "Unknown function" };
        }
      } catch (e: any) {
        result = { error: e.message };
      }

      functionResponses.push({
        functionResponse: { name, response: result }
      });
    }

    // Add function responses to history
    contents.push({ role: 'user', parts: functionResponses });

    response = await ai.models.generateContent({
      model,
      contents,
      config: {
        systemInstruction,
        tools: [{ functionDeclarations: tools }],
      },
    });
  }

  return {
    text: response.text || "تم تنفيذ الطلب بنجاح.",
    operationPerformed
  };
}
