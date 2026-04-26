import { NextResponse, type NextRequest } from "next/server";

const protectedPrefixes = [
  "/account",
  "/api-keys",
  "/calendar",
  "/cook",
  "/family",
  "/household",
  "/import",
  "/ingredients",
  "/ops",
  "/rejected-meals",
  "/setup",
  "/weeks",
];

export function middleware(request: NextRequest) {
  const isProtected = protectedPrefixes.some((prefix) =>
    request.nextUrl.pathname.startsWith(prefix),
  );

  if (!isProtected || request.cookies.has("kitchenalmanac_session")) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set(
    "returnTo",
    `${request.nextUrl.pathname}${request.nextUrl.search}`,
  );

  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/api-keys/:path*",
    "/account/:path*",
    "/calendar/:path*",
    "/cook/:path*",
    "/family/:path*",
    "/household/:path*",
    "/import/:path*",
    "/ingredients/:path*",
    "/ops/:path*",
    "/rejected-meals/:path*",
    "/setup/:path*",
    "/weeks/:path*",
  ],
};
