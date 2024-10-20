// Taken from "background.js"
const EVENT_LOAD_CONFIG = 'LOAD_CONFIG';

const EVENT_DATALAYER_LOADING = 'DATALAYER_LOADING';
const EVENT_DATALAYER_FOUND = 'DATALAYER_FOUND';
const EVENT_DATALAYER_NOT_FOUND = 'DATALAYER_NOT_FOUND';

// Taken from "contentscript.js"
const EVENT_GET_DATALAYER_STATUS = 'GET_DATALAYER_STATUS';

const state = {
    dom: {},
};

document.addEventListener('DOMContentLoaded', async () => {
    const tab = await getCurrentTab();
    const cfg = await sendToBackground(EVENT_LOAD_CONFIG, {
        tab,
    });
    console.log(cfg);

    while (true) {
        try {
            const el = document.getElementById('dataLayer-status');
            const data = await sendToContentScript(EVENT_GET_DATALAYER_STATUS);
            switch (data.status) {
                case EVENT_DATALAYER_FOUND:
                    el.innerHTML = 'dataLayer is available on this page.';
                    return;
                case EVENT_DATALAYER_NOT_FOUND:
                    el.innerHTML = 'dataLayer is not available on this page.';
                    return;
                case EVENT_DATALAYER_LOADING:
                default:
                    el.innerHTML = 'Checking if dataLayer is available on this page...';
            }
        } catch {
            // Ignore the error, as it means the "contentscript.js" is not available
            return;
        }
        await sleep(250);
    }
});

async function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(() => resolve(), ms);
    });
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

function isURL(url) {
    try {
        // NOTE: Use https://developer.mozilla.org/en-US/docs/Web/API/URL/canParse_static when it's available
        return Boolean(new URL(url));
    } catch {
        // Ignore the error
        return false;
    }
}
