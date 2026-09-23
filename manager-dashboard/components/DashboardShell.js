'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell, LogOut, Menu, X } from 'lucide-react';
import { useManagerSession } from '../lib/auth';
import { apiRequest } from '../lib/api';
import { NAV_ITEMS, ONBOARDING_NAV_ITEMS, BRAND_ICON as BrandIcon } from './navItems';
import styles from './dashboard.module.css';

export function DashboardShell({ title, subtitle, children, headerActions }) {
  const { user, token, status, logout } = useManagerSession();
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState('loading');

  useEffect(() => {
    if (!token) return;
    apiRequest('/verification/me', {}, token)
      .then((data) => setVerificationStatus(data.application?.status || 'not_started'))
      .catch(() => setVerificationStatus('not_started'));
  }, [token]);

  if (status !== 'ready') {
    return <div className={styles.pageLoading}>Loading dashboard...</div>;
  }

  const isApproved = verificationStatus === 'approved';
  const navItems = isApproved ? [...ONBOARDING_NAV_ITEMS, ...NAV_ITEMS] : ONBOARDING_NAV_ITEMS;

  return (
    <main className={styles.shell}>
      <button className={styles.mobileMenuButton} onClick={() => setIsMenuOpen(true)} type="button">
        <Menu size={19} /> Menu
      </button>
      <aside className={`${styles.sidebar} ${isMenuOpen ? styles.sidebarOpen : ''}`}>
        <div className={styles.sidebarHeader}>
          <div className={styles.brand}>
            <div className={styles.brandMark}><BrandIcon size={22} /></div>
            <div><strong>EstateFlow</strong><span>Manager Workspace</span></div>
          </div>
          <button className={styles.closeMenuButton} onClick={() => setIsMenuOpen(false)} type="button"><X size={18} /></button>
        </div>
        <nav className={styles.nav}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const selected = pathname === item.href;
            return (
              <Link
                key={item.key}
                href={item.href}
                className={`${styles.navItem} ${selected ? styles.navItemActive : ''}`}
                onClick={() => setIsMenuOpen(false)}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className={styles.sidebarFooter}>
          <div className={styles.sidebarUser}>
            <strong>{user?.fullName || user?.email}</strong>
            <span>Estate Manager</span>
          </div>
          <button className={styles.logoutButton} onClick={logout} type="button">
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </aside>

      <section className={styles.workspace}>
        <header className={styles.topbar}>
          <div className={styles.titleBlock}>
            <p className={styles.eyebrow}>{title}</p>
            <h1>{subtitle}</h1>
          </div>
          <div className={styles.headerTools}>
            {headerActions}
            <button className={styles.iconButton} type="button"><Bell size={18} /></button>
          </div>
        </header>

        {!isApproved && verificationStatus !== 'loading' ? (
          <div className={styles.gateBanner}>
            <strong>Verification required</strong>
            <p>
              Your estate manager account must be approved before you can manage estates, plots, sales, residents, or
              visitors. {verificationStatus === 'not_started' ? 'Start your verification application' : `Current status: ${verificationStatus.replace(/_/g, ' ')}`} in the Verification tab.
            </p>
          </div>
        ) : null}

        {children}
      </section>
    </main>
  );
}
