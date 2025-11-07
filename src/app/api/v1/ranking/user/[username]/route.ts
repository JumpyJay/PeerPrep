import { NextResponse } from "next/server";
// Make sure this path points to your service file
import { RankingService } from "@/modules/ranking/ranking.service";

// This interface tells TypeScript what 'params' will look like
interface GetParams {
  params: { username: string }; // This now matches your folder name
}

export async function GET(request: Request, { params }: GetParams) {
  try {
    // 1. Get the username from the URL
    const { username } = params;

    // 2. Call your service (which calls the repository)
    const userRank = await RankingService.getUserRank(username);

    // 3. Handle "User not found"
    if (!userRank) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // 4. Send the data back
    return NextResponse.json(userRank);

  } catch (error) {
    console.error(`Failed to fetch rank for user:`, error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}