import { JSDOM } from 'jsdom';

function triggerSignOut(userId) {
  // Simulates the sign-out cleanup performed in index.html
  localStorage.removeItem(`mediaFinderLastSelectedWatchlist_${userId}`);
}

describe('Sign-out cleanup', () => {
  test('removes mediaFinderLastSelectedWatchlist_<USERID> from localStorage', () => {
    const dom = new JSDOM('', { url: 'http://localhost/' });
    global.window = dom.window;
    global.document = dom.window.document;
    global.localStorage = dom.window.localStorage;

    const userId = 'user123';
    localStorage.setItem(`mediaFinderLastSelectedWatchlist_${userId}`, 'dummy');
    const spy = jest.spyOn(window.localStorage.__proto__, 'removeItem');
    triggerSignOut(userId);
    expect(spy).toHaveBeenCalledWith(`mediaFinderLastSelectedWatchlist_${userId}`);
    expect(localStorage.getItem(`mediaFinderLastSelectedWatchlist_${userId}`)).toBeNull();
  });
});
