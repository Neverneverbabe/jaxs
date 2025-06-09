// js/state.js 
export let currentSelectedItemDetails = null;
export let currentSelectedWatchlistName = null;
export let currentUserId = null;

export let currentLatestPage = 1;
export let currentLatestType = 'movie';
export let currentLatestCategory = 'now_playing';
export let currentPopularPage = 1;
export let currentPopularType = 'movie';
export let previousStateForBackButton = null;
export let scrollPositions = { latest: 0, popular: 0 };
export let selectedCertifications = ['All'];

// Functions to update state
export function updateCurrentSelectedItemDetails(details) {
    currentSelectedItemDetails = details;
}
export function updateCurrentSelectedWatchlistName(name) {
    currentSelectedWatchlistName = name;
}
export function updateCurrentUserId(id) {
    currentUserId = id;
}
export function updateLatestPage(page) { currentLatestPage = page; }
export function updateLatestType(type) { currentLatestType = type; }
export function updateLatestCategory(category) { currentLatestCategory = category; }
export function updatePopularPage(page) { currentPopularPage = page; }
export function updatePopularType(type) { currentPopularType = type; }
export function updatePreviousStateForBackButton(state) { previousStateForBackButton = state; }
export function updateScrollPosition(type, position) { scrollPositions[type] = position; }
export function updateSelectedCertifications(certs) { selectedCertifications = certs; }

// Active season cards (previously window properties)
export let itemActiveSeasonCard = null;
export let watchlistActiveSeasonCard = null;
export let overlayActiveSeasonCard = null;

export function setActiveSeasonCard(context, cardElement) {
    if (context === "item") itemActiveSeasonCard = cardElement;
    else if (context === "watchlist") watchlistActiveSeasonCard = cardElement;
    else if (context === "overlay") overlayActiveSeasonCard = cardElement;
}
export function getActiveSeasonCard(context) {
    if (context === "item") return itemActiveSeasonCard;
    if (context === "watchlist") return watchlistActiveSeasonCard;
    if (context === "overlay") return overlayActiveSeasonCard;
    return null;
}