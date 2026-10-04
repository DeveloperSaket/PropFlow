import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { Badge, Stat, Spinner, formatMoney } from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
export default function BuyerDashboard() {
  const { user } = useAuth();
  const [interests, setInterests] = useState(null);
  const [appts, setAppts] = useState(null);
  const load = () => {
    api.get('/interests/mine').then((r) => setInterests(r.data));
    api.get('/appointments/mine').then((r) => setAppts(r.data));
  };
  useEffect(load, []);
  const withdraw = async (id) => {
    await api.patch(`/interests/${id}/status`, { status: 'withdrawn' });
    load();
  };
  const cancelAppt = async (id) => {
    await api.patch(`/appointments/${id}/status`, { status: 'cancelled' });
    load();
  };
  if (!interests || !appts) return <Spinner />;
  const active = interests.filter((i) => i.status !== 'withdrawn' && i.status !== 'closed').length;
  const upcoming = appts.filter((a) => ['requested', 'confirmed'].includes(a.status)).length;
  return (
    <div className="container">
      <h1 className="page-title">Welcome, {user.name}</h1>
      <p className="subtle">Track your property interests and viewings.</p>
      <div className="grid cols-4 mb-24">
        <Stat num={interests.length} label="Total interests" />
        <Stat num={active} label="Active" color="var(--brand)" />
        <Stat num={upcoming} label="Upcoming viewings" color="var(--green)" />
        <Stat num={user.kyc_status === 'verified' ? '✓' : '…'} label={`KYC ${user.kyc_status}`} />
      </div>
      {user.kyc_status !== 'verified' && (
        <div className="alert info">
          Complete your <Link to="/kyc">KYC verification</Link> to build trust with sellers.
        </div>
      )}
      <h2>My interests</h2>
      {interests.length === 0 ? (
        <p className="muted">You haven't expressed interest in any property yet. <Link to="/browse">Browse listings →</Link></p>
      ) : (
        <div className="table-wrap card p-0 mb-30">
          <table>
            <thead><tr><th>Property</th><th>Price</th><th>Seller</th><th>Status</th><th>Since</th><th></th></tr></thead>
            <tbody>
              {interests.map((i) => (
                <tr key={i.id}>
                  <td><Link to={`/properties/${i.property_id}`}>{i.title}</Link><br /><small className="muted">{i.city} · {i.property_type}</small></td>
                  <td>{formatMoney(i.price)}</td>
                  <td>{i.seller_name}</td>
                  <td><Badge value={i.status} /></td>
                  <td className="muted">{i.created_at}</td>
                  <td>
                    {i.status !== 'withdrawn' && i.status !== 'closed' && (
                      <button className="btn small secondary" onClick={() => withdraw(i.id)}>Withdraw</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <h2>My viewings</h2>
      {appts.length === 0 ? (
        <p className="muted">No viewings scheduled.</p>
      ) : (
        <div className="table-wrap card p-0">
          <table>
            <thead><tr><th>Property</th><th>When</th><th>Seller</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {appts.map((a) => (
                <tr key={a.id}>
                  <td><Link to={`/properties/${a.property_id}`}>{a.title}</Link></td>
                  <td>{new Date(a.scheduled_at).toLocaleString()}</td>
                  <td>{a.seller_name}{a.seller_phone ? ` · ${a.seller_phone}` : ''}</td>
                  <td><Badge value={a.status} /></td>
                  <td>
                    {['requested', 'confirmed'].includes(a.status) && (
                      <button className="btn small danger" onClick={() => cancelAppt(a.id)}>Cancel</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
