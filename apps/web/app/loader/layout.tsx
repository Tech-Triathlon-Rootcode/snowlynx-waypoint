import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth";
import { DEMO_DATE, getNetworkCounts } from "@/lib/queries";

export default async function LoaderLayout({ children }: { children: ReactNode }) {
  const user = await requireUser("loader");
  const network = await getNetworkCounts();
  return <AppShell user={user} deliveryDate={DEMO_DATE} network={network}>{children}</AppShell>;
}
