import { GoogleGenerativeAI, Tool, Part } from '@google/generative-ai';

/**
 * Mapa limitów okna kontekstowego per model (w tokenach)
 */
export const MODEL_CONTEXT_WINDOWS: Record<string, number> = {
  // Gemini 3.x
  'gemini-3.1-pro-preview':       1_000_000,
  'gemini-3-flash-preview':        1_000_000,
  'gemini-3.1-flash-lite-preview': 1_000_000,
  // Gemini 2.5 (deprecated czerwiec 2026)
  'gemini-2.5-pro':               1_000_000,
  'gemini-2.5-flash':             1_000_000,
  'gemini-2.5-flash-lite':        1_000_000,
  // Starsze
  'gemini-2.0-flash':             1_000_000,
  'gemini-1.5-pro':               2_000_000,
  'gemini-1.5-flash':             1_000_000,
};

export function getContextWindow(modelName: string): number {
  for (const key of Object.keys(MODEL_CONTEXT_WINDOWS)) {
    if (modelName.startsWith(key)) return MODEL_CONTEXT_WINDOWS[key];
  }
  return 1_000_000;
}

export function getGeminiModel(apiKey: string, modelName: string = 'gemini-3-flash-preview', systemInstruction?: string, useGrounding: boolean = false) {
  const genAI = new GoogleGenerativeAI(apiKey);
  // @ts-expect-error type mismatches in google SDK for grounding tool
  const tools: Tool[] | undefined = useGrounding ? [{ googleSearch: {} }] : undefined;
  return genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: systemInstruction ? { role: 'system', parts: [{ text: systemInstruction }] } : undefined,
    tools,
  });
}

export interface ChatMessage {
  role: string;
  content: string;
}

export function formatHistory(messages: ChatMessage[], limit: number = 20) {
  const slicedMessages = messages.length > limit ? messages.slice(-limit) : messages;
  return slicedMessages.map((msg) => {
    const parts: Part[] = [];
    try {
      const parsed = JSON.parse(msg.content);
      if (parsed.image) {
        parts.push({ inlineData: { data: parsed.image.data, mimeType: parsed.image.mimeType } });
        if (parsed.text) parts.push({ text: parsed.text });
      } else {
        parts.push({ text: msg.content });
      }
    } catch {
      parts.push({ text: msg.content });
    }
    return { role: msg.role === 'user' ? 'user' : 'model', parts };
  });
}
