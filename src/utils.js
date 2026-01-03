/* eslint-disable sonarjs/cognitive-complexity */

// DOM utilities

export function addEventListener(el, eventName, selector, fn) {
    el.addEventListener(eventName, (event) => {
        if (!isFunction(fn)) {
            selector(event, event.target);
            return;
        }

        const targetEl = event.target.closest(selector);
        if (targetEl && el.contains(targetEl)) {
            fn(event, targetEl);
        }
    });
}

export function animate(el) {
    el.classList.add('animate');

    // Remove after 0.3s, which is the same as the CSS animation
    setTimeout(() => el.classList.remove('animate'), 300);
}

// Taken from URL: https://stackoverflow.com/questions/400212/how-do-i-copy-to-the-clipboard-in-javascript
// NOTE: This is due to "navigator.clipboard.writeText" requiring HTTPS
export function copyToClipboard(text, container = document.body) {
    const el = document.createElement('textarea');
    try {
        el.value = text;

        // Avoid scrolling to the bottom
        el.style.position = 'fixed';
        el.style.left = '0';
        el.style.top = '';

        container.appendChild(el);
        el.focus();
        el.select();

        document.execCommand('copy');
        return true;
    } catch {
        // Ignore error
    } finally {
        el.remove();
    }
    return false;
}

// String utilities

export function escapeHTML(str) {
    return String(str).replace(/[&<>]/g, (char) => {
        switch (char) {
            case '&':
                return '&amp;';
            case '<':
                return '&lt;';
            case '>':
                return '&gt;';
            default:
                return char;
        }
    });
}

export function safeDecode(str) {
    return decodeURIComponent(atob(str));
}

export function safeEncode(str) {
    return btoa(encodeURIComponent(str));
}

export function truncate(str, maxLen, prefix = '...') {
    str = String(str);
    return str.length > maxLen ? `${str.slice(0, maxLen)}${prefix}` : str;
}

// Array/Object utilities

export function flatten(obj, depth = Infinity, seen = new WeakSet()) {
    // Return primitive values as-is
    if (!isObject(obj) || depth <= 0) {
        return [[[], obj]];
    }

    // Check for circular references
    if (seen.has(obj)) {
        return [[['[Circular]'], '[Circular]']];
    }

    // Add the current object to the set of seen objects
    seen.add(obj);

    const flattened = [];
    for (const [value, keyOrIndex] of iterator(obj)) {
        if (!isObject(value)) {
            flattened.push([[keyOrIndex], value]);
            continue;
        }

        // Array
        if (Array.isArray(value)) {
            if (value.length === 0) {
                flattened.push([[keyOrIndex], []]);
                continue;
            }

            for (const [item, index] of iterator(value)) {
                const itemKeyOrIndex = [keyOrIndex, index];
                if (!isObject(item)) {
                    flattened.push([itemKeyOrIndex, item]);
                    continue;
                }

                const innerFlattened = flatten(item, depth - 1, seen);
                const innerFlattenedMapped = innerFlattened.map(([subKey, subValue]) => {
                    return [itemKeyOrIndex.concat(subKey), subValue];
                });
                flattened.push(...innerFlattenedMapped);
            }
            continue;
        }

        // Object
        if (isObjectEmpty(value)) {
            flattened.push([[keyOrIndex], {}]);
            continue;
        }

        const innerFlattened = flatten(value, depth - 1, seen);
        const mappedInnerFlattened = innerFlattened.map(([subKey, subValue]) => {
            return [[keyOrIndex].concat(subKey), subValue];
        });
        flattened.push(...mappedInnerFlattened);
    }

    // Remove the current object from the set of seen objects before returning
    seen.delete(obj);

    return flattened;
}

export function flattenKeys(keys) {
    let res = '';
    if (keys.length === 0) {
        return res;
    }

    const reIsIdentifier = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
    for (let i = 0; i < keys.length; i++) {
        const key = keys[i];

        if (isNumber(key)) {
            res += `[${key}]`;
            continue;
        }
        if (reIsIdentifier.test(key)) {
            const isFirst = i === 0;
            res += isFirst ? key : `.${key}`;
            continue;
        }
        res += `[${JSON.stringify(key)}]`;
    }
    return res;
}

function* iterator(obj) {
    // Array
    if (Array.isArray(obj)) {
        for (let i = 0; i < obj.length; i++) {
            yield [obj[i], i, obj];
        }
        return;
    }

    // Object
    for (const key in obj) {
        if (Object.hasOwn(obj, key)) {
            yield [obj[key], key, obj];
        }
    }
}

export function getFirstFlattenedKey(obj, depth = 2, currDepth = 1) {
    if (!isObject(obj)) {
        return undefined;
    }

    for (const key in obj) {
        if (!Object.hasOwn(obj, key)) {
            continue;
        }
        if (currDepth === depth) {
            return key;
        }

        const nextKey = getFirstFlattenedKey(obj[key], depth, currDepth + 1);
        if (isString(nextKey) && nextKey.length > 0) {
            return `${key}.${nextKey}`;
        }
        return key;
    }
    return undefined;
}

// Type checking utilities

export function isFunction(obj) {
    return typeof obj === 'function';
}

export function isNumber(obj) {
    return typeof obj === 'number';
}

export function isObject(obj) {
    return Object(obj) === obj;
}

export function isObjectEmpty(obj) {
    for (const key in obj) {
        if (Object.hasOwn(obj, key)) {
            return false;
        }
    }
    return true;
}

export function isString(obj) {
    return typeof obj === 'string';
}

// Time utilities

export async function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(() => resolve(), ms);
    });
}

export function toDurationStringMs(ms) {
    const absMs = Math.abs(Math.round(ms));
    if (Number.isNaN(absMs)) {
        return '"Invalid milliseconds"';
    }

    const timeUnits = [
        ['d', Math.floor(absMs / 86400000)],
        ['h', Math.floor(absMs / 3600000) % 24],
        ['m', Math.floor(absMs / 60000) % 60],
        ['s', Math.floor(absMs / 1000) % 60],
        ['ms', absMs % 1000],
    ];

    let res = '';
    for (const [unit, value] of timeUnits) {
        if (value > 0) {
            res += `${value}${unit}`;
        }
    }
    if (res === '') {
        return '0ms';
    }
    return ms < 0 ? `-${res}` : res;
}

export function toHumanTimeStringMs(dt, dtNow = new Date()) {
    dt = new Date(dt);
    if (!dt) {
        return '"Invalid date"';
    }

    const timeUnits = [
        ['year', 'years', 31556926000],
        ['month', 'months', 2629744000],
        ['day', 'days', 86400000],
        ['hour', 'hours', 3600000],
        ['minute', 'minutes', 60000],
        ['second', 'seconds', 1000],
        ['millisecond', 'milliseconds', 1],
    ];
    const tense = dt < dtNow ? 'ago' : 'from now';

    const diffMs = Math.abs(dtNow - dt);
    for (const [singular, plural, ms] of timeUnits) {
        if (diffMs >= ms) {
            const value = Math.floor(diffMs / ms);
            const unit = value === 1 ? singular : plural;
            return `${value} ${unit} ${tense}`;
        }
    }
    return `0 milliseconds ${tense}`;
}
