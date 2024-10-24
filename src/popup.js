/* eslint-disable sonarjs/no-duplicate-string */

import * as GA from './ga4.js';

// Comment one of these out, depending on whether the extension is being tested or not
const ENVIRONMENT = 'production';
// const ENVIRONMENT = 'development';

// Taken from "background.js"
const EVENT_LOAD_CONFIG = 'LOAD_CONFIG';

const EVENT_DATALAYER_LOADING = 'DATALAYER_LOADING';
const EVENT_DATALAYER_FOUND = 'DATALAYER_FOUND';
const EVENT_DATALAYER_NOT_FOUND = 'DATALAYER_NOT_FOUND';

// Taken from "contentscript.js"
const EVENT_GET_DATALAYER_STATUS = 'GET_DATALAYER_STATUS';
const EVENT_GET_DATALAYER_ENTRIES = 'GET_DATALAYER_ENTRIES';

/* eslint-disable sort-keys-fix/sort-keys-fix */
const state = {
    dom: {
        title: undefined,
        search: undefined,
        expandAllBtn: undefined,
        collapseAllBtn: undefined,
        refreshBtn: undefined,
        collapsibleContainer: undefined,
    },
    eventsIndex: 0,
};
/* eslint-enable sort-keys-fix/sort-keys-fix */

state.dom.title = document.getElementById('header-title');
state.dom.search = document.getElementById('search');

state.dom.expandAllBtn = document.getElementById('expand-all-btn');
state.dom.expandAllBtn.addEventListener('click', async (event) => {
    animate(event.target);

    const els = state.dom.collapsibleContainer.querySelectorAll('.collapsible-entry');
    for (const el of els) {
        el.classList.add('active');
    }
});

state.dom.collapseAllBtn = document.getElementById('collapse-all-btn');
state.dom.collapseAllBtn.addEventListener('click', async (event) => {
    animate(event.target);

    const els = state.dom.collapsibleContainer.querySelectorAll('.collapsible-entry');
    for (const el of els) {
        el.classList.remove('active');
    }
});

state.dom.refreshBtn = document.getElementById('refresh-btn');
state.dom.refreshBtn.addEventListener('click', async (event) => {
    animate(event.target);

    await syncDataLayerEntries();
    syncSearchTerm(state.dom.search.value);
});

state.dom.collapsibleContainer = document.getElementById('collapsible-container');

document.addEventListener('DOMContentLoaded', async () => {
    await syncVersion();

    state.dom.collapsibleContainer.textContent = 'Checking if dataLayer is available on this page...';
    const status = await queryDataLayerStatus();
    switch (status) {
        case EVENT_DATALAYER_FOUND: {
            state.dom.collapsibleContainer.textContent = '';
            await syncDataLayerEntries();
            syncSearchTerm(state.dom.search.value);
            break;
        }
        case EVENT_DATALAYER_NOT_FOUND:
            state.dom.collapsibleContainer.textContent = 'dataLayer is not available on this page.';
            break;
    }

    addEventListener(document, 'click', '.collapsible-entry-text', (event, targetEl) => {
        const entryEl = targetEl.closest('.collapsible-entry');
        entryEl.classList.toggle('active');
    });

    addEventListener(document, 'click', '.collapsible-copy-btn', (event, targetEl) => {
        const entryEl = targetEl.closest('.collapsible-entry');
        const entryDecoded = extendedAtob(entryEl.getAttribute('data-event'));
        if (copyToClipboard(entryDecoded)) {
            animate(targetEl);
        }
    });

    state.dom.search.addEventListener('input', (event) => {
        const searchTerm = event.target.value;
        syncSearchTerm(searchTerm);
    });

    addEventListener(document, 'click', 'a', (event, targetEl) => {
        if (ENVIRONMENT === 'production') {
            // Links cannot be opened directly from a popup
            chrome.tabs.create({
                active: true,
                url: targetEl.href,
            });
        }
    });
});

async function syncVersion() {
    if (ENVIRONMENT === 'development') {
        state.dom.title.setAttribute('title', `${state.dom.title.textContent} v0.0.0`);
        return;
    }

    const cfg = await sendToBackground(EVENT_LOAD_CONFIG);
    state.dom.title.setAttribute('title', `${state.dom.title.textContent} v${cfg.version}`);
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
                    // Continue to wait for the status from the "contentscript.js"
                    break;
            }
            await sleep(512);
        } catch {
            // Ignore the error, as it means the "contentscript.js" is not available
            return EVENT_DATALAYER_LOADING;
        }
    }
}

async function queryDataLayerEntries() {
    if (ENVIRONMENT === 'development') {
        return [
            {
                event: {
                    eventName: 'genericEvent1',
                    genericTimestamp: 1234567890123,
                },
                ts: 5000,
            },
            {
                event: {
                    event: 'select_item',
                },
                ts: 5000,
            },
            {
                event: {
                    genericProperty: null,
                },
                ts: 5000,
            },
            {
                event: {
                    eventName: 'genericEvent2',
                    genericAttribute1: '<a href="">Generic Link</a>',
                    genericAttribute2: '',
                    pageTitle: 'Generic Page Title',
                    pageUrl: 'https://www.example.com/',
                    url: 'https://www.example.com/',
                    userStatus: 'genericStatus',
                },
                ts: 5000,
            },
            {
                event: {
                    contentId: 'Generic Content ID',
                    contentIndex: 2,
                    contentType: 'Generic Content Type',
                    eventName: 'genericEvent3',
                    linkUrl: 'https://example.com/generic-product',
                },
                ts: 5000,
            },
            {
                event: {
                    genericObject: {
                        genericView: {
                            items: [],
                            mode: '',
                        },
                    },
                },
                ts: 5000,
            },
        ];
    }

    const data = await sendToContentScript(EVENT_GET_DATALAYER_ENTRIES);
    return JSON.parse(data.entries);
}

async function syncDataLayerEntries() {
    const entries = await queryDataLayerEntries();
    for (; state.eventsIndex < entries.length; state.eventsIndex += 1) {
        const entry = entries[state.eventsIndex];
        const entryIdx = state.eventsIndex + 1;
        const event = JSON.stringify(entry.event, null, 2);

        const isGTMHistoryChangeV2 = entry.event?.event === 'gtm.historyChange-v2';
        const entryHTML = `
        <div class="collapsible-entry ${isGTMHistoryChangeV2 ? 'page-change' : ''}" data-event=${extendedBtoa(event)}>
            <div class="collapsible-entry-text">
                <span class="collapsible-entry-index" title="Event was sent ${toDurationString(entry.ts)} after the initial page load.">${entryIdx}</span>
                ${getEventName(entry.event)}
            </div>
            <div class="collapsible-entry-btns">
                ${getGA4EventIcon(entry.event)}
                <button class="btn collapsible-copy-btn" title="Copy the dataLayer event to the clipboard.">
                    <span style="font-size: .875em; left: -.125em; margin-right: .125em; position: relative; top: -.15em;">
                        📄
                        <span style="left: .15em; position: absolute; top: .15em;">
                            📄
                        </span>
                    </span>
                </button>
            </div>
        </div>
        <div class="collapsible-content">
            <pre>${syntaxHighlight(event)}</pre>
        </div>
    `;
        state.dom.collapsibleContainer.insertAdjacentHTML('afterbegin', entryHTML);
    }
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

function getGA4EventIcon(obj) {
    if (!isObject(obj) || !isString(obj.event)) {
        return '';
    }

    const eventInfo = GA.getEventInfo(obj.event);
    if (!isObject(eventInfo)) {
        return '';
    }
    return `
        <a href="${eventInfo.url}" class="btn" title="This is a Google Analytics 4 (GA4) event." target="_blank" rel="noopener noreferrer">
            <img src="./ga4.svg" class="ga4-icon" />
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

function syncSearchTerm(searchTerm) {
    const els = state.dom.collapsibleContainer.querySelectorAll('.collapsible-entry');
    for (const el of els) {
        const entryDecoded = extendedAtob(el.getAttribute('data-event'));
        if (entryDecoded.includes(searchTerm)) {
            el.classList.remove('hide');
        } else {
            el.classList.add('hide');
        }
    }
}

function syntaxHighlight(data) {
    // Taken from URL: https://codepen.io/absolutedevelopment/pen/EpwVzN
    const reParseJSON =
        // eslint-disable-next-line security/detect-unsafe-regex
        /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g;
    return data
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replace(reParseJSON, (str) => {
            const className = getSyntaxHighlightClassName(str);
            return `<span class="${className}">${truncate(str, 256)}</span>`;
        });
}

function getSyntaxHighlightClassName(str) {
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

function addEventListener(el, eventName, delegateSelector, fn) {
    el.addEventListener(eventName, (event) => {
        let targetEl = event.target;
        while (targetEl && targetEl.nodeType !== Node.DOCUMENT_NODE && el.contains(targetEl)) {
            if (targetEl.matches(delegateSelector)) {
                return fn(event, targetEl);
            }
            targetEl = targetEl.parentNode;
        }
    });
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

function isObject(obj) {
    return obj !== null && typeof obj === 'object';
}

function isString(entry) {
    return typeof entry === 'string';
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

function extendedBtoa(str) {
    return btoa(encodeURIComponent(str));
}

function extendedAtob(str) {
    return decodeURIComponent(atob(str));
}

// Shared utils

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

    /* eslint-disable sort-keys-fix/sort-keys-fix */
    return chrome.tabs.sendMessage(tab.id, {
        event,
        data,
    });
    /* eslint-enable sort-keys-fix/sort-keys-fix */
}

async function getCurrentTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab;
}
