// js/watchlist.js 
import { db, firebaseFirestoreFunctions, auth } from './firebase.js';
import { showToast, showLoading, showMessage, clearAllDynamicContent, createBackButton, positionPopup } from './ui.js';
import { smallImageBaseUrl, tileThumbnailPlaceholder } from './config.js';
import {
    currentUserId, currentSelectedWatchlistName, currentSelectedItemDetails,
    updateCurrentSelectedWatchlistName, selectedCertifications
} from './state.js';
import { extractCertification } from './ratingUtils.js';
import { handleItemSelect } from './handlers.js'; // For item click
import { appendSeenCheckmark } from './seenList.js'; // For displaying seen status on watchlist items

// DOM Elements
let watchlistTilesContainer, watchlistDisplayContainer, watchlistView,
    newWatchlistNameInput, createWatchlistBtn; // From main.js

export function initWatchlistRefs(elements) {
    watchlistTilesContainer = elements.watchlistTilesContainer;
    watchlistDisplayContainer = elements.watchlistDisplayContainer;
    watchlistView = elements.watchlistView;
    newWatchlistNameInput = elements.newWatchlistNameInput;
    createWatchlistBtn = elements.createWatchlistBtn;
}

const { getDocs, collection, doc, setDoc, deleteDoc, updateDoc, arrayUnion, arrayRemove, getDoc } = firebaseFirestoreFunctions;

// Use the global cache from main.js
function getCachedWatchlists() {
    return window.firestoreWatchlistsCache || [];
}

// --- Replace Firestore queries with cache where possible ---

export function displayWatchlistSelection() {
    if (!watchlistTilesContainer) return;
    watchlistTilesContainer.innerHTML = '';
    if (!currentUserId) {
        watchlistTilesContainer.innerHTML = '<p class="text-xs text-gray-400 col-span-full w-full text-center">Sign in to manage watchlists.</p>';
        return;
    }

    const firestoreWatchlists = getCachedWatchlists();

    if (firestoreWatchlists.length === 0) {
        watchlistTilesContainer.innerHTML = '<p class="text-xs text-gray-400 col-span-full w-full text-center">No watchlists created yet.</p>';
    } else {
        firestoreWatchlists.forEach(watchlistDoc => {
            const name = watchlistDoc.id;
            const tile = document.createElement('div');
            tile.className = 'watchlist-tile';
            tile.dataset.watchlistName = name;

            const itemsInWatchlist = watchlistDoc.items || [];
            let thumbnailUrl = tileThumbnailPlaceholder;
            if (itemsInWatchlist.length > 0 && itemsInWatchlist[0].poster_path) {
                thumbnailUrl = `${smallImageBaseUrl}${itemsInWatchlist[0].poster_path}`;
            }

            const tileNameSpan = document.createElement('span');
            tileNameSpan.className = 'watchlist-tile-name';
            tileNameSpan.title = name;
            tileNameSpan.textContent = name;

            const optionsButton = document.createElement('button');
            optionsButton.className = 'watchlist-tile-options-btn';
            optionsButton.innerHTML = '&#x22EE;';
            optionsButton.title = `Options for ${name}`;

            optionsButton.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleOptionsMenu(tile, name);
            });

            tile.innerHTML = ` <img src="${thumbnailUrl}" alt="${name} thumbnail" onerror="this.src='${tileThumbnailPlaceholder}'; this.onerror=null;"> `;
            tile.appendChild(tileNameSpan);
            tile.appendChild(optionsButton);

            if (name === currentSelectedWatchlistName) {
                tile.classList.add('selected-watchlist-tile');
            }

            tile.addEventListener('click', async (e) => {
                if (e.target.closest('.watchlist-tile-options-btn') || e.target.closest('.options-menu')) {
                    return;
                }
                closeAllOptionMenus();
                if (watchlistTilesContainer) { // Check if container exists
                    watchlistTilesContainer.querySelectorAll('.watchlist-tile').forEach(t => t.classList.remove('selected-watchlist-tile'));
                }
                tile.classList.add('selected-watchlist-tile');
                updateCurrentSelectedWatchlistName(name);
                if (currentUserId) localStorage.setItem(`mediaFinderLastSelectedWatchlist_${currentUserId}`, name);
                await displayItemsInSelectedWatchlist();
                if (currentSelectedItemDetails) {
                    const activeBtnContainerId = determineActiveWatchlistButtonContainerId();
                    updateAddToWatchlistButtonState(currentSelectedItemDetails.tmdb_id, currentSelectedItemDetails, activeBtnContainerId);
                }
                clearAllDynamicContent('watchlist');
            });
  watchlistTilesContainer.appendChild(tile);
       });
   }
}

// --- Use cache for item checks ---
export function isItemInSpecificFirestoreWatchlist(watchlistName, itemId) {
    const watchlist = getCachedWatchlists().find(wl => wl.id === watchlistName);
    if (!watchlist) return false;
    return (watchlist.items || []).some(item => String(item.tmdb_id) === String(itemId));
}

export function isItemInAnyFirestoreWatchlist(itemId) {
    return getCachedWatchlists().some(wl =>
        (wl.items || []).some(item => String(item.tmdb_id) === String(itemId))
    );
}

// --- Use cache for displaying items ---
export function displayItemsInSelectedWatchlist() {
    if (!watchlistDisplayContainer) return;
    watchlistDisplayContainer.innerHTML = '';
    if (!currentUserId) {
        watchlistDisplayContainer.innerHTML = '<p class="text-gray-500 italic col-span-full text-center">Please sign in to view watchlist items.</p>';
        return;
    }
    if (!currentSelectedWatchlistName) {
        watchlistDisplayContainer.innerHTML = '<p class="text-gray-500 italic col-span-full text-center">Select a watchlist or create one.</p>';
        return;
    }
    const watchlist = getCachedWatchlists().find(wl => wl.id === currentSelectedWatchlistName);
    if (!watchlist) {
        watchlistDisplayContainer.innerHTML = `<p class="text-gray-500 italic col-span-full text-center">Watchlist "${currentSelectedWatchlistName}" not found.</p>`;
        return;
    }
    let items = watchlist.items || [];
    if (!selectedCertifications.includes('All')) {
        items = items.filter(it => selectedCertifications.includes(it.certification || 'NR'));
    }
    if (items.length === 0) {
        watchlistDisplayContainer.innerHTML = `<p class="text-gray-500 italic col-span-full text-center">Watchlist "${currentSelectedWatchlistName}" is empty.</p>`;
    } else {
        items.forEach(item => {
            watchlistDisplayContainer.appendChild(createWatchlistItemCard(item));
        });
    }
}

// --- After any mutation, refresh the cache ---
export async function addItemToSpecificFirestoreWatchlist(watchlistName, itemData) {
    if (!currentUserId) { showToast("Please sign in to add items.", "error"); return false; }
    if (!watchlistName) { showToast("Watchlist name not specified.", "error"); return false; }
    if (!itemData || !itemData.tmdb_id) { showToast("Cannot add item: Invalid item data.", "error"); return false; }

    const itemToAdd = {
        tmdb_id: String(itemData.tmdb_id),
        title: itemData.title || itemData.name,
        item_type: itemData.item_type,
        poster_path: itemData.poster_path || null,
        release_year: (itemData.release_date || itemData.first_air_date || '').substring(0, 4),
        vote_average: itemData.vote_average || null,
        certification: extractCertification(itemData)
    };
    try {
        const watchlistRef = doc(db, "users", currentUserId, "watchlists", watchlistName);
        await updateDoc(watchlistRef, { items: arrayUnion(itemToAdd) });
        await window.loadUserFirestoreWatchlists(); // Refresh cache after mutation
        showToast(`"${itemToAdd.title}" added to ${watchlistName}.`, "success");
        if (currentSelectedWatchlistName === watchlistName && watchlistView && !watchlistView.classList.contains('hidden-view')) {
            await displayItemsInSelectedWatchlist();
        }
        await loadAndDisplayWatchlistsFromFirestore();
        return true;
    } catch (error) {
        console.error(`Error adding item to ${watchlistName}: `, error);
        showToast(`Failed to add item to ${watchlistName}.`, "error");
        return false;
    }
}

export async function removeItemFromSpecificFirestoreWatchlist(watchlistName, itemIdToRemove) {
    if (!currentUserId) { showToast("Please sign in to remove items.", "error"); return false; }
    if (!watchlistName) { showToast("Watchlist name not specified.", "error"); return false; }
    try {
        const watchlistRef = doc(db, "users", currentUserId, "watchlists", watchlistName);
        const docSnap = await getDoc(watchlistRef);
        let itemTitleForToast = "Item";

        if (docSnap.exists()) {
            const currentItems = docSnap.data().items || [];
            const itemToRemoveObject = currentItems.find(item => String(item.tmdb_id) === String(itemIdToRemove));
            if (itemToRemoveObject) {
                itemTitleForToast = itemToRemoveObject.title;
                await updateDoc(watchlistRef, { items: arrayRemove(itemToRemoveObject) });
                await window.loadUserFirestoreWatchlists(); // Refresh cache after mutation
                showToast(`"${itemTitleForToast}" removed from ${watchlistName}.`, "info");
                if (currentSelectedWatchlistName === watchlistName && watchlistView && !watchlistView.classList.contains('hidden-view')) {
                    await displayItemsInSelectedWatchlist();
                }
                await loadAndDisplayWatchlistsFromFirestore();
                return true;
            } else {
                console.log("Item not found in watchlist for removal:", itemIdToRemove, "from", watchlistName);
                return false;
            }
        }
        return false;
    } catch (error) {
        console.error(`Error removing item from ${watchlistName}: `, error);
        showToast(`Failed to remove item from ${watchlistName}.`, "error");
        return false;
    }
}

export async function handleDeleteWatchlist(watchlistName) {
    if (!currentUserId) { showToast("You must be signed in to delete a watchlist.", "error"); return; }
    if (!watchlistName) { console.error("[handleDeleteWatchlist] Called with no name."); return; }

    try {
        await deleteDoc(doc(db, "users", currentUserId, "watchlists", watchlistName));
        await window.loadUserFirestoreWatchlists(); // Refresh cache after mutation

        if (currentSelectedWatchlistName === watchlistName) {
            updateCurrentSelectedWatchlistName(null);
            localStorage.removeItem(`mediaFinderLastSelectedWatchlist_${currentUserId}`);
        }

        await loadAndDisplayWatchlistsFromFirestore();
        showToast(`Watchlist "${watchlistName}" deleted.`, "info");

        if (currentSelectedItemDetails) {
            const activeBtnContainerId = determineActiveWatchlistButtonContainerId();
            updateAddToWatchlistButtonState(currentSelectedItemDetails.tmdb_id, currentSelectedItemDetails, activeBtnContainerId);
        }
    } catch (error) { console.error("Error deleting watchlist: ", error); showToast("Failed to delete watchlist. Check console.", "error"); }
}


export async function handleCreateWatchlist() {
    if (!currentUserId) { showToast("You must be signed in to create a watchlist.", "error"); return; }
    if (!newWatchlistNameInput) { console.error("newWatchlistNameInput not found"); return; }
    const name = newWatchlistNameInput.value.trim();
    if (!name) { showToast("Please enter a name for the new watchlist.", "error"); return; }
    try {
        const watchlistRef = doc(db, "users", currentUserId, "watchlists", name);
        const docSnap = await getDoc(watchlistRef);
        if (docSnap.exists()) { showToast(`Watchlist "${name}" already exists.`, "error"); return; }
        await setDoc(watchlistRef, { name: name, items: [], createdAt: new Date().toISOString(), uid: currentUserId });
        await window.loadUserFirestoreWatchlists(); // Refresh cache after mutation
        await loadAndDisplayWatchlistsFromFirestore();
        newWatchlistNameInput.value = '';
        showToast(`Watchlist "${name}" created.`, "success");
    } catch (error) { console.error("Error creating watchlist: ", error); showToast("Failed to create watchlist. Check console.", "error"); }
}

export function toggleOptionsMenu(tileElement, watchlistName) {
    closeAllOptionMenus(tileElement);
    let menu = tileElement.querySelector('.options-menu');
    if (!menu) {
        menu = document.createElement('div');
        menu.className = 'options-menu';
        menu.innerHTML = `
            <div class="option-item" data-action="rename">Rename</div>
            <div class="option-item" data-action="delete">Delete</div>
        `;
        tileElement.appendChild(menu);

        menu.addEventListener('click', async (e) => {
            const action = e.target.dataset.action;
            if (action === 'rename') {
                await handleRenameWatchlist(watchlistName);
            } else if (action === 'delete') {
                const confirmed = confirm(`Are you sure you want to delete the watchlist "${watchlistName}"?`);
                if (confirmed) {
                    await handleDeleteWatchlist(watchlistName);
                }
            }
        });
    }
    menu.classList.toggle('visible');
}

export function closeAllOptionMenus(exceptTile) {
    document.querySelectorAll('.watchlist-tile').forEach(tile => {
        if (tile !== exceptTile) {
            const menu = tile.querySelector('.options-menu');
            if (menu) menu.classList.remove('visible');
        }
    });
}

// Expose for Library tab
window.handleCreateWatchlistFromLibrary = async function(name) {
    if (!window.currentUserId) {
        alert("You must be signed in to create a watchlist.");
        return;
    }
    const { doc, getDoc, setDoc } = firebaseFirestoreFunctions;
    const watchlistRef = doc(db, "users", window.currentUserId, "watchlists", name);
    const docSnap = await getDoc(watchlistRef);
    if (docSnap.exists()) {
        alert(`Watchlist "${name}" already exists.`);
        return;
    }
    await setDoc(watchlistRef, { name, items: [], createdAt: new Date().toISOString(), uid: window.currentUserId });
    await window.loadUserFirestoreWatchlists();
    if (window.renderLibraryFolderCards) await window.renderLibraryFolderCards();
    alert(`Watchlist "${name}" created.`);
};

window.handleDeleteWatchlist = handleDeleteWatchlist;