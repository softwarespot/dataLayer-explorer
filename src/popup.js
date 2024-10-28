/* eslint-disable n/no-unsupported-features/node-builtins */
import * as GA from './ga4.js';

// This is set to "development" when using "npm run start"
const ENVIRONMENT = 'production';

// Taken from "background.js"
const EVENT_LOAD_CONFIG = 'LOAD_CONFIG';
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
        expandAllBtn: document.getElementById('expand-all-btn'),
        collapseAllBtn: document.getElementById('collapse-all-btn'),
        refreshBtn: document.getElementById('refresh-btn'),
        status: document.getElementById('status'),
        eventsContainer: document.getElementById('events-container'),
    },
    currEventsIndex: 0,
};
/* eslint-enable sort-keys-fix/sort-keys-fix */

document.addEventListener('DOMContentLoaded', async () => {
    await syncAppVersion();
    const deferSetSearchTerm = await registerSetSearchTerm();

    const status = await queryDataLayerStatus();
    switch (status) {
        case EVENT_DATALAYER_FOUND: {
            const els = document.querySelectorAll('.hide');
            for (const el of els) {
                el.classList.remove('hide');
            }
            state.dom.status.classList.add('hide');

            await syncDataLayerEntries();
            syncSearchTerm(state.dom.search.value);
            break;
        }
        case EVENT_DATALAYER_NOT_FOUND:
            state.dom.status.classList.add('error');
            state.dom.status.textContent = 'dataLayer is not available on this page.';
            break;
    }

    // Create DOM event handlers
    state.dom.search.addEventListener('input', async (event) => {
        const searchTerm = event.target.value;
        syncSearchTerm(searchTerm);
        deferSetSearchTerm();
    });

    state.dom.expandAllBtn.addEventListener('click', async (event) => {
        animate(event.target);

        const els = state.dom.eventsContainer.querySelectorAll('.event');
        for (const el of els) {
            el.classList.add('active');
        }
    });

    state.dom.collapseAllBtn.addEventListener('click', async (event) => {
        animate(event.target);

        const els = state.dom.eventsContainer.querySelectorAll('.event');
        for (const el of els) {
            el.classList.remove('active');
        }
    });

    state.dom.refreshBtn.addEventListener('click', async (event) => {
        animate(event.target);

        await syncDataLayerEntries();
        syncSearchTerm(state.dom.search.value);
    });

    addEventListener(document, 'click', '.event-name', (event, targetEl) => {
        const eventEl = targetEl.closest('.event');
        eventEl.classList.toggle('active');
    });

    addEventListener(document, 'click', 'a', (event, targetEl) => {
        if (ENVIRONMENT === 'development') {
            return;
        }

        // Links cannot be opened directly from a popup
        chrome.tabs.create({
            active: true,
            url: targetEl.href,
        });
    });

    addEventListener(document, 'click', '.event-copy-btn', (event, targetEl) => {
        const eventEl = targetEl.closest('.event');
        const eventDecoded = extendedAtob(eventEl.getAttribute('data-event'));
        if (copyToClipboard(eventDecoded)) {
            animate(targetEl);
        }
    });
});

async function syncAppVersion() {
    if (ENVIRONMENT === 'development') {
        state.dom.title.setAttribute('title', `${state.dom.title.textContent} v0.0.0`);
        return;
    }

    const cfg = await sendToBackground(EVENT_LOAD_CONFIG);
    state.dom.title.setAttribute('title', `${state.dom.title.textContent} v${cfg.version}`);
}

async function registerSetSearchTerm() {
    if (ENVIRONMENT === 'development') {
        const searchTerm = sessionStorage.getItem('popupSearchTerm');
        if (searchTerm) {
            state.dom.search.value = searchTerm;
        }
        return debounce(() => {
            sessionStorage.setItem('popupSearchTerm', state.dom.search.value);
        }, 256);
    }

    const res = await chrome.storage.session.get(['popupSearchTerm']);
    if (res.popupSearchTerm) {
        state.dom.search.value = res.popupSearchTerm;
    }
    return debounce(() => {
        chrome.storage.session.set({
            popupSearchTerm: state.dom.search.value,
        });
    }, 256);
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
                    eventName: 'genericEvent1',
                    genericTimestamp: 1234567890123,
                },
            },
            {
                afterPageLoadMs: 5000,
                event: {
                    event: 'select_item',
                },
            },
            {
                afterPageLoadMs: 5000,
                event: {
                    genericProperty: null,
                },
            },
            {
                afterPageLoadMs: 5000,
                event: {
                    eventName: 'genericEvent2',
                    genericAttribute1: '<a href="">Generic Link</a>',
                    genericAttribute2: '',
                    pageTitle: 'Generic Page Title',
                    pageUrl: 'https://www.example.com/',
                    url: 'https://www.example.com/',
                    userStatus: 'genericStatus',
                },
            },
            {
                afterPageLoadMs: 5000,
                event: {
                    contentId: 'Generic Content ID',
                    contentIndex: 2,
                    contentType: 'Generic Content Type',
                    eventName: 'genericEvent3',
                    linkUrl: 'https://example.com/generic-product',
                },
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
            },
        ];
    }

    const data = await sendToContentScript(EVENT_GET_DATALAYER_ENTRIES);
    return JSON.parse(data.entries);
}

async function syncDataLayerEntries() {
    const entries = await queryDataLayerEntries();
    for (; state.currEventsIndex < entries.length; state.currEventsIndex += 1) {
        const entry = entries[state.currEventsIndex];
        const entryIdx = state.currEventsIndex + 1;
        const event = JSON.stringify(entry.event, null, 2);

        const isGTMHistoryChangeV2 = entry.event?.event === 'gtm.historyChange-v2';
        const eventHTML = `
        <div class="event ${isGTMHistoryChangeV2 ? 'page-change' : ''}" data-event=${extendedBtoa(event)}>
            <div class="event-name" title="Event was sent ${toDurationString(
                entry.afterPageLoadMs,
            )} after the initial load of the page.">
                <span class="event-index">${entryIdx}</span>
                ${getEventName(entry.event)}
            </div>
            <div class="event-btns">
                ${getGA4EventIcon(entry.event)}
                <button class="btn event-copy-btn" title="Copy the dataLayer event to the clipboard.">
                    <span style="font-size: .875em; left: -.125em; margin-right: .125em; position: relative; top: -.15em;">
                        📄
                        <span style="left: .15em; position: absolute; top: .15em;">
                            📄
                        </span>
                    </span>
                </button>
            </div>
        </div>
        <div class="event-content">
            <pre>${syntaxHighlight(event)}</pre>
        </div>
    `;
        state.dom.eventsContainer.insertAdjacentHTML('afterbegin', eventHTML);
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

function syncSearchTerm(searchTerm) {
    const els = state.dom.eventsContainer.querySelectorAll('.event');
    for (const el of els) {
        const eventDecoded = extendedAtob(el.getAttribute('data-event'));
        if (eventDecoded.includes(searchTerm)) {
            el.classList.remove('hide');
        } else {
            el.classList.add('hide');
        }
    }
}

function syntaxHighlight(data) {
    // Taken from URL: https://codepen.io/absolutedevelopment/pen/EpwVzN
    const reParseJSON =
        // eslint-disable-next-line security/detect-unsafe-regex, sonarjs/regex-complexity
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

function addEventListener(el, eventName, selector, fn) {
    el.addEventListener(eventName, (event) => {
        let targetEl = event.target;
        while (targetEl && targetEl.nodeType !== Node.DOCUMENT_NODE && el.contains(targetEl)) {
            if (targetEl.matches(selector)) {
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

function extendedBtoa(str) {
    return btoa(encodeURIComponent(str));
}

function extendedAtob(str) {
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

async function sendToBackground(event, data = undefined) {
    return chrome.runtime.sendMessage({
        data,
        event,
    });
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
