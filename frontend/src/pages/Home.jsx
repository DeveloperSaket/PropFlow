import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { propertyQueries, queryKeys } from '../api/queries.js';
import PropertyCard from '../components/PropertyCard.jsx';
import Spinner from '../lib/Spinner/index.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { Alert } from '../components/ui.jsx';
import Empty from '../components/Empty/index.jsx';
export default function Home() {
  const { user } = useAuth();
  const { data: properties = [], isPending, error } = useQuery({
    queryKey: queryKeys.properties.list('limit=6&sort=newest'),
    queryFn: ({ signal }) => propertyQueries.list('limit=6&sort=newest', { signal }).then((response) => response.data),
  });
  return (
    <div className="container">
      <div className="hero">
        <h1>Find your next property, with confidence.</h1>
        <p>
          A compliant marketplace connecting buyers and sellers. Every listing is
          verified, every user is KYC-checked, and every action is audited.
        </p>
        <div className="flex wrap">
          <Link to="/browse" className="btn">Browse properties</Link>
          {!user && <Link to="/register" className="btn secondary">List your property</Link>}
        </div>
      </div>
      <div className="flex between mb-14">
        <h2 className="m-0">Latest listings</h2>
        <Link to="/browse">View all →</Link>
      </div>
      {isPending ? (
        <Spinner />
      ) : error && !properties.length ? (
        <Alert type="error">{error.message}</Alert>
      ) : properties.length === 0 ? (
        <Empty
          title="No approved listings yet"
          description="Check back soon for newly reviewed properties."
        />
      ) : (
        <>
          {error && <Alert type="error">{error.message}</Alert>}
          <div className="grid cols-3">
            {properties.map((p) => <PropertyCard key={p.id} p={p} />)}
          </div>
        </>
      )}
      <div className="grid cols-3 mt-40">
        <div className="card">
          <h3>✅ Verified listings</h3>
          <p className="muted">Every property is reviewed by our compliance team before going live.</p>
        </div>
        <div className="card">
          <h3>🛡️ KYC-checked users</h3>
          <p className="muted">Buyers and sellers complete identity verification to transact safely.</p>
        </div>
        <div className="card">
          <h3>📋 Full audit trail</h3>
          <p className="muted">Key actions are logged for transparency and regulatory compliance.</p>
        </div>
      </div>
    </div>
  );
}
