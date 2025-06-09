// js/watchlist.js 
import { db, firebaseFirestoreFunctions, auth } from './firebase.js';
import { showToast, showLoading, showMessage, clearAllDynamicContent, createBackButton, positionPopup } from './ui.js';
import { smallImageBaseUrl, tileThumbnailPlaceholder, genericItemPlaceholder } from './config.js';
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

export function determineActiveWatchlistButtonContainerId() {
    const detailOverlayEl = document.getElementById('detailOverlay');
    if (detailOverlayEl && !detailOverlayEl.classList.contains('hidden')) {
        return 'overlayDetailAddToBtnContainer';
    }
    return 'itemDetailAddToBtnContainer';
}

export function createWatchlistItemCard(item) {
    const card = document.createElement('div');
    card.className = 'watchlist-item-card cursor-pointer relative';
    card.dataset.tmdb_id = String(item.tmdb_id);
    const posterUrl = item.poster_path ? `${smallImageBaseUrl}${item.poster_path}` : genericItemPlaceholder;
    const ratingHtml = item.vote_average ? `<p class="text-xs text-yellow-400">★ ${item.vote_average.toFixed(1)}</p>` : '';
    card.innerHTML = `
        <img src="${posterUrl}" alt="${item.title}" onerror="this.src='${genericItemPlaceholder}'; this.onerror=null;">
        <h4 class="text-md font-semibold text-sky-300 truncate mt-2" title="${item.title}">${item.title}</h4>
        <p class="text-xs text-gray-400">${item.release_year || 'N/A'} (${item.item_type === 'tv' ? 'TV Show' : 'Movie'})</p>
        ${ratingHtml}
    `;
    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-watchlist-btn absolute top-1 right-1 p-1 bg-gray-700 rounded-full';
    removeBtn.title = 'Remove from watchlist';
    removeBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-4 h-4"><path fill-rule="evenodd" d="M9 5a1 1 0 011-1h4a1 1 0 011 1v1h5a1 1 0 110 2h-1v11a2 2 0 01-2 2H6a2 2 0 01-2-2V8H3a1 1 0 110-2h5V5zm2 1v1h2V6h-2z" clip-rule="evenodd"/></svg>';
    removeBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await removeItemFromSpecificFirestoreWatchlist(currentSelectedWatchlistName, item.tmdb_id);
    });
    card.appendChild(removeBtn);
    card.addEventListener('click', () => handleItemSelect(String(item.tmdb_id), item.title, item.item_type, true));
    appendSeenCheckmark(card, item.tmdb_id);
    return card;
}

export async function updateAddToWatchlistButtonState(itemId, itemData, buttonContainerId) {
    if (!buttonContainerId) {
        console.warn('[updateAddToWatchlistButtonState] No buttonContainerId provided.');
        return;
    }
    const container = document.getElementById(buttonContainerId);
    if (!container) return;

    container.innerHTML = '';
    const watchlistButton = document.createElement('button');
    watchlistButton.id = buttonContainerId.replace('Container', 'Button');
    watchlistButton.title = 'Add to Watchlist';
    watchlistButton.className = 'watchlist-manage-button p-2 rounded-md';
    watchlistButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6"><path d="M6 4a2 2 0 012-2h8a2 2 0 012 2v16l-7-3-7 3V4z"/></svg>';
    container.appendChild(watchlistButton);

    if (currentUserId) {
        if (isItemInAnyFirestoreWatchlist(itemId)) {
            watchlistButton.classList.add('in-any-watchlist');
        }

        let managePopup = document.getElementById(buttonContainerId + 'ManagePopup');
        if (!managePopup) {
            managePopup = document.createElement('div');
            managePopup.id = buttonContainerId + 'ManagePopup';
            managePopup.className = 'hidden detail-panel-popup';
            container.appendChild(managePopup);
        }

        const populateManagePopup = async () => {
            managePopup.innerHTML = '';
            const lists = getCachedWatchlists();
            const listEl = document.createElement('div');
            listEl.id = 'watchlistManagePopupList';
            listEl.className = 'detail-panel-popup-list max-h-60 overflow-y-auto custom-scrollbar';

            if (lists.length === 0) {
                listEl.innerHTML = '<p class="text-gray-400 text-sm p-2">No watchlists.</p>';
            } else {
                lists.forEach(wl => {
                    const row = document.createElement('div');
                    row.className = 'detail-panel-popup-item flex items-center gap-2 border-b border-gray-600';
                    const cb = document.createElement('input');
                    cb.type = 'checkbox';
                    cb.checked = isItemInSpecificFirestoreWatchlist(wl.id, itemId);
                    const label = document.createElement('label');
                    label.textContent = wl.id;
                    row.appendChild(cb);
                    row.appendChild(label);
                    listEl.appendChild(row);
                    cb.addEventListener('change', async () => {
                        if (cb.checked) await addItemToSpecificFirestoreWatchlist(wl.id, itemData);
                        else await removeItemFromSpecificFirestoreWatchlist(wl.id, itemId);
                        await populateManagePopup();
                        if (isItemInAnyFirestoreWatchlist(itemId)) watchlistButton.classList.add('in-any-watchlist');
                        else watchlistButton.classList.remove('in-any-watchlist');
                    });
                });
            }

            managePopup.appendChild(listEl);

            const newInput = document.createElement('input');
            newInput.type = 'text';
            newInput.placeholder = 'New watchlist name';
            newInput.className = 'detail-panel-popup-new-input mt-2 w-full p-1 bg-gray-700 text-white rounded';
            managePopup.appendChild(newInput);
            const createBtn = document.createElement('button');
            createBtn.className = 'detail-panel-popup-create-btn mt-1 bg-green-700 text-white px-2 py-1 rounded';
            createBtn.textContent = 'Create & Add';
            createBtn.addEventListener('click', async () => {
                const newName = newInput.value.trim();
                if (!newName) return;
                const newRef = doc(db, 'users', currentUserId, 'watchlists', newName);
                const snap = await getDoc(newRef);
                if (!snap.exists()) {
                    await setDoc(newRef, { name: newName, items: [], createdAt: new Date().toISOString(), uid: currentUserId });
                }
                await window.loadUserFirestoreWatchlists();
                await addItemToSpecificFirestoreWatchlist(newName, itemData);
                newInput.value = '';
                await populateManagePopup();
            });
            managePopup.appendChild(createBtn);
        };

        watchlistButton.onclick = async (e) => {
            e.stopPropagation();
            if (managePopup.classList.contains('hidden')) {
                await populateManagePopup();
                managePopup.classList.remove('hidden');
                watchlistButton.classList.add('active-popup');
                positionPopup(watchlistButton, managePopup);
            } else {
                managePopup.classList.add('hidden');
                watchlistButton.classList.remove('active-popup');
            }
        };
    } else {
        watchlistButton.title = 'Sign in to manage watchlists';
        let authPopup = document.getElementById(buttonContainerId + 'AuthPopup');
        if (!authPopup) {
            authPopup = document.createElement('div');
            authPopup.id = buttonContainerId + 'AuthPopup';
            authPopup.className = 'hidden detail-panel-popup';
            container.appendChild(authPopup);
        }
        watchlistButton.onclick = (e) => {
            e.stopPropagation();
            if (authPopup.classList.contains('hidden')) {
                authPopup.classList.remove('hidden');
                window.createAuthFormUI_Global(authPopup, async () => {
                    authPopup.classList.add('hidden');
                    await updateAddToWatchlistButtonState(itemId, itemData, buttonContainerId);
                });
                positionPopup(watchlistButton, authPopup);
            } else {
                authPopup.classList.add('hidden');
            }
        };
    }
}

export async function handleRenameWatchlist(watchlistName) {
    if (!currentUserId) { showToast('You must be signed in to rename a watchlist.', 'error'); return; }
    if (!watchlistName) return;

    const newName = prompt('Enter a new name for the watchlist:', watchlistName);
    if (!newName) return;
    const trimmed = newName.trim();
    if (!trimmed || trimmed === watchlistName) return;

    try {
        const oldRef = doc(db, 'users', currentUserId, 'watchlists', watchlistName);
        const oldSnap = await getDoc(oldRef);
        if (!oldSnap.exists()) { showToast('Watchlist not found.', 'error'); return; }
        const data = oldSnap.data();
        const newRef = doc(db, 'users', currentUserId, 'watchlists', trimmed);
        const newSnap = await getDoc(newRef);
        if (newSnap.exists()) { showToast('A watchlist with that name already exists.', 'error'); return; }
        await setDoc(newRef, { ...data, name: trimmed });
        await deleteDoc(oldRef);
        await window.loadUserFirestoreWatchlists();

        if (currentSelectedWatchlistName === watchlistName) {
            updateCurrentSelectedWatchlistName(trimmed);
            localStorage.setItem(`mediaFinderLastSelectedWatchlist_${currentUserId}`, trimmed);
            await displayItemsInSelectedWatchlist();
        }

        await loadAndDisplayWatchlistsFromFirestore();
        showToast(`Watchlist renamed to "${trimmed}".`, 'success');
    } catch (err) {
        console.error('Error renaming watchlist:', err);
        showToast('Failed to rename watchlist.', 'error');
    }
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

export async function loadAndDisplayWatchlistsFromFirestore() {
    if (!watchlistTilesContainer || !watchlistDisplayContainer) {
        console.error('Watchlist containers not initialized.');
        return;
    }

    if (!currentUserId) {
        watchlistTilesContainer.innerHTML = '<p class="text-xs text-gray-400 col-span-full w-full text-center">Sign in to manage watchlists.</p>';
        watchlistDisplayContainer.innerHTML = '<p class="text-gray-500 italic col-span-full text-center">Sign in to manage your watchlists.</p>';
        return;
    }

    if (typeof window.loadUserFirestoreWatchlists === 'function') {
        await window.loadUserFirestoreWatchlists();
    } else {
        console.warn('loadUserFirestoreWatchlists function not found on window');
    }

    displayWatchlistSelection();
    await displayItemsInSelectedWatchlist();
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
