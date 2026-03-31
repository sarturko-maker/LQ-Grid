/**
 * HTTP route handlers for the UI bridge server.
 * Separated from the MCP channel setup for readability.
 */

import { writeFileSync, readFileSync, mkdirSync, readdirSync, statSync, existsSync, unlinkSync, rmSync } from 'fs'
import { basename } from 'path'
import { join } from 'path'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

interface RouteContext {
  project: string
  responsesDir: string
  requestsDir: string
  listeners: Set<(chunk: string) => void>
  notify: (data: object, reqId: string, type: string) => Promise<void>
  nextId: () => number
}

export function handleRequest(req: Request, url: URL, ctx: RouteContext): Response | Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })

  if (req.method === 'GET' && url.pathname === '/events') return handleSSE(req, ctx)
  if (req.method === 'GET' && url.pathname.startsWith('/response/')) return handleGetResponse(url, ctx)
  if (req.method === 'GET' && url.pathname.startsWith('/files/')) return handleListFiles(url, ctx)
  if (req.method === 'GET' && url.pathname.startsWith('/download/')) return handleDownload(url, ctx)
  if (req.method === 'POST' && url.pathname === '/upload') return handleUpload(req, ctx)
  if (req.method === 'POST' && url.pathname === '/request') return handlePostRequest(req, ctx)
  if (req.method === 'GET' && url.pathname === '/group') return handleGroup(url, ctx)
  if (req.method === 'POST' && url.pathname === '/rows/delete') return handleDeleteRows(req, ctx)
  if (req.method === 'POST' && url.pathname === '/manifest/clear') return handleClearManifest(ctx)

  return new Response('not found', { status: 404, headers: CORS })
}

function handleSSE(req: Request, ctx: RouteContext) {
  const stream = new ReadableStream({
    start(ctrl) {
      const enc = new TextEncoder()
      ctrl.enqueue(enc.encode(': connected\n\n'))
      const emit = (chunk: string) => ctrl.enqueue(enc.encode(chunk))
      ctx.listeners.add(emit)
      req.signal.addEventListener('abort', () => ctx.listeners.delete(emit))
    },
  })
  return new Response(stream, {
    headers: { ...CORS, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
  })
}

async function handleGetResponse(url: URL, ctx: RouteContext) {
  const reqId = url.pathname.split('/response/')[1]
  const respPath = join(ctx.responsesDir, `${reqId}.json`)
  try {
    const file = Bun.file(respPath)
    if (await file.exists()) {
      return new Response(await file.text(), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }
  } catch {}
  return json({ status: 'processing' }, 202)
}

function handleListFiles(url: URL, ctx: RouteContext) {
  const rel = url.pathname.slice(7)
  if (rel.includes('..')) return new Response('forbidden', { status: 403, headers: CORS })
  const dirPath = join(ctx.project, 'data', 'output', rel)
  try {
    const entries = readdirSync(dirPath)
      .filter(f => !f.startsWith('.'))
      .map(f => ({ name: f, size: statSync(join(dirPath, f)).size }))
    return json({ files: entries })
  } catch {
    return json({ files: [] })
  }
}

async function handleDownload(url: URL, ctx: RouteContext) {
  const rel = url.pathname.slice(10)
  if (rel.includes('..')) return new Response('forbidden', { status: 403, headers: CORS })
  let filePath = join(ctx.project, 'data', 'output', rel)
  let file = Bun.file(filePath)
  if (!(await file.exists())) {
    filePath = join(ctx.project, 'data', rel)
    file = Bun.file(filePath)
  }
  if (await file.exists()) {
    return new Response(file, {
      headers: { ...CORS, 'Content-Disposition': `attachment; filename="${rel.split('/').pop()}"` },
    })
  }
  return new Response('not found', { status: 404, headers: CORS })
}

async function handleUpload(req: Request, ctx: RouteContext) {
  const formData = await req.formData()
  const files: string[] = []
  let schema = 'consent-review'
  let customColumns = ''
  let engine = 'claude'
  let apiKey = ''

  for (const [key, value] of formData.entries()) {
    if (key === 'schema' && typeof value === 'string') { schema = value; continue }
    if (key === 'custom_columns' && typeof value === 'string') { customColumns = value; continue }
    if (key === 'engine' && typeof value === 'string') { engine = value; continue }
    if (key === 'api_key' && typeof value === 'string') { apiKey = value; continue }
    if (!(value instanceof File)) continue
    const name = value.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const buf = await value.arrayBuffer()
    writeFileSync(join(ctx.project, 'data', 'contracts', name), Buffer.from(buf))
    const publicDir = join(ctx.project, 'src', 'ui', 'public', 'data', 'contracts')
    mkdirSync(publicDir, { recursive: true })
    writeFileSync(join(publicDir, name), Buffer.from(buf))
    files.push(name)
  }

  if (files.length > 0) {
    let schemaInstruction: string
    if (schema === 'custom' && customColumns) {
      schemaInstruction = `The user defined a CUSTOM schema. Create a schema JSON from these columns and save it to templates/schemas/custom.json, then use it for extraction:\n` + customColumns
    } else {
      schemaInstruction = `Extract using the ${schema} schema (templates/schemas/${schema}.json)`
    }

    const reqId = `upload_${ctx.nextId()}`
    const schemaFile = schema === 'custom' ? 'custom' : schema
    const fileList = files.map(f => `- ${f}`).join('\n')

    let prompt: string
    const envPrefix = apiKey ? `ISAACUS_API_KEY=${apiKey} ` : ''
    if (engine === 'isaacus') {
      prompt = `${files.length} contracts have been uploaded to data/contracts/:\n${fileList}\n\n` +
        `Use the Isaacus RAG pipeline (Preview):\n` +
        `1. Convert documents: python3 src/pipeline/convert.py --input data/contracts/ --output data/output/texts/\n` +
        `2. ${schemaInstruction}\n` +
        `3. Run RAG: ${envPrefix}python3 src/pipeline/isaacus_rag.py --texts data/output/texts/ --schema templates/schemas/${schemaFile}.json --output data/output/results/\n` +
        `4. Read data/output/results/rag-prompts.json — it contains agent batches with pre-selected clause excerpts per document\n` +
        `5. For each agent batch: spawn a Sonnet reviewer agent. The agent receives ONLY the relevant clause excerpts (not full documents). ` +
        `Each agent should extract all listed columns using the provided clauses, quoting verbatim with character offsets from the original document. ` +
        `Write results to data/output/results/{batch_name}.json in the standard reviewer format.\n` +
        `6. Launch up to 10 agents in parallel per wave. After each wave, rebuild manifest and copy to UI:\n` +
        `   python3 src/pipeline/format_for_ui.py --results data/output/results/ --schema templates/schemas/${schemaFile}.json --output data/output/ui-manifest.json --contracts data/contracts/\n` +
        `   cp data/output/ui-manifest.json src/ui/public/data/output/ui-manifest.json\n` +
        `7. Reply confirming how many documents were processed`
    } else {
      prompt = `${files.length} contracts have been uploaded to data/contracts/:\n${fileList}\n\n` +
        `Follow the Full Extraction Workflow in CLAUDE.md:\n` +
        `1. Convert all documents to text\n` +
        `2. ${schemaInstruction} — spawn up to 10 parallel Sonnet agents per wave, 5 docs each\n` +
        `3. After each wave completes, rebuild the manifest and copy to UI so the grid populates progressively\n` +
        `4. Continue until all documents are extracted`
    }

    const requestData = {
      id: reqId, type: 'upload',
      payload: { files, schema, engine, customColumns: customColumns || undefined },
      prompt,
    }
    writeFileSync(join(ctx.requestsDir, `${reqId}.json`), JSON.stringify(requestData, null, 2))
    await ctx.notify(requestData, reqId, 'upload')
  }

  return json({ ok: true, count: files.length, files })
}

async function handleGroup(url: URL, ctx: RouteContext) {
  const mode = url.searchParams.get('mode')
  if (!mode || !['party', 'relationship'].includes(mode)) {
    return json({ error: 'mode must be "party" or "relationship"' }, 400)
  }
  const manifest = join(ctx.project, 'data', 'output', 'ui-manifest.json')
  const script = join(ctx.project, 'src', 'pipeline', 'group_documents.py')
  try {
    const proc = Bun.spawn(['python3', script, '--manifest', manifest, '--mode', mode], {
      stdout: 'pipe', stderr: 'pipe',
    })
    const stdout = await new Response(proc.stdout).text()
    const code = await proc.exited
    if (code !== 0) {
      const stderr = await new Response(proc.stderr).text()
      return json({ error: stderr || 'script failed' }, 500)
    }
    return new Response(stdout, {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (e: unknown) {
    return json({ error: String(e) }, 500)
  }
}

/**
 * Delete specific rows. Cleans up: manifest, result files, texts, contracts.
 * Without this cleanup, format_for_ui.py would resurrect deleted rows on rebuild.
 */
async function handleDeleteRows(req: Request, ctx: RouteContext) {
  const body = await req.json()
  const ids: string[] = body.ids
  if (!Array.isArray(ids) || ids.length === 0) {
    return json({ error: 'ids must be a non-empty array' }, 400)
  }
  const manifestPath = join(ctx.project, 'data', 'output', 'ui-manifest.json')
  const publicPath = join(ctx.project, 'src', 'ui', 'public', 'data', 'output', 'ui-manifest.json')
  if (!existsSync(manifestPath)) return json({ error: 'no manifest' }, 404)
  try {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'))
    const removeSet = new Set(ids)

    // Collect document filenames before removing from manifest
    const removedDocs: string[] = []
    for (const row of manifest.rows) {
      if (removeSet.has(row._id)) removedDocs.push(row._document)
    }

    // Remove rows from manifest
    const before = manifest.rows.length
    manifest.rows = manifest.rows.filter((r: { _id: string }) => !removeSet.has(r._id))
    const removed = before - manifest.rows.length
    manifest.job.document_count = manifest.rows.length

    // Recount cells
    let complete = 0, failed = 0, pending = 0
    for (const row of manifest.rows) {
      for (const cell of Object.values(row.cells) as Array<{ status: string }>) {
        if (cell.status === 'complete') complete++
        else if (cell.status === 'failed') failed++
        else pending++
      }
    }
    manifest.summary = { ...manifest.summary, total_cells: manifest.rows.length * manifest.columns.length, complete, failed, pending }
    const out = JSON.stringify(manifest, null, 2)
    writeFileSync(manifestPath, out)
    writeFileSync(publicPath, out)

    // Clean up source files for each removed document
    for (const doc of removedDocs) {
      const stem = doc.replace(/\.[^.]+$/, '')
      // Remove converted text
      const txtPath = join(ctx.project, 'data', 'output', 'texts', stem + '.txt')
      if (existsSync(txtPath)) unlinkSync(txtPath)
      // Remove original contract from both locations
      const contractPath = join(ctx.project, 'data', 'contracts', doc)
      if (existsSync(contractPath)) unlinkSync(contractPath)
      const publicContractPath = join(ctx.project, 'src', 'ui', 'public', 'data', 'contracts', doc)
      if (existsSync(publicContractPath)) unlinkSync(publicContractPath)
    }

    // Remove this document from result batch files
    purgeFromResults(join(ctx.project, 'data', 'output', 'results'), removedDocs)

    return json({ ok: true, removed, remaining: manifest.rows.length })
  } catch (e: unknown) {
    return json({ error: String(e) }, 500)
  }
}

/**
 * Clear the entire grid. Wipes manifest, results, texts, and contracts
 * so the next upload starts from a clean slate.
 */
function handleClearManifest(ctx: RouteContext) {
  // Delete manifest files
  const manifestPath = join(ctx.project, 'data', 'output', 'ui-manifest.json')
  const publicPath = join(ctx.project, 'src', 'ui', 'public', 'data', 'output', 'ui-manifest.json')
  for (const p of [manifestPath, publicPath]) {
    if (existsSync(p)) unlinkSync(p)
  }
  // Wipe extraction results, texts, contracts, and requests
  const dirs = [
    join(ctx.project, 'data', 'output', 'results'),
    join(ctx.project, 'data', 'output', 'texts'),
    join(ctx.project, 'data', 'output', 'requests'),
    join(ctx.project, 'data', 'contracts'),
    join(ctx.project, 'src', 'ui', 'public', 'data', 'contracts'),
  ]
  for (const dir of dirs) {
    if (existsSync(dir)) {
      for (const f of readdirSync(dir)) {
        if (f.startsWith('.')) continue
        unlinkSync(join(dir, f))
      }
    }
  }
  return json({ ok: true })
}

/**
 * Remove documents from batch result JSON files.
 * Each batch file is a JSON array; we filter out matching _document entries.
 * If a batch file becomes empty, delete it.
 */
function purgeFromResults(resultsDir: string, docNames: string[]) {
  if (!existsSync(resultsDir)) return
  const stems = new Set(docNames.map(d => d.replace(/\.[^.]+$/, '')))
  for (const file of readdirSync(resultsDir)) {
    if (!file.endsWith('.json')) continue
    const fp = join(resultsDir, file)
    try {
      const data = JSON.parse(readFileSync(fp, 'utf-8'))
      if (!Array.isArray(data)) continue
      const filtered = data.filter((item: { _document?: string }) => {
        const docStem = (item._document || '').replace(/\.[^.]+$/, '')
        return !stems.has(docStem)
      })
      if (filtered.length === 0) {
        unlinkSync(fp)
      } else if (filtered.length < data.length) {
        writeFileSync(fp, JSON.stringify(filtered, null, 2))
      }
    } catch { /* skip malformed files */ }
  }
}

async function handlePostRequest(req: Request, ctx: RouteContext) {
  const body = await req.json()
  const requestId = body.id || `req_${ctx.nextId()}`
  const requestData = { ...body, id: requestId }
  writeFileSync(join(ctx.requestsDir, `${requestId}.json`), JSON.stringify(requestData, null, 2))
  await ctx.notify(requestData, requestId, body.type || 'unknown')
  return json({ ok: true, id: requestId })
}
