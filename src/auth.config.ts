import type { NextAuthConfig } from "next-auth"
import Google from "next-auth/providers/google"
import Credentials from "next-auth/providers/credentials"

// Ta konfiguracja jest kompatybilna z Edge Runtime (nie zawiera Prisma Adaptera)
export const authConfig = {
  providers: [
    Google,
    Credentials({
      name: "Test Login",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "test@example.com" },
      },
      async authorize(credentials) {
        // Ta funkcja jest wymagana przez strukturę, ale faktyczna weryfikacja 
        // i dostęp do bazy danych Prisma odbywa się w pliku auth.ts (Node Runtime).
        return null;
      },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session?.user) {
        (session.user as any).id = token.id as string;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
