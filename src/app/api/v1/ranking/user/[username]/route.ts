import { NextRequest, NextResponse } from "next/server";
import { RankingService } from "@/modules/ranking/ranking.service";


interface GetParams {
  params: Promise<{ username: string }>;
}

// 1. Use NextRequest
export async function GET(request: NextRequest, { params }: GetParams) {
  try {
    // 2. Await the params promise to get the actual object
    const resolvedParams = await params;
    
    // 3. Destructure the username from the resolved object
    const { username } = resolvedParams;

    // 4. Call service (which calls the repository)
    const userRank = await RankingService.getUserRank(username);

    // 5. Handle "User not found"
    if (!userRank) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // 6. Send the data back
    return NextResponse.json(userRank);

  } catch (error) {
    console.error(`Failed to fetch rank for user:`, error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}