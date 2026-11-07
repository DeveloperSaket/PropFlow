import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Alert, Badge } from '../components/ui.jsx';
import Spinner from '../lib/Spinner/index.jsx';
import Form, { Input } from '../lib/Form/index.jsx';

function Detail({ label, children }) {
  return (
    <div>
      <dt className="muted">{label}</dt>
      <dd>{children || '—'}</dd>
    </div>
  );
}

export default function Profile() {
  const { user, changePassword } = useAuth();
  const queryClient = useQueryClient();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [validationError, setValidationError] = useState('');
  const profileQuery = useQuery({
    queryKey: ['profile', user.id],
    queryFn: async () => {
      const response = await api.get('/auth/me');
      return response.user;
    },
  });
  const passwordMutation = useMutation({
    mutationFn: () => changePassword(currentPassword, newPassword),
    onSuccess: (updatedUser) => {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setValidationError('');
      return queryClient.setQueryData(['profile', updatedUser.id], updatedUser);
    },
  });

  if (profileQuery.isPending) return <Spinner />;
  if (profileQuery.error) {
    return <div className="container"><Alert type="error">{profileQuery.error.message}</Alert></div>;
  }

  const profile = profileQuery.data;
  const accountType = profile.role === 'admin' ? 'Legacy admin account' : 'Member account';

  const submitPasswordChange = (event) => {
    event.preventDefault();
    setValidationError('');
    if (newPassword !== confirmPassword) {
      setValidationError('The new passwords do not match.');
      return;
    }
    if (currentPassword === newPassword) {
      setValidationError('Choose a password different from your current password.');
      return;
    }
    passwordMutation.mutate();
  };

  return (
    <div className="container max-width-720">
      <h1 className="page-title">Your profile</h1>
      <p className="subtle">Your PropFlow account information and security settings.</p>

      <section className="card">
        <h2>Account details</h2>
        <dl className="profile-details">
          <Detail label="Name">{profile.name}</Detail>
          <Detail label="Email">{profile.email}</Detail>
          <Detail label="Phone">{profile.phone}</Detail>
          <Detail label="Account type">{accountType}</Detail>
          <Detail label="Account status"><Badge value={profile.active ? 'active' : 'inactive'} /></Detail>
          <Detail label="Agent status">{profile.is_agent ? 'Agent' : 'Not an agent'}</Detail>
          <Detail label="KYC status"><Badge value={profile.kyc_status} /></Detail>
          <Detail label="Staff roles">
            {profile.staff_roles?.length
              ? profile.staff_roles.map((role) => <Badge value={role} key={role} />)
              : 'No staff roles'}
          </Detail>
          {profile.staff_profile && (
            <>
              <Detail label="Job title">{profile.staff_profile.job_title}</Detail>
              <Detail label="Team">{profile.staff_profile.team}</Detail>
              <Detail label="Employment status">
                <Badge value={profile.staff_profile.employment_status} />
              </Detail>
            </>
          )}
          <Detail label="Member since">
            {profile.created_at ? new Date(profile.created_at).toLocaleDateString() : '—'}
          </Detail>
        </dl>
      </section>

      <section className="card mt-16">
        <h2>Change password</h2>
        <p className="muted">
          Enter your current password to set a new one. Changing it signs out other active sessions.
        </p>
        <Form onSubmit={submitPasswordChange}>
          <Input
            label="Current password"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            required
          />
          <Input
            label="New password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            required
          />
          <Input
            label="Confirm new password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            required
          />
          {validationError && <Alert type="error">{validationError}</Alert>}
          {passwordMutation.error && <Alert type="error">{passwordMutation.error.message}</Alert>}
          {passwordMutation.isSuccess && (
            <Alert type="success">Password changed. Your other active sessions have been signed out.</Alert>
          )}
          <button className="btn" disabled={passwordMutation.isPending}>
            {passwordMutation.isPending ? 'Changing password…' : 'Change password'}
          </button>
        </Form>
      </section>
    </div>
  );
}
