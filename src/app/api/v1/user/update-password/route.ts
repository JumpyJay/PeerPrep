import { NextRequest, NextResponse } from "next/server";
import { userService } from "@/modules/user/user.service";

export async function PUT(req: NextRequest) {
  try {
    const { password, email } = await req.json();

    if (!password || !email) {
      return NextResponse.json({ error: "Missing password or email" }, { status: 400 });
    }

    const updated = await userService.updatePassword(email, password);
    return NextResponse.json(updated, { status: updated.status });
  } catch (error) {
    console.error("Update password error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
