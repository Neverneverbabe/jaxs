// main.js
import { auth, firebaseAuthFunctions, db, firestoreFunctions } from "../firebase.js";
import { fetchTrendingItems, fetchItemDetails, fetchSearchResults, fetchDiscoveredItems } from './api.js';
import { displayContentRow, displayItemDetails, updateThemeDependentElements, updateHeroSection, displaySearchResults, populateFilterDropdown, createContentCardHtml, createFolderCardHtml, appendItemsToGrid, getCertification, checkRatingCompatibility } from './ui.js';

// Global variables to store fetched data for re-filtering without new API calls
let cachedTrendingMovies = [];
let cachedRecommendedShows = [];
let cachedNewReleaseMovies = [];
let cachedSearchResults = []; // Moved from dataset to global for easier access
let localUserSeenItemsCache = []; // Cache for seen items for the current user

// Global variable for current filter state
let currentAgeRatingFilter = []; // Default to no filter (empty array means 'All Ratings')
let currentSelectedLibraryFolder = null; // To keep track of the selected folder in the Library tab

// Explore Tab State
let exploreCurrentPage = 1;
let exploreIsLoading = false;
let exploreHasMore = true;

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
    const signInButton = document.getElementById('sign-in-button'); // User icon in header
    const signInModal = document.getElementById('sign-in-modal');
    const userIconElement = signInButton ? signInButton.querySelector('i') : null; // Get the <i> element for icon changes
    const signInForm = document.getElementById('sign-in-form');

    // Set the current year in the footer
    document.getElementById('current-year').textContent = new Date().getFullYear();

    // Initial theme setup
    let isLightMode = false; // Default to dark mode
    updateThemeDependentElements(isLightMode); // Apply initial theme styling

    // --- Firebase Auth State Change Listener ---
    auth.onAuthStateChanged(user => {
        if (user) {
            // User is signed in
            console.log("Auth state changed: User signed in - UID:", user.uid);
            if (userIconElement) {
                userIconElement.classList.remove('fa-user'); // Assuming default is 'fa-user' or 'fa-user-slash'
                userIconElement.classList.remove('fa-user-slash');
                userIconElement.classList.add('fa-user-check'); // Icon indicating signed-in state
                userIconElement.title = 'Account / Sign Out';
            }
            if (signInModal.style.display === 'flex') {
                 signInModal.style.display = 'none';
                 document.body.style.overflow = '';
            }
            // If other parts of the UI need to refresh based on auth state, trigger that here.
            // For example: populateCurrentTabContent();
            await loadUserSeenItems(); // Load seen items from Firestore
            populateCurrentTabContent(); // Refresh UI with potentially new data
        } else {
            // User is signed out
            console.log("Auth state changed: User signed out");
            if (userIconElement) {
                userIconElement.classList.remove('fa-user-check');
                userIconElement.classList.add('fa-user'); // Icon indicating signed-out state
                userIconElement.title = 'Sign In';
            }
            localUserSeenItemsCache = []; // Clear local cache on sign out
            populateCurrentTabContent(); // Refresh UI to reflect signed-out state
        }
    });

    // Define onCardClick at a scope accessible by populateCurrentTabContent and loadMoreExploreItems
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
        const activeNavLink = document.querySelector(`#main-nav a[data-tab="${tabId}"]`);
        if (activeNavLink) {
            activeNavLink.classList.add('active-nav-link');
        }

        // Special handling for Watch Now tab's hero section visibility
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

    // Add event listener for the header search icon button
    const headerSearchButton = document.querySelector('.icon-buttons button[data-tab="search-tab"]');
    if (headerSearchButton) {
        headerSearchButton.addEventListener('click', (event) => {
            event.preventDefault();
            const tabId = headerSearchButton.dataset.tab;
            if (tabId) switchTab(tabId);
        });
    }

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
            event.stopPropagation(); // Prevent click from bubbling to document
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
            event.stopPropagation(); // Prevent click from bubbling to document
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
            event.stopPropagation(); // Prevent click from bubbling to document
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

    // Explore Tab Scroll Listener
    window.addEventListener('scroll', handleInfiniteScroll);


    // Sign-In Modal Logic
    if (signInButton && signInModal) {
        signInButton.addEventListener('click', () => {
            if (auth.currentUser) {
                // If user is signed in, clicking the button will sign them out
                firebaseAuthFunctions.signOut(auth).catch(error => {
                    console.error("Sign out error", error);
                    alert("Error signing out: " + error.message);
                });
            } else {
                // User is not signed in, show sign-in modal
                signInModal.style.display = 'flex';
                document.body.style.overflow = 'hidden';
            }
        });

        const signInCloseButton = signInModal.querySelector('.close-button');
        if (signInCloseButton) {
            signInCloseButton.addEventListener('click', () => {
                signInModal.style.display = 'none';
                document.body.style.overflow = '';
            });
        }

        signInModal.addEventListener('click', (event) => {
            if (event.target === signInModal) { // Clicked on the backdrop
                signInModal.style.display = 'none';
                document.body.style.overflow = '';
            }
        });

        if (signInForm) {
            signInForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = signInForm.email.value;
    const password = signInForm.password.value;

    try {
        const { signInWithEmailAndPassword } = firebaseAuthFunctions;
                await signInWithEmailAndPassword(auth, email, password);
                // onAuthStateChanged will handle UI updates, including closing the modal and logging.
    } catch (err) {
        console.error("❌ Login failed:", err.message);
        alert("Login failed: " + err.message);
    }
});

            } // This closing brace was originally here.
        }; // This closing brace was originally here and was the culprit.

    // Function to populate content for the currently active tab
    async function populateCurrentTabContent() {
        console.log("%c[DEBUG] populateCurrentTabContent called", "background: #222; color: #bada55");
        const activeTabElement = document.querySelector('.tab-content.active-tab');
        if (!activeTabElement) {
            console.error("%c[CRITICAL_ERROR] No active tab element found in populateCurrentTabContent. Page will be blank.", "color: red; font-weight: bold;");
            return; 
        }

        const activeTabId = activeTabElement.id;
        // onCardClick is now defined at a higher scope
        // Expose function to global scope for ui.js to call
        window.updateSeenButtonState = updateSeenButtonState; 
        // Expose toggleSeenStatus to be callable from the button in ui.js
        window.toggleSeenStatus = toggleSeenStatus;

        // Helper to attach seen toggle listeners to cards
        const attachSeenToggleListenersToCards = (containerElement) => {
            containerElement.querySelectorAll('.seen-toggle-icon').forEach(icon => {
                // Remove existing listener to prevent duplicates if re-rendering
                const newIcon = icon.cloneNode(true);
                icon.parentNode.replaceChild(newIcon, icon);

                newIcon.addEventListener('click', async (e) => {
                    e.stopPropagation(); // Prevent card click (modal opening)
                    const card = newIcon.closest('.content-card');
                    const itemId = parseInt(card.dataset.id);
                    const itemType = card.dataset.type;

                    try {
                        // Fetch full details if not already available, or use minimal from card
                        // For simplicity, let's assume toggleSeenStatus can handle minimal data or fetch if needed
                        // Or, ensure 'item' is passed to isItemSeenFn and then to createContentCardHtml
                        const details = await fetchItemDetails(itemId, itemType); // Fetch details for consistent data
                        toggleSeenStatus(details, itemType); 
                        
                        const newSeenStatus = isItemSeen(itemId, itemType);
                        newIcon.classList.toggle('item-is-seen', newSeenStatus);
                        newIcon.title = newSeenStatus ? 'Mark as Unseen' : 'Mark as Seen';
                    } catch (error) {
                        console.error("Error fetching details for seen toggle on card:", error);
                    }
                });
            });
        };
        window.attachSeenToggleListenersToCards = attachSeenToggleListenersToCards; // Expose for ui.js

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
                    let trendingDisplayed = displayContentRow('trending-now-row', cachedTrendingMovies, isLightMode, onCardClick, currentAgeRatingFilter, isItemSeen);
                    if (!trendingDisplayed && currentAgeRatingFilter.length > 0) {
                        try {
                            console.log("[DISCOVER] Fetching for 'trending-now-row', filter:", currentAgeRatingFilter);
                            const discovered = await fetchDiscoveredItems('movie', currentAgeRatingFilter);
                            if (discovered.length > 0) {
                                displayContentRow('trending-now-row', discovered, isLightMode, onCardClick, [], isItemSeen);
                            } else {
                                document.getElementById('trending-now-row').innerHTML = `<p style="padding: 1rem; color: var(--text-secondary);">No additional content found matching filter.</p>`;
                            }
                        } catch (e) {
                             console.error("Error fetching discovered for trending:", e);
                             document.getElementById('trending-now-row').innerHTML = `<p style="padding: 1rem; color: var(--text-secondary);">Error fetching more content.</p>`;
                        }
                    }

                    // Set the first trending movie as the hero section content
                    // Use the initially fetched trending movies for the hero, not potentially discovered ones
                    const heroSourceList = (trendingDisplayed || cachedTrendingMovies.length > 0) ? cachedTrendingMovies : [];
                    if (heroSourceList.length > 0) {
                        updateHeroSection(heroSourceList[0], isLightMode);
                    } else {
                        updateHeroSection(null, isLightMode); 
                    }

                    // Fetch (if not cached) and display trending TV shows for "Because You Watched..."
                    if (cachedRecommendedShows.length === 0) {
                        console.log("Fetching trending TV shows...");
                        cachedRecommendedShows = await fetchTrendingItems('tv', 'week');
                        console.log("Recommended Shows fetched:", cachedRecommendedShows);
                    }                   
                    let recommendedDisplayed = displayContentRow('recommended-row', cachedRecommendedShows, isLightMode, onCardClick, currentAgeRatingFilter, isItemSeen);
                    if (!recommendedDisplayed && currentAgeRatingFilter.length > 0) {
                        try {
                            console.log("[DISCOVER] Fetching for 'recommended-row', filter:", currentAgeRatingFilter);
                            const discovered = await fetchDiscoveredItems('tv', currentAgeRatingFilter);
                            if (discovered.length > 0) {
                                displayContentRow('recommended-row', discovered, isLightMode, onCardClick, [], isItemSeen);
                            } else {
                                document.getElementById('recommended-row').innerHTML = `<p style="padding: 1rem; color: var(--text-secondary);">No additional content found matching filter.</p>`;
                            }
                        } catch (e) {
                            console.error("Error fetching discovered for recommended:", e);
                            document.getElementById('recommended-row').innerHTML = `<p style="padding: 1rem; color: var(--text-secondary);">Error fetching more content.</p>`;
                        }
                    }

                    // Fetch (if not cached) and display daily trending movies for "New Releases"
                    if (cachedNewReleaseMovies.length === 0) {
                        console.log("Fetching daily trending movies...");
                        cachedNewReleaseMovies = await fetchTrendingItems('movie', 'day');
                        console.log("New Releases fetched:", cachedNewReleaseMovies);
                    }                    
                    let newReleasesDisplayed = displayContentRow('new-releases-row', cachedNewReleaseMovies, isLightMode, onCardClick, currentAgeRatingFilter, isItemSeen);
                    if (!newReleasesDisplayed && currentAgeRatingFilter.length > 0) {
                        try {
                            console.log("[DISCOVER] Fetching for 'new-releases-row', filter:", currentAgeRatingFilter);
                            const discovered = await fetchDiscoveredItems('movie', currentAgeRatingFilter);
                            if (discovered.length > 0) {
                                displayContentRow('new-releases-row', discovered, isLightMode, onCardClick, [], isItemSeen);
                            } else {
                                document.getElementById('new-releases-row').innerHTML = `<p style="padding: 1rem; color: var(--text-secondary);">No additional content found matching filter.</p>`;
                            }
                        } catch (e) {
                            console.error("Error fetching discovered for new releases:", e);
                            document.getElementById('new-releases-row').innerHTML = `<p style="padding: 1rem; color: var(--text-secondary);">Error fetching more content.</p>`;
                        }
                    }
                    break;

                case 'explore-tab':
                    // Initial load for explore tab
                    document.getElementById('explore-grid-container').innerHTML = ''; // Clear previous
                    exploreCurrentPage = 1;
                    exploreHasMore = true;
                    await loadMoreExploreItems();
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
                    const seenContentDiv = document.getElementById('seen-content');
                    const seenItems = getSeenItems();
                    seenContentDiv.innerHTML = ''; // Clear previous content

                    if (seenItems.length === 0) {
                        seenContentDiv.innerHTML = `<p style="padding: 1rem; color: var(--text-secondary);">No items marked as seen yet.</p>`;
                    } else {
                        const gridContainer = document.createElement('div');
                        gridContainer.className = 'search-results-grid'; // Reuse search grid styling

                        seenItems.forEach(item => {
                            // Ensure item has media_type for createContentCardHtml
                            const displayItem = { ...item, media_type: item.type, poster_path: item.poster_path }; // Ensure poster_path is included
                            gridContainer.innerHTML += createContentCardHtml(displayItem, isLightMode, true); // All items here are seen
                        });
                        seenContentDiv.appendChild(gridContainer);
                        attachSeenToggleListenersToCards(gridContainer); // Attach listeners for seen icons
                    }
                    break;

                case 'search-tab':
                    // If a search was performed previously, re-display results with current filter
                    if (searchInput.value.trim().length >= 3 && cachedSearchResults.length > 0) {
                        performSearch(true); // Re-render with new filter, will use isItemSeen
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
        console.log(`performSearch called. reRenderOnly: ${reRenderOnly}, Query: "${searchInput.value.trim()}"`);
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
            let searchDisplayed = displaySearchResults('search-results-container', cachedSearchResults, isLightMode, onCardClickForSearch, currentAgeRatingFilter, isItemSeen);
            if (!searchDisplay && currentAgeRatingFilter.length > 0) {
                // For search, it's less common to fetch "discover" as the user provided a query.
                // We'll stick to showing "no results matching filter" from the original search.
                // If you wanted to fetch discovered items here too, the logic would be similar to above.
                document.getElementById('search-results-container').innerHTML = `<p style="padding: 1rem; color: var(--text-secondary);">No items from your search matched the selected filter.</p>`;
            }
            return;
        } else if (!reRenderOnly) { // New search
             searchResultsContainer.innerHTML = `<p class="loading-message">Searching for "${query}"...</p>`;
             try {
                 console.log(`Fetching search results for query: "${query}"`);
                 const results = await fetchSearchResults(query, 'multi'); // Search both movies and TV shows
                 cachedSearchResults = results; 
                 console.log("Search results fetched:", cachedSearchResults);
                 let searchDisplayed = displaySearchResults('search-results-container', cachedSearchResults, isLightMode, onCardClickForSearch, currentAgeRatingFilter, isItemSeen);
                 if (!searchDisplay && currentAgeRatingFilter.length > 0) {
                    // Similar to reRenderOnly, for search, we usually show "no results matching filter" from the original query.
                    // Fetching discovered items here might deviate too much from the user's search intent.
                    document.getElementById('search-results-container').innerHTML = `<p style="padding: 1rem; color: var(--text-secondary);">No items from your search for "${query}" matched the selected filter.</p>`;
                 } else if (results.length === 0 && !currentAgeRatingFilter.length > 0) { // No results from search and no filter
                    searchResultsContainer.innerHTML = `<p style="padding: 1rem; color: var(--text-secondary);">No results found for "${query}".</p>`;
                 }

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
    //     if (event.key === 'Enter') {
    //         performSearch(false);
    //     }
    // });

    // Initial load: show Watch Now tab and populate its content
    switchTab('watch-now-tab');
    populateCurrentTabContent(); // Initial population of the active tab

    // --- Seen Items Logic ---

    async function loadUserSeenItems() {
        const user = auth.currentUser;
        if (user) {
            try {
                const seenItemsRef = firestoreFunctions.collection(db, "users", user.uid, "seenItems");
                const querySnapshot = await firestoreFunctions.getDocs(seenItemsRef);
                localUserSeenItemsCache = querySnapshot.docs.map(doc => ({ id: parseInt(doc.id), ...doc.data() }));
                console.log("User seen items loaded from Firestore:", localUserSeenItemsCache);
            } catch (error) {
                console.error("Error loading seen items from Firestore:", error);
                localUserSeenItemsCache = []; // Fallback to empty if error
            }
        } else {
            localUserSeenItemsCache = []; // No user, no seen items from DB
        }
    }

    function getSeenItems() { // Now uses the local cache populated from Firestore
        return localUserSeenItemsCache;
    }

    function isItemSeen(itemId, itemType) {
        const seenItems = getSeenItems();
        const found = seenItems.some(item => item.id === itemId && item.type === itemType);
        return found;
    }

    async function toggleSeenStatus(itemDetails, itemType) {
        const user = auth.currentUser;
        if (!user) {
            alert("Please sign in to mark items as seen.");
            return;
        }

        const itemId = itemDetails.id;
        const itemDocRef = firestoreFunctions.doc(db, "users", user.uid, "seenItems", String(itemId));

        try {
            const docSnap = await firestoreFunctions.getDoc(itemDocRef);
            if (docSnap.exists()) { // Item is already seen, so remove it
                await firestoreFunctions.deleteDoc(itemDocRef);
                localUserSeenItemsCache = localUserSeenItemsCache.filter(item => !(item.id === itemId && item.type === itemType));
                console.log(`Item ${itemId} removed from seen (Firestore).`);
            } else { // Item is not seen, so add it
                const seenItemData = {
                    // id: itemId, // ID is the document ID
                    type: itemType,
                    title: itemDetails.title || itemDetails.name,
                    poster_path: itemDetails.poster_path,
                    addedAt: new Date() // Optional: timestamp
                };
                await firestoreFunctions.setDoc(itemDocRef, seenItemData);
                // Add to local cache after successful DB operation
                localUserSeenItemsCache.push({ id: itemId, ...seenItemData });
                console.log(`Item ${itemId} added to seen (Firestore).`);
            }
        } catch (error) {
            console.error("Error toggling seen status in Firestore:", error);
            alert("Error updating seen status. Please try again.");
            return; // Prevent UI update if DB operation failed
        }

        updateSeenButtonState(itemId, itemType); // Update button in modal if open
        
        // If the "Seen" tab is currently active, refresh its content
        if (document.getElementById('seen-tab').classList.contains('active-tab')) {
            populateCurrentTabContent();
        }

        // Also, refresh any card on the page that represents this item
        document.querySelectorAll(`.content-card[data-id="${itemId}"][data-type="${itemType}"]`).forEach(card => {
            const seenIcon = card.querySelector('.seen-toggle-icon');
            if (seenIcon) {
                const newSeenStatus = isItemSeen(itemId, itemType);
                seenIcon.classList.toggle('item-is-seen', newSeenStatus);
                seenIcon.title = newSeenStatus ? 'Mark as Unseen' : 'Mark as Seen';
            }
        });
    }
    
    function updateSeenButtonState(itemId, itemType) {
        const seenButton = document.getElementById('toggle-seen-btn');
        if (seenButton && parseInt(seenButton.dataset.id) === itemId && seenButton.dataset.type === itemType) {
            if (isItemSeen(itemId, itemType)) {
                seenButton.textContent = 'Seen';
                seenButton.classList.add('is-seen');
            } else {
                seenButton.textContent = 'Mark as Seen';
                seenButton.classList.remove('is-seen');
            }
        }
    }

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
            // The "Add New Folder" card will serve as the indicator
            // libraryFoldersRow.innerHTML = `<p style="color:var(--text-secondary); padding: 1rem;">No folders yet. Click '+' to create one.</p>`;
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
                const cardHtmlString = createContentCardHtml(displayItem, isLightMode, isItemSeen(item.id, item.type));
                
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
            attachSeenToggleListenersToCards(librarySelectedFolderMoviesRow);
        }
    }

    // --- Explore Tab Infinite Scroll ---
    async function loadMoreExploreItems() {
        if (exploreIsLoading || !exploreHasMore) return;

        exploreIsLoading = true;
        const loadingIndicator = document.getElementById('explore-loading-indicator');
        if(loadingIndicator) loadingIndicator.style.display = 'block';

        try {
            // For Explore, we fetch movies without specific age rating filters from TMDB,
            // but apply client-side if currentAgeRatingFilter is set.
            // Or, if you want API-level filtering for explore:
            // const items = await fetchDiscoveredItems('movie', currentAgeRatingFilter, exploreCurrentPage);
            console.log(`[Explore] Fetching page ${exploreCurrentPage} with API filters: []`);
            const items = await fetchDiscoveredItems('movie', [], exploreCurrentPage); 
            console.log("[Explore] Fetched items from API:", items);
            
            if (items.length > 0) {
                const exploreGrid = document.getElementById('explore-grid-container');
                // Apply client-side filter before appending
                const itemsToDisplay = currentAgeRatingFilter.length > 0
                    ? items.filter(item => {
                        const cert = getCertification(item); // getCertification is in ui.js, ensure it's accessible or pass it
                        return currentAgeRatingFilter.some(filterCategory => checkRatingCompatibility(cert, filterCategory));
                      })
                    : items;
                console.log("[Explore] Items after client-side filtering (if any):", itemsToDisplay);

                appendItemsToGrid(exploreGrid, itemsToDisplay, isLightMode, onCardClick, isItemSeen);
                exploreCurrentPage++;
            } else {
                exploreHasMore = false; // No more items to load
                console.log("[Explore] No more items to load from API.");
            }
        } catch (error) {
            console.error("Error loading more explore items:", error);
            // Optionally display an error message to the user
        } finally {
            exploreIsLoading = false;
            if(loadingIndicator) loadingIndicator.style.display = 'none';
        }
    }

    function handleInfiniteScroll() {
        const exploreTab = document.getElementById('explore-tab');
        if (!exploreTab || !exploreTab.classList.contains('active-tab')) return;

        // Check if scrolled to near bottom
        if ((window.innerHeight + window.scrollY) >= document.documentElement.scrollHeight - 300) {
            loadMoreExploreItems();
        }
    }

    // Attach event listener for the dynamically added "Toggle Seen" button in the modal
    // Use event delegation on a static parent (modalContentArea or document)
    document.getElementById('modal-content-area').addEventListener('click', async (event) => {
        if (event.target.id === 'toggle-seen-btn') {
            const itemId = parseInt(event.target.dataset.id);
            const itemType = event.target.dataset.type;
            const details = await fetchItemDetails(itemId, itemType); // Fetch details to pass to toggleSeenStatus
            toggleSeenStatus(details, itemType);
        }
    });

});