import { Notice } from "@/components/notice";
import { PageHeading } from "@/components/page-heading";
import { StatusBadge } from "@/components/status-badge";
import { WorkflowSpine } from "@/components/workflow-spine";
import { releaseTripAction, reportLoadingIssueAction } from "@/features/loading/actions";
import { getLoadingState, getPrimaryTrip, getTripOrders } from "@/lib/queries";
import { requireUser } from "@/lib/auth";

type Search = Promise<{ notice?: string; error?: string }>;
export default async function HandoffPage({ searchParams }: { searchParams: Search }) {
  const search = await searchParams;
  const user = await requireUser("loader");
  const trip = await getPrimaryTrip({ depot: user.scopeId });
  if (!trip) return <PageHeading title="Issues & handoff" description="No trip is available." />;
  const [tripOrders, state] = await Promise.all([getTripOrders(trip.id), getLoadingState(trip.id, trip.manifestVersion)]);
  const unresolved = state.issues.filter((issue) => !issue.resolved);
  const ready = trip.status === "PUBLISHED" && unresolved.length === 0 && state.checks.length === tripOrders.length;
  return <>
    <WorkflowSpine active="Load" />
    <PageHeading title="Issues & handoff" description="Report actual loaded quantities before the vehicle leaves." />
    <Notice notice={search.notice} error={search.error} />
    <div className="grid two">
      <div className="stack">
        <section className="card"><div className="card-head"><h2>Report a loading discrepancy</h2><span className="badge orange">Blocks departure</span></div><div className="card-pad"><form className="form-stack" action={reportLoadingIssueAction}><input type="hidden" name="tripId" value={trip.id} /><label>Manifest order<select name="orderId">{tripOrders.map((order) => <option key={order.id} value={order.id}>{order.id} · expected {order.handlingUnits} units</option>)}</select></label><label>Actual quantity<input type="number" name="actualUnits" min="0" step="1" placeholder="Enter the counted quantity" required /></label><label>Reason<textarea name="reason" placeholder="Describe the observed discrepancy" required /></label><button className="btn full">Send issue to dispatch</button></form></div></section>
        <section className="card"><div className="card-head"><h2>Issue history</h2><span className="badge">{state.issues.length}</span></div>{state.issues.length ? <div className="list">{state.issues.map((issue) => <div className="list-row" key={issue.id}><div><strong>{issue.orderId} · {issue.actualUnits} units</strong><p className="muted tiny">{issue.reason}</p></div><span className={`badge ${issue.resolved ? "green" : "orange"}`}>{issue.resolved ? "Approved" : "Awaiting dispatch"}</span></div>)}</div> : <div className="empty">No discrepancies reported.</div>}</section>
      </div>
      <aside className="stack"><section className="card"><div className="card-pad"><p className="eyebrow">Departure gate</p><h2>Manifest version {trip.manifestVersion}</h2><div className="check-list" style={{margin:"20px 0"}}><div className={`check-item ${unresolved.length ? "failed" : ""}`}><span className="check-icon">{unresolved.length ? "!" : "✓"}</span><span><strong>Loading issues resolved</strong><span>{unresolved.length} awaiting dispatcher review</span></span></div><div className={`check-item ${state.checks.length !== tripOrders.length ? "failed" : ""}`}><span className="check-icon">{state.checks.length === tripOrders.length ? "✓" : "!"}</span><span><strong>Every item checked</strong><span>{state.checks.length} of {tripOrders.length} checked</span></span></div></div><form action={releaseTripAction}><input type="hidden" name="tripId" value={trip.id} /><button className="btn primary full" disabled={!ready}>Confirm loading complete</button></form></div></section><section className="card"><div className="card-pad"><h3>Current state</h3><p><StatusBadge status={trip.status} /></p><p className="muted tiny">A manifest revision resets the affected item so the loader explicitly acknowledges the new quantity.</p></div></section></aside>
    </div>
  </>;
}
