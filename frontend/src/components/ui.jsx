export function Badge({ value }) {
  return <span className={`badge ${value}`}>{String(value).replace('_', ' ')}</span>;
}
export function Alert({ type = 'info', children }) {
  if (!children) return null;
  return <div className={`alert ${type}`}>{children}</div>;
}
export function Stat({ num, label, color }) {
  return (
    <div className="card stat">
      <div className="num" style={color ? { color } : undefined}>{num}</div>
      <div className="label">{label}</div>
    </div>
  );
}
export function formatMoney(n) {
  if (n == null) return '—';
  // Indian-style grouping
  return '₹' + Number(n).toLocaleString('en-IN');
}
export function Spinner({ label = 'Loading…' }) {
  return <p className="muted center" style={{ padding: 40 }}>{label}</p>;
}