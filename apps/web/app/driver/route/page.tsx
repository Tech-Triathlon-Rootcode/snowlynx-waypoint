import { Notice } from "@/components/notice";
import { PageHeading } from "@/components/page-heading";
import { StatusBadge } from "@/components/status-badge";
import { WorkflowSpine } from "@/components/workflow-spine";
import { startTripAction } from "@/features/delivery/actions";
import { DriverWorkspace } from "@/features/delivery/driver-workspace";
import { getPrimaryTrip, getTripOrders } from "@/lib/queries";
import { requireUser } from "@/lib/auth";

type Search = Promise<{ notice?: string; error?: string }>;
export default async function DriverRoutePage({ searchParams }: { searchParams: Search }) {
  const [search, user] = await Promise.all([searchParams, requireUser("driver")]);
  const trip = await getPrimaryTrip({ vehicleId: user.scopeId });
  if (!trip) return <PageHeading title="My route" description="No route is assigned." />;
  const tripOrders = await getTripOrders(trip.id);
  return <>
    <WorkflowSpine active="Deliver" />
    <PageHeading title="My route" description="Keep the current manifest and stop instructions available while safely stopped." actions={<StatusBadge status={trip.status} />} />
    <Notice notice={search.notice} error={search.error} />
    {trip.status === "READY" ? <section className="card"><div className="card-pad"><p className="eyebrow">Approved manifest · version {trip.manifestVersion}</p><h2>{trip.vehicleId} is ready to leave</h2><p>Download the route while connected. It will remain on this device if coverage drops.</p><div className="record-facts"><div><dt>Stops</dt><dd>{tripOrders.length}</dd></div><div><dt>Departure</dt><dd>{trip.departureTime.slice(0,5)}</dd></div><div><dt>Distance</dt><dd>{trip.distanceKm} km</dd></div><div><dt>Manifest</dt><dd>Version {trip.manifestVersion}</dd></div></div><form action={startTripAction} style={{marginTop:20}}><input type="hidden" name="tripId" value={trip.id} /><button className="btn primary">Download and start route</button></form></div></section> : trip.status === "STARTED" || trip.status === "COMPLETED" ? <DriverWorkspace tripId={trip.id} manifestVersion={trip.manifestVersion} orders={tripOrders} /> : <div className="banner"><strong>Route not released.</strong> Dispatch publishes the manifest, then loading checks and hands it off.</div>}
  </>;
}
