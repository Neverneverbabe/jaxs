// api.js
import { API_KEY, TMDB_BASE_URL } from './config.js';

/**
 * Fetch trending movies or TV shows.
 * @param {'movie'|'tv'} mediaType
 * @param {'day'|'week'} timeWindow
 * @returns {Promise<Array>}
 */
export async function fetchTrendingItems(mediaType = 'movie', timeWindow = 'week') {
    const url = `${TMDB_BASE_URL}/trending/${mediaType}/${timeWindow}?api_key=${API_KEY}&append_to_response=release_dates,content_ratings`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch trending items');
    const data = await response.json();
    return data.results || [];
}

/**
 * Fetch details for a movie or TV show.
 * @param {number} id
 * @param {'movie'|'tv'} type
 * @returns {Promise<Object>}
 */
export async function fetchItemDetails(id, type) {
    const url = `${TMDB_BASE_URL}/${type}/${id}?api_key=${API_KEY}&append_to_response=release_dates,content_ratings,external_ids`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch item details');
    return await response.json();
}

/**
 * Fetch search results for a query.
 * @param {string} query
 * @param {'multi'|'movie'|'tv'} type
 * @returns {Promise<Array>}
 */
export async function fetchSearchResults(query, type = 'multi') {
    const url = `${TMDB_BASE_URL}/search/${type}?api_key=${API_KEY}&query=${encodeURIComponent(query)}&include_adult=false`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch search results');
    const data = await response.json();
    return data.results || [];
}
