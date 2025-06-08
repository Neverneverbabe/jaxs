const fs = require('fs');

describe('service worker offline cache', () => {
  const sw = fs.readFileSync('app/sw.js', 'utf8');

  test('uses new cache name', () => {
    const match = sw.match(/const CACHE_NAME = \"(.+?)\"/);
    expect(match[1]).toBe('jaxs-cache-v2');
  });

  test('caches apple tv ui files', () => {
    const filesMatch = sw.match(/const files = \[((?:.|\n)*?)\]/);
    const arr = Function('return [' + filesMatch[1] + ']')();
    expect(arr).toEqual(expect.arrayContaining([
      '/jaxs/app/apple-tv-main/index.html',
      '/jaxs/app/apple-tv-main/app.css',
      '/jaxs/app/apple-tv-main/app.js',
      '/jaxs/app/apple-tv-main/logos/github.svg',
      '/jaxs/app/apple-tv-main/logos/tailwindcss.svg',
      '/jaxs/app/apple-tv-main/docs/screenshot.png'
    ]));
  });
});
