'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LockKeyhole, ShieldCheck, UserPlus } from 'lucide-react';
import { apiRequest, login as loginRequest } from '../../lib/api';
import { isDashboardRole, saveSession } from '../../lib/auth';
import styles from '../../components/dashboard.module.css';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState('signin');
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', password: '' });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  function setField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSignIn(event) {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      const { token } = await loginRequest(form.email.trim().toLowerCase(), form.password);
      if (!token) throw new Error('Sign in failed. Please try again.');

      const profile = await apiRequest('/auth/me', {}, token);
      const user = profile.user || profile;

      if (!isDashboardRole(user.role)) {
        throw new Error('This account is not an estate manager account. Use the mobile app or the admin dashboard instead.');
      }

      saveSession(token, user);
      router.replace('/dashboard');
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRegister(event) {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      const data = await apiRequest('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          fullName: form.fullName,
          email: form.email.trim().toLowerCase(),
          phone: form.phone,
          password: form.password,
          role: 'estate_manager',
        }),
      });
      const token = data.tokens?.accessToken;
      if (!token) throw new Error('Account created, but sign-in failed. Please sign in manually.');
      saveSession(token, data.user);
      router.replace('/dashboard');
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className={styles.loginPage}>
      <div className={styles.loginCard}>
        <div className={styles.loginBrand}>
          <ShieldCheck size={30} color="var(--primary)" />
          <h1>EstateFlow Manager</h1>
          <p>Self-onboard your estate, submit verification documents, and manage plots, sales, and residents.</p>
        </div>

        <div className={styles.roleSwitch}>
          <button className={mode === 'signin' ? styles.roleSwitchActive : ''} onClick={() => setMode('signin')} type="button">Sign in</button>
          <button className={mode === 'register' ? styles.roleSwitchActive : ''} onClick={() => setMode('register')} type="button">Create account</button>
        </div>

        {error ? <div className={styles.loginError}>{error}</div> : null}

        {mode === 'signin' ? (
          <form className={styles.loginForm} onSubmit={handleSignIn}>
            <label>
              <span>Email</span>
              <input autoComplete="email" autoFocus onChange={(event) => setField('email', event.target.value)} placeholder="manager@estate.com" type="email" value={form.email} />
            </label>
            <label>
              <span>Password</span>
              <input autoComplete="current-password" onChange={(event) => setField('password', event.target.value)} placeholder="Enter password" type="password" value={form.password} />
            </label>
            <button className={`${styles.actionButton} ${styles.positive}`} disabled={isSubmitting || !form.email || !form.password} type="submit">
              <LockKeyhole size={17} />
              <span>{isSubmitting ? 'Signing in...' : 'Sign in'}</span>
            </button>
          </form>
        ) : (
          <form className={styles.loginForm} onSubmit={handleRegister}>
            <label>
              <span>Full name</span>
              <input onChange={(event) => setField('fullName', event.target.value)} placeholder="e.g. Chidi Okonkwo" value={form.fullName} />
            </label>
            <label>
              <span>Email</span>
              <input autoComplete="email" onChange={(event) => setField('email', event.target.value)} placeholder="manager@estate.com" type="email" value={form.email} />
            </label>
            <label>
              <span>Phone</span>
              <input onChange={(event) => setField('phone', event.target.value)} placeholder="e.g. 08012345678" value={form.phone} />
            </label>
            <label>
              <span>Password</span>
              <input autoComplete="new-password" onChange={(event) => setField('password', event.target.value)} placeholder="Choose a password" type="password" value={form.password} />
            </label>
            <button className={`${styles.actionButton} ${styles.positive}`} disabled={isSubmitting || !form.fullName || !form.email || !form.password} type="submit">
              <UserPlus size={17} />
              <span>{isSubmitting ? 'Creating account...' : 'Create estate manager account'}</span>
            </button>
          </form>
        )}

        <p className={styles.loginFooterNote}>
          New accounts start unverified. Complete the Verification tab after signing in to unlock estate, plot, and sales tools.
        </p>
      </div>
    </main>
  );
}
