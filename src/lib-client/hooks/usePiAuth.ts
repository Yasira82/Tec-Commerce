'use client';

import { useState, useEffect, useCallback } from 'react';
import { getStoredUser, logout as piLogout } from '@/lib-client/pi/pi-auth';
import { TecUser } from '@/types/pi.types';

interface AuthState {
  user:            TecUser | null;
  isLoading:       boolean;
  isAuthenticated: boolean;
  isNewUser:       boolean;
  error:           string | null;
}

export const usePiAuth = () => {
  const [state, setState] = useState<AuthState>({
    user:            null,
    isLoading:       true,
    isAuthenticated: false,
    isNewUser:       false,
    error:           null,
  });

  useEffect(() => {
    const stored = getStoredUser();
    setState({
      user:            stored,
      isAuthenticated: !!stored,
      isLoading:       false,
      isNewUser:       false,
      error:           null,
    });

    // C-123 §3: Pi Browser stores the tec_user cookie so the SERVER sees it but hides
    // it from client JS — getStoredUser() reads null and the merchant identity never
    // appears. Resolve identity server-side via /api/auth/me and fill it in.
    fetch('/api/auth/me', { credentials: 'include', cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.authenticated && d.user) {
          setState((prev) => ({
            ...prev,
            user:            (prev.user ?? (d.user as TecUser)),
            isAuthenticated: true,
            isLoading:       false,
          }));
        }
      })
      .catch(() => { /* fail closed — keep cookie-derived state */ });

    // No Pi handshake here. PiVisitSignIn (app/layout.tsx) signs the visitor in
    // with Pi once per page load — skipped in a Hub-owned session (ADR-007) — and
    // the payment authenticates again at the tap. A second call here ran at the
    // same moment as that one, and Pi Browser answers neither of two concurrent
    // authenticate calls (owner decision, 2026-10-03).
  }, []);

  const logout = useCallback(async () => {
    await piLogout();
    setState({
      user:            null,
      isAuthenticated: false,
      isLoading:       false,
      isNewUser:       false,
      error:           null,
    });
  }, []);

  return { ...state, logout };
};
