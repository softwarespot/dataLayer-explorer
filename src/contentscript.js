/* eslint-disable sonarjs/no-small-switch */

(async function main() {
    // Taken from "background.js"
    const EVENT_LOAD_CONFIG = 'LOAD_CONFIG';

    const EVENT_DATALAYER_LOADING = 'DATALAYER_LOADING';
    const EVENT_DATALAYER_FOUND = 'DATALAYER_FOUND';
    const EVENT_DATALAYER_NOT_FOUND = 'DATALAYER_NOT_FOUND';
    const EVENT_SYNC_DATALAYER_STATUS = 'SYNC_DATALAYER_STATUS';

    const SOURCE_FROM_CONTENT_SCRIPT = 'DE_SOURCE_FROM_CONTENT_SCRIPT';
    const SOURCE_FROM_INIT = 'DE_SOURCE_FROM_INIT';

    // Taken from "popup.js"
    const EVENT_GET_DATALAYER_STATUS = 'GET_DATALAYER_STATUS';

    // Originally this used to be in "background.js", but as the state
    // is no longer persistant due to being a Service Worker, it should
    // be kept in the "contentscript.js", as it's only need for the lifetime
    // of the page

    const state = {
        status: EVENT_DATALAYER_LOADING,
    };

    registerHandlerFromPopup(async (req) => {
        switch (req.event) {
            case EVENT_GET_DATALAYER_STATUS:
                return state;
            default:
                return undefined;
        }
    });

    registerHandler(SOURCE_FROM_CONTENT_SCRIPT, SOURCE_FROM_INIT, async (event) => {
        switch (event) {
            case EVENT_LOAD_CONFIG:
                return sendToBackground(EVENT_LOAD_CONFIG);
            case EVENT_DATALAYER_FOUND:
            case EVENT_DATALAYER_NOT_FOUND:
                state.status = event;
                sendToBackground(EVENT_SYNC_DATALAYER_STATUS, state);
        }
        return undefined;
    });

    // Stop flashing of the badge text, when the loading of dataLayer is quick
    setTimeout(() => {
        if (state.status === EVENT_DATALAYER_LOADING) {
            sendToBackground(EVENT_SYNC_DATALAYER_STATUS, state);
        }
    }, 250);
    loadScript(chrome.runtime.getURL('init.js'));

    // Utils

    function loadScript(src) {
        const el = document.createElement('script');
        el.setAttribute('src', src);
        document.documentElement.appendChild(el);
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

    async function sendToBackground(event, data = undefined) {
        /* eslint-disable sort-keys-fix/sort-keys-fix */
        return chrome.runtime.sendMessage({
            event,
            data,
        });
        /* eslint-enable sort-keys-fix/sort-keys-fix */
    }

    function registerHandler(source, target, listenerFn) {
        // Create a unique reference
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
