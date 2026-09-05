import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import PropertyCard from '../components/PropertyCard.jsx';
import { Spinner } from '../components/ui.jsx';
const empty = {
  q: '', type: '', listing: '', city: '', minPrice: '', maxPrice: '',
  bedrooms: '', sort: 'newest',
};
export default function Browse() {
  const [filters, setFilters] = useState(empty);
  const [result, setResult] = useState(null);
  const [page, setPage] = useState(1);
  const load = (pg = 1) => {
    setResult(null);
    const params = new URLSearchParams({ page: pg, limit: 9 });
    Object.entries(filters).forEach(([k, v]) => v !== '' && params.set(k, v));
    api.get(`/properties?${params.toString()}`).then(setResult).catch(() => setResult({ data: [], pagination: {} }));
  };
  useEffect(() => { load(1); setPage(1); /* eslint-disable-next-line */ }, []);
  const apply = (e) => { e.preventDefault(); setPage(1); load(1); };
  const set = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.value }));
  const reset = () => { setFilters(empty); setTimeout(() => load(1), 0); };
  const go = (pg) => { setPage(pg); load(pg); window.scrollTo(0, 0); };
  return (
    <div className="container">
      <h1 className="page-title">Browse properties</h1>
      <p className="subtle">Filter by type, location, price and more.</p>
      <form className="card" onSubmit={apply} style={{ marginBottom: 20 }}>
        <div className="row wrap" style={{ flexWrap: 'wrap' }}>
          <div style={{ flex: 2, minWidth: 200 }}>
            <label>Search</label>
            <input value={filters.q} onChange={set('q')} placeholder="Title, address…" />
          </div>
          <div>
            <label>Type</label>
            <select value={filters.type} onChange={set('type')}>
              <option value="">Any</option>
              <option value="apartment">Apartment</option>
              <option value="house">House</option>
              <option value="villa">Villa</option>
              <option value="plot">Plot</option>
              <option value="commercial">Commercial</option>
            </select>
          </div>
          <div>
            <label>For</label>
            <select value={filters.listing} onChange={set('listing')}>
              <option value="">Any</option>
              <option value="sale">Sale</option>
              <option value="rent">Rent</option>
            </select>
          </div>
          <div>
            <label>City</label>
            <input value={filters.city} onChange={set('city')} placeholder="e.g. Pune" />
          </div>
        </div>
        <div className="row wrap" style={{ marginTop: 12, flexWrap: 'wrap' }}>
          <div>
            <label>Min price</label>
            <input type="number" value={filters.minPrice} onChange={set('minPrice')} />
          </div>
          <div>
            <label>Max price</label>
            <input type="number" value={filters.maxPrice} onChange={set('maxPrice')} />
          </div>
          <div>
            <label>Min beds</label>
            <input type="number" value={filters.bedrooms} onChange={set('bedrooms')} />
          </div>
          <div>
            <label>Sort</label>
            <select value={filters.sort} onChange={set('sort')}>
              <option value="newest">Newest</option>
              <option value="price_asc">Price: low to high</option>
              <option value="price_desc">Price: high to low</option>
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
            <button className="btn" type="submit">Apply</button>
            <button className="btn secondary" type="button" onClick={reset}>Reset</button>
          </div>
        </div>
      </form>
      {result === null ? (
        <Spinner />
      ) : result.data.length === 0 ? (
        <p className="muted">No properties match your filters.</p>
      ) : (
        <>
          <p className="muted">{result.pagination.total} result(s)</p>
          <div className="grid cols-3">
            {result.data.map((p) => <PropertyCard key={p.id} p={p} />)}
          </div>
          {result.pagination.pages > 1 && (
            <div className="flex" style={{ justifyContent: 'center', marginTop: 20, gap: 6 }}>
              {Array.from({ length: result.pagination.pages }, (_, i) => i + 1).map((pg) => (
                <button
                  key={pg}
                  className={`btn small ${pg === page ? '' : 'secondary'}`}
                  onClick={() => go(pg)}
                >{pg}</button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
