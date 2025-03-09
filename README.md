<div align="center">
    <h1>dataLayer Explorer</h1>
    <img src="./src/icons/icon128.png" alt="Extension logo">
</div>
<br />

**dataLayer Explorer** is a powerful Chrome extension designed to simplify the analysis of a site's dataLayer for developers and digital marketers. This tool provides real-time insights into dataLayer events, enabling users to effortlessly monitor and inspect event data for informed decision-making.

<div align="center">
    <img src="./images/app1.png" alt="Extension screenshot">
</div>

## Features

- **Access detailed data effortlessly** View a comprehensive list of events, each expandable to reveal rich, detailed information. The intuitive interface allows for quick navigation through events, ensuring important insights are easily accessible.
- **Identify GA4 events quickly** A visual indicator <img src="./src/icons/ga4.svg" width="16" height="16" /> helps distinguish Google Analytics 4 (GA4) events, making it simpler to focus on relevant data.
- **Facilitate sharing** The "Copy" function enables easy copying of event details to the clipboard for quick access or sharing with team members, streamlining collaboration.
- **Analyze event timing precisely** Gain insights into the time elapsed between page load and each event push by simply hovering over the event name. This feature enables detailed analysis of event timing, contributing to a deeper understanding of site performance and user experience. Such precise timing information can be invaluable for optimizing page load sequences and improving overall site responsiveness.
- **Stay updated with ease** The extension features a refresh button that allows users to update the events list manually, ensuring access to the latest data whenever needed.
- **Open Source advantage** This extension is open source, allowing users to benefit from community-driven development and transparency. By being open source, it ensures that anyone can contribute to its improvement, fostering innovation and responsiveness to user needs.

## Installation

- [Chrome Web Store](https://chromewebstore.google.com/detail/datalayer-explorer/akeipgacajnejdmcdmjcilfmhmaejjoe)

## Development

This extension is built with simplicity and transparency in mind. The source code is written in vanilla JavaScript and utilizes Chrome APIs directly, without the use of bundlers or frameworks. This approach ensures that the code you see in the repository is identical to what is deployed to the Chrome Web Store, facilitating easier review, modification, and understanding of the extension's functionality.

- `background.js`: Serves as the extension's service worker, responsible for updating the browser icon based on the presence of the `dataLayer` for the currently viewed site.
- `popup.html` / `popup.js`: Provides the user interface for debugging and interacting with the `dataLayer`.
- `contentScript.js`: Facilitates communication between `background.js` and `popup.html`, detecting when the `dataLayer` is present and relaying the events pushed to it.
- `init.js`: Loaded by `contentScript.js`, this script captures dataLayer events and sends them back to `contentScript.js`. This is necessary because `contentScript.js` lacks direct access to the window object and relies on these events when requested by `popup.html`.

### Setup

Install the extension from the [./src](./src) directory as an unpacked extension by following the instructions outlined in [this guide](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-unpacked).

### popup.html / popup.js

The extension provides a streamlined development process for the popup interface by utilizing a development server. When the `ENVIRONMENT` constant is set to `development` (which is done by the server), this setup allows developers to work without relying on Chrome APIs and instead uses simulated event data in place of actual dataLayer events. This approach enables efficient testing and iteration without the need to constantly close and reopen the extension.

#### Setup

1. Install the supported `Node.js` version using [`nvm`](https://github.com/nvm-sh/nvm).

```bash
nvm install
```

2. Install dependencies.

```bash
npm install
```

3. Start the development server.

```bash
npm run start
```

4. Navigate to http://localhost:8100.

5. Start editing `popup.html` / `popup.js` in the [./src](./src) directory.

## Contributing

If you encounter a bug while using the extension, please file an issue to report it. Suggestions for improvements are also welcome—feel free to submit an issue outlining your ideas. Additionally, if you'd like to contribute directly, you can provide enhancements through a merge request.

Your contributions help improve the extension and benefit the entire community.

## Acknowledgements

- [Application icon by Freepik](https://www.freepik.com/icon/profit_2382603#fromView=family&page=1&position=89&uuid=8883d7b3-8586-4727-a7a4-7fdbe25f53db)
- [Google Analytics 4 (GA4) by gilbarbara](https://www.svgrepo.com/svg/353804/google-analytics)

## License

The code has been licensed under the [MIT](https://opensource.org/license/mit) license.
