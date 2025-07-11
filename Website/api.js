// Website/api.js
import { apiKey, tmdbBaseUrl, smallImageBaseUrl, genericItemPlaceholder, stillImageBaseUrl } from './config.js';
import { showLoading, showMessage, displayResults, displayItemDetails, displayTmdbCategoryItems, createRelatedItemCard, displaySeasons } from './ui.js';
import { currentSelectedItemDetails, updateCurrentSelectedItemDetails, selectedCertifications } from './state.js';
import { extractCertification } from './ratingUtils.js';

// DOM Element references (still needed for direct UI manipulation in this file)
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
        const baseUrl = buildSearchUrl(query, itemType, certifications);
        const urlWithAppends = `${baseUrl}&append_to_response=release_dates,content_ratings`;
        const response = await fetch(urlWithAppends);
        if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
        const data = await response.json();
        if (data.results && data.results.length > 0) {
            let items = data.results;
            items = items.map(it => {
                const cert = extractCertification({ ...it, item_type: itemType });
                return { ...it, certification: cert };
            });

            if (certifications && certifications.length > 0 && !certifications.includes('All')) {
                items = items.filter(it => certifications.includes(it.certification || 'NR'));
            }
            if (items.length > 0) {
                displayResults(items, itemType, resultsContainer);
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
        url = `${tmdbBaseUrl}/discover/${type}?api_key=${apiKey}&sort_by=popularity.desc&certification_country=US&certification=${certs}&page=${page}&include_adult=false&append_to_response=release_dates,content_ratings`;
    } else {
        url = `${tmdbBaseUrl}/${type}/${category}?api_key=${apiKey}&page=${page}&append_to_response=release_dates,content_ratings`;
    }

    try {
        console.log(`Fetching TMDB Category URL: ${url}`);
        const response = await fetch(url);
        if (!response.ok) throw new Error(`TMDB API Error: ${response.statusText}`);
        const data = await response.json();
        if (data && data.results && data.results.length > 0) {
            let items = data.results;
            if (filtering) {
                items = items.map(it => ({
                    ...it,
                    certification: extractCertification({ ...it, item_type: type })
                }));
            }
            if (items.length > 0) {
                displayTmdbCategoryItems(items, type, displayContainer, mainCategory, category, page, data.total_pages);
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

export async function fetchEpisodesForSeason(parentShowTmdbId, seasonNum) {
    try {
        const response = await fetch(`${tmdbBaseUrl}/tv/${parentShowTmdbId}/season/${seasonNum}?api_key=${apiKey}`);
        if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
        const seasonDetails = await response.json();
        if (seasonDetails.episodes && seasonDetails.episodes.length > 0) {
            return seasonDetails;
        } else {
            return { ...seasonDetails, episodes: [] };
        }
    } catch (error) {
        console.error("Episode Loading Error:", error);
        throw error;
    }
}