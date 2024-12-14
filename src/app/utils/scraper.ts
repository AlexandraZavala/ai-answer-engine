import axios from "axios";
import * as cheerio from "cheerio";
import { Logger } from "./logger";
import { Redis } from "@upstash/redis";
import puppeteer from "puppeteer";


const logger = new Logger("scraper");

const MAX_CACHE_SIZE = 1000000;
const CACHE_EXPIRATION_TIME = 7 * 60 * 60 * 24; // 1 day

interface ChatMessage {
  role: "system" | "user" | "assistant",
  content: string
}

const redis = new Redis({
  url: process.env["UPSTASH_REDIS_REST_URL"],
  token: process.env["UPSTASH_REDIS_REST_TOKEN"],
});

export const urlPattern =
  /(https?:\/\/)?(www\.)?[a-zA-Z0-9-]{2,}(\.[a-zA-Z]{2,})+((\/[a-zA-Z0-9._~:/?#[\]@!$&'()*+,;=-]*)?)/;

function cleanText(text: string): string {
  return text.replace(/\s+/g, " ").replace(/\n+/g, "").trim();
}

export async function scraperUrl(url: string) {
  try {
    console.log("url", url);

    logger.info(`Scraping URL: ${url}`);
    const cached = await getCachedScrapedContent(url);

    if (cached) {
      logger.info(`Cache hit for ${url}`);
      return cached;
    }

    const response = await axios.get(url);
    //console.log('response URL data',response.data);

    const $ = cheerio.load(response.data);

    $("script").remove();
    $("style").remove();
    $("noscript").remove();
    $("iframe").remove();
    $("img").remove();
    $("video").remove();
    $("audio").remove();
    $("form").remove();
    $("button").remove();

    const title = $("title").text();
    const metaDescription = $('meta[name="description"]').attr("content") || "";
    const h1 = $("h1")
      .map((i, el) => $(el).text())
      .get()
      .join(" ");
    const h2 = $("h2")
      .map((i, el) => $(el).text())
      .get()
      .join(" ");

    const articleText = $("article")
      .map((i, el) => $(el).text())
      .get()
      .join(" ");
    const mainText = $("main")
      .map((i, el) => $(el).text())
      .get()
      .join(" ");

    const contentText = $('.content, #content, [class*="content"]')
      .map((i, el) => $(el).text())
      .get()
      .join(" ");

    const paragraphText = $("p")
      .map((i, el) => $(el).text())
      .get()
      .join(" ");
    const listText = $("li")
      .map((i, el) => $(el).text())
      .get()
      .join(" ");

    let combinedText = [
      title,
      metaDescription,
      h1,
      h2,
      articleText,
      mainText,
      contentText,
      paragraphText,
      listText,
    ].join(" ");

    combinedText = cleanText(combinedText).slice(0, 10000);

    const finalResponse = {
      url,
      title: cleanText(title),
      headings: {
        h1: cleanText(h1),
        h2: cleanText(h2),
      },
      metaDescription: cleanText(metaDescription),
      content: combinedText,
      error: null,
      createdAt: Date.now(),
    };

    await cacheContent(url, finalResponse);

    return finalResponse;
  } catch (error) {
    console.log(
      "error scraping url",
      url,
      error instanceof Error ? error.message : "Unknown error"
    );
    const browser = await puppeteer.launch({headless: false});
    try{
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.96 Safari/537.36');

        await page.setViewport({width: 1080, height: 1024});

        await page.goto(url, { waitUntil: 'networkidle2' });

        await page.waitForSelector('body', {timeout: 90000});
        const headings = await page.$$eval('h1', els => els.map(el => el.innerText.trim()));
        console.log('Encabezados encontrados:', headings);

        const content = await page.evaluate(() => {
            const remove = [
                'script',
                'style',
                'noscript',
                'iframe',
                'img',
                'video',
                'audio',
                'form',
                'button'
            ];

            remove.forEach(selector => {
                document.querySelectorAll(selector).forEach(el => el.remove());
            });

            const title = document.title;
            const h1 = Array.from(document.querySelectorAll('h1')).map(el => el.textContent).join(' ');
            const h2 = Array.from(document.querySelectorAll('h2')).map(el => el.textContent).join(' ');
            const h3 = Array.from(document.querySelectorAll('h3')).map(el => el.textContent).join(' ');
            const metaDescription = Array.from(document.querySelectorAll('meta[name="description"]')).map(el => el.getAttribute('content')).join(' ');
            const article = Array.from(document.querySelectorAll('article')).map(el => el.textContent).join(' ');
            const p = Array.from(document.querySelectorAll('p')).map(el => el.textContent).join(' ');
            const li = Array.from(document.querySelectorAll('li')).map(el => el.textContent).join(' ');

            return {
                title,
                metaDescription,
                headings: {
                  h1,
                  h2,
                  h3
                },
                content: [article,p,li].join(' ')
            };
        });

        await browser.close();
        console.log('content PUPPETEER',content)
        return {
            url,
            title: content.title,
            headings: content.headings,
            metaDescription: content.metaDescription,
            content: content.content,
            error: null,
            createdAt: Date.now(),
        }
    }catch(error){
        console.log('error',error)
    }

    return {
      url,
      title: null,
      headings: null,
      metaDescription: null,
      content: null,
      error: error instanceof Error ? error.message : "Unknown error",
      createdAt: Date.now(),
    };
  }
}

export interface ScrapedContent {
  url: string;
  title: string;
  headings: {
    h1: string;
    h2: string;
  };
  metaDescription: string;
  content: string;
  error: string | null;
  createdAt: number;
}

function getCacheKey(url: string): string {
  const sanitizedUrl = url.substring(0, 255);
  return `scraped:${sanitizedUrl}`;
}

function isValidScrappedContent(data: any): data is ScrapedContent {
  return (
    typeof data === "object" &&
    data !== null &&
    typeof data.url === "string" &&
    typeof data.title === "string" &&
    typeof data.headings === "object" &&
    typeof data.metaDescription === "string" &&
    typeof data.content === "string" &&
    (typeof data.error === "string" || data.error === null) &&
    typeof data.createdAt === "number"
  );
}

async function getCachedScrapedContent(
  url: string
): Promise<ScrapedContent | null> {
  try {
    const key = getCacheKey(url);
    logger.info(`Getting cached scraped content for ${url}`);

    const cached = await redis.get(key);

    if (!cached) {
      logger.info(`Cache miss for ${url}`);
      return null;
    }

    logger.info(`Cache hit for ${url}`);

    let parsed: any;

    if (typeof cached === "string") {
      try {
        parsed = JSON.parse(cached);
      } catch (parseError) {
        logger.error(`Error parsing cached data for ${url}: ${parseError}`);
        await redis.del(key);
        return null;
      }
    } else {
      parsed = cached;
    }

    if (isValidScrappedContent(parsed)) {
      const age = Date.now() - (parsed.createdAt || 0);
      logger.info(
        `Cache hit for ${url} with age ${Math.round(age / 1000 / 60)} minutes`
      );
      return parsed;
    }

    logger.warn(`Invalid cached data for ${url}`);
    await redis.del(key);
    return null;
  } catch (error) {
    logger.error(`Error getting cached scraped content for ${url}: ${error}`);
    return null;
  }
}

async function cacheContent(
  url: string,
  content: ScrapedContent
): Promise<void> {
  try {
    const cacheKey = getCacheKey(url);
    content.createdAt = Date.now();
    console.log("content", content);
    if (!isValidScrappedContent(content)) {
      logger.error(`Invalid content for ${url}`);
      return;
    }

    const serialized = JSON.stringify(content);

    if (serialized.length > MAX_CACHE_SIZE) {
      logger.warn(`Content for ${url} is too large to cache`);
      return;
    }

    await redis.set(cacheKey, serialized, { ex: CACHE_EXPIRATION_TIME });
    logger.info(`Cached content for ${url}`);
  } catch (error) {
    logger.error(`Error caching content for ${url}: ${error}`);
  }
}

export { getCachedScrapedContent, cacheContent };
