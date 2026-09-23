'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LockKeyhole, ShieldCheck } from 'lucide-react';
import { apiRequest, login as loginRequest } from '../../lib/api';
import { isDashboardRole, saveSession } from '../../lib/auth';
import styles from '../../components/dashboard.module.css';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      const { token } = await loginRequest(email.trim().toLowerCase(), password);
      if (!token) throw new Error('Sign in failed. Please try again.');

      const profile = await apiRequest('/auth/me', {}, token);
      const user = profile.user || profile;

      if (!isDashboardRole(user.role)) {
        throw new Error('This account does not have access to the admin dashboard. Estate managers and other roles use the mobile app.');
      }
      if (user.accountStatus && user.accountStatus !== 'active') {
        throw new Error('This account is restricted. Contact the Master Owner.');
      }

      saveSession(token, user);
      // Staff admin (reviewer) accounts land straight on Verification, the only
      // section they have — the overview dashboard shows platform-wide data
      // that's Master Owner-only.
      router.replace(user.role === 'super_admin' ? '/dashboard' : '/dashboard/verification');
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
          <h1>EstateFlow Admin</h1>
          <p>Owner-only control panel. Estate managers do not have access to this dashboard.</p>
        </div>

        {error ? <div className={styles.loginError}>{error}</div> : null}

        <form className={styles.loginForm} onSubmit={handleSubmit}>
          <label>
            <span>Email</span>
            <input
              autoComplete="email"
              autoFocus
              onChange={(event) => setEmail(event.target.value)}
              placeholder="owner@estateflow.com"
              type="email"
              value={email}
            />
          </label>
          <label>
            <span>Password</span>
            <input
              autoComplete="current-password"
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter password"
              type="password"
              value={password}
            />
          </label>
          <button className={`${styles.actionButton} ${styles.positive}`} disabled={isSubmitting || !email || !password} type="submit">
            <LockKeyhole size={17} />
            <span>{isSubmitting ? 'Signing in...' : 'Sign in'}</span>
          </button>
        </form>

        <p className={styles.loginFooterNote}>
          Need access? A Master Owner can create a staff admin account from Staff Accounts in the dashboard.
        </p>
      </div>
    </main>
  );
}
