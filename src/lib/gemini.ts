import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * Mapa limitów okna kontekstowego per model (w tokenach)
 */
export const MODEL_CONTEXT_WINDOWS: Record<string, number> = {
  'gemini-2.5-pro':           1_000_000,
  'gemini-2.5-pro-preview':   1_000_000,
  'gemini-2.5-flash':         1_000_000,
  'gemini-2.5-flash-preview': 1_000_000,
  'gemini-2.5-flash-lite':    1_000_000,
  'gemini-2.0-flash':         1_000_000,
  'gemini-2.0-flash-lite':    1_000_000,
  'gemini-1.5-pro':           2_000_000,
  'gemini-1.5-flash':         1_000_000,
};

export function getContextWindow(modelName: string): number {
  // Dopasowanie prefix (np. gemini-2.5-flash-preview-04-17 -> gemini-2.5-flash-preview)
  for (const key of Object.keys(MODEL_CONTEXT_WINDOWS)) {
    if (modelName.startsWith(key)) return MODEL_CONTEXT_WINDOWS[key];
  }
  return 1_000_000; // domyślny fallback
}

/**
 * Inicjalizuje i zwraca instancję modelu Gemini.
 */
export function getGeminiModel(apiKey: string, modelName: string = 'gemini-2.5-flash', systemInstruction?: string, useGrounding: boolean = false) {
  const genAI = new GoogleGenerativeAI(apiKey);

  const tools = useGrounding ? [{ google_search: {} }] as any : undefined;

  return genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: systemInstruction ? { role: 'system', parts: [{ text: systemInstruction }] } : undefined,
    tools,
  });
}

/**
 * Przekształca historię wiadomości z formatu bazy danych do formatu Gemini API.
 */
export function formatHistory(messages: any[], limit: number = 20) {
  const slicedMessages = messages.length > limit ? messages.slice(-limit) : messages;

  return slicedMessages.map((msg) => {
    let parts: any[] = [];
    try {
      const parsed = JSON.parse(msg.content);
      if (parsed.image) {
        parts.push({
          inlineData: {
            data: parsed.image.data,
            mimeType: parsed.image.mimeType,
          },
        });
        if (parsed.text) parts.push({ text: parsed.text });
      } else {
        parts.push({ text: msg.content });
      }
    } catch {
      parts.push({ text: msg.content });
    }

    return {
      role: msg.role === 'user' ? 'user' : 'model',
      parts,
    };
  });
}
