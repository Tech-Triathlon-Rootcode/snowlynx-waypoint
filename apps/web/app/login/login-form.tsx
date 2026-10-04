"use client";

import { useActionState } from "react";
import { loginAction } from "./actions";

type LoginAccount = { email: string; name: string; role: string };

function roleLabel(role: string) {
  return role === "manager" ? "Store manager" : `${role.slice(0, 1).toUpperCase()}${role.slice(1)}`;
}

export function LoginForm({ accounts }: { accounts: LoginAccount[] }) {
  const [state, action, pending] = useActionState(loginAction, {});
  return (
    <div className="login-layout">
      <section className="login-story">
        <div className="brand login-brand"><span className="brand-mark">W</span><span>waypoint<small>Delivery operations</small></span></div>
        <p className="eyebrow">SnowlynX · Tech-Triathlon 2026</p>
        <h1>One delivery record, from order to receipt.</h1>
        <p>Plan explainable trips, resolve loading changes, keep drivers working offline, and let stores confirm what arrived.</p>
        <ol className="workflow-line" aria-label="Delivery workflow"><li>Order</li><li>Queue</li><li>Assign</li><li>Load</li><li>Deliver</li><li>Receipt</li></ol>
      </section>
      <section className="login-panel" id="main">
        <div>
          <p className="eyebrow">Judge access</p>
          <h2>Sign in to a role workspace</h2>
          <p className="muted">Choose a seeded role account, then use the demo password provided with the deployment.</p>
        </div>
        <form action={action} className="form-stack">
          {state.error ? <p className="form-error" role="alert">{state.error}</p> : null}
          <label>Email address<input name="email" type="email" autoComplete="username" required /></label>
          <label>Password<input name="password" type="password" autoComplete="current-password" required /></label>
          <button className="btn primary" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</button>
        </form>
        <div className="account-list">
          {accounts.map((account) => <button key={account.email} type="button" onClick={() => { const field = document.querySelector<HTMLInputElement>('input[name="email"]'); if (field) field.value = account.email; }}><strong>{roleLabel(account.role)}</strong><span>{account.name} · {account.email}</span></button>)}
        </div>
      </section>
    </div>
  );
}
