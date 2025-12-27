/* eslint-disable security/detect-non-literal-fs-filename */

import { existsSync, readFileSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath, URL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);

// Files should only be served from the "src"
const __dirname = path.join(path.dirname('..', __filename), 'src');

function resolveURL(url) {
    if (url.pathname === '/') {
        return path.join(__dirname, 'popup.html');
    }
    return path.join(__dirname, url.pathname);
}

function resolveData(filePath) {
    const data = readFileSync(filePath);

    // Set the environment to "development"
    if (filePath.endsWith('popup.js')) {
        return String(data).replace("const ENVIRONMENT = 'production';", "const ENVIRONMENT = 'development';");
    }
    return data;
}

// Idea from URL: https://github.com/golang/go/blob/master/src/mime/type.go#L53
const MIME_TYPES = {
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
};

function writeHead(res, code, extname = undefined) {
    if (extname === undefined) {
        return res.writeHead(code, {
            'Content-Type': 'text/plain',
        });
    }
    return res.writeHead(code, {
        'Content-Type': MIME_TYPES[extname] ?? 'text/plain',
    });
}

function handler(req, res) {
    try {
        const url = new URL(req.url, `http://${req.headers.host}`);
        console.log(`Handling request for "${url}"`);

        const filePath = resolveURL(url);
        if (!existsSync(filePath)) {
            writeHead(res, 400).end('404 Not Found');
            return;
        }

        const data = resolveData(filePath);
        writeHead(res, 200, path.extname(filePath)).end(data);
    } catch (err) {
        console.error(`Error handling request: ${err.message}`);
        writeHead(res, 500).end('500 Internal Server Error');
    }
}

// Use the default port, if the environment variable is not defined
const port = process.env.PORT ?? 3000;
http.createServer(handler).listen(port, () => {
    console.log(`Started server. Navigate to "http://localhost:${port}"`);
});
