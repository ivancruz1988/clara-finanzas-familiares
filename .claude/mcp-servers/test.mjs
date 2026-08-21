#!/usr/bin/env node

/**
 * Test script for Vercel Reader MCP Server
 * Runs basic functionality tests
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let testsPassed = 0;
let testsFailed = 0;
const results = [];

async function test(name, fn) {
  try {
    console.log(`\n📋 Running: ${name}...`);
    await fn();
    testsPassed++;
    results.push({ name, status: '✅ PASS' });
    console.log(`✅ ${name} passed`);
  } catch (error) {
    testsFailed++;
    results.push({ name, status: '❌ FAIL', error: error.message });
    console.error(`❌ ${name} failed:`, error.message);
  }
}

function sendMessage(process, message) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Timeout waiting for response'));
    }, 5000);

    const onData = (data) => {
      clearTimeout(timeout);
      process.stdout.removeListener('data', onData);
      try {
        const response = JSON.parse(data.toString().trim());
        resolve(response);
      } catch (e) {
        reject(new Error(`Failed to parse response: ${e.message}`));
      }
    };

    process.stdout.on('data', onData);
    process.stdin.write(JSON.stringify(message) + '\n\n');
  });
}

async function runTests() {
  console.log('🚀 Starting Vercel Reader MCP Server Tests...\n');

  await test('Server starts successfully', async () => {
    const server = spawn('node', [join(__dirname, 'vercel-reader.js')]);

    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        server.kill();
        resolve(); // Consider startup successful if process lives for a moment
      }, 1000);

      server.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });

      server.stderr.on('data', (data) => {
        clearTimeout(timeout);
        server.kill();
        reject(new Error(`Server error: ${data.toString()}`));
      });
    });
  });

  await test('Initialize message works', async () => {
    const server = spawn('node', [join(__dirname, 'vercel-reader.js')]);

    try {
      const response = await sendMessage(server, {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
      });

      if (!response.result || !response.result.protocolVersion) {
        throw new Error('Invalid initialize response');
      }
    } finally {
      server.kill();
    }
  });

  await test('Tools list endpoint works', async () => {
    const server = spawn('node', [join(__dirname, 'vercel-reader.js')]);

    try {
      const response = await sendMessage(server, {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
      });

      if (!response.result || !Array.isArray(response.result.tools)) {
        throw new Error('Invalid tools/list response');
      }

      const fetchTool = response.result.tools.find((t) => t.name === 'fetch_content');
      if (!fetchTool) {
        throw new Error('fetch_content tool not found');
      }
    } finally {
      server.kill();
    }
  });

  // Print summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 Test Summary');
  console.log('='.repeat(50));
  results.forEach(({ name, status, error }) => {
    console.log(`${status} ${name}`);
    if (error) console.log(`   └─ ${error}`);
  });
  console.log('='.repeat(50));
  console.log(`Total: ${testsPassed} passed, ${testsFailed} failed\n`);

  process.exit(testsFailed > 0 ? 1 : 0);
}

runTests().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
