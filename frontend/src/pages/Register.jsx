import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { Alert } from '../components/ui.jsx';
export default function Register() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({
    role: 'buyer', name: '', email: '', phone: '', password: '', acceptTerms: false,
  });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) =>
    setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const submit = async (e) => {
    e.preventDefault();
    setErr(''); setBusy(true);
    try {
      const u = await register(form);
      nav(u.role === 'seller' ? '/seller' : '/buyer');
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  return (
    <div className="container max-width-480">
      <h1 className="page-title">Create your account</h1>
      <p className="subtle">Join as a buyer or a seller.</p>
      <form className="card" onSubmit={submit}>
        <Alert type="error">{err}</Alert>
        <div className="field">
          <label>I want to</label>
          <select value={form.role} onChange={set('role')}>
            <option value="buyer">Buy / rent a property</option>
            <option value="seller">List / sell my property</option>
          </select>
        </div>
        <div className="field">
          <label>Full name</label>
          <input value={form.name} onChange={set('name')} required />
        </div>
        <div className="field">
          <label>Email</label>
          <input type="email" value={form.email} onChange={set('email')} required />
        </div>
        <div className="field">
          <label>Phone</label>
          <input value={form.phone} onChange={set('phone')} placeholder="Optional" />
        </div>
        <div className="field">
          <label>Password</label>
          <input type="password" value={form.password} onChange={set('password')} required minLength={8} />
          <small className="muted">At least 8 characters.</small>
        </div>
        <div className="field flex gap-8">
          <input type="checkbox" className="w-auto" checked={form.acceptTerms} onChange={set('acceptTerms')} id="terms" />
          <label htmlFor="terms" className="m-0">
            I accept the Terms of Service &amp; Compliance policy (KYC may be required).
          </label>
        </div>
        <button className="btn w-full" disabled={busy}>
          {busy ? 'Creating…' : 'Create account'}
        </button>
        <p className="muted center mt-14">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </form>
    </div>
  );
}
