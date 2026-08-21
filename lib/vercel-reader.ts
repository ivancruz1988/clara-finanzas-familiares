/**
 * Vercel Reader Client
 * Utility for interacting with the Vercel Reader MCP Server
 */

import https from 'https';

interface VercelReaderConfig {
  timeout?: number;
  retries?: number;
}

interface VercelReaderResponse {
  success: boolean;
  content?: string;
  markdown?: string;
  error?: string;
}

/**
 * Fetch content from a URL using Vercel Reader API
 * This can be used directly without MCP server for simple use cases
 */
export async function fetchContentFromURL(
  url: string,
  config: VercelReaderConfig = {}
): Promise<string> {
  const { timeout = 30000, retries = 3 } = config;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await makeRequest(url, timeout);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < retries - 1) {
        // Exponential backoff
        await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }
  }

  throw lastError || new Error('Failed to fetch content after retries');
}

function makeRequest(url: string, timeout: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({ url });

    const options = {
      hostname: 'reader.vercel.ai',
      path: '/api/content',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'User-Agent': 'VercelReaderClient/1.0',
      },
      timeout,
    };

    const req = https.request(options, (res) => {
      let data = '';

      const timeoutId = setTimeout(() => {
        req.destroy();
        reject(new Error('Response timeout'));
      }, timeout);

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        clearTimeout(timeoutId);

        try {
          if (res.statusCode !== 200) {
            throw new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`);
          }

          const result: VercelReaderResponse = JSON.parse(data);

          if (!result.success) {
            throw new Error(result.error || 'Vercel Reader returned an error');
          }

          const content = result.content || result.markdown || '';
          resolve(content);
        } catch (error) {
          reject(error instanceof Error ? error : new Error(String(error)));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`Request failed: ${error.message}`));
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.write(payload);
    req.end();
  });
}

/**
 * Extract key information from content
 */
export function extractMetadata(content: string): {
  wordCount: number;
  estimatedReadTime: number;
  preview: string;
} {
  const wordCount = content.split(/\s+/).length;
  const estimatedReadTime = Math.ceil(wordCount / 200); // Assume 200 WPM

  // Get first 200 chars as preview
  const preview = content.substring(0, 200).replace(/\n/g, ' ').trim() + '...';

  return {
    wordCount,
    estimatedReadTime,
    preview,
  };
}

/**
 * Validate if a string is a valid URL
 */
export function isValidURL(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Format content for display
 */
export function formatContent(content: string, maxLength?: number): string {
  let formatted = content.trim();

  if (maxLength && formatted.length > maxLength) {
    formatted = formatted.substring(0, maxLength) + '\n\n[Content truncated...]';
  }

  return formatted;
}
