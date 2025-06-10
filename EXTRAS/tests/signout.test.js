function handleSignOut(userId) { 
  // This mimics the onAuthStateChanged handler when the user logs out
  localStorage.removeItem(`mediaFinderLastSelectedWatchlist_${userId}`);
}

describe('sign out flow', () => {
  const USER_ID = 'abc123';

  // Provide a simple localStorage mock
  let store;
  beforeEach(() => {
    store = {};
    Object.defineProperty(global, 'localStorage', {
      value: {
        getItem: (key) => store[key] || null,
        setItem: (key, value) => { store[key] = String(value); },
        removeItem: (key) => { delete store[key]; },
        clear: () => { store = {}; }
      },
      configurable: true
    });
  });

  test('removes last selected watchlist key on sign out', () => {
    localStorage.setItem(`mediaFinderLastSelectedWatchlist_${USER_ID}`, 'test');
    handleSignOut(USER_ID);
    expect(localStorage.getItem(`mediaFinderLastSelectedWatchlist_${USER_ID}`)).toBeNull();
  });
});
