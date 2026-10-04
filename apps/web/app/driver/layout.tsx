import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { ServiceWorkerRegistration } from "@/components/service-worker";
import { requireUser } from "@/lib/auth";
import { DEMO_DATE, getNetworkCounts } from "@/lib/queries";

export default async function DriverLayout({ children }: { children: ReactNode }) {
  const user = await requireUser("driver");
  const network = await getNetworkCounts();
  return <AppShell user={user} deliveryDate={DEMO_DATE} network={network}><ServiceWorkerRegistration />{children}</AppShell>;
}
