import { GoogleGenAI, Type } from "@google/genai";

const getAI = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("GEMINI_API_KEY is missing from process.env");
    throw new Error("GEMINI_API_KEY is not defined in the environment.");
  }
  // Log presence of key (masked)
  console.log(`GEMINI_API_KEY is present: ${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}`);
  return new GoogleGenAI({ apiKey });
};

export const parseInvoiceText = async (text: string) => {
  if (!text || text.trim() === "") {
    throw new Error("النص المدخل فارغ. يرجى تزويد بيانات الفاتورة.");
  }

  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: {
        parts: [{
          text: `Parse the following text into an invoice structure. 
      Text: "${text}"
      Return JSON with: customerName, date (YYYY-MM-DD), items (array of { productName, quantity, price }).`
        }]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            customerName: { type: Type.STRING },
            date: { type: Type.STRING },
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  productName: { type: Type.STRING },
                  quantity: { type: Type.NUMBER },
                  price: { type: Type.NUMBER }
                },
                required: ["productName", "quantity", "price"]
              }
            }
          },
          required: ["customerName", "date", "items"]
        }
      }
    });
    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("AI Error (parseInvoiceText):", error);
    throw new Error(`خطأ في معالجة الفاتورة: ${error instanceof Error ? error.message : 'خطأ غير معروف'}`);
  }
};

export const parseInvoiceImage = async (base64Image: string) => {
  if (!base64Image) {
    throw new Error("لم يتم توفير صورة.");
  }

  try {
    const ai = getAI();
    const imageData = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;
    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: {
        parts: [
          { inlineData: { mimeType: "image/jpeg", data: imageData } },
          { text: "Extract invoice details from this image. Return JSON with: customerName, date (YYYY-MM-DD), items (array of { productName, quantity, price })." }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            customerName: { type: Type.STRING },
            date: { type: Type.STRING },
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  productName: { type: Type.STRING },
                  quantity: { type: Type.NUMBER },
                  price: { type: Type.NUMBER }
                },
                required: ["productName", "quantity", "price"]
              }
            }
          },
          required: ["customerName", "date", "items"]
        }
      }
    });
    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("AI Error (parseInvoiceImage):", error);
    throw new Error(`خطأ في معالجة صورة الفاتورة: ${error instanceof Error ? error.message : 'خطأ غير معروف'}`);
  }
};

export const parseTransaction = async (type: string, input: { text?: string, image?: string, audio?: string }) => {
  try {
    const ai = getAI();
    const parts: any[] = [];
    
    if (input.image) {
      const imageData = input.image.includes(',') ? input.image.split(',')[1] : input.image;
      parts.push({ inlineData: { mimeType: "image/jpeg", data: imageData } });
    }
    
    if (input.audio) {
      const audioData = input.audio.includes(',') ? input.audio.split(',')[1] : input.audio;
      parts.push({ inlineData: { mimeType: "audio/webm", data: audioData } });
    }

    let prompt = "";
    let schema: any = {};

    switch (type) {
      case 'sales_invoice':
      case 'purchase_invoice':
        prompt = `Extract ${type === 'sales_invoice' ? 'sales' : 'purchase'} invoice details with maximum accuracy. 
        Return JSON with: 
        - customerName (for sales) or supplierName (for purchase)
        - date (YYYY-MM-DD)
        - items (array of { productName, quantity, price })
        - totalAmount (number, optional)
        - notes (string, optional)`;
        schema = {
          type: Type.OBJECT,
          properties: {
            customerName: { type: Type.STRING },
            supplierName: { type: Type.STRING },
            date: { type: Type.STRING },
            totalAmount: { type: Type.NUMBER },
            notes: { type: Type.STRING },
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  productName: { type: Type.STRING },
                  quantity: { type: Type.NUMBER },
                  price: { type: Type.NUMBER }
                },
                required: ["productName", "quantity", "price"]
              }
            }
          }
        };
        break;
      case 'return':
      case 'purchase_return':
        prompt = `Extract ${type === 'return' ? 'sales' : 'purchase'} return details with maximum accuracy.
        Return JSON with: 
        - customerName (for sales) or supplierName (for purchase)
        - date (YYYY-MM-DD)
        - items (array of { productName, quantity, price })
        - totalAmount (number, optional)
        - reason (string, optional)`;
        schema = {
          type: Type.OBJECT,
          properties: {
            customerName: { type: Type.STRING },
            supplierName: { type: Type.STRING },
            date: { type: Type.STRING },
            totalAmount: { type: Type.NUMBER },
            reason: { type: Type.STRING },
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  productName: { type: Type.STRING },
                  quantity: { type: Type.NUMBER },
                  price: { type: Type.NUMBER }
                },
                required: ["productName", "quantity", "price"]
              }
            }
          }
        };
        break;
      case 'receipt_voucher':
      case 'payment_voucher':
        prompt = `Extract ${type === 'receipt_voucher' ? 'receipt' : 'payment'} voucher details with maximum accuracy.
        Return JSON with: 
        - customerName (for receipt) or supplierName (for payment)
        - date (YYYY-MM-DD)
        - amount (number)
        - description (string)
        - paymentMethod (string, optional)`;
        schema = {
          type: Type.OBJECT,
          properties: {
            customerName: { type: Type.STRING },
            supplierName: { type: Type.STRING },
            date: { type: Type.STRING },
            amount: { type: Type.NUMBER },
            description: { type: Type.STRING },
            paymentMethod: { type: Type.STRING }
          },
          required: ["amount"]
        };
        break;
      case 'cash_transfer':
        prompt = `Extract cash transfer details with maximum accuracy.
        Return JSON with: 
        - fromAccountName (string)
        - toAccountName (string)
        - date (YYYY-MM-DD)
        - amount (number)
        - description (string)`;
        schema = {
          type: Type.OBJECT,
          properties: {
            fromAccountName: { type: Type.STRING },
            toAccountName: { type: Type.STRING },
            date: { type: Type.STRING },
            amount: { type: Type.NUMBER },
            description: { type: Type.STRING }
          },
          required: ["amount", "fromAccountName", "toAccountName"]
        };
        break;
      case 'discount':
        prompt = `Extract discount details with maximum accuracy.
        Return JSON with: 
        - customerName (or supplierName)
        - date (YYYY-MM-DD)
        - amount (number)
        - description (string)`;
        schema = {
          type: Type.OBJECT,
          properties: {
            customerName: { type: Type.STRING },
            supplierName: { type: Type.STRING },
            date: { type: Type.STRING },
            amount: { type: Type.NUMBER },
            description: { type: Type.STRING }
          },
          required: ["amount"]
        };
        break;
      default:
        prompt = `Extract details from this text. Return JSON.`;
        schema = { type: Type.OBJECT, properties: { data: { type: Type.STRING } } };
    }

    if (input.text) {
      parts.push({ text: `${prompt}\n\nText: "${input.text}"` });
    } else {
      parts.push({ text: prompt });
    }

    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: { parts },
      config: {
        responseMimeType: "application/json",
        responseSchema: schema
      }
    });

    const result = JSON.parse(response.text || "{}");
    
    // If date is missing, use today's date
    if (!result.date) {
      result.date = new Date().toISOString().slice(0, 10);
    }
    
    return result;
  } catch (error) {
    console.error("AI Error (parseTransaction):", error);
    throw new Error(`خطأ في معالجة العملية: ${error instanceof Error ? error.message : 'خطأ غير معروف'}`);
  }
};

export const parseAccountType = async (text: string) => {
  if (!text || text.trim() === "") {
    throw new Error("النص المدخل فارغ.");
  }

  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: {
        parts: [{
          text: `Parse the following text into an account type structure. 
      Text: "${text}"
      Return JSON with: code, name, statementType ('income_statement' or 'balance_sheet'), classification ('asset', 'liability_equity', 'revenue', 'cost', 'expense').
      Classification rules:
      - If statementType is balance_sheet: classification must be 'asset' or 'liability_equity'.
      - If statementType is income_statement: classification must be 'revenue', 'cost', or 'expense'.`
        }]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            code: { type: Type.STRING },
            name: { type: Type.STRING },
            statementType: { type: Type.STRING, description: "Must be 'income_statement' or 'balance_sheet'" },
            classification: { type: Type.STRING, description: "Must be 'asset', 'liability_equity', 'revenue', 'cost', or 'expense'" }
          },
          required: ["code", "name", "statementType", "classification"]
        }
      }
    });
    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("AI Error (parseAccountType):", error);
    throw new Error(`خطأ في تحليل نوع الحساب: ${error instanceof Error ? error.message : 'خطأ غير معروف'}`);
  }
};

export const parseAccount = async (text: string) => {
  if (!text || text.trim() === "") {
    throw new Error("النص المدخل فارغ.");
  }

  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: {
        parts: [{
          text: `Parse the following text into an account structure. 
      Text: "${text}"
      Return JSON with: code, name, typeName (the name of the account type).`
        }]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            code: { type: Type.STRING },
            name: { type: Type.STRING },
            typeName: { type: Type.STRING }
          },
          required: ["code", "name", "typeName"]
        }
      }
    });
    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("AI Error (parseAccount):", error);
    throw new Error(`خطأ في تحليل الحساب: ${error instanceof Error ? error.message : 'خطأ غير معروف'}`);
  }
};

export const smartSearch = async (query: string, context: any) => {
  if (!query || query.trim() === "") {
    return "يرجى إدخال استفسار للبحث.";
  }

  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: {
        parts: [{
          text: `أنت مساعد محاسبي ذكي لنظام إدارة مبيعات ومخازن. 
      بناءً على البيانات التالية (context) واستفسار المستخدم (query)، قدم إجابة دقيقة ومفيدة باللغة العربية.
      
      البيانات المتاحة:
      ${JSON.stringify(context, null, 2)}
      
      الاستفسار: "${query}"
      
      ملاحظات:
      - إذا كان السؤال عن المبيعات، استخدم netSales.
      - إذا كان السؤال عن المصروفات، استخدم totalExpenses.
      - إذا كان السؤال عن التحصيلات، استخدم totalReceipts.
      - قدم الأرقام بوضوح مع العملة (ج.م).
      - كن ودوداً ومهنياً في ردك.`
        }]
      }
    });
    return response.text;
  } catch (error) {
    console.error("AI Error (smartSearch):", error);
    return `عذراً، حدث خطأ أثناء معالجة طلبك: ${error instanceof Error ? error.message : 'خطأ غير معروف'}`;
  }
};
