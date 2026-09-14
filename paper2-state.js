export const APP = 'dse-maths-paper2';
export const KEY = 'dse-maths-paper2-progress-v1';
export const BANK = '2012-paper2-chi-v1';
export const DURATION = 75 * 60 * 1000;
export const emptyState = () => ({app: APP, version: 1, bank: BANK, currentId: null, attempts: [], bookmarks: []});
const integer = (n, min, max) => Number.isSafeInteger(n) && n >= min && n <= max;
const object = x => x && typeof x === 'object' && !Array.isArray(x);
const requireValid = condition => { if (!condition) throw new Error('備份格式不符或資料損壞；沒有匯入任何資料。'); };
const validIds = ids => Array.isArray(ids) && ids.length > 0 && ids.length <= 45 &&
  new Set(ids).size === ids.length && ids.every(n => integer(n, 1, 45));

export function validateState(input, questions) {
  requireValid(object(input) && input.app === APP && input.version === 1 && input.bank === BANK);
  requireValid(Array.isArray(input.attempts) && input.attempts.length <= 10000);
  requireValid(Array.isArray(input.bookmarks) && input.bookmarks.length <= 45 &&
    new Set(input.bookmarks).size === input.bookmarks.length && input.bookmarks.every(n => integer(n, 1, 45)));
  const attempts = input.attempts.map(a => {
    requireValid(object(a) && typeof a.id === 'string' && /^[\w-]{1,80}$/.test(a.id));
    requireValid(validIds(a.ids) && a.ids.includes(a.current));
    requireValid(['untimed', 'timed'].includes(a.mode) && ['active', 'submitted'].includes(a.status));
    requireValid(integer(a.startedAt, 1, 8640000000000000));
    requireValid(a.deadline === (a.mode === 'timed' ? a.startedAt + DURATION : null));
    requireValid(a.status === 'active' ? a.finishedAt === null :
      integer(a.finishedAt, a.startedAt, a.mode === 'timed' ? a.deadline : 8640000000000000));
    requireValid(object(a.answers) && object(a.hints));
    const answers = {}, hints = {};
    for (const [id, choice] of Object.entries(a.answers)) {
      requireValid(String(Number(id)) === id && a.ids.includes(Number(id)) && typeof choice === 'string' && /^[ABCD]$/.test(choice));
      answers[id] = choice;
    }
    for (const [id, count] of Object.entries(a.hints)) {
      requireValid(String(Number(id)) === id && a.ids.includes(Number(id)) &&
        integer(count, 0, questions.find(q => q.q === Number(id))?.hints.length ?? 0));
      hints[id] = count;
    }
    requireValid(Array.isArray(a.flags) && new Set(a.flags).size === a.flags.length &&
      a.flags.every(n => a.ids.includes(n)));
    return {id: a.id, ids: [...a.ids], current: a.current, mode: a.mode, status: a.status,
      startedAt: a.startedAt, deadline: a.deadline, finishedAt: a.finishedAt,
      answers, hints, flags: [...a.flags]};
  });
  requireValid(new Set(attempts.map(a => a.id)).size === attempts.length);
  requireValid(input.currentId === null || attempts.some(a => a.id === input.currentId));
  return {app: APP, version: 1, bank: BANK, currentId: input.currentId, attempts, bookmarks: [...input.bookmarks]};
}

export function newAttempt(ids, mode, now = Date.now(), id = crypto.randomUUID()) {
  if (!validIds(ids) || !['timed', 'untimed'].includes(mode)) throw new Error('Invalid attempt');
  return {id, ids: [...ids], mode, startedAt: now, deadline: mode === 'timed' ? now + DURATION : null,
    status: 'active', finishedAt: null, current: ids[0], answers: {}, hints: {}, flags: []};
}
export function latestInlineAttempt(state, id) {
  return state.attempts.findLast(a => a.id.startsWith('inline-') &&
    a.mode === 'untimed' && a.ids.length === 1 && a.ids[0] === id);
}
export function createInlineAttempt(state, id) {
  const attempt = newAttempt([id], 'untimed', Date.now(), `inline-${crypto.randomUUID()}`);
  state.attempts.push(attempt);
  return attempt;
}
export function submit(a, now = Date.now()) {
  if (a.status !== 'active') return false;
  a.status = 'submitted';
  a.finishedAt = Math.max(a.startedAt, Math.min(now, a.deadline ?? now));
  return true;
}
export function settle(state, now = Date.now()) {
  let changed = false;
  for (const a of state.attempts) {
    if (a.status === 'active' && a.deadline !== null && now >= a.deadline) changed = submit(a, a.deadline) || changed;
  }
  return changed;
}
export function answer(a, q, choice, now = Date.now()) {
  if (a.deadline !== null && now >= a.deadline) submit(a, a.deadline);
  if (a.status !== 'active' || !a.ids.includes(q) || !/^[ABCD]$/.test(choice)) return false;
  a.answers[q] = choice;
  return true;
}
export function grade(a, questions) {
  const rows = a.ids.map(id => {
    const q = questions.find(q => q.q === id);
    const verified = q?.verified === true && /^[ABCD]$/.test(q.choice);
    const choice = a.answers[id] ?? null;
    return {id, choice, expected: verified ? q.choice : null,
      status: !verified ? 'pending' : !choice ? 'blank' : choice === q.choice ? 'correct' : 'wrong'};
  });
  return {rows, correct: rows.filter(r => r.status === 'correct').length,
    gradable: rows.filter(r => r.status !== 'pending').length,
    pending: rows.filter(r => r.status === 'pending').length,
    retry: rows.filter(r => ['wrong', 'blank'].includes(r.status)).map(r => r.id)};
}
export function matching(questions, source, mode = 'any', section = 'all') {
  return questions.filter(q => q.q !== source.q && (section === 'all' || q.section === section))
    .map(q => ({...q, shared: q.concepts.filter(c => source.concepts.includes(c)).length}))
    .filter(q => mode === 'exact' ? q.shared === source.concepts.length && q.concepts.length === source.concepts.length :
      mode === 'all' ? q.shared === source.concepts.length : q.shared > 0)
    .sort((a, b) => b.shared - a.shared || a.q - b.q);
}
