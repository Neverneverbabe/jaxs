// Website/ui.js
import { smallImageBaseUrl, stillImageBaseUrl, genericItemPlaceholder, vidsrcProviders } from './config.js';
import { previousStateForBackButton, scrollPositions, updatePreviousStateForBackButton, setActiveSeasonCard, getActiveSeasonCard } from './state.js';
import { fetchRecommendations, fetchCollection, fetchEpisodesForSeason } from './api.js';
import { updateAddToWatchlistButtonState } from './watchlist.js';
import { updateMarkAsSeenButtonState, appendSeenCheckmark } from './seenList.js';
import { extractCertification } from './ratingUtils.js';
import { createAuthFormUI } from '../SignIn/auth.js'; // Updated path
import { handleItemSelect } from './handlers.js';

// DOM Elements (initialized in main.js)
let messageArea, resultsContainer,
    overlayDetailContainer, overlayDetailTitle, overlaySeasonsEpisodesSection,
    overlayRelatedItemsSection, overlayCollectionItemsSection, overlayBackButtonContainer,
    detailOverlay, detailOverlayContent, positionIndicator,
    itemVidsrcPlayerSection, overlayVidsrcPlayerSection,
    latestContentDisplay, popularContentDisplay;

export function initUiRefs(elements) {
    messageArea = elements.messageArea;
    resultsContainer = elements.resultsContainer;
    overlayDetailContainer = elements.overlayDetailContainer;
    overlayDetailTitle = elements.overlayDetailTitle;
    overlaySeasonsEpisodesSection = elements.overlaySeasonsEpisodesSection;
    overlayRelatedItemsSection = elements.overlayRelatedItemsSection;
    overlayCollectionItemsSection = elements.overlayCollectionItemsSection;
    overlayBackButtonContainer = elements.overlayBackButtonContainer;
    detailOverlay = elements.detailOverlay;
    detailOverlayContent = elements.detailOverlayContent;
    positionIndicator = elements.positionIndicator;
    itemVidsrcPlayerSection = elements.itemVidsrcPlayerSection;
    overlayVidsrcPlayerSection = elements.overlayVidsrcPlayerSection;
    latestContentDisplay = elements.latestContentDisplay;
    popularContentDisplay = elements.popularContentDisplay;
}

export function showToast(message, type = 'info') {
    if (!messageArea) return;
    messageArea.innerHTML = '';
    const toast = document.createElement('div');
    const bgColor = type === 'error' ? 'bg-red-600' : (type === 'success' ? 'bg-green-600' : 'bg-sky-600');
    toast.className = `p-3 rounded-lg shadow-lg text-white ${bgColor} text-sm`;
    toast.textContent = message;
    messageArea.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
}

export function showLoading(section = 'main', text = 'Loading...', targetElement) {
    let target = targetElement; 
    if (!target) { 
        if (section === 'results') target = resultsContainer;
        else if (section === 'details-overlay') target = overlayDetailContainer;
        else if (section === 'watchlistItems') target = document.getElementById('watchlistDisplayContainer'); 
        else if (section === 'seenItemsDisplayContainer') target = document.getElementById('seenItemsDisplayContainer'); 
        else if (section === 'latest') target = document.getElementById('latestContentDisplay'); 
        else if (section === 'popular') target = document.getElementById('popularContentDisplay'); 
        else target = messageArea;
    }
    if (target) target.innerHTML = `<div class="loader"></div><p class="text-gray-400 text-center">${text}</p>`;
    else console.warn("showLoading: Target element not found for section:", section);
}

export function showMessage(message, type = 'info', section = 'main', targetElement) {
    let target = targetElement; 
    if (!target) { 
      if (section === 'results') target = resultsContainer;
      else if (section === 'details-overlay') target = overlayDetailContainer;
      else if (section === 'watchlistItems') target = document.getElementById('watchlistDisplayContainer');
      else if (section === 'seenItemsDisplayContainer') target = document.getElementById('seenItemsDisplayContainer');
      else if (section === 'latest') target = document.getElementById('latestContentDisplay');
      else if (section === 'popular') target = document.getElementById('popularContentDisplay');
      else target = messageArea;
    }
    if (target) {
        const color = type === 'error' ? 'text-red-400' : 'text-green-400';
        target.innerHTML = `<p class="${color} p-3 bg-gray-700 rounded-md text-center">${message}</p>`;
    } else {
        console.warn("showMessage: Target element not found for section:", section);
    }
}

export function clearItemDetailPanel(targetViewContext = "item") {
    const detailContainer = document.getElementById(targetViewContext + 'DetailContainer');
    const detailTitleEl = document.getElementById(targetViewContext + 'DetailTitle');
    const seasonsSection = document.getElementById(targetViewContext + 'SeasonsEpisodesSection');
    const relatedSection = document.getElementById(targetViewContext + 'RelatedItemsSection');
    const collectionSection = document.getElementById(targetViewContext + 'CollectionItemsSection');
    const playerSectionToClear = document.getElementById(targetViewContext + 'VidsrcPlayerSection');
    const watchlistBtnContainerToClear = document.getElementById(targetViewContext + 'DetailAddToBtnContainer');
    const seenBtnContainerToClear = document.getElementById(targetViewContext + 'DetailMarkAsSeenBtnContainer');
    const backBtnContainer = document.getElementById(targetViewContext + 'BackButtonContainer');

    if (detailContainer) detailContainer.innerHTML = `<p class="text-gray-500 italic">Select an item${targetViewContext !== 'item' && targetViewContext !== 'overlay' ? ' from the list' : ''}.</p>`;
    if (detailTitleEl) detailTitleEl.classList.add('hidden');
    if (seasonsSection) seasonsSection.innerHTML = '';
    if (relatedSection) relatedSection.innerHTML = '';
    if (collectionSection) collectionSection.innerHTML = '';
    if (playerSectionToClear) playerSectionToClear.innerHTML = '';
    if (watchlistBtnContainerToClear) watchlistBtnContainerToClear.innerHTML = '';
    if (seenBtnContainerToClear) seenBtnContainerToClear.innerHTML = '';
    if (backBtnContainer) backBtnContainer.innerHTML = '';
}

export function clearSearchResultsPanel() {
    if (resultsContainer) {
        resultsContainer.innerHTML = '<p class="text-gray-500 italic">Search for media.</p>';
    }
}

export function clearAllDynamicContent(targetViewContext = "item") {
    clearItemDetailPanel(targetViewContext);
    if (targetViewContext === "item") {
        clearSearchResultsPanel();
    }
}

export function showPositionSavedIndicator() {
    if (!positionIndicator) return;
    positionIndicator.classList.remove('hidden');
    setTimeout(() => {
        positionIndicator.classList.add('hidden');
    }, 2000);
}

export function createBackButton(originContext) { 
    const backBtn = document.createElement('button');
    backBtn.className = 'back-button';
    let buttonText = "Back to List";
    if (originContext === 'latestList') buttonText = "Back to Latest";
    else if (originContext === 'popularList') buttonText = "Back to Popular";
    else if (originContext === 'watchlistItemsList') buttonText = "Back to Watchlist Items";
    else if (originContext === 'searchList') buttonText = "Back to Search Results";

    backBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4">
            <path fill-rule="evenodd" d="M9.707 14.707a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 1.414L7.414 9H15a1 1 0 110 2H7.414l2.293 2.293a1 1 0 010 1.414z" clip-rule="evenodd" />
        </svg>
        ${buttonText}
    `;

    backBtn.onclick = () => {
        if (originContext === 'latestList' || originContext === 'popularList') {
            if (detailOverlay) detailOverlay.classList.add('hidden');
            clearItemDetailPanel('overlay'); 
            if (originContext === 'latestList' && latestContentDisplay) {
                latestContentDisplay.scrollTop = scrollPositions.latest;
            } else if (originContext === 'popularList' && popularContentDisplay) {
                popularContentDisplay.scrollTop = scrollPositions.popular;
            }
        } else if (originContext === 'watchlistItemsList') {
            clearItemDetailPanel('watchlist'); 
        } else if (originContext === 'searchList') {
            clearItemDetailPanel('item');
        }
        updatePreviousStateForBackButton(null);
    };
    return backBtn;
}

export function displayResults(items, itemType, resContainer) {
    if (!resContainer) return;
    resContainer.innerHTML = '';
    if (!items || items.length === 0) {
        showMessage("No results found.", 'info', 'results', resContainer);
        return;
    }

    items.forEach(item => {
        const title = item.title || item.name;
        const posterPath = item.poster_path;
        const posterUrl = posterPath ? `${smallImageBaseUrl}${posterPath}` : genericItemPlaceholder;

        const card = document.createElement('div');
        card.className = 'generic-item-card cursor-pointer';
        card.dataset.id = String(item.id);
        const ratingHtml = item.vote_average ? `<p class="text-xs text-yellow-400">★ ${item.vote_average.toFixed(1)}</p>` : '';

        card.innerHTML = `
            <img src="${posterUrl}" alt="${title}" onerror="this.src='${genericItemPlaceholder}'; this.onerror=null;">
            <h4 class="text-md font-semibold text-sky-300 truncate mt-2" title="${title}">${title}</h4>
            ${ratingHtml}
        `;

        card.addEventListener('click', () => handleItemSelect(String(item.id), title, itemType, true));
        resContainer.appendChild(card);
        appendSeenCheckmark(card, String(item.id));
    });
}

export async function displayItemDetails(imdbId, itemTitleText, detailsObject, itemType, 
    targetDetailContainerEl, targetSeasonsEl, targetRelatedEl, targetCollectionEl,
    targetPlayerEl, targetViewContext = "item"
) {
    if (!targetDetailContainerEl) { console.error("displayItemDetails: targetDetailContainerEl is null"); return; }
    targetDetailContainerEl.innerHTML = '';
    const titleBookmarkWrapper = document.createElement('div');
    titleBookmarkWrapper.className = 'flex justify-between items-start mb-2';
    const titleEl = document.createElement('h3');
    titleEl.className = 'text-xl font-bold text-sky-300 flex-grow mr-2';
    const year = (detailsObject.release_date || detailsObject.first_air_date)?.substring(0, 4) || '';
    titleEl.textContent = `${itemTitleText} ${year ? `(${year})` : ''}`;
    titleBookmarkWrapper.appendChild(titleEl);
    const iconsWrapper = document.createElement('div');
    iconsWrapper.className = 'flex items-center flex-shrink-0 ml-2';
    const bookmarkButtonContainer = document.createElement('div');
    bookmarkButtonContainer.id = `${targetViewContext}DetailAddToBtnContainer`;
    bookmarkButtonContainer.className = 'relative'; 
    iconsWrapper.appendChild(bookmarkButtonContainer);
    const seenButtonContainer = document.createElement('div');
    seenButtonContainer.id = `${targetViewContext}DetailMarkAsSeenBtnContainer`;
    seenButtonContainer.style.marginLeft = '0.25rem'; 
    iconsWrapper.appendChild(seenButtonContainer);
    titleBookmarkWrapper.appendChild(iconsWrapper);
    targetDetailContainerEl.appendChild(titleBookmarkWrapper);

    updateAddToWatchlistButtonState(String(detailsObject.tmdb_id), detailsObject, bookmarkButtonContainer.id);
    updateMarkAsSeenButtonState(String(detailsObject.tmdb_id), detailsObject, seenButtonContainer.id);
    
    const badgesContainer = document.createElement('div');
    badgesContainer.className = 'mb-3 flex flex-wrap items-center';
    if (detailsObject.vote_average) { const ratingBadge = document.createElement('span'); ratingBadge.className = 'detail-badge bg-yellow-500 text-gray-900'; ratingBadge.textContent = `★ ${detailsObject.vote_average.toFixed(1)} (${detailsObject.vote_count} votes)`; badgesContainer.appendChild(ratingBadge); }
    const certification = extractCertification({ ...detailsObject, item_type: itemType });
    const ageBadge = document.createElement('span');
    ageBadge.className = 'detail-badge bg-sky-500 text-white';
    ageBadge.textContent = `Age: ${certification}`;
    badgesContainer.appendChild(ageBadge);
    if (itemType === 'movie' && detailsObject.runtime) { const runtimeBadge = document.createElement('span'); runtimeBadge.className = 'detail-badge bg-gray-600 text-gray-200'; runtimeBadge.textContent = `Runtime: ${Math.floor(detailsObject.runtime / 60)}h ${detailsObject.runtime % 60}m`; badgesContainer.appendChild(runtimeBadge); } else if (itemType === 'tv' && detailsObject.episode_run_time?.length > 0 && detailsObject.episode_run_time[0] > 0) { const runtimeBadge = document.createElement('span'); runtimeBadge.className = 'detail-badge bg-gray-600 text-gray-200'; runtimeBadge.textContent = `Episode: ~${detailsObject.episode_run_time[0]} min`; badgesContainer.appendChild(runtimeBadge); }
    targetDetailContainerEl.appendChild(badgesContainer);
    if (detailsObject.tagline) { const taglineEl = document.createElement('p'); taglineEl.className = 'text-gray-400 italic mb-2 text-sm'; taglineEl.textContent = detailsObject.tagline; targetDetailContainerEl.appendChild(taglineEl); }
    const overviewEl = document.createElement('p'); overviewEl.className = 'text-gray-300 mb-3 text-sm overview-scroll'; overviewEl.textContent = detailsObject.overview || "No overview available."; targetDetailContainerEl.appendChild(overviewEl);
    const imdbInfoContainer = document.createElement('div'); imdbInfoContainer.className = 'mb-4 text-xs'; imdbInfoContainer.innerHTML = imdbId ? `<p><strong>IMDb ID:</strong> <span class="text-yellow-400">${imdbId}</span> | <a href="https://www.imdb.com/title/${imdbId}/" target="_blank" class="text-sky-400 hover:underline">View on IMDb</a></p>` : `<p>IMDb ID: Not Available</p>`; targetDetailContainerEl.appendChild(imdbInfoContainer);
    
    if (targetPlayerEl) {
        const idForPlayer = String(detailsObject.tmdb_id); 
        if (idForPlayer) { 
            updateVidsrcPlayer(targetPlayerEl, itemType, idForPlayer, imdbId); 
        } else { 
            targetPlayerEl.innerHTML = `<p class="text-center text-gray-500 italic">Video player requires a TMDB ID.</p>`; 
        } 
    } else {
         console.warn("Player section element not found for detail panel:", targetViewContext );
    } 

    fetchRecommendations(String(detailsObject.id), itemType, targetRelatedEl, targetViewContext); 
    if (itemType === 'tv' && detailsObject.seasons) { 
        displaySeasons(detailsObject.seasons, String(detailsObject.id), detailsObject.external_ids?.imdb_id, targetSeasonsEl, targetViewContext); 
    } else if (itemType === 'movie' && detailsObject.belongs_to_collection) { 
        fetchCollection(detailsObject.belongs_to_collection.id, String(detailsObject.id), targetCollectionEl, targetViewContext); 
    }
}

export function updateVidsrcPlayer(containerEl, itemType, tmdbIdForUrl, imdbIdForDisplay, season = null, episode = null) {
     if (!containerEl) return;
    containerEl.innerHTML = '';
    let playingTxt = itemType === 'tv' ? "Entire Series" : "Movie";
    if (season && episode) { playingTxt = `Season ${season}, Episode ${episode}`; }
    const playingInfo = document.createElement('p');
    playingInfo.className = 'text-sm text-sky-300 mb-2';
    playingInfo.innerHTML = `<strong>Now Playing:</strong> ${playingTxt}`;
    containerEl.appendChild(playingInfo);
    const tabsContainer = document.createElement('div');
    tabsContainer.className = 'flex border-b border-gray-700 mb-3';
    const playerWrapper = document.createElement('div');
    vidsrcProviders.forEach((provider, index) => {
        const tab = document.createElement('div');
        tab.className = `player-tab ${index === 0 ? 'active' : ''}`;
        tab.textContent = provider.name;
        const uniquePlayerIdSuffix = containerEl.id ? `-${containerEl.id}` : `-${Math.random().toString(36).substring(2,7)}`;
        tab.dataset.player = `${provider.name.replace(/\./g, '')}-Player${uniquePlayerIdSuffix}`;
        tabsContainer.appendChild(tab);
        const playerContainer = document.createElement('div');
        playerContainer.id = `${provider.name.replace(/\./g, '')}-PlayerContainer${uniquePlayerIdSuffix}`;
        playerContainer.className = `aspect-video relative ${index !== 0 ? 'hidden' : ''}`;
        let embedUrlBase = itemType === 'movie' ? provider.movieUrl : provider.tvUrl;
        let embedUrl = `${embedUrlBase}${tmdbIdForUrl}`;
        if (itemType === 'tv' && season && episode) {
            embedUrl += `/${season}/${episode}`;
        }
        const iframe = document.createElement('iframe');
        iframe.src = embedUrl;
        iframe.className = 'absolute top-0 left-0 w-full h-full rounded-lg shadow-lg border-2 border-gray-700';
        iframe.allow = 'autoplay; encrypted-media; fullscreen';
        iframe.frameBorder = '0';
        iframe.scrolling = 'no';
        playerContainer.appendChild(iframe);
        playerWrapper.appendChild(playerContainer);
        tab.addEventListener('click', () => {
            tabsContainer.querySelectorAll('.player-tab').forEach(t => t.classList.remove('active'));
            playerWrapper.querySelectorAll('div[id^="' + provider.name.replace(/\./g, '') + '-PlayerContainer"]').forEach(p => p.classList.add('hidden'));
            tab.classList.add('active');
            const targetPlayerDiv = document.getElementById(playerContainer.id);
            if (targetPlayerDiv) targetPlayerDiv.classList.remove('hidden');
        });
    });
    containerEl.appendChild(tabsContainer);
    containerEl.appendChild(playerWrapper);
    const urlsContainer = document.createElement('div');
    vidsrcProviders.forEach(provider => {
        let directUrlBase = itemType === 'movie' ? provider.movieUrl : provider.tvUrl;
        let directUrl = `${directUrlBase}${tmdbIdForUrl}`;
        if (itemType === 'tv' && season && episode) {
            directUrl += `/${season}/${episode}`;
        }
        const urlParagraph = document.createElement('p');
        urlParagraph.className = 'mt-1 text-xs';
        urlParagraph.innerHTML = `<strong>${provider.name} URL:</strong> <a href="${directUrl}" target="_blank" class="text-sky-400 hover:underline break-all">${directUrl}</a>`;
        urlsContainer.appendChild(urlParagraph);
    });
    containerEl.appendChild(urlsContainer);
}

export function displaySeasons(seasons, parentShowTmdbId, parentShowImdbId, targetSeasonsEl, targetViewContext = "item") {
    if (!targetSeasonsEl) return;
    targetSeasonsEl.innerHTML = '';
    if (!seasons || seasons.length === 0) return;
    const title = document.createElement('h3');
    title.className = 'section-title mt-4';
    title.textContent = 'Seasons';
    targetSeasonsEl.appendChild(title);
    const list = document.createElement('div');
    list.className = 'seasons-list space-x-4';
    seasons.filter(s => s.season_number > 0).forEach(s => {
        const card = document.createElement('div');
        card.className = 'season-card bg-gray-700 p-3 rounded-lg cursor-pointer hover:bg-gray-600 w-[160px] flex-shrink-0 text-center';
        const poster = s.poster_path ? `${smallImageBaseUrl}${s.poster_path}` : genericItemPlaceholder;
        card.innerHTML = `
            <img src="${poster}" alt="${s.name || `Season ${s.season_number}`}" class="w-full h-48 object-cover rounded-md mb-2 mx-auto" onerror="this.src='${genericItemPlaceholder}'; this.onerror=null;">
            <h4 class="text-sm font-semibold text-sky-200 truncate">${s.name || `Season ${s.season_number}`}</h4>
            <p class="text-xs text-gray-400">${s.episode_count} Episodes</p>
            ${s.air_date ? `<p class="text-xs text-gray-500">${s.air_date.substring(0, 4)}</p>` : ''}
        `;
        card.addEventListener('click', async () => {
            const episodeDisplayContainer = document.getElementById(`${targetViewContext}EpisodeDisplayContainer`);
            let playerSection;
            if (targetViewContext === "item") playerSection = itemVidsrcPlayerSection;
            else playerSection = overlayVidsrcPlayerSection;

            if (!episodeDisplayContainer) {
                console.error("Episode display container not found:", `${targetViewContext}EpisodeDisplayContainer`);
                return;
            }
            showLoading(`seasons-${targetViewContext}`, `Loading Season ${s.season_number} episodes...`, episodeDisplayContainer);

            try {
                const seasonDetailsWithEpisodes = await fetchEpisodesForSeason(parentShowTmdbId, s.season_number);
                episodeDisplayContainer.innerHTML = '';

                if (seasonDetailsWithEpisodes.episodes && seasonDetailsWithEpisodes.episodes.length > 0) {
                    const episodesTitle = document.createElement('h4');
                    episodesTitle.className = 'text-lg font-semibold mb-2 text-sky-300';
                    episodesTitle.textContent = `${seasonDetailsWithEpisodes.name || `Season ${s.season_number}`} Episodes`;
                    episodeDisplayContainer.appendChild(episodesTitle);

                    const episodesList = document.createElement('div');
                    episodesList.className = 'episodes-list space-y-2 pr-2';
                    seasonDetailsWithEpisodes.episodes.forEach(ep => {
                        const epCard = createEpisodeCard(ep, playerSection, parentShowTmdbId, parentShowImdbId, s.season_number, targetViewContext);
                        episodesList.appendChild(epCard);
                    });
                    episodeDisplayContainer.appendChild(episodesList);
                } else {
                    episodeDisplayContainer.innerHTML = `<p class="text-gray-400">No episodes found for this season.</p>`;
                }
            } catch (error) {
                episodeDisplayContainer.innerHTML = `<p class="text-red-400">Error loading episodes: ${error.message}</p>`;
            }

            const activeCard = getActiveSeasonCard(targetViewContext);
            if(activeCard) activeCard.classList.remove('border-sky-400', 'border-2');
            card.classList.add('border-sky-400', 'border-2');
            setActiveSeasonCard(targetViewContext, card);
        });
        list.appendChild(card);
    });
    targetSeasonsEl.appendChild(list);
    const episodeDisplayContainer = document.createElement('div');
    episodeDisplayContainer.id = `${targetViewContext}EpisodeDisplayContainer`;
    episodeDisplayContainer.className = 'mt-3';
    targetSeasonsEl.appendChild(episodeDisplayContainer);
}

function createEpisodeCard(ep, playerSection, parentShowTmdbId, parentShowImdbId, seasonNum, targetViewContext) {
    const card = document.createElement('div');
    card.className = 'episode-card bg-gray-750 p-3 rounded-md hover:bg-gray-700 cursor-pointer flex space-x-3 items-start';
    const stillPath = ep.still_path ? `${stillImageBaseUrl}${ep.still_path}` : genericItemPlaceholder.replace('150x225', '120x68');
    card.innerHTML = `
        <img src="${stillPath}" alt="Episode ${ep.episode_number}" class="w-28 h-16 object-cover rounded-md flex-shrink-0" onerror="this.src='${genericItemPlaceholder.replace('150x225', '120x68')}'; this.onerror=null;">
        <div>
            <h5 class="text-sm font-semibold text-sky-200">Ep ${ep.episode_number}: ${ep.name}</h5>
            <p class="text-xs text-gray-400">${ep.air_date || ''}</p>
            <p class="text-xs text-gray-500 mt-1 truncate" title="${ep.overview}">${ep.overview || 'No overview.'}</p>
        </div>
    `;
    card.addEventListener('click', () => {
        if (playerSection) {
            updateVidsrcPlayer(playerSection, 'tv', parentShowTmdbId, parentShowImdbId, seasonNum, ep.episode_number);
            playerSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
            console.error("Player section not found for episode click:", `${targetViewContext}VidsrcPlayerSection`);
        }
    });
    return card;
}

export function createRelatedItemCard(item, itemType, currentViewContext = "item") {
    const card = document.createElement('div');
    card.className = 'related-item-card bg-gray-700 p-3 rounded-lg cursor-pointer hover:bg-gray-600 flex-shrink-0 w-[150px]';
    card.dataset.id = String(item.id); 
    const poster = item.poster_path ? `${smallImageBaseUrl}${item.poster_path}` : genericItemPlaceholder;
    card.innerHTML = `
        <img src="${poster}" alt="${item.title || item.name}" class="w-full h-48 object-cover rounded-md mb-2" onerror="this.src='${genericItemPlaceholder}'; this.onerror=null;">
        <h4 class="text-sm font-semibold text-sky-200 truncate">${item.title || item.name}</h4>
        <p class="text-xs text-gray-400">${(item.release_date || item.first_air_date)?.substring(0, 4) || 'N/A'}</p>
    `;
    card.addEventListener('click', () => {
        const calledFromOverlay = currentViewContext === 'overlay';
        handleItemSelect(String(item.id), item.title || item.name, itemType, calledFromOverlay);
    });
    appendSeenCheckmark(card, String(item.id)); 
    return card;
}

export function displayTmdbCategoryItems(items, itemType, container, mainCategory, category, currentPage, totalPages) {
    if (!container) return;
    container.innerHTML = '';
    if (!items || items.length === 0) {
        showMessage("No results found.", 'info', 'results', container);
        return;
    }

    const itemsGrid = document.createElement('div');
    itemsGrid.className = 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 generic-items-container';
    items.forEach(item => {
        const card = document.createElement('div');
        card.className = 'generic-item-card cursor-pointer';
        card.dataset.id = String(item.id); 
        const title = item.title || item.name;
        const posterPath = item.poster_path;
        const posterUrl = posterPath ? `${smallImageBaseUrl}${posterPath}` : genericItemPlaceholder;
        card.innerHTML = `
            <img src="${posterUrl}" alt="${title}" onerror="this.src='${genericItemPlaceholder}'; this.onerror=null;">
            <h4 class="text-md font-semibold text-sky-300 truncate mt-2" title="${title}">${title}</h4>
            ${item.vote_average ? `<p class="text-xs text-yellow-400">★ ${item.vote_average.toFixed(1)}</p>` : ''}
        `;
        card.addEventListener('click', () => handleItemSelect(String(item.id), title, itemType, true));
        itemsGrid.appendChild(card);
        appendSeenCheckmark(card, String(item.id)); 
    });
    container.appendChild(itemsGrid);

    const paginationDiv = document.createElement('div');
    paginationDiv.className = 'flex justify-between mt-4';
    const prevBtn = document.createElement('button');
    prevBtn.textContent = 'Previous';
    prevBtn.className = 'pagination-btn prev-page-btn';
    prevBtn.disabled = currentPage <= 1;
    prevBtn.addEventListener('click', () => {
        if (currentPage > 1) {
            if (mainCategory === 'latest') window.handleLatestPageChange(currentPage - 1);
            else window.handlePopularPageChange(currentPage - 1);
        }
    });

    const nextBtn = document.createElement('button');
    nextBtn.textContent = 'Next';
    nextBtn.className = 'pagination-btn next-page-btn';
    nextBtn.disabled = currentPage >= totalPages;
    nextBtn.addEventListener('click', () => {
        if (currentPage < totalPages) {
            if (mainCategory === 'latest') window.handleLatestPageChange(currentPage + 1);
            else window.handlePopularPageChange(currentPage + 1);
        }
    });
    paginationDiv.appendChild(prevBtn);
    paginationDiv.appendChild(nextBtn);
    container.appendChild(paginationDiv);
}

export function positionPopup(button, popup) {
    if (!button || !popup) {
        console.warn("positionPopup called with null button or popup.");
        return;
    }

    const buttonContainer = popup.parentElement;
    if (!buttonContainer) {
        console.warn("Popup has no parent container for positioning.");
        return;
    }

    const popupBuffer = 8;

    const initialDisplay = popup.style.display;
    const initialVisibility = popup.style.visibility;
    const wasHiddenByClass = popup.classList.contains('hidden');

    if (wasHiddenByClass) popup.classList.remove('hidden');
    popup.style.display = 'block';
    popup.style.visibility = 'hidden';

    let popupWidth = popup.offsetWidth;
    let popupHeight = popup.offsetHeight;
    
    if (popupWidth < 50 && popup.classList.contains('detail-panel-popup')) {
        popupWidth = 250;
    }

    if (wasHiddenByClass && !popup.classList.contains('hidden')) {
        popup.classList.add('hidden');
    }
    popup.style.display = initialDisplay;
    popup.style.visibility = initialVisibility;

    if (popupWidth === 0 && popup.innerHTML.trim() === '') {
        if (wasHiddenByClass) popup.classList.add('hidden');
        else popup.style.display = 'none';
        return;
    }

    const containerRect = buttonContainer.getBoundingClientRect();

    let desiredViewportLeft = containerRect.left + parseFloat(popup.style.left || 0);
    let desiredViewportTop = containerRect.top + parseFloat(popup.style.top || 0);

    let viewportLeftBoundary, viewportRightBoundary, viewportTopBoundary, viewportBottomBoundary;

    const detailOverlayEl = document.getElementById('detailOverlay');
    const overlayContentEl = document.getElementById('detailOverlayContent');
    const isInOverlay = detailOverlayEl && !detailOverlayEl.classList.contains('hidden') &&
                        overlayContentEl && !overlayContentEl.classList.contains('hidden') &&
                        overlayContentEl.contains(button);

    if (isInOverlay) {
        const overlayRect = overlayContentEl.getBoundingClientRect();
        viewportLeftBoundary = overlayRect.left + popupBuffer;
        viewportRightBoundary = overlayRect.right - popupBuffer;
        viewportTopBoundary = overlayRect.top + popupBuffer;
        viewportBottomBoundary = overlayRect.bottom - popupBuffer;
    } else {
        viewportLeftBoundary = popupBuffer;
        viewportRightBoundary = window.innerWidth - popupBuffer;
        viewportTopBoundary = popupBuffer;
        viewportBottomBoundary = window.innerHeight - popupBuffer;
    }
    
    let finalStyleLeft = parseFloat(popup.style.left || 0);
    let finalStyleTop = parseFloat(popup.style.top || 0);

    if (desiredViewportLeft + popupWidth > viewportRightBoundary) {
        finalStyleLeft = buttonContainer.offsetWidth - popupWidth; 
        desiredViewportLeft = containerRect.left + finalStyleLeft;
    }

    if (desiredViewportLeft < viewportLeftBoundary) {
        finalStyleLeft += (viewportLeftBoundary - desiredViewportLeft);
    }
    
    if (desiredViewportTop + popupHeight > viewportBottomBoundary) {
        finalStyleTop = -popupHeight - 3;
    }
    const newPopupViewportTop = containerRect.top + finalStyleTop;
    if (newPopupViewportTop < viewportTopBoundary) {
        finalStyleTop += (viewportTopBoundary - newPopupViewportTop);
    }

    popup.style.left = `${Math.round(finalStyleLeft)}px`;
    popup.style.top = `${Math.round(finalStyleTop)}px`;
    popup.style.right = 'auto';
}