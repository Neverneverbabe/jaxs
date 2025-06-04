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
    scrollPositions, updateScrollPosition
} from './state.js';

// DOM Elements
let detailOverlay, detailOverlayContent, searchView, latestView, popularView, watchlistView,
    tabLatest, tabPopular, 
    latestContentDisplay, popularContentDisplay,
    itemDetailTitle, overlayDetailTitle, watchlistItemDetailTitle,
    itemDetailContainer, overlayDetailContainer, watchlistItemDetailContainer,
    itemSeasonsEpisodesSection, overlaySeasonsEpisodesSection, watchlistSeasonsEpisodesSection,
    itemRelatedItemsSection, overlayRelatedItemsSection, watchlistRelatedItemsSection,
    itemCollectionItemsSection, overlayCollectionItemsSection, watchlistCollectionItemsSection,
    itemVidsrcPlayerSection, overlayVidsrcPlayerSection, watchlistVidsrcPlayerSection,
    itemBackButtonContainer, overlayBackButtonContainer, watchlistBackButtonContainer,
    searchInputGlobal; 

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
    itemDetailTitle = elements.itemDetailTitle;
    overlayDetailTitle = elements.overlayDetailTitle;
    watchlistItemDetailTitle = elements.watchlistItemDetailTitle;
    itemDetailContainer = elements.itemDetailContainer;
    overlayDetailContainer = elements.overlayDetailContainer;
    watchlistItemDetailContainer = elements.watchlistItemDetailContainer;
    itemSeasonsEpisodesSection = elements.itemSeasonsEpisodesSection;
    overlaySeasonsEpisodesSection = elements.overlaySeasonsEpisodesSection;
    watchlistSeasonsEpisodesSection = elements.watchlistSeasonsEpisodesSection;
    itemRelatedItemsSection = elements.itemRelatedItemsSection;
    overlayRelatedItemsSection = elements.overlayRelatedItemsSection;
    watchlistRelatedItemsSection = elements.watchlistRelatedItemsSection;
    itemCollectionItemsSection = elements.itemCollectionItemsSection;
    overlayCollectionItemsSection = elements.overlayCollectionItemsSection;
    watchlistCollectionItemsSection = elements.watchlistCollectionItemsSection;
    itemVidsrcPlayerSection = elements.itemVidsrcPlayerSection;
    overlayVidsrcPlayerSection = elements.overlayVidsrcPlayerSection;
    watchlistVidsrcPlayerSection = elements.watchlistVidsrcPlayerSection;
    itemBackButtonContainer = elements.itemBackButtonContainer;
    overlayBackButtonContainer = elements.overlayBackButtonContainer;
    watchlistBackButtonContainer = elements.watchlistBackButtonContainer;
    searchInputGlobal = elements.searchInput; 
}


export async function handleItemSelect(itemId, itemTitle, itemType, calledFromGenericList = false, calledFromWatchlistItem = false) {
    let currentTargetViewContext; 
    let currentDetailContainerEl, currentSeasonsEl, currentRelatedEl, currentCollectionEl,
        currentPlayerEl, currentBackButtonContainerEl, currentDetailTitleEl; // Added currentDetailTitleEl here

    if (calledFromGenericList) { 
        currentTargetViewContext = "overlay";
        currentDetailTitleEl = overlayDetailTitle; // Assign correct title element
        currentDetailContainerEl = overlayDetailContainer;
        currentSeasonsEl = overlaySeasonsEpisodesSection;
        currentRelatedEl = overlayRelatedItemsSection;
        currentCollectionEl = overlayCollectionItemsSection;
        currentPlayerEl = overlayVidsrcPlayerSection;
        currentBackButtonContainerEl = overlayBackButtonContainer;

        const activeMainTabForState = latestView && !latestView.classList.contains('hidden-view') ? tabLatest : tabPopular;
        if (activeMainTabForState) {
            updatePreviousStateForBackButton({ originTabId: activeMainTabForState.id });
            if (previousStateForBackButton.originTabId === 'tabLatest' && latestContentDisplay) {
                updateScrollPosition('latest', latestContentDisplay.scrollTop);
            } else if (previousStateForBackButton.originTabId === 'tabPopular' && popularContentDisplay) {
                updateScrollPosition('popular', popularContentDisplay.scrollTop);
            }
            showPositionSavedIndicator();
        }
        if (detailOverlay) detailOverlay.classList.remove('hidden');
        if (detailOverlayContent) detailOverlayContent.scrollTop = 0;

    } else if (calledFromWatchlistItem) { 
        currentTargetViewContext = "watchlist";
        currentDetailTitleEl = watchlistItemDetailTitle; // Assign correct title element
        currentDetailContainerEl = watchlistItemDetailContainer;
        currentSeasonsEl = watchlistSeasonsEpisodesSection;
        currentRelatedEl = watchlistRelatedItemsSection;
        currentCollectionEl = watchlistCollectionItemsSection;
        currentPlayerEl = watchlistVidsrcPlayerSection;
        currentBackButtonContainerEl = watchlistBackButtonContainer;
        updatePreviousStateForBackButton({ originTabId: 'tabWatchlist' });
    } else { 
        currentTargetViewContext = "item";
        currentDetailTitleEl = itemDetailTitle; // Assign correct title element
        currentDetailContainerEl = itemDetailContainer;
        currentSeasonsEl = itemSeasonsEpisodesSection;
        currentRelatedEl = itemRelatedItemsSection;
        currentCollectionEl = itemCollectionItemsSection;
        currentPlayerEl = itemVidsrcPlayerSection;
        currentBackButtonContainerEl = itemBackButtonContainer;
        updatePreviousStateForBackButton({ originTabId: 'tabSearch' });
    }

    clearItemDetailPanel(currentTargetViewContext); // Clears only the detail panel for the current context
    
    if (currentDetailContainerEl) { // Check if element exists before showing loading
        showLoading(`details-${currentTargetViewContext}`, `Loading ${itemTitle}...`, currentDetailContainerEl);
    } else {
        console.error("Detail container not found for context:", currentTargetViewContext);
    }
    if (currentDetailTitleEl) currentDetailTitleEl.classList.add('hidden'); 

    if (currentBackButtonContainerEl) {
        currentBackButtonContainerEl.innerHTML = '';
        let backButtonContext;
        if (currentTargetViewContext === 'overlay' && previousStateForBackButton) {
            backButtonContext = previousStateForBackButton.originTabId === 'tabLatest' ? 'latestList' : 'popularList';
        } else if (currentTargetViewContext === 'watchlist') {
            backButtonContext = 'watchlistItemsList';
        } else if (currentTargetViewContext === 'item') {
            backButtonContext = 'searchList';
        }
        if (backButtonContext) {
            const backBtn = createBackButton(backButtonContext);
            currentBackButtonContainerEl.appendChild(backBtn);
        }
    }
    
    await fetchItemDetails(itemId, itemType, {
        currentDetailContainerEl, 
        currentSeasonsEl, 
        currentRelatedEl, 
        currentCollectionEl,
        currentPlayerEl, 
        targetViewContext: currentTargetViewContext,
        itemTitle 
    });

    if (currentTargetViewContext !== "overlay") {
        const detailSectionToScroll = document.getElementById(currentTargetViewContext === 'watchlist' ? 'watchlistItemDetailPanel' : 'itemDetailSection');
        if (detailSectionToScroll) {
            detailSectionToScroll.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }
}

export function getSelectedSearchType() {
    const checkedRadio = document.querySelector('input[name="searchType"]:checked');
    return checkedRadio ? checkedRadio.value : 'movie';
}

export async function handleSearch() {
    if (!searchInputGlobal) { console.error("Search input not initialized in handlers.js"); return; }
    const query = searchInputGlobal.value.trim();
    const itemType = getSelectedSearchType();
    if (!query) {
        showToast("Please enter a title.", "error"); // Ensure showToast is available
        return;
    }
    clearItemDetailPanel("item");      // Clear previous item details
    clearSearchResultsPanel();      // Explicitly clear search results for a new search
    await fetchSearchResults(query, itemType);
}