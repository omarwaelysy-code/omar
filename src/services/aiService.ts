import { GoogleGenAI } from "@google/genai";

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

export const analyzeImage = async (base64Image: string, prompt: string) => {
  try {
    const ai = getAI();
    const imageData = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;
    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: "image/jpeg",
                data: imageData
              }
            }
          ]
        }
      ]
    });
    return response.text;
  } catch (error) {
    console.error("AI Analysis Error:", error);
    throw error;
  }
};

export const processVoiceCommand = async (command: string, context: any) => {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: [{
        parts: [{
          text: `
        You are an AI assistant for a Sales and Inventory Management System.
        The user said: "${command}"
        Current system context: ${JSON.stringify(context)}
        
        Based on the command, determine the user's intent. 
        Possible intents: "navigate", "create_invoice", "search_product", "get_report", "unknown".
        
        Return a JSON response with:
        {
          "intent": "intent_name",
          "action": "description of what to do",
          "params": { ... any extracted parameters like customer name, product, amount ... },
          "response": "A friendly response to the user in Arabic"
        }
      `
        }]
      }],
      config: {
        responseMimeType: "application/json"
      }
    });
    return JSON.parse(response.text || '{}');
  } catch (error) {
    console.error("AI Voice Command Error:", error);
    throw error;
  }
};
