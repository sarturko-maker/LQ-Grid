import { useState, useEffect, useCallback } from 'react';
import type { Manifest } from '@/types';

const MANIFEST_PATH = '/data/output/ui-manifest.json';
const POLL_INTERVAL = 3000; // Check for updates every 3 seconds

/**
 * Load and auto-reload ui-manifest.json.
 *
 * In development, loads from a local JSON file served by Vite.
 * Polls for changes so the UI refreshes when Claude Code updates the file.
 */
export function useManifest() {
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastModified, setLastModified] = useState<string | null>(null);

  const fetchManifest = useCallback(async () => {
    try {
      const response = await fetch(MANIFEST_PATH, { cache: 'no-store' });
      if (!response.ok) {
        if (response.status === 404) {
          setManifest(null);
          setLoading(false);
          return;
        }
        throw new Error(`HTTP ${response.status}`);
      }

      // Check if modified since last fetch
      const modified = response.headers.get('last-modified');
      if (modified && modified === lastModified) {
        return; // No change
      }
      setLastModified(modified);

      const data: Manifest = await response.json();
      setManifest(data);
      setError(null);
    } catch (err) {
      // Don't overwrite existing manifest on poll errors
      if (!manifest) {
        setError(err instanceof Error ? err.message : 'Failed to load');
      }
    } finally {
      setLoading(false);
    }
  }, [lastModified, manifest]);

  // Initial load
  useEffect(() => {
    fetchManifest();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Poll for updates
  useEffect(() => {
    const interval = setInterval(fetchManifest, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchManifest]);

  const reload = useCallback(() => {
    setLastModified(null);
    fetchManifest();
  }, [fetchManifest]);

  const clear = useCallback(() => {
    setManifest(null);
    setLastModified(null);
  }, []);

  return { manifest, loading, error, reload, clear };
}
