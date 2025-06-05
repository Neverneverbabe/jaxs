// js/handlers.js
import { fetchItemDetails, fetchSearchResults } from './api.js';
import {
    clearItemDetailPanel, // Use new specific function
    clearSearchResultsPanel, // Use new specific function
    showLoading, 
    createBackButton, 
    showPositionSavedIndicator
} from './ui.js';
import {
    previousStateForBackButton, updatePreviousStateForBackButton,
    scrollPositions, updateScrollPosition,
    updateSelectedCertification
} from './state.js';

// DOM Elements
let detailOverlay, detailOverlayContent, searchView, latestView, popularView, watchlistView,
    tabLatest, tabPopular,
    latestContentDisplay, popularContentDisplay,
    overlayDetailTitle, overlayDetailContainer,
    overlaySeasonsEpisodesSection, overlayRelatedItemsSection,
    overlayCollectionItemsSection, overlayVidsrcPlayerSection,
    overlayBackButtonContainer,
    searchInputGlobal,
    ratingFilterGlobal;

export function initHandlerRefs(elements) {
    detailOverlay = elements.detailOverlay;
    detailOverlayContent = elements.detailOverlayContent;
    searchView = elements.searchView;
    latestView = elements.latestView;
    popularView = elements.popularView;
    watchlistView = elements.watchlistView;
    tabLatest = elements.tabLatest;
    tabPopular = elements.tabPopular;
    latestContentDisplay = elements.latestContentDisplay;
    popularContentDisplay = elements.popularContentDisplay;
    overlayDetailTitle = elements.overlayDetailTitle;
    overlayDetailContainer = elements.overlayDetailContainer;
    overlaySeasonsEpisodesSection = elements.overlaySeasonsEpisodesSection;
    overlayRelatedItemsSection = elements.overlayRelatedItemsSection;
    overlayCollectionItemsSection = elements.overlayCollectionItemsSection;
    overlayVidsrcPlayerSection = elements.overlayVidsrcPlayerSection;
    overlayBackButtonContainer = elements.overlayBackButtonContainer;
    searchInputGlobal = elements.searchInput;
    ratingFilterGlobal = elements.ratingFilter;
}


export async function handleItemSelect(itemId, itemTitle, itemType, calledFromOverlay = false) {
    const currentDetailContainerEl = overlayDetailContainer;
    const currentSeasonsEl = overlaySeasonsEpisodesSection;
    const currentRelatedEl = overlayRelatedItemsSection;
    const currentCollectionEl = overlayCollectionItemsSection;
    const currentPlayerEl = overlayVidsrcPlayerSection;
    const currentBackButtonContainerEl = overlayBackButtonContainer;
    const currentDetailTitleEl = overlayDetailTitle;

    if (!calledFromOverlay) {
        let originTabId = 'tabSearch';
        let backButtonContext = 'searchList';

        if (watchlistView && !watchlistView.classList.contains('hidden-view')) {
            originTabId = 'tabWatchlist';
            backButtonContext = 'watchlistItemsList';
        } else if (latestView && !latestView.classList.contains('hidden-view')) {
            originTabId = 'tabLatest';
            backButtonContext = 'latestList';
            if (latestContentDisplay) updateScrollPosition('latest', latestContentDisplay.scrollTop);
            showPositionSavedIndicator();
        } else if (popularView && !popularView.classList.contains('hidden-view')) {
            originTabId = 'tabPopular';
            backButtonContext = 'popularList';
            if (popularContentDisplay) updateScrollPosition('popular', popularContentDisplay.scrollTop);
            showPositionSavedIndicator();
        }

        updatePreviousStateForBackButton({ originTabId });

        if (currentBackButtonContainerEl) {
            currentBackButtonContainerEl.innerHTML = '';
            const backBtn = createBackButton(backButtonContext);
            currentBackButtonContainerEl.appendChild(backBtn);
        }
    }

    if (detailOverlay) detailOverlay.classList.remove('hidden');
    if (detailOverlayContent) detailOverlayContent.scrollTop = 0;

    clearItemDetailPanel('overlay');

    if (currentDetailContainerEl) {
        showLoading('details-overlay', `Loading ${itemTitle}...`, currentDetailContainerEl);
    }
    if (currentDetailTitleEl) currentDetailTitleEl.classList.add('hidden');

    await fetchItemDetails(itemId, itemType, {
        currentDetailContainerEl,
        currentSeasonsEl,
        currentRelatedEl,
        currentCollectionEl,
        currentPlayerEl,
        targetViewContext: 'overlay',
        itemTitle
    });
}

export function getSelectedSearchType() {
    const checkedRadio = document.querySelector('input[name="searchType"]:checked');
    return checkedRadio ? checkedRadio.value : 'movie';
}

export async function handleSearch() {
    if (!searchInputGlobal) { console.error("Search input not initialized in handlers.js"); return; }
    const query = searchInputGlobal.value.trim();
    const itemType = getSelectedSearchType();
    const rating = ratingFilterGlobal ? ratingFilterGlobal.value : 'All';
    updateSelectedCertification(rating);
    if (!query) {
        showToast("Please enter a title.", "error"); // Ensure showToast is available
        return;
    }
    clearItemDetailPanel("item");      // Clear previous item details
    clearSearchResultsPanel();      // Explicitly clear search results for a new search
    await fetchSearchResults(query, itemType, rating);
}