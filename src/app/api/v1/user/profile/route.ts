import { NextResponse } from "next/server";
import { decodeJwtPayload } from "@/lib/decodeJWT";
import { userService } from "@/modules/user/user.service";

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
    // Decode JWT 
    const payload = decodeJwtPayload(token);
    const email = payload.id || payload.email;

    if (!email) {
      return NextResponse.json({ message: "Invalid token" }, { status: 401 });
    }

    const user = await userService.getProfile(email);

    if (!user) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    return NextResponse.json(user)
  } catch (err) {
    console.error("Profile route error:", err);
    return NextResponse.json({ message: "Invalid or expired token" }, { status: 401 });
  }
}
