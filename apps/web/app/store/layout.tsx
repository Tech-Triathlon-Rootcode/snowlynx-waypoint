import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth";

export default async function StoreLayout({ children }: { children: ReactNode }) {
  const user = await requireUser("manager");
  return <AppShell user={user}>{children}</AppShell>;
}
