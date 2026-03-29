import { useState, useCallback } from 'react';
import type { Verification, VerificationEntry } from '@/types';

/**
 * Manage cell verification state.
 *
 * Verification data is kept in memory and saved to localStorage.
 * In production, this would write to data/output/verification.json
 * via the Claude Code bridge.
 */
export function useVerification(jobName: string) {
  const storageKey = `verification:${jobName}`;

  const [verification, setVerification] = useState<Verification>(() => {
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        // Ignore corrupt data
      }
    }
    return {
      job_name: jobName,
      updated_at: new Date().toISOString(),
      cells: {},
    };
  });

  const save = useCallback(
    (updated: Verification) => {
      updated.updated_at = new Date().toISOString();
      setVerification(updated);
      localStorage.setItem(storageKey, JSON.stringify(updated));
    },
    [storageKey]
  );

  /** Get verification status for a cell */
  const getStatus = useCallback(
    (rowId: string, colId: string): VerificationEntry | null => {
      const key = `${rowId}:${colId}`;
      return verification.cells[key] || null;
    },
    [verification]
  );

  /** Mark a cell as verified */
  const verify = useCallback(
    (rowId: string, colId: string, note?: string) => {
      const key = `${rowId}:${colId}`;
      const updated = {
        ...verification,
        cells: {
          ...verification.cells,
          [key]: { status: 'verified' as const, note: note || null, override: null },
        },
      };
      save(updated);
    },
    [verification, save]
  );

  /** Flag a cell for review */
  const flag = useCallback(
    (rowId: string, colId: string, note: string) => {
      const key = `${rowId}:${colId}`;
      const updated = {
        ...verification,
        cells: {
          ...verification.cells,
          [key]: { status: 'flagged' as const, note, override: null },
        },
      };
      save(updated);
    },
    [verification, save]
  );

  /** Override a cell value */
  const override = useCallback(
    (rowId: string, colId: string, value: string, note?: string) => {
      const key = `${rowId}:${colId}`;
      const existing = verification.cells[key];
      const updated = {
        ...verification,
        cells: {
          ...verification.cells,
          [key]: {
            status: existing?.status || ('verified' as const),
            note: note || existing?.note || null,
            override: value,
          },
        },
      };
      save(updated);
    },
    [verification, save]
  );

  /** Clear verification for a cell */
  const clear = useCallback(
    (rowId: string, colId: string) => {
      const key = `${rowId}:${colId}`;
      const cells = { ...verification.cells };
      delete cells[key];
      save({ ...verification, cells });
    },
    [verification, save]
  );

  /** Count verified and flagged cells */
  const counts = {
    verified: Object.values(verification.cells).filter(
      (v) => v.status === 'verified'
    ).length,
    flagged: Object.values(verification.cells).filter(
      (v) => v.status === 'flagged'
    ).length,
  };

  return { verification, getStatus, verify, flag, override, clear, counts };
}
