import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import PropertyCard from '../components/PropertyCard.jsx';
import PropertyFilters, { PRICE_MAX, PRICE_MIN } from '../components/PropertyFilters.jsx';
import Spinner from '../lib/Spinner/index.jsx';

const empty = {
  q: '', type: '', listing: '', city: '', minPrice: PRICE_MIN, maxPrice: PRICE_MAX, bedrooms: '', sort: 'newest',
};

export default function Browse() {
  const [filters, setFilters] = useState(empty);
  const [result, setResult] = useState(null);
  const [page, setPage] = useState(1);

  const load = (pg = 1, activeFilters = filters) => {
    setResult(null);
    const params = new URLSearchParams({ page: pg, limit: 9 });

    Object.entries(activeFilters).forEach(([k, v]) => {
      if (v === '' || (k === 'minPrice' && v === PRICE_MIN) || (k === 'maxPrice' && v === PRICE_MAX)) return;
      params.set(k, v);
    });

    api.get(`/properties?${params.toString()}`).then(setResult).catch(() => setResult({ data: [], pagination: {} }));
  };

  useEffect(() => { load(1); setPage(1); /* eslint-disable-next-line */ }, []);

  const apply = (e) => { e.preventDefault(); setPage(1); load(1); };
  const setFilter = (key, value) => setFilters((current) => ({ ...current, [key]: value }));
  const reset = () => { setFilters(empty); setPage(1); load(1, empty); };
  const go = (pg) => { setPage(pg); load(pg); window.scrollTo(0, 0); };

  return (
    <div className="container">
      <h1 className="page-title">Browse properties</h1>
      <p className="subtle">Filter by type, location, price and more.</p>
      <PropertyFilters filters={filters} onFilterChange={setFilter} onApply={apply} onReset={reset} />
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
            <div className="flex justify-center-gap-6">
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
