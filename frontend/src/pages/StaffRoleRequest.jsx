import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Badge } from '../components/ui.jsx';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import Empty from '../components/Empty/index.jsx';
import Spinner from '../lib/Spinner/index.jsx';
import Form, { Select, Textarea } from '../lib/Form/index.jsx';

export default function StaffRoleRequest() {
  const { user, refresh } = useAuth();
  const queryClient = useQueryClient();
  const [roleKey, setRoleKey] = useState('');
  const [justification, setJustification] = useState('');
  const requestQuery = useQuery({
    queryKey: ['staff', 'role-requests', user.id],
    queryFn: () => api.get('/staff/roles'),
  });
  const assignedSignature = [...(requestQuery.data?.data?.assigned || [])].sort().join(',');
  const localRoleSignature = [...(user.staff_roles || [])].sort().join(',');
  useEffect(() => {
    if (assignedSignature && assignedSignature !== localRoleSignature) refresh();
  }, [assignedSignature, localRoleSignature, refresh]);
  const requestMutation = useMutation({
    mutationFn: () => api.post('/staff/role-requests', { role_key: roleKey, justification }),
    onSuccess: () => {
      setRoleKey('');
      setJustification('');
      return queryClient.invalidateQueries({ queryKey: ['staff', 'role-requests', user.id] });
    },
  });

  if (requestQuery.isPending) return <Spinner />;
  if (requestQuery.error) {
    return <div className="container"><Alert type="error">{requestQuery.error.message}</Alert></div>;
  }

  const { eligible, data } = requestQuery.data;

  const assigned = new Set(data.assigned);
  const pending = new Set(data.requests.filter((item) => item.status === 'pending').map((item) => item.role_key));
  const availableRoles = data.roles.filter((role) => !assigned.has(role.role_key) && !pending.has(role.role_key));

  return (
    <div className="container max-width-720">
      <h1 className="page-title">Request staff access</h1>
      <p className="subtle">Staff role requests are reviewed and assigned by an Owner.</p>
      {!eligible ? (
        <Alert type="error">Requests are available only to accounts using a @negobrick.com email address.</Alert>
      ) : (
        <>
          <Alert type="info">
            Requests do not grant access immediately. An Owner must review and approve your request.
            The email domain is checked, but this application does not currently verify email ownership.
          </Alert>
          {availableRoles.length > 0 ? (
            <Form className="card" onSubmit={(event) => { event.preventDefault(); requestMutation.mutate(); }}>
              <Select
                label="Role requested"
                value={roleKey}
                onChange={(event) => setRoleKey(event.target.value)}
                required
              >
                <option value="">Select a role</option>
                {availableRoles.map((role) => (
                  <option value={role.role_key} key={role.role_key}>{role.name} — {role.description}</option>
                ))}
              </Select>
              <Textarea
                label="Justification"
                hint="Explain the responsibilities that require this access (30–2000 characters)."
                value={justification}
                onChange={(event) => setJustification(event.target.value)}
                minLength={30}
                maxLength={2000}
                required
              />
              {requestMutation.error && <Alert type="error">{requestMutation.error.message}</Alert>}
              {requestMutation.isSuccess && <Alert type="success">Your request was submitted for Owner review.</Alert>}
              <button className="btn" disabled={requestMutation.isPending || !roleKey}>
                {requestMutation.isPending ? 'Submitting…' : 'Submit request'}
              </button>
            </Form>
          ) : (
            <Empty title="No roles available to request" description="You already have all requestable roles or have pending requests." />
          )}
        </>
      )}
      <h2 className="mt-24">Your requests and roles</h2>
      {data.assigned.length > 0 && (
        <p>Assigned roles: {data.assigned.map((key) => <Badge value={key} key={key} />)}</p>
      )}
      {data.requests.length === 0 ? (
        <p className="muted">You have not submitted any role requests.</p>
      ) : (
        <div className="grid">
          {data.requests.map((request) => (
            <section className="card" key={request.id}>
              <div className="flex between">
                <strong>{request.role_name}</strong>
                <Badge value={request.status} />
              </div>
              <p>{request.justification}</p>
              {request.review_note && <p className="muted">Review note: {request.review_note}</p>}
              <small className="muted">Submitted {new Date(request.created_at).toLocaleString()}</small>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
