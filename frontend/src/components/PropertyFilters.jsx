import { PROPERTY_TYPES } from '../constants/propertyTypes.js';
import Range from '../lib/range/index.jsx';
import Form, { Input, Select } from '../lib/Form/index.jsx';

export const PRICE_MIN = 0;
export const PRICE_MAX = 50_000_000;
export const PRICE_STEPS = [PRICE_MIN, 50_000, 1_000_000, 2_000_000, 3_000_000, 4_000_000, 5_000_000, PRICE_MAX];

const formatPrice = (value) => {
  const amount = Number.isFinite(Number(value)) ? Number(value) : 0;
  if (amount >= 1_000_000) return `$${amount / 1_000_000}M`;
  if (amount >= 1_000) return `$${amount / 1_000}K`;
  return `$${amount}`;
};

export default function PropertyFilters({ filters, onFilterChange, onApply, onReset }) {
  const minPrice = Number.isFinite(Number(filters.minPrice)) ? Number(filters.minPrice) : PRICE_MIN;
  const maxPrice = Number.isFinite(Number(filters.maxPrice)) ? Number(filters.maxPrice) : PRICE_MAX;
  const set = (key) => (event) => onFilterChange(key, event.target.value);
  const setPriceRange = (min, max) => {
    onFilterChange('minPrice', min);
    onFilterChange('maxPrice', max);
  };

  return (
    <Form className="card mb-20 property-filters" onSubmit={onApply}>
      <div className="property-filter-fields">
        <div className="property-filter-search">
          <Input id="property-search" label="Search" value={filters.q} onChange={set('q')} placeholder="Title, address…" />
        </div>
        <div>
          <Select id="property-type" label="Type" value={filters.type} onChange={set('type')}>
            <option value="">Any</option>
            {PROPERTY_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
          </Select>
        </div>
        <div>
          <Select id="property-listing" label="For" value={filters.listing} onChange={set('listing')}>
            <option value="">Any</option>
            <option value="sale">Sale</option>
            <option value="rent">Lease</option>
          </Select>
        </div>
        <div>
          <Input id="property-city" label="City" value={filters.city} onChange={set('city')} placeholder="e.g. Toronto" />
        </div>
      </div>
      <div className="property-filter-options">
        <div className="property-filter-price">
          <span className="filter-label">Price range</span>
          <div className="price-range-values" aria-live="polite">
            <span>{formatPrice(minPrice)}</span>
            <span>{maxPrice === PRICE_MAX ? `${formatPrice(maxPrice)}+` : formatPrice(maxPrice)}</span>
          </div>
          <Range values={PRICE_STEPS} valueMin={minPrice} valueMax={maxPrice} onChange={setPriceRange} />
        </div>
        <div>
          <Input id="property-bedrooms" label="Min beds" type="number" min="0" value={filters.bedrooms} onChange={set('bedrooms')} />
        </div>
        <div>
          <Select id="property-sort" label="Sort" value={filters.sort} onChange={set('sort')}>
            <option value="newest">Newest</option>
            <option value="price_asc">Price: low to high</option>
            <option value="price_desc">Price: high to low</option>
          </Select>
        </div>
        <div className="property-filter-actions">
          <button className="btn" type="submit">Apply</button>
          <button className="btn secondary" type="button" onClick={onReset}>Reset</button>
        </div>
      </div>
    </Form>
  );
}