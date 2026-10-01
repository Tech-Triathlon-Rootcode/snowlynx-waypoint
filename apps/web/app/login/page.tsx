import { redirect } from "next/navigation";
import { getSession, homeForRole } from "@/lib/auth";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect(homeForRole(session.role));
  return <LoginForm />;
}
