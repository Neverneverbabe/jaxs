// SignIn/auth.js
import { auth } from './firebase.js'; // Firebase auth instance
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, updateProfile } from './firebase_api.js'; // Direct Firebase API calls
import { showToast } from '../Website/ui.js'; // Example: Path might need adjustment depending on Website/App UI structure
import { updateCurrentUserId, currentUserId, updateCurrentSelectedWatchlistName } from '../Website/state.js'; // Example: path might need adjustment
import { loadAndDisplayWatchlistsFromFirestore, updateAddToWatchlistButtonState, determineActiveWatchlistButtonContainerId } from '../Website/watchlist.js'; // Example: path might need adjustment
import { loadAndDisplaySeenItems, updateMarkAsSeenButtonState, determineActiveSeenButtonContainerId } from '../Website/seenList.js'; // Example: path might need adjustment

// DOM Elements (initialized in main.js and passed or imported from each app/website's context)
let authDropdownMenu, newWatchlistNameInput, createWatchlistBtn,
    watchlistTilesContainer, watchlistDisplayContainer, seenItemsDisplayContainer;
let currentSelectedItemDetails; // This needs to be passed or accessed from calling context

export function initAuthRefs(elements, itemDetailsRef) {
    authDropdownMenu = elements.authDropdownMenu;
    newWatchlistNameInput = elements.newWatchlistNameInput;
    createWatchlistBtn = elements.createWatchlistBtn;
    watchlistTilesContainer = elements.watchlistTilesContainer;
    watchlistDisplayContainer = elements.watchlistDisplayContainer;
    seenItemsDisplayContainer = elements.seenItemsDisplayContainer;
    currentSelectedItemDetails = itemDetailsRef; // Reference to the currentSelectedItemDetails from state.js
}

export function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

export function createAuthFormUI(parentElement, onSuccessCallback) {
    if (!parentElement) return;
    parentElement.innerHTML = '';

    const instructionText = document.createElement('p');
    instructionText.className = 'text-sm text-gray-300 mb-3';
    instructionText.textContent = 'Sign in or sign up to manage watchlists:';
    parentElement.appendChild(instructionText);

    const emailField = document.createElement('input');
    emailField.type = 'email';
    emailField.placeholder = 'Email';
    emailField.className = 'auth-dropdown-input w-full mb-2';
    parentElement.appendChild(emailField);

    const passwordField = document.createElement('input');
    passwordField.type = 'password';
    passwordField.placeholder = 'Password';
    passwordField.className = 'auth-dropdown-input w-full mb-3';
    parentElement.appendChild(passwordField);

    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'flex justify-between gap-2';

    const signInButton = document.createElement('button');
    signInButton.textContent = 'Sign In';
    signInButton.className = 'auth-dropdown-button flex-grow';
    signInButton.onclick = async () => {
        const email = emailField.value;
        const password = passwordField.value;
        if (!email || !password) { showToast("Email and password required.", "error"); return; }
        if (!isValidEmail(email)) { showToast("Invalid email format.", "error"); return; }
        try {
            await signInWithEmailAndPassword(auth, email, password); // Use shared API
            showToast("Signed in!", "success");
            if (onSuccessCallback) onSuccessCallback();
        } catch (error) {
            showToast(`Sign in error: ${error.message}`, "error");
        }
    };
    buttonContainer.appendChild(signInButton);

    const signUpButton = document.createElement('button');
    signUpButton.textContent = 'Sign Up';
    signUpButton.className = 'auth-dropdown-button flex-grow';
    signUpButton.onclick = async () => {
        const email = emailField.value;
        const password = passwordField.value;
        if (!email || !password) { showToast("Email and password required.", "error"); return; }
        if (!isValidEmail(email)) { showToast("Invalid email format.", "error"); return; }
        try {
            await createUserWithEmailAndPassword(auth, email, password); // Use shared API
            showToast("Signed up! You are now logged in.", "success");
            if (onSuccessCallback) onSuccessCallback();
        } catch (error) {
            showToast(`Sign up error: ${error.message}`, "error");
        }
    };
    buttonContainer.appendChild(signUpButton);
    parentElement.appendChild(buttonContainer);
}

export function updateAuthDropdownUI(user) {
    if (!authDropdownMenu) return;
    authDropdownMenu.innerHTML = '';

    if (user) {
        const userInfo = document.createElement('div');
        userInfo.className = 'auth-dropdown-status';
        userInfo.textContent = `Logged in as: ${user.email}`;
        authDropdownMenu.appendChild(userInfo);
        const signOutDropdownButton = document.createElement('button');
        signOutDropdownButton.id = 'signOutDropdownButton';
        signOutDropdownButton.className = 'auth-dropdown-button bg-red-600 hover:bg-red-700 w-full mt-2';
        signOutDropdownButton.textContent = 'Sign Out';
        signOutDropdownButton.addEventListener('click', async () => {
            try {
                const oldUserId = currentUserId;
                await signOut(auth); // Use shared API
                localStorage.removeItem(`mediaFinderLastSelectedWatchlist_${oldUserId}`);
                showToast("Signed out successfully.", "info");
                if (authDropdownMenu) authDropdownMenu.classList.add('hidden');
            } catch (error) {
                showToast(`Sign out error: ${error.message}`, "error");
            }
        });
        authDropdownMenu.appendChild(signOutDropdownButton);
    } else {
        createAuthFormUI(authDropdownMenu, () => {
            if (authDropdownMenu) authDropdownMenu.classList.add('hidden');
        });
    }
}

export async function handleAuthStateChanged(user, elements) {
    updateAuthDropdownUI(user);
    if (user) {
        updateCurrentUserId(user.uid);
        if (newWatchlistNameInput) newWatchlistNameInput.disabled = false;
        if (createWatchlistBtn) createWatchlistBtn.disabled = false;

        const seenView = document.getElementById('seenView');
        if (seenView && !seenView.classList.contains('hidden-view')) {
            await loadAndDisplaySeenItems(); // seenList needs `elements.seenItemsDisplayContainer`, etc.
        }
        await loadAndDisplayWatchlistsFromFirestore(); // watchlist needs its own elements

        if (currentSelectedItemDetails) {
            const activeBtnContainerId = determineActiveWatchlistButtonContainerId();
            updateAddToWatchlistButtonState(currentSelectedItemDetails.tmdb_id, currentSelectedItemDetails, activeBtnContainerId);
            const activeSeenBtnContainerId = determineActiveSeenButtonContainerId();
            updateMarkAsSeenButtonState(currentSelectedItemDetails.tmdb_id, currentSelectedItemDetails, activeSeenBtnContainerId);
        }
    } else {
        updateCurrentUserId(null);
        updateCurrentSelectedWatchlistName(null);

        if (watchlistTilesContainer) watchlistTilesContainer.innerHTML = '<p class="text-xs text-gray-400 col-span-full w-full text-center">Sign in to see your watchlists.</p>';
        if (watchlistDisplayContainer) watchlistDisplayContainer.innerHTML = '<p class="text-gray-500 italic col-span-full text-center">Sign in to manage your watchlists.</p>';
        if (seenItemsDisplayContainer) seenItemsDisplayContainer.innerHTML = '<p class="text-gray-500 italic col-span-full text-center">Sign in to see your seen items.</p>';

        if (newWatchlistNameInput) newWatchlistNameInput.disabled = true;
        if (createWatchlistBtn) createWatchlistBtn.disabled = true;

        if (currentSelectedItemDetails) {
            const activeBtnContainerId = determineActiveWatchlistButtonContainerId();
            updateAddToWatchlistButtonState(currentSelectedItemDetails.tmdb_id, currentSelectedItemDetails, activeBtnContainerId);
            const activeSeenBtnContainerId = determineActiveSeenButtonContainerId();
            updateMarkAsSeenButtonState(currentSelectedItemDetails.tmdb_id, currentSelectedItemDetails, activeSeenBtnContainerId);
        }
    }
}