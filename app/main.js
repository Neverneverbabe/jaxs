// main.js
// Import API functions including TMDB and new Firebase functions
import {
    fetchTrendingItems,
    fetchItemDetails,
    fetchSearchResults,
    fetchDiscoveredItems,
    signUp,       // Firebase Auth: Sign up
    signIn,       // Firebase Auth: Sign in
    signOutUser,  // Firebase Auth: Sign out
    onAuthChange, // Firebase Auth: Listener for auth state changes
    getCurrentUser, // Firebase Auth: Get current user object
    saveUserData,   // Firestore: Save / Update document
    getUserDataItem, // Firestore: Get single document
    getUserCollection, // Firestore: Get all documents in a collection
    listenToUserCollection, // Firestore: Real-time listener for a collection
    deleteUserData, // Firestore: Delete document
    getUserId       // Get current user ID (Firebase UID or anonymous UUID)
} from './api.js'; // ALL Firebase interaction now comes from api.js

// Import UI functions
import {
    displayContentRow,
    displayItemDetails,
    updateThemeDependentElements,
    updateHeroSection,
    displaySearchResults,
    createContentCardHtml,
    appendItemsToGrid,
    getCertification,
    checkRatingCompatibility,
    showCustomAlert, // Using a simple custom alert for now
    hideCustomAlert,
    showLoadingIndicator,
    hideLoadingIndicator,
    updateSeenButtonStateInModal, // New UI function for modal seen button
    renderWatchlistOptionsInModal // New UI function for modal watchlist dropdown
} from './ui.js';

// Global variables to store fetched data for re-filtering without new API calls
let cachedTrendingMovies = [];
let cachedRecommendedShows = [];
let cachedNewReleaseMovies = [];
let cachedSearchResults = [];
let localUserSeenItemsCache = []; // Cache for seen items for the current user
let firestoreWatchlistsCache = []; // Global cache for Firestore watchlists

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

    // --- DOM Element References ---
    const themeToggleBtn = document.getElementById('theme-toggle');
    const filterButton = document.getElementById('filter-button');
    const filterOptionsList = document.getElementById('filter-options-list');
    const filterOptionsItemsContainer = document.getElementById('filter-options-items-container');
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

    // New Auth UI Elements
    const profileMenuContainer = document.getElementById('profile-menu-container');
    const profileMenuButton = document.getElementById('profile-menu-button');
    const profileDropdown = document.getElementById('profile-dropdown');
    const profileStatus = document.getElementById('profile-status');
    const profileSignInBtn = document.getElementById('profile-signin-btn');
    const profileSignUpBtn = document.getElementById('profile-signup-btn');
    const profileSignOutBtn = document.getElementById('profile-signout-btn');

    const authModal = document.getElementById('auth-modal');
    const authModalCloseButton = authModal.querySelector('.close-button');
    const authModalTitle = document.getElementById('auth-modal-title');
    const authForm = document.getElementById('auth-form');
    const nameInputGroup = document.getElementById('signup-name-group');
    const nameInput = document.getElementById('name-input');
    const authEmailInput = document.getElementById('auth-email-input');
    const authPasswordInput = document.getElementById('auth-password-input');
    const confirmPasswordGroup = document.getElementById('signup-confirm-password-group');
    const confirmPasswordInput = document.getElementById('confirm-password-input');
    const authSubmitButton = document.getElementById('auth-submit-button');
    const authSwitchLink = document.getElementById('auth-switch-link');

    // Set the current year in the footer
    document.getElementById('current-year').textContent = new Date().getFullYear();

    // Initial theme setup
    let isLightMode = false; // Default to dark mode
    updateThemeDependentElements(isLightMode); // Apply initial theme styling

    // --- Firebase Auth State Change Listener ---
    // Listen for auth state changes to update profile UI and load user data
    onAuthChange(async (user) => { // This onAuthChange is from api.js
        updateProfileMenuUI(user); // Update profile dropdown
        if (user) {
            console.log("Auth state changed: User signed in - UID:", user.uid, "Display Name:", user.displayName);
            await loadUserSeenItems(); // Load seen items from Firestore
            await loadUserFirestoreWatchlists(); // Load watchlists from Firestore
            // Close auth modal if it was open
            if (authModal.style.display === 'flex') {
                closeAuthModal();
            }
        } else {
            console.log("Auth state changed: User signed out");
            // Clear local caches on sign out
            localUserSeenItemsCache = [];
            firestoreWatchlistsCache = [];
        }
        populateCurrentTabContent(); // Refresh UI with potentially new data based on auth state
    });

    // --- Core Functions ---

    // Define onCardClick at a scope accessible by populateCurrentTabContent and loadMoreExploreItems
    const onCardClick = async (id, type) => {
        try {
            showLoadingIndicator('Fetching item details...');
            console.log(`Fetching details for ID: ${id}, Type: ${type}`);
            const details = await fetchItemDetails(id, type);
            console.log("Fetched details:", details);
            displayItemDetails(details, type, isLightMode); // This function opens the item detail modal
            // After modal is displayed, update the seen button and watchlist options
            updateSeenButtonStateInModal(details.id, type, isItemSeen);
            renderWatchlistOptionsInModal(details);
        } catch (error) {
            console.error("Error fetching item details for modal:", error);
            showCustomAlert('Error', `Could not load item details. Please check your network connection and TMDB API key. Error: ${error.message}`);
        } finally {
            hideLoadingIndicator();
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

    // Function to populate content for the currently active tab
    async function populateCurrentTabContent() {
        console.log("%c[DEBUG] populateCurrentTabContent called", "background: #222; color: #bada55");
        const activeTabElement = document.querySelector('.tab-content.active-tab');
        if (!activeTabElement) {
            console.error("%c[CRITICAL_ERROR] No active tab element found in populateCurrentTabContent. Page will be blank.", "color: red; font-weight: bold;");
            return;
        }

        const activeTabId = activeTabElement.id;

        // Helper to attach seen toggle listeners to cards
        // This function needs to be defined globally or passed if used in UI creation functions
        window.attachSeenToggleListenersToCards = (containerElement) => {
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
                        const details = await fetchItemDetails(itemId, itemType); // Fetch details for consistent data
                        await toggleSeenStatus(details, itemType);
                        const newSeenStatus = isItemSeen(itemId, itemType);
                        newIcon.classList.toggle('item-is-seen', newSeenStatus);
                        newIcon.title = newSeenStatus ? 'Mark as Unseen' : 'Mark as Seen';
                    } catch (error) {
                        console.error("Error fetching details for seen toggle on card:", error);
                        showCustomAlert('Error', `Could not update seen status: ${error.message}`);
                    }
                });
            });
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
                    // Filter based on age rating
                    const filteredTrending = currentAgeRatingFilter.length > 0
                        ? cachedTrendingMovies.filter(item => checkRatingCompatibility(getCertification(item), currentAgeRatingFilter))
                        : cachedTrendingMovies;
                    displayContentRow('trending-now-row', filteredTrending, isLightMode, onCardClick, isItemSeen);
                    if (filteredTrending.length === 0 && currentAgeRatingFilter.length > 0) {
                        document.getElementById('trending-now-row').innerHTML = `<p style="padding: 1rem; color: var(--text-secondary);">No items matched your filter.</p>`;
                    }


                    // Set the first trending movie as the hero section content
                    const heroSourceList = (filteredTrending.length > 0) ? filteredTrending : cachedTrendingMovies; // Use filtered or original if filtered is empty
                    if (heroSourceList.length > 0) {
                        updateHeroSection(heroSourceList[0], isLightMode);
                    } else {
                        updateHeroSection(null, isLightMode); // Fallback if no content
                    }

                    // Fetch (if not cached) and display trending TV shows for "Because You Watched..."
                    if (cachedRecommendedShows.length === 0) {
                        console.log("Fetching trending TV shows...");
                        cachedRecommendedShows = await fetchTrendingItems('tv', 'week');
                        console.log("Recommended Shows fetched:", cachedRecommendedShows);
                    }
                    const filteredRecommended = currentAgeRatingFilter.length > 0
                        ? cachedRecommendedShows.filter(item => checkRatingCompatibility(getCertification(item), currentAgeRatingFilter))
                        : cachedRecommendedShows;
                    displayContentRow('recommended-row', filteredRecommended, isLightMode, onCardClick, isItemSeen);
                    if (filteredRecommended.length === 0 && currentAgeRatingFilter.length > 0) {
                        document.getElementById('recommended-row').innerHTML = `<p style="padding: 1rem; color: var(--text-secondary);">No items matched your filter.</p>`;
                    }


                    // Fetch (if not cached) and display daily trending movies for "New Releases"
                    if (cachedNewReleaseMovies.length === 0) {
                        console.log("Fetching daily trending movies...");
                        cachedNewReleaseMovies = await fetchTrendingItems('movie', 'day');
                        console.log("New Releases fetched:", cachedNewReleaseMovies);
                    }
                    const filteredNewReleases = currentAgeRatingFilter.length > 0
                        ? cachedNewReleaseMovies.filter(item => checkRatingCompatibility(getCertification(item), currentAgeRatingFilter))
                        : cachedNewReleaseMovies;
                    displayContentRow('new-releases-row', filteredNewReleases, isLightMode, onCardClick, isItemSeen);
                    if (filteredNewReleases.length === 0 && currentAgeRatingFilter.length > 0) {
                        document.getElementById('new-releases-row').innerHTML = `<p style="padding: 1rem; color: var(--text-secondary);">No items matched your filter.</p>`;
                    }

                    // Attach event listeners for seen toggle icons on all rows
                    attachSeenToggleListenersToCards(document.getElementById('trending-now-row'));
                    attachSeenToggleListenersToCards(document.getElementById('recommended-row'));
                    attachSeenToggleListenersToCards(document.getElementById('new-releases-row'));
                    break;

                case 'library-tab':
                    await renderLibraryFolderCards();
                    await renderMoviesInSelectedFolder(currentSelectedLibraryFolder);
                    break;

                case 'seen-tab':
                    const seenContentDiv = document.getElementById('seen-content');
                    const seenItems = getSeenItems(); // Now uses the local cache populated from Firestore
                    seenContentDiv.innerHTML = ''; // Clear previous content

                    if (seenItems.length === 0) {
                        seenContentDiv.innerHTML = `<p style="padding: 1rem; color: var(--text-secondary);">No items marked as seen yet.</p>`;
                    } else {
                        const gridContainer = document.createElement('div');
                        gridContainer.className = 'search-results-grid'; // Reuse search grid styling

                        // Apply filter to seen items
                        const filteredSeenItems = currentAgeRatingFilter.length > 0
                            ? seenItems.filter(item => checkRatingCompatibility(getCertification(item), currentAgeRatingFilter))
                            : seenItems;

                        if (filteredSeenItems.length === 0 && currentAgeRatingFilter.length > 0) {
                            seenContentDiv.innerHTML = `<p style="padding: 1rem; color: var(--text-secondary);">No seen items matched the selected filter.</p>`;
                        } else {
                            filteredSeenItems.forEach(item => {
                                // Ensure item has media_type for createContentCardHtml
                                const displayItem = { ...item, media_type: item.type, poster_path: item.poster_path }; // Ensure poster_path is included
                                gridContainer.innerHTML += createContentCardHtml(displayItem, isLightMode, isItemSeen); // All items here are seen
                            });
                            seenContentDiv.appendChild(gridContainer);
                            attachSeenToggleListenersToCards(gridContainer); // Attach listeners for seen icons
                        }
                    }
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
                        <li>An incorrect TMDB API key.</li>
                        <li>Network issues preventing connection to the TMDB API or Firebase.</li>
                        <li>API rate limits being exceeded (try again in a minute).</li>
                    </ul>
                    <p style="color: red; margin-top: 1rem;"><strong>Detailed Error:</strong> ${error.message}</p>
                </section>
            `;
            const heroSection = activeTabElement.querySelector('.hero-section');
            if (heroSection) heroSection.style.display = 'none';
        }
    }

    // --- Event Listeners ---

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

    // Helper for filter dropdown rendering (moved inline here for simplicity as it was a missing UI export)
    function renderFilterDropdownOptions(container, selectedFilters) {
        container.innerHTML = `
            <div class="dropdown-item filter-option-item" data-rating="">All Ratings <span class="checkmark">✔</span></div>
            <div class="dropdown-item filter-option-item" data-rating="G">G <span class="checkmark">✔</span></div>
            <div class="dropdown-item filter-option-item" data-rating="PG">PG <span class="checkmark">✔</span></div>
            <div class="dropdown-item filter-option-item" data-rating="PG-13">PG-13 <span class="checkmark">✔</span></div>
            <div class="dropdown-item filter-option-item" data-rating="R">R <span class="checkmark">✔</span></div>
            <div class="dropdown-item filter-option-item" data-rating="NC-17">NC-17 <span class="checkmark">✔</span></div>
        `;
        container.querySelectorAll('.filter-option-item').forEach(item => {
            const ratingValue = item.dataset.rating;
            if (selectedFilters.includes(ratingValue) || (selectedFilters.length === 0 && ratingValue === "")) {
                item.classList.add('item-selected'); // Use item-selected for multi-select
            } else {
                item.classList.remove('item-selected');
            }
        });
    }

    if (filterButton && filterOptionsList && filterOptionsItemsContainer && filterApplyBtn && filterClearBtn) {
        filterButton.addEventListener('click', (event) => {
            event.stopPropagation(); // Prevent click from immediately closing due to outside click listener
            const isOpen = filterOptionsList.style.display === 'block';
            if (!isOpen) {
                // Initialize tempSelectedFilters with current applied filters
                tempSelectedFilters = currentAgeRatingFilter.length === 0 ? [""] : [...currentAgeRatingFilter];
                renderFilterDropdownOptions(filterOptionsItemsContainer, tempSelectedFilters);
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
            renderFilterDropdownOptions(filterOptionsItemsContainer, tempSelectedFilters); // Re-render options
        });

        filterApplyBtn.addEventListener('click', (event) => {
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

        filterClearBtn.addEventListener('click', (event) => {
            event.stopPropagation(); // Prevent click from bubbling to document
            tempSelectedFilters = [""]; // Set temporary selection to "All Ratings"
            renderFilterDropdownOptions(filterOptionsItemsContainer, tempSelectedFilters);
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

    // --- Profile Menu and Auth Modal Logic ---

    // Toggle profile dropdown visibility
    profileMenuButton.addEventListener('click', (event) => {
        event.stopPropagation(); // Prevent document click from immediately closing
        profileDropdown.classList.toggle('show');
    });

    // Close profile dropdown when clicking outside
    document.addEventListener('click', (event) => {
        if (!profileMenuContainer.contains(event.target) && profileDropdown.classList.contains('show')) {
            profileDropdown.classList.remove('show');
        }
    });

    // Update profile menu UI based on authentication state
    function updateProfileMenuUI(user) {
        if (user) {
            profileStatus.textContent = `Signed in as ${user.displayName || user.email}`;
            profileSignInBtn.style.display = 'none';
            profileSignUpBtn.style.display = 'none';
            profileSignOutBtn.style.display = 'block';
        } else {
            profileStatus.textContent = 'Not Signed In';
            profileSignInBtn.style.display = 'block';
            profileSignUpBtn.style.display = 'block';
            profileSignOutBtn.style.display = 'none';
        }
    }

    // Open Auth Modal in specified mode ('signin' or 'signup')
    function openAuthModal(mode) {
        authModal.style.display = 'flex';
        document.body.style.overflow = 'hidden'; // Disable scrolling on body
        setAuthModalMode(mode);
    }

    // Close Auth Modal
    function closeAuthModal() {
        authModal.style.display = 'none';
        document.body.style.overflow = ''; // Re-enable scrolling
        // Clear form fields when closing
        authForm.reset();
    }

    // Set Auth Modal mode (Sign In or Sign Up)
    function setAuthModalMode(mode) {
        if (mode === 'signup') {
            authModalTitle.textContent = 'Sign Up';
            nameInputGroup.style.display = 'block';
            confirmPasswordGroup.style.display = 'block';
            authSubmitButton.textContent = 'Sign Up';
            authSwitchLink.textContent = "Already have an account? Sign In";
            nameInput.setAttribute('required', 'true');
            confirmPasswordInput.setAttribute('required', 'true');
        } else { // 'signin'
            authModalTitle.textContent = 'Sign In';
            nameInputGroup.style.display = 'none';
            confirmPasswordGroup.style.display = 'none';
            authSubmitButton.textContent = 'Sign In';
            authSwitchLink.textContent = "Don't have an account? Sign Up";
            nameInput.removeAttribute('required');
            confirmPasswordInput.removeAttribute('required');
        }
    }

    // Auth Modal Event Listeners
    profileSignInBtn.addEventListener('click', () => openAuthModal('signin'));
    profileSignUpBtn.addEventListener('click', () => openAuthModal('signup'));
    profileSignOutBtn.addEventListener('click', async () => {
        try {
            await signOutUser(); // signOutUser is from api.js
            profileDropdown.classList.remove('show'); // Hide dropdown on sign out
            showCustomAlert('Success', 'You have been signed out.');
        } catch (error) {
            console.error("Error signing out:", error);
            showCustomAlert('Error', `Sign out failed: ${error.message}`);
        }
    });

    authModalCloseButton.addEventListener('click', closeAuthModal);
    authModal.addEventListener('click', (event) => {
        if (event.target === authModal) { // Clicked on the backdrop
            closeAuthModal();
        }
    });

    authSwitchLink.addEventListener('click', () => {
        const currentMode = authModalTitle.textContent === 'Sign In' ? 'signin' : 'signup';
        setAuthModalMode(currentMode === 'signin' ? 'signup' : 'signin');
        authForm.reset(); // Clear form fields when switching mode
    });

    authForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const mode = authModalTitle.textContent === 'Sign In' ? 'signin' : 'signup';
        const email = authEmailInput.value;
        const password = authPasswordInput.value;
        let name = nameInput.value;
        const confirmPassword = confirmPasswordInput.value;

        showLoadingIndicator('Processing...');
        try {
            if (mode === 'signup') {
                if (!name.trim()) {
                    showCustomAlert('Error', 'Please enter your full name.');
                    return;
                }
                if (password !== confirmPassword) {
                    showCustomAlert('Error', 'Passwords do not match.');
                    return;
                }
                await signUp(name, email, password); // signUp is from api.js
                showCustomAlert('Success', 'Account created successfully! You are now signed in.');
            } else { // signin
                await signIn(email, password); // signIn is from api.js
                showCustomAlert('Success', 'Signed in successfully!');
            }
            closeAuthModal(); // onAuthChange listener will handle further UI updates
        } catch (error) {
            console.error("Authentication error:", error);
            let errorMessage = "An unknown error occurred.";
            // Firebase specific error messages
            if (error.code) {
                switch (error.code) {
                    case 'auth/email-already-in-use':
                        errorMessage = 'The email address is already in use by another account.';
                        break;
                    case 'auth/invalid-email':
                        errorMessage = 'The email address is not valid.';
                        break;
                    case 'auth/operation-not-allowed':
                        errorMessage = 'Email/password accounts are not enabled. Contact support.';
                        break;
                    case 'auth/weak-password':
                        errorMessage = 'The password is too weak. Please use at least 6 characters.';
                        break;
                    case 'auth/user-disabled':
                        errorMessage = 'This user account has been disabled.';
                        break;
                    case 'auth/user-not-found':
                    case 'auth/wrong-password':
                        errorMessage = 'Invalid email or password.';
                        break;
                    case 'auth/network-request-failed':
                        errorMessage = 'Network error. Please check your internet connection.';
                        break;
                    default:
                        errorMessage = `Authentication failed: ${error.message}`;
                }
            } else {
                errorMessage = error.message;
            }
            showCustomAlert('Error', errorMessage);
        } finally {
            hideLoadingIndicator();
        }
    });

    // --- Search Functionality ---
    async function performSearch(reRenderOnly = false) {
        console.log(`performSearch called. reRenderOnly: ${reRenderOnly}, Query: "${searchInput.value.trim()}"`);
        const query = searchInput.value.trim();

        if (!reRenderOnly && query.length < 3) {
            searchResultsContainer.innerHTML = `<p style="color: var(--text-secondary);">Please enter at least 3 characters to search.</p>`;
            // Clear cached results if query is too short for a new search
            cachedSearchResults = [];
            return;
        }

        if (reRenderOnly && cachedSearchResults.length > 0) {
            // Use cached results and re-display with current filter
            const filteredResults = currentAgeRatingFilter.length > 0
                ? cachedSearchResults.filter(item => checkRatingCompatibility(getCertification(item), currentAgeRatingFilter))
                : cachedSearchResults;
            displaySearchResults('search-results-container', filteredResults, isLightMode, onCardClick, isItemSeen);
            if (filteredResults.length === 0 && currentAgeRatingFilter.length > 0) {
                searchResultsContainer.innerHTML = `<p style="padding: 1rem; color: var(--text-secondary);">No items from your search matched the selected filter.</p>`;
            }
            // Attach seen toggle listeners to newly displayed cards
            attachSeenToggleListenersToCards(searchResultsContainer);
            return;
        } else if (!reRenderOnly) { // New search
            searchResultsContainer.innerHTML = `<p class="loading-message">Searching for "${query}"...</p>`;
            try {
                showLoadingIndicator('Searching...');
                console.log(`Fetching search results for query: "${query}"`);
                const results = await fetchSearchResults(query, 'multi'); // Search both movies and TV shows
                cachedSearchResults = results;
                console.log("Search results fetched:", cachedSearchResults);

                const filteredResults = currentAgeRatingFilter.length > 0
                    ? cachedSearchResults.filter(item => checkRatingCompatibility(getCertification(item), currentAgeRatingFilter))
                    : cachedSearchResults;

                displaySearchResults('search-results-container', filteredResults, isLightMode, onCardClick, isItemSeen);
                if (filteredResults.length === 0 && currentAgeRatingFilter.length > 0) {
                    searchResultsContainer.innerHTML = `<p style="padding: 1rem; color: var(--text-secondary);">No items from your search for "${query}" matched the selected filter.</p>`;
                } else if (results.length === 0) {
                    searchResultsContainer.innerHTML = `<p style="padding: 1rem; color: var(--text-secondary);">No results found for "${query}".</p>`;
                }
                // Attach seen toggle listeners to newly displayed cards
                attachSeenToggleListenersToCards(searchResultsContainer);

            } catch (error) {
                console.error("Error performing search:", error);
                searchResultsContainer.innerHTML = `<p style="color: var(--text-secondary);">Error searching for content. Please try again. Error: ${error.message}</p>`;
            } finally {
                hideLoadingIndicator();
            }
        }
    }

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

    // Initial load: show Watch Now tab and populate its content
    switchTab('watch-now-tab');


    // --- Seen Items Logic (Firestore Integration) ---

    // Listener for real-time updates to seenItems
    let unsubscribeSeenItems = null; // To store the unsubscribe function

    onAuthChange((user) => { // This onAuthChange is from api.js
        // Unsubscribe from previous listener if exists
        if (unsubscribeSeenItems) {
            unsubscribeSeenItems();
            unsubscribeSeenItems = null;
        }

        if (user) {
            // Subscribe to seenItems collection for the current user
            // This is getUserCollection, not listenToUserCollection. Need to ensure correct one.
            // Correction: `listenToUserCollection` is the correct function for real-time.
            unsubscribeSeenItems = listenToUserCollection('seenItems', (items) => {
                localUserSeenItemsCache = items;
                console.log("Real-time Seen Items update:", localUserSeenItemsCache);
                // Only re-render the 'Seen' tab if it's currently active
                if (document.getElementById('seen-tab').classList.contains('active-tab')) {
                    populateCurrentTabContent();
                }
                // Also update any open item detail modal
                const modal = document.getElementById('item-detail-modal');
                if (modal.style.display === 'flex') {
                    const currentItemId = parseInt(modal.querySelector('#toggle-seen-btn')?.dataset.id);
                    const currentItemType = modal.querySelector('#toggle-seen-btn')?.dataset.type;
                    if (currentItemId && currentItemType) {
                        updateSeenButtonStateInModal(currentItemId, currentItemType, isItemSeen);
                    }
                }
                // Update seen icons on visible cards across all active tabs/rows
                document.querySelectorAll('.content-card').forEach(card => {
                    const itemId = parseInt(card.dataset.id);
                    const itemType = card.dataset.type;
                    const seenIcon = card.querySelector('.seen-toggle-icon');
                    if (seenIcon) {
                        const newSeenStatus = isItemSeen(itemId, itemType);
                        seenIcon.classList.toggle('item-is-seen', newSeenStatus);
                        seenIcon.title = newSeenStatus ? 'Mark as Unseen' : 'Mark as Seen';
                    }
                });
            });
        } else {
            localUserSeenItemsCache = []; // Clear cache if no user
        }
    });

    async function loadUserSeenItems() {
        // This function is still useful for initial load or if the listener is not yet active
        // But the real-time listener will keep localUserSeenItemsCache updated.
        // For now, we'll just ensure it fetches once if needed.
        const user = getCurrentUser(); // getCurrentUser is from api.js
        if (user && localUserSeenItemsCache.length === 0) { // Only fetch if not already populated by listener
             try {
                const items = await getUserCollection('seenItems'); // getUserCollection is from api.js
                localUserSeenItemsCache = items;
                console.log("Initial load: User seen items from Firestore:", localUserSeenItemsCache);
            } catch (error) {
                console.error("Error initial loading seen items from Firestore:", error);
                localUserSeenItemsCache = [];
            }
        } else if (!user) {
            localUserSeenItemsCache = [];
        }
    }

    function getSeenItems() { // Now uses the local cache populated from Firestore
        return localUserSeenItemsCache;
    }

    function isItemSeen(itemId, itemType) {
        const seenItems = getSeenItems();
        return seenItems.some(item => String(item.id) === String(itemId) && item.type === itemType);
    }

    async function toggleSeenStatus(itemDetails, itemType) {
        const user = getCurrentUser(); // getCurrentUser is from api.js
        if (!user) {
            showCustomAlert('Info', "Please sign in to mark items as seen.");
            return;
        }

        const itemId = itemDetails.id;
        const isCurrentlySeen = isItemSeen(itemId, itemType);

        try {
            showLoadingIndicator('Updating seen status...');
            if (isCurrentlySeen) { // Item is already seen, so remove it
                await deleteUserData('seenItems', String(itemId)); // deleteUserData is from api.js
                showCustomAlert('Success', `"${itemDetails.title || itemDetails.name}" marked as unseen.`);
            } else { // Item is not seen, so add it
                const seenItemData = {
                    type: itemType,
                    title: itemDetails.title || itemDetails.name,
                    poster_path: itemDetails.poster_path,
                    backdrop_path: itemDetails.backdrop_path, // Include for hero section
                    overview: itemDetails.overview,
                    release_date: itemDetails.release_date || itemDetails.first_air_date,
                    vote_average: itemDetails.vote_average,
                    addedAt: new Date() // Use client-side timestamp for now, Firestore handles serverTimestamp
                };
                await saveUserData('seenItems', String(itemId), seenItemData); // saveUserData is from api.js
                showCustomAlert('Success', `"${itemDetails.title || itemDetails.name}" marked as seen.`);
            }
            // The real-time listener will automatically update localUserSeenItemsCache
            // and trigger UI updates. No need for manual cache manipulation here.
        } catch (error) {
            console.error("Error toggling seen status in Firestore:", error);
            showCustomAlert('Error', `Error updating seen status: ${error.message}`);
        } finally {
            hideLoadingIndicator();
        }
    }

    // Expose toggleSeenStatus to be callable from the button in ui.js (modal)
    window.toggleSeenStatus = toggleSeenStatus;


    // --- Library Tab Functions (Firestore Watchlists) ---

    // Listener for real-time updates to watchlists
    let unsubscribeWatchlists = null; // To store the unsubscribe function

    onAuthChange((user) => { // This onAuthChange is from api.js
        // Unsubscribe from previous listener if exists
        if (unsubscribeWatchlists) {
            unsubscribeWatchlists();
            unsubscribeWatchlists = null;
        }

        if (user) {
            // Subscribe to watchlists collection for the current user
            unsubscribeWatchlists = listenToUserCollection('watchlists', (watchlists) => { // listenToUserCollection is from api.js
                firestoreWatchlistsCache = watchlists;
                console.log("Real-time Watchlists update:", firestoreWatchlistsCache);
                // Only re-render the 'Library' tab if it's currently active
                if (document.getElementById('library-tab').classList.contains('active-tab')) {
                    renderLibraryFolderCards(); // Re-render folder cards
                    renderMoviesInSelectedFolder(currentSelectedLibraryFolder); // Re-render movies in currently selected folder
                }
                 // If item detail modal is open, re-render its watchlist options
                const modal = document.getElementById('item-detail-modal');
                if (modal.style.display === 'flex') {
                    const currentItemData = modal.querySelector('#toggle-seen-btn')?.dataset;
                    if (currentItemData) {
                        renderWatchlistOptionsInModal({id: parseInt(currentItemData.id), media_type: currentItemData.type});
                    }
                }
            });
        } else {
            firestoreWatchlistsCache = []; // Clear cache if no user
        }
    });

    async function loadUserFirestoreWatchlists() {
        // Similar to seen items, this is for initial load if listener not active
        const user = getCurrentUser(); // getCurrentUser is from api.js
        if (user && firestoreWatchlistsCache.length === 0) {
            try {
                const watchlists = await getUserCollection('watchlists'); // getUserCollection is from api.js
                firestoreWatchlistsCache = watchlists.map(docData => ({
                    id: docData.id,
                    name: docData.name,
                    items: Array.isArray(docData.items) ? docData.items : [], // Ensure 'items' is an array
                    createdAt: docData.createdAt,
                    updatedAt: docData.updatedAt
                }));
                console.log("Initial load: Firestore watchlists:", firestoreWatchlistsCache);
            } catch (error) {
                console.error("Error initial loading Firestore watchlists:", error);
                firestoreWatchlistsCache = [];
            }
        } else if (!user) {
            firestoreWatchlistsCache = [];
        }
    }

    async function handleCreateLibraryFolder(folderName) {
        const user = getCurrentUser(); // getCurrentUser is from api.js
        if (!user) {
            showCustomAlert('Info', "Please sign in to create watchlists.");
            return;
        }
        const trimmedName = folderName.trim();
        if (!trimmedName) {
            showCustomAlert('Error', "Please enter a valid watchlist name.");
            return;
        }

        // Check if folder already exists in cache (optimistic check)
        if (firestoreWatchlistsCache.some(wl => wl.name === trimmedName)) {
            showCustomAlert('Info', `Watchlist "${trimmedName}" already exists.`);
            return;
        }

        try {
            showLoadingIndicator('Creating watchlist...');
            // Firestore auto-generates doc ID, so we don't need a specific docId here.
            // Firestore security rules for this collection will enforce user ownership.
            const newWatchlistData = {
                name: trimmedName,
                items: [] // Initialize with empty array
            };
            // Use addDoc to create a new document with an auto-generated ID
            // We use a simple ID generator here to ensure uniqueness while Firebase provides its own ID.
            // This is effectively `addDoc`, but using `setDoc` with a custom ID for consistency.
            await saveUserData('watchlists', `watchlist-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, newWatchlistData); // saveUserData is from api.js
            showCustomAlert('Success', `Watchlist "${trimmedName}" created successfully!`);
            // UI will update via the real-time listener
        } catch (error) {
            console.error("Error creating watchlist:", error);
            showCustomAlert('Error', `Failed to create watchlist: ${error.message}`);
        } finally {
            hideLoadingIndicator();
        }
    }

    async function handleDeleteLibraryFolder(folderId, folderName) {
        const user = getCurrentUser(); // getCurrentUser is from api.js
        if (!user) {
            showCustomAlert('Info', "Please sign in to delete watchlists.");
            return;
        }
        // Using window.confirm temporarily, ideally replace with custom modal
        const confirmDelete = window.confirm(`Are you sure you want to delete the watchlist "${folderName}" and all its items? This cannot be undone.`);
        if (!confirmDelete) {
            return;
        }

        try {
            showLoadingIndicator('Deleting watchlist...');
            await deleteUserData('watchlists', folderId); // deleteUserData is from api.js
            showCustomAlert('Success', `Watchlist "${folderName}" deleted successfully!`);
            if (currentSelectedLibraryFolder === folderId) {
                currentSelectedLibraryFolder = null; // Deselect if it was the one deleted
                renderMoviesInSelectedFolder(null); // Clear movie display
            }
            // UI will update via the real-time listener
        } catch (error) {
            console.error("Error deleting watchlist:", error);
            showCustomAlert('Error', `Failed to delete watchlist: ${error.message}`);
        } finally {
            hideLoadingIndicator();
        }
    }

    async function handleAddRemoveItemToFolder(folderId, itemDetails, itemType) {
        const user = getCurrentUser(); // getCurrentUser is from api.js
        if (!user) {
            showCustomAlert('Info', "Please sign in to add/remove items from watchlists.");
            return;
        }

        try {
            showLoadingIndicator('Updating watchlist...');
            const watchlist = firestoreWatchlistsCache.find(wl => wl.id === folderId);
            if (!watchlist) {
                showCustomAlert('Error', "Watchlist not found.");
                return;
            }

            const itemInFolderIndex = watchlist.items.findIndex(item => String(item.tmdb_id) === String(itemDetails.id) && item.item_type === itemType);

            let updatedItems;
            if (itemInFolderIndex > -1) {
                // Item exists, remove it
                updatedItems = watchlist.items.filter((_, index) => index !== itemInFolderIndex);
                showCustomAlert('Success', `"${itemDetails.title || itemDetails.name}" removed from "${watchlist.name}".`);
            } else {
                // Item does not exist, add it
                const itemData = {
                    tmdb_id: itemDetails.id,
                    item_type: itemType, // media_type can be 'movie' or 'tv'
                    title: itemDetails.title || itemDetails.name,
                    poster_path: itemDetails.poster_path, // Save the full URL or relative path if needed
                    addedAt: new Date()
                };
                updatedItems = [...watchlist.items, itemData];
                showCustomAlert('Success', `"${itemDetails.title || itemDetails.name}" added to "${watchlist.name}".`);
            }

            // Save the updated watchlist document back to Firestore
            await saveUserData('watchlists', folderId, { items: updatedItems }); // saveUserData is from api.js
            // The real-time listener will handle updating firestoreWatchlistsCache
            // and re-rendering the Library tab if active.
        } catch (error) {
            console.error("Error adding/removing item from folder:", error);
            showCustomAlert('Error', `Failed to update watchlist: ${error.message}`);
        } finally {
            hideLoadingIndicator();
        }
    }

    // Expose these functions globally so ui.js can call them back
    window.handleAddRemoveItemToFolder = handleAddRemoveItemToFolder;
    window.handleCreateLibraryFolder = handleCreateLibraryFolder;


    async function renderLibraryFolderCards() {
        if (!libraryFoldersRow) return;

        libraryFoldersRow.innerHTML = ''; // Clear previous

        // Create Watchlist UI (always present in library tab)
        const createContainer = document.createElement('div');
        createContainer.className = 'flex items-center gap-2 mr-6'; // Tailwind-like classes
        createContainer.innerHTML = `
            <input type="text" id="library-create-watchlist-input" placeholder="New Watchlist Name"
                style="padding: 0.5em 1em; border-radius: 8px; border: 1px solid var(--border-color, #333); font-size: 1em; background: var(--card-bg); color: var(--text-primary);">
            <button id="library-create-watchlist-btn"
                style="padding: 0.5em 1.2em; border-radius: 8px; border: none; background: var(--science-blue); color: white; font-weight: bold; cursor: pointer;">
                Create
            </button>
        `;
        libraryFoldersRow.appendChild(createContainer);

        const createInput = document.getElementById('library-create-watchlist-input');
        const createBtn = document.getElementById('library-create-watchlist-btn');

        if (createBtn) {
            createBtn.onclick = async () => {
                const name = createInput.value.trim();
                if (!name) {
                    showCustomAlert('Info', "Please enter a name for the new watchlist.");
                    return;
                }
                createBtn.disabled = true;
                try {
                    await handleCreateLibraryFolder(name);
                    createInput.value = '';
                } finally {
                    createBtn.disabled = false;
                }
            };
        }


        if (firestoreWatchlistsCache.length === 0) {
            libraryFoldersRow.innerHTML += `<p style="color:var(--text-secondary); padding: 1rem;">No watchlists yet. Create one above.</p>`;
            return;
        }

        firestoreWatchlistsCache.forEach(folder => {
            // Check if folder has items, and if the first item has a poster_path
            const firstItemPoster = folder.items && folder.items.length > 0 && folder.items[0].poster_path
                ? (folder.items[0].poster_path.startsWith('http') ? folder.items[0].poster_path : `https://image.tmdb.org/t/p/w200${folder.items[0].poster_path}`)
                : "https://placehold.co/150x225/374151/9CA3AF?text=Folder"; // Placeholder for empty or no-poster folders

            const card = document.createElement('div');
            card.className = 'content-card folder-card';
            card.style.position = 'relative';
            card.style.display = 'inline-block';
            card.style.marginRight = '1rem';
            card.style.marginBottom = '1rem';
            card.style.width = '10rem';
            card.dataset.folderId = folder.id; // Use Firestore document ID
            card.dataset.folderName = folder.name; // Use folder name for display

            card.innerHTML = `
                <img src="${firstItemPoster}" style="width:100%; height:14rem; object-fit: cover; border-radius:0.5rem; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
                <p style="text-align:center; margin-top:0.5rem; font-size:0.9em; font-weight:500; color:var(--text-secondary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${folder.name} (${folder.items.length})</p>
            `;

            // Add delete button
            const deleteBtn = document.createElement('button');
            deleteBtn.innerHTML = '🗑';
            deleteBtn.title = 'Delete Watchlist';
            deleteBtn.style.position = 'absolute';
            deleteBtn.style.top = '5px';
            deleteBtn.style.right = '5px';
            deleteBtn.style.background = 'rgba(0,0,0,0.4)';
            deleteBtn.style.color = 'white';
            deleteBtn.style.border = 'none';
            deleteBtn.style.borderRadius = '50%';
            deleteBtn.style.width = '24px';
            deleteBtn.style.height = '24px';
            deleteBtn.style.fontSize = '14px';
            deleteBtn.style.cursor = 'pointer';
            deleteBtn.onclick = async (e) => {
                e.stopPropagation();
                await handleDeleteLibraryFolder(folder.id, folder.name);
            };
            card.appendChild(deleteBtn);

            card.addEventListener('click', (e) => {
                if (e.target === deleteBtn) return;
                currentSelectedLibraryFolder = folder.id; // Use ID for selection
                renderMoviesInSelectedFolder(folder.id);
                libraryFoldersRow.querySelectorAll('.folder-card').forEach(fc => {
                    fc.style.border = '2px solid transparent';
                    fc.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
                });
                card.style.border = `2px solid var(--science-blue)`;
                card.style.boxShadow = `0 0 0 2px var(--science-blue), 0 4px 6px -1px rgba(0, 0, 0, 0.1)`; // Add blue ring
            });

            libraryFoldersRow.appendChild(card);
        });

        // Re-apply selection highlight if a folder is selected
        if (currentSelectedLibraryFolder) {
            const selectedCard = libraryFoldersRow.querySelector(`.folder-card[data-folder-id="${currentSelectedLibraryFolder}"]`);
            if (selectedCard) {
                selectedCard.style.border = `2px solid var(--science-blue)`;
                selectedCard.style.boxShadow = `0 0 0 2px var(--science-blue), 0 4px 6px -1px rgba(0, 0, 0, 0.1)`;
            }
        }
    }

    async function renderMoviesInSelectedFolder(folderId) {
        if (!selectedFolderTitleElement || !librarySelectedFolderMoviesRow) return;

        const onLibraryMovieCardClick = async (id, type) => {
            try {
                showLoadingIndicator('Fetching item details...');
                const details = await fetchItemDetails(id, type);
                displayItemDetails(details, type, isLightMode);
                // After modal is displayed, update the seen button and watchlist options
                updateSeenButtonStateInModal(details.id, type, isItemSeen);
                renderWatchlistOptionsInModal(details);
            } catch (error) {
                console.error("Error fetching library item details for modal:", error);
                showCustomAlert('Error', `Error loading details: ${error.message}`);
            } finally {
                hideLoadingIndicator();
            }
        };

        if (!folderId) {
            selectedFolderTitleElement.textContent = 'Items in Folder';
            librarySelectedFolderMoviesRow.innerHTML = `<p style="color:var(--text-secondary); padding: 1rem;">Select a watchlist above to see its contents.</p>`;
            return;
        }

        const selectedWatchlist = firestoreWatchlistsCache.find(wl => wl.id === folderId);
        if (!selectedWatchlist) {
            selectedFolderTitleElement.textContent = 'Items in Folder';
            librarySelectedFolderMoviesRow.innerHTML = `<p style="color:var(--text-secondary); padding: 1rem;">Watchlist not found or has been deleted.</p>`;
            currentSelectedLibraryFolder = null; // Clear selection
            return;
        }

        selectedFolderTitleElement.textContent = `Items in "${selectedWatchlist.name}"`;
        const items = selectedWatchlist.items;

        if (items.length === 0) {
            librarySelectedFolderMoviesRow.innerHTML = `<p style="color:var(--text-secondary); padding: 1rem;">This watchlist is empty.</p>`;
        } else {
            librarySelectedFolderMoviesRow.innerHTML = ''; // Clear previous movies
            items.forEach(item => {
                // Ensure item has 'media_type' for createContentCardHtml
                const displayItem = {
                    id: item.tmdb_id, // Ensure we use tmdb_id for the card's data-id
                    media_type: item.item_type,
                    title: item.title,
                    poster_path: item.poster_path
                };
                const cardHtmlString = createContentCardHtml(displayItem, isLightMode, isItemSeen);
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = cardHtmlString;
                const movieCardElement = tempDiv.firstElementChild;

                // Attach click listener for item details
                movieCardElement.addEventListener('click', () => onLibraryMovieCardClick(item.tmdb_id, item.item_type));

                // Add "Remove from Folder" button
                const removeBtn = document.createElement('button');
                removeBtn.innerHTML = '🗑'; // Trashcan icon for remove
                removeBtn.title = 'Remove from Watchlist';
                removeBtn.style.position = 'absolute';
                removeBtn.style.bottom = '5px';
                removeBtn.style.right = '5px';
                removeBtn.style.background = 'rgba(255, 0, 0, 0.6)'; // Red background
                removeBtn.style.color = 'white';
                removeBtn.style.border = 'none';
                removeBtn.style.borderRadius = '50%';
                removeBtn.style.width = '24px';
                removeBtn.style.height = '24px';
                removeBtn.style.fontSize = '14px';
                removeBtn.style.cursor = 'pointer';
                removeBtn.style.zIndex = '10'; // Ensure it's above other elements
                removeBtn.onclick = async (e) => {
                    e.stopPropagation(); // Prevent card click
                    await handleAddRemoveItemToFolder(folderId, displayItem, item.item_type); // Use same function to remove
                };
                movieCardElement.querySelector('.image-container').appendChild(removeBtn); // Add to image container

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
        if (loadingIndicator) loadingIndicator.style.display = 'block';

        try {
            console.log(`[Explore] Fetching page ${exploreCurrentPage} with API filters: []`);
            const items = await fetchDiscoveredItems('movie', [], exploreCurrentPage);
            console.log("[Explore] Fetched items from API:", items);

            if (items.length > 0) {
                const exploreGrid = document.getElementById('explore-grid-container');
                // Apply client-side filter before appending
                const itemsToDisplay = currentAgeRatingFilter.length > 0
                    ? items.filter(item => {
                        const cert = getCertification(item);
                        return currentAgeRatingFilter.some(filterCategory => checkRatingCompatibility(cert, filterCategory));
                    })
                    : items;
                console.log("[Explore] Items after client-side filtering (if any):", itemsToDisplay);

                appendItemsToGrid(exploreGrid, itemsToDisplay, isLightMode, onCardClick, isItemSeen);
                exploreCurrentPage++;
                if (items.length < 20) { // Assuming TMDB returns 20 items per page by default
                    exploreHasMore = false;
                }
            } else {
                exploreHasMore = false; // No more items to load
                console.log("[Explore] No more items to load from API.");
            }
        } catch (error) {
            console.error("Error loading more explore items:", error);
            showCustomAlert('Error', `Failed to load more content for Explore: ${error.message}`);
        } finally {
            hideLoadingIndicator();
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

    // Attach event listener for the dynamically added "Toggle Seen" button and Watchlist options in the modal
    // Use event delegation on a static parent (itemDetailModal)
    document.getElementById('item-detail-modal').addEventListener('click', async (event) => {
        if (event.target.id === 'toggle-seen-btn') {
            const itemId = parseInt(event.target.dataset.id);
            const itemType = event.target.dataset.type;
            const details = await fetchItemDetails(itemId, itemType); // Fetch details to pass to toggleSeenStatus
            toggleSeenStatus(details, itemType);
        }
        // These are handled by specific functions in ui.js which now call window.handleAddRemoveItemToFolder
        // else if (event.target.classList.contains('add-to-watchlist-btn')) { // This specific class might not exist anymore
        //     const folderId = event.target.dataset.folderId;
        //     const itemId = parseInt(event.target.dataset.id);
        //     const itemType = event.target.dataset.type;

        //     // Get the item details from the currently open modal
        //     const modalContentArea = document.getElementById('modal-content-area');
        //     const title = modalContentArea.querySelector('h2').textContent;
        //     const posterPath = modalContentArea.querySelector('.details-grid .poster').src; // Get the full URL

        //     const itemDetails = {
        //         id: itemId,
        //         type: itemType, // This needs to be media_type for TMDB or custom 'type'
        //         title: title,
        //         poster_path: posterPath // Save the full URL or relative path if needed
        //     };
        //     await handleAddRemoveItemToFolder(folderId, itemDetails, itemType);
        //     // After adding/removing, re-render the watchlists in the modal to update checkmarks
        //     renderWatchlistOptionsInModal(itemDetails); // Call a function to re-render options in modal
        // }
    });

});
