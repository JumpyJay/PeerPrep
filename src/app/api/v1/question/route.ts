import { NextResponse } from "next/server";
import { questionService } from "@/modules/question/question.service";
import { Question } from "@/modules/question/question.types";
import { assertServiceAuthorized } from "@/lib/security/service-auth";

/**
 * handles GET requests to /api/v1/question
 */
export async function GET(request: Request) {
  try {
    assertServiceAuthorized(request, "read");
    // 1. Call your service layer to get data
    const questions: Question[] = await questionService.getAllQuestions();

    // 2. Return a successful JSON response
    return NextResponse.json(questions, { status: 200 });
  } catch (error) {
    // 3. Handle errors
    console.error("API Error:", error);
    if (error instanceof Error && "status" in error) {
      return NextResponse.json({ error: error.message }, { status: Number(error.status) });
    }
    return NextResponse.json(
      { error: "Failed to fetch questions." },
      { status: 500 }
    );
  }
}
