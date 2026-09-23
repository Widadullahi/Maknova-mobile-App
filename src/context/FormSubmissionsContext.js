import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { fetchFormSubmissions, submitDigitalForm } from '../api/forms';

const FormSubmissionsContext = createContext(null);

export function FormSubmissionsProvider({ children }) {
  const [submissions, setSubmissions] = useState([]);
  const [error, setError] = useState(null);

  async function refreshSubmissions() {
    try {
      const data = await fetchFormSubmissions();
      setSubmissions(data.submissions || []);
      setError(null);
    } catch (err) {
      setSubmissions([]);
      setError(err.message);
    }
  }

  useEffect(() => {
    refreshSubmissions();
  }, []);

  async function addSubmission({ template, values, signatureText, signatureMethod = 'typed', propertyId }) {
    const data = await submitDigitalForm({
      templateId: template.id,
      propertyId: propertyId || undefined,
      payload: values,
      signature: {
        method: signatureMethod,
        text: signatureText,
        termsVersion: template.version,
      },
    });
    setSubmissions((current) => [data.submission, ...current]);
    setError(null);
    return data.submission;
  }

  const value = useMemo(() => ({ submissions, error, refreshSubmissions, addSubmission }), [submissions, error]);

  return <FormSubmissionsContext.Provider value={value}>{children}</FormSubmissionsContext.Provider>;
}

export function useFormSubmissions() {
  const context = useContext(FormSubmissionsContext);

  if (!context) {
    throw new Error('useFormSubmissions must be used inside FormSubmissionsProvider');
  }

  return context;
}
