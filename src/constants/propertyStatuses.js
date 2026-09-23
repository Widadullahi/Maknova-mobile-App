export const PROPERTY_STATUSES = {
  AVAILABLE: 'available',
  RESERVED: 'reserved',
  UNDER_OFFER: 'under_offer',
  SOLD: 'sold',
  ALLOCATED: 'allocated',
  UNAVAILABLE: 'unavailable',
};

// Client-facing lifecycle is exactly 3 statuses: Available, Reserved, Sold / Allocated.
// 'sold' and 'allocated' remain distinct in the database (allocation happens once the
// The property transaction is paid and the Plot Allocation Form is generated) but share
// one display label since buyers/managers only need to see the combined stage.
export const PROPERTY_STATUS_LABELS = {
  [PROPERTY_STATUSES.AVAILABLE]: 'Available',
  [PROPERTY_STATUSES.RESERVED]: 'Reserved',
  [PROPERTY_STATUSES.UNDER_OFFER]: 'Reserved',
  [PROPERTY_STATUSES.SOLD]: 'Sold / Allocated',
  [PROPERTY_STATUSES.ALLOCATED]: 'Sold / Allocated',
  [PROPERTY_STATUSES.UNAVAILABLE]: 'Unavailable',
};

export const PROPERTY_STATUS_TONES = {
  [PROPERTY_STATUSES.AVAILABLE]: 'success',
  [PROPERTY_STATUSES.RESERVED]: 'warning',
  [PROPERTY_STATUSES.UNDER_OFFER]: 'warning',
  [PROPERTY_STATUSES.SOLD]: 'danger',
  [PROPERTY_STATUSES.ALLOCATED]: 'danger',
  [PROPERTY_STATUSES.UNAVAILABLE]: 'neutral',
};
