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
    ...authConfig.providers.filter(p => (p as { id?: string }).id !== "credentials"),
    Credentials({
        name: "Test Login",
        credentials: {
          email: { label: "Email", type: "email", placeholder: "test@example.com" },
        },
        async authorize(credentials: Partial<Record<"email", unknown>>) {
          if (credentials?.email === "test@example.com" || credentials?.email === "gacek78@gmail.com") {
            const email = String(credentials.email);
            let user = await prisma.user.findUnique({ where: { email } });
            if (!user) {
              user = await prisma.user.create({
                data: { 
                  email, 
                  name: email === "gacek78@gmail.com" ? "Gacek" : "Tester" 
                },
              });
            }
            return user;
          }
          return null;
        },
    }),
  ],
})
