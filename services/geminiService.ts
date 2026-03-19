import { GoogleGenAI } from "@google/genai";
import { Sale, Product, FinancialRecord } from "../types";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

// Helper to check if API key is present
const isApiKeyAvailable = () => !!apiKey;

export const analyzeSalesData = async (sales: Sale[], products: Product[]) => {
  if (!isApiKeyAvailable()) return "API Key not configured.";

  const salesSummary = sales.map(s => ({
    date: s.date,
    total: s.total,
    method: s.paymentMethod,
    itemCount: s.items.length
  }));

  const prompt = `
    Analyze the following sales data and provide a strategic summary in Portuguese (pt-BR).
    Identify trends, best-selling periods, and suggestions for increasing revenue.
    
    Data: ${JSON.stringify(salesSummary.slice(0, 50))}
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: prompt,
      config: {
        thinkingConfig: { thinkingBudget: 2048 },
      }
    });
    return response.text;
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Não foi possível analisar os dados no momento.";
  }
};

export const generateProductDescription = async (productName: string) => {
  if (!isApiKeyAvailable()) return "Description unavailable";

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Write a short, appealing marketing description (max 30 words) for a product named "${productName}" in Portuguese.`,
    });
    return response.text;
  } catch (error) {
    return "Descrição automática indisponível.";
  }
};

export const analyzeFinancialHealth = async (records: FinancialRecord[]) => {
  if (!isApiKeyAvailable()) return "Financial analysis unavailable";

  const summary = records.map(r => ({
    type: r.type,
    amount: r.amount,
    status: r.status,
    due: r.dueDate
  }));

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-lite-preview-02-05", // Using fast model for quick insights
      contents: `Analyze these financial records. Give me 3 bullet points in Portuguese on cash flow health and alerts for overdue accounts. Data: ${JSON.stringify(summary)}`,
    });
    return response.text;
  } catch (error) {
    return "Análise financeira indisponível.";
  }
};