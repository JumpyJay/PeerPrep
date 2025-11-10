import { NextRequest, NextResponse } from "next/server";
import { RankingService } from "@/modules/ranking/ranking.service";

// Define the shape of the 'params' object *after* it's awaited
interface RouteParams {
  username: string;
}

// The 'context' object contains a 'params' property which is a Promise
interface RouteContext {
  params: Promise<RouteParams>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    // 1. Get the username from the URL
    //    You MUST await 'context.params' to get the object
    const { username } = await context.params;

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