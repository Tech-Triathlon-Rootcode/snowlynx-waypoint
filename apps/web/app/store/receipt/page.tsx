import { Notice } from "@/components/notice";
import { PageHeading } from "@/components/page-heading";
import { WorkflowSpine } from "@/components/workflow-spine";
import { confirmReceiptAction } from "@/features/orders/actions";
import { requireUser } from "@/lib/auth";
import { listOrders } from "@/lib/queries";

type Search = Promise<{ order?: string; error?: string }>;
export default async function ReceiptPage({ searchParams }: { searchParams: Search }) {
  const [search, user, allOrders] = await Promise.all([searchParams, requireUser("manager"), listOrders()]);
  const candidates = allOrders.filter((order) => order.outletId === user.scopeId && ["DELIVERED", "PARTIAL"].includes(order.status));
  const selected = candidates.find((order) => order.id === search.order) ?? candidates[0];
  return <><WorkflowSpine active="Receipt" /><PageHeading title="Confirm what arrived" description="Keep the store’s account separate from the driver’s evidence." /><Notice error={search.error} />{selected ? <div className="grid two"><section className="card"><div className="card-head"><div><p className="eyebrow">{selected.id} · {selected.outletId}</p><h2>Driver recorded {selected.deliveredUnits} units</h2></div><span className="badge green">Synchronized</span></div><div className="card-pad"><form className="form-stack" action={confirmReceiptAction}><input type="hidden" name="orderId" value={selected.id} /><label>Actual units received<input type="number" name="quantity" min="0" step="1" defaultValue={selected.deliveredUnits ?? 0} required /></label><label>Issue or discrepancy optional<textarea name="issue" placeholder="Describe damage, missing units or another issue" /></label><p className="muted tiny">Explain any difference from the driver’s quantity.</p><button className="btn primary full">Confirm receipt</button></form></div></section><aside className="card"><div className="card-pad"><h2>Both records are retained</h2><p>Your receipt does not overwrite driver proof. A discrepancy becomes a dispatcher follow-up item with both quantities intact.</p></div></aside></div> : <section className="card empty"><h2>Waiting for a delivery record</h2><p>No synchronized delivery at this outlet awaits confirmation.</p></section>}</>;
}
