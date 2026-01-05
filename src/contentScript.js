/* eslint-disable n/no-unsupported-features/node-builtins */

(async function main() {
    const MODULE = '[dle]';

    // Taken from "background.js"
    const EVENT_LOAD_CONFIG = 'LOAD_CONFIG';
    const EVENT_SYNC_CONFIG = 'SYNC_CONFIG';

    const EVENT_DATALAYER_LOADING = 'DATALAYER_LOADING';
    const EVENT_DATALAYER_FOUND = 'DATALAYER_FOUND';
    const EVENT_DATALAYER_NOT_FOUND = 'DATALAYER_NOT_FOUND';
    const EVENT_SYNC_DATALAYER_STATUS = 'SYNC_DATALAYER_STATUS';

    const SOURCE_FROM_CONTENT_SCRIPT = 'DLE_SOURCE_FROM_CONTENT_SCRIPT';
    const SOURCE_FROM_INIT = 'DLE_SOURCE_FROM_INIT';

    // Taken from "popup.js"
    const EVENT_GET_DATALAYER_STATUS = 'GET_DATALAYER_STATUS';
    const EVENT_GET_DATALAYER_PAGES_ENTRIES = 'GET_DATALAYER_PAGES_ENTRIES';
    const EVENT_REMOVE_DATALAYER_PAGES_ENTRIES = 'REMOVE_DATALAYER_PAGES_ENTRIES';

    const EVENT_DATALAYER_ENTRIES = 'DATALAYER_ENTRIES';
    const PAGES_ENTRIES_STORAGE_KEY = '__DLE_PAGES_ENTRIES_V0__';

    const state = {
        config: await sendToBackground(EVENT_LOAD_CONFIG),
        status: EVENT_DATALAYER_LOADING,

        /* eslint-disable sort-keys-fix/sort-keys-fix */
        currPage: {
            id: crypto.randomUUID(),
            entries: [],
            url: window.location.href,
            updatedAtMs: Date.now(),
        },
        /* eslint-enable sort-keys-fix/sort-keys-fix */
    };

    // Defer sending the count and status to the "background.js", if multiple entries are being pushed
    // in a short timeframe.
    // This is to limit the affect on the site's performance
    const deferSendStatusToBackground = debounce(() => {
        sendToBackground(EVENT_SYNC_DATALAYER_STATUS, {
            count: state.currPage.entries.length,
            status: state.status,
        });
    }, 256);

    // Defer storing the pages entries, if multiple entries are being pushed in a short timeframe.
    // This is to limit the affect on the site's performance
    const deferStorePagesEntries = debounce(() => {
        if (state.config.maxPages > 0) {
            storePagesEntries();
        }
    }, 256);

    registerHandlerFromPopup(async (req) => {
        switch (req.event) {
            case EVENT_SYNC_CONFIG:
                state.config = req.data;
                if (state.config.maxPages > 0) {
                    storePagesEntries();
                } else {
                    removePagesEntries();
                }
                return undefined;
            case EVENT_GET_DATALAYER_STATUS:
                return {
                    status: state.status,
                };
            case EVENT_GET_DATALAYER_PAGES_ENTRIES:
                if (state.config.maxPages === 0) {
                    return getDefaultPageEntries();
                }
                return getPagesEntries();
            case EVENT_REMOVE_DATALAYER_PAGES_ENTRIES:
                removePagesEntries();
                return true;
            default:
                return undefined;
        }
    });

    registerHandler(SOURCE_FROM_CONTENT_SCRIPT, SOURCE_FROM_INIT, async (event, data) => {
        switch (event) {
            case EVENT_DATALAYER_FOUND:
            case EVENT_DATALAYER_NOT_FOUND:
                state.status = event;
                deferSendStatusToBackground();

                return true;
            case EVENT_DATALAYER_ENTRIES: {
                const entries = JSON.parse(data);
                state.currPage.entries.push(...entries);
                state.currPage.updatedAtMs = Date.now();

                deferSendStatusToBackground();
                deferStorePagesEntries();

                return true;
            }
        }
        return undefined;
    });

    // Stop flashing of the badge text, when the loading of dataLayer is quick
    setTimeout(() => {
        if (state.status === EVENT_DATALAYER_LOADING) {
            deferSendStatusToBackground();
        }
    }, 250);
    loadScript(chrome.runtime.getURL('init.js'));

    function getDefaultPageEntries() {
        /* eslint-disable sort-keys-fix/sort-keys-fix */
        return {
            pages: [state.currPage],
            maxPages: state.config.maxPages,
            updatedAtMs: Date.now(),
        };
        /* eslint-enable sort-keys-fix/sort-keys-fix */
    }

    function getPagesEntries() {
        const res = localStorage.getItem(PAGES_ENTRIES_STORAGE_KEY);
        if (!res) {
            return getDefaultPageEntries();
        }
        return JSON.parse(res);
    }

    function storePagesEntries() {
        const pagesEntries = getPagesEntries();
        pagesEntries.maxPages = state.config.maxPages;
        pagesEntries.updatedAtMs = Date.now();

        const currPage = pagesEntries.pages.at(-1);
        if (currPage.id === state.currPage.id) {
            // Do not use ".with()", as it's OK to mutate the current pages array
            const idx = pagesEntries.pages.length - 1;
            pagesEntries.pages[idx] = state.currPage;
        } else {
            // Delete the oldest page entry, if the maximum limit has been reached
            if (pagesEntries.pages.length === pagesEntries.maxPages) {
                pagesEntries.pages.shift();
            }
            pagesEntries.pages.push(state.currPage);
        }
        localStorage.setItem(PAGES_ENTRIES_STORAGE_KEY, JSON.stringify(pagesEntries));
    }

    function removePagesEntries() {
        localStorage.removeItem(PAGES_ENTRIES_STORAGE_KEY);
    }

    // Utils

    function loadScript(src) {
        const el = document.createElement('script');
        el.setAttribute('src', src);
        document.documentElement.appendChild(el);
    }

    // Shared utils

    // IMPORTANt: These have been copied from "extUtils.js" and "utils.js", as "import" statements cannot be used in content scripts

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

    // A utility function for supporting async/await in "onMessage".
    // If "undefined" is returned from the function, then the sender is not notified; otherwise, the sender is notified
    // with the data returned from the function.
    // See URL: https://stackoverflow.com/a/46628145 for more details
    function registerHandlerFromPopup(listenerFn) {
        chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
            const res = listenerFn(req, sender);
            if (res === undefined) {
                return false;
            }

            // eslint-disable-next-line promise/catch-or-return
            Promise.resolve(res).then((data) => sendResponse(data));

            // See URL: https://developer.chrome.com/docs/extensions/reference/runtime/#event-onMessage
            return true;
        });
    }

    function registerHandler(source, target, listenerFn) {
        window.addEventListener('message', async (evt) => {
            if (evt.data.source !== target) {
                return;
            }

            const res = await listenerFn(evt.data.event, evt.data.data);
            if (res === undefined) {
                return;
            }

            /* eslint-disable sort-keys-fix/sort-keys-fix */

            window.postMessage(
                {
                    id: evt.data.id,
                    source,
                    handled: true,
                    event: evt.data.event,
                    data: res,
                },
                '*',
            );
            /* eslint-enable sort-keys-fix/sort-keys-fix */
        });
    }
})();
