import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { adminQueries, queryKeys } from '../api/queries.js';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Badge, Stat, formatMoney } from '../components/ui.jsx';
import Spinner from '../lib/Spinner/index.jsx';
import { Input } from '../lib/Form/index.jsx';
export default function AdminDashboard() {
  const [tab, setTab] = useState('overview');
  const queryClient = useQueryClient();
  const statsQuery = useQuery({ queryKey: queryKeys.admin.stats, queryFn: adminQueries.stats });
  const pendingQuery = useQuery({ queryKey: queryKeys.admin.pendingListings, queryFn: adminQueries.pendingListings });
  const usersQuery = useQuery({ queryKey: queryKeys.admin.users, queryFn: adminQueries.users });
  const auditQuery = useQuery({ queryKey: queryKeys.admin.audit, queryFn: adminQueries.audit });
  const appointmentsQuery = useQuery({ queryKey: queryKeys.admin.appointments, queryFn: adminQueries.appointments });
  const stats = statsQuery.data;
  const pending = pendingQuery.data || [];
  const users = usersQuery.data || [];
  const audit = auditQuery.data || [];
  const appts = appointmentsQuery.data || [];
  const [reason, setReason] = useState({});
  const adminMutation = useMutation({
    mutationFn: ({ path, body }) => api.patch(path, body),
    onSuccess: (_data, variables) => {
      const keys = variables.area === 'listing'
        ? [queryKeys.admin.pendingListings, queryKeys.admin.stats, queryKeys.admin.audit, queryKeys.properties.all]
        : variables.area === 'user'
          ? [queryKeys.admin.users, queryKeys.admin.stats, queryKeys.admin.audit]
          : [queryKeys.admin.appointments, queryKeys.admin.stats];
      return Promise.all(keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
    },
  });
  const review = (id, decision) => adminMutation.mutate({
    path: `/admin/listings/${id}/review`,
    body: { decision, reason: reason[id] },
    area: 'listing',
  });
  const reviewKyc = (id, status) => adminMutation.mutate({
    path: `/admin/users/${id}/kyc`, body: { status }, area: 'user',
  });
  const toggleActive = (u) => adminMutation.mutate({
    path: `/admin/users/${u.id}/active`, body: { active: !u.active }, area: 'user',
  });
  const toggleAgent = (u) => adminMutation.mutate({
    path: `/admin/users/${u.id}/agent`, body: { is_agent: !u.is_agent }, area: 'user',
  });
  const queryError = [statsQuery, pendingQuery, usersQuery, auditQuery, appointmentsQuery]
    .find((query) => query.error)?.error;
  if ([statsQuery, pendingQuery, usersQuery, auditQuery, appointmentsQuery].some((query) => query.isPending)) return <Spinner />;
  if (queryError && [stats, pendingQuery.data, usersQuery.data, auditQuery.data, appointmentsQuery.data].some((data) => data === undefined)) {
    return <div className="container"><Alert type="error">{queryError.message}</Alert></div>;
  }
  const tabs = [
    ['overview', 'Overview'],
    ['listings', `Review Queue (${pending.length})`],
    ['users', `Users (${users.length})`],
    ['appointments', 'Appointments'],
    ['audit', 'Audit Log'],
  ];
  return (
    <div className="container">
      <h1 className="page-title">Platform Admin</h1>
      <p className="subtle">Oversight of users, listings, activity and compliance.</p>
      {adminMutation.error && <Alert type="error">{adminMutation.error.message}</Alert>}
      {queryError && <Alert type="error">{queryError.message}</Alert>}
      <div className="tabs">
        {tabs.map(([k, label]) => (
          <div key={k} className={`tab ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>{label}</div>
        ))}
      </div>
      {tab === 'overview' && (
        <>
          <h3>Users</h3>
          <div className="grid cols-4 mb-18">
            <Stat num={stats.users.total} label="Total users" />
            <Stat num={stats.users.members} label="Member accounts" color="var(--brand)" />
            <Stat num={stats.users.agents} label="Agents" color="var(--green)" />
            <Stat num={stats.users.pending_kyc} label="Pending KYC" color="var(--amber)" />
          </div>
          <h3>Properties</h3>
          <div className="grid cols-4 mb-18">
            <Stat num={stats.properties.total} label="Total listings" />
            <Stat num={stats.properties.pending} label="Awaiting review" color="var(--amber)" />
            <Stat num={stats.properties.approved} label="Live" color="var(--green)" />
            <Stat num={stats.properties.sold} label="Sold" />
          </div>
          <div className="grid cols-4 mb-18">
            <Stat num={formatMoney(stats.properties.listed_value)} label="Total listed value" color="var(--brand)" />
            <Stat num={stats.engagement.interests} label="Buyer interests" />
            <Stat num={stats.engagement.appointments} label="Appointments" />
            <Stat num={stats.engagement.appointments_pending} label="Pending viewings" color="var(--amber)" />
          </div>
        </>
      )}
      {tab === 'listings' && (
        pending.length === 0 ? <p className="muted">Nothing awaiting review. 🎉</p> : (
          <div className="grid cols-2">
            {pending.map((p) => (
              <div key={p.id} className="card">
                <div className="flex between">
                  <Link to={`/properties/${p.id}`}><strong>{p.title}</strong></Link>
                  <Badge value={p.property_type} />
                </div>
                <p className="muted my-6">
                  {formatMoney(p.price)} · {p.city}, {p.state} · {p.listing_type}
                </p>
                <p className="font-size-13">{p.description}</p>
                <div className="muted font-size-13">
                  Seller: {p.seller_name} ({p.seller_email}) — KYC <Badge value={p.seller_kyc} />
                </div>
                <Input
                  label="Rejection reason (if rejecting)"
                  fieldClassName="mt-10"
                  value={reason[p.id] || ''}
                  onChange={(e) => setReason((r) => ({ ...r, [p.id]: e.target.value }))}
                />
                <div className="flex">
                  <button className="btn green small" onClick={() => review(p.id, 'approve')}>Approve</button>
                  <button className="btn danger small" onClick={() => review(p.id, 'reject')}>Reject</button>
                </div>
              </div>
            ))}
          </div>
        )
      )}
      {tab === 'users' && (
        <div className="table-wrap card p-0">
          <table>
            <thead><tr><th>Name</th><th>Email</th><th>Account</th><th>Agent</th><th>KYC</th><th>Active</th><th>Actions</th></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td><small>{u.email}</small></td>
                  <td><Badge value={u.role === 'admin' ? 'admin' : 'member'} /></td>
                  <td>{u.is_agent ? 'Yes' : 'No'}</td>
                  <td><Badge value={u.kyc_status} /></td>
                  <td>{u.active ? '✓' : '✗'}</td>
                  <td className="flex wrap">
                    {u.role !== 'admin' && (
                      <>
                        {u.kyc_status !== 'verified' && <button className="btn small green" onClick={() => reviewKyc(u.id, 'verified')}>Verify KYC</button>}
                        {u.kyc_status === 'pending' && <button className="btn small danger" onClick={() => reviewKyc(u.id, 'rejected')}>Reject KYC</button>}
                        <button className="btn small secondary" onClick={() => toggleAgent(u)}>{u.is_agent ? 'Remove agent flag' : 'Flag as agent'}</button>
                        <button className="btn small secondary" onClick={() => toggleActive(u)}>{u.active ? 'Deactivate' : 'Activate'}</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {tab === 'appointments' && (
        appts.length === 0 ? <p className="muted">No appointments.</p> : (
          <div className="table-wrap card p-0">
            <table>
              <thead><tr><th>Property</th><th>Buyer</th><th>Seller</th><th>When</th><th>Status</th></tr></thead>
              <tbody>
                {appts.map((a) => (
                  <tr key={a.id}>
                    <td>{a.title}</td><td>{a.buyer_name}</td><td>{a.seller_name}</td>
                    <td>{new Date(a.scheduled_at).toLocaleString()}</td>
                    <td><Badge value={a.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
      {tab === 'audit' && (
        <div className="table-wrap card p-0">
          <table>
            <thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Entity</th><th>Details</th></tr></thead>
            <tbody>
              {audit.map((a) => (
                <tr key={a.id}>
                  <td className="muted"><small>{a.created_at}</small></td>
                  <td>{a.actor_name || 'system'} {a.actor_role && <Badge value={a.actor_role} />}</td>
                  <td><code>{a.action}</code></td>
                  <td className="muted">{a.entity}{a.entity_id ? ` #${a.entity_id}` : ''}</td>
                  <td className="muted"><small>{a.meta ? JSON.stringify(a.meta) : '—'}</small></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
