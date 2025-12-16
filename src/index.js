import { XMLParser } from "fast-xml-parser";
import he from "he";
import cheerio from "cheerio";

const FEED_URL = "https://www.blognone.com/node/feed";

export default {
    async fetch(request, env, ctx) {
        try {
            // 1) ดึง RSS จากเว็บ
            const res = await fetch(FEED_URL);
            if (!res.ok) {
                return new Response(`Fetch failed: ${res.status}`, { status: 500 });
            }
            const xml = await res.text();

            // 2) Parse XML
            const parser = new XMLParser({ ignoreAttributes: false });
            const rss = parser.parse(xml);

            // 3) Normalize item ให้เป็น array
            // ตรวจสอบความปลอดภัย: กรณีไม่มี item เลย หรือโครงสร้างผิดพลาด
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
                const $ = cheerio.load(decodedHtml);

                /**
                 * 5) ลบส่วนที่ไม่ต้องการ
                 */
                // span แรก = หัวข้อซ้ำ
                $("span").first().remove();

                // ผู้เขียน
                $("span a[title='View user profile.']").parent().remove();

                // เวลา
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

            // 7) ใช้งานต่อ: แทนที่จะเขียนไฟล์ เราส่ง JSON กลับไปเป็น Response
            return new Response(JSON.stringify(results, null, 2), {
                headers: {
                    "content-type": "application/json; charset=UTF-8",
                    // เพิ่ม CORS หากต้องการเรียกจาก Frontend โดยตรง
                    "Access-Control-Allow-Origin": "*",
                },
            });

        } catch (err) {
            // Error Handling
            return new Response(JSON.stringify({ error: err.message }), {
                status: 500,
                headers: { "content-type": "application/json" },
            });
        }
    },
};