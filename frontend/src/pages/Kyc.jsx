import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { Badge, Alert } from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
export default function Kyc() {
  const { user, refresh } = useAuth();
  const [docs, setDocs] = useState([]);
  const [status, setStatus] = useState(user?.kyc_status);
  const [docType, setDocType] = useState('national_id');
  const [file, setFile] = useState(null);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);
  const load = () => api.get('/compliance/kyc/mine').then((r) => { setDocs(r.data); setStatus(r.kyc_status); });
  useEffect(() => { load(); }, []);
  const submit = async (e) => {
    e.preventDefault();
    setErr(''); setOk('');
    if (!file) return setErr('Please choose a file.');
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('doc_type', docType);
      fd.append('document', file);
      const r = await api.upload('/compliance/kyc', fd);
      setOk('Document submitted. Our compliance team will review it shortly.');
      setStatus(r.kyc_status);
      setFile(null);
      e.target.reset();
      load();
      refresh();
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  return (
    <div className="container" style={{ maxWidth: 720 }}>
      <h1 className="page-title">Compliance &amp; KYC</h1>
      <p className="subtle">
        Verify your identity to unlock full platform features
        {user?.role === 'seller' ? ' (required before listing a property).' : '.'}
      </p>
      <div className="card flex between" style={{ marginBottom: 18 }}>
        <span>Current KYC status</span>
        <Badge value={status || 'unverified'} />
      </div>
      {status === 'verified' ? (
        <Alert type="success">Your identity is verified. You're all set!</Alert>
      ) : (
        <form className="card" onSubmit={submit}>
          <Alert type="error">{err}</Alert>
          <Alert type="success">{ok}</Alert>
          <div className="field">
            <label>Document type</label>
            <select value={docType} onChange={(e) => setDocType(e.target.value)}>
              <option value="national_id">National ID</option>
              <option value="passport">Passport</option>
              <option value="driving_license">Driving License</option>
              <option value="property_deed">Property Deed (sellers)</option>
            </select>
          </div>
          <div className="field">
            <label>Upload document (PDF/PNG/JPG, max 5MB)</label>
            <input type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={(e) => setFile(e.target.files[0])} />
          </div>
          <button className="btn" disabled={busy}>{busy ? 'Uploading…' : 'Submit for review'}</button>
        </form>
      )}
      <h3 style={{ marginTop: 26 }}>Submitted documents</h3>
      {docs.length === 0 ? (
        <p className="muted">No documents submitted yet.</p>
      ) : (
        <div className="table-wrap card" style={{ padding: 0 }}>
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