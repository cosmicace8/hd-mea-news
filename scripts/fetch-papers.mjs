// PubMed E-utilities から HD-MEA 関連論文を取得し data/papers.json を更新する
// Node の組み込み https モジュールのみを使用(古い Node でも動作させるため fetch は使わない)
import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_PATH = path.join(__dirname, '..', 'data', 'papers.json');

const QUERY = [
  '"high-density microelectrode array"[tiab]',
  '"high density microelectrode array"[tiab]',
  '"HD-MEA"[tiab]',
  '"HD-MEAs"[tiab]',
  '"CMOS microelectrode array"[tiab]',
  '"CMOS-based microelectrode array"[tiab]',
  '"MaxWell Biosystems"[tiab]',
  '"MaxOne"[tiab]',
  '"MaxTwo"[tiab]',
  '"3Brain"[tiab]',
  '"BioCAM"[tiab]',
  '"HyperCAM"[tiab]',
].join(' OR ');

// それ単体では他分野の製品名(供給元)と衝突しうるキーワードは、
// "electrode" の併記を要求することで無関係論文の混入を防ぐ
// (例: "MaxOne" というサプリメント名、"Biocam" という蛍光撮像装置名が実在する)
const STRONG_KEYWORDS = [
  'high-density microelectrode array',
  'high density microelectrode array',
  'HD-MEA',
  'HD-MEAs',
  'CMOS microelectrode array',
  'CMOS-based microelectrode array',
  'MaxWell Biosystems',
].map(normalize);

const AMBIGUOUS_KEYWORDS = ['MaxOne', 'MaxTwo', '3Brain', 'BioCAM', 'HyperCAM'].map(normalize);

const RETMAX = 300;
const EUTILS = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';

function normalize(s) {
  return s.toLowerCase().replace(/[-\s]+/g, ' ').trim();
}

// PubMedの自動用語展開により無関係な論文がヒットすることがあるため、
// タイトル+抄録の中に実際にキーワードが(ハイフン/空白の揺れを許容して)含まれるかを確認する
function matchesKeyword(title, abstractText) {
  const haystack = normalize(title + ' ' + abstractText);
  if (STRONG_KEYWORDS.some((k) => haystack.includes(k))) return true;
  if (haystack.includes('electrode') && AMBIGUOUS_KEYWORDS.some((k) => haystack.includes(k))) return true;
  return false;
}

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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function esearch() {
  const url =
    EUTILS + '/esearch.fcgi?db=pubmed&retmode=json&retmax=' + RETMAX +
    '&sort=pub+date&term=' + encodeURIComponent(QUERY);
  const raw = await httpGet(url);
  const json = JSON.parse(raw);
  if (json.esearchresult && json.esearchresult.idlist) return json.esearchresult.idlist;
  return [];
}

async function esummary(ids) {
  if (ids.length === 0) return {};
  const url = EUTILS + '/esummary.fcgi?db=pubmed&retmode=json&id=' + ids.join(',');
  const raw = await httpGet(url);
  const json = JSON.parse(raw);
  return json.result || {};
}

function decodeXmlEntities(s) {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function stripTags(s) {
  return decodeXmlEntities(s.replace(/<[^>]+>/g, ' '));
}

// efetch (XML) で抄録本文を取得し、PMID -> 抄録テキスト のマップを返す
async function efetchAbstracts(ids) {
  if (ids.length === 0) return {};
  const url = EUTILS + '/efetch.fcgi?db=pubmed&rettype=abstract&retmode=xml&id=' + ids.join(',');
  const raw = await httpGet(url);
  const map = {};
  const articleRe = /<PubmedArticle>([\s\S]*?)<\/PubmedArticle>/g;
  let m;
  while ((m = articleRe.exec(raw))) {
    const block = m[1];
    const pmidMatch = /<PMID[^>]*>(\d+)<\/PMID>/.exec(block);
    if (!pmidMatch) continue;
    const pmid = pmidMatch[1];
    const abstractParts = [];
    const abstractRe = /<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/g;
    let am;
    while ((am = abstractRe.exec(block))) {
      abstractParts.push(stripTags(am[1]));
    }
    map[pmid] = abstractParts.join(' ');
  }
  return map;
}

function formatAuthors(authors) {
  if (!Array.isArray(authors) || authors.length === 0) return '';
  const names = authors.map((a) => a.name).filter(Boolean);
  if (names.length <= 3) return names.join(', ');
  return names.slice(0, 3).join(', ') + ' 他';
}

async function main() {
  console.log('PubMed で HD-MEA 関連論文を検索中...');
  const ids = await esearch();
  console.log(ids.length + ' 件のPMIDを取得');

  const papers = [];
  let skipped = 0;
  const chunkSize = 100;
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    const [summary, abstracts] = await Promise.all([esummary(chunk), efetchAbstracts(chunk)]);
    for (const id of chunk) {
      const item = summary[id];
      if (!item || item.error) continue;
      const title = item.title ? item.title.replace(/\.$/, '') : '(タイトル不明)';
      const abstractText = abstracts[id] || '';

      if (!matchesKeyword(title, abstractText)) {
        skipped++;
        continue;
      }

      const pubdate = item.sortpubdate ? item.sortpubdate.slice(0, 10) : (item.pubdate || '');
      papers.push({
        pmid: id,
        title: title,
        authors: formatAuthors(item.authors),
        journal: item.fulljournalname || item.source || '',
        pubdate: pubdate,
        link: 'https://pubmed.ncbi.nlm.nih.gov/' + id + '/',
      });
    }
    if (i + chunkSize < ids.length) await sleep(400);
  }
  console.log(skipped + ' 件は抄録確認の結果キーワード不一致のため除外');

  papers.sort((a, b) => (b.pubdate || '').localeCompare(a.pubdate || ''));

  const output = {
    updatedAt: new Date().toISOString(),
    query: QUERY,
    count: papers.length,
    papers: papers,
  };

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(output, null, 2), 'utf8');
  console.log(papers.length + ' 件の論文情報を ' + OUT_PATH + ' に保存しました');
}

main().catch((err) => {
  console.error('取得に失敗しました:', err);
  process.exit(1);
});
