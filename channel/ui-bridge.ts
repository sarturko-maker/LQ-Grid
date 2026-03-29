#!/usr/bin/env bun
/**
 * LQ Grid — UI Bridge Channel
 *
 * MCP channel server that bridges the React UI to Claude Code.
 * The UI POSTs requests to localhost:3002. This channel pushes
 * them into the Claude Code session in real-time.
 *
 * Claude Code can reply via the "reply" tool, and the response
 * is served back to the UI via SSE (Server-Sent Events) and
 * a JSON file that the UI polls.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import { writeFileSync, mkdirSync } from 'fs'
import { join, resolve } from 'path'

const PROJECT = resolve(import.meta.dir, '..')
const RESPONSES_DIR = join(PROJECT, 'data', 'output', 'responses')
mkdirSync(RESPONSES_DIR, { recursive: true })

// SSE listeners for real-time replies to the UI
const listeners = new Set<(chunk: string) => void>()
function broadcast(data: string) {
  const chunk = data.split('\n').map(l => `data: ${l}\n`).join('') + '\n'
  for (const emit of listeners) emit(chunk)
}

// Create MCP channel server
const mcp = new Server(
  { name: 'lq-ui-bridge', version: '1.0.0' },
  {
    capabilities: {
      experimental: { 'claude/channel': {} },
      tools: {},
    },
    instructions: `You are receiving requests from the LQ Grid web UI via the lq-ui-bridge channel.

When a message arrives as <channel source="lq-ui-bridge" ...>, it contains a JSON request from a lawyer using the review interface. The request has a type and payload:

- type "query": The user is asking a question about the reviewed contracts. Read data/output/ui-manifest.json. Answer as an experienced M&A solicitor — note legal subtleties, reference specific documents and clause numbers. Use the reply tool with the request_id to send your answer back. Format your answer in Markdown.

- type "add_column": The user wants to add a new extraction column. Read the prompt from the payload. Spawn a reviewer agent to extract this field from all documents in data/output/texts/. Write results to data/output/results/. Run format_for_ui.py to update the manifest. Use the reply tool to confirm completion.

- type "action": The user wants to generate deliverables (consent letters, reports, etc). Read the actual contracts, draft bespoke documents. Save to the appropriate output directory. Convert to DOCX. Use the reply tool to confirm.

ALWAYS use the reply tool to respond — the UI is waiting for your answer.`,
  },
)

// Reply tool — sends response back to the UI
mcp.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [{
    name: 'reply',
    description: 'Send a response back to the LQ Grid UI. The UI is polling for this response.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        request_id: { type: 'string' as const, description: 'The request ID from the channel event' },
        text: { type: 'string' as const, description: 'The response text (Markdown supported)' },
      },
      required: ['request_id', 'text'],
    },
  }],
}))

mcp.setRequestHandler(CallToolRequestSchema, async (req) => {
  if (req.params.name === 'reply') {
    const { request_id, text } = req.params.arguments as {
      request_id: string
      text: string
    }

    // Write response file for UI polling
    const respPath = join(RESPONSES_DIR, `${request_id}.json`)
    writeFileSync(respPath, JSON.stringify({ answer: text }))

    // Broadcast via SSE for real-time delivery
    broadcast(JSON.stringify({ id: request_id, answer: text }))

    return { content: [{ type: 'text' as const, text: 'Response sent to UI' }] }
  }
  throw new Error(`Unknown tool: ${req.params.name}`)
})

// Connect to Claude Code over stdio
await mcp.connect(new StdioServerTransport())

// HTTP server — receives requests from the UI
let nextId = 1
Bun.serve({
  port: 3002,
  hostname: '127.0.0.1',
  idleTimeout: 0,

  async fetch(req) {
    const url = new URL(req.url)

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }

    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders })
    }

    // SSE endpoint for real-time responses
    if (req.method === 'GET' && url.pathname === '/events') {
      const stream = new ReadableStream({
        start(ctrl) {
          const enc = new TextEncoder()
          ctrl.enqueue(enc.encode(': connected\n\n'))
          const emit = (chunk: string) => ctrl.enqueue(enc.encode(chunk))
          listeners.add(emit)
          req.signal.addEventListener('abort', () => listeners.delete(emit))
        },
      })
      return new Response(stream, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
        },
      })
    }

    // Check for response by ID
    if (req.method === 'GET' && url.pathname.startsWith('/response/')) {
      const reqId = url.pathname.split('/response/')[1]
      const respPath = join(RESPONSES_DIR, `${reqId}.json`)
      try {
        const file = Bun.file(respPath)
        if (await file.exists()) {
          const data = await file.text()
          return new Response(data, {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
      } catch {}
      return new Response(JSON.stringify({ status: 'processing' }), {
        status: 202,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // List files in an output directory
    if (req.method === 'GET' && url.pathname.startsWith('/files/')) {
      const rel = url.pathname.slice(7) // remove '/files/'
      if (rel.includes('..')) {
        return new Response('forbidden', { status: 403, headers: corsHeaders })
      }
      const dirPath = join(PROJECT, 'data', 'output', rel)
      try {
        const { readdirSync, statSync } = await import('fs')
        const entries = readdirSync(dirPath)
          .filter(f => !f.startsWith('.'))
          .map(f => ({ name: f, size: statSync(join(dirPath, f)).size }))
        return new Response(JSON.stringify({ files: entries }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      } catch {
        return new Response(JSON.stringify({ files: [] }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    // Download a file (from data/output/ or data/contracts/)
    if (req.method === 'GET' && url.pathname.startsWith('/download/')) {
      const rel = url.pathname.slice(10)
      if (rel.includes('..')) {
        return new Response('forbidden', { status: 403, headers: corsHeaders })
      }
      // Try data/output/ first, then data/ (for contracts/)
      let filePath = join(PROJECT, 'data', 'output', rel)
      let file = Bun.file(filePath)
      if (!(await file.exists())) {
        filePath = join(PROJECT, 'data', rel)
        file = Bun.file(filePath)
      }
      if (await file.exists()) {
        return new Response(file, {
          headers: {
            ...corsHeaders,
            'Content-Disposition': `attachment; filename="${rel.split('/').pop()}"`,
          },
        })
      }
      return new Response('not found', { status: 404, headers: corsHeaders })
    }

    // Upload contracts — saves files and triggers pipeline
    if (req.method === 'POST' && url.pathname === '/upload') {
      const formData = await req.formData()
      const files: string[] = []

      for (const [, value] of formData.entries()) {
        if (!(value instanceof File)) continue
        const name = value.name.replace(/[^a-zA-Z0-9._-]/g, '_')
        const buf = await value.arrayBuffer()

        // Save to data/contracts/
        const contractsPath = join(PROJECT, 'data', 'contracts', name)
        writeFileSync(contractsPath, Buffer.from(buf))

        // Also copy to public dir for preview
        const publicDir = join(PROJECT, 'src', 'ui', 'public', 'data', 'contracts')
        mkdirSync(publicDir, { recursive: true })
        writeFileSync(join(publicDir, name), Buffer.from(buf))

        files.push(name)
      }

      if (files.length > 0) {
        // Notify Claude Code to start the pipeline
        const reqId = `upload_${nextId++}`
        await mcp.notification({
          method: 'notifications/claude/channel',
          params: {
            content: JSON.stringify({
              id: reqId,
              type: 'upload',
              payload: { files },
              prompt:
                `${files.length} contracts have been uploaded to data/contracts/:\n` +
                files.map(f => `- ${f}`).join('\n') + '\n\n' +
                `Follow the Full Extraction Workflow in CLAUDE.md:\n` +
                `1. Convert all documents to text\n` +
                `2. Extract using the consent-review schema — spawn up to 10 parallel Sonnet agents per wave, 5 docs each\n` +
                `3. After each wave completes, rebuild the manifest and copy to UI so the grid populates progressively\n` +
                `4. Continue until all documents are extracted`,
            }),
            meta: { request_id: reqId, type: 'upload' },
          },
        })
      }

      return new Response(JSON.stringify({ ok: true, count: files.length, files }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Receive request from UI
    if (req.method === 'POST' && url.pathname === '/request') {
      const body = await req.json()
      const requestId = body.id || `req_${nextId++}`

      // Push into Claude Code session
      await mcp.notification({
        method: 'notifications/claude/channel',
        params: {
          content: JSON.stringify(body),
          meta: {
            request_id: requestId,
            type: body.type || 'unknown',
          },
        },
      })

      return new Response(JSON.stringify({ ok: true, id: requestId }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response('not found', { status: 404, headers: corsHeaders })
  },
})
