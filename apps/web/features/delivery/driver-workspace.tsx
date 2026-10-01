"use client";

import { openDB } from "idb";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { validateDeliveryRecord, type DeliveryOutcome } from "@snowlynx/domain";

export interface DriverOrder {
  id: string;
  outletId: string;
  brand: string;
  district: string;
  dockType: string;
  parkingConstraint: string;
  windowOpen: string;
  windowClose: string;
  temperature: string;
  handlingUnits: number;
  loadedUnits: number | null;
  status: string;
  stopSequence: number | null;
  revision: number;
  shortfallReason: string | null;
}

interface PendingProof {
  id: string;
  idempotencyKey: string;
  orderId: string;
  baseRevision: number;
  outcome: DeliveryOutcome;
  quantity: number;
  loadedQuantity: number;
  receiverOrReason: string;
  acknowledged: true;
  recordedAt: string;
  photoDataUrl?: string | null;
  syncState: "PENDING" | "NEEDS_REVIEW";
}

async function offlineDb() {
  return openDB("waypoint-offline-v1", 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains("queue")) db.createObjectStore("queue", { keyPath: "idempotencyKey" });
      if (!db.objectStoreNames.contains("routes")) db.createObjectStore("routes", { keyPath: "id" });
    },
  });
}

export function DriverWorkspace({ tripId, manifestVersion, orders }: { tripId: string; manifestVersion: number; orders: DriverOrder[] }) {
  const router = useRouter();
  const [forcedOffline, setForcedOffline] = useState(false);
  const [browserOnline, setBrowserOnline] = useState(true);
  const [selectedId, setSelectedId] = useState(orders.find((order) => order.status === "OUT_FOR_DELIVERY")?.id ?? orders[0]?.id);
  const [pending, setPending] = useState<PendingProof[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const online = browserOnline && !forcedOffline;
  const selected = orders.find((order) => order.id === selectedId) ?? orders[0];

  const refreshPending = async () => setPending(await (await offlineDb()).getAll("queue"));
  useEffect(() => {
    setBrowserOnline(navigator.onLine);
    const onOnline = () => setBrowserOnline(true);
    const onOffline = () => setBrowserOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    offlineDb().then((db) => db.put("routes", { id: tripId, manifestVersion, orders, downloadedAt: new Date().toISOString() })).then(refreshPending);
    return () => { window.removeEventListener("online", onOnline); window.removeEventListener("offline", onOffline); };
  }, [manifestVersion, orders, tripId]);

  const stopCount = useMemo(() => orders.filter((order) => !["OUT_FOR_DELIVERY", "READY"].includes(order.status)).length + pending.length, [orders, pending]);

  async function synchronize() {
    if (!online) { setError("Reconnect before synchronizing saved records."); return; }
    setError(""); setMessage("Synchronizing saved evidence…");
    const db = await offlineDb();
    const records = await db.getAll("queue") as PendingProof[];
    for (const record of records) {
      try {
        const response = await fetch("/api/sync", { method: "POST", headers: { "content-type": "application/json", "x-idempotency-key": record.idempotencyKey }, body: JSON.stringify(record) });
        const result = await response.json();
        if (response.ok || result.result === "duplicate") await db.delete("queue", record.idempotencyKey);
        else if (result.result === "conflict") await db.put("queue", { ...record, syncState: "NEEDS_REVIEW" });
        else throw new Error(result.error ?? "Synchronization failed.");
      } catch (syncError) {
        setError(syncError instanceof Error ? syncError.message : "Synchronization failed. Evidence remains on this device.");
        await refreshPending();
        return;
      }
    }
    await refreshPending();
    setMessage("Saved delivery records are synchronized.");
    router.refresh();
  }

  async function recordDelivery(formData: FormData) {
    setError(""); setMessage("");
    if (!selected) return;
    const loadedQuantity = selected.loadedUnits ?? selected.handlingUnits;
    const outcome = String(formData.get("outcome")) as DeliveryOutcome;
    const quantity = Number(formData.get("quantity"));
    const receiverOrReason = String(formData.get("receiverOrReason") ?? "").trim();
    const acknowledged = formData.get("acknowledged") === "on";
    try {
      validateDeliveryRecord({ outcome, quantity, loadedQuantity, receiverOrReason, acknowledged });
      const idempotencyKey = crypto.randomUUID();
      const record: PendingProof = {
        id: `POD-${selected.id}-${idempotencyKey.slice(0, 8)}`,
        idempotencyKey,
        orderId: selected.id,
        baseRevision: selected.revision,
        outcome,
        quantity,
        loadedQuantity,
        receiverOrReason,
        acknowledged: true,
        recordedAt: new Date().toISOString(),
        syncState: "PENDING",
      };
      const photo = formData.get("photo");
      if (photo instanceof File && photo.size > 0) {
        if (photo.size > 1_000_000) throw new Error("Choose a photo smaller than 1 MB.");
        record.photoDataUrl = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error); reader.readAsDataURL(photo); });
      }
      const db = await offlineDb();
      await db.put("queue", record);
      await refreshPending();
      setMessage(online ? "Delivery saved. Synchronize to share it." : "Delivery saved on this device. Continue the route and synchronize later.");
      const next = orders.find((order) => order.id !== selected.id && order.status === "OUT_FOR_DELIVERY" && !pending.some((item) => item.orderId === order.id));
      if (next) setSelectedId(next.id);
      if (online) await synchronize();
    } catch (recordError) {
      setError(recordError instanceof Error ? recordError.message : "Delivery record could not be saved.");
    }
  }

  if (!selected) return <div className="empty">No stops are assigned to this route.</div>;
  return <>
    <div className={`offline-bar ${online ? "online" : ""}`}><div><strong>{online ? "Connected" : "Offline · device only"}</strong><div className="tiny">{online ? "Saved records can synchronize." : "The downloaded route remains available."}</div></div><button className="btn small" onClick={() => setForcedOffline((value) => !value)}>{forcedOffline ? "Reconnect device" : "Demonstrate offline"}</button></div>
    {message ? <div className="banner green" role="status">{message}</div> : null}{error ? <div className="banner red" role="alert">{error}</div> : null}
    <div className="grid two">
      <section className="card"><div className="card-head"><div><p className="eyebrow">Stop {selected.stopSequence} of {orders.length}</p><h2>{selected.outletId} · {selected.brand}</h2></div><span className="badge blue">{selected.windowOpen.slice(0,5)}–{selected.windowClose.slice(0,5)}</span></div><div className="card-pad"><div className="record-facts"><div><dt>Loaded</dt><dd>{selected.loadedUnits ?? selected.handlingUnits} units</dd></div><div><dt>Access</dt><dd>{selected.parkingConstraint.replaceAll("_", " ")}</dd></div><div><dt>Temperature</dt><dd>{selected.temperature}</dd></div><div><dt>Dock</dt><dd>{selected.dockType.replaceAll("_", " ")}</dd></div></div>{selected.shortfallReason ? <div className="banner" style={{marginTop:16}}>Quantity changed during loading: {selected.shortfallReason}</div> : null}<form action={recordDelivery} className="form-stack" style={{marginTop:20}}><label>Delivery outcome<select name="outcome" defaultValue="DELIVERED"><option value="DELIVERED">Delivered in full</option><option value="PARTIAL">Partial delivery</option><option value="UNABLE">Unable to deliver</option></select></label><label>Units received<input name="quantity" type="number" min="0" step="1" defaultValue={selected.loadedUnits ?? selected.handlingUnits} required /></label><label>Receiver or failure reason<input name="receiverOrReason" required placeholder="Receiver name, or why delivery failed" /></label><label>Photo evidence optional<input name="photo" type="file" accept="image/*" /></label><label className="check-item"><input name="acknowledged" type="checkbox" required /><span>I checked the quantity with the receiver or recorded why delivery failed.</span></label><button className="btn primary full">{online ? "Save delivery record" : "Save on this device"}</button></form></div></section>
      <aside className="stack"><section className="card"><div className="card-head"><h2>Route stops</h2><span className="badge green">{stopCount}/{orders.length} recorded</span></div><div className="list">{orders.map((order) => { const local = pending.find((item) => item.orderId === order.id); return <button key={order.id} type="button" className="list-row" style={{borderLeft: order.id === selected.id ? "4px solid var(--green)" : undefined, background:"white", width:"100%", textAlign:"left", cursor:"pointer"}} onClick={() => setSelectedId(order.id)}><div><strong>{order.stopSequence} · {order.outletId}</strong><p className="muted tiny">{order.id} · {order.loadedUnits ?? order.handlingUnits} units</p></div>{local ? <span className={`badge ${local.syncState === "NEEDS_REVIEW" ? "orange" : "blue"}`}>{local.syncState === "NEEDS_REVIEW" ? "Needs review" : "On device"}</span> : <span className="badge">{order.status.replaceAll("_", " ")}</span>}</button>; })}</div></section><section className="card"><div className="card-pad"><h2>Connection & recovery</h2><p>{pending.length ? `${pending.length} record${pending.length > 1 ? "s" : ""} saved on this device.` : "No records are waiting on this device."}</p><button className="btn primary" onClick={synchronize} disabled={!online || pending.length === 0}>Sync saved records</button><p className="muted tiny" style={{marginTop:14}}>Retries keep the same proof reference. Conflicts preserve evidence for dispatcher review.</p></div></section></aside>
    </div>
  </>;
}
