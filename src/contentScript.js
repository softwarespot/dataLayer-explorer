(async function main() {
    // Taken from "background.js"
    const EVENT_DATALAYER_LOADING = 'DATALAYER_LOADING';
    const EVENT_DATALAYER_FOUND = 'DATALAYER_FOUND';
    const EVENT_DATALAYER_NOT_FOUND = 'DATALAYER_NOT_FOUND';
    const EVENT_SYNC_DATALAYER_STATUS = 'SYNC_DATALAYER_STATUS';

    const EVENT_DATALAYER_ENTRIES = 'DATALAYER_ENTRIES';

    const SOURCE_FROM_CONTENT_SCRIPT = 'DLE_SOURCE_FROM_CONTENT_SCRIPT';
    const SOURCE_FROM_INIT = 'DLE_SOURCE_FROM_INIT';

    // Taken from "popup.js"
    const EVENT_GET_DATALAYER_STATUS = 'GET_DATALAYER_STATUS';
    const EVENT_GET_DATALAYER_ENTRIES = 'GET_DATALAYER_ENTRIES';

    // Originally this used to be in "background.js", but as the state
    // is no longer persistant due to being a Service Worker, it should
    // be kept in the "contentScript.js", as it's only need for the lifetime
    // of the page

    /* eslint-disable sort-keys-fix/sort-keys-fix */
    const state = {
        status: EVENT_DATALAYER_LOADING,
        entries: [],
    };
    /* eslint-enable sort-keys-fix/sort-keys-fix */

    registerHandlerFromPopup(async (req) => {
        switch (req.event) {
            case EVENT_GET_DATALAYER_STATUS:
                return {
                    status: state.status,
                };
            case EVENT_GET_DATALAYER_ENTRIES:
                return {
                    entries: JSON.stringify(state.entries),
                };
            default:
                return undefined;
        }
    });

    // Defer sending the count and status to the "background.js", if multiple entries are being pushed
    // in a short timeframe.
    // This is to limit the affect on the site's performance
    const deferSendStatusToBackground = debounce(() => {
        sendToBackground(EVENT_SYNC_DATALAYER_STATUS, {
            count: state.entries.length,
            status: state.status,
        });
    }, 256);

    registerHandler(SOURCE_FROM_CONTENT_SCRIPT, SOURCE_FROM_INIT, async (event, data) => {
        switch (event) {
            case EVENT_DATALAYER_FOUND:
            case EVENT_DATALAYER_NOT_FOUND:
                state.status = event;
                deferSendStatusToBackground();
                return true;
            case EVENT_DATALAYER_ENTRIES: {
                const entries = JSON.parse(data);
                state.entries.push(...entries);
                deferSendStatusToBackground();
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

    // Utils

    function loadScript(src) {
        const el = document.createElement('script');
        el.setAttribute('src', src);
        document.documentElement.appendChild(el);
    }

    // Shared utils

    function debounce(afterFn, delay) {
        let timerId = 0;
        return (...args) => {
            clearTimeout(timerId);
            timerId = setTimeout(() => afterFn(...args), delay);
        };
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
