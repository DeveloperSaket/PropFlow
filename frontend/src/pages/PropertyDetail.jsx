import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { Badge, Alert, Spinner, formatMoney } from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
export default function PropertyDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const [p, setP] = useState(null);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [when, setWhen] = useState('');
  const load = () => api.get(`/properties/${id}`).then((r) => setP(r.data)).catch((e) => setErr(e.message));
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);
  if (err) return <div className="container"><Alert type="error">{err}</Alert></div>;
  if (!p) return <Spinner />;
  const expressInterest = async () => {
    setErr(''); setOk('');
    try {
      await api.post('/interests', { property_id: p.id, message: msg });
      setOk('Interest recorded! The seller can now contact you. Track it in your dashboard.');
      load();
    } catch (e) { setErr(e.message); }
  };
  const bookViewing = async () => {
    setErr(''); setOk('');
    try {
      await api.post('/appointments', { property_id: p.id, scheduled_at: new Date(when).toISOString() });
      setOk('Viewing requested! Check your dashboard for status updates.');
    } catch (e) { setErr(e.message); }
  };
  const img = p.images?.[0] || `https://picsum.photos/seed/p${p.id}/1000/600`;
  return (
    <div className="container">
      <Link to="/browse">← Back to results</Link>
      <div className="grid cols-2 mt-14-align-start">
        <div>
          <img src={img} alt={p.title} className="image-rounded-cover" />
          {p.images?.length > 1 && (
            <div className="flex wrap mt-10">
              {p.images.slice(1).map((u, i) => (
                <img key={i} src={u} alt="" className="thumbnail-cover" />
              ))}
            </div>
          )}
        </div>
        <div>
          <div className="flex between">
            <h1 className="page-title mb-6">{p.title}</h1>
            <Badge value={p.status} />
          </div>
          <div className="price heading-brand">
            {formatMoney(p.price)}{p.listing_type === 'rent' && <small className="muted"> /month</small>}
          </div>
          <p className="muted">{p.address ? p.address + ', ' : ''}{p.city}{p.state ? `, ${p.state}` : ''} {p.pincode}</p>
          <div className="grid cols-4 my-14">
            <div className="card stat"><div className="num font-size-18">{p.property_type}</div><div className="label">Type</div></div>
            <div className="card stat"><div className="num font-size-18">{p.bedrooms ?? '—'}</div><div className="label">Beds</div></div>
            <div className="card stat"><div className="num font-size-18">{p.bathrooms ?? '—'}</div><div className="label">Baths</div></div>
            <div className="card stat"><div className="num font-size-18">{p.area_sqft ?? '—'}</div><div className="label">Sqft</div></div>
          </div>
          <p>{p.description || 'No description provided.'}</p>
          <div className="card mt-10">
            <strong>Listed by:</strong> {p.seller_name}{' '}
            {p.seller_kyc === 'verified' && <Badge value="verified" />}
          </div>
        </div>
      </div>
      <Alert type="error">{err}</Alert>
      <Alert type="success">{ok}</Alert>
      {/* Buyer actions */}
      {p.status === 'approved' && (
        <div className="grid cols-2 mt-20">
          <div className="card">
            <h3>Interested in this property?</h3>
            {!user ? (
              <p className="muted">Please <Link to="/login">log in</Link> as a buyer to express interest.</p>
            ) : user.role !== 'buyer' ? (
              <p className="muted">Only buyer accounts can express interest.</p>
            ) : (
              <>
                <div className="field">
                  <label>Message to seller (optional)</label>
                  <textarea rows={3} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="I'd like more details / a site visit…" />
                </div>
                <button className="btn" onClick={expressInterest}>Express interest</button>
              </>
            )}
          </div>
          <div className="card">
            <h3>Book a viewing</h3>
            {user?.role === 'buyer' ? (
              <>
                <div className="field">
                  <label>Preferred date & time</label>
                  <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
                </div>
                <button className="btn green" disabled={!when} onClick={bookViewing}>Request viewing</button>
              </>
            ) : (
              <p className="muted">Log in as a buyer to schedule a property viewing.</p>
            )}
          </div>
        </div>
      )}
      {(user?.id === p.seller_id) && (
        <div className="card mt-20">
          <div className="flex between">
            <span>This is your listing.</span>
            <button className="btn secondary small" onClick={() => nav(`/seller/edit/${p.id}`)}>Edit listing</button>
          </div>
          {p.status === 'rejected' && p.rejection_reason && (
            <Alert type="error">Rejected: {p.rejection_reason}</Alert>
          )}
        </div>
      )}
    </div>
  );
}
