"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import type { Role } from "@snowlynx/domain";
import type { SessionUser } from "@/lib/auth";
import { logoutAction } from "@/app/login/actions";

const nav: Record<Role, Array<[string, string, string]>> = {
  dispatcher: [
    ["Order queue", "/dispatcher/orders", "01"],
    ["Plan & allocate", "/dispatcher/plan", "02"],
    ["Delivery progress", "/dispatcher/progress", "03"],
    ["Capacity outlook", "/dispatcher/capacity", "04"],
  ],
  loader: [
    ["Loading checklist", "/loader/loading", "01"],
    ["Issues & handoff", "/loader/handoff", "02"],
  ],
  driver: [
    ["My route", "/driver/route", "01"],
    ["Saved deliveries", "/driver/proof", "02"],
  ],
  manager: [
    ["My orders", "/store/orders", "01"],
    ["Place an order", "/store/new", "02"],
    ["Confirm receipt", "/store/receipt", "03"],
  ],
};

export function AppShell({ user, children }: { user: SessionUser; children: ReactNode }) {
  const current = usePathname();
  return (
    <div className="shell">
      <aside className="sidebar">
        <Link className="brand" href={user.role === "manager" ? "/store/orders" : `/${user.role}`}>
          <span className="brand-mark">W</span>
          <span>waypoint<small>Delivery operations</small></span>
        </Link>
        <p className="role-label">{user.role === "manager" ? "Store manager" : user.role} workspace</p>
        <nav aria-label={`${user.role} navigation`}>
          {nav[user.role].map(([label, href, step]) => (
            <Link key={href} href={href} className={current === href ? "active" : ""}>
              <span aria-hidden="true">{step}</span>{label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="date-card"><small>Saturday delivery run</small><strong>27 June 2026</strong></div>
          <div className="network-note">120 outlets · 60 vehicles<br />Peliyagoda & Kandy</div>
          <div className="user-card">
            <span className="avatar">{user.name.slice(0, 1)}</span>
            <span><strong>{user.name}</strong><small>{user.email}</small></span>
          </div>
          <form action={logoutAction}><button className="link-button">Sign out</button></form>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div><span className="crumb">Operations</span><strong>{nav[user.role].find(([, href]) => href === current)?.[0] ?? "Waypoint"}</strong></div>
          <span className="connection"><i /> Last confirmed updates</span>
        </header>
        <main id="main" className="content">{children}</main>
      </div>
    </div>
  );
}
