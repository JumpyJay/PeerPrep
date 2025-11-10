import { NextResponse } from "next/server";
import { questionService } from "@/modules/question/question.service";
import { Question } from "@/modules/question/question.types";

/**
 * handles GET requests to /api/v1/question
 */
export async function GET() {
  try {
    // 1. Call your service layer to get data
    const questions: Question[] = await questionService.getAllQuestions();

    // 2. Return a successful JSON response
    return NextResponse.json(questions, { status: 200 });
  } catch (error) {
    // 3. Handle errors
    console.error("API Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch questions." },
      { status: 500 }
    );
  }
}
