'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell, LogOut, Menu, X } from 'lucide-react';
import { useAdminSession } from '../lib/auth';
import { NAV_ITEMS, SUPER_ADMIN_NAV_ITEMS, BRAND_ICON as BrandIcon } from './navItems';
import styles from './dashboard.module.css';

export function DashboardShell({ title, subtitle, children, headerActions }) {
  const { user, status, logout, isSuperAdmin } = useAdminSession();
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  if (status !== 'ready') {
    return <div className={styles.pageLoading}>Loading dashboard...</div>;
  }

  const navItems = isSuperAdmin ? [...NAV_ITEMS, ...SUPER_ADMIN_NAV_ITEMS] : NAV_ITEMS;

  return (
    <main className={styles.shell}>
      <button className={styles.mobileMenuButton} onClick={() => setIsMenuOpen(true)} type="button">
        <Menu size={19} /> Menu
      </button>
      <aside className={`${styles.sidebar} ${isMenuOpen ? styles.sidebarOpen : ''}`}>
        <div className={styles.sidebarHeader}>
          <div className={styles.brand}>
            <div className={styles.brandMark}><BrandIcon size={22} /></div>
            <div><strong>EstateFlow</strong><span>Owner Admin</span></div>
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
            <span>{user?.role === 'super_admin' ? 'Master Owner' : 'Staff Admin'}</span>
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
        {children}
      </section>
    </main>
  );
}
