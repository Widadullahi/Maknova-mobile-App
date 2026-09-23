'use client';

import { useEffect, useState } from 'react';
import { BadgeCheck, Upload } from 'lucide-react';
import { apiRequest } from '../../../lib/api';
import { labelize } from '../../../lib/format';
import { useManagerSession } from '../../../lib/auth';
import { DashboardShell } from '../../../components/DashboardShell';
import { ActionButton } from '../../../components/ActionButton';
import { Pill } from '../../../components/Pill';
import { DocumentCards } from '../../../components/DocumentCards';
import styles from '../../../components/dashboard.module.css';

const DEVELOPER_REQUIRED_DOCS = [
  ['government_planning_approval', 'Government planning approval'],
  ['land_title', 'Title chain: C of O / Governor’s Consent + Deed of Assignment'],
  ['survey_plan', 'Survey plan'],
  ['estate_development_approval', 'Estate development approval'],
];

const LANDOWNER_ALTERNATIVE_DOCS = [
  ['land_title', 'Land title / registration document'],
  ['certificate_of_occupancy', 'Certificate of Occupancy'],
  ['deed_of_assignment', 'Deed of Assignment'],
  ['survey_plan', 'Survey plan'],
  ['purchase_receipt', 'Purchase receipt / contract of sale'],
  ['sworn_affidavit', 'Sworn affidavit of ownership'],
  ['tax_receipt', 'Land/property tax receipt'],
  ['building_approval', 'Building approval / permit'],
  ['utility_bill', 'Utility bill in owner’s name'],
  ['chieftaincy_allocation_letter', 'Chieftaincy / community allocation letter'],
  ['other_title_document', 'Other supporting document'],
];
const MIN_LANDOWNER_DOCS = 3;

const EMPTY_FORM = {
  applicantType: 'estate_developer',
  estateName: '',
  estateLocation: '',
  villageName: '',
  partiesInvolved: '',
  listingPrice: '',
  managerTitle: '',
  signatureText: '',
  acceptedTerms: false,
};

export default function VerificationPage() {
  const { token, status } = useManagerSession();
  const [application, setApplication] = useState(null);
  const [loadStatus, setLoadStatus] = useState('idle');
  const [form, setForm] = useState(EMPTY_FORM);
  const [files, setFiles] = useState({});
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!token) return;
    setLoadStatus('loading');
    apiRequest('/verification/me', {}, token)
      .then((data) => {
        setApplication(data.application || null);
        if (data.application) {
          setForm((current) => ({
            ...current,
            applicantType: data.application.applicantType || 'estate_developer',
            estateName: data.application.estateName || '',
            estateLocation: data.application.estateLocation || '',
            villageName: data.application.villageName || '',
            partiesInvolved: data.application.partiesInvolved || '',
            listingPrice: data.application.listingPrice != null ? String(data.application.listingPrice) : '',
            managerTitle: data.application.managerTitle || '',
          }));
        }
        setLoadStatus('ready');
      })
      .catch(() => setLoadStatus('error'));
  }, [token]);

  function setField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  const docList = form.applicantType === 'individual_landowner' ? LANDOWNER_ALTERNATIVE_DOCS : DEVELOPER_REQUIRED_DOCS;
  const uploadedAltCount = form.applicantType === 'individual_landowner'
    ? LANDOWNER_ALTERNATIVE_DOCS.filter(([key]) => files[key]?.length).length
    : 0;

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');

    if (form.applicantType === 'individual_landowner' && uploadedAltCount < MIN_LANDOWNER_DOCS && !application) {
      setError(`Individual landowner submissions need at least ${MIN_LANDOWNER_DOCS} supporting documents. You've attached ${uploadedAltCount}.`);
      return;
    }

    setIsSubmitting(true);
    try {
      const applicationData = await apiRequest(
        '/verification/applications',
        {
          method: 'POST',
          body: JSON.stringify({
            applicantType: form.applicantType,
            estateName: form.estateName,
            estateLocation: form.estateLocation,
            villageName: form.villageName,
            partiesInvolved: form.partiesInvolved,
            listingPrice: Number(form.listingPrice || 0),
            managerTitle: form.managerTitle,
            signatureMethod: 'typed',
            signatureText: form.signatureText,
            acceptedTerms: form.acceptedTerms,
            termsVersion: 'manager-web-v1',
          }),
        },
        token,
      );

      const applicationId = applicationData.application?.id;
      if (applicationId) {
        for (const [category, fileList] of Object.entries(files)) {
          if (!fileList?.length) continue;
          const formData = new FormData();
          formData.append('category', category);
          Array.from(fileList).forEach((file) => formData.append('files', file));
          await apiRequest(`/verification/applications/${applicationId}/documents/upload`, { method: 'POST', body: formData }, token);
        }
        await apiRequest(`/verification/applications/${applicationId}/submit`, { method: 'POST', body: JSON.stringify({}) }, token);
      }

      const refreshed = await apiRequest('/verification/me', {}, token);
      setApplication(refreshed.application || null);
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (status !== 'ready') return null;

  return (
    <DashboardShell title="Verification" subtitle="Submit your onboarding application and required documents.">
      {error ? <div className={styles.loginError}>{error}</div> : null}

      {application ? (
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div><h2>Current Onboarding Packet</h2><p>Your submitted verification documents and review status.</p></div>
            <Pill>{labelize(application.status)}</Pill>
          </div>
          <div className={styles.detailGrid}>
            <div><span>Applicant type</span><strong>{labelize(application.applicantType)}</strong></div>
            <div><span>Estate / property</span><strong>{application.estateName || 'Unnamed'}</strong></div>
            <div><span>Location</span><strong>{application.estateLocation || 'No location'}</strong></div>
            <div><span>Village / community</span><strong>{application.villageName || 'Not provided'}</strong></div>
            <div><span>Parties involved</span><strong>{application.partiesInvolved || 'Not provided'}</strong></div>
            <div><span>Price</span><strong>{application.listingPrice != null ? `₦${application.listingPrice.toLocaleString()}` : 'Not provided'}</strong></div>
            <div><span>Signature</span><strong>{application.signatureText || labelize(application.signatureMethod, 'Not provided')}</strong></div>
            <div><span>Documents</span><strong>{application.documents?.length || 0}</strong></div>
          </div>
          {application.adminNote ? (
            <div className={styles.auditItem}>
              <span>Reviewer note</span>
              <p>{application.adminNote}</p>
            </div>
          ) : null}
          <DocumentCards documents={application.documents || []} token={token} emptyText="No uploaded documents are attached to this application yet." />
        </section>
      ) : loadStatus === 'ready' ? null : (
        <div className={styles.pageLoading}>Loading your verification status...</div>
      )}

      {!application || application.status === 'additional_info_required' || application.status === 'rejected' ? (
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div><h2>{application ? 'Update Onboarding Application' : 'Onboarding Application'}</h2><p>Choose the category that matches your situation, then submit real files to the backend verification workflow.</p></div>
            <Upload size={20} />
          </div>

          <div className={styles.roleSwitch} style={{ marginBottom: 4 }}>
            <button type="button" className={form.applicantType === 'estate_developer' ? styles.roleSwitchActive : ''} onClick={() => setField('applicantType', 'estate_developer')}>Estate Developer</button>
            <button type="button" className={form.applicantType === 'individual_landowner' ? styles.roleSwitchActive : ''} onClick={() => setField('applicantType', 'individual_landowner')}>Individual Landowner</button>
          </div>
          {form.applicantType === 'individual_landowner' ? (
            <p className={styles.loginFooterNote}>
              For sellers without a full estate-developer document set (a single plot, or a newly completed house).
              Attach at least {MIN_LANDOWNER_DOCS} documents from the list below — any combination is accepted.
            </p>
          ) : null}

          <form className={styles.managerForm} onSubmit={handleSubmit}>
            <div className={styles.formGrid}>
              <label><span>Estate / property name</span><input value={form.estateName} onChange={(event) => setField('estateName', event.target.value)} placeholder="e.g. Greenstone Courts Estate" required /></label>
              <label><span>Location</span><input value={form.estateLocation} onChange={(event) => setField('estateLocation', event.target.value)} placeholder="e.g. Lekki, Lagos" required /></label>
              <label><span>Village / community name</span><input value={form.villageName} onChange={(event) => setField('villageName', event.target.value)} placeholder="e.g. Ibeju village" required /></label>
              <label><span>Price (₦)</span><input inputMode="numeric" value={form.listingPrice} onChange={(event) => setField('listingPrice', event.target.value)} placeholder="e.g. 5000000" required /></label>
              <label><span>Manager title</span><input value={form.managerTitle} onChange={(event) => setField('managerTitle', event.target.value)} placeholder="e.g. Estate Manager" /></label>
              <label><span>Typed signature</span><input value={form.signatureText} onChange={(event) => setField('signatureText', event.target.value)} placeholder="Type your legal full name" required /></label>
            </div>
            <label>
              <span>Individuals involved (seller, co-owners, family/community head, witnesses)</span>
              <input value={form.partiesInvolved} onChange={(event) => setField('partiesInvolved', event.target.value)} placeholder="e.g. Seller: Chief A. Balogun; Witness: B. Adeyemi" required />
            </label>

            <div className={styles.uploadGrid}>
              {docList.map(([key, label]) => (
                <label className={styles.uploadBox} key={key}>
                  <strong>{label}</strong>
                  <span>PDF, JPG, or PNG.</span>
                  <input multiple={key === 'land_title'} onChange={(event) => setFiles((current) => ({ ...current, [key]: event.target.files }))} type="file" accept=".pdf,image/png,image/jpeg" />
                </label>
              ))}
            </div>
            {form.applicantType === 'individual_landowner' ? (
              <p className={styles.cameraHint}>{uploadedAltCount} / {MIN_LANDOWNER_DOCS} minimum documents attached.</p>
            ) : null}

            <label className={styles.checkRow}>
              <input checked={form.acceptedTerms} onChange={(event) => setField('acceptedTerms', event.target.checked)} type="checkbox" required />
              <span>I confirm these records are accurate and authorize admin review.</span>
            </label>
            <ActionButton icon={BadgeCheck} tone="positive" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Submitting...' : 'Submit to backend'}
            </ActionButton>
          </form>
        </section>
      ) : null}
    </DashboardShell>
  );
}
