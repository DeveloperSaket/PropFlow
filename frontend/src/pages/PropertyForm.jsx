import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { Alert } from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
const blank = {
  title: '', description: '', property_type: 'apartment', listing_type: 'sale',
  price: '', area_sqft: '', bedrooms: '', bathrooms: '',
  address: '', city: '', state: '', pincode: '', images: '',
};
export default function PropertyForm() {
  const { id } = useParams();
  const editing = Boolean(id);
  const { user } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState(blank);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (editing) {
      api.get(`/properties/${id}`).then((r) => {
        const p = r.data;
        setForm({
          title: p.title || '', description: p.description || '',
          property_type: p.property_type, listing_type: p.listing_type,
          price: p.price ?? '', area_sqft: p.area_sqft ?? '',
          bedrooms: p.bedrooms ?? '', bathrooms: p.bathrooms ?? '',
          address: p.address || '', city: p.city || '', state: p.state || '',
          pincode: p.pincode || '', images: (p.images || []).join(', '),
        });
      }).catch((e) => setErr(e.message));
    }
  }, [id, editing]);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const submit = async (draft) => {
    setErr(''); setBusy(true);
    const payload = {
      ...form,
      price: Number(form.price),
      area_sqft: form.area_sqft ? Number(form.area_sqft) : null,
      bedrooms: form.bedrooms ? Number(form.bedrooms) : null,
      bathrooms: form.bathrooms ? Number(form.bathrooms) : null,
      images: form.images.split(',').map((s) => s.trim()).filter(Boolean),
      saveDraft: draft,
    };
    try {
      if (editing) await api.put(`/properties/${id}`, payload);
      else await api.post('/properties', payload);
      nav('/seller');
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  return (
    <div className="container" style={{ maxWidth: 760 }}>
      <h1 className="page-title">{editing ? 'Edit listing' : 'New listing'}</h1>
      <p className="subtle">
        New or edited listings are submitted for compliance review before going public.
      </p>
      {user.kyc_status !== 'verified' && (
        <Alert type="info">Note: your KYC must be verified for listings to publish.</Alert>
      )}
      <Alert type="error">{err}</Alert>
      <form className="card" onSubmit={(e) => { e.preventDefault(); submit(false); }}>
        <div className="field">
          <label>Title *</label>
          <input value={form.title} onChange={set('title')} required placeholder="e.g. 3BHK Apartment with Lake View" />
        </div>
        <div className="field">
          <label>Description</label>
          <textarea rows={4} value={form.description} onChange={set('description')} />
        </div>
        <div className="row">
          <div className="field">
            <label>Property type *</label>
            <select value={form.property_type} onChange={set('property_type')}>
              <option value="apartment">Apartment</option>
              <option value="house">House</option>
              <option value="villa">Villa</option>
              <option value="plot">Plot</option>
              <option value="commercial">Commercial</option>
            </select>
          </div>
          <div className="field">
            <label>Listing type *</label>
            <select value={form.listing_type} onChange={set('listing_type')}>
              <option value="sale">For sale</option>
              <option value="rent">For rent</option>
            </select>
          </div>
          <div className="field">
            <label>Price ($) *</label>
            <input type="number" value={form.price} onChange={set('price')} required min="1" />
          </div>
        </div>
        <div className="row">
          <div className="field"><label>Area (sqft)</label><input type="number" value={form.area_sqft} onChange={set('area_sqft')} /></div>
          <div className="field"><label>Bedrooms</label><input type="number" value={form.bedrooms} onChange={set('bedrooms')} /></div>
          <div className="field"><label>Bathrooms</label><input type="number" value={form.bathrooms} onChange={set('bathrooms')} /></div>
        </div>
        <div className="field"><label>Address</label><input value={form.address} onChange={set('address')} /></div>
        <div className="row">
          <div className="field"><label>City</label><input value={form.city} onChange={set('city')} /></div>
          <div className="field"><label>State</label><input value={form.state} onChange={set('state')} /></div>
          <div className="field"><label>Pincode</label><input value={form.pincode} onChange={set('pincode')} /></div>
        </div>
        <div className="field">
          <label>Image URLs (comma-separated)</label>
          <input value={form.images} onChange={set('images')} placeholder="https://… , https://…" />
        </div>
        <div className="flex">
          <button className="btn" disabled={busy}>{editing ? 'Save & submit for review' : 'Submit for review'}</button>
          {!editing && <button type="button" className="btn secondary" disabled={busy} onClick={() => submit(true)}>Save as draft</button>}
          <button type="button" className="btn secondary" onClick={() => nav('/seller')}>Cancel</button>
        </div>
      </form>
    </div>
  );
}

