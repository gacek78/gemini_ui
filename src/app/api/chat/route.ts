import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { decryptKey } from "@/lib/encryption";
import { getGeminiModel, formatHistory } from "@/lib/gemini";
import { NextRequest, NextResponse } from "next/server";

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

    // Pobierz ustawienia użytkownika (w tym zaszyfrowany klucz API)
    const userSettings = await prisma.userSettings.findUnique({
      where: { userId: session.user.id },
    });

    if (!userSettings?.encryptedApiKey) {
      return NextResponse.json(
        { error: "API Key not found. Please set it in settings." },
        { status: 400 }
      );
    }

    // Pobierz ostatnie 20 wiadomości (najnowsze najpierw)
    const dbMessagesRaw = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    // Odwróć, aby były chronologicznie (najstarsze najpierw)
    const dbMessages = dbMessagesRaw.reverse();

    // Odszyfruj klucz API
    const apiKey = decryptKey(userSettings.encryptedApiKey);

    // Inicjalizacja modelu z uwzględnieniem Persony/Instrukcji systemowej
    const modelName = (userSettings as any)?.modelName || "gemini-flash-latest";
    const model = getGeminiModel(
      apiKey,
      modelName,
      userSettings.systemInstruction || undefined
    );

    // Ostatnia wiadomość od użytkownika (ta która właśnie przyszła)
    const lastMessage = messages[messages.length - 1];

    // 1. Zapisz wiadomość użytkownika w bazie danych (z obsługą obrazów)
    const dbContent = lastMessage.image 
      ? JSON.stringify({ text: lastMessage.content, image: lastMessage.image })
      : lastMessage.content;

    await prisma.message.create({
      data: {
        conversationId,
        role: "user",
        content: dbContent,
      },
    });

    // 2. Jeśli to pierwsza wiadomość, zaktualizuj tytuł konwersacji
    const messageCount = await prisma.message.count({
      where: { conversationId },
    });

    if (messageCount === 1) {
      const newTitle = lastMessage.content.slice(0, 40) + (lastMessage.content.length > 40 ? "..." : "");
      await prisma.conversation.update({
        where: { id: conversationId },
        data: { title: newTitle },
      });
    }

    // Przygotowanie historii dla Gemini (bez tej ostatniej, bo zaraz ją wyślemy w sendMessageStream)
    const chat = model.startChat({
      history: formatHistory(dbMessages),
      generationConfig: {
// ...
        temperature: userSettings.temperature,
        maxOutputTokens: userSettings.maxOutputTokens,
        topP: userSettings.topP,
        topK: userSettings.topK,
      },
    });

    // Przygotowanie części wiadomości (tekst + opcjonalny obraz)
    const promptParts: any[] = [];
    if (lastMessage.image) {
      promptParts.push({
        inlineData: {
          data: lastMessage.image.data,
          mimeType: lastMessage.image.mimeType,
        },
      });
    }
    promptParts.push({ text: lastMessage.content });

    // Strumieniowanie odpowiedzi
    const result = await chat.sendMessageStream(promptParts);

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        try {
          let fullResponse = "";
          let finalGroundingMetadata: any = null;

          for await (const chunk of result.stream) {
            const chunkText = chunk.text();
            
            // Sprawdź czy są metadane uziemienia (Grounding Metadata)
            const groundingMetadata = chunk.candidates?.[0]?.groundingMetadata;
            
            if (groundingMetadata) {
              finalGroundingMetadata = groundingMetadata;
              // Wysyłamy metadane jako specjalny chunk JSON
              controller.enqueue(encoder.encode(`__METADATA__:${JSON.stringify(groundingMetadata)}\n`));
            }

            if (chunkText) {
              fullResponse += chunkText;
              controller.enqueue(encoder.encode(chunkText));
            }
          }

          // 3. Po zakończeniu strumienia, zapisz pełną odpowiedź asystenta (z metadanymi uziemienia)
          if (fullResponse) {
            const assistantDbContent = finalGroundingMetadata
              ? JSON.stringify({ text: fullResponse, metadata: finalGroundingMetadata })
              : fullResponse;

            await prisma.message.create({
              data: {
                conversationId,
                role: "model",
                content: assistantDbContent,
              },
            });

            // Zaktualizuj datę edycji konwersacji, aby wskoczyła na górę listy
            await prisma.conversation.update({
              where: { id: conversationId },
              data: { updatedAt: new Date() },
            });
          }

          controller.close();
        } catch (error) {
// ...
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
