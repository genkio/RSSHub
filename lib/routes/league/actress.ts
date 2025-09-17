import { Route } from '@/types';
import got from '@/utils/got';
import { load } from 'cheerio';
import { parseDate } from '@/utils/parse-date';

export const route: Route = {
    path: '/actress/:id',
    categories: ['multimedia'],
    example: '/av-league/actress/8054',
    parameters: {
        id: 'Actress ID',
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
            source: ['av-league.com/actress/:id.html'],
            target: '/actress/:id',
        },
    ],
    name: 'Actress Comments',
    maintainers: ['Manus'],
    handler,
};

async function handler(ctx) {
    const { id } = ctx.req.param();
    const baseUrl = 'https://www.av-league.com';
    const currentUrl = `${baseUrl}/actress/${id}.html`;

    const { data: response } = await got(currentUrl);
    const $ = load(response);

    // Extract actress name from the page title
    const actressName = $('h1').text().trim() || 'Unknown Actress';

    // Extract comments from the page
    // Based on the HTML structure observed, comments are in a specific format
    const comments = [];

    // Look for comment elements in the co-hist-list area
    $('.co-hist-list')
        .find('div')
        .each((index, element) => {
            const $element = $(element);

            // Extract the comment text (usually the first text content)
            const textContent = $element
                .contents()
                .filter(function () {
                    return this.nodeType === 3; // Text node
                })
                .text()
                .trim();

            // Extract author and date info from spans
            const authorDateSpan = $element.find('span').last();
            const authorAndDate = authorDateSpan.text().trim();

            if (textContent && textContent.length > 0) {
                comments.push({
                    text: textContent,
                    authorDate: authorAndDate,
                });
            }
        });

    // If no comments found in co-hist-list, try alternative selectors
    if (comments.length === 0) {
        // Try to find comments in other possible structures
        $('div').each((index, element) => {
            const $element = $(element);
            const text = $element.text().trim();

            // Look for patterns that indicate comments (contains date patterns)
            if (text.includes('2025/') || text.includes('2024/')) {
                const spans = $element.find('span');
                if (spans.length > 0) {
                    const authorDateSpan = spans.last();
                    const authorAndDate = authorDateSpan.text().trim();

                    // Extract comment text by removing the author/date part
                    const commentText = text.replace(authorAndDate, '').trim();

                    if (commentText && commentText.length > 10) {
                        comments.push({
                            text: commentText,
                            authorDate: authorAndDate,
                        });
                    }
                }
            }
        });
    }

    // Process comments into RSS items
    const items = comments.map((comment, index) => {
        // Parse author and date from the authorDate string
        // Format is usually like: "(**username** 2025/9/14 18:21 ID:11683)"
        const authorMatch = comment.authorDate.match(/\*\*([^*]+)\*\*/);
        const dateMatch = comment.authorDate.match(/(\d{4}\/\d{1,2}\/\d{1,2}\s+\d{1,2}:\d{2})/);
        const idMatch = comment.authorDate.match(/ID:(\d+)/);

        const author = authorMatch ? authorMatch[1] : 'Anonymous';
        const dateStr = dateMatch ? dateMatch[1] : '';
        const commentId = idMatch ? idMatch[1] : index.toString();

        // Parse the date
        let pubDate;
        try {
            pubDate = dateStr ? parseDate(dateStr, 'YYYY/M/D H:mm', 'ja-JP') : new Date();
        } catch {
            pubDate = new Date();
        }

        return {
            title: `Comment by ${author}`,
            description: comment.text,
            link: `${currentUrl}#comment-${commentId}`,
            pubDate,
            author,
            guid: `av-league-${id}-comment-${commentId}`,
        };
    });

    return {
        title: `${actressName} - Comments - AV League`,
        link: currentUrl,
        item: items,
        description: `Latest comments for ${actressName} on AV League`,
    };
}
