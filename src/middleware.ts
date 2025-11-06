import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const token = request.cookies.get("token");

  // check for token
  if (!token) {
    // redirect to login/signup page
    const loginUrl = new URL("/user", request.url);
    return NextResponse.redirect(loginUrl);
  }

  // token exist continue navigation
  return NextResponse.next();
}

// define matcher
export const config = {
  matcher: [
    /*
     * match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - user (the login/register page itself)
     */
    "/((?!api|_next/static|_next/image|favicon.ico|user).*)",
  ],
};
