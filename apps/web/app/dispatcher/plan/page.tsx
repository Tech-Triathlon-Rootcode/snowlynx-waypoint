import Link from "next/link";
import { Notice } from "@/components/notice";
import { PageHeading } from "@/components/page-heading";
import { StatusBadge } from "@/components/status-badge";
import { WorkflowSpine } from "@/components/workflow-spine";
import { getNextOperatingDate, getPrimaryTrip, listOrders, listVehicles } from "@/lib/queries";
import { requireUser } from "@/lib/auth";
import { assignOrderAction, deferOrderAction, publishTripAction } from "@/features/planning/actions";
import { evaluateAssignment } from "@/features/planning/service";

type Search = Promise<{ order?: string; notice?: string; error?: string }>;

export default async function DispatcherPlanPage({ searchParams }: { searchParams: Search }) {
  const search = await searchParams;
  const user = await requireUser("dispatcher");
  const [orderRows, vehicleRows, primaryTrip, nextOperatingDate] = await Promise.all([
    listOrders(),
    listVehicles(),
    getPrimaryTrip({ depot: user.scopeId }),
    getNextOperatingDate(),
  ]);
  const confirmed = orderRows.filter((order) => ["CONFIRMED", "ALLOCATED", "DEFERRED"].includes(order.status));
  const selectedId = search.order && confirmed.some((row) => row.id === search.order)
    ? search.order
    : confirmed.find((order) => order.status === "CONFIRMED")?.id ?? confirmed[0]?.id;
  const selected = confirmed.find((row) => row.id === selectedId) ?? confirmed[0];
  if (!selected) return <PageHeading title="Plan & allocate" description="No confirmed orders are available to plan." />;
  const scopedVehicles = vehicleRows.filter((vehicle) => vehicle.depot === selected.depot);
  const compatibleVehicle = scopedVehicles.find((vehicle) => selected.temperature !== "chilled" || vehicle.temperature === "reefer");
  const defaultVehicleId = selected.vehicleId && scopedVehicles.some((vehicle) => vehicle.id === selected.vehicleId)
    ? selected.vehicleId
    : primaryTrip && scopedVehicles.some((vehicle) => vehicle.id === primaryTrip.vehicleId)
      ? primaryTrip.vehicleId
      : compatibleVehicle?.id ?? scopedVehicles[0]?.id;
  const defaultTripNumber = selected.tripNumber ?? primaryTrip?.tripNumber ?? 1;
  const defaultArrival = selected.plannedArrival?.slice(0, 5) ?? selected.windowOpen.slice(0, 5);
  const defaultDistance = primaryTrip && primaryTrip.vehicleId === defaultVehicleId && primaryTrip.tripNumber === defaultTripNumber
    ? primaryTrip.distanceKm
    : null;
  const preview = defaultVehicleId && defaultDistance
    ? await evaluateAssignment(selected.id, defaultVehicleId, defaultTripNumber, defaultArrival, defaultDistance).catch(() => null)
    : null;
  return <>
    <WorkflowSpine active="Assign" />
    <PageHeading title="Plan & allocate" description="Match confirmed demand to available capacity with every decision explained." actions={primaryTrip ? <form action={publishTripAction}><input type="hidden" name="tripId" value={primaryTrip.id} /><button className="btn primary" disabled={primaryTrip.status !== "DRAFT"}>{primaryTrip.status === "DRAFT" ? `Publish ${primaryTrip.vehicleId} trip ${primaryTrip.tripNumber}` : `Manifest ${primaryTrip.status.toLowerCase()}`}</button></form> : null} />
    <Notice notice={search.notice} error={search.error} />
    <div className="stats">
      <div className="stat"><strong>{confirmed.filter((order) => order.status === "CONFIRMED").length}</strong><span>ready to plan</span></div>
      <div className="stat"><strong>{confirmed.filter((order) => order.status === "ALLOCATED").length}</strong><span>allocated</span></div>
      <div className="stat"><strong>{orderRows.filter((order) => order.tripId === primaryTrip?.id).reduce((sum, order) => sum + order.weightKg, 0)}</strong><span>{primaryTrip ? `kg on ${primaryTrip.vehicleId} trip ${primaryTrip.tripNumber}` : "kg allocated"}</span></div>
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
            <label>Vehicle<select name="vehicleId" defaultValue={defaultVehicleId}>{scopedVehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.id} · {vehicle.temperature} {vehicle.type}</option>)}</select></label>
            <div className="field-grid"><label>Trip<select name="tripNumber" defaultValue={String(defaultTripNumber)}><option value="1">Trip 1</option><option value="2">Trip 2</option></select></label><label>Planned arrival<input name="plannedArrival" type="time" defaultValue={defaultArrival} required /></label></div>
            <label>Total trip distance<input name="distanceKm" type="number" min="1" step="0.1" defaultValue={defaultDistance ?? undefined} placeholder="Enter the planned route distance" required /></label>
            <button className="btn primary full" disabled={!defaultVehicleId}>Allocate {selected.id}</button>
          </form>
        </div></section>
        {preview ? <section className="card"><div className="card-pad"><div className="actions" style={{justifyContent:"space-between"}}><h3>Assignment checks</h3><span className={`badge ${preview.result.valid ? "green" : "red"}`}>{preview.result.valid ? "All checks pass" : "Blocked"}</span></div><div className="check-list" style={{marginTop:16}}>{preview.result.checks.map((check) => <div key={check.key} className={`check-item ${check.passed ? "" : "failed"}`}><span className="check-icon">{check.passed ? "✓" : "!"}</span><span><strong>{check.label}</strong><span>{check.detail}</span></span></div>)}</div></div></section> : null}
        <section className="card"><div className="card-pad"><h3>Defer with a reason</h3><form className="form-stack" action={deferOrderAction}><input type="hidden" name="orderId" value={selected.id} /><label>Reason visible to the store<textarea name="reason" placeholder="Explain the verified operational reason" required /></label><label>Next planned run<input type="date" name="nextRun" min={nextOperatingDate ?? undefined} required /></label><button className="btn full">Defer {selected.id}</button></form></div></section>
      </aside>
    </div>
  </>;
}
