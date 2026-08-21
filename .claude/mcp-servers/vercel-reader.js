#!/usr/bin/env node

/**
 * MCP Server for Vercel Reader
 * Provides tools to extract and clean content from URLs using reader.vercel.ai
 */

const readline = require('readline');

// Initialize stdio for MCP communication
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

let inputBuffer = '';

rl.on('line', (line) => {
  inputBuffer += line + '\n';

  const messages = inputBuffer.split('\n\n');
  inputBuffer = messages.pop(); // Keep incomplete message

  for (const message of messages) {
    if (message.trim()) {
      try {
        const jsonMessage = JSON.parse(message);
        handleMessage(jsonMessage);
      } catch (e) {
        sendError('Invalid JSON received');
      }
    }
  }
});

const PROTOCOL_VERSION = '2024-11-05';

function handleMessage(message) {
  const { jsonrpc, id, method, params } = message;

  try {
    if (method === 'initialize') {
      handleInitialize(id);
    } else if (method === 'resources/list') {
      handleResourcesList(id);
    } else if (method === 'tools/list') {
      handleToolsList(id);
    } else if (method === 'tools/call') {
      handleToolCall(id, params);
    } else if (method === 'completion/complete') {
      handleCompletion(id, params);
    } else {
      sendError(`Unknown method: ${method}`, id);
    }
  } catch (error) {
    sendError(error.message, id);
  }
}

function handleInitialize(id) {
  sendResponse(id, {
    protocolVersion: PROTOCOL_VERSION,
    capabilities: {
      tools: {},
      resources: {},
    },
    serverInfo: {
      name: 'vercel-reader',
      version: '1.0.0',
    },
  });
}

function handleToolsList(id) {
  sendResponse(id, {
    tools: [
      {
        name: 'fetch_content',
        description: 'Fetch and clean content from a URL using Vercel Reader',
        inputSchema: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              description: 'The URL to fetch content from',
            },
          },
          required: ['url'],
        },
      },
    ],
  });
}

function handleResourcesList(id) {
  sendResponse(id, {
    resources: [],
  });
}

async function handleToolCall(id, params) {
  const { name, arguments: args } = params;

  if (name === 'fetch_content') {
    try {
      const { url } = args;

      if (!url) {
        sendError('URL parameter is required', id);
        return;
      }

      const content = await fetchFromVercelReader(url);
      sendResponse(id, {
        content: [
          {
            type: 'text',
            text: content,
          },
        ],
      });
    } catch (error) {
      sendError(`Failed to fetch content: ${error.message}`, id);
    }
  } else {
    sendError(`Unknown tool: ${name}`, id);
  }
}

function handleCompletion(id, params) {
  sendResponse(id, {
    completion: '',
  });
}

async function fetchFromVercelReader(url) {
  return new Promise((resolve, reject) => {
    const https = require('https');
    const payload = JSON.stringify({ url });

    const options = {
      hostname: 'reader.vercel.ai',
      path: '/api/content',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'User-Agent': 'Claude-MCP-VercelReader/1.0',
      },
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          if (res.statusCode !== 200) {
            throw new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`);
          }

          const result = JSON.parse(data);

          if (!result.success) {
            throw new Error(result.error || 'Failed to fetch content');
          }

          resolve(result.content || result.markdown || JSON.stringify(result, null, 2));
        } catch (error) {
          reject(new Error(`Failed to parse response: ${error.message}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`Vercel Reader request failed: ${error.message}`));
    });

    req.write(payload);
    req.end();
  });
}

function sendResponse(id, result) {
  const response = {
    jsonrpc: '2.0',
    id,
    result,
  };
  console.log(JSON.stringify(response) + '\n');
}

function sendError(message, id) {
  const error = {
    jsonrpc: '2.0',
    id,
    error: {
      code: -32603,
      message,
    },
  };
  console.log(JSON.stringify(error) + '\n');
}

// Handle process termination gracefully
process.on('SIGINT', () => {
  rl.close();
  process.exit(0);
});
