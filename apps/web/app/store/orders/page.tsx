import Link from "next/link";
import { eq } from "drizzle-orm";
import { auditEvents, getDb } from "@snowlynx/db";
import { Notice } from "@/components/notice";
import { PageHeading } from "@/components/page-heading";
import { StatusBadge } from "@/components/status-badge";
import { WorkflowSpine } from "@/components/workflow-spine";
import { requireUser } from "@/lib/auth";
import { listOrders } from "@/lib/queries";

type Search = Promise<{ notice?: string; error?: string }>;
export default async function StoreOrdersPage({ searchParams }: { searchParams: Search }) {
  const [search, user, allOrders] = await Promise.all([searchParams, requireUser("manager"), listOrders()]);
  const orderRows = allOrders.filter((order) => order.outletId === user.scopeId);
  const events = orderRows.length ? await getDb().select().from(auditEvents).where(eq(auditEvents.orderId, orderRows[0].id)) : [];
  return <>
    <WorkflowSpine active="Order" />
    <PageHeading eyebrow="Saturday 27 June 2026 · OUT001" title="My orders" description="See confirmed information, visible deferrals, and synchronized delivery records." actions={<Link className="btn primary" href="/store/new">Place an order</Link>} />
    <Notice notice={search.notice} error={search.error} />
    <div className="grid two"><div className="stack">{orderRows.length ? orderRows.map((order) => <section className="card" key={order.id}><div className="card-head"><div><p className="eyebrow">{order.id}</p><h2>{order.brand} · {order.outletId}</h2></div><StatusBadge status={order.status} /></div><div className="card-pad"><div className="record-facts"><div><dt>Requested</dt><dd>{order.handlingUnits} units</dd></div><div><dt>Temperature</dt><dd>{order.temperature}</dd></div><div><dt>Delivery window</dt><dd>{order.windowOpen.slice(0,5)}–{order.windowClose.slice(0,5)}</dd></div><div><dt>Expected arrival</dt><dd>{order.plannedArrival?.slice(0,5) ?? "Awaiting plan"}</dd></div></div>{order.deferralReason ? <div className="banner" style={{marginTop:16}}><strong>Deferred.</strong> {order.deferralReason}. Proposed next run: {order.nextRun}.</div> : null}{order.shortfallReason ? <div className="banner" style={{marginTop:16}}><strong>Quantity changed during loading.</strong> {order.loadedUnits} of {order.handlingUnits} units are on the vehicle. {order.shortfallReason}</div> : null}{["DELIVERED","PARTIAL"].includes(order.status) ? <Link className="btn primary" style={{marginTop:16}} href={`/store/receipt?order=${order.id}`}>Confirm receipt</Link> : null}</div></section>) : <div className="card empty">No orders exist for this outlet.</div>}</div><aside className="stack"><section className="card"><div className="card-pad"><p className="eyebrow">How updates work</p><h2>Confirmed information stays visible</h2><p>Driver updates appear only after synchronization. If coverage drops, this page keeps the last shared status instead of claiming the delivery is complete.</p></div></section><section className="card"><div className="card-head"><h2>Latest history</h2></div><div className="list">{events.slice(0,6).map((event) => <div className="list-row" key={event.id}><div><strong>{event.summary}</strong><p className="muted tiny">{event.createdAt.toLocaleString("en-LK")}</p></div></div>)}</div></section></aside></div>
  </>;
}
