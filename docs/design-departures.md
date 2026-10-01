# Significant departures from the Designathon

The implementation preserves the submitted role workflows, navigation language, visual direction, assisted-planning tradeoff, versioned loading handoff, offline proof recovery, and independent store receipt.

Changes made for a working multi-user system:

1. Browser-only role switching was replaced by four authenticated, server-authorized accounts.
2. Prototype `localStorage` operational state was replaced by PostgreSQL.
3. Offline delivery records now use IndexedDB and an idempotent synchronization endpoint.
4. Manifest changes and delivery evidence use explicit database revisions and audit events.
5. The public Designathon casebook pages are represented by repository documentation rather than application navigation.

The application does not add GPS tracking, live optimization, trained forecasting, messaging integrations, or unverified real-time claims.
