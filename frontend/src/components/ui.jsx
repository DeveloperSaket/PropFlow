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
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    maximumFractionDigits: 0,
  }).format(Number(n));
}
export function Spinner({ label = 'Loading…' }) {
  return <p className="muted center" style={{ padding: 'var(--space-20)' }}>{label}</p>;
}