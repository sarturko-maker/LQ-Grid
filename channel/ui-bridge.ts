#!/usr/bin/env bun
/**
 * LQ Grid — UI Bridge Channel
 *
 * MCP channel server that bridges the React UI to Claude Code.
 * The UI POSTs requests to localhost:3002. This channel pushes
 * them into the Claude Code session in real-time.
 *
 * Claude Code can reply via the "reply" tool, and the response
 * is served back to the UI via SSE and a JSON file the UI polls.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { writeFileSync, mkdirSync } from 'fs'
import { join, resolve } from 'path'
import { handleRequest } from './http-routes'

const PROJECT = resolve(import.meta.dir, '..')
const RESPONSES_DIR = join(PROJECT, 'data', 'output', 'responses')
const REQUESTS_DIR = join(PROJECT, 'data', 'output', 'requests')
mkdirSync(RESPONSES_DIR, { recursive: true })
mkdirSync(REQUESTS_DIR, { recursive: true })

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
    capabilities: { experimental: { 'claude/channel': {} }, tools: {} },
    instructions: `You are receiving requests from the LQ Grid web UI via the lq-ui-bridge channel.

When a message arrives as <channel source="lq-ui-bridge" ...>, it contains a JSON request from a lawyer using the review interface. The request has a type and payload:

- type "query": Read data/output/ui-manifest.json. Answer as an experienced M&A solicitor. Use the reply tool with the request_id.
- type "add_column": Spawn a reviewer agent to extract the field. Update manifest. Use the reply tool.
- type "action": Draft bespoke deliverables. Save to output directory. Use the reply tool.
- type "upload": Follow the Full Extraction Workflow in CLAUDE.md.

ALWAYS use the reply tool to respond — the UI is waiting for your answer.`,
  },
)

// Reply tool — sends response back to the UI
mcp.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [{
    name: 'reply',
    description: 'Send a response back to the LQ Grid UI.',
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
    const { request_id, text } = req.params.arguments as { request_id: string; text: string }
    writeFileSync(join(RESPONSES_DIR, `${request_id}.json`), JSON.stringify({ answer: text }))
    broadcast(JSON.stringify({ id: request_id, answer: text }))
    return { content: [{ type: 'text' as const, text: 'Response sent to UI' }] }
  }
  throw new Error(`Unknown tool: ${req.params.name}`)
})

await mcp.connect(new StdioServerTransport())

// Shared state for HTTP routes
let _nextId = 1
const notify = async (data: object, reqId: string, type: string) => {
  try {
    await mcp.notification({
      method: 'notifications/claude/channel',
      params: { content: JSON.stringify(data), meta: { request_id: reqId, type } },
    })
  } catch (err) {
    console.error('[ui-bridge] MCP notification failed:', err)
  }
}

Bun.serve({
  port: 3002,
  hostname: '127.0.0.1',
  idleTimeout: 0,
  fetch: (req) => handleRequest(req, new URL(req.url), {
    project: PROJECT,
    responsesDir: RESPONSES_DIR,
    requestsDir: REQUESTS_DIR,
    listeners,
    notify,
    nextId: () => _nextId++,
  }),
})
