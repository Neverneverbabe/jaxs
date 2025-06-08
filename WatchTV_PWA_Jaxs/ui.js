// ui.js
import { TMDB_IMG_BASE_URL, TMDB_BACKDROP_BASE_URL, VIDSRC_PROVIDERS } from './config.js';

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
function getCertification(item) {
    // For movies, check release_dates (US certification)
    if (item.release_dates && item.release_dates.results) {
        const usRelease = item.release_dates.results.find(r => r.iso_3166_1 === 'US');
        if (usRelease && usRelease.release_dates) {
            // Find the most relevant certification (e.g., from the first release type)
            const certification = usRelease.release_dates.find(rd => rd.certification)?.certification;
            if (certification) return certification;
        }
    }
    // For TV shows, check content_ratings (US rating)
    if (item.content_ratings && item.content_ratings.results) {
        const usRating = item.content_ratings.results.find(r => r.iso_3166_1 === 'US');
        if (usRating && usRating.rating) {
            return usRating.rating;
        }
    }
    return 'N/A'; // Default if no certification found
}


/**
 * Creates the HTML string for a single content card (movie/show).
 * @param {object} item - The movie/TV show object from TMDB.
 * @param {boolean} isLightMode - True if light mode is active.
 * @returns {string} - The HTML string for the content card.
 */
export function createContentCardHtml(item, isLightMode) {
    const posterPath = item.poster_path ? `${TMDB_IMG_BASE_URL}${item.poster_path}` : '';
    const title = item.title || item.name || 'Untitled';
    const fallbackImageUrl = `https://placehold.co/200x300/${isLightMode ? 'BBB' : '555'}/${isLightMode ? '333' : 'FFF'}?text=${encodeURIComponent(title)}`;
    const mediaType = item.media_type || (item.title ? 'movie' : 'tv'); // Infer type if not present
    const certification = getCertification(item);
    const certificationBadge = certification !== 'N/A' ? `<span class="rating-badge">${certification}</span>` : '';

    return `
        <div class="content-card" data-id="${item.id}" data-type="${mediaType}" data-certification="${certification}">
            <div class="image-container">
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
 * @param {string} currentFilterRating - The currently selected age rating filter (e.g., 'PG', 'R', or '').
 */
export function displayContentRow(elementId, items, isLightMode, onCardClick, currentFilterRating = '') {
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

        // 2. Apply age rating filter if any are set
        // currentFilterRating is now an array
        if (currentFilterRating.length > 0) {
            processedItems = processedItems.filter(item => {
                const cert = getCertification(item);
                // Item passes if it matches criteria for ANY of the selected filters
                return currentFilterRating.some(filterRt => {
                    if (filterRt === 'G' && cert === 'G') return true;
                    if (filterRt === 'PG' && (cert === 'G' || cert === 'PG')) return true;
                    if (filterRt === 'PG-13' && (cert === 'G' || cert === 'PG' || cert === 'PG-13')) return true;
                    if (filterRt === 'R' && (cert === 'G' || cert === 'PG' || cert === 'PG-13' || cert === 'R')) return true;
                    if (filterRt === 'NC-17' && (cert === 'G' || cert === 'PG' || cert === 'PG-13' || cert === 'R' || cert === 'NC-17')) return true;
                    return false;
                });
            });
        }
        // 3. Slice to get the desired number of items for display
        const itemsToDisplay = processedItems.slice(0, 8);
        
        if (itemsToDisplay.length === 0) {
            cardsHtml = `<p style="padding: 1rem; color: var(--text-secondary);">No content found matching filter criteria.</p>`;
        } else {
            itemsToDisplay.forEach(item => {
                cardsHtml += createContentCardHtml(item, isLightMode);
            });
        }
    } else {
        cardsHtml = `<p style="padding: 1rem; color: var(--text-secondary);">No content found in this category.</p>`;
    }
    
    rowElement.innerHTML = cardsHtml;

    // Attach click listeners to newly added cards
    rowElement.querySelectorAll('.content-card').forEach(card => {
        card.addEventListener('click', (event) => {
            const id = parseInt(card.dataset.id);
            const type = card.dataset.type;
            if (!isNaN(id) && type) {
                onCardClick(id, type);
            }
        });
    });
}

/**
 * Displays detailed information about a movie or TV show in a modal.
 * @param {object} detailsObject - The detailed item object from TMDB.
 * @param {string} itemType - 'movie' or 'tv'.
 * @param {boolean} isLightMode - True if light mode is active.
 */
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
            <p><strong>Overview:</strong> ${overview}</p>
            <p><strong>Release Date:</strong> ${releaseDate}</p>
            <p><strong>Rating:</strong> ${voteAverage} / 10</p>
            ${ageRatingHtml}
            <p><strong>Genres:</strong> ${genres}</p>
            ${imdbLinkHtml}
            ${streamingLinksHtml}
            <div style="margin: 1rem 0;">
                <label for="add-to-folder-dropdown-modal" style="display:block; margin-bottom:0.5rem;"><strong>Add to Folders:</strong></label>
                <div class="apple-dropdown" id="add-to-folder-dropdown-modal">
                    <div class="dropdown-selected" id="dropdown-selected-text-modal">Select folders</div>
                    <div class="dropdown-list" id="dropdown-list-modal" style="display:none;"></div>
                    <div class="dropdown-footer" id="dropdown-footer-modal" style="display:none; padding: 0.5em 1em; text-align: center; border-top: 1px solid var(--border-color); background: var(--dropdown-bg);">
                        <button id="add-new-folder-btn-modal" style="background:none; border:none; color:var(--science-blue); font-size:1.5em; cursor:pointer; width:100%; line-height:1;">+</button>
                    </div>
                </div>
            </div>
        </div>
    </div>
    `;
    itemDetailModal.style.display = 'flex'; // Show the modal
    document.body.style.overflow = 'hidden'; // Prevent body scrolling when modal is open

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
 * @param {string} currentFilterRating - The currently selected age rating filter (e.g., 'PG', 'R', or '').
 */
export function displaySearchResults(elementId, items, isLightMode, onCardClick, currentFilterRating = '') {
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

        // currentFilterRating is now an array
        if (currentFilterRating.length > 0) {
            filteredResults = filteredResults.filter(item => {
                const cert = getCertification(item);
                return currentFilterRating.some(filterRt => {
                    if (filterRt === 'G' && cert === 'G') return true;
                    if (filterRt === 'PG' && (cert === 'G' || cert === 'PG')) return true;
                    if (filterRt === 'PG-13' && (cert === 'G' || cert === 'PG' || cert === 'PG-13')) return true;
                    if (filterRt === 'R' && (cert === 'G' || cert === 'PG' || cert === 'PG-13' || cert === 'R')) return true;
                    if (filterRt === 'NC-17' && (cert === 'G' || cert === 'PG' || cert === 'PG-13' || cert === 'R' || cert === 'NC-17')) return true;
                    return false;
                });
            });
        }

        if (filteredResults.length === 0) {
            container.innerHTML = `<p style="padding: 1rem; color: var(--text-secondary);">No relevant movies or TV shows found for your search matching filter criteria.</p>`;
            return;
        }

        const gridHtml = document.createElement('div');
        gridHtml.className = 'search-results-grid'; // Apply grid styling

        filteredResults.forEach(item => {
            const cardHtml = createContentCardHtml(item, isLightMode);
            // Directly append the card HTML, but attach listener after
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = cardHtml;
            gridHtml.appendChild(tempDiv.firstElementChild); // Append the actual card element
        });
        container.appendChild(gridHtml);

        // Attach click listeners to newly added cards in the search results
        gridHtml.querySelectorAll('.content-card').forEach(card => {
            card.addEventListener('click', (event) => {
                const id = parseInt(card.dataset.id);
                const type = card.dataset.type;
                if (!isNaN(id) && type) {
                    onCardClick(id, type);
                }
            });
        });

    } else {
        container.innerHTML = `<p style="padding: 1rem; color: var(--text-secondary);">No results found.</p>`;
    }
}

/**
 * Populates the filter dropdown with age rating options.
 * @param {HTMLElement} optionsContainerElement - The HTML element for the container where option items will be placed.
 * @param {string[]} temporarySelectionsArray - Array of currently (temporarily) selected rating values.
 */
export function populateFilterDropdown(optionsContainerElement, temporarySelectionsArray) {
    const ratings = [
        { value: '', label: 'All Ratings' },
        { value: 'G', label: 'G' },
        { value: 'PG', label: 'PG' },
        { value: 'PG-13', label: 'PG-13' },
        { value: 'R', label: 'R' },
        { value: 'NC-17', label: 'NC-17' }
    ];

    optionsContainerElement.innerHTML = ratings.map(rating => `
        <div class="dropdown-item filter-option-item ${temporarySelectionsArray.includes(rating.value) ? 'item-selected' : ''}" data-rating="${rating.value}">
            ${rating.label}
            ${temporarySelectionsArray.includes(rating.value) ? '<span class="checkmark">✔</span>' : ''}
        </div>
    `).join('');
}

// Note: getSelectedFilterRating is no longer needed from ui.js as the selection
// will be handled directly in main.js from the data-rating attribute.

/**
 * Creates the HTML string for a folder card in the Library tab.
 * @param {string} folderName - The name of the folder.
 * @param {boolean} isAddButton - True if this card is the "Add New Folder" button.
 * @param {boolean} isLightMode - True if light mode is active.
 * @returns {string} - The HTML string for the folder card.
 */
export function createFolderCardHtml(folderName, isAddButton = false, isLightMode = false) {
    const title = isAddButton ? 'Add Folder' : folderName;
    let cardImageContent;

    if (isAddButton) {
        cardImageContent = `
            <div class="image-container" style="background-color: var(--card-bg); display: flex; align-items: center; justify-content: center; aspect-ratio: 2/3; height: 100%;">
                <i class="fas fa-plus" style="font-size: 2.5rem; color: var(--text-secondary);"></i>
            </div>
        `;
    } else {
        // Using a simple text placeholder for folder icon, can be replaced with an actual icon/image
        const folderPlaceholderUrl = `https://placehold.co/200x300/${isLightMode ? 'E0E0E0' : '4A4A4A'}/${isLightMode ? '6C6C6C' : 'C2C2C2'}?text=${encodeURIComponent(folderName.substring(0, 2).toUpperCase())}&font=inter`;
        cardImageContent = `
            <div class="image-container" style="background-color: var(--card-bg); display: flex; align-items: center; justify-content: center; aspect-ratio: 2/3; height: 100%;">
                 <img src="${folderPlaceholderUrl}" alt="${folderName}" style="width: 100%; height: 100%; object-fit: cover; opacity: 0.8;">
            </div>
        `;
    }

    return `
        <div class="content-card folder-card" ${isAddButton ? 'id="add-new-library-folder-card"' : `data-folder-name="${folderName}"`} style="position: relative;">
            ${!isAddButton ? `<button class="delete-library-folder-btn" data-folder-name="${folderName}" title="Delete Folder" style="position:absolute; top:5px; right:5px; background:rgba(0,0,0,0.4); color:white; border:none; border-radius:50%; width:20px; height:20px; font-size:12px; cursor:pointer; z-index:10; display:flex; align-items:center; justify-content:center;">&times;</button>` : ''}
            ${cardImageContent}
            <p style="text-align: center; margin-top: 0.5rem; font-size: 0.8rem;">${title}</p>
        </div>
    `;
}
