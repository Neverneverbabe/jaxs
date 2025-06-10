// ui.js
import { TMDB_IMG_BASE_URL, TMDB_BACKDROP_BASE_URL, VIDSRC_PROVIDERS } from './config.js';

// --- Global DOM References ---
const itemDetailModal = document.getElementById('item-detail-modal');
const modalContentArea = document.getElementById('modal-content-area');
const closeModalButton = itemDetailModal.querySelector('.close-button');

// Custom Alert/Loading Modal (replacing native alert/confirm)
const customAlertModal = document.createElement('div');
customAlertModal.id = 'custom-alert-modal';
customAlertModal.className = 'item-detail-modal'; // Reuse modal styling
customAlertModal.innerHTML = `
    <div class="item-detail-modal-content" style="max-width: 350px; text-align: center; padding: 1.5rem;">
        <h3 id="custom-alert-title" style="margin-bottom: 0.8rem; font-size: 1.4rem; color: var(--text-primary);">Alert</h3>
        <p id="custom-alert-message" style="margin-bottom: 1.5rem; color: var(--text-secondary);"></p>
        <button id="custom-alert-ok-btn" class="auth-submit-button" style="margin-top: 0; width: auto; padding: 0.6em 1.5em; border-radius: 8px;">OK</button>
    </div>
`;
document.body.appendChild(customAlertModal);
const customAlertOkBtn = document.getElementById('custom-alert-ok-btn');

// Loading Indicator Modal
const loadingIndicatorModal = document.createElement('div');
loadingIndicatorModal.id = 'loading-indicator-modal';
loadingIndicatorModal.className = 'item-detail-modal'; // Reuse modal styling
loadingIndicatorModal.innerHTML = `
    <div class="item-detail-modal-content" style="max-width: 250px; text-align: center; padding: 1.5rem;">
        <div class="spinner" style="border: 4px solid rgba(255,255,255,0.3); border-top: 4px solid var(--science-blue); border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 0 auto 1rem auto;"></div>
        <p id="loading-message" style="color: var(--text-primary);">Loading...</p>
    </div>
`;
document.body.appendChild(loadingIndicatorModal);

// CSS for spinner (add this to your <style> block in index.html if not already there)
// @keyframes spin {
//     0% { transform: rotate(0deg); }
//     100% { transform: rotate(360deg); }
// }

// --- Custom Alert Functions ---
export function showCustomAlert(title, message, type = 'info') {
    document.getElementById('custom-alert-title').textContent = title;
    document.getElementById('custom-alert-message').textContent = message;

    if (type === 'error') {
        document.getElementById('custom-alert-title').style.color = 'red';
    } else if (type === 'success') {
        document.getElementById('custom-alert-title').style.color = 'green';
    } else {
        document.getElementById('custom-alert-title').style.color = 'var(--science-blue)';
    }

    customAlertModal.style.display = 'flex';
    document.body.style.overflow = 'hidden'; // Disable background scrolling
}

export function hideCustomAlert() {
    customAlertModal.style.display = 'none';
    document.body.style.overflow = ''; // Re-enable background scrolling
}

customAlertOkBtn.addEventListener('click', hideCustomAlert);
customAlertModal.addEventListener('click', (event) => {
    if (event.target === customAlertModal) { // Clicked on backdrop
        hideCustomAlert();
    }
});


// --- Loading Indicator Functions ---
export function showLoadingIndicator(message = 'Loading...') {
    document.getElementById('loading-message').textContent = message;
    loadingIndicatorModal.style.display = 'flex';
    document.body.style.overflow = 'hidden'; // Disable background scrolling
}

export function hideLoadingIndicator() {
    loadingIndicatorModal.style.display = 'none';
    document.body.style.overflow = ''; // Re-enable background scrolling
}


// --- Modal Event Listeners (Item Detail Modal) ---
closeModalButton.addEventListener('click', () => {
    itemDetailModal.style.display = 'none';
    modalContentArea.innerHTML = ''; // Clear content when closing
    document.body.style.overflow = ''; // Restore body scrolling
});

itemDetailModal.addEventListener('click', (event) => {
    // Close modal if clicking outside the content area
    if (event.target === itemDetailModal) {
        itemDetailModal.style.display = 'none';
        modalContentArea.innerHTML = '';
        document.body.style.overflow = ''; // Restore body scrolling
    }
});

// --- Helper: Get Certification (Age Rating) ---
export function getCertification(item) {
    const itemName = item.title || item.name;

    // For movies, check release_dates (US certification)
    if (item.media_type === 'movie' && item.release_dates && item.release_dates.results) {
        const usRelease = item.release_dates.results.find(r => r.iso_3166_1 === 'US');
        if (usRelease && usRelease.release_dates && usRelease.release_dates.length > 0) {
            let cert = '';
            const theatricalRelease = usRelease.release_dates.find(rd => rd.type === 3 && rd.certification);
            if (theatricalRelease) {
                cert = theatricalRelease.certification;
            } else {
                const anyUSReleaseWithCert = usRelease.release_dates.find(rd => rd.certification);
                if (anyUSReleaseWithCert) {
                    cert = anyUSReleaseWithCert.certification;
                }
            }
            if (cert) return cert;
        }
    }

    // For TV shows, check content_ratings (US rating)
    if (item.media_type === 'tv' && item.content_ratings && item.content_ratings.results) {
        const usRating = item.content_ratings.results.find(r => r.iso_3166_1 === 'US');
        if (usRating && usRating.rating) {
            return usRating.rating;
        }
    }

    // Fallback for items with no media_type or missing data (e.g., search results)
    if (item.release_date && item.vote_average) { // Likely a movie
        if (item.adult) return 'NC-17'; // Simple adult check
        return 'PG-13'; // Default for uncategorized movies
    }
    if (item.first_air_date && item.vote_average) { // Likely a TV show
        return 'TV-14'; // Default for uncategorized TV shows
    }

    return 'N/A'; // Default if no certification found
}

/**
 * Checks if an item's certification is compatible with a selected filter category.
 * An item is compatible if its rating level is less than or equal to the filter's level.
 * @param {string} itemActualCert - The actual certification of the item (e.g., "PG", "TV-14").
 * @param {string|string[]} selectedFilterCategory - The filter category selected by the user (e.g., "PG-13"), or an array of categories.
 * @returns {boolean} - True if compatible, false otherwise.
 */
export function checkRatingCompatibility(itemActualCert, selectedFilterCategory) {
    const ratingHierarchy = {
        'G': 1, 'TV-Y': 1, 'TV-Y7': 1, 'TV-G': 1,
        'PG': 2, 'TV-PG': 2,
        'PG-13': 3, 'TV-14': 3,
        'R': 4, 'TV-MA': 4,
        'NC-17': 5
    };

    const itemLevel = ratingHierarchy[itemActualCert];

    if (itemLevel === undefined) {
        return false; // Item's rating not in our defined hierarchy, or is 'N/A'
    }

    // Handle single filter category (old behavior) or array of categories (new filter behavior)
    if (Array.isArray(selectedFilterCategory)) {
        // If no filter is selected (empty array), all items are compatible
        if (selectedFilterCategory.length === 0) {
            return true;
        }
        // Check if item's level is compatible with ANY selected filter
        return selectedFilterCategory.some(filterCat => {
            const filterLevel = ratingHierarchy[filterCat];
            return filterLevel !== undefined && itemLevel <= filterLevel;
        });
    } else {
        // Old behavior: single string filter category
        const filterLevel = ratingHierarchy[selectedFilterCategory];
        if (filterLevel === undefined) return false;
        return itemLevel <= filterLevel;
    }
}


/**
 * Creates the HTML string for a single content card (movie/show).
 * @param {object} item - The movie/TV show object from TMDB.
 * @param {boolean} isLightMode - True if light mode is active.
 * @param {function} isItemSeenFn - Function from main.js to check if item is seen.
 * @returns {string} - The HTML string for the content card.
 */
export function createContentCardHtml(item, isLightMode, isItemSeenFn) {
    const posterPath = item.poster_path ? `${TMDB_IMG_BASE_URL}${item.poster_path}` : '';
    const title = item.title || item.name || 'Untitled';
    const fallbackImageUrl = `https://placehold.co/200x300/${isLightMode ? 'BBB' : '555'}/${isLightMode ? '333' : 'FFF'}?text=${encodeURIComponent(title)}`;
    const mediaType = item.media_type || (item.title ? 'movie' : 'tv'); // Infer type if not present
    const certification = getCertification(item);
    const certificationBadge = certification !== 'N/A' ? `<span class="rating-badge" style="position: absolute; bottom: 8px; left: 8px; background-color: rgba(0,0,0,0.7); color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; z-index: 5;">${certification}</span>` : '';
    
    // Check seen status using the passed function
    const isSeen = isItemSeenFn(item.id, mediaType);
    const seenIconClass = isSeen ? 'item-is-seen' : '';
    const seenIconTitle = isSeen ? 'Mark as Unseen' : 'Mark as Seen';

    return `
        <div class="content-card" data-id="${item.id}" data-type="${mediaType}" data-certification="${certification}">
            <div class="image-container">
                <div class="seen-toggle-icon ${seenIconClass}" data-id="${item.id}" data-type="${mediaType}" title="${seenIconTitle}">
                    <i class="fas fa-check"></i>
                </div>
                <img src="${posterPath || fallbackImageUrl}" alt="${title}"
                    onerror="this.onerror=null;this.src='${fallbackImageUrl}';">
                ${certificationBadge}
                <div class="overlay">
                    <svg fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd" />
                    </svg>
                </div>
            </div>
            <p>${title}</p>
        </div>
    `;
}

/**
 * Populates a content row with given items.
 * @param {string} elementId - The ID of the HTML element (e.g., 'trending-now-row').
 * @param {Array<object>} items - An array of movie/TV show objects.
 * @param {boolean} isLightMode - True if light mode is active.
 * @param {function} onCardClick - Callback function when a card is clicked.
 * @param {function} isItemSeenFn - Function to check if an item is seen (e.g., main.js's isItemSeen).
 */
export function displayContentRow(elementId, items, isLightMode, onCardClick, isItemSeenFn) {
    const rowElement = document.getElementById(elementId);
    if (!rowElement) {
        console.error(`Element with ID '${elementId}' not found.`);
        return;
    }

    rowElement.innerHTML = ''; // Clear previous content

    if (items && items.length > 0) {
        items.forEach(item => {
            if (item.poster_path) { // Only display items with posters
                const cardHtml = createContentCardHtml(item, isLightMode, isItemSeenFn);
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = cardHtml;
                const cardElement = tempDiv.firstElementChild;

                if (cardElement) {
                    cardElement.addEventListener('click', (e) => {
                        // Prevent modal opening if the seen toggle icon was clicked
                        if (e.target.closest('.seen-toggle-icon')) {
                            return;
                        }
                        const id = parseInt(cardElement.dataset.id);
                        const type = cardElement.dataset.type;
                        if (!isNaN(id) && type) {
                            onCardClick(id, type);
                        }
                    });
                    rowElement.appendChild(cardElement);
                }
            }
        });
    } else {
        rowElement.innerHTML = `<p style="padding: 1rem; color: var(--text-secondary);">No content found in this category.</p>`;
    }

    // Attach event listeners for seen toggle icons to newly added cards
    if (window.attachSeenToggleListenersToCards) {
        window.attachSeenToggleListenersToCards(rowElement);
    }
}


export function displayItemDetails(detailsObject, itemType, isLightMode) {
    console.log("Displaying item details:", detailsObject);

    const title = detailsObject.title || detailsObject.name || 'Title Not Available';
    const overview = detailsObject.overview || 'No overview available for this content.';
    const posterPath = detailsObject.poster_path ? `${TMDB_IMG_BASE_URL}${detailsObject.poster_path}` : '';
    const releaseDate = detailsObject.release_date || detailsObject.first_air_date || 'N/A';
    const voteAverage = detailsObject.vote_average ? detailsObject.vote_average.toFixed(1) : 'N/A';
    const genres = detailsObject.genres && detailsObject.genres.length > 0 ? detailsObject.genres.map(g => g.name).join(', ') : 'N/A';
    const certification = getCertification(detailsObject);
    const ageRatingHtml = certification !== 'N/A'
        ? `<p><strong>Age Rating:</strong> <span class="rating-badge" style="background-color: var(--science-blue); color: white; padding: 3px 8px; border-radius: 4px; font-size: 0.85rem;">${certification}</span></p>`
        : `<p><strong>Age Rating:</strong> N/A</p>`;

    const fallbackPoster = `https://placehold.co/300x450/${isLightMode ? 'BBB' : '555'}/${isLightMode ? '333' : 'FFF'}?text=No+Poster`;

    // Seen Button - initial state will be set by updateSeenButtonStateInModal
    const seenButtonHtml = `
        <button id="toggle-seen-btn" class="seen-action-button" data-id="${detailsObject.id}" data-type="${itemType}" style="padding: 0.5em 1em; font-size: 0.9em; border-radius: 8px; cursor: pointer; height: fit-content; background-color: var(--card-bg); color: var(--text-primary); border: 1px solid var(--text-secondary);">
            Mark as Seen
        </button>`;

    // Folder Dropdown HTML
    // The dropdown list content will be rendered by renderWatchlistOptionsInModal
    const folderDropdownHtml = `
        <div class="apple-dropdown" id="add-to-folder-dropdown-modal" style="width: 180px;">
            <div class="dropdown-selected" id="dropdown-selected-text-modal">Add to Watchlist</div>
            <div class="dropdown-list hide-scrollbar" id="dropdown-list-modal" style="display:none; max-height: 200px; overflow-y: auto; border-radius: 10px; margin-top: 4px;"></div>
            <div class="dropdown-footer" id="dropdown-footer-modal" style="display:none; padding: 0.5em 1em; text-align: center; border-top: 1px solid var(--border-color); background: var(--dropdown-bg); border-bottom-left-radius: 10px; border-bottom-right-radius: 10px;">
                <button id="add-new-folder-btn-modal" style="background:none; border:none; color:var(--science-blue); font-size:1.5em; cursor:pointer; width:100%; line-height:1;">+</button>
            </div>
        </div>`;

    // Combined Actions Row (Seen button and Folder dropdown)
    const actionsRowHtml = `
        <div class="item-actions-row" style="display: flex; align-items: center; gap: 1rem; margin-top: 0.5rem; margin-bottom: 1rem; flex-wrap: wrap;">
            ${seenButtonHtml}
            ${folderDropdownHtml}
        </div>`;

    // IMDb Link
    const imdbId = detailsObject.external_ids && detailsObject.external_ids.imdb_id;
    let imdbLinkHtmlSegment;
    if (imdbId) {
        imdbLinkHtmlSegment = `<a href="https://www.imdb.com/title/${imdbId}/" target="_blank" style="color: var(--science-blue); text-decoration: none;">View on IMDb</a>`;
    } else {
        imdbLinkHtmlSegment = `Not Available`;
    }
    const imdbLinkHtml = `<p><strong>IMDb:</strong> ${imdbLinkHtmlSegment}</p>`;

    // Streaming Provider Links
    let streamingLinksHtml = '<p style="margin-bottom: 0.5rem;"><strong>Watch On:</strong></p><div class="streaming-links">';
    if (VIDSRC_PROVIDERS && VIDSRC_PROVIDERS.length > 0) {
        VIDSRC_PROVIDERS.forEach(provider => {
            let url = '';
            if (itemType === 'movie') url = `${provider.movieUrl}${detailsObject.id}`;
            else if (itemType === 'tv') url = `${provider.tvUrl}${detailsObject.id}`;
            if (url) {
                streamingLinksHtml += `<a href="${url}" target="_blank" style="display: block; margin-bottom: 0.5rem; color: var(--science-blue); text-decoration: none;">${provider.name}${itemType === 'tv' ? ' (TV Series)' : ''}</a>`;
            }
        });
    } else {
        streamingLinksHtml += '<p style="color: var(--text-secondary); margin-left: 0;">No streaming providers configured.</p>';
    }
    streamingLinksHtml += '</div>';

    modalContentArea.innerHTML = `
    <div class="details-grid">
        <div class="poster-container" style="display: flex; justify-content: center; align-items: flex-start;">
            <img src="${posterPath || fallbackPoster}" alt="${title} Poster" class="poster"
                onerror="this.onerror=null;this.src='${fallbackPoster}';">
        </div>
        <div class="details-info" style="display: flex; flex-direction: column;">
            <h2>${title}</h2>
            ${actionsRowHtml}
            <p style="margin-bottom: 0.5rem; font-size: 1rem; line-height: 1.5;"><strong>Overview:</strong> ${overview}</p>
            <p style="margin-bottom: 0.5rem; font-size: 1rem; line-height: 1.5;"><strong>Release Date:</strong> ${releaseDate}</p>
            <p style="margin-bottom: 0.5rem; font-size: 1rem; line-height: 1.5;"><strong>Rating:</strong> ${voteAverage} / 10</p>
            ${ageRatingHtml}
            <p style="margin-bottom: 0.5rem; font-size: 1rem; line-height: 1.5;"><strong>Genres:</strong> ${genres}</p>
            ${imdbLinkHtml}
            ${streamingLinksHtml}
        </div>
    </div>
    `;
    itemDetailModal.style.display = 'flex'; // Show the modal
    document.body.style.overflow = 'hidden'; // Prevent body scrolling when modal is open

    // The state of the seen button and watchlist options will be updated by main.js
    // after this function is called, as they depend on data loaded in main.js.
    // Specifically, main.js will call:
    // updateSeenButtonStateInModal(detailsObject.id, itemType, isItemSeen);
    // renderWatchlistOptionsInModal(detailsObject);
}

/**
 * Updates the state (text and class) of the "Mark as Seen" button in the item detail modal.
 * This function should be called by main.js after its `isItemSeen` status is known.
 * @param {number} itemId - The ID of the item.
 * @param {string} itemType - The type of the item ('movie' or 'tv').
 * @param {function} isItemSeenFn - Reference to the `isItemSeen` function from main.js.
 */
export function updateSeenButtonStateInModal(itemId, itemType, isItemSeenFn) {
    const seenButton = document.getElementById('toggle-seen-btn');
    if (seenButton) {
        if (isItemSeenFn(itemId, itemType)) {
            seenButton.textContent = 'Seen';
            seenButton.classList.add('is-seen');
        } else {
            seenButton.textContent = 'Mark as Seen';
            seenButton.classList.remove('is-seen');
        }
    }
}


// --- Watchlist (Folder) Dropdown in Modal Logic ---
// This function needs access to window.firestoreWatchlistsCache (from main.js)
// and callbacks to main.js's handleAddRemoveItemToFolder and handleCreateLibraryFolder
export function renderWatchlistOptionsInModal(currentItemDetails) {
    const dropdownContainerModal = document.getElementById('add-to-folder-dropdown-modal');
    const dropdownSelectedTextModal = document.getElementById('dropdown-selected-text-modal');
    const dropdownListModal = document.getElementById('dropdown-list-modal');
    const dropdownFooterModal = document.getElementById('dropdown-footer-modal');
    const addNewFolderBtnModal = document.getElementById('add-new-folder-btn-modal');
    const currentItemId = currentItemDetails.id;
    const currentItemType = currentItemDetails.media_type || (currentItemDetails.title ? 'movie' : 'tv');

    // Get current item's watchlist status from the main.js cache
    function getFoldersContainingCurrentItem() {
        // Access window.firestoreWatchlistsCache which is exposed by main.js
        if (!window.firestoreWatchlistsCache) return [];
        return window.firestoreWatchlistsCache.filter(watchlist =>
            watchlist.items.some(item => String(item.tmdb_id) === String(currentItemId) && item.item_type === currentItemType)
        ).map(watchlist => watchlist.id); // Return folder IDs
    }

    let currentlySelectedWatchlistIds = getFoldersContainingCurrentItem();

    function updateDropdownDisplay() {
        currentlySelectedWatchlistIds = getFoldersContainingCurrentItem(); // Refresh selection status
        const allWatchlists = window.firestoreWatchlistsCache || []; // Access global cache from main.js

        dropdownListModal.innerHTML = allWatchlists.length
            ? allWatchlists.map(watchlist => `
                <div class="dropdown-item ${currentlySelectedWatchlistIds.includes(watchlist.id) ? 'item-selected' : ''}" data-folder-id="${watchlist.id}">
                    ${watchlist.name}
                    <span class="checkmark">✔</span>
                </div>`).join('')
            : `<div class="dropdown-item" style="color:var(--text-secondary);cursor:default;text-align:center;">No watchlists yet. Click '+' below.</div>`;

        if (currentlySelectedWatchlistIds.length === 0) {
            dropdownSelectedTextModal.textContent = 'Add to Watchlist';
        } else if (currentlySelectedWatchlistIds.length === 1) {
            const selectedName = allWatchlists.find(wl => wl.id === currentlySelectedWatchlistIds[0])?.name || 'Selected';
            dropdownSelectedTextModal.textContent = selectedName;
        } else {
            dropdownSelectedTextModal.textContent = `${currentlySelectedWatchlistIds.length} watchlists selected`;
        }
    }

    // Initialize display
    updateDropdownDisplay();

    // Toggle dropdown
    dropdownSelectedTextModal.onclick = (event) => {
        event.stopPropagation(); // Prevent modal from closing
        const isOpen = dropdownListModal.style.display === 'block';
        dropdownListModal.style.display = isOpen ? 'none' : 'block';
        dropdownFooterModal.style.display = isOpen ? 'none' : 'block';
        if (isOpen) {
            dropdownSelectedTextModal.focus();
        }
    };

    // Hide dropdown when clicking outside (using delegation on document for modal)
    // This is handled by main.js's itemDetailModal click listener for the modal itself
    // and the specific modalObserver in main.js.
    // For this dropdown itself, we can add a specific listener on the container.
    const dropdownOutsideClickListener = (event) => {
        if (!dropdownContainerModal.contains(event.target) && dropdownListModal.style.display === 'block') {
            dropdownListModal.style.display = 'none';
            dropdownFooterModal.style.display = 'none';
        }
    };
    // Ensure listener is added only once to avoid duplicates
    // Remove it first if it might have been added by a previous modal opening
    document.removeEventListener('click', dropdownOutsideClickListener);
    document.addEventListener('click', dropdownOutsideClickListener);


    // Handle selection/deselection of watchlists
    dropdownListModal.addEventListener('click', async (e) => {
        e.stopPropagation(); // Prevent parent modal clicks
        const itemElement = e.target.closest('.dropdown-item');
        if (!itemElement || !itemElement.dataset.folderId) return;

        const folderId = itemElement.dataset.folderId;
        // Call main.js function to handle add/remove from folder (Firestore operation)
        // main.js exposes this via window.handleAddRemoveItemToFolder
        if (window.handleAddRemoveItemToFolder) {
            await window.handleAddRemoveItemToFolder(folderId, currentItemDetails, currentItemType);
            // The real-time listener in main.js will trigger updateDropdownDisplay()
            // to reflect changes automatically after Firestore updates.
        }
    });

    // Handle new folder creation
    addNewFolderBtnModal.addEventListener('click', async (e) => {
        e.stopPropagation(); // Prevent parent modal clicks
        const newFolderName = prompt("Enter new watchlist name:"); // Consider replacing with custom input modal
        if (newFolderName && newFolderName.trim() !== "") {
            // Call main.js function to create new folder (Firestore operation)
            // main.js exposes this via window.handleCreateLibraryFolder
            if (window.handleCreateLibraryFolder) {
                await window.handleCreateLibraryFolder(newFolderName.trim());
                // The real-time listener will trigger updateDropdownDisplay()
                // to reflect changes automatically after Firestore updates.
            }
        }
    });
}


/**
 * Updates properties of elements based on the current theme mode.
 * @param {boolean} isLightMode - True if light mode is active.
 */
export function updateThemeDependentElements(isLightMode) {
    const sunIcon = document.querySelector('.sun-icon');
    const moonIcon = document.querySelector('.moon-icon');
    const heroImage = document.getElementById('hero-image-element');
    if (sunIcon && moonIcon) {
        sunIcon.style.display = isLightMode ? 'none' : 'inline-block';
        moonIcon.style.display = isLightMode ? 'inline-block' : 'none';
    }
    if (heroImage) {
        // Only update if current src is a fallback or default
        if (heroImage.src.includes('placehold.co')) {
             heroImage.src = isLightMode
                ? 'https://placehold.co/1200x600/A0C4FF/1D1D1F?text=Featured+Show'
                : 'https://placehold.co/1200x600/3B0764/F3F4F6?text=Featured+Show';
            heroImage.onerror = function() {
                this.onerror=null;
                this.src= isLightMode ? 'https://placehold.co/1200x600/A0C4FF/1D1D1F?text=Fallback+Image' : 'https://placehold.co/1200x600/3B0764/F3F4F6?text=Fallback+Image';
            };
        }
    }
    // Recalculate header/footer background RGB for opacity
    // Read the base color from CSS variables then derive RGB
    const headerFooterBgBase = isLightMode ? getComputedStyle(document.documentElement).getPropertyValue('--header-footer-bg-light-rgb') : getComputedStyle(document.documentElement).getPropertyValue('--header-footer-bg-dark-rgb');
    document.documentElement.style.setProperty('--header-footer-bg-rgb', headerFooterBgBase.trim());
    // Also, ensure text-primary-rgb is set for dynamic rgba hovers
    const textPrimaryColor = isLightMode ? '0, 0, 0' : '255, 255, 255'; // Black for light mode, white for dark mode
    document.documentElement.style.setProperty('--text-primary-rgb', textPrimaryColor);
}

/**
 * Updates the hero section with details of a featured item.
 * @param {object} item - The featured item object from TMDB.
 * @param {boolean} isLightMode - True if light mode is active.
 */
export function updateHeroSection(item, isLightMode) {
    const heroTitle = document.getElementById('hero-title');
    const heroOverview = document.getElementById('hero-overview');
    const heroImageElement = document.getElementById('hero-image-element');
    if (item && heroTitle && heroOverview && heroImageElement) {
        heroTitle.textContent = item.title || item.name || 'Featured Content';
        heroOverview.textContent = item.overview || 'Discover the latest blockbusters and critically acclaimed series.';
        let newHeroImageUrl = '';
        if (item.backdrop_path) {
            newHeroImageUrl = `${TMDB_BACKDROP_BASE_URL}${item.backdrop_path}`;
        } else if (item.poster_path) {
            // Fallback to poster as backdrop if backdrop not available
            newHeroImageUrl = `${TMDB_BACKDROP_BASE_URL}${item.poster_path}`;
        } else {
            newHeroImageUrl = isLightMode ? 'https://placehold.co/1200x600/A0C4FF/1D1D1F?text=Featured+Show' : 'https://placehold.co/1200x600/3B0764/F3F4F6?text=Featured+Show';
        }
        heroImageElement.src = newHeroImageUrl;
        heroImageElement.onerror = function() {
            this.onerror=null;
            this.src= isLightMode ? 'https://placehold.co/1200x600/A0C4FF/1D1D1F?text=Fallback+Image' : 'https://placehold.co/1200x600/3B0764/F3F4F6?text=Fallback+Image';
        };
    } else if (heroTitle && heroOverview && heroImageElement) {
        // Fallback content if no item is provided
        heroTitle.textContent = 'Featured Content';
        heroOverview.textContent = 'Discover the latest blockbusters and critically acclaimed series.';
        heroImageElement.src = isLightMode ? 'https://placehold.co/1200x600/A0C4FF/1D1D1F?text=Featured+Show' : 'https://placehold.co/1200x600/3B0764/F3F4F6?text=Featured+Show';
        heroImageElement.onerror = function() {
            this.onerror=null;
            this.src= isLightMode ? 'https://placehold.co/1200x600/A0C4FF/1D1D1F?text=Fallback+Image' : 'https://placehold.co/1200x600/3B0764/F3F4F6?text=Fallback+Image';
        };
    }
}

/**
 * Displays search results in a grid format.
 * @param {string} elementId - The ID of the HTML element where results will be displayed.
 * @param {Array<object>} items - An array of movie/TV show objects.
 * @param {boolean} isLightMode - True if light mode is active.
 * @param {function} onCardClick - Callback function when a card is clicked.
 * @param {function} isItemSeenFn - Function to check if an item is seen.
 */
export function displaySearchResults(elementId, items, isLightMode, onCardClick, isItemSeenFn) {
    const container = document.getElementById(elementId);
    if (!container) {
        console.error(`Search results container with ID '${elementId}' not found.`);
        return;
    }

    container.innerHTML = ''; // Clear previous results and loading message

    if (items && items.length > 0) {
        const gridHtml = document.createElement('div');
        gridHtml.className = 'search-results-grid'; // Apply grid styling

        items.forEach(item => {
            if (item.poster_path) { // Only display items with posters
                const cardHtml = createContentCardHtml(item, isLightMode, isItemSeenFn);
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = cardHtml;
                const cardElement = tempDiv.firstElementChild;

                if (cardElement) {
                    cardElement.addEventListener('click', (e) => {
                        if (e.target.closest('.seen-toggle-icon')) return;
                        const id = parseInt(cardElement.dataset.id);
                        const type = cardElement.dataset.type;
                        if (!isNaN(id) && type) onCardClick(id, type);
                    });
                    gridHtml.appendChild(cardElement);
                }
            }
        });
        container.appendChild(gridHtml);

        // Attach listeners for seen toggle icons
        if (window.attachSeenToggleListenersToCards) {
            window.attachSeenToggleListenersToCards(gridHtml);
        }

    } else {
        container.innerHTML = `<p style="padding: 1rem; color: var(--text-secondary);">No results found.</p>`;
    }
}

/**
 * Appends more items to an existing grid container.
 * @param {HTMLElement} gridContainerElement - The HTML element that serves as the grid container.
 * @param {Array<object>} items - An array of movie/TV show objects to append.
 * @param {boolean} isLightMode - True if light mode is active.
 * @param {function} onCardClick - Callback function when a card is clicked.
 * @param {function} isItemSeenFn - Function to check if an item is seen.
 */
export function appendItemsToGrid(gridContainerElement, items, isLightMode, onCardClick, isItemSeenFn) {
    if (!gridContainerElement || !items || items.length === 0) {
        return;
    }

    items.forEach(item => {
        if (item.poster_path) { // Only append items with posters
            const cardHtml = createContentCardHtml(item, isLightMode, isItemSeenFn);
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = cardHtml;
            const cardElement = tempDiv.firstElementChild;

            if (cardElement) {
                cardElement.addEventListener('click', (e) => {
                    if (e.target.closest('.seen-toggle-icon')) return;
                    const id = parseInt(cardElement.dataset.id);
                    const type = cardElement.dataset.type;
                    if (!isNaN(id) && type) onCardClick(id, type);
                });
                gridContainerElement.appendChild(cardElement);
            }
        }
    });

    if (window.attachSeenToggleListenersToCards) {
        window.attachSeenToggleListenersToCards(gridContainerElement);
    }
}
