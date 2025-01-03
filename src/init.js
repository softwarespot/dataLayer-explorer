(async function main() {
    const MODULE = '[dle]';

    const EVENT_DATALAYER_FOUND = 'DATALAYER_FOUND';
    const EVENT_DATALAYER_NOT_FOUND = 'DATALAYER_NOT_FOUND';

    const EVENT_DATALAYER_ENTRIES = 'DATALAYER_ENTRIES';

    // Taken from "contentScript.js"
    const SOURCE_FROM_CONTENT_SCRIPT = 'DLE_SOURCE_FROM_CONTENT_SCRIPT';
    const SOURCE_FROM_INIT = 'DLE_SOURCE_FROM_INIT';

    const sendToContentScript = registerSender(SOURCE_FROM_INIT, SOURCE_FROM_CONTENT_SCRIPT);
    try {
        const sendEvent = registerSendEventToContentScript();
        const dataLayer = await dataLayerLoaded();
        const trace = getTrace();
        for (const event of dataLayer) {
            sendEvent(event, trace);
        }

        dataLayer.push = new Proxy(dataLayer.push, {
            apply(target, thisArg, args) {
                const event = args[0];
                const trace = getTrace();
                sendEvent(event, trace);
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

    async function dataLayerLoaded(timeout = 4096) {
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

    // Defer sending the entries to the "contentScript.js", if multiple entries are being pushed
    // in a short timeframe.
    // This is to limit the affect on the site's performance
    function registerSendEventToContentScript() {
        const entries = [];
        const deferSendEntries = debounce(() => {
            sendToContentScript(EVENT_DATALAYER_ENTRIES, safeJSONStringify(entries));

            // Remove the entries after sending
            entries.length = 0;
        }, 256);

        return (event, trace) => {
            const afterPageLoadMs = Date.now() - window.performance.timeOrigin;
            entries.push({
                afterPageLoadMs: Math.abs(afterPageLoadMs),
                event,
                trace,
            });
            deferSendEntries();
        };
    }

    function getTrace() {
        const err = new Error();
        return err.stack;
    }

    function safeJSONStringify(obj) {
        const seen = new WeakSet();
        return JSON.stringify(obj, (_, value) => {
            if (isConstructor(value, Date)) {
                return value.toISOString();
            }
            if (isConstructor(value, HTMLElement)) {
                return value.outerHTML;
            }
            if (isConstructor(value, Map)) {
                return {
                    dataType: 'Map',
                    value: Array.from(value.entries()),
                };
            }
            if (isConstructor(value, RegExp)) {
                return value.toString();
            }
            if (isConstructor(value, Set)) {
                return {
                    dataType: 'Set',
                    value: Array.from(value.values()),
                };
            }

            if (value === Infinity) {
                return 'Infinity';
            }
            if (value === -Infinity) {
                return '-Infinity';
            }
            if (Number.isNaN(value)) {
                return 'NaN';
            }
            if (isBigInt(value)) {
                return `${value.toString()}n`;
            }

            if (isFunction(value)) {
                return value.toString();
            }
            if (isObject(value)) {
                if (seen.has(value)) {
                    return '[Circular]';
                }
                seen.add(value);
            }
            return value;
        });
    }

    function isConstructor(obj, constructor) {
        return obj instanceof constructor;
    }

    function isBigInt(obj) {
        return typeof obj === 'bigint';
    }

    function isFunction(obj) {
        return typeof obj === 'function';
    }

    function isObject(obj) {
        return Object(obj) === obj;
    }

    // Shared utils

    function debounce(fn, delay) {
        let timerId = 0;
        return (...args) => {
            clearTimeout(timerId);
            timerId = setTimeout(() => fn(...args), delay);
        };
    }

    // Communicate using "window.postMessage", waiting for a response from the window
    // who is responsible for handling the event
    function registerSender(source, target, timeout = 4096) {
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
