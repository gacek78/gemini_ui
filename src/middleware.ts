import NextAuth from "next-auth"
import { authConfig } from "./auth.config"

const { auth } = NextAuth(authConfig)

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const { pathname } = req.nextUrl;

  // Przekieruj jeśli nie zalogowany i nie na stronie logowania
  if (!isLoggedIn && !pathname.includes("/api/auth")) {
      return Response.redirect(new URL("/api/auth/signin", req.nextUrl));
  }
  return null;
});

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
}
