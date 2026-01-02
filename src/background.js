const COLOR_GREEN = '#2e7d32';
const COLOR_ORANGE = '#ff8c00';
const COLOR_RED = '#c0392b';
const COLOR_WHITE = '#ecf0f1';

const EVENT_LOAD_CONFIG = 'LOAD_CONFIG';
const EVENT_SYNC_CONFIG = 'SYNC_CONFIG';

const EVENT_DATALAYER_LOADING = 'DATALAYER_LOADING';
const EVENT_DATALAYER_FOUND = 'DATALAYER_FOUND';
const EVENT_DATALAYER_NOT_FOUND = 'DATALAYER_NOT_FOUND';
const EVENT_SYNC_DATALAYER_STATUS = 'SYNC_DATALAYER_STATUS';

// const FORMAT_MODE_COLUMN = 'column';
const FORMAT_MODE_JSON = 'json';

// const THEME_MODE_DARK = 'dark';
const THEME_MODE_LIGHT = 'light';

// From "popup.js" or "contentScript.js"
registerHandlerFromPopup(async (req, sender) => {
    switch (req.event) {
        case EVENT_LOAD_CONFIG: {
            /* eslint-disable sort-keys-fix/sort-keys-fix */
            const defaultConfig = {
                searchTerm: '',
                expandAll: false,
                maxPages: 0,
                formatMode: FORMAT_MODE_JSON,
                themeMode: THEME_MODE_LIGHT,
            };
            /* eslint-enable sort-keys-fix/sort-keys-fix */
            const res = await chrome.storage.local.get(['config']);
            if (!isObject(res.config)) {
                return defaultConfig;
            }

            const cfg = {
                ...defaultConfig,
                ...res.config,
            };
            return cfg;
        }
        case EVENT_SYNC_CONFIG:
            await chrome.storage.local.set({
                config: req.data,
            });
            return undefined;
        case EVENT_SYNC_DATALAYER_STATUS:
            syncDataLayerStatus(sender.tab, req.data);
            return undefined;
    }
    return undefined;
});

function syncDataLayerStatus(tab, data) {
    /* eslint-disable sort-keys-fix/sort-keys-fix */
    chrome.action.setBadgeTextColor({ color: COLOR_WHITE, tabId: tab.id });

    switch (data.status) {
        case EVENT_DATALAYER_LOADING:
            chrome.action.setBadgeBackgroundColor({ color: COLOR_ORANGE, tabId: tab.id });
            chrome.action.setBadgeText({ text: '...', tabId: tab.id });
            chrome.action.setTitle({
                title: 'Checking if dataLayer is available on this page...',
                tabId: tab.id,
            });
            break;
        case EVENT_DATALAYER_FOUND:
            chrome.action.setBadgeBackgroundColor({ color: COLOR_GREEN, tabId: tab.id });
            chrome.action.setBadgeText({ text: String(data.count), tabId: tab.id });
            chrome.action.setTitle({
                title: 'dataLayer is available on this page.',
                tabId: tab.id,
            });
            break;
        case EVENT_DATALAYER_NOT_FOUND:
            chrome.action.setBadgeBackgroundColor({ color: COLOR_RED, tabId: tab.id });
            chrome.action.setBadgeText({ text: '❌', tabId: tab.id });
            chrome.action.setTitle({
                title: 'dataLayer is not available on this page.',
                tabId: tab.id,
            });
            break;
    }
    /* eslint-enable sort-keys-fix/sort-keys-fix */
}

// Shared utils

function isObject(obj) {
    return Object(obj) === obj;
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
