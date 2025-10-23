import { NextResponse } from "next/server";
import { questionService } from "@/modules/question/question.service";

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  const id = Number(params.id);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    const question = await questionService.getQuestionById(id);
    if (!question) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(question, { status: 200 });
  } catch (error) {
    console.error("API Error (question by id):", error);
    return NextResponse.json({ error: "Failed to fetch question." }, { status: 500 });
  }
}

