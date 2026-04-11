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
    const { apiKey, temperature, maxOutputTokens, topP, topK, systemInstruction, modelName, useGrounding } = await req.json();

    const data: any = {
      userId: session.user.id,
      temperature: temperature !== undefined ? parseFloat(temperature) : 0.7,
      maxOutputTokens: maxOutputTokens !== undefined ? parseInt(maxOutputTokens) : 2048,
      topP: topP !== undefined ? parseFloat(topP) : 0.9,
      topK: topK !== undefined ? parseInt(topK) : 40,
      systemInstruction: systemInstruction || null,
      modelName: modelName || "gemini-2.5-flash",
      useGrounding: useGrounding !== undefined ? Boolean(useGrounding) : false,
    };

    if (apiKey) {
      data.encryptedApiKey = encryptKey(apiKey);
    }

    const updatedSettings = await prisma.userSettings.upsert({
      where: { userId: session.user.id },
      update: data,
      create: data,
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
