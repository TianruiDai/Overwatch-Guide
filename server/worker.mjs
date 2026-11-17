import assets from '#site-assets';
import {
  handleApi
} from './api.mjs';

export default {
  async fetch(request, env) {
    const pathname = new URL(request.url).pathname;
    if (pathname.startsWith('/api/')) return handleApi(request, env, {
      sourceDownload: true
    });
    if (!['GET', 'HEAD'].includes(request.method)) return new Response(null, {
      status: 405
    });
    const asset = assets[pathname === '/' ? '/index.html' : pathname];
    if (!asset || typeof asset.data !== 'string') return new Response('Not found', {
      status: 404
    });
    const headers = new Headers({
      'Content-Type': asset.type,
      'ETag': asset.etag,
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin'
    });
    if (pathname.endsWith('.zip')) headers.set('Content-Disposition', 'attachment; filename="overwatch-guide.zip"');
    if (request.headers.get('if-none-match') === asset.etag) return new Response(null, {
      status: 304,
      headers
    });
    if (request.method === 'HEAD') return new Response(null, {
      headers
    });
    const bytes = Uint8Array.from(atob(asset.data), ch => ch.charCodeAt(0));
    return new Response(bytes, {
      headers
    });
  }
};
