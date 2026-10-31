import { Link } from 'react-router-dom';
import { Badge, formatMoney } from './ui.jsx';
import { getPropertyTypeLabel } from '../constants/propertyTypes.js';
import Empty from './Empty/index.jsx';
export default function PropertyCard({ p, showStatus }) {
  const img = p.images?.[0];
  return (
    <Link to={`/properties/${p.id}`} className="card prop-card color-inherit">
      {img ? <img src={img} alt={p.title} loading="lazy" /> : (
        <Empty className="property-card-image-empty" title="No image available" description="" />
      )}
      <div className="body">
        <div className="flex between">
          <span className="price">
            {formatMoney(p.price)}
            {p.listing_type === 'rent' && <small className="muted"> /mo</small>}
          </span>
          {showStatus && <Badge value={p.status} />}
        </div>
        <h3>{p.title}</h3>
        <div className="meta">
          {p.city || '—'}{p.state ? `, ${p.state}` : ''}
        </div>
        <div className="meta flex wrap gap-12">
          <span>{getPropertyTypeLabel(p.property_type)}</span>
          {p.bedrooms != null && <span>{p.bedrooms} bd</span>}
          {p.bathrooms != null && <span>{p.bathrooms} ba</span>}
          {p.area_sqft != null && <span>{p.area_sqft} sqft</span>}
        </div>
        {p.interest_count > 0 && (
          <div className="meta">{p.interest_count} interested buyer(s)</div>
        )}
      </div>
    </Link>
  );
}
