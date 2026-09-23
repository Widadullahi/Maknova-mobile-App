import {
  BadgeCheck,
  Building2,
  FolderLock,
  Hammer,
  Home,
  Landmark,
  LayoutDashboard,
  Megaphone,
  Tags,
  TicketCheck,
  Users,
} from 'lucide-react';

// Available once the estate manager's verification application is approved.
export const NAV_ITEMS = [
  { key: 'overview', href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { key: 'estates', href: '/dashboard/estates', label: 'Estates', icon: Building2 },
  { key: 'properties', href: '/dashboard/properties', label: 'Plots', icon: Home },
  { key: 'sales', href: '/dashboard/sales', label: 'Sales & Buyers', icon: Tags },
  { key: 'residents', href: '/dashboard/residents', label: 'Residents', icon: Users },
  { key: 'maintenance', href: '/dashboard/maintenance', label: 'Maintenance', icon: Hammer },
  { key: 'visitors', href: '/dashboard/visitors', label: 'Visitors', icon: TicketCheck },
  { key: 'announcements', href: '/dashboard/announcements', label: 'Announcements', icon: Megaphone },
  { key: 'documents', href: '/dashboard/documents', label: 'Document Center', icon: FolderLock },
];

// Always available, even before approval.
export const ONBOARDING_NAV_ITEMS = [
  { key: 'verification', href: '/dashboard/verification', label: 'Verification', icon: BadgeCheck },
];

export const BRAND_ICON = Landmark;
