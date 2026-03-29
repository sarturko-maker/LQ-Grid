import { useState, useCallback, useEffect } from 'react';
import type { DocumentGroup, Cell } from '@/types';

const STORAGE_KEY = 'lq-groups';

/** Manage document groups — persisted in localStorage. */
export function useGrouping(jobName: string) {
  const key = `${STORAGE_KEY}:${jobName}`;
  const [groups, setGroups] = useState<DocumentGroup[]>(() => load(key));

  useEffect(() => { setGroups(load(key)); }, [key]);

  /** Functional updater that also persists to localStorage */
  const update = useCallback((fn: (prev: DocumentGroup[]) => DocumentGroup[]) => {
    setGroups((prev) => {
      const next = fn(prev);
      localStorage.setItem(key, JSON.stringify(next));
      return next;
    });
  }, [key]);

  const addGroup = useCallback((name: string, documents: string[]) => {
    const id = `grp_${Date.now()}`;
    update((prev) => [...prev, { id, name, documents, isExpanded: true, status: 'pending' }]);
    return id;
  }, [update]);

  const removeGroup = useCallback((id: string) => {
    update((prev) => prev.filter((g) => g.id !== id));
  }, [update]);

  const toggleExpand = useCallback((id: string) => {
    update((prev) => prev.map((g) => g.id === id ? { ...g, isExpanded: !g.isExpanded } : g));
  }, [update]);

  const addToGroup = useCallback((groupId: string, docId: string) => {
    update((prev) => prev.map((g) => {
      if (g.id !== groupId || g.documents.includes(docId)) return g;
      return { ...g, documents: [...g.documents, docId], status: 'pending' as const, cells: undefined };
    }));
  }, [update]);

  const removeFromGroup = useCallback((groupId: string, docId: string) => {
    update((prev) => prev.map((g) => {
      if (g.id !== groupId) return g;
      return { ...g, documents: g.documents.filter((d) => d !== docId), status: 'pending' as const, cells: undefined };
    }));
  }, [update]);

  const setExtracting = useCallback((id: string) => {
    update((prev) => prev.map((g) => g.id === id ? { ...g, status: 'extracting' as const } : g));
  }, [update]);

  const setCells = useCallback((id: string, cells: Record<string, Cell>) => {
    update((prev) => prev.map((g) => g.id === id ? { ...g, cells, status: 'complete' as const } : g));
  }, [update]);

  const setError = useCallback((id: string) => {
    update((prev) => prev.map((g) => g.id === id ? { ...g, status: 'error' as const } : g));
  }, [update]);

  const ungroupedFilter = useCallback((docIds: string[]): string[] => {
    const grouped = new Set(groups.flatMap((g) => g.documents));
    return docIds.filter((id) => !grouped.has(id));
  }, [groups]);

  return {
    groups, addGroup, removeGroup, toggleExpand,
    addToGroup, removeFromGroup,
    setExtracting, setCells, setError,
    ungroupedFilter,
    hasGroups: groups.length > 0,
  };
}

function load(key: string): DocumentGroup[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
