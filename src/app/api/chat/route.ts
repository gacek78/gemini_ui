import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { decryptKey } from "@/lib/encryption";
import { getGeminiModel, formatHistory } from "@/lib/gemini";
import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Ile ostatnich wiadomości dosyłamy do modelu (poza podsumowaniem)
const HISTORY_WINDOW = 20;
// Po ilu wiadomościach generujemy podsumowanie
const SUMMARY_THRESHOLD = 20;

/**
 * Generuje podsumowanie starszych wiadomości przy użyciu Gemini.
 * Używa gemini-3-flash-preview z maxOutputTokens=1024 — tanio i szybko.
 */
async function generateSummary(
  apiKey: string,
  previousSummary: string | null,
  messages: any[]
): Promise<string> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

  const historyText = messages
    .map((m) => {
      let content = m.content;
      try {
        const p = JSON.parse(content);
        if (p.text) content = p.text;
      } catch {}
      return `${m.role === "user" ? "Użytkownik" : "Asystent"}: ${content}`;
    })
    .join("\n");

  const prompt = previousSummary
    ? `Masz poprzednie podsumowanie rozmowy oraz nowe wiadomości. Zaktualizuj podsumowanie, łącząc oba. Zachowaj wszystkie ważne fakty, ustalenia, kontekst i preferencje użytkownika. Bądź zwięzły (max 500 słów).

Poprzednie podsumowanie:
${previousSummary}

Nowe wiadomości:
${historyText}

Zaktualizowane podsumowanie:`
    : `Streść poniższą rozmowę w zwięzły sposób (max 500 słów). Zachowaj wszystkie ważne fakty, ustalenia, kontekst i preferencje użytkownika.

Rozmowa:
${historyText}

Podsumowanie:`;

  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { maxOutputTokens: 1024, temperature: 0.3 },
  });

  return result.response.text().trim();
}

export async function POST(req: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { messages, conversationId } = await req.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "Messages are required" }, { status: 400 });
    }

    const userSettings = await prisma.userSettings.findUnique({
      where: { userId: session.user.id },
    });

    if (!userSettings?.encryptedApiKey) {
      return NextResponse.json(
        { error: "API Key not found. Please set it in settings." },
        { status: 400 }
      );
    }

    const apiKey = decryptKey(userSettings.encryptedApiKey);
    let modelName = (userSettings as any)?.modelName || "gemini-3-flash-preview";

    // Pobierz konwersację wraz z podsumowaniem
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { summary: true },
    });

    // Pobierz wszystkie wiadomości z bazy (potrzebujemy count + okno)
    const allDbMessages = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: "asc" },
    });

    const totalMessages = allDbMessages.length;

    // Sprawdź czy osiągnęliśmy próg — jeśli tak, wygeneruj podsumowanie ze starszych wiadomości
    // Podsumowujemy wszystko POZA ostatnimi HISTORY_WINDOW wiadomościami
    let currentSummary = conversation?.summary || null;
    const olderMessages = totalMessages > HISTORY_WINDOW
      ? allDbMessages.slice(0, totalMessages - HISTORY_WINDOW)
      : [];

    const needsSummaryUpdate =
      olderMessages.length > 0 &&
      olderMessages.length % SUMMARY_THRESHOLD === 0;

    if (needsSummaryUpdate) {
      console.log(`[Chat] Generating rolling summary for conversation ${conversationId} (${olderMessages.length} older messages)`);
      try {
        currentSummary = await generateSummary(apiKey, currentSummary, olderMessages);
        await prisma.conversation.update({
          where: { id: conversationId },
          data: { summary: currentSummary },
        });
        console.log(`[Chat] Summary updated successfully.`);
      } catch (e) {
        console.error("[Chat] Failed to generate summary:", e);
        // Nie przerywamy — kontynuujemy bez aktualizacji podsumowania
      }
    }

    // Okno historii — ostatnie HISTORY_WINDOW wiadomości
    const recentMessages = allDbMessages.slice(-HISTORY_WINDOW);

    // Zapisz nową wiadomość użytkownika
    const lastMessage = messages[messages.length - 1];
    const dbContent = lastMessage.image
      ? JSON.stringify({ text: lastMessage.content, image: lastMessage.image })
      : lastMessage.content;

    await prisma.message.create({
      data: { conversationId, role: "user", content: dbContent },
    });

    // Tytuł rozmowy przy pierwszej wiadomości
    if (totalMessages === 0) {
      const newTitle = lastMessage.content.slice(0, 40) + (lastMessage.content.length > 40 ? "..." : "");
      await prisma.conversation.update({
        where: { id: conversationId },
        data: { title: newTitle },
      });
    }

    // Zbuduj historię do wysłania: [podsumowanie jako system msg] + [ostatnie 20]
    const historyForModel = formatHistory(recentMessages);

    // Jeśli mamy podsumowanie, dodaj je jako pierwszą wiadomość w historii (user+model ping)
    // Gemini API wymaga naprzemiennych ról user/model, dlatego używamy pary
    if (currentSummary) {
      historyForModel.unshift(
        {
          role: "user" as const,
          parts: [{ text: `[Podsumowanie wcześniejszej części rozmowy]\n${currentSummary}` }],
        },
        {
          role: "model" as const,
          parts: [{ text: "Rozumiem. Pamiętam kontekst wcześniejszej rozmowy." }],
        }
      );
    }

    const model = getGeminiModel(
      apiKey,
      modelName,
      userSettings.systemInstruction || undefined,
      (userSettings as any).useGrounding || false
    );

    const chat = model.startChat({
      history: historyForModel,
      generationConfig: {
        temperature: userSettings.temperature,
        maxOutputTokens: userSettings.maxOutputTokens,
        topP: userSettings.topP,
        topK: userSettings.topK,
      },
    });

    const promptParts: any[] = [];
    if (lastMessage.image) {
      promptParts.push({ inlineData: { data: lastMessage.image.data, mimeType: lastMessage.image.mimeType } });
    }
    promptParts.push({ text: lastMessage.content });

    let result;
    try {
      result = await chat.sendMessageStream(promptParts);
    } catch (err: any) {
      console.error(`[Chat API] Error sending message with ${modelName}:`, err);
      if (modelName !== "gemini-3-flash-preview") {
        console.log("[Chat API] Attempting fallback to gemini-3-flash-preview...");
        const fallbackModel = getGeminiModel(
          apiKey,
          "gemini-3-flash-preview",
          userSettings.systemInstruction || undefined,
          (userSettings as any).useGrounding || false
        );
        const fallbackChat = fallbackModel.startChat({
          history: historyForModel,
          generationConfig: {
            temperature: userSettings.temperature,
            maxOutputTokens: userSettings.maxOutputTokens,
          },
        });
        result = await fallbackChat.sendMessageStream(promptParts);
        modelName = "gemini-3-flash-preview";
      } else {
        throw err;
      }
    }

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        try {
          let fullResponse = "";
          let finalGroundingMetadata: any = null;
          let finalUsage: any = null;

          for await (const chunk of result.stream) {
            const chunkText = chunk.text();
            const groundingMetadata = chunk.candidates?.[0]?.groundingMetadata;

            if (groundingMetadata) {
              finalGroundingMetadata = groundingMetadata;
              controller.enqueue(encoder.encode(`__METADATA__:${JSON.stringify(groundingMetadata)}\n`));
            }

            if (chunk.usageMetadata) finalUsage = chunk.usageMetadata;

            if (chunkText) {
              fullResponse += chunkText;
              controller.enqueue(encoder.encode(chunkText));
            }
          }

          if (!finalUsage) {
            try {
              const resp = await result.response;
              if (resp.usageMetadata) finalUsage = resp.usageMetadata;
            } catch (_) {}
          }

          if (finalUsage) {
            controller.enqueue(
              encoder.encode(
                `__TOKENS__:${JSON.stringify({
                  promptTokenCount: finalUsage.promptTokenCount ?? 0,
                  candidatesTokenCount: finalUsage.candidatesTokenCount ?? 0,
                  totalTokenCount: finalUsage.totalTokenCount ?? 0,
                  model: modelName,
                })}\n`
              )
            );
          }

          if (fullResponse) {
            const assistantDbContent = finalGroundingMetadata
              ? JSON.stringify({ text: fullResponse, metadata: finalGroundingMetadata })
              : fullResponse;

            await prisma.message.create({
              data: { conversationId, role: "model", content: assistantDbContent },
            });

            await prisma.conversation.update({
              where: { id: conversationId },
              data: { updatedAt: new Date() },
            });
          }

          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (error: any) {
    console.error("Chat API Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
