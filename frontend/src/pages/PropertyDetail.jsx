import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client.js';
import { propertyQueries, queryKeys } from '../api/queries.js';
import { Badge, Alert, formatMoney } from '../components/ui.jsx';
import Spinner from '../lib/Spinner/index.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import Chat from '../components/Chat/index.jsx';
import { db } from '../firebase/index.js';
import { getPropertyTypeLabel } from '../constants/propertyTypes.js';
import { Input, Textarea } from '../lib/Form/index.jsx';
export default function PropertyDetail() {
  const { id } = useParams();
  const { user, chatAvailable, firebaseError } = useAuth();
  const nav = useNavigate();
  const [msg, setMsg] = useState('');
  const [ok, setOk] = useState('');
  const [when, setWhen] = useState('');
  const queryClient = useQueryClient();
  const { data: p, isPending, error } = useQuery({
    queryKey: queryKeys.properties.detail(id),
    queryFn: ({ signal }) => propertyQueries.detail(id, { signal }),
  });
  const interestMutation = useMutation({
    mutationFn: (payload) => api.post('/interests', payload),
    onSuccess: () => {
      setOk('Interest recorded! The seller can now contact you. Track it in your dashboard.');
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.interests.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.properties.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.admin.stats }),
      ]);
    },
  });
  const appointmentMutation = useMutation({
    mutationFn: (payload) => api.post('/appointments', payload),
    onSuccess: () => {
      setOk('Viewing requested! Check your dashboard for status updates.');
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.appointments.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.admin.stats }),
        queryClient.invalidateQueries({ queryKey: queryKeys.admin.appointments }),
      ]);
    },
  });
  if (isPending) return <Spinner />;
  if (error && !p) return <div className="container"><Alert type="error">{error.message}</Alert></div>;
  const expressInterest = () => {
    setOk('');
    interestMutation.mutate({ property_id: p.id, message: msg });
  };
  const bookViewing = () => {
    setOk('');
    appointmentMutation.mutate({ property_id: p.id, scheduled_at: new Date(when).toISOString() });
  };
  const img = p.images?.[0];
  return (
    <div className="container">
      <Link to="/browse">← Back to results</Link>
      {error && <Alert type="error">{error.message}</Alert>}
      <div className="grid cols-2 mt-14-align-start">
        <div>
          {img ? <img src={img} alt={p.title} className="image-rounded-cover" /> : <div className="property-image-placeholder">No image available</div>}
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
            <div className="card stat"><div className="num font-size-18">{getPropertyTypeLabel(p.property_type)}</div><div className="label">Type</div></div>
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
      <Alert type="error">{interestMutation.error?.message || appointmentMutation.error?.message}</Alert>
      <Alert type="success">{ok}</Alert>
      {/* Buyer actions */}
      {p.status === 'approved' && (!user || user.role === 'member') && user?.id !== p.seller_id && (
        <div className="grid cols-2 mt-20">
          <div className="card">
            <h3>Interested in this property?</h3>
            {!user ? (
              <p className="muted">Please <Link to="/login">log in</Link> to express interest.</p>
            ) : user.role === 'admin' ? (
              <p className="muted">Admin accounts cannot express buyer interest.</p>
            ) : (
              <>
                <Textarea label="Message to seller (optional)" rows={3} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="I'd like more details / a site visit…" />
                <button className="btn" onClick={expressInterest} disabled={interestMutation.isPending}>
                  {interestMutation.isPending ? 'Submitting…' : 'Express interest'}
                </button>
              </>
            )}
          </div>
          <div className="card">
            <h3>Book a viewing</h3>
            {user && user.role !== 'admin' ? (
              <>
                <Input label="Preferred date & time" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
                <button className="btn green" disabled={!when || appointmentMutation.isPending} onClick={bookViewing}>
                  {appointmentMutation.isPending ? 'Requesting…' : 'Request viewing'}
                </button>
              </>
            ) : (
              <p className="muted">Log in to schedule a property viewing.</p>
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
      {p.status === 'approved' && user && user.role !== 'admin' && user.id !== p.seller_id && (
        <div className="mt-20">
          {chatAvailable ? (
            <Chat
              db={db}
              currentUserId={user.id}
              buyerId={user.id}
              sellerId={p.seller_id}
              productId={p.id}
            />
          ) : (
            <Alert type="info">{firebaseError || 'Chat is unavailable because Firebase is not configured.'}</Alert>
          )}
        </div>
      )}
    </div>
  );
}
