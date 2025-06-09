// js/seenList.js 
import { db, firebaseFirestoreFunctions } from './firebase.js';
import { showToast, showLoading, showMessage, positionPopup } from './ui.js'; // createAuthFormUI is in auth.js
import { genericItemPlaceholder, smallImageBaseUrl } from './config.js';
import { currentUserId, selectedCertifications } from './state.js';
import { extractCertification } from './ratingUtils.js';
import { handleItemSelect } from './handlers.js'; // For item click

// DOM Elements
let seenItemsDisplayContainer; // From main.js

export function initSeenListRefs(elements) {
    seenItemsDisplayContainer = elements.seenItemsDisplayContainer;
}

const { getDoc, setDoc, deleteDoc, collection, getDocs, doc } = firebaseFirestoreFunctions;

export async function isItemInSeenList(itemId) {
    if (!currentUserId || !itemId) return false;
    try {
        const seenItemRef = doc(db, "users", currentUserId, "seenItems", String(itemId));
        const docSnap = await getDoc(seenItemRef);
        return docSnap.exists();
    } catch (error) {
        console.error("Error checking if item is in seen list:", error);
        return false;
    }
}

export async function addItemToSeenList(itemData) {
    if (!currentUserId || !itemData || !itemData.tmdb_id) {
        showToast("Cannot mark as seen: User not signed in or invalid item data.", "error");
        return false;
    }
    const itemId = String(itemData.tmdb_id);
    const itemToAdd = {
        tmdb_id: itemId,
        title: itemData.title || itemData.name,
        item_type: itemData.item_type,
        poster_path: itemData.poster_path || null,
        release_year: (itemData.release_date || itemData.first_air_date || '').substring(0, 4),
        vote_average: itemData.vote_average || null,
        certification: extractCertification(itemData),
        seenAt: new Date().toISOString()
    };
    try {
        const seenItemRef = doc(db, "users", currentUserId, "seenItems", itemId);
        await setDoc(seenItemRef, itemToAdd);
        showToast(`"${itemToAdd.title}" marked as seen.`, "success");
        const seenView = document.getElementById('seenView'); // Get element
        if (seenView && !seenView.classList.contains('hidden-view')) await loadAndDisplaySeenItems();
        return true;
    } catch (error) {
        console.error("Error adding item to seen list:", error);
        showToast("Failed to mark item as seen.", "error");
        return false;
    }
}

export async function removeItemFromSeenList(itemId) {
    if (!currentUserId || !itemId) {
        showToast("Cannot unmark as seen: User not signed in or invalid item ID.", "error");
        return false;
    }
    const strItemId = String(itemId);
    try {
        const seenItemRef = doc(db, "users", currentUserId, "seenItems", strItemId);
        await deleteDoc(seenItemRef);
        showToast("Item unmarked as seen.", "info");
        const seenView = document.getElementById('seenView'); // Get element
        if (seenView && !seenView.classList.contains('hidden-view')) await loadAndDisplaySeenItems();
        return true;
    } catch (error) {
        console.error("Error removing item from seen list:", error);
        showToast("Failed to unmark item as seen.", "error");
        return false;
    }
}

export async function loadAndDisplaySeenItems() {
    if (!seenItemsDisplayContainer) {
        console.error("Seen items display container not found.");
        return;
    }
    if (!currentUserId) {
        seenItemsDisplayContainer.innerHTML = '<p class="text-gray-500 italic col-span-full text-center">Please sign in to view your seen items.</p>';
        return;
    }

    showLoading('seenItemsDisplayContainer', 'Loading seen items...', seenItemsDisplayContainer);

    try {
        const seenItemsColRef = collection(db, "users", currentUserId, "seenItems");
        const querySnapshot = await getDocs(seenItemsColRef);

        seenItemsDisplayContainer.innerHTML = ''; // Clear previous items

        if (querySnapshot.empty) {
            seenItemsDisplayContainer.innerHTML = '<p class="text-gray-500 italic col-span-full text-center">No items marked as seen yet.</p>';
            return;
        }

        let items = [];
        querySnapshot.forEach((docSnap) => {
            items.push(docSnap.data());
        });
        if (!selectedCertifications.includes('All')) {
            items = items.filter(it => selectedCertifications.includes(it.certification || 'NR'));
        }
        items.forEach((item) => {
            const card = document.createElement('div');
            card.className = 'generic-item-card cursor-pointer';
            const posterUrl = item.poster_path ? `${smallImageBaseUrl}${item.poster_path}` : genericItemPlaceholder;
            card.innerHTML = `
                <img src="${posterUrl}" alt="${item.title}" onerror="this.src='${genericItemPlaceholder}'; this.onerror=null;">
                <h4 class="text-md font-semibold text-sky-300 truncate mt-2" title="${item.title}">${item.title}</h4>
                <p class="text-xs text-gray-400">${item.release_year || 'N/A'} (${item.item_type === 'tv' ? 'TV Show' : 'Movie'})</p>
                ${item.vote_average ? `<p class="text-xs text-yellow-400">★ ${item.vote_average.toFixed(1)}</p>` : ''}
            `;
            card.addEventListener('click', () => handleItemSelect(String(item.tmdb_id), item.title, item.item_type, true));
            seenItemsDisplayContainer.appendChild(card);
            appendSeenCheckmark(card, item.tmdb_id);
        });
    } catch (error) {
        console.error("Error loading seen items:", error);
        showMessage("Could not load seen items. Please try again.", "error", "seenItemsDisplayContainer", seenItemsDisplayContainer);
    }
}

export async function appendSeenCheckmark(cardElement, itemId) {
    if (!cardElement || !currentUserId) return; // Check currentUserId
    if (await isItemInSeenList(itemId)) {
        const check = document.createElement('div');
        check.className = 'seen-checkmark';
        check.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path fill-rule="evenodd" d="M19.916 4.626a.75.75 0 0 1 .208 1.04l-9 13.5a.75.75 0 0 1-1.154.114l-6-6a.75.75 0 0 1 1.06-1.06l5.353 5.353 8.493-12.74a.75.75 0 0 1 1.04-.207Z" clip-rule="evenodd"/></svg>';
        // Check if already exists to prevent duplicates if called multiple times
        if (!cardElement.querySelector('.seen-checkmark')) {
            cardElement.appendChild(check);
        }
    } else {
        // Remove checkmark if it exists and item is no longer seen
        const existingCheck = cardElement.querySelector('.seen-checkmark');
        if (existingCheck) {
            existingCheck.remove();
        }
    }
}


export async function updateMarkAsSeenButtonState(itemId, itemData, buttonContainerId) {
    if (!buttonContainerId) {
        console.warn("[updateMarkAsSeenButtonState] No buttonContainerId provided.");
        return;
    }
    const container = document.getElementById(buttonContainerId);
    if (!container) {
        // console.warn("Seen button container not found:", buttonContainerId); // Can be noisy
        return;
    }
    container.innerHTML = ''; // Clear previous button

    const seenButton = document.createElement('button');
    seenButton.id = buttonContainerId.replace('Container', 'Button');
    seenButton.title = "Mark as Seen";
    seenButton.className = "mark-as-seen-button p-2 rounded-md";
    seenButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6"><path fill-rule="evenodd" d="M19.916 4.626a.75.75 0 0 1 .208 1.04l-9 13.5a.75.75 0 0 1-1.154.114l-6-6a.75.75 0 0 1 1.06-1.06l5.353 5.353 8.493-12.74a.75.75 0 0 1 1.04-.207Z" clip-rule="evenodd" stroke="currentColor" stroke-width="1.5"/></svg>`;

    if (currentUserId) {
        if (await isItemInSeenList(itemId)) {
            seenButton.classList.add('seen');
        }
        seenButton.onclick = async () => {
            if (seenButton.classList.contains('seen')) {
                if (await removeItemFromSeenList(itemId)) seenButton.classList.remove('seen');
            } else {
                if (await addItemToSeenList(itemData)) seenButton.classList.add('seen');
            }
            // After action, update checkmarks on any visible cards for this item
            document.querySelectorAll(`[data-id="${itemId}"], [data-tmdb_id="${itemId}"]`).forEach(card => {
                 if (card.closest('.item-card, .watchlist-item-card, .generic-item-card, .related-item-card')) { // ensure it's a media card
                    appendSeenCheckmark(card, itemId); // Re-evaluate and add/remove checkmark
                 }
            });
        };
    } else {
        seenButton.title = "Sign in to mark as seen";
        let seenAuthPopupElement = document.getElementById(buttonContainerId + 'SeenAuthPopup');
        if (!seenAuthPopupElement) {
            seenAuthPopupElement = document.createElement('div');
            seenAuthPopupElement.id = buttonContainerId + 'SeenAuthPopup';
            seenAuthPopupElement.className = 'hidden detail-panel-popup';
            container.appendChild(seenAuthPopupElement);
        }

        seenButton.onclick = (e) => {
            e.stopPropagation();
            if (seenAuthPopupElement.classList.contains('hidden')) {
                seenAuthPopupElement.classList.remove('hidden');
                // createAuthFormUI from auth.js (need to ensure it's available, e.g. via global or careful import)
                window.createAuthFormUI_Global(seenAuthPopupElement, async () => {
                    seenAuthPopupElement.classList.add('hidden');
                    await updateMarkAsSeenButtonState(itemId, itemData, buttonContainerId);
                });
                positionPopup(seenButton, seenAuthPopupElement); // from ui.js
            } else {
                seenAuthPopupElement.classList.add('hidden');
            }
        };
    }
    container.appendChild(seenButton);
}

export function determineActiveSeenButtonContainerId() {
    const detailOverlayEl = document.getElementById('detailOverlay');
    if (detailOverlayEl && !detailOverlayEl.classList.contains('hidden')) return 'overlayDetailMarkAsSeenBtnContainer';
    return 'itemDetailMarkAsSeenBtnContainer';
}
