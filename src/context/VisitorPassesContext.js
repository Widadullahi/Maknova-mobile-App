import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { createVisitorPass, fetchVisitorPasses, verifyVisitorPass } from '../api/visitorPasses';

const VisitorPassesContext = createContext(null);

export function VisitorPassesProvider({ children }) {
  const [passes, setPasses] = useState([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;

    async function loadPasses() {
      setIsSyncing(true);
      try {
        const data = await fetchVisitorPasses();
        if (mounted) {
          setPasses(data.passes || []);
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          setPasses([]);
          setError(err.message);
        }
      } finally {
        if (mounted) {
          setIsSyncing(false);
        }
      }
    }

    loadPasses();

    return () => {
      mounted = false;
    };
  }, []);

  async function addPass({ visitorName, visitorPhone, purpose, expectedDate, expectedTime, requestedBy }) {
    const data = await createVisitorPass({
      visitorName,
      visitorPhone,
      purpose,
      expectedDate,
      expectedTime,
      hostName: requestedBy,
    });
    setPasses((current) => [data.pass, ...current]);
    setError(null);
    return data.pass;
  }

  function findPass(query) {
    const needle = query.trim().toUpperCase();
    if (!needle) return null;
    return (
      passes.find((pass) => pass.code.toUpperCase() === needle || pass.pin === query.trim()) || null
    );
  }

  function checkInPass(passId) {
    let result = null;
    setPasses((current) =>
      current.map((pass) => {
        if (pass.id !== passId) return pass;
        result = { ...pass, status: 'checked_in', checkedInAt: new Date().toISOString() };
        return result;
      })
    );
    return result;
  }

  function checkOutPass(passId) {
    let result = null;
    setPasses((current) =>
      current.map((pass) => {
        if (pass.id !== passId) return pass;
        result = { ...pass, status: 'checked_out', checkedOutAt: new Date().toISOString() };
        return result;
      })
    );
    return result;
  }

  async function verifyPass(query, source = 'code', action = 'check_in') {
    const payload = source === 'pin' ? { pin: query } : { qrPayload: query, code: query };
    const data = await verifyVisitorPass({ ...payload, action });
    return data.verification;
  }

  const value = useMemo(
    () => ({ passes, isSyncing, error, addPass, findPass, checkInPass, checkOutPass, verifyPass }),
    [passes, isSyncing, error]
  );

  return <VisitorPassesContext.Provider value={value}>{children}</VisitorPassesContext.Provider>;
}

export function useVisitorPasses() {
  const context = useContext(VisitorPassesContext);

  if (!context) {
    throw new Error('useVisitorPasses must be used inside VisitorPassesProvider');
  }

  return context;
}
