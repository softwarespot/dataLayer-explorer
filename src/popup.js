/* eslint-disable n/no-unsupported-features/node-builtins */
import { formatAsColumn, formatAsJSON } from './formatters.js';
import * as GA from './ga4.js';
import {
    addEventListener,
    animate,
    copyToClipboard,
    getFirstFlattenedKey,
    isObject,
    isString,
    safeDecode,
    safeEncode,
    sleep,
    toDurationStringMs,
    toHumanTimeStringMs,
} from './utils.js';

const MODULE = '[dle]';

// This is set to "development" when using "npm run start"
const ENVIRONMENT = 'production';

// Taken from "background.js"
const EVENT_LOAD_CONFIG = 'LOAD_CONFIG';
const EVENT_SYNC_CONFIG = 'SYNC_CONFIG';

const EVENT_DATALAYER_LOADING = 'DATALAYER_LOADING';
const EVENT_DATALAYER_FOUND = 'DATALAYER_FOUND';
const EVENT_DATALAYER_NOT_FOUND = 'DATALAYER_NOT_FOUND';

const FORMAT_MODE_COLUMN = 'column';
const FORMAT_MODE_JSON = 'json';

const THEME_MODE_DARK = 'dark';
const THEME_MODE_LIGHT = 'light';

// Taken from "contentScript.js"
const EVENT_GET_DATALAYER_STATUS = 'GET_DATALAYER_STATUS';
const EVENT_GET_DATALAYER_PAGES_ENTRIES = 'GET_DATALAYER_PAGES_ENTRIES';
const EVENT_REMOVE_DATALAYER_PAGES_ENTRIES = 'REMOVE_DATALAYER_PAGES_ENTRIES';

/* eslint-disable sort-keys-fix/sort-keys-fix */
const state = {
    dom: {
        title: document.getElementById('header-title'),
        search: document.getElementById('search'),
        copyAllBtn: document.getElementById('copy-all-btn'),
        expandAllBtn: document.getElementById('expand-all-btn'),
        collapseAllBtn: document.getElementById('collapse-all-btn'),
        refreshBtn: document.getElementById('refresh-btn'),
        settingsToggleBtn: document.getElementById('settings-toggle-btn'),
        settingsPanel: document.getElementById('settings-panel'),
        settingsCloseBtn: document.getElementById('settings-close-btn'),
        maxPagesSelect: document.getElementById('max-pages-select'),
        clearPagesBtn: document.getElementById('clear-pages-btn'),
        formatModeSelect: document.getElementById('format-mode-select'),
        themeModeSelect: document.getElementById('theme-mode-select'),
        eventsStatus: document.getElementById('events-status'),
        status: document.getElementById('status'),
        eventsContainer: document.getElementById('events-container'),
    },
    config: undefined,
    currPageIndex: 0,
    currEntriesIndex: 0,
    syncCheckerTimerId: 0,
    emptySyncCounts: 0,
    expanded: {
        pageHeaders: new Map(),
        pageAdvancedInfoIds: new Map(),
        entryIds: new Map(),
        advancedInfoEntryIds: new Map(),
    },
    formatModes: {
        entryIds: new Map(),
    },
};
/* eslint-enable sort-keys-fix/sort-keys-fix */

addEventListener(document, 'DOMContentLoaded', async () => {
    state.config = await getConfig();

    if (ENVIRONMENT === 'development') {
        state.dom.title.setAttribute('title', `${state.dom.title.textContent} v0.0.0`);
    } else {
        const manifest = chrome.runtime.getManifest();
        state.dom.title.setAttribute('title', `${state.dom.title.textContent} v${manifest.version}`);
    }

    state.dom.search.value = state.config.searchTerm;
    state.dom.maxPagesSelect.value = String(state.config.maxPages);

    state.dom.formatModeSelect.value = state.config.formatMode;

    state.dom.themeModeSelect.value = state.config.themeMode;
    if (state.config.themeMode === THEME_MODE_DARK) {
        document.body.classList.add('dark-theme');
    }

    const status = await queryDataLayerStatus();
    switch (status) {
        case EVENT_DATALAYER_FOUND: {
            const els = document.querySelectorAll('.hide:not(#settings-panel)');
            for (const el of els) {
                el.classList.remove('hide');
            }
            state.dom.status.classList.add('hide');

            syncDataLayerPageEntriesChecker();
            break;
        }
        case EVENT_DATALAYER_NOT_FOUND:
            state.dom.status.classList.add('error');
            state.dom.status.textContent = 'There is no dataLayer on this page.';
            break;
    }

    const deferSetSearchTerm = debounce(async (searchTerm) => {
        await syncConfig({
            searchTerm,
        });
    }, 256);
    addEventListener(state.dom.search, 'input', (_, targetEl) => {
        const searchTerm = targetEl.value;
        deferSetSearchTerm(searchTerm);
        syncFilterPageEntries(searchTerm);
    });

    addEventListener(state.dom.copyAllBtn, 'click', (_, targetEl) => {
        const eventEls = state.dom.eventsContainer.querySelectorAll('.event');
        const pagesData = getPagesDataFromEventElements(eventEls);
        if (copyToClipboard(JSON.stringify(pagesData, undefined, 2))) {
            animate(targetEl);
        }
    });

    addEventListener(state.dom.expandAllBtn, 'click', (_, targetEl) => {
        syncPageEntriesExpandedOrCollapsed(targetEl, true);
    });

    addEventListener(state.dom.collapseAllBtn, 'click', (_, targetEl) => {
        syncPageEntriesExpandedOrCollapsed(targetEl, false);
    });

    addEventListener(state.dom.refreshBtn, 'click', async (_, targetEl) => {
        animate(targetEl);

        await syncDataLayerRefreshPagesEntries();
    });

    addEventListener(state.dom.settingsToggleBtn, 'click', (_, targetEl) => {
        animate(targetEl);

        state.dom.settingsPanel.classList.toggle('hide');
    });

    addEventListener(state.dom.settingsCloseBtn, 'click', (_, targetEl) => {
        animate(targetEl);

        state.dom.settingsPanel.classList.add('hide');
    });

    addEventListener(state.dom.maxPagesSelect, 'change', async (_, targetEl) => {
        const maxPages = Number(targetEl.value);
        await syncConfig({
            maxPages,
        });
        await syncDataLayerRefreshPagesEntries();
    });

    addEventListener(state.dom.clearPagesBtn, 'click', async (_, targetEl) => {
        animate(targetEl);

        await sendToContentScript(EVENT_REMOVE_DATALAYER_PAGES_ENTRIES);
        await syncDataLayerRefreshPagesEntries();
    });

    addEventListener(state.dom.formatModeSelect, 'change', async (_, targetEl) => {
        const formatMode = targetEl.value;
        await syncConfig({
            formatMode,
        });
        await syncDataLayerRefreshPagesEntries();
    });

    addEventListener(state.dom.themeModeSelect, 'change', async (_, targetEl) => {
        const themeMode = targetEl.value;
        document.body.classList.toggle('dark-theme', themeMode === THEME_MODE_DARK);
        await syncConfig({
            themeMode,
        });
    });

    addEventListener(document, 'click', '.page-header-title', (_, targetEl) => {
        // Skip toggling when clicking the URL
        if (targetEl.matches('.page-header-url') || targetEl.closest('.page-header-url')) {
            return;
        }

        const pageHeaderEl = targetEl.closest('.page-header');
        const expanded = pageHeaderEl.classList.toggle('show');

        const pageId = pageHeaderEl.getAttribute('data-page-id');
        state.expanded.pageHeaders.set(pageId, expanded);

        const eventEls = state.dom.eventsContainer.querySelectorAll(`.event[data-page-id="${pageId}"]`);
        for (const eventEl of eventEls) {
            eventEl.classList.toggle('page-collapsed', !expanded);
        }
    });

    addEventListener(document, 'click', '.page-header-copy-btn', (_, targetEl) => {
        const pageHeaderEl = targetEl.closest('.page-header');
        const pageId = pageHeaderEl.getAttribute('data-page-id');
        const eventEls = state.dom.eventsContainer.querySelectorAll(`.event[data-page-id="${pageId}"]`);
        const pagesData = getPagesDataFromEventElements(eventEls);
        if (copyToClipboard(JSON.stringify(pagesData, undefined, 2))) {
            animate(targetEl);
        }
    });

    addEventListener(document, 'click', '.page-header-advanced-info-btn', (_, targetEl) => {
        animate(targetEl);

        const pageHeaderEl = targetEl.closest('.page-header');
        const isExpanded = pageHeaderEl.nextElementSibling.classList.toggle('show');
        const pageId = pageHeaderEl.getAttribute('data-page-id');
        state.expanded.pageAdvancedInfoIds.set(pageId, isExpanded);
    });

    addEventListener(document, 'click', '.event-name', (_, targetEl) => {
        const eventEl = targetEl.closest('.event');
        const shouldExpand = !eventEl.classList.contains('show');
        updatePageEntriesExpandOrCollapse([eventEl], shouldExpand);
    });

    addEventListener(document, 'click', '.event-copy-btn', (_, targetEl) => {
        const eventEl = targetEl.closest('.event');
        const { decoded: eventDecoded } = getEventDataFromElement(eventEl);
        if (copyToClipboard(eventDecoded)) {
            animate(targetEl);
        }
    });

    addEventListener(document, 'click', '.event-format-toggle-btn', (_, targetEl) => {
        animate(targetEl);

        const eventEl = targetEl.closest('.event');
        const entryId = eventEl.getAttribute('data-entry-id');
        const { decoded: eventDecoded, parsed: eventData } = getEventDataFromElement(eventEl);

        const currFormat = state.formatModes.entryIds.get(entryId) ?? state.config.formatMode;
        const toggledFormat = currFormat === FORMAT_MODE_JSON ? FORMAT_MODE_COLUMN : FORMAT_MODE_JSON;
        state.formatModes.entryIds.set(entryId, toggledFormat);

        const eventDataEl = eventEl.nextElementSibling.querySelector('.event-data');
        renderEventData(eventDataEl, eventData, eventDecoded, toggledFormat);
    });

    addEventListener(document, 'click', '.event-advanced-info-btn', (_, targetEl) => {
        animate(targetEl);

        const eventEl = targetEl.closest('.event');
        updatePageEntriesExpandOrCollapse([eventEl], true);

        // The event content is the next sibling in the DOM tree
        const eventTraceEl = eventEl.nextElementSibling.querySelector('.event-advanced-info');
        const isExpanded = eventTraceEl.classList.toggle('show');
        const entryId = eventEl.getAttribute('data-entry-id');
        state.expanded.advancedInfoEntryIds.set(entryId, isExpanded);
    });
});

async function getConfig() {
    if (ENVIRONMENT === 'development') {
        const res = sessionStorage.getItem('config');
        if (isString(res)) {
            return JSON.parse(res);
        }

        // Taken from "background.js"
        /* eslint-disable sort-keys-fix/sort-keys-fix */
        return {
            searchTerm: '',
            expandAll: false,
            maxPages: 0,
            formatMode: FORMAT_MODE_JSON,
            themeMode: THEME_MODE_LIGHT,
        };
        /* eslint-enable sort-keys-fix/sort-keys-fix */
    }
    return sendToBackground(EVENT_LOAD_CONFIG);
}

async function syncConfig(cfgPartial) {
    state.config = {
        ...state.config,
        ...cfgPartial,
    };
    if (ENVIRONMENT === 'development') {
        sessionStorage.setItem('config', JSON.stringify(state.config));
    } else {
        await sendToBackground(EVENT_SYNC_CONFIG, state.config);
        await sendToContentScript(EVENT_SYNC_CONFIG, state.config);
    }
}

// dataLayer query functions

async function queryDataLayerStatus() {
    if (ENVIRONMENT === 'development') {
        return EVENT_DATALAYER_FOUND;
    }

    const endTimeMs = Date.now() + 30_000;
    while (Date.now() < endTimeMs) {
        try {
            const res = await sendToContentScript(EVENT_GET_DATALAYER_STATUS);
            switch (res.status) {
                case EVENT_DATALAYER_FOUND:
                case EVENT_DATALAYER_NOT_FOUND:
                    return res.status;
                case EVENT_DATALAYER_LOADING:
                default:
                    break;
            }
        } catch {
            // Ignore the error, as it means the "contentScript.js" is not available
        }

        // Continue to wait for the status from the "contentScript.js"
        await sleep(512);
    }
    return EVENT_DATALAYER_NOT_FOUND;
}

async function queryDataLayerPagesEntries() {
    if (ENVIRONMENT === 'development') {
        /* eslint-disable sort-keys-fix/sort-keys-fix */
        return {
            pages: [
                {
                    id: 'page-0',
                    entries: [
                        {
                            id: 'entry-0-0',
                            name: 'dataLayer',
                            event: {
                                event: 'page_view',
                                page_title: 'dataLayer Explorer - Example Events',
                                page_location: 'https://www.example.com/',
                                page_path: '/',
                            },
                            trace: 'at HTMLButtonElement.<anonymous> (index.html:89:32)',
                            afterPageLoadMs: 50,
                        },
                        {
                            id: 'entry-0-1',
                            name: 'dataLayer',
                            event: {
                                event: 'view_item',
                                ecommerce: {
                                    currency: 'USD',
                                    value: 29.99,
                                    items: [
                                        {
                                            item_id: 'SKU_12345',
                                            item_name: 'Premium Widget',
                                            item_brand: 'WidgetCo',
                                            item_category: 'Electronics',
                                            item_variant: 'Blue',
                                            price: 29.99,
                                            quantity: 1,
                                        },
                                    ],
                                },
                            },
                            trace: 'at HTMLButtonElement.<anonymous> (index.html:120:32)',
                            afterPageLoadMs: 1250,
                        },
                        {
                            id: 'entry-0-2',
                            name: 'dataLayer',
                            event: {
                                event: 'add_to_cart',
                                ecommerce: {
                                    currency: 'USD',
                                    value: 29.99,
                                    items: [
                                        {
                                            item_id: 'SKU_12345',
                                            item_name: 'Premium Widget',
                                            item_brand: 'WidgetCo',
                                            item_category: 'Electronics',
                                            price: 29.99,
                                            quantity: 1,
                                        },
                                    ],
                                },
                            },
                            trace: 'at HTMLButtonElement.<anonymous> (index.html:142:32)',
                            afterPageLoadMs: 2800,
                        },
                    ],
                    url: 'https://www.example.com/',
                    updatedAtMs: Date.now() - 120000,
                },
                {
                    id: 'page-1',
                    entries: [
                        {
                            id: 'entry-1-0',
                            name: 'dataLayer',
                            event: {
                                event: 'page_view',
                                page_title: 'Product Details - Premium Widget',
                                page_location: 'https://www.example.com/products/premium-widget',
                                page_path: '/products/premium-widget',
                            },
                            trace: 'at HTMLButtonElement.<anonymous> (index.html:89:32)',
                            afterPageLoadMs: 75,
                        },
                        {
                            id: 'entry-1-1',
                            name: 'dataLayer',
                            event: {
                                event: 'select_item',
                                ecommerce: {
                                    item_list_id: 'featured_products',
                                    item_list_name: 'Featured Products',
                                    items: [
                                        {
                                            item_id: 'SKU_12345',
                                            item_name: 'Premium Widget',
                                        },
                                    ],
                                },
                            },
                            trace: 'at HTMLButtonElement.<anonymous> (index.html:202:32)',
                            afterPageLoadMs: 1500,
                        },
                        {
                            id: 'entry-1-2',
                            name: 'dataLayer',
                            event: {
                                event: 'view_promotion',
                                ecommerce: {
                                    creative_name: 'summer_banner',
                                    creative_slot: 'hero_banner',
                                    promotion_id: 'SUMMER2026',
                                    promotion_name: 'Summer Sale',
                                    items: [
                                        {
                                            item_id: 'SKU_12345',
                                            item_name: 'Premium Widget',
                                        },
                                    ],
                                },
                            },
                            trace: 'at HTMLButtonElement.<anonymous> (index.html:218:32)',
                            afterPageLoadMs: 3200,
                        },
                        {
                            id: 'entry-1-3',
                            name: 'dataLayer',
                            event: {
                                event: 'begin_checkout',
                                ecommerce: {
                                    currency: 'USD',
                                    value: 59.98,
                                    items: [
                                        {
                                            item_id: 'SKU_12345',
                                            item_name: 'Premium Widget',
                                            price: 29.99,
                                            quantity: 2,
                                        },
                                    ],
                                },
                            },
                            trace: 'at HTMLButtonElement.<anonymous> (index.html:178:32)',
                            afterPageLoadMs: 5100,
                        },
                    ],
                    url: 'https://www.example.com/products/premium-widget',
                    updatedAtMs: Date.now() - 60_000,
                },
                {
                    id: 'page-2',
                    entries: [
                        {
                            id: 'entry-2-0',
                            name: 'dataLayer',
                            event: {
                                event: 'page_view',
                                page_title: 'Checkout',
                                page_location: 'https://www.example.com/checkout',
                                page_path: '/checkout',
                            },
                            trace: 'at HTMLButtonElement.<anonymous> (index.html:89:32)',
                            afterPageLoadMs: 100,
                        },
                        {
                            id: 'entry-2-1',
                            name: 'dataLayer',
                            event: {
                                event: 'purchase',
                                ecommerce: {
                                    transaction_id: 'T_1735822800000',
                                    currency: 'USD',
                                    value: 64.98,
                                    tax: 5.0,
                                    shipping: 0,
                                    items: [
                                        {
                                            item_id: 'SKU_12345',
                                            item_name: 'Premium Widget',
                                            price: 29.99,
                                            quantity: 2,
                                        },
                                    ],
                                },
                            },
                            trace: 'at HTMLButtonElement.<anonymous> (index.html:192:32)',
                            afterPageLoadMs: 3500,
                        },
                        {
                            id: 'entry-2-2',
                            name: '_mtm',
                            event: {
                                'mtm.purchase': {
                                    order_id: 'T_1735822800000',
                                    revenue: 64.98,
                                    products: [
                                        {
                                            sku: 'SKU_12345',
                                            name: 'Premium Widget',
                                            price: 29.99,
                                            quantity: 2,
                                        },
                                    ],
                                },
                            },
                            trace: 'at window._mtm.push (matomo.js:45:12)',
                            afterPageLoadMs: 3520,
                        },
                    ],
                    url: 'https://www.example.com/checkout',
                    updatedAtMs: Date.now() - 10_000,
                },
            ],
            maxPages: 8,
            updatedAtMs: Date.now(),
        };
        /* eslint-enable sort-keys-fix/sort-keys-fix */
    }
    return sendToContentScript(EVENT_GET_DATALAYER_PAGES_ENTRIES);
}

// dataLayer sync functions

async function syncDataLayerPageEntriesChecker() {
    const hasSyncedEntries = await syncDataLayerPagesEntries();
    if (hasSyncedEntries) {
        state.emptySyncCounts = 0;
    } else {
        state.emptySyncCounts += 1;
    }

    // Continue for a maximum of 30 times i.e. ~30 seconds
    if (state.emptySyncCounts < 30) {
        state.syncCheckerTimerId = setTimeout(syncDataLayerPageEntriesChecker, 1024);
    } else {
        state.syncCheckerTimerId = 0;
    }
}

async function syncDataLayerRefreshPagesEntries() {
    state.dom.eventsContainer.replaceChildren();
    state.currPageIndex = 0;
    state.currEntriesIndex = 0;

    clearTimeout(state.syncCheckerTimerId);
    state.syncCheckerTimerId = 0;

    state.emptySyncCounts = 0;

    return syncDataLayerPagesEntries();
}

async function syncDataLayerPagesEntries() {
    const hasMaxPagesLimit = state.config.maxPages > 0;

    const pagesEntries = await queryDataLayerPagesEntries();
    const currPageIndex = pagesEntries.pages.length - 1;
    state.currPageIndex = Math.min(state.currPageIndex, currPageIndex);

    const currEntriesLength = pagesEntries.pages[state.currPageIndex]?.entries?.length ?? 0;
    const hasSyncableEntries = state.currEntriesIndex < currEntriesLength;

    for (; state.currPageIndex < pagesEntries.pages.length; state.currPageIndex += 1) {
        const isCurrPage = state.currPageIndex === currPageIndex;
        if (!hasMaxPagesLimit && !isCurrPage) {
            // Skip showing older pages when there is no max pages limit
            continue;
        }

        const page = pagesEntries.pages[state.currPageIndex];

        for (; state.currEntriesIndex < page.entries.length; state.currEntriesIndex += 1) {
            const entry = page.entries[state.currEntriesIndex];
            const entryIdx = state.currEntriesIndex + 1;

            const eventEl = createEventElement(page, entry, entryIdx);
            state.dom.eventsContainer.insertBefore(eventEl, state.dom.eventsContainer.firstChild);
        }

        // Reset entries index for the next page
        if (!isCurrPage) {
            state.currEntriesIndex = 0;

            const headerEl = createPageHeaderElement(page);
            state.dom.eventsContainer.insertBefore(headerEl, state.dom.eventsContainer.firstChild);
        }
    }
    if (!hasSyncableEntries) {
        return false;
    }

    syncFilterPageEntries(state.dom.search.value);

    return true;
}

async function syncPageEntriesExpandedOrCollapsed(btnEl, expandAll) {
    animate(btnEl);

    const eventEls = state.dom.eventsContainer.querySelectorAll('.event');
    updatePageEntriesExpandOrCollapse(eventEls, expandAll);

    await syncConfig({
        expandAll,
    });
}

function updatePageEntriesExpandOrCollapse(eventEls, expandAll) {
    for (const eventEl of eventEls) {
        eventEl.classList.toggle('show', expandAll);

        const entryId = eventEl.getAttribute('data-entry-id');
        state.expanded.entryIds.set(entryId, expandAll);
    }
}

function syncFilterPageEntries(searchTerm) {
    const matchedPageIds = new Set();
    const eventEls = state.dom.eventsContainer.querySelectorAll('.event');
    for (const eventEl of eventEls) {
        const { decoded: eventDecoded } = getEventDataFromElement(eventEl);
        const matches = isMatch(eventDecoded, searchTerm);
        eventEl.classList.toggle('hide', !matches);

        if (matches) {
            matchedPageIds.add(eventEl.getAttribute('data-page-id'));
        }
    }

    const headerEls = state.dom.eventsContainer.querySelectorAll('.page-header');
    for (const headerEl of headerEls) {
        const pageId = headerEl.getAttribute('data-page-id');
        headerEl.classList.toggle('hide', !matchedPageIds.has(pageId));
    }

    state.dom.eventsStatus.classList.toggle('hide', matchedPageIds.size > 0);
}

function isMatch(str, query) {
    if (query.length === 0) {
        return true;
    }

    str = str.toLowerCase();
    query = query.toLowerCase();

    return str.includes(query);
}

// DOM functions

function getPagesDataFromEventElements(eventEls) {
    const idxByPageId = new Map();
    const pages = [];

    for (const eventEl of eventEls) {
        const pageId = eventEl.getAttribute('data-page-id');
        if (!idxByPageId.has(pageId)) {
            const pageIdx = pages.length;
            idxByPageId.set(pageId, pageIdx);

            const pageURL = safeDecode(eventEl.getAttribute('data-page-url'));

            /* eslint-disable sort-keys-fix/sort-keys-fix */
            pages[pageIdx] = {
                url: pageURL,
                events: [],
            };
            /* eslint-enable sort-keys-fix/sort-keys-fix */
        }

        const pageIdx = idxByPageId.get(pageId);
        const { parsed: eventData } = getEventDataFromElement(eventEl);
        pages[pageIdx].events.push(eventData);
    }

    return pages;
}

function getEventDataFromElement(eventEl) {
    const eventDecoded = safeDecode(eventEl.getAttribute('data-entry-event'));
    return {
        decoded: eventDecoded,
        parsed: JSON.parse(eventDecoded),
    };
}

function renderEventData(eventDataEl, event, strEvent, formatMode) {
    if (formatMode === FORMAT_MODE_COLUMN) {
        eventDataEl.innerHTML = formatAsColumn(event);
    } else {
        eventDataEl.innerHTML = formatAsJSON(strEvent);
    }
}

function createPageHeaderElement(page) {
    const template = document.getElementById('page-header-template');
    const fragment = template.content.cloneNode(true);

    const headerEl = fragment.querySelector('.page-header');
    headerEl.setAttribute('data-page-id', page.id);
    headerEl.title = page.url;

    const isExpanded = state.expanded.pageHeaders.get(page.id) ?? true;
    if (!isExpanded) {
        headerEl.classList.remove('show');
    }

    const urlLinkEl = fragment.querySelector('.page-header-url');
    urlLinkEl.href = page.url;
    urlLinkEl.textContent = page.url;

    const timeEl = fragment.querySelector('.page-header-time');
    timeEl.textContent = toHumanTimeStringMs(page.updatedAtMs);

    const pageAdvancedInfoEl = fragment.querySelector('.page-header-advanced-info');
    const pageAdvancedInfoExpanded = state.expanded.pageAdvancedInfoIds.get(page.id) ?? false;
    pageAdvancedInfoEl.classList.toggle('show', pageAdvancedInfoExpanded);

    const eventCount = page.entries?.length ?? 0;
    fragment.querySelector('.page-header-event-count').textContent = eventCount;
    fragment.querySelector('.page-header-event-label').textContent = eventCount === 1 ? 'event' : 'events';
    fragment.querySelector('.page-header-loaded-time').textContent = toHumanTimeStringMs(page.updatedAtMs);

    return fragment;
}

function createEventElement(page, entry, entryIdx) {
    const strEvent = JSON.stringify(entry.event, undefined, 2);
    const strAfterPageLoadMs = toDurationStringMs(entry.afterPageLoadMs);

    const template = document.getElementById('event-template');
    const fragment = template.content.cloneNode(true);

    const eventEl = fragment.querySelector('.event');
    eventEl.setAttribute('data-page-id', page.id);
    eventEl.setAttribute('data-page-url', safeEncode(page.url));
    eventEl.setAttribute('data-entry-id', entry.id);
    eventEl.setAttribute('data-entry-event', safeEncode(strEvent));

    eventEl.className = 'event';
    if (entry.event?.event === 'gtm.historyChange-v2') {
        eventEl.classList.add('page-change');
    }

    const pageHeaderExpanded = state.expanded.pageHeaders.get(page.id) ?? true;
    if (!pageHeaderExpanded) {
        eventEl.classList.add('page-collapsed');
    }

    const eventExpanded = state.expanded.entryIds.get(entry.id) ?? state.config.expandAll;
    if (eventExpanded) {
        eventEl.classList.add('show');
    }

    const eventNameEl = fragment.querySelector('.event-name');
    eventNameEl.setAttribute(
        'title',
        `Event was sent ${strAfterPageLoadMs} after the initial page load and was pushed to window.${entry.name}.`,
    );

    fragment.querySelector('.event-index').textContent = entryIdx;
    fragment.querySelector('.event-name-text').textContent = getEventName(entry.event);

    const iconContainerEl = fragment.querySelector('.event-icon-container');
    const iconEl = getEventIconElement(entry);
    if (iconEl) {
        iconContainerEl.appendChild(iconEl);
    }

    const formatMode = state.formatModes.entryIds.get(entry.id) ?? state.config.formatMode;
    const eventDataEl = fragment.querySelector('.event-data');
    renderEventData(eventDataEl, entry.event, strEvent, formatMode);

    const eventAdvancedInfoEl = fragment.querySelector('.event-advanced-info');

    const eventAdvancedInfoExpanded = state.expanded.advancedInfoEntryIds.get(entry.id) ?? false;
    eventAdvancedInfoEl.classList.toggle('show', eventAdvancedInfoExpanded);

    fragment.querySelector('.event-after-load-time').textContent = strAfterPageLoadMs;
    fragment.querySelector('.event-pushed-to').textContent = `window.${entry.name}`;
    fragment.querySelector('.event-trace').textContent = entry.trace;

    return fragment;
}

function getEventName(obj) {
    if (!isObject(obj)) {
        return 'unknown data';
    }

    if (isString(obj.event)) {
        return obj.event;
    }

    const eventName = getFirstFlattenedKey(obj, 2);
    if (isString(eventName) && eventName.length > 0) {
        return eventName;
    }
    return 'unknown data';
}

function getEventIconElement(entry) {
    switch (entry.name) {
        case 'dataLayer': {
            if (!isObject(entry.event) || !isString(entry.event.event)) {
                return undefined;
            }

            const eventInfo = GA.getEventInfo(entry.event);
            if (!isObject(eventInfo)) {
                return undefined;
            }

            const template = document.querySelector('#ga4-icon-template');
            const fragment = template.content.cloneNode(true);
            const linkEl = fragment.querySelector('a');
            linkEl.href = eventInfo.url;

            return fragment;
        }
        case '_mtm': {
            const template = document.querySelector('#matomo-icon-template');
            return template.content.cloneNode(true);
        }
        default:
            return undefined;
    }
}

// Shared utils

function debounce(fn, delay) {
    let timerId = 0;
    return (...args) => {
        clearTimeout(timerId);
        timerId = setTimeout(() => {
            try {
                fn(...args);
            } catch (err) {
                // NOTE: Don't log as a warning, as this will show up in the Chrome extension's error listing
                console.info(MODULE, err instanceof Error ? err.message : 'An unexpected error occurred');
            }
        }, delay);
    };
}

async function sendToBackground(event, data = undefined) {
    /* eslint-disable sort-keys-fix/sort-keys-fix */
    return chrome.runtime.sendMessage({
        event,
        data,
    });
    /* eslint-enable sort-keys-fix/sort-keys-fix */
}

async function sendToContentScript(event, data = undefined) {
    const tab = await getCurrentTab();
    return chrome.tabs.sendMessage(tab.id, {
        data,
        event,
    });
}

async function getCurrentTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab;
}
