import { desc, eq } from "drizzle-orm";
import { deliveryProofs, getDb, loadingIssues } from "@snowlynx/db";
import { Notice } from "@/components/notice";
import { PageHeading } from "@/components/page-heading";
import { StatusBadge } from "@/components/status-badge";
import { WorkflowSpine } from "@/components/workflow-spine";
import { listOrders } from "@/lib/queries";
import { resolveLoadingIssueAction, resolveSyncConflictAction } from "@/features/planning/actions";

type Search = Promise<{ notice?: string; error?: string }>;
export default async function DispatcherProgressPage({ searchParams }: { searchParams: Search }) {
  const [search, orderRows, issues, conflicts] = await Promise.all([
    searchParams,
    listOrders(),
    getDb().select().from(loadingIssues).orderBy(desc(loadingIssues.createdAt)),
    getDb().select().from(deliveryProofs).where(eq(deliveryProofs.syncStatus, "NEEDS_REVIEW")).orderBy(desc(deliveryProofs.createdAt)),
  ]);
  return <>
    <WorkflowSpine active="Deliver" />
    <PageHeading title="Delivery progress" description="Act on exceptions while keeping the last confirmed state visible." />
    <Notice notice={search.notice} error={search.error} />
    {issues.some((issue) => !issue.resolved) ? <div className="banner"><strong>Loading review required.</strong> Approve a documented shortfall before the loader can hand off the route.</div> : null}
    <div className="grid two">
      <section className="card"><div className="card-head"><h2>Delivery route status</h2><span className="badge blue">Confirmed records</span></div><div className="list">{orderRows.filter((order) => order.tripId).map((order) => <div className="list-row" key={order.id}><div><strong>{order.id} · {order.outletId}</strong><p className="muted tiny">{order.vehicleId} · trip {order.tripNumber}{order.shortfallReason ? ` · ${order.shortfallReason}` : ""}</p></div><StatusBadge status={order.status} /></div>)}</div></section>
      <aside className="stack"><section className="card"><div className="card-head"><h2>Loading exceptions</h2><span className="badge orange">{issues.filter((issue) => !issue.resolved).length} open</span></div>{issues.length ? <div className="list">{issues.map((issue) => <div className="list-row" key={issue.id}><div><strong>{issue.orderId}</strong><p className="muted tiny">{issue.actualUnits} units · {issue.reason}</p></div>{issue.resolved ? <span className="badge green">Resolved</span> : <form action={resolveLoadingIssueAction}><input type="hidden" name="issueId" value={issue.id} /><button className="btn small primary">Approve shortfall</button></form>}</div>)}</div> : <div className="empty">No loading exceptions.</div>}</section><section className="card"><div className="card-head"><h2>Synchronization review</h2><span className="badge orange">{conflicts.length} open</span></div>{conflicts.length ? <div className="list">{conflicts.map((proof) => <div className="list-row" key={proof.id}><div><strong>{proof.orderId} · {proof.quantity} units</strong><p className="muted tiny">{proof.conflictReason}</p></div><form action={resolveSyncConflictAction}><input type="hidden" name="proofId" value={proof.id} /><button className="btn small primary">Retain evidence</button></form></div>)}</div> : <div className="empty">No delivery proof needs review.</div>}</section><section className="card"><div className="card-pad"><h2>Evidence ownership</h2><p>Driver delivery evidence and the store receipt remain separate. Quantity differences return here for follow-up rather than overwriting either record.</p></div></section></aside>
    </div>
  </>;
}
