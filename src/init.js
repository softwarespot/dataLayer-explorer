/* eslint-disable no-console */

(async function main() {
    const MODULE = '[de]';

    // Taken from "background.js"
    const EVENT_LOAD_CONFIG = 'LOAD_CONFIG';

    const EVENT_DATALAYER_FOUND = 'DATALAYER_FOUND';
    const EVENT_DATALAYER_NOT_FOUND = 'DATALAYER_NOT_FOUND';

    // Taken from "contentscript.js"
    const SOURCE_FROM_CONTENT_SCRIPT = 'DE_SOURCE_FROM_CONTENT_SCRIPT';
    const SOURCE_FROM_INIT = 'DE_SOURCE_FROM_INIT';

    const sendToContentScript = registerSender(SOURCE_FROM_INIT, SOURCE_FROM_CONTENT_SCRIPT);
    try {
        const cfg = await sendToContentScript(EVENT_LOAD_CONFIG);
        const dataLayer = await dataLayerLoaded();
        console.log(MODULE, '"init.js" has initialized, dataLayer is available');
        sendToContentScript(EVENT_DATALAYER_FOUND);
        console.log(cfg, dataLayer);
    } catch (err) {
        sendToContentScript(EVENT_DATALAYER_NOT_FOUND);

        // NOTE: Don't log as a warning, as this will show up in the Chrome extension's error listing
        console.info(MODULE, err instanceof Error ? err.message : 'An unexpected error occurred');
    }

    async function dataLayerLoaded(timeout = 10000) {
        return new Promise((resolve, reject) => {
            let timerId = 0;
            function dataLayerLoadedChecker() {
                if (Array.isArray(window.dataLayer)) {
                    resolve(window.dataLayer);
                    return;
                }
                timerId = setTimeout(dataLayerLoadedChecker, 256);
            }

            dataLayerLoadedChecker();

            setTimeout(() => {
                reject(
                    new Error(
                        `Waiting for dataLayer in "init.js" timed out after ${timeout}ms, possibly due to dataLayer not being available on the site`,
                    ),
                );
                clearTimeout(timerId);
            }, timeout);
        });
    }

    // Shared utils

    // Communicate using "window.postMessage", waiting for a response from the window
    // who is responsible for handling the event
    function registerSender(source, target, timeout = 10000) {
        let globalId = 0;
        return async (event, data = undefined) => {
            const wantId = `REGISTER_SENDER_${source}_${target}_${globalId++}`;
            return new Promise((resolve, reject) => {
                const timerId = setTimeout(() => {
                    cleanup();
                    reject(new Error(`Waiting for a response for "${event}" timed out after ${timeout}ms`));
                }, timeout);

                window.addEventListener('message', onMessage);

                /* eslint-disable sort-keys-fix/sort-keys-fix */
                window.postMessage(
                    {
                        id: wantId,
                        source,
                        event,
                        data,
                    },
                    '*',
                );
                /* eslint-enable sort-keys-fix/sort-keys-fix */

                function cleanup() {
                    window.removeEventListener('message', onMessage);
                    clearTimeout(timerId);
                }

                function onMessage(evt) {
                    if (evt.data.id === wantId && evt.data.source === target && evt.data.handled) {
                        cleanup();
                        resolve(evt.data.data);
                    }
                }
            });
        };
    }
})();
