import { buildSearchUrl } from '../api.js';

describe('buildSearchUrl', () => {
  test('includes certification when provided', () => {
    const url = buildSearchUrl('test', 'movie', 'PG-13');
    expect(url).toContain('certification=PG-13');
  });
});
