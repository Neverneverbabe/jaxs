import { jest } from '@jest/globals';
jest.unstable_mockModule('firebase/app', () => ({}), { virtual: true });
jest.unstable_mockModule('firebase/auth', () => ({}), { virtual: true });
jest.unstable_mockModule('firebase/firestore', () => ({}), { virtual: true });
jest.unstable_mockModule('../firebase.js', () => ({
  db: {},
  auth: {},
  firebaseAuthFunctions: {},
  firebaseFirestoreFunctions: {}
}));
const { buildSearchUrl } = await import('../api.js');

describe('buildSearchUrl', () => {
  test('includes certifications when provided', () => {
    const url = buildSearchUrl('test', 'movie', ['PG-13', 'R']);
    expect(url).toContain('certification=PG-13%7CR');
  });
});
