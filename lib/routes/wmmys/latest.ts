import { Route } from '@/types';
import got from '@/utils/got';
import { load } from 'cheerio';
import { parseDate } from '@/utils/parse-date';

const baseUrl = 'https://www.wmmys.com';

export const route: Route = {
    path: '/latest', // or /bbs-index-run, user can decide or I can make a suggestion
    categories: ['multimedia'],
    example: '/wmmys/latest',
    parameters: {},
    features: {
        requireConfig: false,
        requirePuppeteer: false,
        antiCrawler: false,
        supportBT: false,
        supportPodcast: false,
        supportScihub: false,
    },
    radar: [
        {
            source: ['wmmys.com/bbs-index-run'],
            target: '/latest',
        },
    ],
    name: 'Latest Posts',
    maintainers: ['Manus'],
    handler,
    url: 'wmmys.com/bbs-index-run',
};

async function handler() {
    const currentUrl = `${baseUrl}/bbs-index-run`;

    const { data: response } = await got(currentUrl);
    const $ = load(response);

    // Based on the site structure, items seem to be directly under a main container.
    // The user provided sample HTML shows an 'a' tag as the item root.
    // We need to find a common parent for these 'a' tags.
    // Let's assume the items are in a div with class 'movie-list' or similar, or directly in the body if no clear container.
    // For wmmys.com, the items are in <div class="container-fluid movie-list">, and each item is an 'a' tag.
    // However, the direct children of 'div.container-fluid.movie-list' are 'div' elements, and 'a' tags are inside these divs.
    // Let's refine the selector based on typical HTML structure for such lists or the provided sample.
    // The sample HTML is <a href="..."><img .../><p>...</p><p>...</p></a>
    // On the actual page https://www.wmmys.com/bbs-index-run, the structure is more like:
    // <div class="col-xs-4 col-sm-3 col-md-2 col-lg-1dot7"> <a href="...">...</a> </div>
    // So we should target the 'a' tags within these columns.
    // A more robust selector might be 'div[class*="col-"] > a' if they are consistently structured this way.
    // Or, if all relevant links are simply 'a' tags with an image and paragraphs inside, we can be more general.
    // Let's try to find all 'a' tags that have an 'img' and 'p' tags as children, matching the sample structure.

    const list = $('a')
        .filter((i, el) => {
            const img = $(el).find('img.layeach');
            const p_title = $(el).find('p').not('.newindexbt2');
            return img.length > 0 && p_title.length > 0;
        })
        .toArray();

    const items = list.map((item) => {
        const $item = $(item);
        const relativeLink = $item.attr('href');
        const itemLink = `${baseUrl}${relativeLink}`;
        const posterImgSrc = $item.find('img.layeach').attr('data-echo') || $item.find('img.layeach').attr('src');
        const fullPosterImgSrc = `${baseUrl}${posterImgSrc}`;
        const title = $item.find('p').not('.newindexbt2').first().text().trim();
        const dateText = $item.find('p.newindexbt2').text().trim();

        return {
            title,
            link: itemLink,
            pubDate: parseDate(dateText, 'MM-DD HH:mm'), // Assuming current year, format MM-DD HH:mm
            description: `<img src="${fullPosterImgSrc}" alt="${title}"><br><p>${title}</p>`,
            // author: 'WMMYS', // Optional: if there's a general author or can be extracted
        };
    });

    return {
        title: 'WMMYS - Latest Posts',
        link: currentUrl,
        item: items,
        description: 'Latest movie and show updates from WMMYS.',
    };
}
