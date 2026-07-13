// タブ切り替え
const tabButtons = document.querySelectorAll('.tab-btn');
const panels = document.querySelectorAll('.tab-panel');

tabButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    tabButtons.forEach((b) => b.classList.remove('active'));
    panels.forEach((p) => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
  });
});

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  return dateStr.replace(/\//g, '-');
}

// ---- 論文タブ ----
let allPapers = [];

async function loadPapers() {
  const metaEl = document.getElementById('papers-meta');
  const listEl = document.getElementById('paper-list');
  try {
    const res = await fetch('data/papers.json');
    const data = await res.json();
    allPapers = data.papers || [];
    metaEl.textContent =
      data.count + ' 件の論文(最終更新: ' + new Date(data.updatedAt).toLocaleString('ja-JP') + ')';
    renderPapers();
  } catch (err) {
    metaEl.textContent = '論文データの読み込みに失敗しました。';
    listEl.innerHTML = '<li class="empty-state">data/papers.json を確認してください。</li>';
  }
}

function renderPapers() {
  const listEl = document.getElementById('paper-list');
  const keyword = document.getElementById('paper-search').value.trim().toLowerCase();
  const sortMode = document.getElementById('paper-sort').value;

  let papers = allPapers;
  if (keyword) {
    papers = papers.filter((p) => {
      const haystack = (p.title + ' ' + p.authors + ' ' + p.journal).toLowerCase();
      return haystack.includes(keyword);
    });
  }

  papers = [...papers].sort((a, b) => {
    const cmp = (a.pubdate || '').localeCompare(b.pubdate || '');
    return sortMode === 'date-asc' ? cmp : -cmp;
  });

  if (papers.length === 0) {
    listEl.innerHTML = '<li class="empty-state">該当する論文が見つかりません。</li>';
    return;
  }

  listEl.innerHTML = papers
    .map(
      (p) => `
    <li class="card">
      <span class="card-date">${escapeHtml(formatDate(p.pubdate))}</span>
      <h3><a href="${escapeHtml(p.link)}" target="_blank" rel="noopener">${escapeHtml(p.title)}</a></h3>
      <p class="card-sub">${escapeHtml(p.authors)}${p.journal ? ' ・ ' + escapeHtml(p.journal) : ''}</p>
    </li>
  `
    )
    .join('');
}

document.getElementById('paper-search').addEventListener('input', renderPapers);
document.getElementById('paper-sort').addEventListener('change', renderPapers);

// ---- イベントタブ ----
async function loadEvents() {
  const metaEl = document.getElementById('events-meta');
  const listEl = document.getElementById('event-list');
  try {
    const res = await fetch('data/events.json');
    const data = await res.json();
    const events = (data.events || []).slice().sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''));
    metaEl.textContent = '最終更新: ' + data.updatedAt;

    if (events.length === 0) {
      listEl.innerHTML = '<li class="empty-state">イベント情報がありません。</li>';
      return;
    }

    listEl.innerHTML = events
      .map(
        (e) => `
      <li class="card">
        <span class="card-date">${escapeHtml(e.dateLabel)}</span>
        <h3><a href="${escapeHtml(e.url)}" target="_blank" rel="noopener">${escapeHtml(e.title)}</a></h3>
        <p class="card-sub">${escapeHtml(e.location)} ・ 主催: ${escapeHtml(e.organizer)}</p>
        <p>${escapeHtml(e.description)}</p>
      </li>
    `
      )
      .join('');
  } catch (err) {
    metaEl.textContent = 'イベントデータの読み込みに失敗しました。';
    listEl.innerHTML = '<li class="empty-state">data/events.json を確認してください。</li>';
  }
}

// ---- 企業情報タブ ----
async function loadNews() {
  const metaEl = document.getElementById('news-meta');
  const listEl = document.getElementById('news-list');
  try {
    const res = await fetch('data/news.json');
    const data = await res.json();
    metaEl.textContent = '最終更新: ' + data.updatedAt;

    const companies = data.companies || [];
    if (companies.length === 0) {
      listEl.innerHTML = '<p class="empty-state">企業情報がありません。</p>';
      return;
    }

    listEl.innerHTML = companies
      .map(
        (c) => `
      <div class="company-block">
        <h2><a href="${escapeHtml(c.url)}" target="_blank" rel="noopener">${escapeHtml(c.name)}</a></h2>
        <p class="company-desc">${escapeHtml(c.description)}</p>
        <ul class="card-list">
          ${(c.items || [])
            .map(
              (item) => `
            <li class="card">
              <span class="card-date">${escapeHtml(item.date)}</span>
              <h3><a href="${escapeHtml(item.url)}" target="_blank" rel="noopener">${escapeHtml(item.title)}</a></h3>
              <p>${escapeHtml(item.summary)}</p>
            </li>
          `
            )
            .join('')}
        </ul>
      </div>
    `
      )
      .join('');
  } catch (err) {
    metaEl.textContent = '企業情報の読み込みに失敗しました。';
    listEl.innerHTML = '<p class="empty-state">data/news.json を確認してください。</p>';
  }
}

// ---- 新着候補アラート(自動検知・要確認) ----
async function loadAlerts() {
  try {
    const res = await fetch('data/new-content-alerts.json');
    const data = await res.json();
    const alerts = data.alerts || [];

    renderAlerts(document.getElementById('events-alerts'), alerts.filter((a) => a.type === 'event'), '未確認のイベント候補');
    renderAlerts(document.getElementById('news-alerts'), alerts.filter((a) => a.type === 'news'), '未確認のニュース候補');
  } catch (err) {
    // アラートファイルが無い/読めない場合は何も表示しない
  }
}

function renderAlerts(container, items, label) {
  if (!container || items.length === 0) return;
  container.innerHTML = `
    <details class="alert-box">
      <summary>${escapeHtml(label)}(自動検知・${items.length}件、内容未確認)</summary>
      <ul class="alert-list">
        ${items
          .map(
            (a) => `
          <li>[${escapeHtml(a.source)}] <a href="${escapeHtml(a.url)}" target="_blank" rel="noopener">${escapeHtml(a.url)}</a>(検知日: ${escapeHtml(a.discoveredAt)})</li>
        `
          )
          .join('')}
      </ul>
    </details>
  `;
}

loadPapers();
loadEvents();
loadNews();
loadAlerts();
