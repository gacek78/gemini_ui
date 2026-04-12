import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { apiKey } = await req.json();

    if (!apiKey || typeof apiKey !== "string" || apiKey.trim().length < 10) {
      return NextResponse.json({ error: "Invalid API key format" }, { status: 400 });
    }

    // Próba wywołania minimalnego zapytania do Gemini API
    const genAI = new GoogleGenerativeAI(apiKey.trim());
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: "ping" }] }],
      generationConfig: { maxOutputTokens: 1 },
    });

    // Jeśli dotarliśmy tutaj — klucz działa
    const _text = result.response.text(); // upewniamy się, że odpowiedź jest poprawna
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error: any) {
    console.error("[test-key] Error:", error?.message);
    // 400 = zły klucz / brak uprawnień, nie 500
    return NextResponse.json(
      { error: error?.message || "Invalid API key" },
      { status: 400 }
    );
  }
}
