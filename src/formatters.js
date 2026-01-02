import { escapeHTML, flatten, flattenKeys, isObject, truncate } from './utils.js';

export function formatAsJSON(str) {
    // Taken from URL: https://codepen.io/absolutedevelopment/pen/EpwVzN
    // Group 1: String literals with proper escape handling
    //   - "(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*" - strings with unicode/escape sequences
    //   - (\s*:)? - optional colon for object keys
    // Group 2: Primitive literals
    //   - \b(true|false|null)\b - boolean and null literals (word boundaries prevent partial matches)
    // Group 3: Numeric literals
    //   - -?\d+(?:\.\d*)?(?:[eE][+-]?\d+)? - integers, floats, scientific notation
    const reParseJSON =
        // eslint-disable-next-line security/detect-unsafe-regex, sonarjs/regex-complexity
        /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g;
    return escapeHTML(str).replace(reParseJSON, (match) => {
        return `<span class="${getClassNameForJSON(match)}">${truncate(match, 256)}</span>`;
    });
}

function getClassNameForJSON(str) {
    if (str === 'null') {
        return 'json-null';
    }
    if (str === 'true' || str === 'false') {
        return 'json-boolean';
    }
    if (str.startsWith('"')) {
        if (str.endsWith(':')) {
            return 'json-key';
        }
        return 'json-string';
    }
    return 'json-number';
}

export function formatAsColumn(obj) {
    let html = '<table class="column-format-table">';
    for (const [keys, value] of flatten(obj)) {
        const key = flattenKeys(keys);
        const strValue = isObject(value) ? JSON.stringify(value) : String(value);
        html += `
            <tr>
                <td class="column-key">${escapeHTML(key)}</td>
                <td class="column-value">${escapeHTML(truncate(strValue, 256))}</td>
            </tr>
        `;
    }
    html += '</table>';

    return html;
}
