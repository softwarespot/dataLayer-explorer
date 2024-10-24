/* eslint-disable no-console */

(async function main() {
    const MODULE = '[de]';

    const EVENT_DATALAYER_FOUND = 'DATALAYER_FOUND';
    const EVENT_DATALAYER_NOT_FOUND = 'DATALAYER_NOT_FOUND';

    const EVENT_DATALAYER_ENTRY = 'DATALAYER_ENTRY';

    // Taken from "contentscript.js"
    const SOURCE_FROM_CONTENT_SCRIPT = 'DE_SOURCE_FROM_CONTENT_SCRIPT';
    const SOURCE_FROM_INIT = 'DE_SOURCE_FROM_INIT';

    // Math.abs(scriptLoadedAt - window.performance.timeOrigin)

    const sendToContentScript = registerSender(SOURCE_FROM_INIT, SOURCE_FROM_CONTENT_SCRIPT);
    try {
        const dataLayer = await dataLayerLoaded();
        for (const event of dataLayer) {
            sendEntry(event);
        }
        dataLayer.push = new Proxy(dataLayer.push, {
            apply(target, thisArg, args) {
                sendEntry(args[0]);
                return Reflect.apply(target, thisArg, args);
            },
        });

        console.log(MODULE, '"init.js" has initialized, dataLayer is available');
        sendToContentScript(EVENT_DATALAYER_FOUND);
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

    function sendEntry(event) {
        sendToContentScript(
            EVENT_DATALAYER_ENTRY,
            JSON.stringify(
                {
                    event,
                    ts: Math.abs(Date.now() - window.performance.timeOrigin),
                },
                (key, value) => {
                    if (value instanceof HTMLElement) {
                        return value.outerHTML;
                    }
                    return value;
                },
            ),
        );
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
