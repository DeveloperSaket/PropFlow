import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { Badge, Stat, Spinner, formatMoney } from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
export default function SellerDashboard() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [tab, setTab] = useState('listings');
  const [listings, setListings] = useState(null);
  const [leads, setLeads] = useState(null);
  const [appts, setAppts] = useState(null);
  const load = () => {
    api.get('/properties?mine=1&limit=50').then((r) => setListings(r.data));
    api.get('/interests/received').then((r) => setLeads(r.data));
    api.get('/appointments/mine').then((r) => setAppts(r.data));
  };
  useEffect(load, []);
  const del = async (id) => {
    if (!confirm('Delete this listing?')) return;
    await api.del(`/properties/${id}`);
    load();
  };
  const markSold = async (id) => { await api.patch(`/properties/${id}/sold`); load(); };
  const setLead = async (id, status) => { await api.patch(`/interests/${id}/status`, { status }); load(); };
  const setAppt = async (id, status) => { await api.patch(`/appointments/${id}/status`, { status }); load(); };
  if (!listings || !leads || !appts) return <Spinner />;
  const approved = listings.filter((l) => l.status === 'approved').length;
  const pending = listings.filter((l) => l.status === 'pending').length;
  const totalViews = listings.reduce((s, l) => s + (l.views || 0), 0);
  return (
    <div className="container">
      <div className="flex between wrap">
        <div>
          <h1 className="page-title">Seller Dashboard</h1>
          <p className="subtle">Manage your listings and buyer leads.</p>
        </div>
        <button className="btn" onClick={() => nav('/seller/new')}>+ New listing</button>
      </div>
      {user.kyc_status !== 'verified' && (
        <div className="alert info">
          You must complete <Link to="/kyc">KYC verification</Link> before you can publish listings.
        </div>
      )}
      <div className="grid cols-4" style={{ margin: '16px 0 24px' }}>
        <Stat num={listings.length} label="Listings" />
        <Stat num={approved} label="Approved" color="var(--green)" />
        <Stat num={pending} label="In review" color="var(--amber)" />
        <Stat num={leads.length} label="Buyer leads" color="var(--brand)" />
      </div>
      <div className="tabs">
        {['listings', 'leads', 'viewings'].map((t) => (
          <div key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t === 'listings' ? 'My Listings' : t === 'leads' ? `Leads (${leads.length})` : `Viewings (${appts.length})`}
          </div>
        ))}
      </div>
      {tab === 'listings' && (
        listings.length === 0 ? <p className="muted">No listings yet.</p> : (
          <div className="table-wrap card" style={{ padding: 0 }}>
            <table>
              <thead><tr><th>Title</th><th>Price</th><th>City</th><th>Status</th><th>Views</th><th>Interests</th><th>Actions</th></tr></thead>
              <tbody>
                {listings.map((l) => (
                  <tr key={l.id}>
                    <td><Link to={`/properties/${l.id}`}>{l.title}</Link>
                      {l.status === 'rejected' && l.rejection_reason && <div><small className="badge rejected">{l.rejection_reason}</small></div>}
                    </td>
                    <td>{formatMoney(l.price)}</td>
                    <td>{l.city}</td>
                    <td><Badge value={l.status} /></td>
                    <td>{l.views}</td>
                    <td>{l.interest_count}</td>
                    <td className="flex wrap">
                      <button className="btn small secondary" onClick={() => nav(`/seller/edit/${l.id}`)}>Edit</button>
                      {l.status === 'approved' && <button className="btn small" onClick={() => markSold(l.id)}>Mark sold</button>}
                      <button className="btn small danger" onClick={() => del(l.id)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
      {tab === 'leads' && (
        leads.length === 0 ? <p className="muted">No buyer leads yet.</p> : (
          <div className="table-wrap card" style={{ padding: 0 }}>
            <table>
              <thead><tr><th>Property</th><th>Buyer</th><th>Contact</th><th>Message</th><th>Status</th><th>Update</th></tr></thead>
              <tbody>
                {leads.map((l) => (
                  <tr key={l.id}>
                    <td><Link to={`/properties/${l.property_id}`}>{l.title}</Link></td>
                    <td>{l.buyer_name} {l.buyer_kyc === 'verified' && <Badge value="verified" />}</td>
                    <td><small>{l.buyer_email}<br />{l.buyer_phone || '—'}</small></td>
                    <td className="muted">{l.message || '—'}</td>
                    <td><Badge value={l.status} /></td>
                    <td>
                      <select value={l.status} onChange={(e) => setLead(l.id, e.target.value)}>
                        <option value="new">new</option>
                        <option value="contacted">contacted</option>
                        <option value="negotiating">negotiating</option>
                        <option value="closed">closed</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
      {tab === 'viewings' && (
        appts.length === 0 ? <p className="muted">No viewing requests.</p> : (
          <div className="table-wrap card" style={{ padding: 0 }}>
            <table>
              <thead><tr><th>Property</th><th>Buyer</th><th>When</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>
                {appts.map((a) => (
                  <tr key={a.id}>
                    <td><Link to={`/properties/${a.property_id}`}>{a.title}</Link></td>
                    <td>{a.buyer_name}{a.buyer_phone ? ` · ${a.buyer_phone}` : ''}</td>
                    <td>{new Date(a.scheduled_at).toLocaleString()}</td>
                    <td><Badge value={a.status} /></td>
                    <td className="flex wrap">
                      {a.status === 'requested' && <button className="btn small green" onClick={() => setAppt(a.id, 'confirmed')}>Confirm</button>}
                      {['requested', 'confirmed'].includes(a.status) && <button className="btn small danger" onClick={() => setAppt(a.id, 'cancelled')}>Cancel</button>}
                      {a.status === 'confirmed' && <button className="btn small" onClick={() => setAppt(a.id, 'completed')}>Complete</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  );
}
