import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { propertyQueries, queryKeys } from '../api/queries.js';
import PropertyCard from '../components/PropertyCard.jsx';
import PropertyFilters, { PRICE_MAX, PRICE_MIN } from '../components/PropertyFilters.jsx';
import Spinner from '../lib/Spinner/index.jsx';
import { Alert } from '../components/ui.jsx';

const empty = {
  q: '', type: '', listing: '', city: '', minPrice: PRICE_MIN, maxPrice: PRICE_MAX, bedrooms: '', sort: 'newest',
};

export default function Browse() {
  const [filters, setFilters] = useState(empty);
  const [appliedFilters, setAppliedFilters] = useState(empty);
  const [page, setPage] = useState(1);
  const params = new URLSearchParams({ page, limit: 9 });
  Object.entries(appliedFilters).forEach(([key, value]) => {
    if (value === '' || (key === 'minPrice' && value === PRICE_MIN) || (key === 'maxPrice' && value === PRICE_MAX)) return;
    params.set(key, value);
  });
  const queryString = params.toString();
  const { data: result, isPending, error } = useQuery({
    queryKey: queryKeys.properties.list(queryString),
    queryFn: ({ signal }) => propertyQueries.list(queryString, { signal }),
  });

  const apply = (e) => { e.preventDefault(); setPage(1); setAppliedFilters(filters); };
  const setFilter = (key, value) => setFilters((current) => ({ ...current, [key]: value }));
  const reset = () => { setFilters(empty); setAppliedFilters(empty); setPage(1); };
  const go = (pg) => { setPage(pg); window.scrollTo(0, 0); };

  return (
    <div className="container">
      <h1 className="page-title">Browse properties</h1>
      <p className="subtle">Filter by type, location, price and more.</p>
      <PropertyFilters filters={filters} onFilterChange={setFilter} onApply={apply} onReset={reset} />
      {isPending ? (
        <Spinner />
      ) : error && !result ? (
        <Alert type="error">{error.message}</Alert>
      ) : result.data.length === 0 ? (
        <>
          {error && <Alert type="error">{error.message}</Alert>}
          <p className="muted">No properties match your filters.</p>
        </>
      ) : (
        <>
          {error && <Alert type="error">{error.message}</Alert>}
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
