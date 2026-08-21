/**
 * Type definitions for MCP (Model Context Protocol) servers
 * Used for communication with Claude's MCP servers
 */

export interface MCPMessage {
  jsonrpc: string;
  id?: string | number;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: MCPError;
}

export interface MCPError {
  code: number;
  message: string;
  data?: unknown;
}

export interface MCPInitializeRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: 'initialize';
}

export interface MCPInitializeResponse {
  protocolVersion: string;
  capabilities: {
    tools?: Record<string, unknown>;
    resources?: Record<string, unknown>;
  };
  serverInfo: {
    name: string;
    version: string;
  };
}

export interface MCPToolsListRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: 'tools/list';
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface MCPToolsListResponse {
  tools: MCPTool[];
}

export interface MCPToolCallRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: 'tools/call';
  params: {
    name: string;
    arguments: Record<string, unknown>;
  };
}

export interface MCPToolCallResponse {
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
}

/**
 * Vercel Reader MCP Server specific types
 */
export interface VercelReaderResponse {
  success: boolean;
  content?: string;
  markdown?: string;
  error?: string;
}

export interface FetchContentToolParams {
  url: string;
}

export interface FetchContentToolResult {
  content: string;
}
