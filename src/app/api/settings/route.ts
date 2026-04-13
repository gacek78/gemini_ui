import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { encryptKey } from "@/lib/encryption";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const settings = await prisma.userSettings.findUnique({
      where: { userId: session.user.id },
    });

    return NextResponse.json(settings || {});
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const {
      apiKey,
      temperature,
      maxOutputTokens,
      topP,
      topK,
      systemInstruction,
      modelName,
      useGrounding,
    } = body;

    // Budujemy obiekt tylko z tych pól, które faktycznie przyszły w requescie
    const patch: any = {};

    if (temperature !== undefined)      patch.temperature      = parseFloat(temperature);
    if (maxOutputTokens !== undefined)  patch.maxOutputTokens  = parseInt(maxOutputTokens);
    if (topP !== undefined)             patch.topP             = parseFloat(topP);
    if (topK !== undefined)             patch.topK             = parseInt(topK);
    if (systemInstruction !== undefined) patch.systemInstruction = systemInstruction || null;
    if (modelName !== undefined)        patch.modelName        = modelName;
    if (useGrounding !== undefined)     patch.useGrounding     = Boolean(useGrounding);
    if (apiKey)                         patch.encryptedApiKey  = encryptKey(apiKey);

    // Przy create (upsert) potrzebujemy też userId i rozsądnych defaultów
    const createData: any = {
      userId: session.user.id,
      temperature:      patch.temperature      ?? 0.7,
      maxOutputTokens:  patch.maxOutputTokens  ?? 2048,
      topP:             patch.topP             ?? 0.9,
      topK:             patch.topK             ?? 40,
      systemInstruction: patch.systemInstruction ?? null,
      modelName:        patch.modelName        ?? "gemini-2.5-flash",
      useGrounding:     patch.useGrounding     ?? false,
    };
    if (patch.encryptedApiKey) createData.encryptedApiKey = patch.encryptedApiKey;

    const updatedSettings = await prisma.userSettings.upsert({
      where:  { userId: session.user.id },
      update: patch,        // ← tylko pola które przyszły
      create: createData,   // ← pełny obiekt przy pierwszym zapisie
    });

    return NextResponse.json(updatedSettings);
  } catch (error: any) {
    console.error("Settings API Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
