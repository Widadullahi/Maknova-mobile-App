import {
  Activity,
  BadgeCheck,
  Building2,
  CreditCard,
  FileSearch,
  Hammer,
  Landmark,
  LayoutDashboard,
  LifeBuoy,
  Megaphone,
  ScrollText,
  Settings,
  ShieldCheck,
  TicketCheck,
  UserCog,
  Users,
} from 'lucide-react';

// Visible to every dashboard account, staff or Master Owner. Per the client's
// explicit scope for staff (2026-08-08): review uploaded verification
// documents, validate authenticity, approve/reject submissions, plus Support
// (client follow-up: "even support too please") — nothing else. Enforced both
// in the nav here and page-by-page (see each restricted page's isSuperAdmin
// guard), so a staff account can't just type a URL to bypass this.
export const NAV_ITEMS = [
  { key: 'verification', href: '/dashboard/verification', label: 'Verification', icon: BadgeCheck },
  { key: 'support', href: '/dashboard/support', label: 'Support', icon: LifeBuoy },
];

// Master Owner (super_admin) only — every other module. Staff/admin accounts
// never see these links, and each of these pages independently refuses to
// render its real content for a non-super_admin session (in case someone
// navigates to the URL directly rather than clicking the nav).
export const SUPER_ADMIN_NAV_ITEMS = [
  { key: 'overview', href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { key: 'estates', href: '/dashboard/estates', label: 'Estates & Plots', icon: Building2 },
  { key: 'users', href: '/dashboard/users', label: 'Users & Roles', icon: Users },
  { key: 'reports', href: '/dashboard/reports', label: 'Public Reports', icon: FileSearch },
  { key: 'maintenance', href: '/dashboard/maintenance', label: 'Maintenance', icon: Hammer },
  { key: 'visitors', href: '/dashboard/visitors', label: 'Visitors', icon: TicketCheck },
  { key: 'announcements', href: '/dashboard/announcements', label: 'Announcements', icon: Megaphone },
  { key: 'payments', href: '/dashboard/payments', label: 'Payments', icon: CreditCard },
  { key: 'analytics', href: '/dashboard/analytics', label: 'Analytics', icon: Activity },
  { key: 'audit-logs', href: '/dashboard/audit-logs', label: 'Audit Logs', icon: ScrollText },
  { key: 'staff', href: '/dashboard/staff', label: 'Staff Accounts', icon: UserCog },
  { key: 'settings', href: '/dashboard/settings', label: 'Platform Settings', icon: Settings },
];

export const BRAND_ICON = Landmark;
export const SHIELD_ICON = ShieldCheck;
