// ui.js  
import { TMDB_IMG_BASE_URL, TMDB_BACKDROP_BASE_URL, VIDSRC_PROVIDERS } from './config.js';
import { auth, firebaseAuthFunctions } from '../firebase.js'; // Import Firebase auth

// --- Modal & Filter DOM References ---
const itemDetailModal = document.getElementById('item-detail-modal');
const modalContentArea = document.getElementById('modal-content-area');
const closeModalButton = itemDetailModal.querySelector('.close-button');


// --- Modal Event Listeners ---
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
export function getCertification(item) { // Added export
    const itemName = item.title || item.name;
    console.log(`%c[CERT] Attempting for: ${itemName} (ID: ${item.id})`, "color: orange;");

    // For movies, check release_dates (US certification)
    if (item.release_dates && item.release_dates.results) {
        const usRelease = item.release_dates.results.find(r => r.iso_3166_1 === 'US');
        if (usRelease && usRelease.release_dates && usRelease.release_dates.length > 0) {
            // Prioritize theatrical releases (type 3), then any non-empty certification.
            let cert = '';
            const theatricalRelease = usRelease.release_dates.find(rd => rd.type === 3 && rd.certification);
            if (theatricalRelease) {
                cert = theatricalRelease.certification;
            } else {
                // Fallback to the first non-empty certification found for US releases
                const anyUSReleaseWithCert = usRelease.release_dates.find(rd => rd.certification);
                if (anyUSReleaseWithCert) {
                    cert = anyUSReleaseWithCert.certification;
                }
            }

            if (cert) {
                console.log(`%c[CERT] - Movie (${itemName}): Found US certification: ${cert}`, "color: green;");
                return cert;
            }
            console.log(`%c[CERT] - Movie (${itemName}): No US certification in release_dates. Data:`, "color: lightcoral;", usRelease.release_dates);
        } else {
            console.log(`%c[CERT] - Movie (${itemName}): No US release_dates array or it's empty.`, "color: lightcoral;");
        }
    }

    // For TV shows, check content_ratings (US rating)
    if (item.content_ratings && item.content_ratings.results) {
        const usRating = item.content_ratings.results.find(r => r.iso_3166_1 === 'US');
        if (usRating && usRating.rating) {
            console.log(`%c[CERT] - TV Show (${itemName}): Found US rating: ${usRating.rating}`, "color: green;");
            return usRating.rating;
        }
        console.log(`%c[CERT] - TV Show (${itemName}): No US rating in content_ratings. Data:`, "color: lightcoral;", item.content_ratings.results);
    }

    console.log(`%c[CERT] - ${itemName}: No specific US certification found. Returning 'N/A'.`, "color: red;");
    return 'N/A'; // Default if no certification found
}

/**
 * Checks if an item's certification is compatible with a selected filter category.
 * An item is compatible if its rating level is less than or equal to the filter's level.
 * @param {string} itemActualCert - The actual certification of the item (e.g., "PG", "TV-14").
 * @param {string} selectedFilterCategory - The filter category selected by the user (e.g., "PG-13").
 * @returns {boolean} - True if compatible, false otherwise.
 */
export function checkRatingCompatibility(itemActualCert, selectedFilterCategory) { // Added export
    const ratingHierarchy = {
        // Lower numbers are less restrictive
        'G': 1, 'TV-Y': 1, 'TV-Y7': 1, 'TV-G': 1,
        'PG': 2, 'TV-PG': 2,
        'PG-13': 3, 'TV-14': 3,
        'R': 4, 'TV-MA': 4, 
        'NC-17': 5
    };

    const itemLevel = ratingHierarchy[itemActualCert];
    const filterLevel = ratingHierarchy[selectedFilterCategory];

    if (itemLevel === undefined) return false; // Item's rating not in our defined hierarchy
    return itemLevel <= filterLevel;
}

/**
 * Creates the HTML string for a single content card (movie/show).
 * @param {object} item - The movie/TV show object from TMDB.
 * @param {boolean} isLightMode - True if light mode is active.
 * @param {boolean} isSeen - True if the item is marked as seen.
 * @returns {string} - The HTML string for the content card.
 */
export function createContentCardHtml(item, isLightMode, isSeen = false) {
    const posterPath = item.poster_path ? `${TMDB_IMG_BASE_URL}${item.poster_path}` : '';
    const title = item.title || item.name || 'Untitled';
    const fallbackImageUrl = `https://placehold.co/200x300/${isLightMode ? 'BBB' : '555'}/${isLightMode ? '333' : 'FFF'}?text=${encodeURIComponent(title)}`;
    const mediaType = item.media_type || (item.title ? 'movie' : 'tv'); // Infer type if not present
    const certification = getCertification(item);
    const certificationBadge = certification !== 'N/A' ? `<span class="rating-badge">${certification}</span>` : '';
    const seenIconClass = isSeen ? 'item-is-seen' : '';

    return `
        <div class="content-card" data-id="${item.id}" data-type="${mediaType}" data-certification="${certification}">
            <div class="image-container">
                <div class="seen-toggle-icon ${seenIconClass}" data-id="${item.id}" data-type="${mediaType}" title="${isSeen ? 'Mark as Unseen' : 'Mark as Seen'}">
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
 * @param {Array<string>} currentFilterRating - Array of currently selected age rating filters.
 * @param {function} isItemSeenFn - Function to check if an item is seen (e.g., main.js's isItemSeen).
 */
export function displayContentRow(elementId, items, isLightMode, onCardClick, currentFilterRating = [], isItemSeenFn = () => false) {
    const rowElement = document.getElementById(elementId);
    if (!rowElement) {
        console.error(`Element with ID '${elementId}' not found.`);
        return;
    }
    
    // Clear loading message and previous content
    rowElement.innerHTML = ''; 

    let cardsHtml = '';
    if (items && items.length > 0) {
        // 1. Filter out items without a poster path first
        let processedItems = items.filter(item => item.poster_path);
        console.log(`%c[FILTER] Row '${elementId}': Starting with ${processedItems.length} items. Active filters: ${currentFilterRating.join(', ') || 'None'}`, "color: blue;");

        // 2. Apply age rating filter if any are set
        // currentFilterRating is now an array
        if (currentFilterRating.length > 0) {
            let ageFilteredItems = processedItems.filter(item => {
                const cert = getCertification(item);
                const passesFilter = currentFilterRating.some(filterCategory =>
                    checkRatingCompatibility(cert, filterCategory));
                if (!passesFilter) {
                    console.log(`%c[FILTER] Row '${elementId}': Excluding "${item.title || item.name}" (Cert: ${cert})`, "color: lightcoral;");
                } else {
                    console.log(`%c[FILTER] Row '${elementId}': Including "${item.title || item.name}" (Cert: ${cert})`, "color: lightgreen;");
                }
                return passesFilter;
            });
            processedItems = ageFilteredItems; // Use the strictly filtered list
        }
        // 3. Slice to get the desired number of items for display
        const itemsToDisplay = processedItems.slice(0, 8);
        
        if (itemsToDisplay.length === 0) {
            if (currentFilterRating.length > 0) { // A filter was active and yielded no results from the initial list
                rowElement.innerHTML = `<p style="padding: 1rem; color: var(--text-secondary);">Fetching more content matching filter...</p>`;
                return false; // Signal to fetch discovered items
            } else { // No filter active, but original list was empty or had no posters
                cardsHtml = `<p style="padding: 1rem; color: var(--text-secondary);">No content found in this category.</p>`;
            }
        } else {
            itemsToDisplay.forEach(item => {
                cardsHtml += createContentCardHtml(item, isLightMode, isItemSeenFn(item.id, item.media_type || (item.title ? 'movie' : 'tv'), item));
            });
        }
    } else {
        cardsHtml = `<p style="padding: 1rem; color: var(--text-secondary);">No content found in this category.</p>`;
    }
    
    rowElement.innerHTML = cardsHtml;

    // Attach click listeners to newly added cards
    rowElement.querySelectorAll('.content-card').forEach(card => {
        card.addEventListener('click', (e) => {
            // Prevent modal opening if the seen toggle icon was clicked
            if (e.target.closest('.seen-toggle-icon')) {
                return;
            }
            const id = parseInt(card.dataset.id);
            const type = card.dataset.type;
            if (!isNaN(id) && type) {
                onCardClick(id, type);
            }
        });
    });

    // Expose a function or ensure main.js calls a helper to attach specific listeners
    // to these newly created cards, especially for the seen-toggle-icon.
    // For now, we rely on main.js to attach these after this function completes.
    if (window.attachSeenToggleListenersToCards) { // Check if the global helper exists
        window.attachSeenToggleListenersToCards(rowElement);
    }
    return true; // Content was displayed from initial list
}

export function displayItemDetails(detailsObject, itemType, isLightMode) {
    console.log("Displaying item details:", detailsObject);

    const title = detailsObject.title || detailsObject.name || 'Title Not Available';
    const overview = detailsObject.overview || 'No overview available for this content.';
    const posterPath = detailsObject.poster_path ? `${TMDB_IMG_BASE_URL}${detailsObject.poster_path}` : '';
    const backdropPath = detailsObject.backdrop_path ? `${TMDB_BACKDROP_BASE_URL}${detailsObject.backdrop_path}` : ''; // For hero image if needed
    const releaseDate = detailsObject.release_date || detailsObject.first_air_date || 'N/A';
    const voteAverage = detailsObject.vote_average ? detailsObject.vote_average.toFixed(1) : 'N/A';
    const genres = detailsObject.genres && detailsObject.genres.length > 0 ? detailsObject.genres.map(g => g.name).join(', ') : 'N/A';
    const certification = getCertification(detailsObject);
    const ageRatingHtml = certification !== 'N/A'
        ? `<p><strong>Age Rating:</strong> <span class="rating-badge">${certification}</span></p>`
        : `<p><strong>Age Rating:</strong> N/A</p>`;
    
    // Seen Button - initial state will be set by main.js after modal is shown
    const seenButtonHtml = `
        <button id="toggle-seen-btn" class="seen-action-button" data-id="${detailsObject.id}" data-type="${itemType}" style="padding: 0.3em 0.6em; font-size: 0.8em; border-radius: 6px; cursor: pointer; height: fit-content;">
            Mark as Seen
        </button>`;

    // Folder Dropdown HTML
    const folderDropdownHtml = `
        <div>
            <div class="apple-dropdown" id="add-to-folder-dropdown-modal" style="width: 180px;">
                <div class="dropdown-selected" id="dropdown-selected-text-modal">Select folders</div>
                <div class="dropdown-list" id="dropdown-list-modal" style="display:none;"></div>
                <div class="dropdown-footer" id="dropdown-footer-modal" style="display:none; padding: 0.5em 1em; text-align: center; border-top: 1px solid var(--border-color); background: var(--dropdown-bg);">
                    <button id="add-new-folder-btn-modal" style="background:none; border:none; color:var(--science-blue); font-size:1.5em; cursor:pointer; width:100%; line-height:1;">+</button>
                </div>
            </div>
        </div>`;

    // Combined Actions Row (Seen button and Folder dropdown)
    const actionsRowHtml = `
        <div class="item-actions-row" style="display: flex; align-items: center; gap: 1rem; margin-top: 0.5rem; margin-bottom: 1rem;">
            ${seenButtonHtml}
            ${folderDropdownHtml}
        </div>`;
    // IMDb Link
    const imdbId = detailsObject.external_ids && detailsObject.external_ids.imdb_id;
    let imdbLinkHtmlSegment;
    if (imdbId) {
        imdbLinkHtmlSegment = `<a href="https://www.imdb.com/title/${imdbId}/" target="_blank" style="color: var(--science-blue);">View on IMDb</a>`;
    } else {
        imdbLinkHtmlSegment = `Not Available`;
    }
    const imdbLinkHtml = `<p><strong>IMDb:</strong> ${imdbLinkHtmlSegment}</p>`;

    // Streaming Provider Links
    let streamingLinksHtml = '<p><strong>Watch On:</strong></p><div class="streaming-links">';
    if (VIDSRC_PROVIDERS && VIDSRC_PROVIDERS.length > 0) {
        VIDSRC_PROVIDERS.forEach(provider => {
            let url = '';
            if (itemType === 'movie') url = `${provider.movieUrl}${detailsObject.id}`;
            else if (itemType === 'tv') url = `${provider.tvUrl}${detailsObject.id}`;
            if (url) {
                streamingLinksHtml += `<a href="${url}" target="_blank" style="color: var(--science-blue);">${provider.name}${itemType === 'tv' ? ' (TV Series)' : ''}</a>`;
            }
        });
    } else {
        streamingLinksHtml += '<p style="color: var(--text-secondary); margin-left: 0;">No streaming providers configured.</p>';
    }
    streamingLinksHtml += '</div>';

    const fallbackPoster = `https://placehold.co/300x450/${isLightMode ? 'BBB' : '555'}/${isLightMode ? '333' : 'FFF'}?text=No+Poster`;
    modalContentArea.innerHTML = `
    <div class="details-grid">
        <div class="poster-container">
            <img src="${posterPath || fallbackPoster}" alt="${title} Poster" class="poster"
                 onerror="this.onerror=null;this.src='${fallbackPoster}';">
        </div>
        <div class="details-info">
            <h2>${title}</h2>
            ${actionsRowHtml}
            <p><strong>Overview:</strong> ${overview}</p>
            <p><strong>Release Date:</strong> ${releaseDate}</p>
            <p><strong>Rating:</strong> ${voteAverage} / 10</p>
            ${ageRatingHtml}
            <p><strong>Genres:</strong> ${genres}</p>
            ${imdbLinkHtml}
            ${streamingLinksHtml}
        </div>
    </div>
    `;
    itemDetailModal.style.display = 'flex'; // Show the modal
    document.body.style.overflow = 'hidden'; // Prevent body scrolling when modal is open

    // Update Seen button text/state after modal content is set
    if (window.updateSeenButtonState) {
        window.updateSeenButtonState(detailsObject.id, itemType);
    }


    // Populate folder dropdown
    const dropdownContainerModal = document.getElementById('add-to-folder-dropdown-modal');
    const dropdownSelectedTextModal = document.getElementById('dropdown-selected-text-modal');
    const dropdownListModal = document.getElementById('dropdown-list-modal');
    const dropdownFooterModal = document.getElementById('dropdown-footer-modal');
    const addNewFolderBtnModal = document.getElementById('add-new-folder-btn-modal');

    const movieId = detailsObject.id;
    let currentSelectedFoldersForMovieModal = [];

    function getLibraryFromStorage() {
        return JSON.parse(localStorage.getItem('libraryFolders') || '{}');
    }
    function saveLibraryToStorage(lib) {
        localStorage.setItem('libraryFolders', JSON.stringify(lib));
    }

    function updateSelectedFoldersForCurrentMovie() {
        const lib = getLibraryFromStorage();
        currentSelectedFoldersForMovieModal = Object.keys(lib).filter(folderName =>
            lib[folderName].some(m => m.id === movieId)
        );
    }

    // Render dropdown items
    function renderDropdownItemsModal() {
        updateSelectedFoldersForCurrentMovie();
        const allFolders = Object.keys(getLibraryFromStorage());
        dropdownListModal.innerHTML = allFolders.length
            ? allFolders.map(f => `
                <div class="dropdown-item ${currentSelectedFoldersForMovieModal.includes(f) ? 'item-selected' : ''}" data-folder="${f}">
                    ${f}
                    <span class="checkmark">✔</span>
                </div>`).join('')
            : `<div class="dropdown-item" style="color:var(--text-secondary);cursor:default;text-align:center;">No folders yet. Click '+' below.</div>`;

        if (currentSelectedFoldersForMovieModal.length === 0) {
            dropdownSelectedTextModal.textContent = 'Select folders';
        } else if (currentSelectedFoldersForMovieModal.length === 1) {
            dropdownSelectedTextModal.textContent = currentSelectedFoldersForMovieModal[0];
        } else {
            dropdownSelectedTextModal.textContent = `${currentSelectedFoldersForMovieModal.length} folders selected`;
        }
    }

    // Toggle dropdown
    dropdownSelectedTextModal.onclick = () => {
        const isOpen = dropdownListModal.style.display === 'block';
        dropdownListModal.style.display = isOpen ? 'none' : 'block';
        dropdownFooterModal.style.display = isOpen ? 'none' : 'block';
        if (isOpen) { // If closing, ensure focus isn't trapped
            dropdownSelectedTextModal.focus();
        }
    };

    // Hide dropdown when clicking outside
    const outsideClickListener = (event) => {
        if (!dropdownContainerModal.contains(event.target)) {
            dropdownListModal.style.display = 'none';
            dropdownFooterModal.style.display = 'none';
        }
    };
    document.addEventListener('mousedown', outsideClickListener);

    // Clean up event listener when modal closes (important to prevent memory leaks)
    const modalObserver = new MutationObserver((mutationsList, observer) => {
        for(const mutation of mutationsList) {
            if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                if (itemDetailModal.style.display === 'none') {
                    document.removeEventListener('mousedown', outsideClickListener);
                    observer.disconnect(); // Stop observing the modal itself
                    break;
                }
            }
        }
    });
    modalObserver.observe(itemDetailModal, { attributes: true });


    // Handle selection/deselection
    dropdownListModal.addEventListener('click', (e) => {
        const itemElement = e.target.closest('.dropdown-item');
        if (!itemElement || !itemElement.dataset.folder) return;

        const folderName = itemElement.dataset.folder;
        const lib = JSON.parse(localStorage.getItem('libraryFolders') || '{}');

        if (currentSelectedFoldersForMovieModal.includes(folderName)) {
            // Remove from folder
            lib[folderName] = lib[folderName].filter(m => m.id !== movieId);
        } else {
            // Add to folder
            if (!lib[folderName]) lib[folderName] = []; // Should not happen if folder exists
            if (!lib[folderName].some(m => m.id === movieId)) {
                lib[folderName].push({
                    id: detailsObject.id,
                    title: detailsObject.title || detailsObject.name,
                    poster_path: detailsObject.poster_path ? `https://image.tmdb.org/t/p/w200${detailsObject.poster_path}` : '',
                    type: itemType // Store the item's type (movie or tv)
                });
            }
        }
        localStorage.setItem('libraryFolders', JSON.stringify(lib));
        renderDropdownItemsModal(); // This will update currentSelectedFoldersForMovieModal and UI
    });

    // Handle new folder creation
    addNewFolderBtnModal.addEventListener('click', () => {
        const newFolderName = prompt("Enter new folder name:");
        if (newFolderName && newFolderName.trim() !== "") {
            const trimmedFolderName = newFolderName.trim();
            let lib = getLibraryFromStorage();

            if (!lib[trimmedFolderName]) {
                lib[trimmedFolderName] = [];
            }
            // Add current movie to this new folder (if not already there)
            if (!lib[trimmedFolderName].some(m => m.id === movieId)) {
                lib[trimmedFolderName].push({
                    id: detailsObject.id,
                    title: detailsObject.title || detailsObject.name,
                    poster_path: detailsObject.poster_path ? `https://image.tmdb.org/t/p/w200${detailsObject.poster_path}` : '',
                    type: itemType // Store the item's type
                });
            }
            saveLibraryToStorage(lib);
            renderDropdownItemsModal(); // This will update selections and UI
        }
    });

    // Initial population
    renderDropdownItemsModal();
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
        if (heroImage.src.includes('placehold.co') || heroImage.src.includes('tmdb.org/t/p/w1280/t5zCBSB5xMDKcDqe91ehtTnmCUS.jpg')) {
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
    const headerFooterBgColor = getComputedStyle(document.documentElement).getPropertyValue('--header-footer-bg').trim();
    if (headerFooterBgColor.startsWith('#')) {
        const r = parseInt(headerFooterBgColor.slice(1, 3), 16);
        const g = parseInt(headerFooterBgColor.slice(3, 5), 16);
        const b = parseInt(headerFooterBgColor.slice(5, 7), 16);
        document.documentElement.style.setProperty('--header-footer-bg-rgb', `${r}, ${g}, ${b}`);
    } else if (headerFooterBgColor.startsWith('rgb')) {
        const match = headerFooterBgColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
        if (match) {
            document.documentElement.style.setProperty('--header-footer-bg-rgb', `${match[1]}, ${match[2]}, ${match[3]}`);
        }
    }
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
 * @param {Array<string>} currentFilterRating - Array of currently selected age rating filters.
 * @param {function} isItemSeenFn - Function to check if an item is seen.
 */
export function displaySearchResults(elementId, items, isLightMode, onCardClick, currentFilterRating = [], isItemSeenFn = () => false) {
    const container = document.getElementById(elementId);
    if (!container) {
        console.error(`Search results container with ID '${elementId}' not found.`);
        return;
    }

    // Clear previous results and loading message
    container.innerHTML = '';

    if (items && items.length > 0) {
        // Apply client-side filter for search results
        let filteredResults = items.filter(item => 
            (item.media_type === 'movie' || item.media_type === 'tv') && item.poster_path
        );
        console.log(`%c[FILTER] Search: Starting with ${filteredResults.length} items. Active filters: ${currentFilterRating.join(', ') || 'None'}`, "color: blue;");

        // currentFilterRating is now an array
        if (currentFilterRating.length > 0) {
            let ageFilteredSearchResults = filteredResults.filter(item => {
                const cert = getCertification(item);
                const passesFilter = currentFilterRating.some(filterCategory =>
                    checkRatingCompatibility(cert, filterCategory));
                if (!passesFilter) {
                    console.log(`%c[FILTER] Search: Excluding "${item.title || item.name}" (Cert: ${cert})`, "color: lightcoral;");
                } else {
                    console.log(`%c[FILTER] Search: Including "${item.title || item.name}" (Cert: ${cert})`, "color: lightgreen;");
                }
                return passesFilter;
            });
            filteredResults = ageFilteredSearchResults; // Use the strictly filtered list
        }

        if (filteredResults.length === 0) {
            if (currentFilterRating.length > 0) { // A filter was active and yielded no results
                container.innerHTML = `<p style="padding: 1rem; color: var(--text-secondary);">Fetching more content matching filter...</p>`;
                return false; // Signal to fetch discovered items
            } else { // No filter active, but original search was empty or had no posters
                container.innerHTML = `<p style="padding: 1rem; color: var(--text-secondary);">No results found.</p>`;
                return true; // Technically displayed "no results"
            }
        } else {
             // Proceed to display filteredResults
        }

        const gridHtml = document.createElement('div');
        gridHtml.className = 'search-results-grid'; // Apply grid styling

        filteredResults.forEach(item => {
            const cardHtml = createContentCardHtml(item, isLightMode, isItemSeenFn(item.id, item.media_type, item));
            // Directly append the card HTML, but attach listener after
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = cardHtml;
            gridHtml.appendChild(tempDiv.firstElementChild); // Append the actual card element
        });
        container.appendChild(gridHtml);

        // Attach click listeners to newly added cards in the search results
        gridHtml.querySelectorAll('.content-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (e.target.closest('.seen-toggle-icon')) {
                    return;
                }
                const id = parseInt(card.dataset.id);
                const type = card.dataset.type;
                if (!isNaN(id) && type) {
                    onCardClick(id, type);
                }
            });
        });
        // Attach listeners for seen toggle icons
        if (window.attachSeenToggleListenersToCards) {
            window.attachSeenToggleListenersToCards(gridHtml);
        }
        
    } else {
        container.innerHTML = `<p style="padding: 1rem; color: var(--text-secondary);">No results found.</p>`;
    }
    return true; // Content was displayed from initial list
}

/**
 * Appends more items to an existing grid container.
 * @param {HTMLElement} gridContainerElement - The HTML element that serves as the grid container.
 * @param {Array<object>} items - An array of movie/TV show objects to append.
 * @param {boolean} isLightMode - True if light mode is active.
 * @param {function} onCardClick - Callback function when a card is clicked.
 * @param {function} isItemSeenFn - Function to check if an item is seen.
 */
export function appendItemsToGrid(gridContainerElement, items, isLightMode, onCardClick, isItemSeenFn = () => false) {
    if (!gridContainerElement || !items || items.length === 0) {
        return;
    }

    items.forEach(item => {
        if (item.poster_path) { // Only append items with posters
            const cardHtml = createContentCardHtml(item, isLightMode, isItemSeenFn(item.id, item.media_type || (item.title ? 'movie' : 'tv'), item));
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

/**
 * Shows the sign-in/sign-up modal.
 */
export function showSignInModal() {
    const modal = document.getElementById('sign-in-modal');
    const content = modal.querySelector('.item-detail-modal-content');
    content.innerHTML = `
        <h2>Sign In or Sign Up</h2>
        <form id="auth-form">
            <input type="email" id="auth-email" placeholder="Email" required style="width:100%;margin-bottom:1em;">
            <input type="password" id="auth-password" placeholder="Password" required style="width:100%;margin-bottom:1em;">
            <div style="display:flex;gap:1em;">
                <button type="submit" id="sign-in-btn" style="flex:1;">Sign In</button>
                <button type="button" id="sign-up-btn" style="flex:1;">Sign Up</button>
            </div>
        </form>
        <div id="auth-error" style="color:red;margin-top:1em;"></div>
    `;
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    const authForm = content.querySelector('#auth-form');
    const signInBtn = content.querySelector('#sign-in-btn');
    const signUpBtn = content.querySelector('#sign-up-btn');
    const errorDiv = content.querySelector('#auth-error');

    signInBtn.onclick = async (e) => {
        e.preventDefault();
        const email = content.querySelector('#auth-email').value;
        const password = content.querySelector('#auth-password').value;
        try {
            await firebaseAuthFunctions.signInWithEmailAndPassword(auth, email, password);
            modal.style.display = 'none';
            document.body.style.overflow = '';
        } catch (err) {
 errorDiv.textContent = err.message;
        }
    };
    signUpBtn.addEventListener('click', async (e) => { // Use addEventListener for consistency
        e.preventDefault();
        const email = content.querySelector('#auth-email').value;
        const password = content.querySelector('#auth-password').value;
        try {
            await window.firebaseAuth.signUp(email, password);
            modal.style.display = 'none';
            document.body.style.overflow = '';
        } catch (err) {
            errorDiv.textContent = err.message;
        }
    });
}
