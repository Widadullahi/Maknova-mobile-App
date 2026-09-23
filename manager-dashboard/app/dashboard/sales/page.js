'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CreditCard, Home, Users } from 'lucide-react';
import { apiRequest, arrayFrom } from '../../../lib/api';
import { formatNaira, labelize } from '../../../lib/format';
import { useManagerSession } from '../../../lib/auth';
import { DashboardShell } from '../../../components/DashboardShell';
import { ActionButton } from '../../../components/ActionButton';
import { DataTable } from '../../../components/DataTable';
import styles from '../../../components/dashboard.module.css';

function SalesWorkspace() {
  const { token, status } = useManagerSession();
  const searchParams = useSearchParams();

  const [estates, setEstates] = useState([]);
  const [estateId, setEstateId] = useState(searchParams.get('estateId') || '');
  const [properties, setProperties] = useState([]);
  const [buyers, setBuyers] = useState([]);
  const [sales, setSales] = useState([]);

  const [buyerForm, setBuyerForm] = useState({ fullName: '', phone: '', email: '' });
  const [saleForm, setSaleForm] = useState({ propertyId: '', buyerId: '', salePrice: '' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [paymentByReference, setPaymentByReference] = useState({});

  useEffect(() => {
    if (!token) return;
    apiRequest('/estates', {}, token).then((data) => {
      const rows = arrayFrom(data, 'estates');
      setEstates(rows);
      setEstateId((current) => current || rows[0]?.id || '');
    });
  }, [token]);

  async function reload() {
    if (!token || !estateId) return;
    const [propertyData, buyerData, salesData] = await Promise.all([
      apiRequest(`/estates/${estateId}/properties`, {}, token).catch(() => ({})),
      apiRequest(`/estates/${estateId}/buyers`, {}, token).catch(() => ({})),
      apiRequest(`/estates/${estateId}/sales`, {}, token).catch(() => ({})),
    ]);
    setProperties(arrayFrom(propertyData, 'properties'));
    setBuyers(arrayFrom(buyerData, 'buyers'));
    setSales(arrayFrom(salesData, 'sales'));
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, estateId]);

  async function handleCreateBuyer(event) {
    event.preventDefault();
    setError('');
    try {
      await apiRequest(`/estates/${estateId}/buyers`, { method: 'POST', body: JSON.stringify(buyerForm) }, token);
      setBuyerForm({ fullName: '', phone: '', email: '' });
      setMessage('Buyer added.');
      await reload();
    } catch (submitError) {
      setError(submitError.message);
    }
  }

  async function handleReserve() {
    setError('');
    try {
      await apiRequest(`/estates/${estateId}/reservations`, { method: 'POST', body: JSON.stringify({ propertyId: saleForm.propertyId, buyerId: saleForm.buyerId, note: 'Reserved from manager dashboard.' }) }, token);
      setMessage('Property reserved.');
      await reload();
    } catch (submitError) {
      setError(submitError.message);
    }
  }

  async function handleSale() {
    setError('');
    try {
      const data = await apiRequest(
        `/estates/${estateId}/sales`,
        { method: 'POST', body: JSON.stringify({ propertyId: saleForm.propertyId, buyerId: saleForm.buyerId, salePrice: Number(saleForm.salePrice || 0), paymentStatus: 'pending', note: 'Sale recorded from manager dashboard.' }) },
        token,
      );
      setMessage(`Sale #${data.sale.id} recorded.`);
      await reload();
    } catch (submitError) {
      setError(submitError.message);
    }
  }

  async function handleInitializePayment(saleId) {
    setError('');
    try {
      const data = await apiRequest(`/payments/sales/${saleId}/initialize`, { method: 'POST', body: JSON.stringify({}) }, token);
      setPaymentByReference((current) => ({ ...current, [saleId]: data.reference }));
      if (data.authorizationUrl) window.open(data.authorizationUrl, '_blank', 'noopener,noreferrer');
    } catch (submitError) {
      setError(submitError.message);
    }
  }

  async function handleCheckPayment(saleId) {
    const reference = paymentByReference[saleId];
    if (!reference) return;
    try {
      const data = await apiRequest(`/payments/verify/${reference}`, {}, token);
      setMessage(`Payment status: ${labelize(data.transaction.status)}`);
      await reload();
    } catch (submitError) {
      setError(submitError.message);
    }
  }

  const buyerRows = useMemo(() => buyers.map((item) => ({ id: item.id, name: item.fullName, phone: item.phone || '-', email: item.email || '-' })), [buyers]);
  const saleRows = useMemo(
    () =>
      sales.map((item) => ({
        id: item.id,
        buyer: item.buyerName || `Buyer #${item.buyerId}`,
        property: item.propertyIdentifier || `Plot #${item.propertyId}`,
        amount: formatNaira(item.salePrice),
        paymentStatus: labelize(item.paymentStatus),
        raw: item,
      })),
    [sales],
  );

  if (status !== 'ready') return null;

  return (
    <DashboardShell title="Sales & Buyers" subtitle="Manage buyers, reservations, sales, and Paystack collections.">
      {error ? <div className={styles.loginError}>{error}</div> : null}
      {message ? <div className={styles.credentialBanner}><strong>{message}</strong></div> : null}

      <section className={styles.panel}>
        <div className={styles.panelHeader}><div><h2>Estate</h2><p>Choose which estate's buyers and sales to manage.</p></div></div>
        <select value={estateId} onChange={(event) => setEstateId(event.target.value)} style={{ height: 43, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', padding: '0 12px' }}>
          {estates.map((estate) => <option key={estate.id} value={estate.id}>{estate.name}</option>)}
        </select>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeader}><div><h2>Add Buyer</h2><p>Create a buyer record before reserving or selling a plot.</p></div><Users size={20} /></div>
        <form className={styles.inlineForm} onSubmit={handleCreateBuyer}>
          <label><span>Full name</span><input required value={buyerForm.fullName} onChange={(event) => setBuyerForm((current) => ({ ...current, fullName: event.target.value }))} placeholder="e.g. Kemi Adewale" /></label>
          <label><span>Phone</span><input required value={buyerForm.phone} onChange={(event) => setBuyerForm((current) => ({ ...current, phone: event.target.value }))} placeholder="e.g. 08012345678" /></label>
          <label><span>Email</span><input type="email" value={buyerForm.email} onChange={(event) => setBuyerForm((current) => ({ ...current, email: event.target.value }))} placeholder="buyer@example.com" /></label>
          <ActionButton icon={Users} tone="positive" type="submit">Add buyer</ActionButton>
        </form>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeader}><div><h2>Reserve or Sell a Plot</h2><p>Select a plot and buyer, then reserve or record a sale.</p></div><Home size={20} /></div>
        <div className={styles.formGrid}>
          <label>
            <span>Plot</span>
            <select value={saleForm.propertyId} onChange={(event) => setSaleForm((current) => ({ ...current, propertyId: event.target.value }))}>
              <option value="">Select plot</option>
              {properties.map((item) => <option key={item.id} value={item.id}>{item.propertyIdentifier || item.plotNumber} ({labelize(item.status)})</option>)}
            </select>
          </label>
          <label>
            <span>Buyer</span>
            <select value={saleForm.buyerId} onChange={(event) => setSaleForm((current) => ({ ...current, buyerId: event.target.value }))}>
              <option value="">Select buyer</option>
              {buyers.map((item) => <option key={item.id} value={item.id}>{item.fullName}</option>)}
            </select>
          </label>
          <label><span>Sale price (₦)</span><input inputMode="numeric" value={saleForm.salePrice} onChange={(event) => setSaleForm((current) => ({ ...current, salePrice: event.target.value }))} placeholder="e.g. 25000000" /></label>
        </div>
        <div className={styles.rowActions}>
          <ActionButton disabled={!saleForm.propertyId || !saleForm.buyerId} onClick={handleReserve}>Reserve plot</ActionButton>
          <ActionButton tone="positive" disabled={!saleForm.propertyId || !saleForm.buyerId || !saleForm.salePrice} onClick={handleSale}>Record sale</ActionButton>
        </div>
      </section>

      <DataTable
        title="Buyers"
        subtitle="Buyer records for this estate."
        columns={[{ key: 'name', label: 'Name' }, { key: 'phone', label: 'Phone' }, { key: 'email', label: 'Email' }]}
        rows={buyerRows}
        emptyTitle="No buyers yet"
        emptyBody="Add a buyer above."
      />

      <DataTable
        title="Sales"
        subtitle="Sale records with Paystack collection (2% platform commission applies automatically)."
        columns={[
          { key: 'buyer', label: 'Buyer' },
          { key: 'property', label: 'Plot' },
          { key: 'amount', label: 'Amount' },
          { key: 'paymentStatus', label: 'Payment', pill: true },
          {
            key: 'actions',
            label: 'Collect payment',
            render: (row) => (
              <div className={styles.rowActions}>
                <ActionButton icon={CreditCard} tone="positive" onClick={() => handleInitializePayment(row.id)}>Collect via Paystack</ActionButton>
                {paymentByReference[row.id] ? <ActionButton onClick={() => handleCheckPayment(row.id)}>Check status</ActionButton> : null}
              </div>
            ),
          },
        ]}
        rows={saleRows}
        emptyTitle="No sales yet"
        emptyBody="Record a sale above to start collecting payment."
      />
    </DashboardShell>
  );
}

export default function SalesPage() {
  return (
    <Suspense fallback={null}>
      <SalesWorkspace />
    </Suspense>
  );
}
