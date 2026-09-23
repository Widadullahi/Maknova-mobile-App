import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  fetchEstateProperties,
  fetchEstates,
  fetchMyPurchases as fetchRemotePurchases,
  fetchPublicProperties,
  updatePropertyStatus,
  uploadPropertyDocuments,
} from '../api/estates';

const PropertyDealsContext = createContext(null);
const PLACEHOLDER_IMAGE = require('../../assets/listings/vacant-plot-aerial.jpg');

const TRANSITIONS = {
  available: ['reserved', 'under_offer', 'unavailable'],
  reserved: ['available', 'sold', 'unavailable'],
  under_offer: ['available', 'sold', 'unavailable'],
  sold: ['allocated'],
  allocated: [],
  unavailable: ['available'],
};

const BUYER_VISIBLE_STATUSES = new Set(['sold', 'allocated']);

export function PropertyDealsProvider({ children }) {
  const [listings, setListings] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  function normalizeProperty(property, estate) {
    return {
      ...property,
      id: String(property.id),
      rawId: property.id,
      estateId: property.estateId,
      estateName: estate?.name || `Estate ${property.estateId}`,
      location: estate?.location || '',
      plotNumber: property.plotNumber || property.propertyIdentifier || `Property ${property.id}`,
      plotSizeSqm: property.plotSize || 'N/A',
      titleType: property.propertyType || 'Property',
      propertyType: property.propertyType || 'Property',
      price: Number(property.price || 0),
      verified: estate?.status === 'approved' || estate?.isPublished,
      image: PLACEHOLDER_IMAGE,
      documents: property.documents || [],
      description: property.description || estate?.description || 'No description has been provided for this property yet.',
    };
  }

  async function refreshListings() {
    setIsLoading(true);
    try {
      const publicData = await fetchPublicProperties();
      setListings((publicData.properties || []).map((property) => normalizeProperty(property, {
        id: property.estateId,
        name: property.estateName,
        location: property.estateLocation,
        description: property.estateDescription,
        status: property.estateStatus,
        isPublished: property.estateIsPublished,
      })));
      setError(null);
    } catch (err) {
      setListings([]);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    refreshListings();
  }, []);

  function getListing(id) {
    return listings.find((listing) => listing.id === id) || null;
  }

  function getNextStatuses(id) {
    const listing = getListing(id);
    return listing ? TRANSITIONS[listing.status] || [] : [];
  }

  async function updateStatus(id, nextStatus, buyerName) {
    const listing = getListing(id);
    if (!listing) return null;
    const data = await updatePropertyStatus(listing.estateId, listing.rawId, {
      status: nextStatus,
      note: buyerName ? `Assigned to ${buyerName}` : undefined,
    });
    setListings((current) =>
      current.map((listing) => {
        if (listing.id !== id) return listing;
        return normalizeProperty({ ...listing, ...data.property }, listing);
      })
    );
    return data.property;
  }

  async function addDocument(id, document) {
    const listing = getListing(id);
    if (!listing) return null;
    const data = await uploadPropertyDocuments(listing.estateId, listing.rawId, document.category || 'other', document.assets);
    const records = data.documents || [];
    setListings((current) =>
      current.map((listing) =>
        listing.id === id ? { ...listing, documents: [...records, ...listing.documents] } : listing
      )
    );
    return records;
  }

  function canViewDocuments(listing, user) {
    if (!listing || !user) return false;
    if (user.role === 'estate_manager' || user.role === 'admin' || user.role === 'super_admin') return true;
    return BUYER_VISIBLE_STATUSES.has(listing.status) && listing.buyerName === user.fullName;
  }

  async function refreshPurchases() {
    try {
      const data = await fetchRemotePurchases();
      setPurchases((data.properties || []).map((property) => normalizeProperty(property, null)));
    } catch {
      setPurchases([]);
    }
  }

  function getMyPurchases(user) {
    if (!user) return [];
    return purchases;
  }

  const value = useMemo(
    () => ({
      listings,
      purchases,
      isLoading,
      error,
      refreshListings,
      refreshPurchases,
      getListing,
      getNextStatuses,
      updateStatus,
      addDocument,
      canViewDocuments,
      getMyPurchases,
    }),
    [listings, purchases, isLoading, error]
  );

  return <PropertyDealsContext.Provider value={value}>{children}</PropertyDealsContext.Provider>;
}

export function usePropertyDeals() {
  const context = useContext(PropertyDealsContext);

  if (!context) {
    throw new Error('usePropertyDeals must be used inside PropertyDealsProvider');
  }

  return context;
}
