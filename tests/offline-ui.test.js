const fs = require('fs');

describe('service worker offline cache', () => {
  const sw = fs.readFileSync('app/sw.js', 'utf8');

  test('uses new cache name', () => {
    const match = sw.match(/const CACHE_NAME = \"(.+?)\"/);
    expect(match[1]).toBe('jaxs-cache-v2');
  });

  test('caches base app files', () => {
    const filesMatch = sw.match(/const files = \[((?:.|\n)*?)\]/);
    const arr = Function('return [' + filesMatch[1] + ']')();
    expect(arr).toEqual(expect.arrayContaining([
      '/jaxs/app/index.html',
      '/jaxs/app/appMain.js',
      '/jaxs/app/manifest.json',
      '/jaxs/app/icon-192.png',
      '/jaxs/dist/bundle.js'
    ]));
  });
});
