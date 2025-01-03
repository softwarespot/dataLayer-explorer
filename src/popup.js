/* eslint-disable n/no-unsupported-features/node-builtins */
import * as GA from './ga4.js';

// This is set to "development" when using "npm run start"
const ENVIRONMENT = 'production';

// Taken from "background.js"
const EVENT_DATALAYER_LOADING = 'DATALAYER_LOADING';
const EVENT_DATALAYER_FOUND = 'DATALAYER_FOUND';
const EVENT_DATALAYER_NOT_FOUND = 'DATALAYER_NOT_FOUND';

// Taken from "contentScript.js"
const EVENT_GET_DATALAYER_STATUS = 'GET_DATALAYER_STATUS';
const EVENT_GET_DATALAYER_ENTRIES = 'GET_DATALAYER_ENTRIES';

/* eslint-disable sort-keys-fix/sort-keys-fix */
const state = {
    dom: {
        title: document.getElementById('header-title'),
        search: document.getElementById('search'),
        copyAllBtn: document.getElementById('copy-all-btn'),
        expandAllBtn: document.getElementById('expand-all-btn'),
        collapseAllBtn: document.getElementById('collapse-all-btn'),
        refreshBtn: document.getElementById('refresh-btn'),
        eventsStatus: document.getElementById('events-status'),
        status: document.getElementById('status'),
        eventsContainer: document.getElementById('events-container'),
    },
    config: {
        searchTerm: '',
        expandAll: false,
    },
    currEventsIndex: 0,
};
/* eslint-enable sort-keys-fix/sort-keys-fix */

addEventListener(document, 'DOMContentLoaded', async () => {
    await initConfig();
    await syncAppVersion();
    await syncSearchTermInput(state.config.searchTerm);

    const status = await queryDataLayerStatus();
    switch (status) {
        case EVENT_DATALAYER_FOUND: {
            const els = document.querySelectorAll('.hide');
            for (const el of els) {
                el.classList.remove('hide');
            }
            state.dom.status.classList.add('hide');

            await syncDataLayerEntries();
            registerSyncDataLayerEntries();
            break;
        }
        case EVENT_DATALAYER_NOT_FOUND:
            state.dom.status.classList.add('error');
            state.dom.status.textContent = 'dataLayer is not available on this page.';
            break;
    }

    // Create DOM event handlers
    const deferSetSearchTerm = registerSetSearchTerm();
    addEventListener(state.dom.search, 'input', async (event) => {
        const searchTerm = event.target.value;
        syncFilterDataLayerEntries(searchTerm);
        deferSetSearchTerm(searchTerm);
    });

    addEventListener(state.dom.copyAllBtn, 'click', async (event) => {
        const events = [];
        const els = state.dom.eventsContainer.querySelectorAll('.event');
        for (const el of els) {
            const eventDecoded = encodedAtob(el.getAttribute('data-event'));
            const event = JSON.parse(eventDecoded);
            events.push(event);
        }
        if (copyToClipboard(JSON.stringify(events, undefined, 2))) {
            animate(event.target);
        }
    });

    addEventListener(state.dom.expandAllBtn, 'click', (event) => {
        syncDataLayerEntriesCollapsable(event.target, true);
    });

    addEventListener(state.dom.collapseAllBtn, 'click', (event) => {
        syncDataLayerEntriesCollapsable(event.target, false);
    });

    addEventListener(state.dom.refreshBtn, 'click', async (event) => {
        animate(event.target);

        await syncDataLayerEntries();
    });

    addEventListener(document, 'click', '.event-name', (event, targetEl) => {
        const eventEl = targetEl.closest('.event');
        eventEl.classList.toggle('show');
    });

    addEventListener(document, 'click', 'a', (event, targetEl) => {
        if (ENVIRONMENT === 'development') {
            return;
        }

        // Links cannot be opened directly from a popup according to documentation
        event.stopPropogation();
        chrome.tabs.create({
            active: true,
            url: targetEl.href,
        });
    });

    addEventListener(document, 'click', '.event-copy-btn', (event, targetEl) => {
        const eventEl = targetEl.closest('.event');
        const eventDecoded = encodedAtob(eventEl.getAttribute('data-event'));
        if (copyToClipboard(eventDecoded)) {
            animate(targetEl);
        }
    });

    addEventListener(document, 'click', '.event-advanced-info-btn', (event, targetEl) => {
        animate(targetEl);
        const eventEl = targetEl.closest('.event');
        eventEl.classList.add('show');

        // The event content is the next sibling in the DOM tree
        const eventTraceEl = eventEl.nextElementSibling.querySelector('.event-advanced-info');
        eventTraceEl.classList.toggle('show');
    });
});

async function initConfig() {
    if (ENVIRONMENT === 'development') {
        const res = sessionStorage.getItem('config');
        if (isString(res)) {
            const cfg = JSON.parse(res);
            state.config = {
                ...state.config,
                ...cfg,
            };
        }
    } else {
        const res = await chrome.storage.session.get(['config']);
        if (isObject(res.config)) {
            state.config = {
                ...state.config,
                ...res.config,
            };
        }
    }
}

function syncConfig(cfgPartial) {
    state.config = {
        ...state.config,
        ...cfgPartial,
    };
    if (ENVIRONMENT === 'development') {
        sessionStorage.setItem('config', JSON.stringify(state.config));
    } else {
        chrome.storage.session.set({
            config: state.config,
        });
    }
}

async function syncAppVersion() {
    if (ENVIRONMENT === 'development') {
        state.dom.title.setAttribute('title', `${state.dom.title.textContent} v0.0.0`);
    } else {
        const manifest = chrome.runtime.getManifest();
        state.dom.title.setAttribute('title', `${state.dom.title.textContent} v${manifest.version}`);
    }
}

function registerSyncDataLayerEntries() {
    let emptySyncCounts = 0;
    async function syncDataLayerEntriesChecker() {
        const syncedEntries = await syncDataLayerEntries();
        if (syncedEntries) {
            emptySyncCounts = 0;
        } else {
            emptySyncCounts += 1;
        }

        // Continue for a maximum of 30 times
        if (emptySyncCounts < 30) {
            setTimeout(syncDataLayerEntriesChecker, 1024);
        }
    }
    syncDataLayerEntriesChecker();
}

async function syncSearchTermInput(searchTerm) {
    state.dom.search.value = searchTerm;
}

function registerSetSearchTerm() {
    return debounce((searchTerm) => {
        syncConfig({
            searchTerm,
        });
    }, 256);
}

function syncDataLayerEntriesCollapsable(el, expandAll) {
    animate(el);

    const els = state.dom.eventsContainer.querySelectorAll('.event');
    for (const el of els) {
        if (expandAll) {
            el.classList.add('show');
        } else {
            el.classList.remove('show');
        }
    }

    syncConfig({
        expandAll,
    });
}

async function queryDataLayerStatus() {
    if (ENVIRONMENT === 'development') {
        return EVENT_DATALAYER_FOUND;
    }

    while (true) {
        try {
            const data = await sendToContentScript(EVENT_GET_DATALAYER_STATUS);
            switch (data.status) {
                case EVENT_DATALAYER_FOUND:
                case EVENT_DATALAYER_NOT_FOUND:
                    return data.status;
                case EVENT_DATALAYER_LOADING:
                default:
                    // Continue to wait for the status from the "contentScript.js"
                    break;
            }
            await sleep(512);
        } catch {
            // Ignore the error, as it means the "contentScript.js" is not available
            return EVENT_DATALAYER_LOADING;
        }
    }
}

async function queryDataLayerEntries() {
    if (ENVIRONMENT === 'development') {
        return [
            {
                afterPageLoadMs: 5000,
                event: {
                    eventName: 'generic_event_1',
                    genericTimestamp: 1234567890123,
                },
                trace: 'Example stack trace',
            },
            {
                afterPageLoadMs: 5000,
                event: {
                    event: 'select_item',
                },
                trace: 'Example stack trace',
            },
            {
                afterPageLoadMs: 5000,
                event: {
                    genericProperty: null,
                },
                trace: 'Example stack trace',
            },
            {
                afterPageLoadMs: 5000,
                event: {
                    eventName: 'generic_event_2',
                    genericAttribute1: '<a href="">Generic Link</a>',
                    genericAttribute2: '',
                    pageTitle: 'Generic Page Title',
                    pageUrl: 'https://www.example.com/',
                    url: 'https://www.example.com/',
                    userStatus: 'generic_Status',
                },
                trace: 'Example stack trace',
            },
            {
                afterPageLoadMs: 5000,
                event: {
                    contentId: 'Generic Content ID',
                    contentIndex: 2,
                    contentType: 'Generic Content Type',
                    eventName: 'generic_event_3',
                    linkUrl: 'https://example.com/generic-product',
                },
                trace: 'Example stack trace',
            },
            {
                afterPageLoadMs: 5000,
                event: {
                    genericObject: {
                        genericView: {
                            items: [],
                            mode: '',
                        },
                    },
                },
                trace: 'Example stack trace',
            },
        ];
    }

    const data = await sendToContentScript(EVENT_GET_DATALAYER_ENTRIES);
    return JSON.parse(data.entries);
}

async function syncDataLayerEntries() {
    const entries = await queryDataLayerEntries();
    const hasSynableEntries = state.currEventsIndex < entries.length;
    for (; state.currEventsIndex < entries.length; state.currEventsIndex += 1) {
        const entry = entries[state.currEventsIndex];
        const entryIdx = state.currEventsIndex + 1;
        const event = JSON.stringify(entry.event, null, 2);
        const afterPageLoad = toDurationString(entry.afterPageLoadMs);

        const isGTMHistoryChangeV2 = entry.event?.event === 'gtm.historyChange-v2';
        const evtClassNames = [
            'event',
            isGTMHistoryChangeV2 ? 'page-change' : '',
            state.config.expandAll ? 'show' : '',
        ];
        const eventHTML = `
        <div class="${evtClassNames.join(' ')}" data-event="${encodedBtoa(event)}">
            <div class="event-name" title="Event was sent ${afterPageLoad} after the initial page load.">
                <span class="event-index">${entryIdx}</span>
                ${getEventName(entry.event)}
            </div>
            <div class="event-btns">
                ${getEventIconGA4(entry.event)}
                <button class="event-copy-btn btn" title="Copy the dataLayer event to the clipboard.">&#128203;</button>
                <button class="eye-icon event-advanced-info-btn btn" title="Display advanced information about the event.">&#128065;</button>
            </div>
        </div>
        <div class="event-content">
            <pre>${jsonSyntaxHighlight(event)}</pre>
            <div class="event-advanced-info">
                <hr />
                <h2>Advanced information</h2>
                <p>The event was sent ${afterPageLoad} after the initial page load.</p>
                <h3>Stack trace</h3>
                <pre style="font-size: 1em">${entry.trace}</pre>
            </div>
        </div>
    `;
        state.dom.eventsContainer.insertAdjacentHTML('afterbegin', eventHTML);
    }
    if (!hasSynableEntries) {
        return false;
    }

    syncFilterDataLayerEntries(state.dom.search.value);
    return true;
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

function getEventIconGA4(obj) {
    if (!isObject(obj) || !isString(obj.event)) {
        return '';
    }

    const eventInfo = GA.getEventInfo(obj.event);
    if (!isObject(eventInfo)) {
        return '';
    }
    return `
        <a href="${eventInfo.url}" class="btn" title="This is a Google Analytics 4 (GA4) event." target="_blank" rel="noopener noreferrer">
            <img src="./icons/ga4.svg" class="ga4-icon" />
        </a>
    `;
}

function getFirstFlattenedKey(obj, depth = 2, currDepth = 1) {
    if (!isObject(obj)) {
        return undefined;
    }

    for (const key in obj) {
        if (!Object.hasOwn(obj, key)) {
            continue;
        }
        if (currDepth === depth) {
            return key;
        }

        const nextKey = getFirstFlattenedKey(obj[key], depth, currDepth + 1);
        if (isString(nextKey) && nextKey.length > 0) {
            return `${key}.${nextKey}`;
        }
        return key;
    }
    return undefined;
}

function syncFilterDataLayerEntries(searchTerm) {
    const els = state.dom.eventsContainer.querySelectorAll('.event');
    for (const el of els) {
        const eventDecoded = encodedAtob(el.getAttribute('data-event'));
        if (isMatching(eventDecoded, searchTerm)) {
            el.classList.remove('hide');
        } else {
            el.classList.add('hide');
        }
    }

    const hiddenEls = state.dom.eventsContainer.querySelectorAll('.event:not(.hide)');
    if (hiddenEls.length === 0) {
        state.dom.eventsStatus.classList.remove('hide');
    } else {
        state.dom.eventsStatus.classList.add('hide');
    }
}

function isMatching(str, query) {
    if (query.length === 0) {
        return true;
    }

    str = str.toLowerCase();
    query = query.toLowerCase();

    return str.includes(query);
}

function jsonSyntaxHighlight(data) {
    // Taken from URL: https://codepen.io/absolutedevelopment/pen/EpwVzN
    const reParseJSON =
        // eslint-disable-next-line security/detect-unsafe-regex, sonarjs/regex-complexity
        /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g;
    return data
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replace(reParseJSON, (str) => {
            const className = getJSONSyntaxHighlightClassName(str);
            return `<span class="${className}">${truncate(str, 256)}</span>`;
        });
}

function getJSONSyntaxHighlightClassName(str) {
    if (str.startsWith('"')) {
        if (str.endsWith(':')) {
            return 'json-key';
        }
        return 'json-string';
    }
    if (str === 'true' || str === 'false') {
        return 'json-boolean';
    }
    if (str === 'null') {
        return 'json-null';
    }
    return 'json-number';
}

// Utils

function animate(el) {
    el.classList.add('animate');

    // Remove after 0.3s, which is the same as the CSS animation
    setTimeout(() => el.classList.remove('animate'), 300);
}

function addEventListener(el, eventName, selector, fn) {
    if (isFunction(fn)) {
        fn = createDelegateEventHandler(el, selector, fn);
    } else {
        fn = selector;
    }
    el.addEventListener(eventName, fn);
}

function createDelegateEventHandler(el, selector, fn) {
    return (event) => {
        const targetEl = event.target.closest(selector);
        if (targetEl && el.contains(targetEl)) {
            fn(event, targetEl);
        }
    };
}

// Taken from URL: https://stackoverflow.com/questions/400212/how-do-i-copy-to-the-clipboard-in-javascript
// NOTE: This is due to "navigator.clipboard.writeText" requiring HTTPS
function copyToClipboard(text) {
    const el = document.createElement('textarea');
    try {
        el.value = text;

        // Avoid scrolling to the bottom
        el.style.top = '0';
        el.style.left = '0';
        el.style.position = 'fixed';

        document.body.appendChild(el);
        el.focus();
        el.select();

        document.execCommand('copy');
        return true;
    } catch {
        // Ignore error
    } finally {
        document.body.removeChild(el);
    }
    return false;
}

function isFunction(obj) {
    return typeof obj === 'function';
}

function isObject(obj) {
    return Object(obj) === obj;
}

function isString(obj) {
    return typeof obj === 'string';
}

async function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(() => resolve(), ms);
    });
}

function toDurationString(ms) {
    // Originally taken from URL: https://stackoverflow.com/a/34270811
    // Taken from URL: https://madza.hashnode.dev/24-modern-es6-code-snippets-to-solve-practical-js-problems
    const sign = ms < 0 ? '-' : '';
    const absMS = Math.abs(Math.round(ms));
    if (absMS === 0) {
        return `${sign}0ms`;
    }

    if (Number.isNaN(absMS)) {
        return '"invalid milliseconds"';
    }

    /* eslint-disable sort-keys-fix/sort-keys-fix */
    const time = {
        d: Math.floor(absMS / 86400000),
        h: Math.floor(absMS / 3600000) % 24,
        m: Math.floor(absMS / 60000) % 60,
        s: Math.floor(absMS / 1000) % 60,
        ms: Math.floor(absMS) % 1000,
    };
    /* eslint-enable sort-keys-fix/sort-keys-fix */

    return (
        sign +
        Object.entries(time)
            .filter(([, value]) => value > 0)
            .map(([key, value]) => `${value}${key}`)
            .join('')
    );
}

function truncate(str, maxLen, prefix = '...') {
    str = String(str);
    return str.length > maxLen ? `${str.substr(0, maxLen)}${prefix}` : str;
}

function encodedBtoa(str) {
    return btoa(encodeURIComponent(str));
}

function encodedAtob(str) {
    return decodeURIComponent(atob(str));
}

// Shared utils

function debounce(fn, delay) {
    let timerId = 0;
    return (...args) => {
        clearTimeout(timerId);
        timerId = setTimeout(() => fn(...args), delay);
    };
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
