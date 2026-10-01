export function Notice({ notice, error }: { notice?: string; error?: string }) {
  if (error) return <div className="banner red" role="alert"><strong>Action needed.</strong> {error}</div>;
  if (notice) return <div className="banner green" role="status"><strong>Saved.</strong> {notice}</div>;
  return null;
}
