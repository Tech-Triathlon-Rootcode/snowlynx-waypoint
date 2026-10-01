import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { ServiceWorkerRegistration } from "@/components/service-worker";
import { requireUser } from "@/lib/auth";

export default async function DriverLayout({ children }: { children: ReactNode }) {
  const user = await requireUser("driver");
  return <AppShell user={user}><ServiceWorkerRegistration />{children}</AppShell>;
}
