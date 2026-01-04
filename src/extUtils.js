export async function sendToBackground(event, data = undefined) {
    /* eslint-disable sort-keys-fix/sort-keys-fix */
    return chrome.runtime.sendMessage({
        event,
        data,
    });
    /* eslint-enable sort-keys-fix/sort-keys-fix */
}

export async function sendToContentScript(event, data = undefined) {
    const tab = await getCurrentTab();
    return chrome.tabs.sendMessage(tab.id, {
        data,
        event,
    });
}

async function getCurrentTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab;
}

// A utility function for supporting async/await in "onMessage".
// If "undefined" is returned from the function, then the sender is not notified; otherwise, the sender is notified
// with the data returned from the function.
// See URL: https://stackoverflow.com/a/46628145 for more details
export function registerHandlerFromPopup(listenerFn) {
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
