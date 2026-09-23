import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { fetchSavedListings, saveListing, unsaveListing } from '../api/savedListings';

const SavedListingsContext = createContext(null);

export function SavedListingsProvider({ children }) {
  const [savedIds, setSavedIds] = useState([]);
  const [remoteIds, setRemoteIds] = useState([]);

  useEffect(() => {
    let isActive = true;

    async function loadSavedListings() {
      try {
        const data = await fetchSavedListings();
        if (isActive) {
          const ids = data.propertyIds || [];
          setRemoteIds(ids);
          setSavedIds((current) => Array.from(new Set([...current, ...ids])));
        }
      } catch {
        if (isActive) {
          setRemoteIds([]);
        }
      }
    }

    loadSavedListings();
    return () => {
      isActive = false;
    };
  }, []);

  function toggleSaved(id) {
    const numericId = Number(id);
    const canSync = Number.isInteger(numericId) && numericId > 0;
    const wasSaved = savedIds.includes(id) || savedIds.includes(numericId);

    setSavedIds((current) => {
      const withoutId = current.filter((item) => item !== id && item !== numericId);
      return wasSaved ? withoutId : [...withoutId, canSync ? numericId : id];
    });

    if (canSync) {
      const action = wasSaved ? unsaveListing : saveListing;
      action(numericId).catch(() => {
        setSavedIds((current) => {
          const withoutId = current.filter((item) => item !== id && item !== numericId);
          return wasSaved ? [...withoutId, numericId] : withoutId;
        });
      });
    }
  }

  function isSaved(id) {
    const numericId = Number(id);
    return savedIds.includes(id) || savedIds.includes(numericId);
  }

  const value = useMemo(() => ({ savedIds, remoteIds, toggleSaved, isSaved }), [remoteIds, savedIds]);

  return <SavedListingsContext.Provider value={value}>{children}</SavedListingsContext.Provider>;
}

export function useSavedListings() {
  const context = useContext(SavedListingsContext);

  if (!context) {
    throw new Error('useSavedListings must be used inside SavedListingsProvider');
  }

  return context;
}
