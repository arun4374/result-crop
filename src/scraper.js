const axios = require('axios');
const cheerio = require('cheerio');
const dayjs = require('dayjs');
const customParseFormat = require('dayjs/plugin/customParseFormat');

dayjs.extend(customParseFormat);

const NOTICE_URL = process.env.COE_NOTICE_URL || 'https://coe.annauniv.edu/home/exp_msg_home.php';
const SCRAPE_LIMIT = parseInt(process.env.SCRAPE_LIMIT || '10', 10);

// Source format looks like: "05 Jun 2026 06:09 PM"
const SOURCE_DATE_FORMAT = 'DD MMM YYYY hh:mm A';

/**
 * Cleans up raw scraped text: decodes &#160;/&nbsp;, collapses whitespace, trims.
 */
function cleanText(text) {
  return text
    .replace(/&#160;/g, ' ')
    .replace(/\u00a0/g, ' ') // actual non-breaking space char, in case cheerio already decoded it
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Fetches the notice board page and returns the latest N entries, newest first.
 * Each entry: { timestamp: Date, rawTimestamp: string, message: string, link: string|null }
 */
async function fetchLatestNotices() {
  const { data: html } = await axios.get(NOTICE_URL, {
    timeout: 15000,
    headers: {
      // A normal browser-like UA is courteous and avoids being treated as a bare bot
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
    },
  });

  const $ = cheerio.load(html);
  const entries = [];

  $('.info').each((_, el) => {
    if (entries.length >= SCRAPE_LIMIT) return;

    const block = $(el);

    // First inner div holds the timestamp (text before the <hr>)
    const rawTimestamp = cleanText(block.find('div').first().clone().children().remove().end().text());

    // Second inner div holds the <p> message, which may contain an <a> link
    const messageDiv = block.find('div').eq(1);
    const paragraph = messageDiv.find('p').first();
    const linkEl = paragraph.find('a').first();
    const link = linkEl.length ? linkEl.attr('href') : null;

    // Strip the <a> tag's own text (e.g. "Click Here") out of the message,
    // since the link is stored separately and shouldn't be duplicated in the text.
    const message = cleanText(paragraph.clone().find('a').remove().end().text());

    if (!rawTimestamp || !message) return;

    const parsed = dayjs(rawTimestamp, SOURCE_DATE_FORMAT, true);
    if (!parsed.isValid()) {
      console.warn(`[scraper] Could not parse timestamp: "${rawTimestamp}" — skipping entry`);
      return;
    }

    entries.push({
      timestamp: parsed.toDate(),
      rawTimestamp,
      message,
      link: link ? new URL(link, NOTICE_URL).href : null, // resolve relative URLs to absolute
    });
  });

  // Page is already newest-first, but sort defensively in case that ever changes
  entries.sort((a, b) => b.timestamp - a.timestamp);

  return entries;
}

module.exports = { fetchLatestNotices, cleanText };
