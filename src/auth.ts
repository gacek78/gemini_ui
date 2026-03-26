import NextAuth from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/prisma"
import { authConfig } from "./auth.config"
import Credentials from "next-auth/providers/credentials"

// Pelna konfiguracja z adapterem DB (tylko dla Node.js Runtime)
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  providers: [
    ...authConfig.providers.filter(p => (p as any).id !== "credentials"),
    Credentials({
        name: "Test Login",
        credentials: {
          email: { label: "Email", type: "email", placeholder: "test@example.com" },
        },
        async authorize(credentials: any) {
          if (credentials?.email === "test@example.com") {
            let user = await prisma.user.findUnique({ where: { email: "test@example.com" } });
            if (!user) {
              user = await prisma.user.create({
                data: { email: "test@example.com", name: "Tester" },
              });
            }
            return user;
          }
          return null;
        },
    }),
  ],
})
