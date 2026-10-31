import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { Alert } from '../components/ui.jsx';
import Form, { Checkbox, Input, PhoneInput } from '../lib/Form/index.jsx';
export default function Register() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({
    name: '', email: '', phone: '', password: '', acceptTerms: false,
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
      nav('/buyer');
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  return (
    <div className="container max-width-480">
      <h1 className="page-title">Create your account</h1>
      <p className="subtle">One account gives you access to both buying and listing properties.</p>
      <Form className="card" onSubmit={submit}>
        <Alert type="error">{err}</Alert>
        <Input label="Full name" autoComplete="name" value={form.name} onChange={set('name')} required />
        <Input label="Email" type="email" autoComplete="email" value={form.email} onChange={set('email')} required />
        <PhoneInput label="Phone (optional)" value={form.phone} onChange={set('phone')} />
        <Input label="Password" type="password" autoComplete="new-password" value={form.password} onChange={set('password')} required minLength={8} hint="At least 8 characters." />
        <Checkbox
          id="terms"
          label={<>I agree to the <a href="/static/compliance/account-terms-and-condition" target="_blank" rel="noopener noreferrer">Account Terms and Conditions</a> (KYC may be required).</>}
          checked={form.acceptTerms}
          onChange={set('acceptTerms')}
          required
        />
        <button className="btn w-full" disabled={busy}>
          {busy ? 'Creating…' : 'Create account'}
        </button>
        <p className="muted center mt-14">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </Form>
    </div>
  );
}
