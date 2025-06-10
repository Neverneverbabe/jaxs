import { jest } from '@jest/globals';

jest.unstable_mockModule('firebase/app', () => ({}), { virtual: true });
jest.unstable_mockModule('firebase/auth', () => ({ auth: {}, firebaseAuthFunctions: {} }), { virtual: true });
jest.unstable_mockModule('firebase/firestore', () => ({ db: {}, firebaseFirestoreFunctions: {} }), { virtual: true });

jest.unstable_mockModule('../firebase.js', () => ({
  // Provide minimal mocks for imported firebase objects/functions
  db: {},
  auth: {},
  firebaseAuthFunctions: {},
  firebaseFirestoreFunctions: {},
  loadFirebaseIfNeeded: async () => {}
}));

// Import the specific function being tested directly
const { loadUserFirestoreWatchlists } = await import('../main.js');

describe('main.js global functions', () => {
  test('loadUserFirestoreWatchlists is defined on window', () => {
    expect(typeof loadUserFirestoreWatchlists).toBe('function');
  });
});
