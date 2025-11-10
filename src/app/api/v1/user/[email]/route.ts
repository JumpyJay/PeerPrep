// /src/app/api/v1/user/[email]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { userService } from "@/modules/user/user.service";
import { assertServiceAuthorized } from "@/lib/security/service-auth";

export const runtime = "nodejs";

// Small helpers to extract status/message without using `any`
function extractStatus(err: unknown, fallback = 401): number {
  if (typeof err === "object" && err !== null && "status" in err) {
    const v = (err as Record<string, unknown>).status;
    if (typeof v === "number") return v;
  }
  return fallback;
}
function extractMessage(err: unknown, fallback = "Unauthorized"): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return fallback;
}

export async function GET(
  req: NextRequest,
  { params }: { params: { email: string } }
) {
  try {
    assertServiceAuthorized(req, "read");
  } catch (error) {
    const status = extractStatus(error, 401);
    const message = extractMessage(error, "Unauthorized");
    return NextResponse.json({ message }, { status });
  }

  const email = decodeURIComponent(params.email);

  // DB call + error handling (no `any` here either)
  try {
    const user = await userService.getProfile(email);
    if (!user) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }
    return NextResponse.json(user, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Internal Server Error";
    // Log the original object for server debugging; message is safe for client
    console.error("[user/[email]] getProfile failed:", error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}