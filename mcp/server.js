#!/usr/bin/env node
// 3Draft MCP server: JSON-RPC 2.0 over stdio, one JSON message per line.
// No dependencies. stdout carries the protocol only; logs go to stderr.

import { createInterface } from 'node:readline';
import { pathToFileURL } from 'node:url';
import { createScene } from './scene.js';
import { version } from '../src/index.js';

const SUPPORTED = ['2025-06-18', '2025-03-26', '2024-11-05'];

const INSTRUCTIONS = [
  'You are modelling in 3Draft, a minimalist 3D engine: flat-colored convex faces, no textures.',
  'Y is up, the ground is y = 0, units are arbitrary. Faces are counter-clockwise seen from outside.',
  'Build with add_box / add_extrusion (add_mesh for raw geometry), then ALWAYS look: call render (a sheet of four views by default),',
  'read the SVG, then fix. inspect checks the geometry, pick turns a pixel of a render into a 3D point and a surface normal.',
  'Name objects after what they are ("seat", "leg_fl") so you can transform, recolor and remove them later.',
].join(' ');

const reply = (msg) => process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', ...msg })}\n`);
const error = (id, code, message) => reply({ id, error: { code, message } });

export const serve = (input = process.stdin) => {
  const scene = createScene();

  const handle = (req) => {
    const { id, method, params } = req;
    const isRequest = id !== undefined && id !== null;
    if (!isRequest) return; // notifications (initialized, cancelled, ...) need no answer
    switch (method) {
      case 'initialize': {
        const asked = params?.protocolVersion;
        return reply({
          id,
          result: {
            protocolVersion: SUPPORTED.includes(asked) ? asked : SUPPORTED[0],
            capabilities: { tools: {} },
            serverInfo: { name: '3draft', version },
            instructions: INSTRUCTIONS,
          },
        });
      }
      case 'ping':
        return reply({ id, result: {} });
      case 'tools/list':
        return reply({ id, result: { tools: scene.list() } });
      case 'tools/call': {
        if (typeof params?.name !== 'string') return error(id, -32602, 'tools/call needs a tool name');
        const out = scene.call(params.name, params.arguments ?? {});
        return reply({ id, result: { content: [{ type: 'text', text: out.text }], ...(out.isError ? { isError: true } : {}) } });
      }
      default:
        return error(id, -32601, `method not found: ${method}`);
    }
  };

  const rl = createInterface({ input });
  rl.on('line', (line) => {
    if (!line.trim()) return;
    let req;
    try {
      req = JSON.parse(line);
    } catch {
      return error(null, -32700, 'parse error');
    }
    if (Array.isArray(req) || typeof req !== 'object' || req === null || typeof req.method !== 'string') {
      return error(req?.id ?? null, -32600, 'invalid request');
    }
    try {
      handle(req);
    } catch (e) {
      console.error('3draft-mcp:', e);
      if (req.id !== undefined && req.id !== null) error(req.id, -32603, 'internal error');
    }
  });
  return rl;
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.error(`3draft MCP server ${version} ready on stdio`);
  serve();
}
