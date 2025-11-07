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

type Params = { email: string };
type Ctx = { params: Promise<Params> }; 

export async function GET(req: NextRequest, context: Ctx) {
  // 1) Auth first
  try {
    assertServiceAuthorized(req, "read");
  } catch (error) {
    const status = extractStatus(error, 401);
    const message = extractMessage(error, "Unauthorized");
    return NextResponse.json({ message }, { status });
  }

  // 2) Await params, then decode
  const { email } = await context.params; 
  const decodedEmail = decodeURIComponent(email);

  // 3) DB call + error handling
  try {
    const user = await userService.getProfile(decodedEmail);
    if (!user) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }
    return NextResponse.json(user, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Internal Server Error";
    console.error("[user/[email]] getProfile failed:", error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
