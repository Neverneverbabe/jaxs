import { jest } from '@jest/globals';

jest.unstable_mockModule('firebase/app', () => ({}), { virtual: true });
jest.unstable_mockModule('firebase/auth', () => ({}), { virtual: true });
jest.unstable_mockModule('firebase/firestore', () => ({}), { virtual: true });

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
