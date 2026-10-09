export const PRICE_RANGES = [
  { value: '', label: 'Any' },
  { value: '0-500000', label: '$0 – $500K', min: 0, max: 500000 },
  { value: '500000-1000000', label: '$500K – $1M', min: 500000, max: 1000000 },
  { value: '1000000-2000000', label: '$1M – $2M', min: 1000000, max: 2000000 },
  { value: '2000000-5000000', label: '$2M – $5M', min: 2000000, max: 5000000 },
  { value: '5000000-99999999', label: '$5M+', min: 5000000, max: 99999999 },
];

export default function PropertyFilters({ filters, onFilterChange, onApply, onReset }) {
  const set = (key) => (event) => onFilterChange(key, event.target.value);

  return (
    <form className="card mb-20 property-filters" onSubmit={onApply}>
      <div className="property-filter-fields">
        <div className="property-filter-search">
          <label htmlFor="property-search">Search</label>
          <input id="property-search" value={filters.q} onChange={set('q')} placeholder="Title, address…" />
        </div>
        <div>
          <label htmlFor="property-type">Type</label>
          <select id="property-type" value={filters.type} onChange={set('type')}>
            <option value="">Any</option>
            <option value="apartment">Apartment</option>
            <option value="house">House</option>
            <option value="villa">Villa</option>
            <option value="plot">Plot</option>
            <option value="commercial">Commercial</option>
          </select>
        </div>
        <div>
          <label htmlFor="property-listing">For</label>
          <select id="property-listing" value={filters.listing} onChange={set('listing')}>
            <option value="">Any</option>
            <option value="sale">Sale</option>
            <option value="rent">Rent</option>
          </select>
        </div>
        <div>
          <label htmlFor="property-city">City</label>
          <input id="property-city" value={filters.city} onChange={set('city')} placeholder="e.g. Pune" />
        </div>
      </div>
      <div className="property-filter-options">
        <div className="property-filter-price">
          <span className="filter-label">Price range</span>
          <div className="price-range-bar" aria-label="Price range selector">
            {PRICE_RANGES.map((range) => (
              <button
                key={range.value || 'any'}
                type="button"
                className={`price-range-option ${filters.priceRange === range.value ? 'active' : ''}`}
                aria-pressed={filters.priceRange === range.value}
                onClick={() => onFilterChange('priceRange', range.value)}
              >
                {range.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label htmlFor="property-bedrooms">Min beds</label>
          <input id="property-bedrooms" type="number" min="0" value={filters.bedrooms} onChange={set('bedrooms')} />
        </div>
        <div>
          <label htmlFor="property-sort">Sort</label>
          <select id="property-sort" value={filters.sort} onChange={set('sort')}>
            <option value="newest">Newest</option>
            <option value="price_asc">Price: low to high</option>
            <option value="price_desc">Price: high to low</option>
          </select>
        </div>
        <div className="property-filter-actions">
          <button className="btn" type="submit">Apply</button>
          <button className="btn secondary" type="button" onClick={onReset}>Reset</button>
        </div>
      </div>
    </form>
  );
}