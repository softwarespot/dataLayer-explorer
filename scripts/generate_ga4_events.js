// IMPORTANT: As this is infrequently run, and the site is likely to change,
// there is no need to make this into a fully automated script i.e. a web scraper.

// The code generates a list of GA4 events, which are recommended by Google.
// 1. Navigate to https://support.google.com/analytics/answer/9267735?sjid=14884318886463999267-EU
// 2. Run the following code in the browser's console e.g. Chrome DevTools
// 3. Copy the results to the file "ga4.js" and modify accordingly

const events = [];
const headingInfos = [
    { id: '#all-properties', name: 'All properties' },
    { id: '#games', name: 'Games' },
    { id: '#lead-gen', name: 'Lead generation' },
    { id: '#online-sales', name: 'Online sales' },
];
for (const headingInfo of headingInfos) {
    const linkEls = document.querySelector(`${headingInfo.id} ~ table`).querySelectorAll('a');
    for (const linkEl of linkEls) {
        events.push({
            group: headingInfo.name,
            name: linkEl.textContent,
            url: linkEl.href,
        });
    }
}
console.log(JSON.stringify(events, undefined, 4));
