import { registerHandlerFromPopup } from './extUtils.js';
import { isObject } from './utils.js';

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

// From "popup.js" or "contentScript.js"
registerHandlerFromPopup(async (req, sender) => {
    switch (req.event) {
        case EVENT_LOAD_CONFIG: {
            /* eslint-disable sort-keys-fix/sort-keys-fix */
            const defaultConfig = {
                searchTerm: '',
                expandAll: false,
                maxPages: 0,
                formatMode: 'json',
                themeMode: 'light',
            };
            /* eslint-enable sort-keys-fix/sort-keys-fix */

            const res = await chrome.storage.local.get(['config']);
            if (!isObject(res.config)) {
                return defaultConfig;
            }

            // Merge the default config with the stored config to ensure all keys are present
            return {
                ...defaultConfig,
                ...res.config,
            };
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
                title: 'Checking if dataLayer is on this page...',
                tabId: tab.id,
            });
            break;
        case EVENT_DATALAYER_FOUND:
            chrome.action.setBadgeBackgroundColor({ color: COLOR_GREEN, tabId: tab.id });
            chrome.action.setBadgeText({ text: String(data.count), tabId: tab.id });
            chrome.action.setTitle({
                title: 'dataLayer is on this page.',
                tabId: tab.id,
            });
            break;
        case EVENT_DATALAYER_NOT_FOUND:
            chrome.action.setBadgeBackgroundColor({ color: COLOR_RED, tabId: tab.id });
            chrome.action.setBadgeText({ text: '❌', tabId: tab.id });
            chrome.action.setTitle({
                title: 'dataLayer is not on this page.',
                tabId: tab.id,
            });
            break;
    }
    /* eslint-enable sort-keys-fix/sort-keys-fix */
}

// Shared utils
