import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import PropertyCard from '../components/PropertyCard.jsx';
import { Spinner } from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
export default function Home() {
  const { user } = useAuth();
  const [props, setProps] = useState(null);
  useEffect(() => {
    api.get('/properties?limit=6&sort=newest').then((r) => setProps(r.data)).catch(() => setProps([]));
  }, []);
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
      <div className="flex between" style={{ marginBottom: 14 }}>
        <h2 style={{ margin: 0 }}>Latest listings</h2>
        <Link to="/browse">View all →</Link>
      </div>
      {props === null ? (
        <Spinner />
      ) : props.length === 0 ? (
        <p className="muted">No approved listings yet.</p>
      ) : (
        <div className="grid cols-3">
          {props.map((p) => <PropertyCard key={p.id} p={p} />)}
        </div>
      )}
      <div className="grid cols-3" style={{ marginTop: 40 }}>
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
