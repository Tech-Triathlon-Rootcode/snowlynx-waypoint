const styles: Record<string, string> = {
  CONFIRMED: "neutral",
  ALLOCATED: "blue",
  DEFERRED: "orange",
  LOADING: "blue",
  READY: "green",
  OUT_FOR_DELIVERY: "blue",
  DELIVERED: "green",
  PARTIAL: "orange",
  UNABLE: "red",
  RECEIPT_CONFIRMED: "green",
  RECEIPT_ISSUE: "red",
  NEXT_RUN: "orange",
};

export function StatusBadge({ status }: { status: string }) {
  return <span className={`badge ${styles[status] ?? "neutral"}`}>{status.replaceAll("_", " ").toLowerCase()}</span>;
}
