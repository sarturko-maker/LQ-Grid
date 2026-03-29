/**
 * Actions — request generation via relay, poll for results, download.
 */

const RELAY = 'http://localhost:3002';

export interface GeneratedFile {
  name: string;
  size: number;
}

/** Check what files exist in a directory via relay */
export async function listFiles(dir: string): Promise<GeneratedFile[]> {
  try {
    const r = await fetch(`${RELAY}/files/${dir}`);
    if (!r.ok) return [];
    const data = await r.json();
    return (data.files || []).filter((f: GeneratedFile) =>
      f.name.endsWith('.docx')
    );
  } catch {
    return [];
  }
}

/** Download a file via relay */
export function downloadFile(dir: string, filename: string): void {
  const url = `${RELAY}/download/${dir}/${filename}`;
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/** Download all DOCX files from a directory */
export async function downloadAll(dir: string): Promise<void> {
  const files = await listFiles(dir);
  for (const f of files) {
    downloadFile(dir, f.name);
    await new Promise((r) => setTimeout(r, 400));
  }
}

/** Request an action via relay and poll for results */
export async function requestAction(
  actionId: string,
  prompt: string
): Promise<string> {
  const id = `act_${Date.now()}`;
  try {
    await fetch(`${RELAY}/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, type: 'action', payload: { actionId }, prompt }),
    });
  } catch {
    throw new Error('Relay not running. Start: python3 src/pipeline/relay.py');
  }
  return id;
}

/** Poll relay for a response by request ID */
export async function pollResponse(
  reqId: string,
  timeoutMs = 120000
): Promise<{ status: string; data?: unknown }> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await fetch(`${RELAY}/response/${reqId}`);
      const data = await r.json();
      if (r.status === 200) return { status: 'done', data };
      // 202 = still processing, keep polling
    } catch {
      // Relay down
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  return { status: 'timeout' };
}
