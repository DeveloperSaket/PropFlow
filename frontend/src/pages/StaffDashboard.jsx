import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client.js';
import { adminQueries, queryKeys } from '../api/queries.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Alert, Badge, Stat, formatMoney } from '../components/ui.jsx';
import Spinner from '../lib/Spinner/index.jsx';
import { Input } from '../lib/Form/index.jsx';
import Empty from '../components/Empty/index.jsx';

export default function StaffDashboard() {
  const { user } = useAuth();
  const permissions = new Set(user.permissions || []);
  const can = (permission) => permissions.has(permission);
  const [tab, setTab] = useState('overview');
  const [reason, setReason] = useState({});
  const [selectedRoles, setSelectedRoles] = useState({});
  const queryClient = useQueryClient();
  const statsQuery = useQuery({
    queryKey: queryKeys.admin.stats,
    queryFn: adminQueries.stats,
    enabled: can('dashboard.read'),
  });
  const pendingQuery = useQuery({
    queryKey: queryKeys.admin.pendingListings,
    queryFn: adminQueries.pendingListings,
    enabled: can('listings.read'),
  });
  const usersQuery = useQuery({
    queryKey: queryKeys.admin.users,
    queryFn: adminQueries.users,
    enabled: can('users.read'),
  });
  const auditQuery = useQuery({
    queryKey: queryKeys.admin.audit,
    queryFn: adminQueries.audit,
    enabled: can('audit.read'),
  });
  const appointmentsQuery = useQuery({
    queryKey: queryKeys.admin.appointments,
    queryFn: adminQueries.appointments,
    enabled: can('appointments.read'),
  });
  const staffRolesQuery = useQuery({
    queryKey: queryKeys.admin.staffRoles,
    queryFn: adminQueries.staffRoles,
    enabled: can('staff.manage'),
  });
  const roleRequestsQuery = useQuery({
    queryKey: queryKeys.admin.roleRequests,
    queryFn: adminQueries.roleRequests,
    enabled: can('staff.requests.review'),
  });

  const queries = [
    [statsQuery, can('dashboard.read')],
    [pendingQuery, can('listings.read')],
    [usersQuery, can('users.read')],
    [auditQuery, can('audit.read')],
    [appointmentsQuery, can('appointments.read')],
    [staffRolesQuery, can('staff.manage')],
    [roleRequestsQuery, can('staff.requests.review')],
  ];
  const activeQueries = queries.filter(([, enabled]) => enabled).map(([query]) => query);
  const queryError = activeQueries.find((query) => query.error)?.error;
  const stats = statsQuery.data;
  const pending = pendingQuery.data || [];
  const users = usersQuery.data || [];
  const audit = auditQuery.data || [];
  const appointments = appointmentsQuery.data || [];
  const roles = staffRolesQuery.data || [];
  const roleRequests = roleRequestsQuery.data || [];

  const invalidate = async (...keys) => Promise.all(
    keys.map((queryKey) => queryClient.invalidateQueries({ queryKey }))
  );
  const actionMutation = useMutation({
    mutationFn: ({ path, body }) => api.patch(path, body),
    onSuccess: (_data, variables) => invalidate(...variables.invalidate),
  });
  const review = (id, decision) => actionMutation.mutate({
    path: `/admin/listings/${id}/review`,
    body: { decision, reason: reason[id] },
    invalidate: [queryKeys.admin.pendingListings, queryKeys.admin.stats, queryKeys.admin.audit, queryKeys.properties.all],
  });
  const toggleFeatured = (id) => actionMutation.mutate({
    path: `/admin/listings/${id}/feature`,
    body: {},
    invalidate: [queryKeys.admin.pendingListings, queryKeys.admin.stats, queryKeys.admin.audit],
  });
  const reviewKyc = (id, status) => actionMutation.mutate({
    path: `/admin/users/${id}/kyc`,
    body: { status },
    invalidate: [queryKeys.admin.users, queryKeys.admin.stats, queryKeys.admin.audit],
  });
  const toggleActive = (account) => actionMutation.mutate({
    path: `/admin/users/${account.id}/active`,
    body: { active: !account.active },
    invalidate: [queryKeys.admin.users, queryKeys.admin.stats, queryKeys.admin.audit],
  });
  const toggleAgent = (account) => actionMutation.mutate({
    path: `/admin/users/${account.id}/agent`,
    body: { is_agent: !account.is_agent },
    invalidate: [queryKeys.admin.users, queryKeys.admin.audit],
  });
  const changeStaffRole = (account, assigned) => actionMutation.mutate({
    path: `/admin/users/${account.id}/staff-roles`,
    body: { role_key: selectedRoles[account.id] || roles[0]?.role_key, assigned },
    invalidate: [queryKeys.admin.users, queryKeys.admin.audit],
  });
  const reviewRoleRequest = (requestId, decision) => actionMutation.mutate({
    path: `/admin/staff/role-requests/${requestId}`,
    body: { decision },
    invalidate: [queryKeys.admin.roleRequests, queryKeys.admin.users, queryKeys.admin.audit],
  });

  if (activeQueries.some((query) => query.isPending)) return <Spinner />;
  if (queryError && activeQueries.some((query) => query.data === undefined)) {
    return <div className="container"><Alert type="error">{queryError.message}</Alert></div>;
  }

  const tabs = [
    ['overview', 'Overview', can('dashboard.read')],
    ['listings', `Review Queue (${pending.length})`, can('listings.read')],
    ['users', `Users (${users.length})`, can('users.read')],
    ['appointments', 'Appointments', can('appointments.read')],
    ['audit', 'Audit Log', can('audit.read')],
    ['staff', `Staff access (${roleRequests.length})`, can('staff.manage') && can('staff.requests.review')],
  ].filter(([, , visible]) => visible);

  return (
    <div className="container">
      <h1 className="page-title">Staff dashboard</h1>
      <p className="subtle">Signed in as {user.name}. Access is based on your assigned staff permissions.</p>
      {actionMutation.error && <Alert type="error">{actionMutation.error.message}</Alert>}
      {queryError && <Alert type="error">{queryError.message}</Alert>}
      <div className="tabs">
        {tabs.map(([key, label]) => (
          <button
            type="button"
            key={key}
            className={`tab ${tab === key ? 'active' : ''}`}
            onClick={() => setTab(key)}
          >{label}</button>
        ))}
      </div>

      {tab === 'overview' && stats && (
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
        pending.length === 0 ? (
          <Empty title="Queue is clear" description="There are no listings awaiting review." />
        ) : (
          <div className="grid cols-2">
            {pending.map((property) => (
              <section key={property.id} className="card">
                <div className="flex between">
                  <Link to={`/properties/${property.id}`}><strong>{property.title}</strong></Link>
                  <Badge value={property.property_type} />
                </div>
                <p className="muted my-6">
                  {formatMoney(property.price)} · {property.city}, {property.state} · {property.listing_type}
                </p>
                <p className="font-size-13">{property.description}</p>
                <div className="muted font-size-13">
                  Seller: {property.seller_name} ({property.seller_email}) — KYC <Badge value={property.seller_kyc} />
                </div>
                {can('listings.feature') && (
                  <button className="btn small secondary" onClick={() => toggleFeatured(property.id)}>
                    {property.featured ? 'Remove featured' : 'Feature listing'}
                  </button>
                )}
                {can('listings.review') && (
                  <>
                    <Input
                      label="Rejection reason (if rejecting)"
                      fieldClassName="mt-10"
                      value={reason[property.id] || ''}
                      onChange={(event) => setReason((current) => ({ ...current, [property.id]: event.target.value }))}
                    />
                    <div className="flex">
                      <button className="btn green small" onClick={() => review(property.id, 'approve')}>Approve</button>
                      <button className="btn danger small" onClick={() => review(property.id, 'reject')}>Reject</button>
                    </div>
                  </>
                )}
              </section>
            ))}
          </div>
        )
      )}

      {tab === 'users' && (
        users.length === 0 ? (
          <Empty title="No users found" description="User accounts will appear here when they register." />
        ) : (
          <div className="table-wrap card p-0">
            <table>
              <thead><tr><th>Name</th><th>Email</th><th>Agent</th><th>KYC</th><th>Active</th><th>Staff roles</th><th>Actions</th></tr></thead>
              <tbody>
                {users.map((account) => (
                  <tr key={account.id}>
                    <td>{account.name}</td>
                    <td><small>{account.email}</small></td>
                    <td>{account.is_agent ? 'Yes' : 'No'}</td>
                    <td><Badge value={account.kyc_status} /></td>
                    <td>{account.active ? '✓' : '✗'}</td>
                    <td>{(account.staff_roles || []).map((key) => <Badge value={key} key={key} />)}</td>
                    <td className="flex wrap">
                      {can('kyc.review') && account.role !== 'admin' && account.kyc_status !== 'verified' && (
                        <button className="btn small green" onClick={() => reviewKyc(account.id, 'verified')}>Verify KYC</button>
                      )}
                      {can('kyc.review') && account.role !== 'admin' && account.kyc_status === 'pending' && (
                        <button className="btn small danger" onClick={() => reviewKyc(account.id, 'rejected')}>Reject KYC</button>
                      )}
                      {can('users.agent') && account.role !== 'admin' && (
                        <button className="btn small secondary" onClick={() => toggleAgent(account)}>
                          {account.is_agent ? 'Remove agent flag' : 'Flag as agent'}
                        </button>
                      )}
                      {can('users.manage') && account.role !== 'admin' && (
                        <button className="btn small secondary" onClick={() => toggleActive(account)}>
                          {account.active ? 'Deactivate' : 'Activate'}
                        </button>
                      )}
                      {can('staff.manage') && (
                        <div className="flex wrap">
                          <select
                            aria-label={`Role to assign to ${account.email}`}
                            value={selectedRoles[account.id] || roles[0]?.role_key || ''}
                            onChange={(event) => setSelectedRoles((current) => ({ ...current, [account.id]: event.target.value }))}
                          >
                            {roles.map((role) => <option key={role.role_key} value={role.role_key}>{role.name}</option>)}
                          </select>
                          <button
                            className="btn small secondary"
                            onClick={() => changeStaffRole(account, true)}
                            disabled={!roles.length || account.staff_roles?.includes(selectedRoles[account.id] || roles[0]?.role_key)}
                          >Assign role</button>
                          {account.staff_roles?.length > 0 && (
                            <select
                              aria-label={`Role to revoke from ${account.email}`}
                              value={selectedRoles[`revoke-${account.id}`] || account.staff_roles[0]}
                              onChange={(event) => setSelectedRoles((current) => ({ ...current, [`revoke-${account.id}`]: event.target.value }))}
                            >
                              {account.staff_roles.map((key) => <option key={key} value={key}>{key}</option>)}
                            </select>
                          )}
                          {account.staff_roles?.length > 0 && (
                            <button
                              className="btn small danger"
                              onClick={() => {
                                const roleKey = selectedRoles[`revoke-${account.id}`] || account.staff_roles[0];
                                actionMutation.mutate({
                                  path: `/admin/users/${account.id}/staff-roles`,
                                  body: { role_key: roleKey, assigned: false },
                                  invalidate: [queryKeys.admin.users, queryKeys.admin.audit],
                                });
                              }}
                            >Revoke role</button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {tab === 'appointments' && (
        appointments.length === 0 ? (
          <Empty title="No appointments" description="Scheduled property viewings will appear here." />
        ) : (
          <div className="table-wrap card p-0">
            <table>
              <thead><tr><th>Property</th><th>Buyer</th><th>Seller</th><th>When</th><th>Status</th></tr></thead>
              <tbody>{appointments.map((item) => (
                <tr key={item.id}>
                  <td>{item.title}</td><td>{item.buyer_name}</td><td>{item.seller_name}</td>
                  <td>{new Date(item.scheduled_at).toLocaleString()}</td><td><Badge value={item.status} /></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )
      )}

      {tab === 'audit' && (
        audit.length === 0 ? (
          <Empty title="No audit activity" description="Platform activity will appear here as it happens." />
        ) : (
          <div className="table-wrap card p-0">
            <table>
              <thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Entity</th><th>Details</th></tr></thead>
              <tbody>{audit.map((item) => (
                <tr key={item.id}>
                  <td className="muted"><small>{item.created_at}</small></td>
                  <td>
                    {item.actor_name || 'system'} {item.actor_role && <Badge value={item.actor_role} />}
                    {item.actor_staff_roles && <small className="block">{item.actor_staff_roles}</small>}
                  </td>
                  <td><code>{item.action}</code></td>
                  <td className="muted">{item.entity}{item.entity_id ? ` #${item.entity_id}` : ''}</td>
                  <td className="muted"><small>{item.meta ? JSON.stringify(item.meta) : '—'}</small></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )
      )}

      {tab === 'staff' && (
        <>
          <h2>Pending role requests</h2>
          {roleRequests.length === 0 ? (
            <Empty title="No pending requests" description="Staff role requests will appear here." />
          ) : (
            <div className="grid">
              {roleRequests.map((request) => (
                <section className="card" key={request.id}>
                  <div className="flex between">
                    <strong>{request.requester_name} — {request.requester_email}</strong>
                    <Badge value={request.role_name} />
                  </div>
                  <p>{request.justification}</p>
                  <small className="muted">Submitted {new Date(request.created_at).toLocaleString()}</small>
                  <div className="flex mt-10">
                    <button className="btn green small" onClick={() => reviewRoleRequest(request.id, 'approve')}>Approve</button>
                    <button className="btn danger small" onClick={() => reviewRoleRequest(request.id, 'reject')}>Reject</button>
                  </div>
                </section>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
