// main.js
import { fetchTrendingItems, fetchItemDetails, fetchSearchResults } from './api.js';
import { displayContentRow, displayItemDetails, updateThemeDependentElements, updateHeroSection, displaySearchResults, populateFilterDropdown, createContentCardHtml, createFolderCardHtml } from './ui.js';

// Global variables to store fetched data for re-filtering without new API calls
let cachedTrendingMovies = [];
let cachedRecommendedShows = [];
let cachedNewReleaseMovies = [];
let cachedSearchResults = []; // Moved from dataset to global for easier access

// Global variable for current filter state
let currentAgeRatingFilter = []; // Default to no filter (empty array means 'All Ratings')
let currentSelectedLibraryFolder = null; // To keep track of the selected folder in the Library tab

// Debounce timer for search input
let searchTimer = null;
const SEARCH_DEBOUNCE_DELAY = 500; // milliseconds

document.addEventListener('DOMContentLoaded', async () => {
    // PWA: Service Worker registration
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('service-worker.js') // Path to service-worker.js
            .then((registration) => {
                console.log('Service Worker registered with scope:', registration.scope);
            })
            .catch((error) => {
                console.error('Service Worker registration failed:', error);
            });
    }

    const themeToggleBtn = document.getElementById('theme-toggle');
    const filterButton = document.getElementById('filter-button'); // The icon button
    const filterOptionsList = document.getElementById('filter-options-list'); // The entire dropdown container
    const filterOptionsItemsContainer = document.getElementById('filter-options-items-container'); // Container for just the options
    const filterApplyBtn = document.getElementById('filter-apply-btn');
    const filterClearBtn = document.getElementById('filter-clear-btn');
    const body = document.body;
    const mainNav = document.getElementById('main-nav');
    const searchInput = document.getElementById('search-input');
    const searchButton = document.getElementById('search-button');
    const searchResultsContainer = document.getElementById('search-results-container');
    const libraryFoldersRow = document.getElementById('library-folders-row');
    const selectedFolderTitleElement = document.getElementById('selected-folder-title');
    const librarySelectedFolderMoviesRow = document.getElementById('library-selected-folder-movies-row');

    // Set the current year in the footer
    document.getElementById('current-year').textContent = new Date().getFullYear();

    // Initial theme setup
    let isLightMode = false; // Default to dark mode
    updateThemeDependentElements(isLightMode); // Apply initial theme styling

    // Function to switch tabs
    function switchTab(tabId) {
        // Hide all tab content
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.remove('active-tab');
        });
        // Show the selected tab
        const activeTab = document.getElementById(tabId);
        if (activeTab) {
            activeTab.classList.add('active-tab');
        }

        // Update active navigation link styling
        document.querySelectorAll('#main-nav a').forEach(link => {
            link.classList.remove('active-nav-link');
        });
        document.querySelector(`#main-nav a[data-tab="${tabId}"]`).classList.add('active-nav-link');

        // Special handling for Watch Now tab (hero section visibility)
        const watchNowTab = document.getElementById('watch-now-tab');
        const heroSection = watchNowTab.querySelector('.hero-section');
        if (tabId === 'watch-now-tab') {
            heroSection.style.display = 'flex'; // Show hero section
        } else {
            heroSection.style.display = 'none'; // Hide hero section for other tabs
        }

        // Trigger content population based on the active tab
        populateCurrentTabContent();
    }

    // Attach click listeners to navigation links
    mainNav.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', (event) => {
            event.preventDefault(); // Prevent default link behavior
            const tabId = event.target.dataset.tab;
            if (tabId) {
                switchTab(tabId);
            }
        });
    });

    // Toggle Dark/Light Mode
    themeToggleBtn.addEventListener('click', () => {
        body.classList.toggle('light-mode');
        isLightMode = body.classList.contains('light-mode');
        updateThemeDependentElements(isLightMode);
        // After theme changes, re-populate content to update placeholder images if needed
        populateCurrentTabContent(); // Re-populate active tab content with new theme
    });

    // Filter Dropdown Logic & State
    let tempSelectedFilters = []; // Holds selections before "Apply"

    if (filterButton && filterOptionsList && filterOptionsItemsContainer && filterApplyBtn && filterClearBtn) {
        filterButton.addEventListener('click', (event) => {
            event.stopPropagation(); // Prevent click from immediately closing due to outside click listener
            const isOpen = filterOptionsList.style.display === 'block';
            if (!isOpen) {
                // Initialize tempSelectedFilters with current applied filters
                // If currentAgeRatingFilter is empty (All), temp should reflect "All Ratings" selected
                tempSelectedFilters = currentAgeRatingFilter.length === 0 ? [""] : [...currentAgeRatingFilter];
                populateFilterDropdown(filterOptionsItemsContainer, tempSelectedFilters);
                filterOptionsList.style.display = 'block';
            } else {
                filterOptionsList.style.display = 'none';
            }
        });

        filterOptionsItemsContainer.addEventListener('click', (event) => {
            const target = event.target.closest('.filter-option-item');
            if (!target || target.dataset.rating === undefined) return;

            const ratingValue = target.dataset.rating;

            if (ratingValue === "") { // Clicked "All Ratings"
                tempSelectedFilters = [""];
            } else {
                // Remove "All Ratings" if a specific rating is chosen
                const allRatingsIndex = tempSelectedFilters.indexOf("");
                if (allRatingsIndex > -1) {
                    tempSelectedFilters.splice(allRatingsIndex, 1);
                }
                // Toggle the specific rating
                const index = tempSelectedFilters.indexOf(ratingValue);
                if (index > -1) {
                    tempSelectedFilters.splice(index, 1);
                } else {
                    tempSelectedFilters.push(ratingValue);
                }
                // If all specific ratings are deselected, revert to "All Ratings"
                if (tempSelectedFilters.length === 0) {
                    tempSelectedFilters = [""];
                }
            }
            populateFilterDropdown(filterOptionsItemsContainer, tempSelectedFilters); // Re-render options
        });

        filterApplyBtn.addEventListener('click', () => {
            if (tempSelectedFilters.includes("") || tempSelectedFilters.length === 0) {
                currentAgeRatingFilter = []; // Apply "All Ratings"
            } else {
                currentAgeRatingFilter = [...tempSelectedFilters];
            }
            filterOptionsList.style.display = 'none';
            filterButton.classList.toggle('filter-active', currentAgeRatingFilter.length > 0);
            populateCurrentTabContent(); // Re-populate with new applied filters
        });

        filterClearBtn.addEventListener('click', () => {
            tempSelectedFilters = [""]; // Set temporary selection to "All Ratings"
            populateFilterDropdown(filterOptionsItemsContainer, tempSelectedFilters);
        });

        // Hide dropdown when clicking outside
        document.addEventListener('click', (event) => {
            if (filterOptionsList.style.display === 'block' && !filterOptionsList.contains(event.target) && event.target !== filterButton && !filterButton.contains(event.target)) {
                filterOptionsList.style.display = 'none';
            }
        });
    }
    // Initial state for filter button (e.g., if a filter is loaded from localStorage in the future)
    if (filterButton) {
        filterButton.classList.toggle('filter-active', currentAgeRatingFilter.length > 0);
    }

    // Function to populate content for the currently active tab
    async function populateCurrentTabContent() {
        const activeTabElement = document.querySelector('.tab-content.active-tab');
        if (!activeTabElement) return; // No active tab

        const activeTabId = activeTabElement.id;
        const onCardClick = async (id, type) => {
            try {
                console.log(`Fetching details for ID: ${id}, Type: ${type}`);
                const details = await fetchItemDetails(id, type);
                console.log("Fetched details:", details);
                displayItemDetails(details, type, isLightMode);
            } catch (error) {
                console.error("Error fetching item details for modal:", error);
                const modal = document.getElementById('item-detail-modal');
                const modalContent = document.getElementById('modal-content-area');
                modalContent.innerHTML = `<h2 style="color: var(--text-primary);">Error</h2><p style="color: var(--text-secondary);">Could not load item details. Please check your network connection and TMDB API key in config.js. Error: ${error.message}</p>`;
                modal.style.display = 'flex';
                document.body.style.overflow = 'hidden';
            }
        };

        try {
            switch (activeTabId) {
                case 'watch-now-tab':
                    // Update loading messages
                    document.getElementById('trending-now-row').innerHTML = '<p class="loading-message">Loading trending movies...</p>';
                    document.getElementById('recommended-row').innerHTML = '<p class="loading-message">Loading recommended content...</p>';
                    document.getElementById('new-releases-row').innerHTML = '<p class="loading-message">Loading new releases...</p>';

                    // Fetch (if not cached) and display trending movies for "Trending Now"
                    if (cachedTrendingMovies.length === 0) {
                        console.log("Fetching trending movies...");
                        cachedTrendingMovies = await fetchTrendingItems('movie', 'week');
                        console.log("Trending Movies fetched:", cachedTrendingMovies);
                    }
                    displayContentRow('trending-now-row', cachedTrendingMovies, isLightMode, onCardClick, currentAgeRatingFilter);

                    // Set the first trending movie as the hero section content
                    if (cachedTrendingMovies.length > 0) {
                        updateHeroSection(cachedTrendingMovies[0], isLightMode);
                    } else {
                        updateHeroSection(null, isLightMode); // Show fallback if no movies loaded
                    }

                    // Fetch (if not cached) and display trending TV shows for "Because You Watched..."
                    if (cachedRecommendedShows.length === 0) {
                        console.log("Fetching trending TV shows...");
                        cachedRecommendedShows = await fetchTrendingItems('tv', 'week');
                        console.log("Recommended Shows fetched:", cachedRecommendedShows);
                    }
                    displayContentRow('recommended-row', cachedRecommendedShows, isLightMode, onCardClick, currentAgeRatingFilter);

                    // Fetch (if not cached) and display daily trending movies for "New Releases"
                    if (cachedNewReleaseMovies.length === 0) {
                        console.log("Fetching daily trending movies...");
                        cachedNewReleaseMovies = await fetchTrendingItems('movie', 'day');
                        console.log("New Releases fetched:", cachedNewReleaseMovies);
                    }
                    displayContentRow('new-releases-row', cachedNewReleaseMovies, isLightMode, onCardClick, currentAgeRatingFilter);
                    break;

                case 'library-tab':
                    // Remove old controls if they were part of a previous structure
                    const oldControls = document.getElementById('library-folders-controls');
                    if (oldControls) oldControls.remove();
                    const oldList = document.getElementById('library-folders-list');
                    if (oldList) oldList.remove();
                    renderLibraryFolderCards();
                    renderMoviesInSelectedFolder(currentSelectedLibraryFolder);
                    break;

                case 'seen-tab':
                    // Seen content remains static placeholders for now
                    const seenContentDiv = document.getElementById('seen-content');
                    seenContentDiv.innerHTML = `<p style="padding: 1rem; color: var(--text-secondary);">Movies and shows you've watched will be tracked here.</p>`;
                    break;

                case 'search-tab':
                    // If a search was performed previously, re-display results with current filter
                    if (searchInput.value.trim().length >= 3 && cachedSearchResults.length > 0) {
                        performSearch(true); // Re-render with new filter
                    } else {
                        searchResultsContainer.innerHTML = `<p style="color: var(--text-secondary);">Start typing to find movies and TV shows!</p>`;
                    }
                    break;

                default:
                    console.log('Unknown tab:', activeTabId);
            }
        } catch (error) {
            console.error("Error populating active tab content:", error);
            const contentContainer = activeTabElement; // Fallback to the active tab div
            contentContainer.innerHTML = `
                <section class="content-section" style="text-align: center; margin-top: 50px; padding: 20px; border-radius: 10px; background-color: var(--card-bg); box-shadow: 0 4px 10px rgba(0,0,0,0.2);">
                    <h3 style="color: var(--text-primary); font-size: 1.875rem; margin-bottom: 1rem;">Content Loading Error</h3>
                    <p style="color: var(--text-secondary); margin-bottom: 1.5rem;">We couldn't load content for this tab. This might be due to:</p>
                    <ul style="list-style-type: disc; text-align: left; display: inline-block; color: var(--text-secondary);">
                        <li>An incorrect TMDB API key in <code>config.js</code>.</li>
                        <li>Network issues preventing connection to the TMDB API.</li>
                        <li>API rate limits being exceeded (try again in a minute).</li>
                    </ul>
                    <p style="color: red; margin-top: 1rem;"><strong>Detailed Error:</strong> ${error.message}</p>
                </section>
            `;
            const heroSection = activeTabElement.querySelector('.hero-section');
            if (heroSection) heroSection.style.display = 'none';
        }
    }

    // Search Functionality
    // `reRenderOnly` is true when only theme/filter changed, no new search query
    async function performSearch(reRenderOnly = false) {
        const query = searchInput.value.trim();
        
        if (!reRenderOnly && query.length < 3) {
            searchResultsContainer.innerHTML = `<p style="color: var(--text-secondary);">Please enter at least 3 characters to search.</p>`;
            // Clear cached results if query is too short for a new search
            cachedSearchResults = [];
            return;
        }

        // If re-rendering for theme/filter AND previous search results exist
        if (reRenderOnly && cachedSearchResults.length > 0) {
            // Use cached results and re-display with current filter
            displaySearchResults('search-results-container', cachedSearchResults, isLightMode, onCardClickForSearch, currentAgeRatingFilter);
            return;
        } else if (!reRenderOnly) { // New search
             searchResultsContainer.innerHTML = `<p class="loading-message">Searching for "${query}"...</p>`;
             try {
                 const results = await fetchSearchResults(query, 'multi'); // Search both movies and TV shows
                 cachedSearchResults = results; // Cache new results
                 displaySearchResults('search-results-container', cachedSearchResults, isLightMode, onCardClickForSearch, currentAgeRatingFilter);
             } catch (error) {
                 console.error("Error performing search:", error);
                 searchResultsContainer.innerHTML = `<p style="color: var(--text-secondary);">Error searching for content. Please try again. Error: ${error.message}</p>`;
                 return;
             }
        }
    }

    const onCardClickForSearch = async (id, type) => {
        try {
            const details = await fetchItemDetails(id, type);
            displayItemDetails(details, type, isLightMode);
        } catch (error) {
            console.error("Error fetching search item details:", error);
            const modal = document.getElementById('item-detail-modal');
            const modalContent = document.getElementById('modal-content-area');
            modalContent.innerHTML = `<h2 style="color: var(--text-primary);">Error</h2><p style="color: var(--text-secondary);">Could not load item details. Error: ${error.message}</p>`;
            modal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
        }
    };

    // Live Search Input Event Listener (debounced)
    searchInput.addEventListener('input', () => {
        clearTimeout(searchTimer); // Clear previous timer
        searchTimer = setTimeout(() => {
            performSearch(false); // Perform new search after delay
        }, SEARCH_DEBOUNCE_DELAY);
    });

    // Keep the search button click for immediate search if user prefers
    searchButton.addEventListener('click', () => {
        clearTimeout(searchTimer); // Clear any pending debounced search
        performSearch(false);
    });
    // Remove keypress listener as 'input' covers it for live search
    // searchInput.addEventListener('keypress', (event) => {
    //     if (event.key === 'Enter') {
    //         performSearch(false);
    //     }
    // });

    // Initial load: show Watch Now tab and populate its content
    switchTab('watch-now-tab');
    populateCurrentTabContent(); // Initial population of the active tab

    // --- Library Tab Helper Functions ---
    function getLibrary() {
        return JSON.parse(localStorage.getItem('libraryFolders') || '{}');
    }
    function saveLibrary(lib) {
        localStorage.setItem('libraryFolders', JSON.stringify(lib));
        // After saving, if the current tab is library, refresh its view.
        if (document.getElementById('library-tab').classList.contains('active-tab')) {
            renderLibraryFolderCards(); // Re-render folder cards (e.g., if one was deleted/added)
            renderMoviesInSelectedFolder(currentSelectedLibraryFolder); // Re-render movies if current folder changed
        }
    }

    async function renderLibraryFolderCards() {
        if (!libraryFoldersRow) return;
        const lib = getLibrary();
        const folderNames = Object.keys(lib);
        libraryFoldersRow.innerHTML = ''; // Clear previous

        if (folderNames.length === 0) {
            libraryFoldersRow.innerHTML = `<p style="color:var(--text-secondary); padding: 1rem;">No folders yet. Click '+' to create one.</p>`;
        }

        folderNames.forEach(name => {
            libraryFoldersRow.innerHTML += createFolderCardHtml(name, false, isLightMode);
        });
        libraryFoldersRow.innerHTML += createFolderCardHtml('', true, isLightMode); // Add "Add New Folder" card

        // Add event listeners
        libraryFoldersRow.querySelectorAll('.folder-card').forEach(card => {
            if (card.id === 'add-new-library-folder-card') {
                card.addEventListener('click', () => {
                    const newFolderName = prompt("Enter new folder name:");
                    if (newFolderName && newFolderName.trim() !== "") {
                        const trimmedName = newFolderName.trim();
                        const currentLib = getLibrary();
                        if (!currentLib[trimmedName]) {
                            currentLib[trimmedName] = [];
                            saveLibrary(currentLib); // This will trigger re-render
                        } else {
                            alert("Folder already exists!");
                        }
                    }
                });
            } else {
                const folderName = card.dataset.folderName;
                card.addEventListener('click', (e) => {
                    // Prevent selection if delete button was clicked
                    if (e.target.classList.contains('delete-library-folder-btn')) return;

                    currentSelectedLibraryFolder = folderName;
                    renderMoviesInSelectedFolder(folderName);
                    libraryFoldersRow.querySelectorAll('.folder-card').forEach(fc => fc.style.border = '2px solid transparent');
                    card.style.border = `2px solid var(--science-blue)`;
                });

                const deleteBtn = card.querySelector('.delete-library-folder-btn');
                if (deleteBtn) {
                    deleteBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        if (confirm(`Are you sure you want to delete the folder "${folderName}"?`)) {
                            const currentLib = getLibrary();
                            delete currentLib[folderName];
                            saveLibrary(currentLib); // This will trigger re-render
                            if (currentSelectedLibraryFolder === folderName) {
                                currentSelectedLibraryFolder = null;
                                renderMoviesInSelectedFolder(null); // Clear movie display
                            }
                        }
                    });
                }
            }
        });
         // Re-apply selection highlight if a folder is selected
        if (currentSelectedLibraryFolder) {
            const selectedCard = libraryFoldersRow.querySelector(`.folder-card[data-folder-name="${currentSelectedLibraryFolder}"]`);
            if (selectedCard) {
                selectedCard.style.border = `2px solid var(--science-blue)`;
            }
        }
    }

    async function renderMoviesInSelectedFolder(folderName) {
        if (!selectedFolderTitleElement || !librarySelectedFolderMoviesRow) return;

        const onLibraryMovieCardClick = async (id, type) => {
            try {
                const details = await fetchItemDetails(id, type);
                displayItemDetails(details, type, isLightMode);
            } catch (error) {
                console.error("Error fetching library item details for modal:", error);
                alert(`Error loading details: ${error.message}`);
            }
        };

        if (!folderName) {
            selectedFolderTitleElement.textContent = 'Movies in Folder';
            librarySelectedFolderMoviesRow.innerHTML = `<p style="color:var(--text-secondary); padding: 1rem;">Select a folder above to see its contents.</p>`;
            return;
        }

        selectedFolderTitleElement.textContent = `Movies in "${folderName}"`;
        const lib = getLibrary();
        const moviesInFolder = lib[folderName] || [];

        if (moviesInFolder.length === 0) {
            librarySelectedFolderMoviesRow.innerHTML = `<p style="color:var(--text-secondary); padding: 1rem;">This folder is empty.</p>`;
        } else {
            librarySelectedFolderMoviesRow.innerHTML = ''; // Clear previous movies
            moviesInFolder.forEach(item => {
                // Ensure item has 'type' for onLibraryMovieCardClick and 'media_type' for createContentCardHtml
                const displayItem = { ...item, media_type: item.type };
                const cardHtmlString = createContentCardHtml(displayItem, isLightMode);
                
                const tempDiv = document.createElement('div'); // Create a temporary div to parse the card HTML
                tempDiv.innerHTML = cardHtmlString;
                const movieCardElement = tempDiv.firstElementChild;

                // Add click listener to the movie card itself
                movieCardElement.addEventListener('click', () => onLibraryMovieCardClick(item.id, item.type));

                // Add delete button to this movie card
                const deleteMovieBtn = document.createElement('button');
                deleteMovieBtn.innerHTML = '&times;';
                deleteMovieBtn.className = 'delete-library-movie-btn';
                deleteMovieBtn.dataset.movieId = item.id;
                deleteMovieBtn.dataset.folderName = folderName;
                deleteMovieBtn.style.cssText = `
                    position:absolute; top:5px; right:5px; background:rgba(255,0,0,0.6);
                    color:white; border:none; border-radius:50%; width:22px; height:22px;
                    font-size:14px; cursor:pointer; z-index:10; line-height:20px; text-align:center;
                    display: flex; align-items: center; justify-content: center;
                `;
                deleteMovieBtn.title = "Remove from folder";
                // Append to image-container which should exist in cardHtmlString
                const imageContainer = movieCardElement.querySelector('.image-container');
                if (imageContainer) {
                    imageContainer.style.position = 'relative'; // Ensure image container can position absolute children
                    imageContainer.appendChild(deleteMovieBtn);
                }

                deleteMovieBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (confirm(`Remove "${item.title}" from folder "${folderName}"?`)) {
                        const currentLib = getLibrary();
                        if (currentLib[folderName]) {
                            currentLib[folderName] = currentLib[folderName].filter(m => m.id !== item.id);
                            saveLibrary(currentLib); // This will trigger re-render of movies
                        }
                    }
                });
                librarySelectedFolderMoviesRow.appendChild(movieCardElement);
            });
        }
    }

});
