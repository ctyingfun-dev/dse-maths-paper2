import {KEY, LEGACY_KEY, emptyState, validateState, decodeBackup, newAttempt, answer, submit, settle, grade, matching, latestInlineAttempt, createInlineAttempt, questionId, questionYear, questionNumber} from './paper2-all-state.js';
import {techniques} from './techniques.js';
import {programsPage} from './programs.js';

const main = document.querySelector('main');
const dialog = document.querySelector('dialog');
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
const icon = name => `<i data-lucide="${name}" aria-hidden="true"></i>`;
const button = (action, label, glyph, extra = '', primary = false) =>
  `<button type="button" class="${primary ? 'primary' : 'secondary'}" data-action="${action}" ${extra}>${icon(glyph)}${label}</button>`;
const tool = (action, label, glyph, extra = '') =>
  `<button type="button" class="p2-icon" data-action="${action}" title="${label}" aria-label="${label}" ${extra}>${icon(glyph)}</button>`;
const numbers = Array.from({length:45},(_,i) => i+1);
const bank = await (async () => {
  try {
    const response = await fetch('paper2-all-data.json');
    if (!response.ok) throw new Error('Question bank unavailable');
    return await response.json();
  } catch (error) {
    main.innerHTML = '<h1>題庫未能載入</h1><p>請檢查網絡連線後重新整理。現有進度沒有被修改。</p>';
    throw error;
  }
})();
const questions = bank.questions;
const byId = new Map(questions.map(q => [q.id,q]));
const years = bank.papers.map(p => p.year);
const paperIds = year => questions.filter(q => q.year === year).map(q => q.id);
const fullPaper = ids => ids.length === 45 && ids.every(id => questionYear(id) === questionYear(ids[0]));
const label = id => `${questionYear(id)} · 第 ${questionNumber(id)} 題`;
const yearOptions = (selected, all=false) => `${all ? '<option value="all">全部年份</option>' : ''}${[...years].reverse().map(year => `<option value="${year}" ${Number(selected) === year ? 'selected' : ''}>${year}</option>`).join('')}`;
let state = emptyState(), blockedRaw = null, storageError = '', pendingAction = null, migrated = false;
let paperYear = 2012, topicYear = 'all', shownResults = 12;
function searchFromHash() {
  const params = new URLSearchParams(location.hash.split('?')[1] ?? '');
  const q = Number(params.get('q'));
  return {q: numbers.includes(q) ? q : 1,
    year: years.includes(Number(params.get('year'))) ? Number(params.get('year')) : 2012,
    resultYear: years.includes(Number(params.get('resultYear'))) ? params.get('resultYear') : 'all',
    mode: ['any', 'all', 'exact'].includes(params.get('mode')) ? params.get('mode') : 'any',
    section: ['all', 'A', 'B'].includes(params.get('section')) ? params.get('section') : 'all'};
}
let search = searchFromHash();
let methodIndex = 0;
let topic = '';
try {
  const modern = localStorage.getItem(KEY);
  const raw = modern ?? localStorage.getItem(LEGACY_KEY);
  if (raw) {
    try { state = decodeBackup(JSON.parse(raw), questions); migrated = modern === null; }
    catch { blockedRaw = raw; }
  }
} catch { storageError = '瀏覽器無法讀取進度；請匯出備份，避免關閉後遺失。'; }
const current = () => state.attempts.find(a => a.id === state.currentId);
if (current()) paperYear = questionYear(current().ids[0]);
const route = () => location.hash.slice(1).split('?')[0] || 'papers';
function toast(message) {
  const el = document.querySelector('#toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toast.timeout);
  toast.timeout = setTimeout(() => el.classList.remove('show'), 3500);
}
function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    storageError = '';
    document.querySelector('#save-status').textContent = 'Paper 2 · 已儲存';
  } catch {
    storageError = '進度尚未寫入瀏覽器。請立即匯出備份。';
    document.querySelector('#save-status').textContent = '儲存失敗';
  }
}
function persist() { save(); render(); }
function download(value, filename) {
  const url = URL.createObjectURL(new Blob([typeof value === 'string' ? value : JSON.stringify(value, null, 2)], {type: 'application/json'}));
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function exportBackup() {
  download(blockedRaw ?? state, `dse-paper2-progress-${new Date().toISOString().slice(0, 10)}.json`);
}
function modal(title, content, label, action) {
  pendingAction = action;
  dialog.className = 'p2-modal';
  dialog.innerHTML = `<div class="p2-dialog-head"><h2 id="paper-title">${esc(title)}</h2>${tool('close', '關閉', 'x')}</div>
    <div class="p2-dialog-content">${content}</div><div class="p2-dialog-actions">
    ${button('close', '取消', 'x')}${button('confirm', label, 'check', '', true)}</div>`;
  dialog.showModal();
  window.lucide?.createIcons();
}
function start(ids = paperIds(paperYear)) {
  const paper = bank.papers.find(p => p.year === questionYear(ids[0]));
  modal(fullPaper(ids) ? `開始 ${paper.year} 卷二` : `開始 ${ids.length} 題操練`,
    `<fieldset class="p2-mode"><legend>操練模式</legend>
    <label><input type="radio" name="mode" value="untimed" checked>不限時</label>
    <label><input type="radio" name="mode" value="timed">計時 · 75 分鐘</label></fieldset>
    <p>計時限時 75 分鐘；切換頁面或關閉後仍會計時，到時自動提交。</p>
    ${!paper.durationVerified ? `<p>${esc(paper.durationNote)}</p>` : ''}
    ${!fullPaper(ids) ? '<p>這次是選題操練，成績不當作整卷成績。</p>' : ''}
    ${state.attempts.some(a => a.status === 'active') ? '<p>現有操練會保留，計時中的操練不會暫停。</p>' : ''}`,
    '開始作答', () => {
      const mode = dialog.querySelector('input[name="mode"]:checked').value;
      const a = newAttempt(ids, mode);
      state.attempts.push(a); state.currentId = a.id;
      paperYear = questionYear(ids[0]);
      save(); location.hash = 'papers'; render();
    });
}
function clockText(a) {
  if (!a) return '75 分鐘 / 不限時';
  const end = a.finishedAt ?? Date.now();
  const seconds = Math.max(0, Math.floor((a.deadline === null ? end - a.startedAt : a.deadline - end) / 1000));
  return `${a.deadline === null ? '用時' : '剩餘'} ${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}
const tags = q => `<div class="tags">${q.concepts.map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div>`;
const head = (title, extra = '') => `<div class="page-head"><div><p class="eyebrow">DSE 數學研習室 · PAPER 2</p><h1>${title}</h1></div>${extra}</div>`;
const rowStatus = {correct: '答對', wrong: '答錯', blank: '未作答', pending: '待核對'};
function exam() {
  const a = current();
  const id = a?.current ?? questionId(paperYear,1);
  const q = byId.get(id);
  const ids = a?.ids ?? paperIds(paperYear);
  const done = a?.status === 'submitted';
  const result = done ? grade(a, questions) : null;
  const row = result?.rows.find(r => r.id === id);
  const answered = a ? Object.keys(a.answers).length : 0;
  const count = done ? q.hints.length : a?.hints[id] ?? 0;
  return `${head(`${fullPaper(ids) ? questionYear(ids[0]) : '選題操練'} 數學卷二`, `<div class="p2-actions"><label class="field">年份<select id="p2-paper-year">${yearOptions(paperYear)}</select></label>${button('start', a ? '新一輪操練' : '開始操練', 'play', '', true)}</div>`)}
    <div class="p2-notice">${bank.papers.find(p => p.year === paperYear).verified} 題可計分 · ${bank.papers.find(p => p.year === paperYear).pending} 題待核對</div>
    ${!a ? '<div class="p2-notice">甲部 30 題 · 乙部 15 題 · 每題只選一個答案</div>' : ''}
    ${result ? `<section class="p2-result" aria-label="批改結果">
      <div><span class="eyebrow">${fullPaper(ids) ? '整卷' : '選題'}成績</span><h2>${result.gradable ? `答對 ${result.correct} / ${result.gradable}` : '全部待核對'}</h2></div>
      <div><b>${result.gradable ? Math.round(100 * result.correct / result.gradable)+'%' : '—'}</b><span>正確率</span></div>
      <div><b>${result.retry.length}</b><span>答錯或未作答</span></div>
      <div><b>${Object.keys(a.hints).filter(k => a.hints[k] > 0).length}</b><span>曾用提示</span></div>
      ${result.pending ? `<p>${result.pending} 題待核對，未計入分數。</p>` : ''}
      ${button('retry', '錯題重做', 'rotate-ccw', result.retry.length ? '' : 'disabled')}
    </section>` : ''}
    <div class="p2-exam">
    <aside class="p2-palette">
      <details ${window.matchMedia('(min-width: 901px)').matches ? 'open' : ''}><summary>答題表 <span>${answered} / ${ids.length}</span></summary>
      <div class="p2-key">● 已選答　旗標：稍後檢查</div>
      ${['A', 'B'].map(section => `<h3>${section === 'A' ? '甲部' : '乙部'}</h3><div class="p2-numbers">${ids.filter(n => byId.get(n).section === section).map(n => {
        const s = result?.rows.find(r => r.id === n)?.status;
        const flag = a?.flags.includes(n);
        const selected = a?.answers[n];
        return `<button type="button" data-action="jump" data-q="${n}" title="${label(n)}" class="${n === id ? 'current ' : ''}${s ?? (selected ? 'answered' : '')}" aria-label="${label(n)}${s ? '，' + rowStatus[s] : selected ? '，已選 ' + selected : '，未作答'}${flag ? '，已標記' : ''}" ${n === id ? 'aria-current="step"' : ''}>
          ${fullPaper(ids) ? questionNumber(n) : `<small>${questionYear(n)}</small>${questionNumber(n)}`}${flag ? '<span class="p2-flag-dot">⚑</span>' : ''}</button>`;
      }).join('')}</div>`).join('')}
      </details>
      ${a && !done ? button('submit', '提交批改', 'check-check', '', true) : ''}
    </aside>
    <section class="p2-question" aria-labelledby="question-title">
      <div class="p2-question-head"><div><span class="eyebrow">${q.section === 'A' ? '甲部' : '乙部'} · 第 ${ids.indexOf(id) + 1} / ${ids.length} 題</span>
      <h2 id="question-title">${label(id)}</h2></div><div class="p2-tools">
      <span id="p2-clock" class="p2-clock">${clockText(a)}</span>
      ${tool('bookmark', state.bookmarks.includes(id) ? '取消收藏' : '收藏題目', 'bookmark', `aria-pressed="${state.bookmarks.includes(id)}"`)}
      ${tool('flag', '稍後檢查', 'flag', `aria-pressed="${a?.flags.includes(id) ?? false}" ${!a || done ? 'disabled' : ''}`)}</div></div>
      <div class="p2-image-tools"><span>原卷第 ${q.page} 頁</span>${tool('zoom', '放大原題', 'zoom-in')}${tool('original', '查看完整原頁', 'file-search')}</div>
      <div class="p2-scan"><img src="${q.image}" width="${q.width}" height="${q.height}" style="max-width:${q.width}px" alt="${label(id)}原題及 A 至 D 選項；${esc(q.summary)}"></div>
      ${!q.verified ? `<p class="p2-warning">${esc(q.verification)}</p>` : ''}
      <fieldset class="p2-choices" ${!a || done ? 'disabled' : ''}><legend>你的答案${row ? ` · ${rowStatus[row.status]}` : ''}</legend>
      ${['A', 'B', 'C', 'D'].map(choice => `<label class="${done && row.expected === choice ? 'correct-choice' : ''}">
      <input type="radio" name="answer" value="${choice}" ${a?.answers[id] === choice ? 'checked' : ''}>
      <span>${choice}</span>${done && row.expected === choice ? '<small>正確</small>' : ''}</label>`).join('')}</fieldset>
      <div class="p2-navigation">
      ${tool('prev', '上一題', 'arrow-left', ids.indexOf(id) === 0 ? 'disabled' : '')}
      ${tool('clear', '清除這題答案', 'eraser', !a || done || !a.answers[id] ? 'disabled' : '')}
      ${button('skip', '跳至未答', 'skip-forward', !a || done ? 'disabled' : '')}
      ${tool('next', '下一題', 'arrow-right', ids.indexOf(id) === ids.length - 1 ? 'disabled' : '')}
      </div>
      ${done ? `<div class="p2-solution"><h3>${q.verified ? `答案 ${q.choice} · ${esc(q.answer)}` : '答案待核對'}</h3>
      ${q.verified ? `<p>${esc(q.working)}</p>` : `<p>${esc(q.verification)}</p><details><summary>計算覆核參考（非確認答案）</summary><p>${esc(q.working)}</p></details>`}</div>` : ''}
      <section class="p2-hints"><div class="section-heading"><h3>${icon('lightbulb')} 逐步提示</h3>
      <span class="hint">${count} / ${q.hints.length}</span></div>
      <ol>${q.hints.slice(0, count).map(h => `<li>${esc(h)}</li>`).join('')}</ol>
      ${button('hint', count ? '再看一步' : '看第一步', 'lightbulb', !a || count >= q.hints.length ? 'disabled' : '')}
      </section>
      ${tags(q)}
      <details class="p2-source"><summary>${q.verified ? '已交叉核對' : '待核對'} · 答案來源</summary>
      <p>原題：使用者提供的 ${q.year} 年中文卷二。</p>
      <p>${esc(q.verification)}</p><p>${esc(q.correction)}</p>
      <div class="p2-actions"><a href="paper2-${q.year}/original.pdf#page=${q.page}" target="_blank" rel="noopener">原卷 PDF</a>
      <a href="${esc(q.source)}" target="_blank" rel="noopener">公開答案來源</a>
      <a href="all-source-manifest.json" target="_blank" rel="noopener">核對紀錄</a></div></details>
    </section></div>
    ${result ? `<details class="p2-answer-list"><summary>全次作答紀錄</summary><div class="p2-table-wrap"><table><thead><tr><th>題號</th><th>你的答案</th><th>核對答案</th><th>結果</th></tr></thead><tbody>
    ${result.rows.map(r => `<tr><td><button class="p2-link" data-action="jump" data-q="${r.id}">${label(r.id)}</button></td><td>${r.choice ?? '未作答'}</td><td>${r.expected ?? '待核對'}</td><td>${rowStatus[r.status]}</td></tr>`).join('')}
    </tbody></table></div></details>` : ''}`;
}
function cards(pool) {
  return pool.length ? `<div class="result-grid">${pool.map(q => `<article class="question-card">
    <div class="card-top"><h3>${label(q.id)}</h3><span class="section-tag">${q.section === 'A' ? '甲部' : '乙部'}</span></div>
    <p class="q-summary">${esc(q.summary)}</p>${tags(q)}
    <div class="p2-actions">${button('practice-one', '操練這題', 'pencil', `data-q="${q.id}"`)}
    ${tool('save-card', state.bookmarks.includes(q.id) ? '取消收藏' : '收藏題目', 'bookmark', `data-q="${q.id}" aria-pressed="${state.bookmarks.includes(q.id)}"`)}</div>
    </article>`).join('')}</div>` : '<p class="p2-empty">沒有符合的題目。試試其他題號或放寬概念條件。</p>';
}
function inlineCard(q) {
  const a = latestInlineAttempt(state, q.id);
  const done = a?.status === 'submitted';
  const row = done ? grade(a, questions).rows[0] : null;
  const count = done ? q.hints.length : a?.hints[q.id] ?? 0;
  const attr = `data-q="${q.id}"`;
  return `<article class="question-card p2-inline" id="inline-q-${q.id}" aria-labelledby="inline-title-${q.id}">
    <div class="card-top"><div><span class="eyebrow">${q.section === 'A' ? '甲部' : '乙部'} · 不限時</span>
    <h3 id="inline-title-${q.id}">${label(q.id)}</h3></div>
    <div class="p2-tools">${tool('zoom', '放大原題', 'zoom-in', attr)}
    ${tool('original', '查看完整原頁', 'file-search', attr)}
    ${tool('save-card', state.bookmarks.includes(q.id) ? '取消收藏' : '收藏題目', 'bookmark', `${attr} aria-pressed="${state.bookmarks.includes(q.id)}"`)}</div></div>
    <p class="q-summary">${esc(q.summary)}</p>${tags(q)}
    <div class="p2-inline-body"><div class="p2-scan"><img loading="lazy" src="${q.image}" width="${q.width}" height="${q.height}"
    style="max-width:${q.width}px" alt="${label(q.id)}原題及 A 至 D 選項；${esc(q.summary)}"></div>
    <div class="p2-inline-work">
    ${!q.verified ? `<p class="p2-warning">${esc(q.verification)}</p>` : ''}
    <fieldset class="p2-choices" ${done ? 'disabled' : ''}><legend>${label(q.id)} · 你的答案</legend>
    ${['A', 'B', 'C', 'D'].map(choice => `<label class="${row?.expected === choice ? 'correct-choice' : ''}">
      <input type="radio" name="inline-answer-${q.id}" ${attr} value="${choice}" ${a?.answers[q.id] === choice ? 'checked' : ''}>
      <span>${choice}</span>${row?.expected === choice ? '<small>正確</small>' : ''}</label>`).join('')}</fieldset>
    <div class="p2-inline-actions">
    ${done ? button('inline-retry', '再做一次', 'rotate-ccw', attr) :
      button('inline-submit', '提交這題', 'check-check', `${attr} ${!a?.answers[q.id] ? 'disabled' : ''}`, true)}
    ${tool('inline-clear', '清除這題答案', 'eraser', `${attr} ${done || !a?.answers[q.id] ? 'disabled' : ''}`)}</div>
    ${row ? `<div class="p2-solution" role="status"><h3>${rowStatus[row.status]}${row.expected ? ` · 答案 ${row.expected}` : ''}</h3>
      ${row.expected ? `<p>${esc(q.answer)}</p><p>${esc(q.working)}</p>` : `<p>${esc(q.verification)}</p><details><summary>計算覆核參考（非確認答案）</summary><p>${esc(q.working)}</p></details>`}</div>` : ''}
    <section class="p2-hints" aria-label="${label(q.id)}逐步提示"><div class="section-heading"><h3>${icon('lightbulb')} 逐步提示</h3>
    <span class="hint">${count} / ${q.hints.length}</span></div>
    <ol>${q.hints.slice(0, count).map(h => `<li>${esc(h)}</li>`).join('')}</ol>
    ${!done ? button('inline-hint', count ? '再看一步' : '看第一步', 'lightbulb', `${attr} ${count >= q.hints.length ? 'disabled' : ''}`) : ''}
    </section>
    <details class="p2-source"><summary>${q.verified ? '已交叉核對' : '待核對'} · 答案來源</summary>
    <p>${esc(q.verification)}</p><p>${esc(q.correction)}</p>
    <div class="p2-actions"><a href="paper2-${q.year}/original.pdf#page=${q.page}" target="_blank" rel="noopener">原卷 PDF</a>
    <a href="${esc(q.source)}" target="_blank" rel="noopener">公開答案來源</a></div></details>
    </div></div></article>`;
}
function refreshInline(q, focusSelector) {
  save();
  const card = document.querySelector(`#inline-q-${q.id}`);
  if (!card || storageError) render();
  else {
    card.outerHTML = inlineCard(q);
    document.querySelector('#saved-count').textContent = state.bookmarks.length;
    window.lucide?.createIcons();
  }
  if (focusSelector) document.querySelector(`#inline-q-${q.id} ${focusSelector}`)?.focus({preventScroll:true});
}
function findPage() {
  const source = byId.get(questionId(search.year,search.q));
  const pool = matching(questions, source, search.mode, search.section, search.resultYear);
  return `${head('同類題搜尋')}<form id="p2-search" class="p2-search">
    <label class="field">搜尋年份<select name="year">${yearOptions(search.year)}</select></label>
    <label class="field">題號<select name="q">${numbers.map(n => `<option value="${n}" ${n === search.q ? 'selected' : ''}>第 ${n} 題</option>`).join('')}</select></label>
    <label class="field">概念條件<select name="mode">${[['any','至少一個相同'],['all','包含所有概念'],['exact','概念完全相同']].map(([v,t]) => `<option value="${v}" ${v === search.mode ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
    <label class="field">部分<select name="section">${[['all','全部'],['A','甲部'],['B','乙部']].map(([v,t]) => `<option value="${v}" ${v === search.section ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
    <label class="field">同類題年份<select name="resultYear">${yearOptions(search.resultYear,true)}</select></label>
    <button class="primary" type="submit">${icon('search')}搜尋</button></form>
    <section class="p2-search-source" aria-labelledby="search-source-title">
    <div class="section-heading"><h2 id="search-source-title">你搜尋的題目</h2></div>
    ${inlineCard(source)}</section>
    <div class="section-heading"><h2>同類題 <span class="count">${pool.length} 題</span></h2></div>
    ${pool.length ? `<div class="p2-inline-results">${pool.slice(0,shownResults).map(inlineCard).join('')}</div>
      ${pool.length>shownResults ? button('more-results', `再顯示 ${Math.min(12,pool.length-shownResults)} 題（尚餘 ${pool.length-shownResults} 題）`, 'chevron-down') : ''}` :
      '<p class="p2-empty">沒有符合的題目。試試其他題號或放寬概念條件。</p>'}`;
}
function topicsPage() {
  const topics = [...new Set(questions.flatMap(q => q.concepts))].sort((a,b) => a.localeCompare(b, 'zh-Hant'));
  const pool = questions.filter(q => (!topic || q.concepts.includes(topic)) && (topicYear==='all' || q.year===Number(topicYear)));
  return `${head('課題分佈')}<div class="p2-actions"><label class="field">年份<select id="p2-topic-year">${yearOptions(topicYear,true)}</select></label>
    <label class="field p2-topic-select">課題<select id="p2-topic"><option value="">全部 · 675 題</option>
    ${topics.map(t => `<option ${topic === t ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label></div>
    <div class="section-heading"><h2>${esc(topic || '全部課題')} <span class="count">${pool.length} 題</span></h2>
    ${button('practice-topic', '操練這組', 'play')}</div>${cards(pool)}`;
}
const teacherMethods = [
  {topic:'百分變化', title:'先寫倍數，再處理變化', recognize:'題目有增加、減少、折扣或連續變化。',
    steps:['先寫（1 ± 百分率）。','增加用（1 + 百分率）。','減少用（1 − 百分率）。','把新值寫成「原值 × 這個倍數」。','有第二次變化，再乘第二個倍數。'],
    mistake:'連續增加和減少，不能直接把百分率相減。', example:'先加 20%，再減 10%：原值 ×（1 + 20%）×（1 − 10%）= 原值 × 1.08。'},
  {topic:'相似形', title:'邊長比、面積比、體積比', recognize:'先確認兩個圖形或立體相似。',
    steps:['先固定比較方向，例如「小圖 ÷ 大圖」。','寫出對應邊長比 r。','求面積比時，計算 r²。','求體積比時，計算 r³。','把所求面積或體積乘上對應比例。'],
    mistake:'不能把邊長比直接當成面積比或體積比。', example:'邊長比 2:3，面積比為 2²:3² = 4:9，體積比為 2³:3³ = 8:27。'}
];
const methods = [...teacherMethods, ...techniques];
function guidePage() {
  const t = methods[methodIndex] ?? methods[0];
  return `${head('技巧站')}<label class="field p2-method-select">題型方法<select id="p2-method">${methods.map((t,i) =>
    `<option value="${i}" ${methodIndex === i ? 'selected' : ''}>${esc(t.topic)} · ${esc(t.title)}</option>`).join('')}</select></label>
    <article class="p2-method"><h2>${esc(t.title)}</h2><p>${esc(t.recognize)}</p>
    <ol>${t.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>
    <h3>小例子</h3><p>${esc(t.example)}</p><h3>容易出錯的地方</h3><p>${esc(t.mistake)}</p></article>`;
}
function savedPage() {
  return `${head('我的操練')}<div class="p2-backup">
    ${button('export', '匯出 Paper 2 備份', 'download')}
    <label class="secondary p2-import">${icon('upload')}匯入 Paper 2 備份<input type="file" id="p2-import" accept=".json,application/json"></label></div>
    <h2>操練紀錄</h2><div class="p2-history">${[...state.attempts].reverse().map(a => {
      const result = a.status === 'submitted' ? grade(a, questions) : null;
      return `<article><div><h3>${a.id.startsWith('inline-') ? `同類題 · ${label(a.ids[0])}` : fullPaper(a.ids) ? `${questionYear(a.ids[0])} 整卷` : `${a.ids.length} 題選題操練`} · ${a.mode === 'timed' ? '計時' : '不限時'}</h3>
      <p>${new Date(a.startedAt).toLocaleString('zh-HK')} · ${result ? `答對 ${result.correct}/${result.gradable}` : `作答中 ${Object.keys(a.answers).length}/${a.ids.length}`}</p></div>
      ${button('resume', result ? '查看批改' : '繼續', result ? 'list-checks' : 'play', `data-id="${esc(a.id)}"`)}</article>`;
    }).join('') || '<p class="p2-empty">還沒有操練紀錄。</p>'}</div>
    <div class="section-heading"><h2>收藏題目 <span class="count">${state.bookmarks.length} 題</span></h2>
    ${button('practice-saved', '操練收藏', 'play', state.bookmarks.length ? '' : 'disabled')}</div>
    ${state.bookmarks.length ? cards(questions.filter(q => state.bookmarks.includes(q.id))) : '<p class="p2-empty">還沒有收藏題目。</p>'}`;
}
function render() {
  if (blockedRaw !== null) {
    main.innerHTML = `${head('進度資料需要檢查')}<p>本機 Paper 2 資料未通過檢查，已停止寫入。原資料仍保留。</p>
      <div class="p2-actions">${button('export', '匯出原始資料', 'download')}${button('reset-broken', '建立空白進度', 'rotate-ccw')}</div>`;
    window.lucide?.createIcons(); return;
  }
  const views = {papers: exam, find: findPage, topics: topicsPage, guide: guidePage, programs: programsPage, saved: savedPage};
  main.innerHTML = `${storageError ? `<div class="p2-warning" role="alert">${esc(storageError)}${button('export', '匯出備份', 'download')}</div>` : ''}${(views[route()] ?? exam)()}`;
  document.querySelectorAll('nav [data-route]').forEach(a => {
    const active = a.dataset.route === route();
    a.classList.toggle('active', active);
    if (active) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  document.querySelector('#saved-count').textContent = state.bookmarks.length;
  window.lucide?.createIcons();
}
function jump(id) {
  const a = current();
  if (!a) { start(); return; }
  if (!a.ids.includes(id)) return;
  a.current = id; persist();
  document.querySelector('#question-title')?.scrollIntoView({block: 'start'});
}
function checkTime() {
  if (blockedRaw !== null) return;
  if (settle(state)) {
    if (dialog.open) dialog.close();
    save(); render(); toast('時間已到，計時操練已提交。');
  }
  const clock = document.querySelector('#p2-clock');
  if (clock) clock.textContent = clockText(current());
}
document.addEventListener('click', event => {
  const el = event.target.closest('[data-action]');
  if (!el || el.disabled) return;
  const actionName = el.dataset.action;
  if (actionName === 'close') { dialog.close(); pendingAction = null; return; }
  if (actionName === 'confirm') {
    const action = pendingAction; pendingAction = null;
    action?.(); dialog.close(); return;
  }
  if (actionName === 'export') { exportBackup(); return; }
  if (actionName === 'reset-broken') {
    modal('建立空白進度', '<p>這會取代損壞的 Paper 2 本機資料。請先匯出原始資料；Paper 1 不會受影響。</p>', '確認建立', () => {
      state = emptyState(); blockedRaw = null; persist();
    }); return;
  }
  if (blockedRaw !== null) return;
  checkTime();
  const a = current(), id = el.dataset.q ? Number(el.dataset.q) : a?.current ?? questionId(paperYear,1);
  const q = byId.get(id);
  if (actionName.startsWith('inline-')) {
    if (!q) return;
    let inline = latestInlineAttempt(state, id);
    if (actionName === 'inline-retry') {
      if (inline?.status !== 'submitted') return;
      createInlineAttempt(state, id);
    } else {
      if (inline?.status === 'submitted') return;
      if (actionName === 'inline-submit') {
        if (!inline?.answers[id]) return;
        submit(inline);
      } else if (actionName === 'inline-clear') {
        if (!inline) return;
        delete inline.answers[id];
      } else if (actionName === 'inline-hint') {
        inline ??= createInlineAttempt(state, id);
        inline.hints[id] = Math.min((inline.hints[id] ?? 0) + 1, q.hints.length);
      } else return;
    }
    refreshInline(q, actionName === 'inline-submit' ? '[data-action="inline-retry"]' :
      actionName === 'inline-retry' || actionName === 'inline-clear' ? 'input[type="radio"]' : '[data-action="inline-hint"]');
    return;
  }
  switch (actionName) {
    case 'start': start(); break;
    case 'more-results': {
      const previous = shownResults;
      shownResults += 12; render();
      document.querySelectorAll('.p2-inline-results .p2-inline')[previous]?.scrollIntoView({block:'start'});
      break;
    }
    case 'practice-one': start([Number(el.dataset.q)]); break;
    case 'practice-topic': start(questions.filter(q => (!topic || q.concepts.includes(topic)) && (topicYear==='all' || q.year===Number(topicYear))).map(q => q.id)); break;
    case 'practice-saved': start([...state.bookmarks]); break;
    case 'resume': state.currentId = el.dataset.id; paperYear=questionYear(current().ids[0]); save(); location.hash = 'papers'; render(); break;
    case 'jump': jump(Number(el.dataset.q)); break;
    case 'prev': if (a) jump(a.ids[a.ids.indexOf(id) - 1]); break;
    case 'next': if (a) jump(a.ids[a.ids.indexOf(id) + 1]); else start(); break;
    case 'skip': {
      if (!a || a.status !== 'active') break;
      const at = a.ids.indexOf(id);
      const next = [...a.ids.slice(at + 1), ...a.ids.slice(0, at)].find(n => !a.answers[n]);
      if (next) jump(next); else toast('其餘題目都已作答。');
      break;
    }
    case 'clear': if (a?.status === 'active') { delete a.answers[id]; persist(); } break;
    case 'bookmark':
    case 'save-card': {
      const number = actionName === 'bookmark' ? id : Number(el.dataset.q);
      state.bookmarks = state.bookmarks.includes(number) ? state.bookmarks.filter(n => n !== number) : [...state.bookmarks, number];
      if (actionName === 'save-card' && route() === 'find' && q) refreshInline(q, '[data-action="save-card"]');
      else persist();
      break;
    }
    case 'flag': if (a?.status === 'active') { a.flags = a.flags.includes(id) ? a.flags.filter(n => n !== id) : [...a.flags, id]; persist(); } break;
    case 'hint': if (a?.status === 'active') {
      a.hints[id] = Math.min((a.hints[id] ?? 0) + 1, q.hints.length); persist();
      document.querySelector('.p2-hints li:last-child')?.scrollIntoView({block:'nearest'});
    } break;
    case 'submit': if (a?.status === 'active') {
      const blank = a.ids.length - Object.keys(a.answers).length;
      modal('提交批改', `<p>${blank ? `還有 ${blank} 題未作答。` : '全部題目已選答。'}提交後不能修改這次答案。</p>`, '確認提交', () => {
        submit(a); persist();
      });
    } break;
    case 'retry': if (a?.status === 'submitted') { const ids = grade(a, questions).retry; if (ids.length) start(ids); } break;
    case 'zoom':
    case 'original': {
      dialog.className = 'p2-image-dialog';
      const src = actionName === 'zoom' ? q.image : q.fullImage;
      dialog.innerHTML = `<div class="p2-dialog-head"><h2 id="paper-title">${label(id)} · ${actionName === 'zoom' ? '原題' : '完整原頁'}</h2>
        ${tool('close', '關閉', 'x')}</div><div class="p2-zoom-controls">${tool('zoom-minus', '縮小', 'zoom-out')}
        <output id="zoom-level">100%</output>${tool('zoom-plus', '放大', 'zoom-in')}</div>
        <div class="p2-zoom-scroll"><img id="zoom-image" src="${src}" alt="${label(id)}原卷圖片"></div>`;
      dialog.showModal(); window.lucide?.createIcons(); break;
    }
    case 'zoom-plus':
    case 'zoom-minus': {
      const image = dialog.querySelector('#zoom-image');
      if (!image) break;
      const zoom = Math.max(50, Math.min(250, Number(image.dataset.zoom ?? 100) + (actionName === 'zoom-plus' ? 25 : -25)));
      image.dataset.zoom = zoom; image.style.width = `${875 * zoom / 100}px`;
      dialog.querySelector('#zoom-level').textContent = `${zoom}%`; break;
    }
  }
});
document.addEventListener('change', async event => {
  const el = event.target;
  if (el.name?.startsWith('inline-answer-')) {
    if (blockedRaw !== null) return;
    const q = byId.get(Number(el.dataset.q));
    if (!q) return;
    const a = latestInlineAttempt(state, q.id) ?? createInlineAttempt(state, q.id);
    answer(a, q.id, el.value);
    refreshInline(q, `input[value="${el.value}"]`);
    return;
  }
  if (el.name === 'answer') {
    const a = current();
    if (a) { answer(a, a.current, el.value); persist(); document.querySelector(`input[name="answer"][value="${el.value}"]`)?.focus({preventScroll:true}); }
  }
  if (el.id === 'p2-topic') { topic = el.value; render(); }
  if (el.id === 'p2-topic-year') { topicYear = el.value; render(); }
  if (el.id === 'p2-paper-year') {
    paperYear = Number(el.value);
    const previous = state.attempts.findLast(a => fullPaper(a.ids) && questionYear(a.ids[0]) === paperYear);
    state.currentId = previous?.id ?? null;
    persist();
  }
  if (el.id === 'p2-method') { methodIndex = Number(el.value); render(); }
  if (el.id === 'p2-import') {
    const file = el.files[0];
    if (!file) return;
    try {
      if (file.size > 10_000_000) throw new Error('備份檔案過大；沒有匯入任何資料。');
      const imported = decodeBackup(JSON.parse(await file.text()), questions);
      modal('匯入 Paper 2 備份', `<p>已檢查 ${imported.attempts.length} 次操練、${imported.bookmarks.length} 題收藏。</p>
        <p>確認後會取代這台裝置的 Paper 2 進度，不會合併。建議先取消並匯出現有備份。已到時的計時操練會自動提交。</p>`, '確認取代', () => {
        state = imported; if(current()) paperYear=questionYear(current().ids[0]); settle(state); persist(); toast('Paper 2 備份已匯入。');
      });
    } catch (error) { toast(error instanceof SyntaxError ? '不是有效的 JSON 備份；沒有修改進度。' : error.message); }
    el.value = '';
  }
});
document.addEventListener('submit', event => {
  if (event.target.id !== 'p2-search') return;
  event.preventDefault();
  const fields = new FormData(event.target);
  search = {year:Number(fields.get('year')),q: Number(fields.get('q')), resultYear:fields.get('resultYear'),mode: fields.get('mode'), section: fields.get('section')};
  shownResults = 12;
  history.replaceState(null, '', `#find?${new URLSearchParams(search)}`);
  render();
});
window.addEventListener('hashchange', () => {
  if (route() === 'find' && location.hash.includes('?')) search = searchFromHash();
  checkTime(); render();
});
window.addEventListener('storage', event => {
  if (event.key !== KEY) return;
  try {
    state = event.newValue ? validateState(JSON.parse(event.newValue), questions) : emptyState();
    if(current()) paperYear=questionYear(current().ids[0]);
    blockedRaw = null; checkTime(); render(); toast('已載入另一分頁的 Paper 2 進度。');
  } catch { blockedRaw = event.newValue; render(); }
});
document.addEventListener('visibilitychange', checkTime);
if (blockedRaw === null) { const expired=settle(state); if (migrated || expired) save(); }
render();
if (migrated) toast('已保留並轉換 2012 進度；舊版資料仍保留。');
setInterval(checkTime, 1000);
