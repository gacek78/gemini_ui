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

    const userSettings = await prisma.userSettings.findUnique({
      where: { userId: session.user.id },
    });

    if (!userSettings?.encryptedApiKey) {
      return NextResponse.json(
        { error: "API Key not found. Please set it in settings." },
        { status: 400 }
      );
    }

    const dbMessagesRaw = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    const dbMessages = dbMessagesRaw.reverse();

    const apiKey = decryptKey(userSettings.encryptedApiKey);
    let modelName = (userSettings as any)?.modelName || "gemini-2.5-flash";
    console.log(`[Chat API] Using model: ${modelName} for user ${session.user.id}`);

    const model = getGeminiModel(
      apiKey,
      modelName,
      userSettings.systemInstruction || undefined,
      (userSettings as any).useGrounding || false
    );

    const lastMessage = messages[messages.length - 1];

    const dbContent = lastMessage.image
      ? JSON.stringify({ text: lastMessage.content, image: lastMessage.image })
      : lastMessage.content;

    await prisma.message.create({
      data: { conversationId, role: "user", content: dbContent },
    });

    const messageCount = await prisma.message.count({ where: { conversationId } });
    if (messageCount === 1) {
      const newTitle =
        lastMessage.content.slice(0, 40) +
        (lastMessage.content.length > 40 ? "..." : "");
      await prisma.conversation.update({
        where: { id: conversationId },
        data: { title: newTitle },
      });
    }

    const chat = model.startChat({
      history: formatHistory(dbMessages),
      generationConfig: {
        temperature: userSettings.temperature,
        maxOutputTokens: userSettings.maxOutputTokens,
        topP: userSettings.topP,
        topK: userSettings.topK,
      },
    });

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

    let result;
    try {
      result = await chat.sendMessageStream(promptParts);
    } catch (err: any) {
      console.error(`[Chat API] Error sending message with ${modelName}:`, err);
      if (modelName !== "gemini-2.0-flash") {
        console.log("[Chat API] Attempting fallback to gemini-2.0-flash...");
        const fallbackModel = getGeminiModel(
          apiKey,
          "gemini-2.0-flash",
          userSettings.systemInstruction || undefined,
          (userSettings as any).useGrounding || false
        );
        const fallbackChat = fallbackModel.startChat({
          history: formatHistory(dbMessages),
          generationConfig: {
            temperature: userSettings.temperature,
            maxOutputTokens: userSettings.maxOutputTokens,
          },
        });
        result = await fallbackChat.sendMessageStream(promptParts);
        modelName = "gemini-2.0-flash";
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
              controller.enqueue(
                encoder.encode(`__METADATA__:${JSON.stringify(groundingMetadata)}\n`)
              );
            }

            // usageMetadata pojawia się w ostatnim chunk-u streamu
            if (chunk.usageMetadata) {
              finalUsage = chunk.usageMetadata;
            }

            if (chunkText) {
              fullResponse += chunkText;
              controller.enqueue(encoder.encode(chunkText));
            }
          }

          // Jeśli chunk nie zawierał usageMetadata, spróbuj z result.response
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
