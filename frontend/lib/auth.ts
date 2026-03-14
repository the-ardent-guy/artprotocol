import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { redirect } from "next/navigation";

export async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (session.user.role !== "admin") redirect("/portal");
  return session;
}

export async function requireAuth() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  return session;
}

export async function requireClientAccess(clientName: string) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (session.user.role === "admin") return session;
  if (session.user.clientName !== clientName) redirect("/portal");
  return session;
}
