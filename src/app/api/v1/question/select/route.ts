import { NextResponse } from "next/server";
import { questionService } from "@/modules/question/question.service";
import { Difficulty } from "@/modules/question/question.types";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const difficultyParam = searchParams.get("difficulty") as Difficulty | null;
    const tagsParam = searchParams.get("tags"); // comma-separated
    const user = searchParams.get("user") || undefined; // user identifier
    const windowDaysParam = searchParams.get("windowDays");

    const difficulty =
      difficultyParam && ["Easy", "Medium", "Hard"].includes(difficultyParam)
        ? (difficultyParam as Difficulty)
        : undefined;
    const tags = tagsParam
      ? tagsParam
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : undefined;
    const windowDays = windowDaysParam ? Number(windowDaysParam) : undefined;

    const question = await questionService.selectQuestion({
      difficulty,
      tags,
      user,
      windowDays,
    });

    if (!question) {
      return NextResponse.json({ error: "No suitable question found" }, { status: 404 });
    }

    return NextResponse.json(question, { status: 200 });
  } catch (error) {
    console.error("API Error (select question):", error);
    return NextResponse.json(
      { error: "Failed to select question." },
      { status: 500 }
    );
  }
}
