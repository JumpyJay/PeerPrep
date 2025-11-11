import { NextRequest, NextResponse } from "next/server";
import { RankingService } from "@/modules/ranking/ranking.service";

/**
 * This API route triggers a full recalculation of all user ranks
 * based on the submissions table.
 */
export async function POST(request: NextRequest) {
  try {
    console.log("API: Received request to recalculate all ranks.");
    const result = await RankingService.recalculateAllRanks();
    
    if (result.status === 'error') {
      throw new Error("Recalculation failed in service.");
    }
    
    return NextResponse.json({ 
      message: "Recalculation complete.",
      ...result 
    });

  } catch (error) {
    console.error("Failed to recalculate ranks:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}