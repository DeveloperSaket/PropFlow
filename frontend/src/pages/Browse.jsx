import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import PropertyCard from '../components/PropertyCard.jsx';
import PropertyFilters, { PRICE_RANGES } from '../components/PropertyFilters.jsx';
import { Spinner } from '../components/ui.jsx';

const empty = {
  q: '', type: '', listing: '', city: '', priceRange: '', bedrooms: '', sort: 'newest',
};

export default function Browse() {
  const [filters, setFilters] = useState(empty);
  const [result, setResult] = useState(null);
  const [page, setPage] = useState(1);

  const load = (pg = 1) => {
    setResult(null);
    const params = new URLSearchParams({ page: pg, limit: 9 });
    const selectedRange = PRICE_RANGES.find((range) => range.value === filters.priceRange);

    if (selectedRange && selectedRange.min !== undefined) {
      params.set('minPrice', String(selectedRange.min));
    }
    if (selectedRange && selectedRange.max !== undefined && selectedRange.max !== '') {
      params.set('maxPrice', String(selectedRange.max));
    }

    Object.entries(filters).forEach(([k, v]) => {
      if (k === 'priceRange' || v === '') return;
      params.set(k, v);
    });

    api.get(`/properties?${params.toString()}`).then(setResult).catch(() => setResult({ data: [], pagination: {} }));
  };

  useEffect(() => { load(1); setPage(1); /* eslint-disable-next-line */ }, []);

  const apply = (e) => { e.preventDefault(); setPage(1); load(1); };
  const setFilter = (key, value) => setFilters((current) => ({ ...current, [key]: value }));
  const reset = () => { setFilters(empty); setTimeout(() => load(1), 0); };
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
