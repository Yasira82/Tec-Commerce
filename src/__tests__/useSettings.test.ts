import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

beforeEach(() => {
  localStorage.clear();
});

describe('useSettings', () => {
  it('returns default settings on first load', async () => {
    const { useSettings } = await import('../lib/hooks/useSettings');
    const { result } = renderHook(() => useSettings());
    await act(async () => {});
    expect(result.current.settings.theme).toBe('dark');
    expect(result.current.settings.language).toBe('en');
    expect(result.current.settings.currency).toBe('PI');
  });

  it('sets loaded=true after effect runs', async () => {
    const { useSettings } = await import('../lib/hooks/useSettings');
    const { result } = renderHook(() => useSettings());
    await act(async () => {});
    expect(result.current.loaded).toBe(true);
  });

  it('loads persisted settings from localStorage', async () => {
    localStorage.setItem('tec_assets_settings', JSON.stringify({ theme: 'light', language: 'ar' }));
    const { useSettings } = await import('../lib/hooks/useSettings');
    const { result } = renderHook(() => useSettings());
    await act(async () => {});
    expect(result.current.settings.theme).toBe('light');
    expect(result.current.settings.language).toBe('ar');
  });

  it('update() changes a setting and persists to localStorage', async () => {
    const { useSettings } = await import('../lib/hooks/useSettings');
    const { result } = renderHook(() => useSettings());
    await act(async () => {});
    act(() => { result.current.update('theme', 'light'); });
    expect(result.current.settings.theme).toBe('light');
    const stored = JSON.parse(localStorage.getItem('tec_assets_settings')!);
    expect(stored.theme).toBe('light');
  });

  it('update() preserves other settings when updating one key', async () => {
    const { useSettings } = await import('../lib/hooks/useSettings');
    const { result } = renderHook(() => useSettings());
    await act(async () => {});
    act(() => { result.current.update('currency', 'USD'); });
    expect(result.current.settings.currency).toBe('USD');
    expect(result.current.settings.theme).toBe('dark');
  });

  it('reset() restores defaults and removes from localStorage', async () => {
    localStorage.setItem('tec_assets_settings', JSON.stringify({ theme: 'light' }));
    const { useSettings } = await import('../lib/hooks/useSettings');
    const { result } = renderHook(() => useSettings());
    await act(async () => {});
    act(() => { result.current.reset(); });
    expect(result.current.settings.theme).toBe('dark');
    expect(localStorage.getItem('tec_assets_settings')).toBeNull();
  });

  it('handles malformed localStorage JSON gracefully', async () => {
    localStorage.setItem('tec_assets_settings', 'not-json');
    const { useSettings } = await import('../lib/hooks/useSettings');
    const { result } = renderHook(() => useSettings());
    await act(async () => {});
    expect(result.current.settings.theme).toBe('dark');
    expect(result.current.loaded).toBe(true);
  });
});
