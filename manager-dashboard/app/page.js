'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getStoredSession, isDashboardRole } from '../lib/auth';

export default function RootRedirect() {
  const router = useRouter();

  useEffect(() => {
    const { token, user } = getStoredSession();
    if (token && user && isDashboardRole(user.role)) {
      router.replace('/dashboard');
    } else {
      router.replace('/login');
    }
  }, [router]);

  return null;
}
