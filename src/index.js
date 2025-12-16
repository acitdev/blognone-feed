import { XMLParser, XMLBuilder } from "fast-xml-parser";
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
            if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
            const xml = await res.text();

            const parser = new XMLParser({
                ignoreAttributes: false,
                parseTagValue: false
            });
            const rssObj = parser.parse(xml);

            let items = rssObj?.rss?.channel?.item;
            if (!items) items = [];
            if (!Array.isArray(items)) items = [items];

            items.forEach((item) => {
                const rawDesc = item.description || "";
                const decodedHtml = he.decode(typeof rawDesc === 'string' ? rawDesc : "");

                const $ = load(decodedHtml);

                $("span").first().remove();
                $("span a[title='View user profile.']").parent().remove();
                $("time").parent("span").remove();

                const cleanContent = $(".field--name-body .field-item").html()?.trim() || "";

                item.description = cleanContent;
            });

            const builder = new XMLBuilder({
                ignoreAttributes: false,
                format: true,
                processEntities: false,
                suppressBooleanAttributes: false
            });

            const outputXml = builder.build(rssObj);

            return new Response(outputXml, {
                headers: {
                    "content-type": "application/xml; charset=UTF-8",
                    "Cache-Control": "public, max-age=300, s-maxage=300",
                    "Access-Control-Allow-Origin": "*",
                },
            });

        } catch (err) {
            return new Response(
                `<?xml version="1.0"?><error>${err.message}</error>`,
                {
                    status: 500,
                    headers: { "content-type": "application/xml" }
                }
            );
        }
    },
};