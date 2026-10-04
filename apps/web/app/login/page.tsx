import { redirect } from "next/navigation";
import { getSession, homeForRole } from "@/lib/auth";
import { LoginForm } from "./login-form";
import { listLoginAccounts } from "@/lib/queries";

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect(homeForRole(session.role));
  const accounts = await listLoginAccounts();
  return <LoginForm accounts={accounts} />;
}
