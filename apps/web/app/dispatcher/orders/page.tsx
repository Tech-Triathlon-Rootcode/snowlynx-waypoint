import Link from "next/link";
import { PageHeading } from "@/components/page-heading";
import { StatusBadge } from "@/components/status-badge";
import { WorkflowSpine } from "@/components/workflow-spine";
import { listOrders } from "@/lib/queries";

export default async function DispatcherOrdersPage() {
  const orderRows = await listOrders();
  return <>
    <WorkflowSpine active="Queue" />
    <PageHeading title="Order queue" description="Confirmed demand is ready for review after the 16:00 cutoff." actions={<Link className="btn primary" href="/dispatcher/plan">Open planning</Link>} />
    <div className="stats">
      <div className="stat"><strong>{orderRows.length}</strong><span>orders in the seeded day</span></div>
      <div className="stat"><strong>{orderRows.filter((order) => order.status === "CONFIRMED").length}</strong><span>awaiting assignment</span></div>
      <div className="stat"><strong>{orderRows.filter((order) => order.temperature === "chilled").length}</strong><span>refrigerated loads</span></div>
      <div className="stat"><strong>{orderRows.filter((order) => order.priorDeferrals > 0).length}</strong><span>previously deferred</span></div>
    </div>
    <section className="card">
      <div className="card-head"><div><h2>Confirmed demand</h2><p className="muted tiny">Shared records from the 120-outlet network</p></div><span className="badge blue">Fresh installation</span></div>
      <div className="table-wrap"><table><thead><tr><th>Order / outlet</th><th>Requirements</th><th>Load</th><th>Window</th><th>Status</th><th /></tr></thead><tbody>
        {orderRows.map((order) => <tr key={order.id}>
          <td><strong>{order.id}</strong><small>{order.outletId} · {order.brand} · {order.district}</small>{order.priorDeferrals ? <span className="badge orange">{order.priorDeferrals} prior deferral{order.priorDeferrals > 1 ? "s" : ""}</span> : null}</td>
          <td><strong>{order.temperature}</strong><small>{order.parkingConstraint.replaceAll("_", " ")}</small></td>
          <td><strong>{order.weightKg.toLocaleString()} kg</strong><small>{order.volumeM3} m³ · {order.handlingUnits} units</small></td>
          <td>{order.windowOpen.slice(0,5)}–{order.windowClose.slice(0,5)}</td>
          <td><StatusBadge status={order.status} /></td>
          <td><Link className="btn small" href={`/dispatcher/plan?order=${order.id}`}>Review</Link></td>
        </tr>)}
      </tbody></table></div>
    </section>
  </>;
}
