/* eslint-disable no-console */

const COLOR_GREEN = '#27ae60';
const COLOR_ORANGE = '#e67e22';
const COLOR_RED = '#c0392b';
const COLOR_WHITE = '#ecf0f1';

const EVENT_LOAD_CONFIG = 'LOAD_CONFIG';

const EVENT_DATALAYER_LOADING = 'DATALAYER_LOADING';
const EVENT_DATALAYER_FOUND = 'DATALAYER_FOUND';
const EVENT_DATALAYER_NOT_FOUND = 'DATALAYER_NOT_FOUND';
const EVENT_SYNC_DATALAYER_STATUS = 'SYNC_DATALAYER_STATUS';

// To "contentscript.js"
chrome.runtime.onInstalled.addListener(async () => {
    const cfg = await getConfig(undefined);
    console.log(cfg);
});

// From "popup.js" or "contentscript.js"
registerHandlerFromPopup(async (req, sender) => {
    switch (req.event) {
        case EVENT_LOAD_CONFIG: {
            const tab = req?.data?.tab;
            return getConfig(tab);
        }
        case EVENT_SYNC_DATALAYER_STATUS:
            syncDataLayerStatus(sender.tab, req.data);
            return undefined;
    }
    return undefined;
});

async function getConfig(tab = undefined) {
    // const {  } = await chrome.storage.local.get([]);

    const cfgApp = chrome.runtime.getManifest();

    return {
        version: cfgApp.version,
    };
}

function syncDataLayerStatus(tab, data) {
    /* eslint-disable sort-keys-fix/sort-keys-fix */
    chrome.action.setBadgeTextColor({ color: COLOR_WHITE, tabId: tab.id });

    switch (data.status) {
        case EVENT_DATALAYER_LOADING:
            chrome.action.setBadgeBackgroundColor({ color: COLOR_ORANGE, tabId: tab.id });
            chrome.action.setBadgeText({ text: 'WAIT', tabId: tab.id });
            chrome.action.setTitle({
                title: 'Checking if dataLayer is available on this page...',
                tabId: tab.id,
            });
            break;
        case EVENT_DATALAYER_FOUND:
            chrome.action.setBadgeBackgroundColor({ color: COLOR_GREEN, tabId: tab.id });
            chrome.action.setBadgeText({ text: 'OK', tabId: tab.id });
            chrome.action.setTitle({
                title: 'dataLayer is available on this page.',
                tabId: tab.id,
            });
            break;
        case EVENT_DATALAYER_NOT_FOUND:
            chrome.action.setBadgeBackgroundColor({ color: COLOR_RED, tabId: tab.id });
            chrome.action.setBadgeText({ text: 'FAIL', tabId: tab.id });
            chrome.action.setTitle({
                title: 'dataLayer is not available on this page.',
                tabId: tab.id,
            });
            break;
    }
    /* eslint-enable sort-keys-fix/sort-keys-fix */
}

// Shared utils

// A utility function for supporting async/await in "onMessage".
// If "undefined" is returned from the function, then the sender is not notified; otherwise, the sender is notified
// with the data returned function the function.
// See URL: https://stackoverflow.com/a/46628145 for more details
function registerHandlerFromPopup(listenerFn) {
    chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
        const res = listenerFn(req, sender);
        if (res === undefined) {
            return false;
        }

        Promise.resolve(res).then((data) => sendResponse(data));

        // See URL: https://developer.chrome.com/docs/extensions/reference/runtime/#event-onMessage
        return true;
    });
}

function isURL(url) {
    try {
        // NOTE: Use https://developer.mozilla.org/en-US/docs/Web/API/URL/canParse_static when it's available
        return Boolean(new URL(url));
    } catch {
        // Ignore the error
    }
    return false;
}
