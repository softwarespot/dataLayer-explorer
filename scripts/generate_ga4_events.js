/* eslint-disable no-console */

// This code generates the recommended GA4 events.
// IMPORTANT: As this is infrequently run, and the site is subject to change, there is no
// need to make this too automated.
// 1. Navigate to https://support.google.com/analytics/answer/9267735?sjid=14884318886463999267-EU
// 2. Run the following code in the browser's console
// 3. Copy the results to the file "ga4_events.js" and modify accordingly

const headingInfos = [
    { id: '#all-properties', name: 'All properties' },
    { id: '#online-sales', name: 'Online sales' },
    { id: '#games', name: 'Games' },
    { id: '#lead-gen', name: 'Lead generation' },
];
const res = [];
for (const headingInfo of headingInfos) {
    const linkEls = document.querySelector(`${headingInfo.id} ~ table`).querySelectorAll('a');
    for (const linkEl of linkEls) {
        res.push({
            group: headingInfo.name,
            name: linkEl.textContent,
            url: linkEl.href,
        });
    }
}
console.log(JSON.stringify(res));
