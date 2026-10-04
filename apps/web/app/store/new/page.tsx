import { PageHeading } from "@/components/page-heading";
import { Notice } from "@/components/notice";
import { WorkflowSpine } from "@/components/workflow-spine";
import { createOrderAction } from "@/features/orders/actions";
import { requireUser } from "@/lib/auth";
import { DEMO_DATE } from "@/lib/queries";
import { formatDeliveryDate } from "@/lib/dates";

type Search = Promise<{ error?: string }>;
export default async function NewOrderPage({ searchParams }: { searchParams: Search }) {
  const [search, user] = await Promise.all([searchParams, requireUser("manager")]);
  return <><WorkflowSpine active="Order" /><PageHeading eyebrow={`Requested delivery · ${formatDeliveryDate(DEMO_DATE)}`} title="Place an order" description="Receive a clear reference immediately, including after-cutoff behavior." /><Notice error={search.error} /><div className="grid two"><section className="card"><div className="card-pad"><form className="form-stack" action={createOrderAction}><label>Outlet<input name="outletId" value={user.scopeId ?? ""} readOnly required /></label><label>Goods type<select name="temperature" defaultValue="" required><option value="" disabled>Select the goods type</option><option value="ambient">Ambient goods</option><option value="chilled">Chilled goods</option></select></label><div className="field-grid"><label>Weight (kg)<input type="number" name="weightKg" min="0.1" step="0.1" placeholder="Enter total weight" required /></label><label>Volume (m³)<input type="number" name="volumeM3" min="0.1" step="0.1" placeholder="Enter total volume" required /></label></div><div className="field-grid"><label>Handling units<input type="number" name="handlingUnits" min="1" step="1" placeholder="Enter unit count" required /></label><label>Order time<input type="time" name="orderTime" required /></label></div><button className="btn primary full">Submit order</button></form></div></section><aside className="card"><div className="card-pad"><p className="eyebrow">Before you submit</p><h2>Friday cutoff: 16:00</h2><p>Orders received later move to the following operating run.</p><ul><li>Chilled goods require a refrigerated vehicle.</li><li>Fresh dry and chilled goods should be separate orders.</li><li>The confirmation reference appears immediately.</li></ul></div></aside></div></>;
}
