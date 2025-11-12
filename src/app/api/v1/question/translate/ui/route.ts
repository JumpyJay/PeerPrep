import { NextResponse } from "next/server";
import { codeTranslationService } from "@/modules/translation/translation.service";
import { CodeTranslationRequest } from "@/modules/translation/translation.types";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<CodeTranslationRequest>;
    const result = await codeTranslationService.translate({
      sourceCode: body?.sourceCode ?? "",
      fromLang: body?.fromLang ?? "",
      toLang: body?.toLang ?? "",
      style: body?.style,
    });
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("API Error (code translation ui):", error);
    if (error instanceof Error && "status" in error) {
      return NextResponse.json({ error: error.message }, { status: Number(error.status) });
    }
    if (error instanceof Error && error.message === "Unexpected end of JSON input") {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to translate code." }, { status: 500 });
  }
}
