export function ageLabel(value) {
  if (!value) return 'No timestamp';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const minutes = Math.max(1, Math.round((Date.now() - date.getTime()) / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function labelize(value, fallback = 'Unknown') {
  if (!value) return fallback;
  return String(value).replace(/_/g, ' ');
}

export function toneFor(value) {
  const text = String(value || '').toLowerCase();
  if (text.includes('reject') || text.includes('suspend') || text.includes('fail') || text.includes('denied') || text.includes('urgent')) return 'danger';
  if (text.includes('pending') || text.includes('review') || text.includes('open') || text.includes('assigned') || text.includes('due')) return 'warning';
  if (text.includes('approved') || text.includes('active') || text.includes('verified') || text.includes('resolved') || text.includes('checked') || text.includes('success')) return 'success';
  return 'info';
}

export function formatCount(value) {
  return new Intl.NumberFormat('en').format(value || 0);
}

export function formatNaira(value) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(value || 0);
}
