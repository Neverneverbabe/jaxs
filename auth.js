// js/auth.js 
import { auth, firebaseAuthFunctions } from './firebase.js';
import { showToast } from './ui.js';
import {
    updateCurrentUserId, currentUserId,
    updateCurrentSelectedWatchlistName,
    currentSelectedItemDetails // For updating button states on auth change
} from './state.js';
import { loadAndDisplayWatchlistsFromFirestore, updateAddToWatchlistButtonState, determineActiveWatchlistButtonContainerId } from './watchlist.js'; // For UI updates on auth change
import { loadAndDisplaySeenItems, updateMarkAsSeenButtonState, determineActiveSeenButtonContainerId } from './seenList.js'; // For UI updates on auth change

// DOM Elements - these will be initialized in main.js and passed or imported
let authDropdownMenu, newWatchlistNameInput, createWatchlistBtn,
    watchlistTilesContainer, watchlistDisplayContainer, seenItemsDisplayContainer;

export function initAuthRefs(elements) {
    authDropdownMenu = elements.authDropdownMenu;
    newWatchlistNameInput = elements.newWatchlistNameInput;
    createWatchlistBtn = elements.createWatchlistBtn;
    watchlistTilesContainer = elements.watchlistTilesContainer;
    watchlistDisplayContainer = elements.watchlistDisplayContainer;
    seenItemsDisplayContainer = elements.seenItemsDisplayContainer;
}

export function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

export function createAuthFormUI(parentElement, onSuccessCallback) {
    if (!parentElement) return;
    parentElement.innerHTML = ''; // Clear previous content

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
            await firebaseAuthFunctions.signInWithEmailAndPassword(auth, email, password);
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
            await firebaseAuthFunctions.createUserWithEmailAndPassword(auth, email, password);
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
    authDropdownMenu.innerHTML = ''; // Clear it once at the beginning

    if (user) {
        // Logged-in UI
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
                const oldUserId = currentUserId; // Get user ID before sign out
                await firebaseAuthFunctions.signOut(auth);
                localStorage.removeItem(`mediaFinderLastSelectedWatchlist_${oldUserId}`); // Clear last selected for this user
                showToast("Signed out successfully.", "info");
                if (authDropdownMenu) authDropdownMenu.classList.add('hidden');
            } catch (error) {
                showToast(`Sign out error: ${error.message}`, "error");
            }
        });
        authDropdownMenu.appendChild(signOutDropdownButton);
    } else {
        // Logged-out UI: Use the new helper function
        createAuthFormUI(authDropdownMenu, () => {
            // On success from main dropdown, just close it.
            // onAuthStateChanged will handle updating the UI.
            if (authDropdownMenu) authDropdownMenu.classList.add('hidden');
        });
    }
}

export async function handleAuthStateChanged(user, elements) {
    // elements is an object containing all necessary DOM element references
    // This is an example of how to pass dependencies if not importing them directly
    // For this refactor, we'll assume elements needed are initialized via initAuthRefs or globally accessible for now

    updateAuthDropdownUI(user);
    if (user) {
        updateCurrentUserId(user.uid);
        if (newWatchlistNameInput) newWatchlistNameInput.disabled = false;
        if (createWatchlistBtn) createWatchlistBtn.disabled = false;

        const seenView = document.getElementById('seenView'); // Get elements as needed
        if (seenView && !seenView.classList.contains('hidden-view')) {
            await loadAndDisplaySeenItems(currentUserId, elements.seenItemsDisplayContainer, elements.messageArea);
        }
        await loadAndDisplayWatchlistsFromFirestore(); // Assumes it can get its needed refs

        if (currentSelectedItemDetails) {
            const activeBtnContainerId = determineActiveWatchlistButtonContainerId(); // Assumes it can get its needed refs
            updateAddToWatchlistButtonState(currentSelectedItemDetails.tmdb_id, currentSelectedItemDetails, activeBtnContainerId);
            const activeSeenBtnContainerId = determineActiveSeenButtonContainerId(); // Assumes it can get its needed refs
            updateMarkAsSeenButtonState(currentSelectedItemDetails.tmdb_id, currentSelectedItemDetails, activeSeenBtnContainerId);
        }
    } else {
        // localStorage.removeItem(`mediaFinderLastSelectedWatchlist_${currentUserId}`); // This was moved to signout
        updateCurrentUserId(null);
        updateCurrentSelectedWatchlistName(null);

        if (watchlistTilesContainer) watchlistTilesContainer.innerHTML = '<p class="text-xs text-gray-400 col-span-full w-full text-center">Sign in to see your watchlists.</p>';
        if (watchlistDisplayContainer) watchlistDisplayContainer.innerHTML = '<p class="text-gray-500 italic col-span-full text-center">Sign in to manage your watchlists.</p>';
        if (seenItemsDisplayContainer) seenItemsDisplayContainer.innerHTML = '<p class="text-gray-500 italic col-span-full text-center">Sign in to see your seen items.</p>';

        // clearAllDynamicContent('watchlist'); // This might be too broad, handle specific watchlist UI reset
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
