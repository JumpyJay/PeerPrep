import { NextResponse, NextRequest } from "next/server";

export default function middleware(request: NextRequest) {
  console.log(
    `Request from ${
      request.nextUrl.searchParams.get("ip") ?? "unknown"
    } at ${new Date().toISOString()}`
  );
  return NextResponse.next();
}
