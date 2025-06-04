function handleSignOut(userId) {
  // Mimics sign-out cleanup that removes the user-specific key
  localStorage.removeItem(`mediaFinderLastSelectedWatchlist_${userId}`);
}

describe('sign out flow', () => {
  const USER_ID = 'abc123';
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
    jest.spyOn(global.localStorage, 'removeItem');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('removes last selected watchlist key on sign out', () => {
    localStorage.setItem(`mediaFinderLastSelectedWatchlist_${USER_ID}`, 'test');
    handleSignOut(USER_ID);
    expect(localStorage.removeItem).toHaveBeenCalledWith(`mediaFinderLastSelectedWatchlist_${USER_ID}`);
    expect(localStorage.getItem(`mediaFinderLastSelectedWatchlist_${USER_ID}`)).toBeNull();
  });
});
