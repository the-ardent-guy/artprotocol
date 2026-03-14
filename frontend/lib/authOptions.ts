import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import path from "path";
import fs from "fs";

declare module "next-auth" {
  interface User {
    role: "admin" | "client";
    clientName?: string;
  }
  interface Session {
    user: {
      id: string;
      name: string;
      email?: string | null;
      role: "admin" | "client";
      clientName?: string;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: "admin" | "client";
    clientName?: string;
  }
}

async function findClientByCredentials(
  username: string,
  password: string
): Promise<{ name: string } | null> {
  const clientsDir =
    process.env.CLIENTS_FS_PATH ||
    path.join(process.cwd(), "..", "clients");

  if (!fs.existsSync(clientsDir)) return null;

  const folders = fs.readdirSync(clientsDir);
  for (const folder of folders) {
    const credsPath = path.join(clientsDir, folder, "credentials.json");
    if (!fs.existsSync(credsPath)) continue;
    try {
      const creds = JSON.parse(fs.readFileSync(credsPath, "utf-8"));
      if (
        creds.username === username &&
        creds.password === password &&
        creds.password !== ""
      ) {
        return { name: folder };
      }
    } catch {
      continue;
    }
  }
  return null;
}

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null;
        const { username, password } = credentials;

        if (
          username === process.env.ADMIN_USERNAME &&
          password === process.env.ADMIN_PASSWORD
        ) {
          return { id: "admin", name: "Admin", role: "admin" as const };
        }

        const client = await findClientByCredentials(username, password);
        if (client) {
          return {
            id:         client.name,
            name:       client.name.replace(/_/g, " "),
            role:       "client" as const,
            clientName: client.name,
          };
        }
        return null;
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role       = user.role;
        token.clientName = user.clientName;
      }
      return token;
    },
    session({ session, token }) {
      session.user.role       = token.role;
      session.user.clientName = token.clientName;
      return session;
    },
  },
};
