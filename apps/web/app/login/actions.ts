"use server";

import { redirect } from "next/navigation";
import { authenticate, clearSession, createSession, homeForRole } from "@/lib/auth";

export interface LoginState { error?: string }

export async function loginAction(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const user = await authenticate(email, password);
  if (!user) return { error: "Email or password is incorrect." };
  await createSession(user);
  redirect(homeForRole(user.role));
}

export async function logoutAction() {
  await clearSession();
  redirect("/login");
}
