import React, { useState } from 'react';
import axios from 'axios';
import * as cheerio from 'cheerio';
import * as XLSX from 'xlsx';

function App() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState([]);
  const [scannedCount, setScannedCount] = useState(0);
  const [totalFound, setTotalFound] = useState(0);

  const normalizeUrl = (base, href) => {
    try {
      return new URL(href, base).href;
    } catch {
      return null;
    }
  };

  const isValidUrl = (url) => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const isSameDomain = (baseUrl, url) => {
    try {
      return new URL(url).origin === baseUrl;
    } catch {
      return false;
    }
  };

  const extractPageInfo = ($, url, status) => ({
    url,
    status,
    title: $('title').text() || 'No title',
    description: $('meta[name="description"]').attr('content') || 'No description'
  });

  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(results);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Crawl Results');
    XLSX.writeFile(workbook, 'crawl-results.xlsx');
  };

const crawlWebsite = async () => {
  if (!url) {
    setError('Please enter a URL');
    return;
  }

  try {
    setLoading(true);
    setError('');
    setResults([]);
    setScannedCount(0);
    setTotalFound(0);

    const visited = new Set();
    const toVisit = new Set([url]);
    const baseUrl = new URL(url).origin;
    const crawlResults = [];
    const batchSize = 5;

    const axiosInstance = axios.create({
      timeout: 15000,
      maxRedirects: 5,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; WebCrawler/1.0)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      }
    });

    while (toVisit.size > 0) {
      const batch = Array.from(toVisit).slice(0, batchSize);
      batch.forEach(url => toVisit.delete(url));

      await Promise.all(
        batch.map(async (pageUrl) => {
          if (visited.has(pageUrl)) return;
          visited.add(pageUrl);

          try {
            const response = await axiosInstance.get(pageUrl);
            const status = response.status;

            if (status === 200) {
              const $ = cheerio.load(response.data);
              const pageInfo = extractPageInfo($, pageUrl, status);
              crawlResults.push(pageInfo);
              setScannedCount(prev => prev + 1);

              $('a').each((_, element) => {
                const href = $(element).attr('href');
                if (!href) return;

                const normalizedUrl = normalizeUrl(pageUrl, href);
                if (
                  normalizedUrl &&
                  isValidUrl(normalizedUrl) &&
                  isSameDomain(baseUrl, normalizedUrl) &&
                  !visited.has(normalizedUrl) &&
                  !toVisit.has(normalizedUrl) &&
                  !normalizedUrl.includes('#') // Exclude URLs with anchors
                ) {
                  toVisit.add(normalizedUrl);
                  setTotalFound(prev => prev + 1);
                }
              });
            } else {
              crawlResults.push({
                url: pageUrl,
                status,
                title: status === 404 ? 'Page Not Found' : 'Error',
                description: `HTTP ${status}`
              });
            }
          } catch (error) {
            let errorStatus = error.response?.status || 'Error';
            let errorMessage = error.message;

            crawlResults.push({
              url: pageUrl,
              status: errorStatus,
              title: 'Error',
              description: errorMessage
            });
          }
          setResults([...crawlResults]);
        })
      );
    }
  } catch (error) {
    setError('Error crawling website. Please check the URL and try again.');
  } finally {
    setLoading(false);
  }
};


  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Website Crawler</h1>
        
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <div className="flex gap-4">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Enter website URL (e.g., https://example.com)"
              className="flex-1 p-2 border rounded"
            />
            <button
              onClick={crawlWebsite}
              disabled={loading}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-blue-300"
            >
              {loading ? 'Crawling...' : 'Start Crawl'}
            </button>
          </div>
          
          {error && (
            <div className="mt-4 p-4 bg-red-100 text-red-700 rounded">
              {error}
            </div>
          )}

          {loading && (
            <div className="mt-4">
              <p>Pages scanned: {scannedCount}</p>
              <p>Total links found: {totalFound}</p>
            </div>
          )}
        </div>

        {results.length > 0 && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="p-4 border-b flex justify-between items-center">
              <h2 className="text-xl font-semibold">Results</h2>
              <button
                onClick={exportToExcel}
                className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
              >
                Export to Excel
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">URL</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {results.map((result, index) => (
                    <tr key={index} className={result.status === 404 ? 'bg-red-50' : ''}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600">
                        <a href={result.url} target="_blank" rel="noopener noreferrer">
                          {result.url}
                        </a>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {result.status}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {result.title}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {result.description}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;