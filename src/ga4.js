const events = [
    {
        group: 'All properties',
        name: 'ad_impression',
        url: 'https://firebase.google.com/docs/analytics/measure-ad-revenue',
    },
    {
        group: 'All properties',
        name: 'earn_virtual_currency',
        url: 'https://developers.google.com/analytics/devguides/collection/ga4/reference/events#earn_virtual_currency',
    },
    {
        group: 'All properties',
        name: 'generate_lead',
        url: 'https://developers.google.com/analytics/devguides/collection/ga4/reference/events#generate_lead',
    },
    {
        group: 'All properties',
        name: 'join_group',
        url: 'https://developers.google.com/analytics/devguides/collection/ga4/reference/events#join_group',
    },
    {
        group: 'All properties',
        name: 'login',
        url: 'https://developers.google.com/analytics/devguides/collection/ga4/reference/events#login',
    },
    {
        group: 'All properties',
        name: 'purchase',
        url: 'https://developers.google.com/analytics/devguides/collection/ga4/reference/events#purchase',
    },
    {
        group: 'All properties',
        name: 'refund',
        url: 'https://developers.google.com/analytics/devguides/collection/ga4/reference/events#refund',
    },
    {
        group: 'All properties',
        name: 'search',
        url: 'https://developers.google.com/analytics/devguides/collection/ga4/reference/events#search',
    },
    {
        group: 'All properties',
        name: 'select_content',
        url: 'https://developers.google.com/analytics/devguides/collection/ga4/reference/events#select_content',
    },
    {
        group: 'All properties',
        name: 'share',
        url: 'https://developers.google.com/analytics/devguides/collection/ga4/reference/events#share',
    },
    {
        group: 'All properties',
        name: 'sign_up',
        url: 'https://developers.google.com/analytics/devguides/collection/ga4/reference/events#sign_up',
    },
    {
        group: 'All properties',
        name: 'spend_virtual_currency',
        url: 'https://developers.google.com/analytics/devguides/collection/ga4/reference/events#spend_virtual_currency',
    },
    {
        group: 'All properties',
        name: 'tutorial_begin',
        url: 'https://developers.google.com/analytics/devguides/collection/ga4/reference/events#tutorial_begin',
    },
    {
        group: 'All properties',
        name: 'tutorial_complete',
        url: 'https://developers.google.com/analytics/devguides/collection/ga4/reference/events#tutorial_complete',
    },
    {
        group: 'Games',
        name: 'earn_virtual_currency',
        url: 'https://developers.google.com/analytics/devguides/collection/ga4/reference/events#earn_virtual_currency',
    },
    {
        group: 'Games',
        name: 'join_group',
        url: 'https://developers.google.com/analytics/devguides/collection/ga4/reference/events#join_group',
    },
    {
        group: 'Games',
        name: 'level_end',
        url: 'https://developers.google.com/analytics/devguides/collection/ga4/reference/events#level_end',
    },
    {
        group: 'Games',
        name: 'level_start',
        url: 'https://developers.google.com/analytics/devguides/collection/ga4/reference/events#level_start',
    },
    {
        group: 'Games',
        name: 'level_up',
        url: 'https://developers.google.com/analytics/devguides/collection/ga4/reference/events#level_up',
    },
    {
        group: 'Games',
        name: 'post_score',
        url: 'https://developers.google.com/analytics/devguides/collection/ga4/reference/events#post_score',
    },
    {
        group: 'Games',
        name: 'select_content',
        url: 'https://developers.google.com/analytics/devguides/collection/ga4/reference/events#select_content',
    },
    {
        group: 'Games',
        name: 'spend_virtual_currency',
        url: 'https://developers.google.com/analytics/devguides/collection/ga4/reference/events#spend_virtual_currency',
    },
    {
        group: 'Games',
        name: 'tutorial_begin',
        url: 'https://developers.google.com/analytics/devguides/collection/ga4/reference/events#tutorial_begin',
    },
    {
        group: 'Games',
        name: 'tutorial_complete',
        url: 'https://developers.google.com/analytics/devguides/collection/ga4/reference/events#tutorial_complete',
    },
    {
        group: 'Games',
        name: 'unlock_achievement',
        url: 'https://developers.google.com/analytics/devguides/collection/ga4/reference/events#unlock_achievement',
    },
    {
        group: 'Lead generation',
        name: 'generate_lead',
        url: 'https://developers.google.com/analytics/devguides/collection/ga4/reference/events?client_type=gtag#generate_lead',
    },
    {
        group: 'Lead generation',
        name: 'qualify_lead',
        url: 'https://developers.google.com/analytics/devguides/collection/ga4/reference/events?client_type=gtag#qualify_lead',
    },
    {
        group: 'Lead generation',
        name: 'disqualify_lead',
        url: 'https://developers.google.com/analytics/devguides/collection/ga4/reference/events?client_type=gtag#disqualify_lead',
    },
    {
        group: 'Lead generation',
        name: 'working_lead',
        url: 'https://developers.google.com/analytics/devguides/collection/ga4/reference/events?client_type=gtag#working_lead',
    },
    {
        group: 'Lead generation',
        name: 'close_convert_lead',
        url: 'https://developers.google.com/analytics/devguides/collection/ga4/reference/events?client_type=gtag#close_convert_lead',
    },
    {
        group: 'Lead generation',
        name: 'close_unconvert_lead',
        url: 'https://developers.google.com/analytics/devguides/collection/ga4/reference/events?client_type=gtag#close_unconvert_lead',
    },
    {
        group: 'Online sales',
        name: 'add_payment_info',
        url: 'https://developers.google.com/analytics/devguides/collection/ga4/reference/events#add_payment_info',
    },
    {
        group: 'Online sales',
        name: 'add_shipping_info',
        url: 'https://developers.google.com/analytics/devguides/collection/ga4/reference/events#add_shipping_info',
    },
    {
        group: 'Online sales',
        name: 'add_to_cart',
        url: 'https://developers.google.com/analytics/devguides/collection/ga4/reference/events#add_to_cart',
    },
    {
        group: 'Online sales',
        name: 'add_to_wishlist',
        url: 'https://developers.google.com/analytics/devguides/collection/ga4/reference/events#add_to_wishlist',
    },
    {
        group: 'Online sales',
        name: 'begin_checkout',
        url: 'https://developers.google.com/analytics/devguides/collection/ga4/reference/events#begin_checkout',
    },
    {
        group: 'Online sales',
        name: 'purchase',
        url: 'https://developers.google.com/analytics/devguides/collection/ga4/reference/events#purchase',
    },
    {
        group: 'Online sales',
        name: 'refund',
        url: 'https://developers.google.com/analytics/devguides/collection/ga4/reference/events#refund',
    },
    {
        group: 'Online sales',
        name: 'remove_from_cart',
        url: 'https://developers.google.com/analytics/devguides/collection/ga4/reference/events#remove_from_cart',
    },
    {
        group: 'Online sales',
        name: 'select_item',
        url: 'https://developers.google.com/analytics/devguides/collection/ga4/reference/events#select_item',
    },
    {
        group: 'Online sales',
        name: 'select_promotion',
        url: 'https://developers.google.com/analytics/devguides/collection/ga4/reference/events#select_promotion',
    },
    {
        group: 'Online sales',
        name: 'view_cart',
        url: 'https://developers.google.com/analytics/devguides/collection/ga4/reference/events#view_cart',
    },
    {
        group: 'Online sales',
        name: 'view_item',
        url: 'https://developers.google.com/analytics/devguides/collection/ga4/reference/events#view_item',
    },
    {
        group: 'Online sales',
        name: 'view_item_list',
        url: 'https://developers.google.com/analytics/devguides/collection/ga4/reference/events#view_item_list',
    },
    {
        group: 'Online sales',
        name: 'view_promotion',
        url: 'https://developers.google.com/analytics/devguides/collection/ga4/reference/events#view_promotion',
    },
];

export function getEventInfo(name) {
    return events.find((event) => event.name === name);
}
