import { jest } from '@jest/globals';
jest.unstable_mockModule('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js', () => ({}), { virtual: true });
jest.unstable_mockModule('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js', () => ({}), { virtual: true });
jest.unstable_mockModule('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js', () => ({}), { virtual: true });
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
