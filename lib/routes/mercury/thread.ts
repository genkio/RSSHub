import { Route } from '@/types';
import got from '@/utils/got';
import { load } from 'cheerio';
import { parseDate } from '@/utils/parse-date';
import iconv from 'iconv-lite';

export const route: Route = {
    path: '/bbspink/:board/:id',
    categories: ['bbs'],
    example: '/mercury/bbspink/avideo2/1728052045',
    parameters: {
        board: 'Board name',
        id: 'Thread ID',
    },
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
            source: ['mercury.bbspink.com/:board/read.cgi/:board/:id'],
            target: '/bbspink/:board/:id',
        },
    ],
    name: 'Thread',
    maintainers: ['Manus'],
    handler,
};

async function handler(ctx) {
    const { board, id } = ctx.req.param();
    const baseUrl = 'https://mercury.bbspink.com';
    const currentUrl = `${baseUrl}/test/read.cgi/${board}/${id}`;

    // Specify encoding as null to get a Buffer instead of a string
    // Japanese BBS sites often use Shift-JIS or EUC-JP encoding
    const { data: response } = await got(currentUrl, { responseType: 'buffer' });

    // Convert from Shift-JIS to UTF-8
    const decodedContent = iconv.decode(response, 'shift_jis');

    const $ = load(decodedContent);

    // Each post is contained in an <article> element with the class "post"
    const items = $('article.post')
        .toArray()
        .map((article) => {
            const $article = $(article);
            const postId = $article.attr('data-id');
            const dateText = $article.find('.date').text().trim();
            const postContent = $article.find('.post-content').html()?.trim() || '';
            const username = $article.find('.postusername b a').text().trim();
            const userId = $article.find('.uid').text().trim();

            // Convert Japanese date format to standard format
            // Example: "2025/05/15(木) 09:03:21.61" -> "2025-05-15T09:03:21+09:00"
            const pubDate = parseDate(dateText, 'YYYY/MM/DD HH:mm:ss.SS', 'ja-JP');

            return {
                title: `Post #${postId} by ${username}`,
                description: postContent,
                link: `${currentUrl}#${postId}`,
                pubDate,
                author: `${username} ${userId}`,
                guid: `mercury-bbspink-${board}-${id}-${postId}`,
            };
        });

    // Get thread title from the page
    const threadTitle = $('title').text().trim().replace(' - mercury.bbspink.com', '');

    return {
        title: `${threadTitle} - Mercury BBSPink`,
        link: currentUrl,
        item: items,
        description: `Thread ${id} from ${board} board on Mercury BBSPink`,
    };
}
