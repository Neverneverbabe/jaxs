// js/api.js
import { 
    showLoading, 
    showMessage, 
    displayResults, 
    displayItemDetails, 
    displayTmdbCategoryItems, 
    createRelatedItemCard, 
    displaySeasons 
} from './ui.js';
// Removed: import { appendSeenCheckmark } from './seenList.js'; // ui.js now handles its own appendSeenCheckmark
import { smallImageBaseUrl, genericItemPlaceholder, stillImageBaseUrl } from './config.js';
import { currentSelectedItemDetails, updateCurrentSelectedItemDetails, selectedCertifications } from './state.js';
import { extractCertification } from './ratingUtils.js';

// TMDB API Configuration
export const apiKey = "e27a888783eeaa67643bd81c5fb4422f"; // Your TMDB API key
export const tmdbBaseUrl = "https://api.themoviedb.org/3";

// DOM Element references
let resultsContainer, latestContentDisplay, popularContentDisplay;


export function initApiRefs(elements) {
    resultsContainer = elements.resultsContainer;
    latestContentDisplay = elements.latestContentDisplay;
    popularContentDisplay = elements.popularContentDisplay;
}


export function buildSearchUrl(query, itemType, certifications = []) {
    let url = `${tmdbBaseUrl}/search/${itemType}?api_key=${apiKey}&query=${encodeURIComponent(query)}&include_adult=false`;
    if (certifications && certifications.length > 0 && !(certifications.length === 1 && certifications[0] === 'All')) {
        const joined = certifications.join('|');
        url += `&certification_country=US&certification=${encodeURIComponent(joined)}`;
    }
    return url;
}

export async function fetchSearchResults(query, itemType, certifications = []) {
    showLoading('results', `Searching for "${query}"...`, resultsContainer);
    try {
        const response = await fetch(buildSearchUrl(query, itemType, certifications));
        if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
        const data = await response.json();
        if (data.results && data.results.length > 0) {
            let items = data.results;
            if (!certifications.includes('All')) {
                items = await Promise.all(items.map(async it => {
                    try {
                        const resp = await fetch(`${tmdbBaseUrl}/${itemType}/${it.id}?api_key=${apiKey}&append_to_response=release_dates,content_ratings`);
                        const details = await resp.json();
                        const cert = extractCertification({ ...details, item_type: itemType });
                        return { ...it, certification: cert };
                    } catch (err) {
                        return { ...it, certification: 'NR' };
                    }
                }));
                items = items.filter(it => certifications.includes(it.certification));
            }
            if (items.length > 0) {
                displayResults(items, itemType, resultsContainer); // appendSeenCheckmark argument removed
            } else {
                showMessage('No results match the selected ratings.', 'info', 'results', resultsContainer);
            }
        } else {
            showMessage(`No results found for "${query}". Please check spelling or try a different title.`, 'info', 'results', resultsContainer);
        }
    } catch (error) {
        showMessage(`Search Error: ${error.message}`, 'error', 'results', resultsContainer);
        console.error("Search Error:", error);
    }
}

export async function fetchItemDetails(itemId, itemType, targetElements) {
    const {
        currentDetailContainerEl,
        currentSeasonsEl,
        currentRelatedEl,
        currentCollectionEl,
        currentPlayerEl,
        targetViewContext,
        itemTitle
    } = targetElements;

    try {
        const appendResponses = 'external_ids,credits,videos,release_dates,content_ratings,aggregate_credits';
        const detailsUrl = `${tmdbBaseUrl}/${itemType}/${itemId}?api_key=${apiKey}&append_to_response=${appendResponses}`;
        const response = await fetch(detailsUrl);
        if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
        const details = await response.json();
        
        updateCurrentSelectedItemDetails({ ...details, tmdb_id: String(details.id), item_type: itemType });

        await displayItemDetails(
            details.external_ids?.imdb_id,
            itemTitle,
            currentSelectedItemDetails, 
            itemType,
            currentDetailContainerEl,
            currentSeasonsEl,
            currentRelatedEl,
            currentCollectionEl,
            currentPlayerEl,
            targetViewContext
        );
    } catch (error) {
        showMessage(`Error loading details for "${itemTitle || 'item'}": ${error.message}`, 'error', `details-${targetViewContext}`, currentDetailContainerEl);
        console.error("Detail Loading Error:", error);
    }
}


export async function fetchTmdbCategoryContent(mainCategory, type, category, page) {
    const displayContainer = mainCategory === 'latest' ? latestContentDisplay : popularContentDisplay;
    if (!displayContainer) {
        console.error(`Display container not found for ${mainCategory}`);
        return;
    }
    showLoading(mainCategory, `Loading ${category.replace('_', ' ')} ${type}s...`, displayContainer);

    let url;
    const filtering = !selectedCertifications.includes('All');
    if (filtering) {
        const certs = encodeURIComponent(selectedCertifications.join('|'));
        url = `${tmdbBaseUrl}/discover/${type}?api_key=${apiKey}&sort_by=popularity.desc&certification_country=US&certification=${certs}&page=${page}`;
    } else {
        url = `${tmdbBaseUrl}/${type}/${category}?api_key=${apiKey}&page=${page}`;
    }

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`TMDB API Error: ${response.statusText}`);
        const data = await response.json();
        if (data && data.results && data.results.length > 0) {
            let items = data.results;
            if (filtering) {
                items = await Promise.all(items.map(async it => {
                    try {
                        const resp = await fetch(`${tmdbBaseUrl}/${type}/${it.id}?api_key=${apiKey}&append_to_response=release_dates,content_ratings`);
                        const details = await resp.json();
                        const cert = extractCertification({ ...details, item_type: type });
                        return { ...it, certification: cert };
                    } catch {
                        return { ...it, certification: 'NR' };
                    }
                }));
            }

            if (!filtering || items.some(it => selectedCertifications.includes(it.certification))) {
                if (filtering) items = items.filter(it => selectedCertifications.includes(it.certification));
                if (items.length === 0) {
                    showMessage('No items match the selected ratings.', 'info', mainCategory, displayContainer);
                } else {
                    displayTmdbCategoryItems(items, type, displayContainer, mainCategory, category, page, data.total_pages);
                }
            } else {
                showMessage('No items match the selected ratings.', 'info', mainCategory, displayContainer);
            }
        } else {
            showMessage('No items found for this category.', 'info', mainCategory, displayContainer);
        }
    } catch (error) {
        console.error(`Error loading ${type}/${category}:`, error);
        showMessage(`Error loading content: ${error.message}`, 'error', mainCategory, displayContainer);
    }
}

export async function fetchRecommendations(itemId, itemType, targetRelatedEl, targetViewContext) {
    if (!targetRelatedEl) return;
    showLoading(`related-${targetViewContext}`, `Loading recommendations...`, targetRelatedEl);
    targetRelatedEl.innerHTML = '';
    try {
        const response = await fetch(`${tmdbBaseUrl}/${itemType}/${itemId}/recommendations?api_key=${apiKey}`);
        if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
        const data = await response.json();
        const titleEl = document.createElement('h3');
        titleEl.className = 'section-title';
        titleEl.textContent = `Recommended ${itemType === 'tv' ? 'Shows' : 'Movies'}`;
        targetRelatedEl.appendChild(titleEl);
        const list = document.createElement('div');
        list.className = 'flex overflow-x-auto space-x-3 pb-3 related-movies-scroll';
        if (data.results?.length > 0) {
            data.results.slice(0, 10).forEach(item => list.appendChild(createRelatedItemCard(item, itemType, targetViewContext)));
            targetRelatedEl.appendChild(list);
        } else {
            targetRelatedEl.innerHTML += '<p class="text-sm text-gray-400">No recommendations found.</p>';
        }
    } catch (error) {
        showMessage("Could not load recommendations.", 'error', `related-${targetViewContext}`, targetRelatedEl);
        console.error("Recommendations Error:", error);
    }
}

export async function fetchCollection(collectionId, currentMovieId, targetCollectionEl, targetViewContext) {
    if (!targetCollectionEl) return;
    showLoading(`collection-${targetViewContext}`, 'Loading movie series...', targetCollectionEl);
    targetCollectionEl.innerHTML = '';
    try {
        const response = await fetch(`${tmdbBaseUrl}/collection/${collectionId}?api_key=${apiKey}`);
        if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
        const data = await response.json();
        const titleEl = document.createElement('h3');
        titleEl.className = 'section-title';
        titleEl.textContent = data.name || 'Movie Series';
        targetCollectionEl.appendChild(titleEl);
        const list = document.createElement('div');
        list.className = 'flex overflow-x-auto space-x-3 pb-3 related-movies-scroll';
        if (data.parts?.length > 0) {
            data.parts.forEach(movie => {
                if (String(movie.id) === String(currentMovieId)) return;
                list.appendChild(createRelatedItemCard(movie, 'movie', targetViewContext));
            });
            targetCollectionEl.appendChild(list);
            if (list.children.length === 0) {
                targetCollectionEl.innerHTML += '<p class="text-sm text-gray-400">No other movies in this series.</p>';
            }
        } else {
            targetCollectionEl.innerHTML += '<p class="text-sm text-gray-400">No other movies found in this series.</p>';
        }
    } catch (error) {
        showMessage("Could not load movie series.", 'error', `collection-${targetViewContext}`, targetCollectionEl);
        console.error("Collection Error:", error);
    }
}

export async function fetchEpisodesForSeason(parentShowTmdbId, seasonNum, parentShowImdbId, episodeContainer, targetViewContext, playerSection) {
    if (!episodeContainer) {
        console.error("Episode display container not found:", episodeContainer);
        return;
    }
    showLoading(`seasons-${targetViewContext}`, `Loading Season ${seasonNum} episodes...`, episodeContainer);

    try {
        const response = await fetch(`${tmdbBaseUrl}/tv/${parentShowTmdbId}/season/${seasonNum}?api_key=${apiKey}`);
        if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
        const seasonDetails = await response.json();
        episodeContainer.innerHTML = ''; 
        if (seasonDetails.episodes && seasonDetails.episodes.length > 0) {
            const title = document.createElement('h4');
            title.className = 'text-lg font-semibold mb-2 text-sky-300';
            title.textContent = `${seasonDetails.name || `Season ${seasonNum}`} Episodes`;
            episodeContainer.appendChild(title);
            const list = document.createElement('div');
            list.className = 'episodes-list space-y-2 pr-2';
            seasonDetails.episodes.forEach(ep => {
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
                        if (typeof window.updateVidsrcPlayerExternal === 'function') {
                           window.updateVidsrcPlayerExternal(playerSection, 'tv', parentShowTmdbId, parentShowImdbId, seasonNum, ep.episode_number);
                           playerSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        } else {
                            console.error("updateVidsrcPlayerExternal is not available on window object.");
                        }
                    } else {
                        console.error("Player section not found for episode click:", `${targetViewContext}VidsrcPlayerSection`);
                    }
                });
                list.appendChild(card);
            });
            episodeContainer.appendChild(list);
        } else {
            episodeContainer.innerHTML = `<p class="text-gray-400">No episodes found for this season.</p>`;
        }
    } catch (error) {
        episodeContainer.innerHTML = `<p class="text-red-400">Error loading episodes: ${error.message}</p>`;
        console.error("Episode Loading Error:", error);
    }
}
