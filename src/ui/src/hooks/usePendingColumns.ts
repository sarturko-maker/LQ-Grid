import { useState, useEffect, useMemo } from 'react';
import type { Column, Manifest, OutputType } from '@/types';

/**
 * Manage columns added from the UI that are pending extraction.
 * Shows them immediately in "extracting" state, merges with manifest.
 */
export function usePendingColumns(manifest: Manifest | null) {
  const [pending, setPending] = useState<Column[]>([]);
  const [columnOrder, setColumnOrder] = useState<string[]>([]);

  // Init column order from manifest
  useEffect(() => {
    if (manifest && columnOrder.length === 0) {
      setColumnOrder(manifest.columns.map((c) => c.id));
    }
  }, [manifest]); // eslint-disable-line react-hooks/exhaustive-deps

  // Add pending columns to order
  useEffect(() => {
    const pendingIds = pending.map((c) => c.id);
    const newIds = pendingIds.filter((id) => !columnOrder.includes(id));
    if (newIds.length > 0) {
      setColumnOrder((prev) => [...prev, ...newIds]);
    }
  }, [pending]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clear pending that are now in manifest
  useEffect(() => {
    if (manifest) {
      const ids = new Set(manifest.columns.map((c) => c.id));
      setPending((prev) => prev.filter((c) => !ids.has(c.id)));
    }
  }, [manifest]);

  // Merged columns
  const allColumns = useMemo(() => {
    if (!manifest) return pending;
    const ids = new Set(manifest.columns.map((c) => c.id));
    const stillPending = pending.filter((c) => !ids.has(c.id));
    return [...manifest.columns, ...stillPending];
  }, [manifest, pending]);

  // Add a new pending column
  const addColumn = (id: string, prompt: string, outputType: OutputType) => {
    const col: Column = {
      id,
      label: prompt.length > 40 ? prompt.slice(0, 37) + '...' : prompt,
      prompt,
      type: outputType === 'classification' ? 'boolean' :
            outputType === 'date' ? 'date' : 'string',
      outputType,
      sortable: true,
      filterable: true,
      group: null,
    };
    setPending((prev) => [...prev, col]);
  };

  return {
    allColumns,
    pendingColumns: pending,
    columnOrder,
    setColumnOrder,
    addColumn,
  };
}
