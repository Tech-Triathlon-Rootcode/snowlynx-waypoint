const steps = ["Order", "Queue", "Assign", "Load", "Deliver", "Receipt"];

export function WorkflowSpine({ active }: { active: string }) {
  return <nav className="workflow-spine" aria-label="Delivery workflow">{steps.map((step, index) => <span key={step} className={step === active ? "active" : ""}>{index + 1} · {step}</span>)}</nav>;
}
