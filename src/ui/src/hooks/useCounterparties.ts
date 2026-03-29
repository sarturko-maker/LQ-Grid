import { useState, useCallback, useEffect } from 'react';
import type {
  CounterpartyProfile, NoticeTracker, ConsentStrategy, ConsentStatus,
} from '@/types';
import { normalizeName } from '@/lib/counterpartyUtils';

const STORAGE_KEY = 'lq-counterparties';

const DEFAULT_NOTICE: NoticeTracker = {
  status: 'not_started', sentDate: null, method: null,
  responseDate: null, conditions: null, letterFile: null,
};

const DEFAULT_STRATEGY: ConsentStrategy = {
  priority: 3, approach: 'not_required', handlingNotes: '',
};

function makeDefault(name: string): CounterpartyProfile {
  return {
    name, category: null, materiality: null,
    relationshipOwner: '', revenueValue: '', notes: '',
    strategy: { ...DEFAULT_STRATEGY },
    notice: { ...DEFAULT_NOTICE },
    updatedAt: new Date().toISOString(),
  };
}

export function useCounterparties(jobName: string) {
  const key = `${STORAGE_KEY}:${jobName}`;
  const [profiles, setProfiles] = useState<Record<string, CounterpartyProfile>>(() => load(key));

  useEffect(() => { setProfiles(load(key)); }, [key]);

  const persist = useCallback((next: Record<string, CounterpartyProfile>) => {
    setProfiles(next);
    localStorage.setItem(key, JSON.stringify(next));
  }, [key]);

  const getOrCreate = useCallback((name: string): CounterpartyProfile => {
    const k = normalizeName(name);
    return profiles[k] || makeDefault(name);
  }, [profiles]);

  const updateProfile = useCallback((name: string, partial: Partial<CounterpartyProfile>) => {
    const k = normalizeName(name);
    const existing = profiles[k] || makeDefault(name);
    persist({ ...profiles, [k]: { ...existing, ...partial, updatedAt: new Date().toISOString() } });
  }, [profiles, persist]);

  const updateNotice = useCallback((name: string, partial: Partial<NoticeTracker>) => {
    const k = normalizeName(name);
    const existing = profiles[k] || makeDefault(name);
    persist({
      ...profiles,
      [k]: { ...existing, notice: { ...existing.notice, ...partial }, updatedAt: new Date().toISOString() },
    });
  }, [profiles, persist]);

  const updateStrategy = useCallback((name: string, partial: Partial<ConsentStrategy>) => {
    const k = normalizeName(name);
    const existing = profiles[k] || makeDefault(name);
    persist({
      ...profiles,
      [k]: { ...existing, strategy: { ...existing.strategy, ...partial }, updatedAt: new Date().toISOString() },
    });
  }, [profiles, persist]);

  const getConsentStatus = useCallback((name: string): ConsentStatus => {
    const k = normalizeName(name);
    return profiles[k]?.notice.status || 'not_started';
  }, [profiles]);

  return {
    profiles, getOrCreate, updateProfile, updateNotice,
    updateStrategy, getConsentStatus,
  };
}

function load(key: string): Record<string, CounterpartyProfile> {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}
