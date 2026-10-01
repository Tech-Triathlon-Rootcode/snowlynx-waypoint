import Link from "next/link";
import { PageHeading } from "@/components/page-heading";
import { StatusBadge } from "@/components/status-badge";
import { WorkflowSpine } from "@/components/workflow-spine";
import { checkLoadedOrderAction } from "@/features/loading/actions";
import { getLoadingState, getPrimaryTrip, getTripOrders } from "@/lib/queries";

export default async function LoadingPage() {
  const trip = await getPrimaryTrip();
  if (!trip) return <><PageHeading title="Loading checklist" description="No trip is available for this delivery day." /></>;
  const [tripOrders, state] = await Promise.all([getTripOrders(trip.id), getLoadingState(trip.id, trip.manifestVersion)]);
  const checked = new Set(state.checks.map((check) => check.orderId));
  const open = trip.status === "PUBLISHED";
  return <>
    <WorkflowSpine active="Load" />
    <PageHeading title="Loading checklist" description="Load the last stop first and check the current manifest version." actions={<Link className="btn" href="/loader/handoff">Open issues & handoff</Link>} />
    <div className={open ? "banner green" : "banner"}><strong>{open ? `Manifest version ${trip.manifestVersion} is ready.` : `Trip is ${trip.status.toLowerCase()}.`}</strong> {open ? "Only checks against this version count toward departure." : "Dispatch must publish before loading can begin."}</div>
    <div className="stats"><div className="stat"><strong>{trip.vehicleId}</strong><span>{trip.vehicleTemperature} {trip.vehicleType}</span></div><div className="stat"><strong>{tripOrders.length}</strong><span>manifest items</span></div><div className="stat"><strong>{checked.size}/{tripOrders.length}</strong><span>checked at version {trip.manifestVersion}</span></div><div className="stat"><strong>{trip.departureTime.slice(0,5)}</strong><span>planned departure</span></div></div>
    <section className="card"><div className="card-head"><div><h2>Load sequence</h2><p className="muted tiny">Delivery order is reversed for accessible unloading.</p></div><StatusBadge status={trip.status} /></div><div className="list">{[...tripOrders].reverse().map((order, index) => <div className="list-row" key={order.id}><div><p className="eyebrow">Load {index + 1} · Delivery stop {order.stopSequence}</p><strong>{order.id} · {order.outletId}</strong><p className="muted tiny">{order.loadedUnits ?? order.handlingUnits} units · {order.weightKg} kg · {order.temperature}{order.shortfallReason ? ` · revised: ${order.shortfallReason}` : ""}</p></div>{checked.has(order.id) ? <span className="badge green">Checked</span> : <form action={checkLoadedOrderAction}><input type="hidden" name="tripId" value={trip.id} /><input type="hidden" name="orderId" value={order.id} /><input type="hidden" name="manifestVersion" value={trip.manifestVersion} /><button className="btn small primary" disabled={!open}>Check loaded</button></form>}</div>)}</div></section>
  </>;
}
