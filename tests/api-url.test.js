import { buildSearchUrl } from '../api.js';

describe('buildSearchUrl', () => {
  test('includes certifications when provided', () => {
    const url = buildSearchUrl('test', 'movie', ['PG-13', 'R']);
    expect(url).toContain('certification=PG-13%7CR');
  });
});
