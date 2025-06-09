import { jest } from '@jest/globals';

jest.unstable_mockModule('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js', () => ({}), { virtual: true });
jest.unstable_mockModule('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js', () => ({}), { virtual: true });
jest.unstable_mockModule('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js', () => ({}), { virtual: true });

jest.unstable_mockModule('../firebase.js', () => ({
  db: {},
  auth: {},
  firebaseAuthFunctions: {},
  firebaseFirestoreFunctions: {},
  loadFirebaseIfNeeded: async () => {}
}));

await import('../main.js');

describe('main.js global functions', () => {
  test('loadUserFirestoreWatchlists is defined on window', () => {
    expect(typeof window.loadUserFirestoreWatchlists).toBe('function');
  });
});
