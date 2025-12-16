import { XMLParser } from "fast-xml-parser";
import he from "he";
import { load } from "cheerio";

const FEED_URL = "https://www.blognone.com/node/feed";

export default {
    async fetch(request, env, ctx) {
        try {
            const res = await fetch(FEED_URL, {
                headers: {
                    "User-Agent": "Mozilla/5.0 (compatible; BlognoneWorker/1.0;)"
                }
            });

            if (!res.ok) {
                return new Response(`Fetch failed: ${res.status}`, { status: 500 });
            }
            const xml = await res.text();

            // 2) Parse XML
            const parser = new XMLParser({ ignoreAttributes: false });
            const rss = parser.parse(xml);

            // 3) Normalize item ให้เป็น array
            const channelItem = rss?.rss?.channel?.item;
            const items = Array.isArray(channelItem)
                ? channelItem
                : channelItem
                    ? [channelItem]
                    : [];

            // 4) แปลงทุกบทความ
            const results = items.map((item) => {
                // decode HTML entities
                const decodedHtml = he.decode(item.description || "");

                // parse HTML
                const $ = load(decodedHtml);
                $("span").first().remove();
                $("span a[title='View user profile.']").parent().remove();
                $("time").parent("span").remove();

                /**
                 * 6) ดึง body เป็น HTML
                 */
                const contentHtml =
                    $(".field--name-body .field-item").html()?.trim() || "";

                return {
                    title: item.title,
                    link: item.link,
                    pubDate: item.pubDate,
                    contentHtml,
                };
            });

            // 7) Return JSON
            return new Response(JSON.stringify(results, null, 2), {
                headers: {
                    "content-type": "application/json; charset=UTF-8",
                    "Access-Control-Allow-Origin": "*",
                    "Cache-Control": "public, max-age=300, s-maxage=300"
                },
            });

        } catch (err) {
            return new Response(JSON.stringify({ error: err.message }), {
                status: 500,
                headers: { "content-type": "application/json" },
            });
        }
    },
};