import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { Alert } from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { getPropertyTypeLabel, PROPERTY_TYPES } from '../constants/propertyTypes.js';
const blank = {
  title: '', description: '', property_type: 'detached', listing_type: 'sale',
  price: '', area_sqft: '', bedrooms: '', bathrooms: '',
  address: '', city: '', state: '', pincode: '', images: '',
};
export default function PropertyForm() {
  const { id } = useParams();
  const editing = Boolean(id);
  const { user } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState(blank);
  const [imageFiles, setImageFiles] = useState([]);
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
  const selectImages = (e) => {
    const files = Array.from(e.target.files || []);
    const invalidFile = files.find((file) => !/\.(jpe?g|png|webp)$/i.test(file.name));
    if (invalidFile) {
      setErr(`${invalidFile.name} is not a supported image format. Use JPG, JPEG, PNG, or WebP.`);
      setImageFiles([]);
      return;
    }
    const oversizedFile = files.find((file) => file.size > 5 * 1024 * 1024);
    if (oversizedFile) {
      setErr(`${oversizedFile.name} exceeds the 5MB limit.`);
      setImageFiles([]);
      return;
    }
    if (files.length > 12) {
      setErr('Select no more than 12 image files.');
      setImageFiles([]);
      return;
    }
    setErr('');
    setImageFiles(files);
  };
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
      const formData = new FormData();
      Object.entries(payload).forEach(([key, value]) => {
        formData.append(key, key === 'images' ? JSON.stringify(value) : value == null ? '' : String(value));
      });
      imageFiles.forEach((file) => formData.append('propertyImages', file));
      await api.upload(`/properties${editing ? `/${id}` : ''}`, formData, editing ? 'PUT' : 'POST');
      nav('/seller');
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  return (
    <div className="container max-width-760">
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
          <input value={form.title} onChange={set('title')} required placeholder="e.g. 3-bedroom Condo with Lake View" />
        </div>
        <div className="field">
          <label>Description</label>
          <textarea rows={4} value={form.description} onChange={set('description')} />
        </div>
        <div className="row">
          <div className="field">
            <label>Property type *</label>
            <select value={form.property_type} onChange={set('property_type')}>
              {!PROPERTY_TYPES.some((type) => type.value === form.property_type) && (
                <option value={form.property_type}>{getPropertyTypeLabel(form.property_type)} (existing)</option>
              )}
              {PROPERTY_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Listing type *</label>
            <select value={form.listing_type} onChange={set('listing_type')}>
              <option value="sale">For sale</option>
              <option value="rent">For lease</option>
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
          <div className="field"><label>Province</label><input value={form.state} onChange={set('state')} /></div>
          <div className="field"><label>Postal code</label><input value={form.pincode} onChange={set('pincode')} /></div>
        </div>
        <div className="field">
          <label>Image URLs (optional, comma-separated)</label>
          <input value={form.images} onChange={set('images')} placeholder="https://… , https://…" />
        </div>
        <div className="field">
          <label>Upload property images (optional)</label>
          <input
            type="file"
            accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
            multiple
            onChange={selectImages}
          />
          <small className="muted">JPG, JPEG, PNG, or WebP; up to 12 images, 5MB each. {imageFiles.length > 0 && `${imageFiles.length} selected.`}</small>
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
