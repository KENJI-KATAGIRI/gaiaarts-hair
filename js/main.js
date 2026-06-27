// ===== FAQ アコーディオン =====
document.querySelectorAll('.faq-question').forEach(btn => {
  btn.addEventListener('click', () => {
    const answer = btn.nextElementSibling;
    const isOpen = btn.classList.contains('open');
    document.querySelectorAll('.faq-question.open').forEach(b => {
      b.classList.remove('open');
      b.nextElementSibling.classList.remove('open');
    });
    if (!isOpen) { btn.classList.add('open'); answer.classList.add('open'); }
  });
});

// ===== メニュータブ =====
document.querySelectorAll('.menu-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const target = tab.dataset.tab;
    document.querySelectorAll('.menu-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.menu-panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('menu-' + target)?.classList.add('active');
  });
});

// ===== ハンバーガーメニュー =====
const hamburger = document.querySelector('.nav-hamburger');
const siteNav   = document.querySelector('.site-nav');
if (hamburger && siteNav) {
  hamburger.addEventListener('click', () => {
    siteNav.classList.toggle('open');
    hamburger.setAttribute('aria-expanded', siteNav.classList.contains('open'));
  });
}

// ===== スクロールでヘッダー切り替え =====
const header = document.querySelector('.site-header');
const syncHeader = () => header.classList.toggle('scrolled', window.scrollY > 60);
window.addEventListener('scroll', syncHeader, { passive: true });
syncHeader();

// ===== フェードインアニメーション =====
const fadeSelectors = [
  '.hero-inner', '.section-eyebrow', '.section-title', '.section-lead',
  '.concept-card', '.gallery-item', '.stylist-wrap',
  '.voice-card', '.faq-item', '.access-grid', '.bf',
];
fadeSelectors.forEach(sel => {
  document.querySelectorAll(sel).forEach((el, i) => {
    el.classList.add('fade-in');
    if (['.concept-card', '.gallery-item', '.voice-card', '.faq-item'].includes(sel)) {
      el.style.transitionDelay = `${i * 0.08}s`;
    }
  });
});
const observer = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) { entry.target.classList.add('visible'); observer.unobserve(entry.target); }
  });
}, { threshold: 0.1 });
document.querySelectorAll('.fade-in').forEach(el => observer.observe(el));

// ===== 予約フォーム =====
const BOOKING_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyl8Cuye0piLY2j-eF9aD2tQXwxac7SKZ2zT8RjBvCxBT29-GKgDyyvRm5b1O0clSYm/exec';

const menuSelect    = document.getElementById('bf-menu');
const dateHidden    = document.getElementById('bf-date');
const timeHidden    = document.getElementById('bf-time');
const durationBadge = document.getElementById('bf-duration-badge');
const timeRange     = document.getElementById('bf-time-range');
const bookingForm   = document.getElementById('bookingForm');
const submitBtn     = document.getElementById('bf-submit');
const successEl     = document.getElementById('bf-success');
const gridWrap      = document.getElementById('bf-grid-wrap');
const timeGrid      = document.getElementById('time-grid');

// ── ユーティリティ ──
function toTimeStr(totalMin) {
  return `${String(Math.floor(totalMin / 60)).padStart(2,'0')}:${String(totalMin % 60).padStart(2,'0')}`;
}
function formatDuration(min) {
  if (min < 60) return `${min}分`;
  const h = Math.floor(min / 60), m = min % 60;
  return m === 0 ? `${h}時間` : `${h}時間${m}分`;
}
function getSelectedDuration() {
  const opt = menuSelect.options[menuSelect.selectedIndex];
  return opt ? parseInt(opt.dataset.min || '0', 10) : 0;
}
function toDateStr(y, mo, d) {
  return `${y}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
}
function daysInMonth(y, mo) {
  return new Date(y, mo, 0).getDate();
}

// ── カレンダー状態 ──
let calYear, calMonth;
// APIが返すステータス（英語・日本語両対応）を正規化
function normalizeStatus(s) {
  if (!s) return null;
  if (s === 'past'   || s === '過去')                    return 'past';
  if (s === 'closed' || s === '閉鎖' || s === 'クローズ') return 'closed';
  if (s === 'full'   || s === '満員' || s === '満室')     return 'full';
  if (s === 'open'   || s === '空き' || s === 'オープン') return 'open';
  return null;
}

let calAvail = {};
let calLoading = false;
let selectedDate = null;
const calCache = {};

function initCalendar() {
  const now = new Date();
  calYear  = now.getFullYear();
  calMonth = now.getMonth() + 1;
  renderCalendar();
}

// カレンダーを描画
function renderCalendar() {
  document.getElementById('cal-title').textContent = `${calYear}年${calMonth}月`;

  const grid   = document.getElementById('cal-grid');
  grid.innerHTML = '';

  if (calLoading) {
    grid.innerHTML = '<div class="cal-loading-msg"><span class="cal-spinner"></span>カレンダーを読み込んでいます...</div>';
    const now2 = new Date();
    const md2  = new Date(now2.getFullYear(), now2.getMonth() + 2, now2.getDate());
    document.getElementById('cal-prev').disabled =
      calYear < now2.getFullYear() || (calYear === now2.getFullYear() && calMonth <= now2.getMonth() + 1);
    document.getElementById('cal-next').disabled =
      calYear > md2.getFullYear() || (calYear === md2.getFullYear() && calMonth >= md2.getMonth() + 1);
    return;
  }

  const firstDow   = new Date(calYear, calMonth - 1, 1).getDay(); // 0=Sun
  const startOffset = firstDow === 0 ? 6 : firstDow - 1;         // Mon start
  const totalDays  = daysInMonth(calYear, calMonth);
  const today      = new Date(); today.setHours(0, 0, 0, 0);
  const maxDate    = new Date(today.getFullYear(), today.getMonth() + 2, today.getDate());

  // 月の前の空白セル
  for (let i = 0; i < startOffset; i++) {
    const el = document.createElement('div');
    el.className = 'cal-cell cal-cell--empty';
    grid.appendChild(el);
  }

  for (let d = 1; d <= totalDays; d++) {
    const date       = new Date(calYear, calMonth - 1, d);
    const dateStr    = toDateStr(calYear, calMonth, d);
    const status     = normalizeStatus(calAvail[dateStr]);
    const isPast     = date < today;
    const isBeyondMax = date > maxDate;
    const isMon      = date.getDay() === 1;
    const isSel      = dateStr === selectedDate;

    const cell = document.createElement('div');
    cell.className = 'cal-cell';

    let subLabel = '';
    let dotClass = '';

    if (isSel) {
      cell.classList.add('cal-cell--selected');
    } else if (isPast || isBeyondMax) {
      cell.classList.add('cal-cell--past');
    } else if (isMon || status === 'closed') {
      cell.classList.add('cal-cell--closed');
      subLabel = '休';
    } else if (calLoading) {
      cell.classList.add('cal-cell--loading');
    } else if (status === 'full') {
      cell.classList.add('cal-cell--full');
      subLabel = '満席';
    } else if (status === 'open') {
      cell.classList.add('cal-cell--open');
      dotClass = 'cal-dot cal-dot--open';
      cell.addEventListener('click', () => onDayClick(dateStr));
    } else {
      // 未取得（メニュー未選択など）→ クリック可
      cell.classList.add('cal-cell--open');
      cell.addEventListener('click', () => onDayClick(dateStr));
    }

    cell.innerHTML = `<span class="cal-cell-num">${d}</span>` +
      (dotClass  ? `<i class="${dotClass}"></i>` : '') +
      (subLabel  ? `<span class="cal-cell-sub">${subLabel}</span>` : '');

    grid.appendChild(cell);
  }

  // 前月・次月ボタン制御
  const now = new Date();
  const maxNavYear  = maxDate.getFullYear();
  const maxNavMonth = maxDate.getMonth() + 1;
  document.getElementById('cal-prev').disabled =
    calYear < now.getFullYear() ||
    (calYear === now.getFullYear() && calMonth <= now.getMonth() + 1);
  document.getElementById('cal-next').disabled =
    calYear > maxNavYear ||
    (calYear === maxNavYear && calMonth >= maxNavMonth);
}

// 月間空き状況をAPIから取得
async function fetchMonthAvailability() {
  const duration = getSelectedDuration();
  if (!duration) { renderCalendar(); return; }

  // メニュー（所要時間）ごとにキャッシュを分ける
  const cacheKey = `${calYear}-${calMonth}-${duration}`;
  if (calCache[cacheKey]) {
    Object.assign(calAvail, calCache[cacheKey]);
    calLoading = false;
    renderCalendar();
    return;
  }

  calLoading = true;
  renderCalendar();

  try {
    const url = `${BOOKING_SCRIPT_URL}?view=month&year=${calYear}&month=${calMonth}&duration=${duration}`;
    const res  = await fetch(url, { redirect: 'follow' });
    const json = await res.json();
    calCache[cacheKey] = json;
    Object.assign(calAvail, json);
  } catch (_) {
    // ネットワークエラー時はそのまま（全日クリック可能）
  }

  calLoading = false;
  renderCalendar();
  _prefetchNextMonth(duration);
}

function _prefetchNextMonth(duration) {
  const ny  = calMonth === 12 ? calYear + 1 : calYear;
  const nm  = calMonth === 12 ? 1 : calMonth + 1;
  const key = `${ny}-${nm}-${duration}`;
  if (calCache[key]) return;
  const url = `${BOOKING_SCRIPT_URL}?view=month&year=${ny}&month=${nm}&duration=${duration}`;
  fetch(url, { redirect: 'follow' }).then(r => r.json()).then(j => { calCache[key] = j; }).catch(() => {});
}

// 日付クリック
function onDayClick(dateStr) {
  const duration = getSelectedDuration();
  if (!duration) {
    // メニュー未選択 → メニュー欄にスクロール＋ハイライト
    menuSelect.focus();
    menuSelect.closest('.bf-group').scrollIntoView({ behavior: 'smooth', block: 'center' });
    menuSelect.closest('.bf-group').style.outline = '2px solid var(--gold)';
    setTimeout(() => menuSelect.closest('.bf-group').style.outline = '', 1500);
    return;
  }

  selectedDate = dateStr;
  dateHidden.value = dateStr;
  timeHidden.value = '';
  timeRange.textContent = '';

  // 1ヶ月以降の予約はお知らせを表示
  const todayCheck = new Date(); todayCheck.setHours(0, 0, 0, 0);
  const oneMonthLater = new Date(todayCheck.getFullYear(), todayCheck.getMonth() + 1, todayCheck.getDate());
  document.getElementById('bf-far-notice').hidden = new Date(dateStr) <= oneMonthLater;

  renderCalendar();
  fetchDaySlots(dateStr, duration);
}

// 日別スロットを取得してグリッド描画
async function fetchDaySlots(dateStr, duration) {
  gridWrap.hidden = false;
  renderGrid({ loading: true });

  try {
    const url  = `${BOOKING_SCRIPT_URL}?date=${dateStr}&duration=${duration}`;
    const res  = await fetch(url, { redirect: 'follow' });
    const json = await res.json();
    renderGrid({ busy: json.busy || [], slots: json.slots || [], duration });
  } catch (_) {
    // フォールバック：全スロット表示
    const allSl = [];
    for (let t = 10 * 60; t + duration <= 20 * 60; t += 30) allSl.push(toTimeStr(t));
    renderGrid({ busy: [], slots: allSl, duration });
  }
}

// 時間グリッドを描画
function renderGrid({ loading, busy = [], slots = [], duration = 60 }) {
  timeGrid.innerHTML = '';
  timeHidden.value = '';

  if (loading) {
    timeGrid.innerHTML = '<div class="tg-loading">空き確認中...</div>';
    return;
  }
  if (!slots.length) {
    timeGrid.innerHTML = '<div class="tg-empty">この日はすでに満席です</div>';
    return;
  }

  const busySet  = new Set();
  busy.forEach(({ start, end }) => {
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    for (let t = sh * 60 + sm; t < eh * 60 + em; t += 30) busySet.add(t);
  });

  const availSet = new Set(slots.map(s => {
    const [h, m] = s.split(':').map(Number);
    return h * 60 + m;
  }));

  for (let t = 10 * 60; t < 20 * 60; t += 30) {
    const label   = toTimeStr(t);
    const isBusy  = busySet.has(t);
    const isAvail = availSet.has(t);

    const slot = document.createElement('div');
    slot.className = 'tg-slot ' + (isBusy ? 'tg-slot--busy' : isAvail ? 'tg-slot--open' : 'tg-slot--tight');
    slot.dataset.time = label;
    slot.innerHTML = `
      <span class="tg-time">${label}</span>
      <span class="tg-bar"></span>
      <span class="tg-badge">${isBusy ? '予約済' : isAvail ? '空き' : '―'}</span>`;

    if (isAvail) slot.addEventListener('click', () => selectSlot(label, duration));
    timeGrid.appendChild(slot);
  }
}

// スロット選択
function selectSlot(startTime, duration) {
  const [h, m]   = startTime.split(':').map(Number);
  const startMin = h * 60 + m;
  const endMin   = startMin + duration;

  timeGrid.querySelectorAll('.tg-slot').forEach(el => {
    el.classList.remove('tg-slot--selected', 'tg-slot--start');
    if (el.classList.contains('tg-slot--open')) {
      el.querySelector('.tg-badge').textContent = '空き';
    }
  });

  timeGrid.querySelectorAll('.tg-slot').forEach(el => {
    const [eh, em] = el.dataset.time.split(':').map(Number);
    const t = eh * 60 + em;
    if (t >= startMin && t < endMin) {
      el.classList.add('tg-slot--selected');
      if (t === startMin) {
        el.classList.add('tg-slot--start');
        el.querySelector('.tg-badge').textContent = '開始';
      } else if (t === endMin - 30) {
        el.querySelector('.tg-badge').textContent = `〜${toTimeStr(endMin)}`;
      } else {
        el.querySelector('.tg-badge').textContent = '';
      }
    }
  });

  timeHidden.value = startTime;
  timeRange.textContent = `${startTime} → ${toTimeStr(endMin)}（${formatDuration(duration)}）`;
  timeGrid.querySelector('.tg-slot--start')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

// ── メニュー変更 ──
menuSelect.addEventListener('change', () => {
  durationBadge.textContent = getSelectedDuration()
    ? `所要時間の目安: ${formatDuration(getSelectedDuration())}` : '';
  calAvail = {};           // キャッシュクリア
  gridWrap.hidden = true;
  timeHidden.value = '';
  timeRange.textContent = '';
  fetchMonthAvailability();
  // 選択済みの日付があれば日別スロットも再取得
  if (selectedDate && getSelectedDuration()) {
    fetchDaySlots(selectedDate, getSelectedDuration());
  }
});

// ── カレンダーナビゲーション ──
document.getElementById('cal-prev').addEventListener('click', () => {
  calMonth--;
  if (calMonth < 1) { calMonth = 12; calYear--; }
  calAvail = {};
  fetchMonthAvailability();
});
document.getElementById('cal-next').addEventListener('click', () => {
  calMonth++;
  if (calMonth > 12) { calMonth = 1; calYear++; }
  calAvail = {};
  fetchMonthAvailability();
});

// ── フォーム送信 ──
function validateName(val) {
  return /[\s　]/.test(val.trim());
}
function validatePhone(val) {
  return /^0\d{9,10}$/.test(val.replace(/[-ー－]/g, ''));
}

document.getElementById('bf-name').addEventListener('blur', function() {
  this.setCustomValidity(validateName(this.value) || !this.value ? '' : '姓と名をスペースで区切って入力してください（例：山田 花子）');
  this.reportValidity();
});
document.getElementById('bf-phone').addEventListener('blur', function() {
  this.setCustomValidity(validatePhone(this.value) || !this.value ? '' : '正しい電話番号を入力してください（例：090-0000-0000）');
  this.reportValidity();
});

function showSuccess() {
  document.body.innerHTML =
    '<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;' +
    'text-align:center;padding:40px 20px;background:#f9f6f2;">' +
    '<div style="color:#1a1a1a;max-width:400px">' +
    '<div style="font-size:3rem;color:#2e7d32;margin-bottom:20px">✓</div>' +
    '<div style="font-size:1.25rem;font-weight:bold;margin-bottom:14px">ご予約を受け付けました</div>' +
    '<div style="color:#555;line-height:1.8;font-size:.95rem">確認後、お電話またはSMSにてご連絡いたします。</div>' +
    '</div></div>';
}

submitBtn.addEventListener('click', async () => {
  const nameEl  = document.getElementById('bf-name');
  const phoneEl = document.getElementById('bf-phone');
  nameEl.setCustomValidity(validateName(nameEl.value) ? '' : '姓と名をスペースで区切って入力してください（例：山田 花子）');
  phoneEl.setCustomValidity(validatePhone(phoneEl.value) ? '' : '正しい電話番号を入力してください（例：090-0000-0000）');
  if (!bookingForm.checkValidity()) { bookingForm.reportValidity(); return; }
  if (!timeHidden.value) {
    gridWrap.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = '送信中...';

  const duration = getSelectedDuration();
  const [sh, sm] = timeHidden.value.split(':').map(Number);
  const endMin   = sh * 60 + sm + duration;

  const payload = {
    menu: menuSelect.value, date: dateHidden.value,
    timeStart: timeHidden.value, timeEnd: toTimeStr(endMin), duration,
    name:  document.getElementById('bf-name').value,
    phone: document.getElementById('bf-phone').value,
    email: document.getElementById('bf-email').value,
    notes: document.getElementById('bf-notes').value,
    lineUserId: _lineUserId,
  };

  const body = JSON.stringify(payload);
  showSuccess();
  fetch('/hair/api/book', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  }).catch(() => {});
});

// ── 初期化 ──
initCalendar();

// LINEから誘導された場合はLINEボタンを非表示 + LINE IDを取得
const _params = new URLSearchParams(location.search);
const _lineUserId = _params.get('lu') || '';
if (_params.get('from') === 'line' || _lineUserId) {
  document.querySelector('.line-booking-box')?.remove();
  document.querySelector('.bf-divider')?.remove();
}

// 予約完了ページ
if (_params.get('booked') === '1') {
  document.getElementById('bookingForm')?.style && (document.getElementById('bookingForm').style.display = 'none');
  document.querySelector('.line-booking-box')?.remove();
  document.querySelector('.bf-divider')?.remove();
  successEl.removeAttribute('hidden');
  successEl.style.display = 'block';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// キャンセルページ処理
if (_params.get('action') === 'cancel') {
  initCancelPage(_params.get('token') || '');
}

function initCancelPage(token) {
  const cancelEl = document.getElementById('cancel-result');
  if (!cancelEl) return;

  document.getElementById('bookingForm').hidden = true;
  document.querySelector('.line-booking-box')?.remove();
  document.querySelector('.bf-divider')?.remove();
  document.querySelector('.booking-tel')?.remove();

  cancelEl.hidden = false;
  setTimeout(() => cancelEl.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);

  cancelEl.innerHTML =
    '<p class="cancel-result__icon">?</p>' +
    '<p class="cancel-result__title">キャンセルの確認</p>' +
    '<p class="cancel-result__detail">本当にキャンセルでよろしいですか？</p>' +
    '<div class="cancel-result__actions">' +
    '<button class="cancel-confirm-btn" id="cancel-confirm-btn">キャンセルする</button>' +
    '<a class="cancel-back-link" href="/hair/">戻る</a>' +
    '</div>';

  document.getElementById('cancel-confirm-btn').addEventListener('click', function() {
    cancelEl.innerHTML = '<p class="cancel-result__loading">処理中...</p>';

    fetch(BOOKING_SCRIPT_URL + '?action=cancel&token=' + encodeURIComponent(token), { redirect: 'follow' })
      .then(function(r) { return r.json(); })
      .then(function(json) {
        if (json.success) {
          cancelEl.innerHTML =
            '<p class="cancel-result__icon">✓</p>' +
            '<p class="cancel-result__title">ご予約をキャンセルしました</p>' +
            '<p class="cancel-result__detail">' + json.name + ' 様の<br>' + json.date + ' ' + json.time + '〜 のご予約をキャンセルしました。</p>' +
            '<p class="cancel-result__sub">またのご来店をお待ちしています。<br><a href="/hair/#booking">新しいご予約はこちら</a></p>';
        } else {
          var msgs = {
            too_late: '施術3日前を過ぎているため、オンラインでのキャンセルは受け付けられません。<br>お手数ですがLINEまたはお電話（<a href="tel:0708422878">070-8422-8778</a>）にてご連絡ください。',
            not_found: 'ご予約が見つかりませんでした。すでにキャンセル済みの可能性があります。',
            invalid_token: '無効なキャンセルリンクです。',
          };
          cancelEl.innerHTML =
            '<p class="cancel-result__icon cancel-result__icon--error">!</p>' +
            '<p class="cancel-result__title">キャンセルできませんでした</p>' +
            '<p class="cancel-result__detail">' + (msgs[json.error] || 'エラーが発生しました') + '</p>';
        }
      })
      .catch(function() {
        cancelEl.innerHTML =
          '<p class="cancel-result__icon cancel-result__icon--error">!</p>' +
          '<p class="cancel-result__title">通信エラー</p>' +
          '<p class="cancel-result__detail">しばらくしてから再試行してください。</p>';
      });
  });
}
