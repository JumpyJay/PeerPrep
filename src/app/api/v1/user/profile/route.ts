import { NextResponse } from "next/server";
import { decodeJwtPayload } from "@/lib/decodeJWT";
import { userService } from "@/modules/user/user.service";
import { RankingRepository } from "@/modules/ranking/ranking.repository";

export async function GET(req: Request) {
  const cookie = req.headers.get("cookie");
  const token = cookie
    ?.split(";")
    .find(c => c.trim().startsWith("token="))
    ?.split("=")[1];

  if (!token) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    // decode JWT to extract email 
    const payload = decodeJwtPayload(token);
    const email = payload.id || payload.email;

    if (!email) {
      return NextResponse.json({ message: "Invalid token" }, { status: 401 });
    }

    // fetch basic user information 
    const user = await userService.getProfile(email);

    if (!user) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    // fetch ranking information 
    const ranking = await RankingRepository.getUserRank(user.username);

    // merge user and ranking information
    const profile = {
      username: user.username,
      email: user.email,
      created_at: user.created_at,
      elo: ranking?.elo || 0,
      wins: ranking?.wins || 0,
      losses: ranking?.losses || 0,
      draws: ranking?.draws || 0,
      ranking: ranking?.rank || "Unranked", 
      totalMatches: (ranking?.wins || 0) + (ranking?.losses || 0) + (ranking?.draws || 0),
      winRate: ranking
        ? Math.round(((ranking.wins || 0) / ((ranking.wins || 0) + (ranking.losses || 0) + (ranking.draws || 0))) * 100)
        : 0,
    };

    return NextResponse.json(profile)
  } catch (err) {
    console.error("Profile route error:", err);
    return NextResponse.json({ message: "Invalid or expired token" }, { status: 401 });
  }
}
