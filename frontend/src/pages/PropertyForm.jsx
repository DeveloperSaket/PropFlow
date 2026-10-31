import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { propertyQueries, queryKeys } from '../api/queries.js';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert } from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import Spinner from '../lib/Spinner/index.jsx';
import { getPropertyTypeLabel, PROPERTY_TYPES } from '../constants/propertyTypes.js';
import Form, { FileInput, Input, Select, Textarea } from '../lib/Form/index.jsx';
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
  const queryClient = useQueryClient();
  const propertyQuery = useQuery({
    queryKey: queryKeys.properties.detail(id),
    queryFn: ({ signal }) => propertyQueries.detail(id, { signal }),
    enabled: editing,
  });
  const [form, setForm] = useState(blank);
  const [imageFiles, setImageFiles] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [err, setErr] = useState('');
  const initializedPropertyId = useRef(null);
  useEffect(() => {
    if (!propertyQuery.data || initializedPropertyId.current === id) return;
    const p = propertyQuery.data;
    setForm({
      title: p.title || '', description: p.description || '',
      property_type: p.property_type, listing_type: p.listing_type,
      price: p.price ?? '', area_sqft: p.area_sqft ?? '',
      bedrooms: p.bedrooms ?? '', bathrooms: p.bathrooms ?? '',
      address: p.address || '', city: p.city || '', state: p.state || '',
      pincode: p.pincode || '', images: (p.images || []).join(', '),
    });
    initializedPropertyId.current = id;
  }, [id, propertyQuery.data]);
  const submitMutation = useMutation({
    mutationFn: ({ formData }) => api.upload(`/properties${editing ? `/${id}` : ''}`, formData, editing ? 'PUT' : 'POST'),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.properties.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.properties.mine(user.id) }),
      ]);
      nav('/seller');
    },
  });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  useEffect(() => {
    const urls = imageFiles.map((file) => URL.createObjectURL(file));
    setImagePreviews(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [imageFiles]);
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
  const submit = (draft) => {
    setErr('');
    const payload = {
      ...form,
      price: Number(form.price),
      area_sqft: form.area_sqft ? Number(form.area_sqft) : null,
      bedrooms: form.bedrooms ? Number(form.bedrooms) : null,
      bathrooms: form.bathrooms ? Number(form.bathrooms) : null,
      images: form.images.split(',').map((s) => s.trim()).filter(Boolean),
      saveDraft: draft,
    };
    const formData = new FormData();
    Object.entries(payload).forEach(([key, value]) => {
      formData.append(key, key === 'images' ? JSON.stringify(value) : value == null ? '' : String(value));
    });
    imageFiles.forEach((file) => formData.append('propertyImages', file));
    submitMutation.mutate({ formData });
  };
  if (editing && propertyQuery.isPending) return <Spinner />;
  if (editing && propertyQuery.error && !propertyQuery.data) {
    return <div className="container"><Alert type="error">{propertyQuery.error.message}</Alert></div>;
  }
  return (
    <div className="container max-width-760">
      <h1 className="page-title">{editing ? 'Edit listing' : 'New listing'}</h1>
      <p className="subtle">
        New or edited listings are submitted for compliance review before going public.
      </p>
      {user.kyc_status !== 'verified' && (
        <Alert type="info">Note: your KYC must be verified for listings to publish.</Alert>
      )}
      <Alert type="error">{err || propertyQuery.error?.message || submitMutation.error?.message}</Alert>
      <Form className="card" onSubmit={(e) => { e.preventDefault(); submit(false); }}>
        <Input label="Title" value={form.title} onChange={set('title')} required placeholder="e.g. 3-bedroom Condo with Lake View" />
        <Textarea label="Description" rows={4} value={form.description} onChange={set('description')} />
        <div className="row">
            <Select label="Property type" value={form.property_type} onChange={set('property_type')} required>
              {!PROPERTY_TYPES.some((type) => type.value === form.property_type) && (
                <option value={form.property_type}>{getPropertyTypeLabel(form.property_type)} (existing)</option>
              )}
              {PROPERTY_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
            </Select>
            <Select label="Listing type" value={form.listing_type} onChange={set('listing_type')} required>
              <option value="sale">For sale</option>
              <option value="rent">For lease</option>
            </Select>
            <Input label="Price ($)" type="number" value={form.price} onChange={set('price')} required min="1" />
        </div>
        <div className="row">
          <Input label="Area (sqft)" type="number" min="0" value={form.area_sqft} onChange={set('area_sqft')} />
          <Input label="Bedrooms" type="number" min="0" step="1" value={form.bedrooms} onChange={set('bedrooms')} />
          <Input label="Bathrooms" type="number" min="0" step="0.5" value={form.bathrooms} onChange={set('bathrooms')} />
        </div>
        <Input label="Address" autoComplete="street-address" value={form.address} onChange={set('address')} />
        <div className="row">
          <Input label="City" autoComplete="address-level2" value={form.city} onChange={set('city')} />
          <Input label="Province" autoComplete="address-level1" value={form.state} onChange={set('state')} />
          <Input
            label="Postal code"
            autoComplete="postal-code"
            value={form.pincode}
            onChange={set('pincode')}
            pattern="[ABCEGHJ-NPRSTV-Z][0-9][ABCEGHJ-NPRSTV-Z][ -]?[0-9][ABCEGHJ-NPRSTV-Z][0-9]"
            title="Enter a valid Canadian postal code, such as M5V 3L9."
          />
        </div>
        <Input label="Image URLs (optional, comma-separated)" value={form.images} onChange={set('images')} placeholder="https://… , https://…" />
        <FileInput
          label="Upload property images (optional)"
          hint={`JPG, JPEG, PNG, or WebP; up to 12 images, 5MB each. ${imageFiles.length > 0 ? `${imageFiles.length} selected.` : ''}`}
          accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
          multiple
          onChange={selectImages}
        />
        {imagePreviews.length > 0 && (
          <div className="property-image-previews">
            {imagePreviews.map((src, index) => (
              <img key={src} src={src} alt={`Selected property image ${index + 1}`} />
            ))}
          </div>
        )}
        <div className="flex">
          <button className="btn" disabled={submitMutation.isPending}>{editing ? 'Save & submit for review' : 'Submit for review'}</button>
          {!editing && <button type="button" className="btn secondary" disabled={submitMutation.isPending} onClick={() => submit(true)}>Save as draft</button>}
          <button type="button" className="btn secondary" onClick={() => nav('/seller')}>Cancel</button>
        </div>
      </Form>
    </div>
  );
}
