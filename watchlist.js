// js/watchlist.js
import { db, firebaseFirestoreFunctions, auth } from './firebase.js';
import { showToast, showLoading, showMessage, clearAllDynamicContent, createBackButton, positionPopup } from './ui.js';
import { smallImageBaseUrl, tileThumbnailPlaceholder } from './config.js';
import {
    currentUserId, currentSelectedWatchlistName, currentSelectedItemDetails,
    updateCurrentSelectedWatchlistName
} from './state.js';
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

export async function loadAndDisplayWatchlistsFromFirestore() {
    if (!currentUserId) {
        if (watchlistTilesContainer) watchlistTilesContainer.innerHTML = '<p class="text-xs text-gray-400 col-span-full w-full text-center">Sign in to see your watchlists.</p>';
        if (watchlistDisplayContainer) watchlistDisplayContainer.innerHTML = '<p class="text-gray-500 italic col-span-full text-center">Sign in to manage your watchlists.</p>';
        clearAllDynamicContent('watchlist');
        updateCurrentSelectedWatchlistName(null);
        return;
    }
    try {
        const watchlistsColRef = collection(db, "users", currentUserId, "watchlists");
        const querySnapshot = await getDocs(watchlistsColRef);
        const firestoreWatchlists = [];
        querySnapshot.forEach((docSnap) => { // Renamed doc to docSnap to avoid conflict
            firestoreWatchlists.push({ id: docSnap.id, ...docSnap.data() });
        });

        displayWatchlistSelection(firestoreWatchlists);

        const lastSelected = localStorage.getItem(`mediaFinderLastSelectedWatchlist_${currentUserId}`);
        if (lastSelected && firestoreWatchlists.some(w => w.id === lastSelected)) {
            updateCurrentSelectedWatchlistName(lastSelected);
        } else if (firestoreWatchlists.length > 0) {
            updateCurrentSelectedWatchlistName(firestoreWatchlists[0].id);
        } else {
            updateCurrentSelectedWatchlistName(null);
        }

        if (watchlistTilesContainer) {
            watchlistTilesContainer.querySelectorAll('.watchlist-tile').forEach(tile => {
                tile.classList.remove('selected-watchlist-tile');
                if (tile.dataset.watchlistName === currentSelectedWatchlistName) {
                    tile.classList.add('selected-watchlist-tile');
                }
            });
        }

        if (currentSelectedWatchlistName) {
            await displayItemsInSelectedWatchlist();
        } else {
            if (watchlistDisplayContainer) watchlistDisplayContainer.innerHTML = '<p class="text-gray-500 italic col-span-full text-center">Select a watchlist or create one.</p>';
            clearAllDynamicContent('watchlist');
        }

    } catch (error) {
        console.error("Error loading watchlists from Firestore: ", error);
        showToast("Error loading watchlists. Check console and Firestore rules.", "error");
        if (watchlistTilesContainer) watchlistTilesContainer.innerHTML = '<p class="text-red-400">Could not load watchlists.</p>';
    }
}

export async function handleDeleteWatchlist(watchlistName) {
    if (!currentUserId) { showToast("You must be signed in to delete a watchlist.", "error"); return; }
    if (!watchlistName) { console.error("[handleDeleteWatchlist] Called with no name."); return; }

    try {
        await deleteDoc(doc(db, "users", currentUserId, "watchlists", watchlistName));

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

export function displayWatchlistSelection(firestoreWatchlists = []) {
    if (!watchlistTilesContainer) return;
    watchlistTilesContainer.innerHTML = '';
    if (!currentUserId) {
        watchlistTilesContainer.innerHTML = '<p class="text-xs text-gray-400 col-span-full w-full text-center">Sign in to manage watchlists.</p>';
        return;
    }

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

export async function displayItemsInSelectedWatchlist() {
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
    try {
        const watchlistRef = doc(db, "users", currentUserId, "watchlists", currentSelectedWatchlistName);
        const docSnap = await getDoc(watchlistRef);

        if (docSnap.exists()) {
            const items = docSnap.data().items || [];
            if (items.length === 0) {
                watchlistDisplayContainer.innerHTML = `<p class="text-gray-500 italic col-span-full text-center">Watchlist "${currentSelectedWatchlistName}" is empty.</p>`;
            } else {
                items.forEach(item => {
                    watchlistDisplayContainer.appendChild(createWatchlistItemCard(item));
                });
            }
        } else {
            watchlistDisplayContainer.innerHTML = `<p class="text-gray-500 italic col-span-full text-center">Watchlist "${currentSelectedWatchlistName}" not found.</p>`;
        }
    } catch (error) {
        console.error("Error fetching items for watchlist: ", currentSelectedWatchlistName, error);
        showMessage("Could not load items for this watchlist.", "error", "watchlistItems", watchlistDisplayContainer);
    }
}

export async function addItemToSpecificFirestoreWatchlist(watchlistName, itemData) {
    if (!currentUserId) { showToast("Please sign in to add items.", "error"); return false; }
    if (!watchlistName) { showToast("Watchlist name not specified.", "error"); return false; }
    if (!itemData || !itemData.tmdb_id) { showToast("Cannot add item: Invalid item data.", "error"); return false; }

    const itemToAdd = {
        tmdb_id: String(itemData.tmdb_id), title: itemData.title || itemData.name,
        item_type: itemData.item_type, poster_path: itemData.poster_path || null,
        release_year: (itemData.release_date || itemData.first_air_date || '').substring(0, 4),
        vote_average: itemData.vote_average || null
    };
    try {
        const watchlistRef = doc(db, "users", currentUserId, "watchlists", watchlistName);
        await updateDoc(watchlistRef, { items: arrayUnion(itemToAdd) });
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

export function createWatchlistItemCard(item) {
    const card = document.createElement('div');
    card.className = 'watchlist-item-card bg-gray-700 p-3 rounded-lg cursor-pointer hover:bg-gray-600 relative';
    const posterUrl = item.poster_path ? `${smallImageBaseUrl}${item.poster_path}` : tileThumbnailPlaceholder.replace('40x60', '150x225'); // Placeholder adjustment
    card.innerHTML = `
        <img src="${posterUrl}" alt="${item.title}" class="w-full h-48 object-cover rounded-md mb-2" onerror="this.src='${tileThumbnailPlaceholder.replace('40x60', '150x225')}'; this.onerror=null;">
        <h4 class="text-sm font-semibold text-sky-200 truncate" title="${item.title}">${item.title}</h4>
        <p class="text-xs text-gray-400">${item.release_year || 'N/A'} (${item.item_type === 'tv' ? 'TV Show' : 'Movie'})</p>
        ${item.vote_average ? `<p class="text-xs text-yellow-400">★ ${item.vote_average.toFixed(1)}</p>` : ''}
        <button class="remove-watchlist-btn absolute top-1 right-1 bg-red-600 hover:bg-red-700 text-white p-1 rounded-full z-10" title="Remove from this watchlist">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4"><path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" /></svg>
        </button>
    `;
    const removeBtn = card.querySelector('.remove-watchlist-btn');
    removeBtn.addEventListener('click', (e) => { e.stopPropagation(); removeItemFromSpecificFirestoreWatchlist(currentSelectedWatchlistName, item.tmdb_id); });
    // Use overlay for watchlist item details
    card.addEventListener('click', () => { handleItemSelect(item.tmdb_id, item.title, item.item_type, true); });
    appendSeenCheckmark(card, item.tmdb_id); // From seenList.js
    return card;
}

export async function isItemInSpecificFirestoreWatchlist(watchlistName, itemId) {
    if (!currentUserId || !watchlistName) return false;
    try {
        const watchlistRef = doc(db, "users", currentUserId, "watchlists", watchlistName);
        const docSnap = await getDoc(watchlistRef);
        if (docSnap.exists()) {
            const items = docSnap.data().items || [];
            return items.some(item => String(item.tmdb_id) === String(itemId));
        }
        return false;
    } catch (error) { console.error("Error checking if item is in Firestore watchlist:", error); return false; }
}

export async function isItemInAnyFirestoreWatchlist(itemId) {
    if (!currentUserId) return false;
    try {
        const watchlistsColRef = collection(db, "users", currentUserId, "watchlists");
        const querySnapshot = await getDocs(watchlistsColRef);
        for (const wlDoc of querySnapshot.docs) {
            const items = wlDoc.data().items || [];
            if (items.some(item => String(item.tmdb_id) === String(itemId))) {
                return true;
            }
        }
        return false;
    } catch (error) {
        console.error("Error checking if item is in any Firestore watchlist:", error);
        return false;
    }
}

export async function updateAddToWatchlistButtonState(itemId, itemData, buttonContainerId = 'itemDetailAddToBtnContainer') {
    const container = document.getElementById(buttonContainerId);
    if (!container) {
        // console.warn("Button container not found for updateAddToWatchlistButtonState:", buttonContainerId); // Can be noisy
        return;
    }
    container.innerHTML = '';

    const mainButton = document.createElement('button');
    mainButton.id = buttonContainerId.replace('Container', 'Button');
    mainButton.title = "Add to/manage watchlists";
    mainButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6"><path fill-rule="evenodd" d="M6.32 2.577a49.255 49.255 0 0 1 11.36 0c1.497.174 2.57 1.46 2.57 2.93V21a.75.75 0 0 1-1.085.67L12 18.089l-7.165 3.583A.75.75 0 0 1 3.75 21V5.507c0-1.47 1.073-2.756 2.57-2.93Z" clip-rule="evenodd" /></svg>`;
    mainButton.className = "p-2 rounded-md hover:bg-sky-700 transition-colors text-white watchlist-manage-button";

    if (currentUserId && await isItemInAnyFirestoreWatchlist(itemId)) {
        mainButton.classList.add('in-any-watchlist');
    }

    container.appendChild(mainButton);

    let popupElement = document.getElementById(buttonContainerId + 'Popup');
    if (!popupElement) {
        popupElement = document.createElement('div');
        popupElement.id = buttonContainerId + 'Popup';
        popupElement.className = 'hidden detail-panel-popup'; // Start hidden
        container.appendChild(popupElement);
    }

    mainButton.onclick = async (e) => {
        e.stopPropagation();
        const currentPopup = document.getElementById(buttonContainerId + 'Popup');

        if (currentPopup) {
            if (currentPopup.classList.contains('hidden')) {
                await populateWatchlistManagePopup(currentPopup, itemId, itemData, mainButton, buttonContainerId);
                positionPopup(mainButton, currentPopup); // positionPopup from ui.js
                currentPopup.classList.remove('hidden'); // Show after positioning
            } else {
                currentPopup.classList.add('hidden');
            }
        } else {
            console.error(`Popup NOT found for ID: ${buttonContainerId + 'Popup'}`);
        }
    };
}
export async function populateWatchlistManagePopup(popupElement, itemId, itemData, anchorButton, mainButtonContainerId) {
    popupElement.innerHTML = '';

    if (!currentUserId) {
        // Uses createAuthFormUI from auth.js
        // This requires auth.js to be loaded and createAuthFormUI to be available.
        // For simplicity, if createAuthFormUI is not directly importable due to circular refs,
        // this part might need to be handled by emitting an event that main.js listens to.
        // Assuming createAuthFormUI can be called (e.g., if auth.js doesn't import from watchlist.js)
        window.createAuthFormUI_Global(popupElement, async () => { // Expose globally or pass
            await populateWatchlistManagePopup(popupElement, itemId, itemData, anchorButton, mainButtonContainerId);
            if (!popupElement.classList.contains('hidden')) {
                positionPopup(anchorButton, popupElement);
            }
        });
        return;
    }

    const watchlistsColRef = collection(db, "users", currentUserId, "watchlists");
    const querySnapshot = await getDocs(watchlistsColRef);
    const userWatchlists = [];
    querySnapshot.forEach((docSnap) => userWatchlists.push({ id: docSnap.id, name: docSnap.id, ...docSnap.data() })); // Ensure name property for label

    const listElement = document.createElement('div');
    listElement.className = 'detail-panel-popup-list';

    if (userWatchlists.length === 0) {
        listElement.innerHTML = '<p class="text-xs text-gray-400 py-1">No watchlists yet. Create one below.</p>';
    }

    for (const wl of userWatchlists) {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'detail-panel-popup-item';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `wl-check-${wl.id.replace(/\s+/g, '-')}-${itemId}-${mainButtonContainerId.slice(0,10)}`; // Shorter unique ID
        checkbox.dataset.watchlistName = wl.id;
        checkbox.checked = await isItemInSpecificFirestoreWatchlist(wl.id, itemId);

        checkbox.addEventListener('change', async (e) => {
            if (e.target.checked) {
                await addItemToSpecificFirestoreWatchlist(wl.id, itemData);
            } else {
                await removeItemFromSpecificFirestoreWatchlist(wl.id, itemId);
            }
            if (await isItemInAnyFirestoreWatchlist(itemId)) {
                anchorButton.classList.add('in-any-watchlist');
            } else {
                anchorButton.classList.remove('in-any-watchlist');
            }
        });

        const label = document.createElement('label');
        label.htmlFor = checkbox.id;
        label.textContent = wl.name; // Use .name which we ensured exists

        itemDiv.appendChild(checkbox);
        itemDiv.appendChild(label);
        listElement.appendChild(itemDiv);
    }
    popupElement.appendChild(listElement);

    const createNewDiv = document.createElement('div');
    createNewDiv.className = 'mt-3 pt-3 border-t border-gray-700 flex items-center';
    const newNameInputPopup = document.createElement('input'); // Renamed to avoid conflict with global
    newNameInputPopup.type = 'text';
    newNameInputPopup.placeholder = 'New Watchlist Name';
    newNameInputPopup.className = 'detail-panel-popup-new-input flex-grow';
    const createBtnPopup = document.createElement('button');
    createBtnPopup.textContent = 'Create & Add';
    createBtnPopup.className = 'detail-panel-popup-create-btn';

    createBtnPopup.onclick = async () => {
        if (!currentUserId) return;
        const name = newNameInputPopup.value.trim();
        if (!name) { showToast("Enter a name.", "error"); return; }

        const newWatchlistRef = doc(db, "users", currentUserId, "watchlists", name);
        const docSnap = await getDoc(newWatchlistRef);
        if (docSnap.exists()) { showToast(`"${name}" already exists. Add item from list.`, "error"); return; }

        // Ensure itemData has necessary fields (tmdb_id, title, item_type, poster_path, release_year, vote_average)
        const itemToAddForNewList = {
            tmdb_id: String(itemData.tmdb_id), title: itemData.title || itemData.name,
            item_type: itemData.item_type, poster_path: itemData.poster_path || null,
            release_year: (itemData.release_date || itemData.first_air_date || '').substring(0,4),
            vote_average: itemData.vote_average || null
        };

        await setDoc(newWatchlistRef, { name: name, items: [itemToAddForNewList], createdAt: new Date().toISOString(), uid: currentUserId });
        showToast(`"${name}" created and item added.`, "success");
        newNameInputPopup.value = '';
        popupElement.innerHTML = '';
        await populateWatchlistManagePopup(popupElement, itemId, itemData, anchorButton, mainButtonContainerId);
        if (!popupElement.classList.contains('hidden')) positionPopup(anchorButton, popupElement);
        if (await isItemInAnyFirestoreWatchlist(itemId)) {
            anchorButton.classList.add('in-any-watchlist');
        }
        await loadAndDisplayWatchlistsFromFirestore();
    };

    createNewDiv.appendChild(newNameInputPopup);
    createNewDiv.appendChild(createBtnPopup);
    popupElement.appendChild(createNewDiv);
}


export function toggleOptionsMenu(tileElement, watchlistName) {
    closeAllOptionMenus(tileElement);
    let menu = tileElement.querySelector('.options-menu');
    if (menu) {
        menu.remove();
    } else {
        menu = document.createElement('div');
        menu.className = 'options-menu';
        const deleteOption = document.createElement('button');
        deleteOption.className = 'options-menu-item delete';
        deleteOption.textContent = 'Delete Watchlist';
        deleteOption.addEventListener('click', (e) => {
            e.stopPropagation();
            handleDeleteWatchlist(watchlistName); // Assumes handleDeleteWatchlist is available
            menu.remove();
        });
        menu.appendChild(deleteOption);
        tileElement.appendChild(menu);
    }
}

export function closeAllOptionMenus(exceptThisTile = null) {
    document.querySelectorAll('.watchlist-tile').forEach(tile => {
        if (tile !== exceptThisTile) {
            const menu = tile.querySelector('.options-menu');
            if (menu) {
                menu.remove();
            }
        }
    });
}

export function determineActiveWatchlistButtonContainerId() {
    const detailOverlayEl = document.getElementById('detailOverlay'); // Get element
    const watchlistViewEl = document.getElementById('watchlistView'); // Get element

    if (detailOverlayEl && !detailOverlayEl.classList.contains('hidden')) return 'overlayDetailAddToBtnContainer';
    if (watchlistViewEl && !watchlistViewEl.classList.contains('hidden-view')) return 'watchlistDetailAddToBtnContainer';
    return 'itemDetailAddToBtnContainer';
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
        updateCurrentSelectedWatchlistName(name);
        localStorage.setItem(`mediaFinderLastSelectedWatchlist_${currentUserId}`, name);
        await loadAndDisplayWatchlistsFromFirestore();
        newWatchlistNameInput.value = '';
        showToast(`Watchlist "${name}" created.`, "success");
    } catch (error) { console.error("Error creating watchlist: ", error); showToast("Failed to create watchlist. Check console.", "error"); }
}