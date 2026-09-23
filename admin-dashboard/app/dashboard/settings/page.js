'use client';

import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { apiRequest } from '../../../lib/api';
import { useAdminSession } from '../../../lib/auth';
import { DashboardShell } from '../../../components/DashboardShell';
import { ActionButton } from '../../../components/ActionButton';
import { EmptyState } from '../../../components/EmptyState';
import styles from '../../../components/dashboard.module.css';

export default function SettingsPage() {
  const { token, status, isSuperAdmin } = useAdminSession();
  const [buyerFeePercent, setBuyerFeePercent] = useState('');
  const [sellerCommissionPercent, setSellerCommissionPercent] = useState('');
  const [guestPassFee, setGuestPassFee] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isSavingCommission, setIsSavingCommission] = useState(false);
  const [isSavingGuestFee, setIsSavingGuestFee] = useState(false);

  useEffect(() => {
    if (!token || !isSuperAdmin) return;
    apiRequest('/payments/settings/fees', {}, token)
      .then((data) => { setBuyerFeePercent(String(data.buyerTransactionFeePercent ?? '')); setSellerCommissionPercent(String(data.sellerCommissionPercent ?? '')); })
      .catch((err) => setError(err.message));
    apiRequest('/wallet/settings/guest-pass-fee', {}, token)
      .then((data) => setGuestPassFee(String(data.guestPassFee ?? '')))
      .catch((err) => setError(err.message));
  }, [token, isSuperAdmin]);

  async function handleSaveCommission(event) {
    event.preventDefault();
    setError('');
    setMessage('');
    setIsSavingCommission(true);
    try {
      await apiRequest(
        '/payments/settings/fees',
        { method: 'PATCH', body: JSON.stringify({ buyerTransactionFeePercent: Number(buyerFeePercent), sellerCommissionPercent: Number(sellerCommissionPercent) }) },
        token,
      );
      setMessage('Buyer fee and seller commission rates updated.');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSavingCommission(false);
    }
  }

  async function handleSaveGuestFee(event) {
    event.preventDefault();
    setError('');
    setMessage('');
    setIsSavingGuestFee(true);
    try {
      await apiRequest(
        '/wallet/settings/guest-pass-fee',
        { method: 'PATCH', body: JSON.stringify({ guestPassFee: Number(guestPassFee) }) },
        token,
      );
      setMessage('Guest pass fee updated.');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSavingGuestFee(false);
    }
  }

  if (status !== 'ready') return null;

  if (!isSuperAdmin) {
    return (
      <DashboardShell title="Platform Settings" subtitle="Sensitive platform-level controls.">
        <EmptyState title="Master Owner access required" body="Only the Master Owner account can change platform-wide financial settings." />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell title="Platform Settings" subtitle="Control sensitive platform actions available only to the Master Owner.">
      {error ? <div className={styles.loginError}>{error}</div> : null}
      {message ? <div className={styles.credentialBanner}><strong>{message}</strong></div> : null}

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div><h2>Property transaction fees</h2><p>Buyer fees are included in the final payable amount. Seller commission is shown in estate-company statements.</p></div>
        </div>
        <form className={styles.inlineForm} onSubmit={handleSaveCommission}>
          <label>
            <span>Buyer transaction fee percent</span>
            <input
              inputMode="decimal"
              onChange={(event) => setBuyerFeePercent(event.target.value)}
              placeholder="2.20"
              value={buyerFeePercent}
            />
          </label>
          <label><span>Seller commission percent</span><input inputMode="decimal" onChange={(event) => setSellerCommissionPercent(event.target.value)} placeholder="1.50" value={sellerCommissionPercent} /></label>
          <ActionButton icon={Save} tone="positive" type="submit" disabled={isSavingCommission || buyerFeePercent === '' || sellerCommissionPercent === ''}>
            {isSavingCommission ? 'Saving...' : 'Save rate'}
          </ActionButton>
        </form>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div><h2>Guest pass fee</h2><p>Flat naira amount deducted from a resident's wallet each time they generate a guest pass.</p></div>
        </div>
        <form className={styles.inlineForm} onSubmit={handleSaveGuestFee}>
          <label>
            <span>Fee (₦)</span>
            <input
              inputMode="decimal"
              onChange={(event) => setGuestPassFee(event.target.value)}
              placeholder="50.00"
              value={guestPassFee}
            />
          </label>
          <ActionButton icon={Save} tone="positive" type="submit" disabled={isSavingGuestFee || guestPassFee === ''}>
            {isSavingGuestFee ? 'Saving...' : 'Save fee'}
          </ActionButton>
        </form>
      </section>
    </DashboardShell>
  );
}
