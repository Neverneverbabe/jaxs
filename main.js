// js/main.js
import { auth } from "./firebase.js";
import { auth, firebaseAuthFunctions, loadFirebaseIfNeeded } from './firebase.js';
import { initApiRefs, fetchTmdbCategoryContent } from './api.js';
import { initUiRefs, clearAllDynamicContent, showPositionSavedIndicator, positionPopup, createBackButton, clearItemDetailPanel, clearSearchResultsPanel } from './ui.js'; // Added clearItemDetailPanel, clearSearchResultsPanel
import { initAuthRefs, handleAuthStateChanged, createAuthFormUI } from './auth.js';
import { initWatchlistRefs, loadAndDisplayWatchlistsFromFirestore, closeAllOptionMenus, handleCreateWatchlist, displayItemsInSelectedWatchlist } from './watchlist.js';
import { initSeenListRefs, loadAndDisplaySeenItems } from './seenList.js';
import { initHandlerRefs, handleSearch, handleItemSelect } from './handlers.js';
import {
    updateCurrentUserId, currentUserId,
    currentLatestType, currentLatestCategory, updateLatestPage, updateLatestType, updateLatestCategory,
    currentPopularType, updatePopularPage, updatePopularType, 
    previousStateForBackButton, updatePreviousStateForBackButton,
    scrollPositions, // Removed updateScrollPosition as it's used internally in handlers/state
    updateSelectedCertifications,
    selectedCertifications
} from './state.js';

window.createAuthFormUI_Global = createAuthFormUI;

// DOM Element Variables
let searchInput, searchButton, resultsContainer,
    tabSearch, tabWatchlist, tabSeen, tabLatest, tabPopular,
    searchView, watchlistView, seenView, latestView, popularView,
    messageArea, newWatchlistNameInput, createWatchlistBtn,
    watchlistTilesContainer, watchlistDisplayContainer,
    seenItemsDisplayContainer,
    latestContentDisplay, latestMoviesSubTab, latestTvShowsSubTab,
    popularContentDisplay, popularMoviesSubTab, popularTvShowsSubTab,
    userAuthIcon, authDropdownMenu,
    detailOverlay, detailOverlayContent, closeOverlayButton, // Ensure detailOverlayContent is declared
    overlayDetailTitle, overlayDetailContainer,
    overlayVidsrcPlayerSection,
    overlaySeasonsEpisodesSection,
    overlayRelatedItemsSection, overlayCollectionItemsSection, overlayBackButtonContainer,
    positionIndicator,
    itemVidsrcPlayerSection;

async function initializeAppState() {
    await loadFirebaseIfNeeded();

    // Assign DOM Elements
    searchInput = document.getElementById('searchInput');
    searchButton = document.getElementById('searchButton');
    resultsContainer = document.getElementById('resultsContainer');
    itemVidsrcPlayerSection = document.getElementById('itemVidsrcPlayerSection');

    tabSearch = document.getElementById('tabSearch');
    tabWatchlist = document.getElementById('tabWatchlist');
    tabSeen = document.getElementById('tabSeen');
    tabLatest = document.getElementById('tabLatest');
    tabPopular = document.getElementById('tabPopular');
    searchView = document.getElementById('searchView');
    if (searchView) searchView.classList.remove('hidden-view');
    watchlistView = document.getElementById('watchlistView');
    seenView = document.getElementById('seenView');
    latestView = document.getElementById('latestView');
    popularView = document.getElementById('popularView');
    messageArea = document.getElementById('messageArea');

    newWatchlistNameInput = document.getElementById('newWatchlistName');
    createWatchlistBtn = document.getElementById('createWatchlistBtn');
    watchlistTilesContainer = document.getElementById('watchlistTilesContainer');
    watchlistDisplayContainer = document.getElementById('watchlistDisplayContainer');
    /* Removed obsolete watchlist detail queries */

    seenItemsDisplayContainer = document.getElementById('seenItemsDisplayContainer');

    latestContentDisplay = document.getElementById('latestContentDisplay');
    latestMoviesSubTab = document.getElementById('latestMoviesSubTab');
    latestTvShowsSubTab = document.getElementById('latestTvShowsSubTab');

    popularContentDisplay = document.getElementById('popularContentDisplay');
    popularMoviesSubTab = document.getElementById('popularMoviesSubTab');
    popularTvShowsSubTab = document.getElementById('popularTvShowsSubTab');

    userAuthIcon = document.getElementById('userAuthIcon');
    authDropdownMenu = document.getElementById('authDropdownMenu');

    detailOverlay = document.getElementById('detailOverlay');
    detailOverlayContent = document.getElementById('detailOverlayContent'); // Make sure this is assigned
    closeOverlayButton = document.getElementById('closeOverlayButton');
    overlayDetailTitle = document.getElementById('overlayDetailTitle');
    overlayDetailContainer = document.getElementById('overlayDetailContainer');
    overlayVidsrcPlayerSection = document.getElementById('overlayVidsrcPlayerSection');
    overlaySeasonsEpisodesSection = document.getElementById('overlaySeasonsEpisodesSection');
    overlayRelatedItemsSection = document.getElementById('overlayRelatedItemsSection');
    overlayCollectionItemsSection = document.getElementById('overlayCollectionItemsSection');
    overlayBackButtonContainer = document.getElementById('overlayBackButtonContainer');
    positionIndicator = document.getElementById('positionIndicator');

    const allElements = {
        searchInput, searchButton, resultsContainer,
        tabSearch, tabWatchlist, tabSeen, tabLatest, tabPopular,
        searchView, watchlistView, seenView, latestView, popularView,
        messageArea, newWatchlistNameInput, createWatchlistBtn,
        watchlistTilesContainer, watchlistDisplayContainer,
        seenItemsDisplayContainer,
        latestContentDisplay, latestMoviesSubTab, latestTvShowsSubTab,
        popularContentDisplay, popularMoviesSubTab, popularTvShowsSubTab,
        userAuthIcon, authDropdownMenu,
        detailOverlay, detailOverlayContent, closeOverlayButton,
        overlayDetailTitle, overlayDetailContainer,
        overlayVidsrcPlayerSection, 
        overlaySeasonsEpisodesSection,
        overlayRelatedItemsSection, overlayCollectionItemsSection, overlayBackButtonContainer,
        positionIndicator, itemVidsrcPlayerSection
    };

    initUiRefs(allElements);
    initApiRefs(allElements);
    initAuthRefs(allElements);
    initWatchlistRefs(allElements);
    initSeenListRefs(allElements);
    initHandlerRefs(allElements);

    if (userAuthIcon) {
        userAuthIcon.addEventListener('click', (e) => {
            e.stopPropagation();
            if (authDropdownMenu) authDropdownMenu.classList.toggle('hidden');
        });
    }
    if (searchButton) searchButton.addEventListener('click', () => handleSearch());
    if (searchInput) searchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleSearch(); });

    if (createWatchlistBtn) createWatchlistBtn.addEventListener('click', handleCreateWatchlist);

    // Initialize default rating certifications
    updateSelectedCertifications(['All']);
    setupRatingFilters();

    // Additional fallback for select-based filters (if present on page)
    if (typeof ratingFilters !== 'undefined' && ratingFilters.length > 0) {
        ratingFilters.forEach(sel => {
            sel.addEventListener('change', () => {
                const values = Array.from(sel.selectedOptions).map(o => o.value);
                updateSelectedCertifications(values);
                if (sel.id === 'ratingFilterSearch') handleSearch();
                else if (sel.id === 'ratingFilterWatchlist') displayItemsInSelectedWatchlist();
                else if (sel.id === 'ratingFilterSeen') loadAndDisplaySeenItems();
            });
        });
        const initial = Array.from(ratingFilters[0].selectedOptions).map(o => o.value);
        updateSelectedCertifications(initial);
    }

    // Function to handle closing the overlay
    const closeOverlay = () => {
        if (detailOverlay) detailOverlay.classList.add('hidden');
        clearItemDetailPanel('overlay'); // Use specific clearer for overlay details
        if (previousStateForBackButton) {
            if (previousStateForBackButton.originTabId === 'tabLatest' && latestContentDisplay) {
                latestContentDisplay.scrollTop = scrollPositions.latest;
            } else if (previousStateForBackButton.originTabId === 'tabPopular' && popularContentDisplay) {
                popularContentDisplay.scrollTop = scrollPositions.popular;
            }
        }
        updatePreviousStateForBackButton(null);
    };

    if (closeOverlayButton && detailOverlay) {
        closeOverlayButton.addEventListener('click', closeOverlay);
    }

    // NEW: Listener for clicking overlay backdrop to close
    if (detailOverlay) {
        detailOverlay.addEventListener('click', (event) => {
            if (event.target === detailOverlay) { // Only close if the click is directly on the backdrop
                closeOverlay();
            }
        });
    }

    document.addEventListener('click', (event) => {
        if (userAuthIcon && authDropdownMenu && !userAuthIcon.contains(event.target) && !authDropdownMenu.contains(event.target)) {
            if(authDropdownMenu) authDropdownMenu.classList.add('hidden');
        }
        if (!event.target.closest('.watchlist-tile')) {
            closeAllOptionMenus();
        }

        const allManagePopups = document.querySelectorAll('.detail-panel-popup');
        allManagePopups.forEach(popup => {
            if (!popup.classList.contains('hidden')) {
                const parentButtonContainer = popup.parentElement;
                if (parentButtonContainer) {
                    const buttonId = parentButtonContainer.id.replace('Container', 'Button');
                    const correspondingButton = document.getElementById(buttonId);
                    if (!popup.contains(event.target) && (!correspondingButton || !correspondingButton.contains(event.target))) {
                        popup.classList.add('hidden');
                    }
                }
            }
        });
    });

    setupMainNavigationTabs();
    setupSubNavigationTabs();

    if (latestMoviesSubTab && latestContentDisplay) {
        fetchTmdbCategoryContent('latest', latestMoviesSubTab.dataset.type, latestMoviesSubTab.dataset.category, 1);
    }
    if (popularMoviesSubTab && popularContentDisplay) {
        fetchTmdbCategoryContent('popular', popularMoviesSubTab.dataset.type, popularMoviesSubTab.dataset.category, 1);
    }

    firebaseAuthFunctions.onAuthStateChanged(auth, (user) => {
        handleAuthStateChanged(user, allElements);
    });
}

function setupMainNavigationTabs() {
    const mainTabsConfig = [
        { button: tabSearch, view: searchView, action: () => {
            clearItemDetailPanel('item');
            // clearSearchResultsPanel(); // Uncomment if you want to clear results when clicking "Search" tab
          }
        },
        { button: tabWatchlist, view: watchlistView, action: async () => { await loadAndDisplayWatchlistsFromFirestore(); clearItemDetailPanel('watchlist'); } },
        { button: tabSeen, view: seenView, action: async () => await loadAndDisplaySeenItems() },
        {
            button: tabLatest, view: latestView, action: () => {
                const activeSubTab = latestView.querySelector('.sub-tab.active') || latestMoviesSubTab;
                if (activeSubTab) fetchTmdbCategoryContent('latest', activeSubTab.dataset.type, activeSubTab.dataset.category, 1);
                clearItemDetailPanel('item'); 
            }
        },
        {
            button: tabPopular, view: popularView, action: () => {
                const activeSubTab = popularView.querySelector('.sub-tab.active') || popularMoviesSubTab;
                if (activeSubTab) fetchTmdbCategoryContent('popular', activeSubTab.dataset.type, activeSubTab.dataset.category, 1);
                clearItemDetailPanel('item');
            }
        }
    ];
    const allViews = [searchView, watchlistView, seenView, latestView, popularView];

    mainTabsConfig.forEach(tabInfo => {
        if (tabInfo.button) {
            tabInfo.button.addEventListener('click', async () => {
                allViews.forEach(v => { if (v) v.classList.add('hidden-view') });
                mainTabsConfig.forEach(t => { if (t.button) t.button.classList.remove('active') });
                if (tabInfo.view) tabInfo.view.classList.remove('hidden-view');
                tabInfo.button.classList.add('active');
                if (tabInfo.action) await tabInfo.action();
            });
        }
    });
}

function setupSubNavigationTabs() {
    const subTabsSetup = (moviesTab, tvShowsTab, mainCat) => {
        const subTabs = [moviesTab, tvShowsTab];
        subTabs.forEach(tab => {
            if (tab) {
                tab.addEventListener('click', () => {
                    const parentView = tab.closest('.hidden-view') || (mainCat === 'latest' ? latestView : popularView);
                    if (parentView) parentView.querySelectorAll('.sub-tab').forEach(t => t.classList.remove('active'));
                    tab.classList.add('active');
                    const type = tab.dataset.type;
                    const category = tab.dataset.category;

                    if (mainCat === 'latest') {
                        updateLatestPage(1);
                        updateLatestType(type);
                        updateLatestCategory(category);
                    } else if (mainCat === 'popular') {
                        updatePopularPage(1);
                        updatePopularType(type);
                    }
                    fetchTmdbCategoryContent(mainCat, type, category, 1);
                });
            }
        });
    };

    if (latestMoviesSubTab && latestTvShowsSubTab && latestContentDisplay) {
        subTabsSetup(latestMoviesSubTab, latestTvShowsSubTab, 'latest');
    }
    if (popularMoviesSubTab && popularTvShowsSubTab && popularContentDisplay) {
        subTabsSetup(popularMoviesSubTab, popularTvShowsSubTab, 'popular');
    }
}

window.handleLatestPageChange = (newPage) => {
    updateLatestPage(newPage);
    fetchTmdbCategoryContent('latest', currentLatestType, currentLatestCategory, newPage);
};
window.handlePopularPageChange = (newPage) => {
    updatePopularPage(newPage);
    const category = popularMoviesSubTab ? popularMoviesSubTab.dataset.category : 'popular';
    fetchTmdbCategoryContent('popular', currentPopularType, category, newPage);
};

document.addEventListener('DOMContentLoaded', initializeAppState);

function setupRatingFilters() {
    const configs = [
        {
            btn: document.getElementById('ratingFilterSearchBtn'),
            popup: document.getElementById('ratingFilterSearchPopup'),
            apply: document.getElementById('ratingFilterSearchApply'),
            action: () => handleSearch()
        },
        {
            btn: document.getElementById('ratingFilterWatchlistBtn'),
            popup: document.getElementById('ratingFilterWatchlistPopup'),
            apply: document.getElementById('ratingFilterWatchlistApply'),
            action: () => displayItemsInSelectedWatchlist()
        },
        {
            btn: document.getElementById('ratingFilterSeenBtn'),
            popup: document.getElementById('ratingFilterSeenPopup'),
            apply: document.getElementById('ratingFilterSeenApply'),
            action: () => loadAndDisplaySeenItems()
        },
        {
            btn: document.getElementById('ratingFilterLatestBtn'),
            popup: document.getElementById('ratingFilterLatestPopup'),
            apply: document.getElementById('ratingFilterLatestApply'),
            action: () => fetchTmdbCategoryContent('latest', currentLatestType, currentLatestCategory, 1)
        },
        {
            btn: document.getElementById('ratingFilterPopularBtn'),
            popup: document.getElementById('ratingFilterPopularPopup'),
            apply: document.getElementById('ratingFilterPopularApply'),
            action: () => fetchTmdbCategoryContent('popular', currentPopularType, 'popular', 1)
        }
    ];

    configs.forEach(cfg => {
        if (!cfg.btn || !cfg.popup || !cfg.apply) return;
        const checkboxes = cfg.popup.querySelectorAll('input[type="checkbox"]');
        cfg.btn.addEventListener('click', (e) => {
            e.stopPropagation();
            checkboxes.forEach(cb => {
                cb.checked = selectedCertifications.includes(cb.value);
            });
            positionPopup(cfg.btn, cfg.popup);
            cfg.popup.classList.toggle('hidden');
        });
        checkboxes.forEach(cb => {
            cb.addEventListener('change', () => {
                if (cb.value === 'All' && cb.checked) {
                    checkboxes.forEach(other => { if (other.value !== 'All') other.checked = false; });
                } else if (cb.checked) {
                    const allCb = cfg.popup.querySelector('input[value="All"]');
                    if (allCb) allCb.checked = false;
                }
            });
        });
        cfg.apply.addEventListener('click', () => {
            let values = Array.from(cfg.popup.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);
            if (values.includes('All') && values.length > 1) {
                values = values.filter(v => v !== 'All');
            }
            if (values.length === 0) values = ['All'];
            updateSelectedCertifications(values);
            cfg.popup.classList.add('hidden');
            if (cfg.action) cfg.action();
        });
    });

    document.addEventListener('click', (e) => {
        configs.forEach(cfg => {
            if (cfg.popup && !cfg.popup.classList.contains('hidden')) {
                if (!cfg.popup.contains(e.target) && !cfg.btn.contains(e.target)) {
                    cfg.popup.classList.add('hidden');
                }
            }
        });
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            configs.forEach(cfg => {
                if (cfg.popup && !cfg.popup.classList.contains('hidden')) {
                    cfg.popup.classList.add('hidden');
                }
            });
        }
    });
}
