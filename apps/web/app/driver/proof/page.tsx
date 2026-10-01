import { eq } from "drizzle-orm";
import { deliveryProofs, getDb } from "@snowlynx/db";
import { PageHeading } from "@/components/page-heading";
import { WorkflowSpine } from "@/components/workflow-spine";

export default async function DriverProofPage() {
  const proofs = await getDb().select().from(deliveryProofs).where(eq(deliveryProofs.syncStatus, "SYNCHRONIZED"));
  return <><WorkflowSpine active="Deliver" /><PageHeading title="Saved deliveries" description="Shared proof records use stable references so retries cannot duplicate a stop." /><section className="card"><div className="card-head"><h2>Synchronized evidence</h2><span className="badge green">{proofs.length} shared</span></div>{proofs.length ? <div className="list">{proofs.map((proof) => <div className="list-row" key={proof.id}><div><strong>{proof.orderId} · {proof.quantity} units</strong><p className="muted tiny">{proof.receiverOrReason} · {proof.id}</p></div><span className={`badge ${proof.syncStatus === "SYNCHRONIZED" ? "green" : "orange"}`}>{proof.syncStatus.replaceAll("_", " ")}</span></div>)}</div> : <div className="empty">No delivery proof has synchronized yet. Local records appear on the route screen until they are shared.</div>}</section></>;
}
