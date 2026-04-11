import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * Inicjalizuje i zwraca instancję modelu Gemini.
 */
export function getGeminiModel(apiKey: string, modelName: string = 'gemini-flash-latest', systemInstruction?: string, useGrounding: boolean = false) {
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
 * Obsługuje limit wiadomości (okno przesuwne).
 */
export function formatHistory(messages: any[], limit: number = 20) {
  const slicedMessages = messages.length > limit ? messages.slice(-limit) : messages;

  return slicedMessages.map((msg) => {
    // Jeśli treść wiadomości to JSON (zawiera obraz), parsujemy
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
