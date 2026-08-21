/**
 * Example React Component using Vercel Reader
 * Demonstrates how to fetch and display content from URLs
 */

'use client';

import { useState } from 'react';

interface ContentData {
  url: string;
  content: string;
  metadata: {
    wordCount: number;
    estimatedReadTime: number;
    preview: string;
  };
}

export function VercelReaderExample() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ContentData | null>(null);

  const handleFetch = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setData(null);

    try {
      const response = await fetch('/api/reader', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch content');
      }

      const result = await response.json();
      setData(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='w-full max-w-4xl mx-auto p-6'>
      <h1 className='text-3xl font-bold mb-6'>Vercel Reader Content Extractor</h1>

      {/* Input Form */}
      <form onSubmit={handleFetch} className='mb-8'>
        <div className='flex gap-2 mb-4'>
          <input
            type='url'
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder='Enter URL (e.g., https://example.com)'
            required
            className='flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
          />
          <button
            type='submit'
            disabled={loading}
            className='px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed'
          >
            {loading ? 'Fetching...' : 'Fetch Content'}
          </button>
        </div>
      </form>

      {/* Error Message */}
      {error && (
        <div className='mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg'>
          <p className='font-semibold'>Error</p>
          <p>{error}</p>
        </div>
      )}

      {/* Content Display */}
      {data && (
        <div className='space-y-6'>
          <div className='bg-gray-50 p-4 rounded-lg'>
            <h2 className='text-xl font-semibold mb-2'>Content Metadata</h2>
            <dl className='grid grid-cols-2 gap-4'>
              <div>
                <dt className='text-sm font-medium text-gray-600'>URL</dt>
                <dd className='text-sm text-gray-900 break-all'>{data.url}</dd>
              </div>
              <div>
                <dt className='text-sm font-medium text-gray-600'>Word Count</dt>
                <dd className='text-sm text-gray-900'>{data.metadata.wordCount}</dd>
              </div>
              <div>
                <dt className='text-sm font-medium text-gray-600'>Estimated Reading Time</dt>
                <dd className='text-sm text-gray-900'>{data.metadata.estimatedReadTime} min</dd>
              </div>
              <div className='col-span-2'>
                <dt className='text-sm font-medium text-gray-600'>Preview</dt>
                <dd className='text-sm text-gray-900'>{data.metadata.preview}</dd>
              </div>
            </dl>
          </div>

          <div>
            <h2 className='text-xl font-semibold mb-2'>Content</h2>
            <div className='bg-white p-4 rounded-lg border border-gray-200 max-h-96 overflow-y-auto'>
              <pre className='text-sm whitespace-pre-wrap break-words font-mono text-gray-700'>
                {data.content}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className='flex justify-center items-center py-8'>
          <div className='animate-spin'>
            <div className='h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full'></div>
          </div>
          <p className='ml-4 text-gray-600'>Fetching content...</p>
        </div>
      )}

      {/* Empty State */}
      {!data && !error && !loading && (
        <div className='text-center py-8 text-gray-500'>
          <p>Enter a URL and click "Fetch Content" to extract content from a webpage</p>
        </div>
      )}
    </div>
  );
}

export default VercelReaderExample;
