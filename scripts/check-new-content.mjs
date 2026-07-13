// 3Brain / MaxWell Biosystems の sitemap.xml を巡回し、
// イベント・ニュース系ページのうち data/events.json / data/news.json に
// まだ載っていない新規URLを検出して data/new-content-alerts.json に書き出す。
//
// 注意: このスクリプトはタイトルや日付・要約を自動で生成しない。
// 新規ページのURLを検知するだけで、内容の要約・events.json / news.jsonへの反映は人手で行う。
import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const EVENTS_PATH = path.join(DATA_DIR, 'events.json');
const NEWS_PATH = path.join(DATA_DIR, 'news.json');
const ALERTS_PATH = path.join(DATA_DIR, 'new-content-alerts.json');

function httpGet(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { 'User-Agent': 'hd-mea-news-site/1.0 (research aggregator)' } }, (res) => {
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error('HTTP ' + res.statusCode + ' for ' + url));
          res.resume();
          return;
        }
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => resolve(data));
      })
      .on('error', reject);
  });
}

function normalizeUrl(u) {
  return u.replace(/\/$/, '');
}

async function fetchSitemapUrls(sitemapUrl) {
  const xml = await httpGet(sitemapUrl);
  const urls = [];
  const re = /<loc>([^<]+)<\/loc>/g;
  let m;
  while ((m = re.exec(xml))) {
    urls.push(m[1].trim());
  }
  return urls;
}

// サイト固有の「これは個別のイベント/ニュースページか」を判定するルール
const SOURCES = [
  {
    id: '3brain',
    label: '3Brain',
    sitemapUrl: 'https://www.3brain.com/sitemap.xml',
    isContent: (u) => {
      if (u.pathname.includes('/zh-cn/')) return false;
      if (!u.pathname.startsWith('/events/')) return false;
      const slug = u.pathname.slice('/events/'.length).replace(/\/$/, '');
      if (!slug || slug === 'events-overview') return false;
      return true;
    },
    guessType: () => 'event',
  },
  {
    id: 'maxwell',
    label: 'MaxWell Biosystems',
    sitemapUrl: 'https://www.mxwbio.com/sitemap.xml',
    isContent: (u) => {
      if (u.pathname.includes('/zh-cn/')) return false;
      const nestedEventPrefixes = ['/events/mxw-events/', '/events/webinars/', '/events/conferences/'];
      for (const prefix of nestedEventPrefixes) {
        if (u.pathname.startsWith(prefix)) {
          const rest = u.pathname.slice(prefix.length).replace(/\/$/, '');
          if (rest) return true;
        }
      }
      if (u.pathname.startsWith('/blog-news/')) {
        const rest = u.pathname.slice('/blog-news/'.length).replace(/\/$/, '');
        if (rest) return true;
      }
      return false;
    },
    guessType: (u) => (u.pathname.startsWith('/events/') ? 'event' : 'news'),
  },
];

function loadKnownUrls() {
  const known = new Set();

  if (fs.existsSync(EVENTS_PATH)) {
    const events = JSON.parse(fs.readFileSync(EVENTS_PATH, 'utf8'));
    for (const e of events.events || []) {
      if (e.url) known.add(normalizeUrl(e.url));
    }
  }

  if (fs.existsSync(NEWS_PATH)) {
    const news = JSON.parse(fs.readFileSync(NEWS_PATH, 'utf8'));
    for (const c of news.companies || []) {
      for (const item of c.items || []) {
        if (item.url) known.add(normalizeUrl(item.url));
      }
      if (c.url) known.add(normalizeUrl(c.url));
    }
  }

  return known;
}

function loadExistingAlerts() {
  if (!fs.existsSync(ALERTS_PATH)) return {};
  const data = JSON.parse(fs.readFileSync(ALERTS_PATH, 'utf8'));
  const map = {};
  for (const a of data.alerts || []) {
    map[normalizeUrl(a.url)] = a.discoveredAt;
  }
  return map;
}

async function main() {
  const knownUrls = loadKnownUrls();
  const previousAlerts = loadExistingAlerts();
  const today = new Date().toISOString().slice(0, 10);

  const alerts = [];

  for (const source of SOURCES) {
    console.log(source.label + ' の sitemap.xml を確認中...');
    let rawUrls;
    try {
      rawUrls = await fetchSitemapUrls(source.sitemapUrl);
    } catch (err) {
      console.error(source.label + ' の取得に失敗: ' + err.message);
      continue;
    }

    const seen = new Set();
    for (const raw of rawUrls) {
      let u;
      try {
        u = new URL(raw);
      } catch {
        continue;
      }
      if (!source.isContent(u)) continue;
      const norm = normalizeUrl(raw);
      if (seen.has(norm)) continue;
      seen.add(norm);

      if (knownUrls.has(norm)) continue; // events.json/news.json に既に反映済み

      alerts.push({
        source: source.label,
        type: source.guessType(u),
        url: raw,
        discoveredAt: previousAlerts[norm] || today,
      });
    }
  }

  alerts.sort((a, b) => b.discoveredAt.localeCompare(a.discoveredAt));

  const output = {
    updatedAt: new Date().toISOString(),
    note: 'ここに載っているのは「未確認の新規ページ候補」。内容を確認しdata/events.jsonまたはdata/news.jsonに手動で反映したら、このリストから自然に消えます(反映先にurlが載れば次回実行時に除外されるため)。',
    count: alerts.length,
    alerts: alerts,
  };

  fs.writeFileSync(ALERTS_PATH, JSON.stringify(output, null, 2), 'utf8');
  console.log(alerts.length + ' 件の未確認ページを ' + ALERTS_PATH + ' に書き出しました');
}

main().catch((err) => {
  console.error('取得に失敗しました:', err);
  process.exit(1);
});
