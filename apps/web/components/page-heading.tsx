import type { ReactNode } from "react";

export function PageHeading({ eyebrow = "Saturday 27 June 2026 · Peliyagoda", title, description, actions }: { eyebrow?: string; title: string; description: string; actions?: ReactNode }) {
  return <div className="heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{description}</p></div>{actions ? <div className="actions">{actions}</div> : null}</div>;
}
