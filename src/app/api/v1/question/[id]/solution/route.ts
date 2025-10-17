import { NextResponse } from "next/server";
import { questionService } from "@/modules/question/question.service";

export async function GET(
  _req: Request,
  context: { params: { id: string } }
) {
  const id = Number(context.params.id);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    const solution = await questionService.getReferenceSolution(id);
    if (!solution) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(solution, { status: 200 });
  } catch (error) {
    console.error("API Error (solution by id):", error);
    return NextResponse.json(
      { error: "Failed to fetch solution." },
      { status: 500 }
    );
  }
}

