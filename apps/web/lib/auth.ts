import "server-only";
import { compare } from "bcryptjs";
import { eq } from "drizzle-orm";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb, users } from "@snowlynx/db";
import type { Role } from "@snowlynx/domain";

const COOKIE_NAME = "waypoint_session";

function secret(): Uint8Array {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) throw new Error("SESSION_SECRET must contain at least 32 characters.");
  return new TextEncoder().encode(value);
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  scopeId: string | null;
}

export async function authenticate(email: string, password: string): Promise<SessionUser | null> {
  const [record] = await getDb().select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
  if (!record || !(await compare(password, record.passwordHash))) return null;
  return { id: record.id, email: record.email, name: record.name, role: record.role as Role, scopeId: record.scopeId };
}

export async function createSession(user: SessionUser): Promise<void> {
  const token = await new SignJWT({ email: user.email, name: user.name, role: user.role, scopeId: user.scopeId })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(secret());
  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
}

export async function clearSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}

export async function getSession(): Promise<SessionUser | null> {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const verified = await jwtVerify(token, secret());
    if (!verified.payload.sub) return null;
    return {
      id: verified.payload.sub,
      email: String(verified.payload.email),
      name: String(verified.payload.name),
      role: verified.payload.role as Role,
      scopeId: verified.payload.scopeId ? String(verified.payload.scopeId) : null,
    };
  } catch {
    return null;
  }
}

export async function requireUser(role?: Role): Promise<SessionUser> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (role && session.role !== role) redirect(`/${session.role === "manager" ? "store" : session.role}`);
  return session;
}

export function homeForRole(role: Role): string {
  return role === "manager" ? "/store/orders" : `/${role}${role === "dispatcher" ? "/plan" : role === "loader" ? "/loading" : "/route"}`;
}
