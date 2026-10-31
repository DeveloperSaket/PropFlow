import { useState } from 'react';
import { api } from '../api/client.js';
import { kycQuery, queryKeys } from '../api/queries.js';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Spinner from '../lib/Spinner/index.jsx';
import { Badge, Alert } from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import Form, { FileInput, Select } from '../lib/Form/index.jsx';
export default function Kyc() {
  const { user, refresh } = useAuth();
  const queryClient = useQueryClient();
  const { data: kyc, isPending, error } = useQuery({
    queryKey: queryKeys.kyc(user.id),
    queryFn: kycQuery,
  });
  const docs = kyc?.data || [];
  const status = kyc?.kyc_status || user?.kyc_status;
  const [docType, setDocType] = useState('national_id');
  const [file, setFile] = useState(null);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const submitMutation = useMutation({
    mutationFn: (formData) => api.upload('/compliance/kyc', formData),
    onSuccess: async () => {
      setOk('Document submitted. Our compliance team will review it shortly.');
      setFile(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.kyc(user.id) }),
        refresh(),
      ]);
    },
  });
  const submit = async (e) => {
    e.preventDefault();
    setErr(''); setOk('');
    if (!file) return setErr('Please choose a file.');
    const formData = new FormData();
    formData.append('doc_type', docType);
    formData.append('document', file);
    try {
      await submitMutation.mutateAsync(formData);
      e.target.reset();
    } catch (error) {
      setErr(error.message);
    }
  };
  if (isPending) return <Spinner />;
  if (error && !kyc) return <div className="container"><Alert type="error">{error.message}</Alert></div>;
  return (
    <div className="container max-width-720">
      <h1 className="page-title">Compliance &amp; KYC</h1>
      <p className="subtle">
        Verify your identity to unlock full platform features
        {user?.role !== 'admin' ? ' (required before listing a property).' : '.'}
      </p>
      {error && <Alert type="error">{error.message}</Alert>}
      <div className="card flex between mb-18">
        <span>Current KYC status</span>
        <Badge value={status || 'unverified'} />
      </div>
      {status === 'verified' ? (
        <Alert type="success">Your identity is verified. You're all set!</Alert>
      ) : (
        <Form className="card" onSubmit={submit}>
          <Alert type="error">{err}</Alert>
          <Alert type="success">{ok}</Alert>
            <Select label="Document type" value={docType} onChange={(e) => setDocType(e.target.value)} required>
              <option value="national_id">National ID</option>
              <option value="passport">Passport</option>
              <option value="driving_license">Driving License</option>
              <option value="property_deed">Property Deed (sellers)</option>
            </Select>
            <FileInput label="Upload document (PDF/PNG/JPG, max 5MB)" accept=".pdf,.png,.jpg,.jpeg" onChange={(e) => setFile(e.target.files[0])} required />
          <button className="btn" disabled={submitMutation.isPending}>{submitMutation.isPending ? 'Uploading…' : 'Submit for review'}</button>
        </Form>
      )}
      <h3 className="mt-26">Submitted documents</h3>
      {docs.length === 0 ? (
        <p className="muted">No documents submitted yet.</p>
      ) : (
        <div className="table-wrap card p-0">
          <table>
            <thead><tr><th>Type</th><th>Submitted</th><th>Status</th><th>Note</th></tr></thead>
            <tbody>
              {docs.map((d) => (
                <tr key={d.id}>
                  <td>{d.doc_type.replace('_', ' ')}</td>
                  <td>{d.created_at}</td>
                  <td><Badge value={d.status} /></td>
                  <td className="muted">{d.note || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}