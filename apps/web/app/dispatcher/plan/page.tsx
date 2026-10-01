import Link from "next/link";
import { Notice } from "@/components/notice";
import { PageHeading } from "@/components/page-heading";
import { StatusBadge } from "@/components/status-badge";
import { WorkflowSpine } from "@/components/workflow-spine";
import { DEMO_DATE, getPrimaryTrip, listOrders, listVehicles } from "@/lib/queries";
import { assignOrderAction, deferOrderAction, publishTripAction } from "@/features/planning/actions";
import { evaluateAssignment } from "@/features/planning/service";

type Search = Promise<{ order?: string; notice?: string; error?: string }>;

export default async function DispatcherPlanPage({ searchParams }: { searchParams: Search }) {
  const search = await searchParams;
  const [orderRows, vehicleRows, primaryTrip] = await Promise.all([listOrders(), listVehicles(), getPrimaryTrip()]);
  const selectedId = search.order && orderRows.some((row) => row.id === search.order) ? search.order : "ORD-2701";
  const selected = orderRows.find((row) => row.id === selectedId) ?? orderRows[0];
  const preview = selected ? await evaluateAssignment(selected.id, "VEH035", 1, selected.id === "ORD-2701" ? "05:20" : selected.windowOpen.slice(0,5), 42).catch(() => null) : null;
  const confirmed = orderRows.filter((order) => ["CONFIRMED", "ALLOCATED", "DEFERRED"].includes(order.status));
  return <>
    <WorkflowSpine active="Assign" />
    <PageHeading title="Plan & allocate" description="Match confirmed demand to available capacity with every decision explained." actions={primaryTrip ? <form action={publishTripAction}><input type="hidden" name="tripId" value={primaryTrip.id} /><button className="btn primary" disabled={primaryTrip.status !== "DRAFT"}>{primaryTrip.status === "DRAFT" ? "Publish VEH035 trip" : `Manifest ${primaryTrip.status.toLowerCase()}`}</button></form> : null} />
    <Notice notice={search.notice} error={search.error} />
    <div className="stats">
      <div className="stat"><strong>{confirmed.filter((order) => order.status === "CONFIRMED").length}</strong><span>ready to plan</span></div>
      <div className="stat"><strong>{confirmed.filter((order) => order.status === "ALLOCATED").length}</strong><span>allocated</span></div>
      <div className="stat"><strong>{orderRows.filter((order) => order.tripId === primaryTrip?.id).reduce((sum, order) => sum + order.weightKg, 0)}</strong><span>kg on VEH035 trip 1</span></div>
      <div className="stat"><strong>{confirmed.filter((order) => order.status === "DEFERRED").length}</strong><span>deferred</span></div>
    </div>
    <div className="banner"><strong>Protect outlets missed last time.</strong> Deferral history stays beside each order; published manifests cannot be silently changed.</div>
    <div className="grid two">
      <section className="card">
        <div className="card-head"><h2>Orders to plan</h2><span className="badge">{confirmed.length} orders</span></div>
        <div className="table-wrap"><table><thead><tr><th>Order</th><th>Requirements</th><th>Load</th><th>Window</th><th /></tr></thead><tbody>
          {confirmed.map((order) => <tr key={order.id} className={order.id === selected.id ? "selected" : ""}><td><strong>{order.id}</strong><small>{order.outletId} · {order.brand}</small>{order.priorDeferrals ? <span className="badge orange">{order.priorDeferrals} prior</span> : null}</td><td><strong>{order.temperature}</strong><small>{order.parkingConstraint.replaceAll("_", " ")}</small></td><td><strong>{order.weightKg} kg</strong><small>{order.volumeM3} m³ · {order.handlingUnits} units</small></td><td>{order.windowOpen.slice(0,5)}–{order.windowClose.slice(0,5)}</td><td><Link className="btn small" href={`/dispatcher/plan?order=${order.id}`}>{order.id === selected.id ? "Selected" : "Select"}</Link></td></tr>)}
        </tbody></table></div>
      </section>
      <aside className="stack">
        <section className="card"><div className="card-pad"><div className="actions" style={{justifyContent:"space-between"}}><div><p className="eyebrow">Assignment details</p><h2>{selected.id} · {selected.outletId}</h2><p className="muted tiny">{selected.brand} · {selected.district} · {selected.dockType}</p></div><StatusBadge status={selected.status} /></div>
          <form className="form-stack" action={assignOrderAction}>
            <input type="hidden" name="orderId" value={selected.id} />
            <label>Vehicle<select name="vehicleId" defaultValue="VEH035">{vehicleRows.filter((vehicle) => vehicle.depot === selected.depot).map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.id} · {vehicle.temperature} {vehicle.type}</option>)}</select></label>
            <div className="field-grid"><label>Trip<select name="tripNumber" defaultValue="1"><option value="1">Trip 1</option><option value="2">Trip 2</option></select></label><label>Planned arrival<input name="plannedArrival" type="time" defaultValue={selected.id === "ORD-2701" ? "05:20" : selected.windowOpen.slice(0,5)} required /></label></div>
            <label>Total trip distance<input name="distanceKm" type="number" min="1" step="0.1" defaultValue="42" required /></label>
            <button className="btn primary full">Allocate {selected.id}</button>
          </form>
        </div></section>
        {preview ? <section className="card"><div className="card-pad"><div className="actions" style={{justifyContent:"space-between"}}><h3>Assignment checks</h3><span className={`badge ${preview.result.valid ? "green" : "red"}`}>{preview.result.valid ? "All checks pass" : "Blocked"}</span></div><div className="check-list" style={{marginTop:16}}>{preview.result.checks.map((check) => <div key={check.key} className={`check-item ${check.passed ? "" : "failed"}`}><span className="check-icon">{check.passed ? "✓" : "!"}</span><span><strong>{check.label}</strong><span>{check.detail}</span></span></div>)}</div></div></section> : null}
        <section className="card"><div className="card-pad"><h3>Defer with a reason</h3><form className="form-stack" action={deferOrderAction}><input type="hidden" name="orderId" value={selected.id} /><label>Reason visible to the store<textarea name="reason" defaultValue="No feasible capacity remains after higher-priority delivery windows." required /></label><label>Next planned run<input type="date" name="nextRun" min="2026-06-28" defaultValue="2026-06-29" required /></label><button className="btn full">Defer {selected.id}</button></form></div></section>
      </aside>
    </div>
  </>;
}
