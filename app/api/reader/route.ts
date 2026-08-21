/**
 * API endpoint for fetching content using Vercel Reader
 * Usage: POST /api/reader
 * Body: { "url": "https://example.com" }
 */

import { fetchContentFromURL, extractMetadata } from '@/lib/vercel-reader';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { url } = body;

    // Validation
    if (!url || typeof url !== 'string') {
      return Response.json(
        { error: 'URL parameter is required and must be a string' },
        { status: 400 }
      );
    }

    // Fetch content
    const content = await fetchContentFromURL(url, {
      timeout: 30000,
      retries: 3,
    });

    // Extract metadata
    const metadata = extractMetadata(content);

    return Response.json({
      success: true,
      data: {
        url,
        content,
        metadata,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    return Response.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint for testing
 */
export async function GET() {
  return Response.json({
    message: 'Vercel Reader API endpoint',
    usage: {
      method: 'POST',
      path: '/api/reader',
      body: { url: 'https://example.com' },
    },
  });
}
