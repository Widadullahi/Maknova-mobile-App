'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from './api';

/**
 * Loads a single backend resource once a token is available, with a manual
 * `reload` for after mutations (approve, create, delete, etc).
 */
export function useResource(path, token, { enabled = true } = {}) {
  const [state, setState] = useState({ data: null, status: 'idle', error: null });

  const reload = useCallback(async () => {
    if (!token || !enabled) return;
    setState((current) => ({ ...current, status: 'loading', error: null }));
    try {
      const data = await apiRequest(path, {}, token);
      setState({ data, status: 'ready', error: null });
    } catch (error) {
      setState({ data: null, status: 'error', error: error.message });
    }
  }, [path, token, enabled]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { ...state, reload };
}
