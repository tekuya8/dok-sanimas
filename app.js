/* ===== Dokumentasi Sanimas — foto progres per penerima manfaat ===== */
'use strict';

// ---------- Utilitas ----------
const LS = { cfg: 'ds_cfg', cache: 'ds_cache', pref: 'ds_pref' };
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const load = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
const store = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* penuh */ } };
const uid = p => p + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();
const tidur = ms => new Promise(r => setTimeout(r, ms));
const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayStr = () => ymd(new Date());
const BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const fmtTgl = s => { if (!s) return '—'; const [y, m, d] = s.split('-').map(Number); return `${d} ${BLN[m - 1]} ${y}`; };
const fmtPanjang = s => { const [y, m, d] = s.split('-').map(Number); return `${d} ${BULAN[m - 1]} ${y}`; };
const namaP = p => p.nama || `(nama unit ${p.unit} belum diisi)`;
const pct = (a, b) => (b ? Math.round(a / b * 100) : 0);

const ICON = {
  close: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  cam: '<svg viewBox="0 0 24 24"><path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Zm8 9a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
  img: '<svg viewBox="0 0 24 24"><path d="M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm0 11 5-5 4 4 2-2 5 5M15 9.5a1.5 1.5 0 1 0 0-.01" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg>',
  pin: '<svg viewBox="0 0 24 24"><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Zm0-9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
  pen: '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
  print: '<svg viewBox="0 0 24 24"><path d="M7 9V3h10v6M7 18H5a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M7 14h10v7H7z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>'
};

// ---------- State ----------
const cache = load(LS.cache, {});
const S = {
  cfg: load(LS.cfg, null),
  penerima: cache.penerima || [], dok: cache.dok || [], lokasi: cache.lokasi || [],
  tahap: cache.tahap || [0, 25, 50, 60, 75, 100],
  urlSheet: cache.urlSheet || '', urlFolder: cache.urlFolder || '', lastSync: cache.waktu || 0,
  pref: Object.assign({ stamp: true, geo: true, qKampung: '', qUnit: '', qTahap: 0, tahapSel: 'semua',
    instansi: 'Satuan Kerja Pelaksanaan Prasarana Strategis Papua', kota: 'Jayapura', penyusun: '', jabatan: 'Konsultan Individual' }, load(LS.pref, {})),
  view: 'beranda', nav: { kab: '', kampung: '' }, rekapKab: '',
  antrean: [], loaded: !!cache.waktu, syncing: false
};
const simpanPref = () => store(LS.pref, S.pref);

// ---------- API ----------
async function api(action, data = {}, cfg = S.cfg, timeoutMs = 45000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(cfg.url, { method: 'POST', body: JSON.stringify({ token: cfg.token, action, data }), redirect: 'follow', signal: ctrl.signal });
    if (!res.ok) throw netErr('Server membalas ' + res.status);
    let j;
    try { j = await res.json(); } catch (e) { throw new Error('Balasan server tidak valid. Pastikan URL Web App benar dan akses "Siapa saja".'); }
    if (!j.ok) throw new Error(j.error || 'Permintaan gagal');
    return j.data;
  } catch (e) {
    if (e.name === 'AbortError') throw netErr('Server terlalu lama membalas');
    if (e instanceof TypeError) throw netErr(navigator.onLine ? 'Kiriman terputus di tengah jalan' : 'Tidak ada koneksi internet');
    throw e;
  } finally { clearTimeout(timer); }
}
function netErr(msg) { const e = new Error(msg); e.network = true; return e; }

// File besar dikirim per potongan (~570 KB) & dicoba ulang otomatis
const POTONG = 786432;
async function kirimIsi(b64) {
  if (b64.length <= POTONG) return { base64: b64 };
  const uploadId = 'UP' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const total = Math.ceil(b64.length / POTONG);
  for (let i = 0; i < total; i++) {
    const data = b64.slice(i * POTONG, (i + 1) * POTONG);
    for (let coba = 1; ; coba++) {
      try { await api('unggahPotongan', { uploadId, index: i, total, data }, S.cfg, 90000); break; }
      catch (e) { if (!e.network || coba >= 3) throw e; await tidur(2000 * coba); }
    }
  }
  return { uploadId, total };
}
const keBase64 = blob => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(blob); });

function saveCache() {
  store(LS.cache, { penerima: S.penerima, dok: S.dok, lokasi: S.lokasi, tahap: S.tahap, urlSheet: S.urlSheet, urlFolder: S.urlFolder, waktu: S.lastSync });
}
async function sync(silent) {
  if (!S.cfg || S.syncing) return;
  S.syncing = true; $('#btnSync').classList.add('spin');
  try {
    const d = await api('ambilSemua');
    Object.assign(S, { penerima: d.penerima, dok: d.dok, lokasi: d.lokasi, tahap: d.tahap, urlSheet: d.urlSheet, urlFolder: d.urlFolder, lastSync: d.waktu, loaded: true });
    saveCache(); render();
    if (!silent) toast('Data tersinkron', 'ok');
    prosesAntrean();
  } catch (e) {
    if (!S.loaded) render();
    if (!silent || !e.network) toast(e.message, 'err');
  } finally { S.syncing = false; $('#btnSync').classList.remove('spin'); }
}

// ---------- Antrean foto (IndexedDB) — foto aman di HP sampai terunggah ----------
const DB = {
  db: null,
  open() {
    if (this.db) return Promise.resolve(this.db);
    return new Promise((res, rej) => {
      const r = indexedDB.open('dok-sanimas', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('antrean', { keyPath: 'id' });
      r.onsuccess = () => { this.db = r.result; res(this.db); };
      r.onerror = () => rej(r.error);
    });
  },
  async run(mode, fn) {
    const db = await this.open();
    return new Promise((res, rej) => {
      const t = db.transaction('antrean', mode);
      const req = fn(t.objectStore('antrean'));
      t.oncomplete = () => res(req && 'result' in req ? req.result : undefined);
      t.onerror = () => rej(t.error);
    });
  },
  put(x) { return this.run('readwrite', s => s.put(x)); },
  del(id) { return this.run('readwrite', s => s.delete(id)); },
  all() { return this.run('readonly', s => s.getAll()); }
};
const urlLokal = new Map();
const urlAntre = it => { if (!urlLokal.has(it.id)) urlLokal.set(it.id, URL.createObjectURL(it.blob)); return urlLokal.get(it.id); };
const lepasUrl = id => { if (urlLokal.has(id)) { URL.revokeObjectURL(urlLokal.get(id)); urlLokal.delete(id); } };

let memproses = false, timerUlang = null;
async function prosesAntrean() {
  if (memproses || !S.cfg) return;
  const siap = S.antrean.filter(x => !x.gagal);
  if (!siap.length) { tampilUpBar(); return; }
  if (!navigator.onLine) { tampilUpBar(); return; }
  memproses = true;
  let ok = 0;
  try {
    for (const it of siap) {
      tampilUpBar(`Mengunggah foto ${ok + 1}/${siap.length}…`);
      try {
        const b64 = await keBase64(it.blob);
        const isi = await kirimIsi(b64);
        const r = await api('unggahFoto', { id: it.id, idPenerima: it.idPenerima, tahap: it.tahap, tipe: it.tipe, tanggal: it.tanggal, koordinat: it.koordinat, ...isi }, S.cfg, 180000);
        if (!S.dok.some(d => d.id === r.dok.id)) S.dok.push(r.dok);
        if (r.penerima) { const i = S.penerima.findIndex(p => p.id === r.penerima.id); if (i >= 0) S.penerima[i] = r.penerima; }
        await DB.del(it.id);
        S.antrean = S.antrean.filter(x => x.id !== it.id);
        ok++;
        saveCache();
        segarkan();
      } catch (e) {
        if (e.network) { clearTimeout(timerUlang); timerUlang = setTimeout(prosesAntrean, 30000); break; }
        it.gagal = e.message; await DB.put(it); segarkan();
        toast('Foto gagal diunggah: ' + e.message, 'err', 4000);
      }
    }
  } finally {
    memproses = false;
    tampilUpBar();
    if (ok) toast(`${ok} foto terunggah ke Drive`, 'ok');
  }
}
function tampilUpBar(teks) {
  const bar = $('#upBar');
  const tunggu = S.antrean.filter(x => !x.gagal).length, gagal = S.antrean.filter(x => x.gagal).length;
  $('#dotPending').classList.toggle('hidden', !S.antrean.length);
  if (teks) { bar.className = 'up-bar'; bar.innerHTML = `<span class="spin-sm"></span>${esc(teks)}`; return; }
  if (!tunggu && !gagal) { bar.className = 'up-bar hidden'; return; }
  bar.className = 'up-bar warn';
  bar.innerHTML = tunggu
    ? `📶 ${tunggu} foto tersimpan di HP, menunggu sinyal untuk diunggah`
    : `⚠️ ${gagal} foto gagal diunggah. Buka menu Atur → Antrean foto.`;
}

// ---------- Ambil & olah foto ----------
function getPosisi() {
  if (!S.pref.geo || !navigator.geolocation) return Promise.resolve('');
  return new Promise(res => {
    navigator.geolocation.getCurrentPosition(p => res(p.coords.latitude.toFixed(6) + ', ' + p.coords.longitude.toFixed(6)),
      () => res(''), { enableHighAccuracy: true, timeout: 7000, maximumAge: 60000 });
  });
}
async function olahFoto(file, p, tahap, koordinat, tanggal) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('File bukan foto yang bisa dibaca')); i.src = url; });
    const max = 1600, sc = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * sc), h = Math.round(img.naturalHeight * sc);
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);
    if (S.pref.stamp) {
      // Cap info di bagian bawah foto: lokasi, unit, tahap, tanggal, koordinat
      const fs = Math.max(13, Math.round(Math.min(w, h) * 0.034));
      const baris = [
        `${p.kampung} · Unit ${p.unit}${p.nama ? ' · ' + p.nama : ''}`,
        `Progres ${tahap}% · ${fmtPanjang(tanggal)} ${pad(new Date().getHours())}:${pad(new Date().getMinutes())}`,
        `${p.kabupaten}${koordinat ? ' · ' + koordinat : ''}`
      ];
      const tinggi = fs * 1.45 * baris.length + fs * 0.9;
      const g = ctx.createLinearGradient(0, h - tinggi - fs, 0, h);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.35, 'rgba(0,0,0,.55)'); g.addColorStop(1, 'rgba(0,0,0,.7)');
      ctx.fillStyle = g; ctx.fillRect(0, h - tinggi - fs, w, tinggi + fs);
      ctx.fillStyle = '#fff'; ctx.textBaseline = 'bottom';
      ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 3;
      baris.forEach((t, i) => {
        ctx.font = `${i === 0 ? '700' : '500'} ${fs}px 'Plus Jakarta Sans', system-ui, sans-serif`;
        let teks = t;
        while (ctx.measureText(teks).width > w - fs * 1.6 && teks.length > 8) teks = teks.slice(0, -2);
        if (teks !== t) teks = teks.slice(0, -1) + '…';
        ctx.fillText(teks, fs * 0.8, h - fs * 0.6 - (baris.length - 1 - i) * fs * 1.45);
      });
    }
    const blob = await new Promise(res => c.toBlob(res, 'image/jpeg', 0.82));
    if (!blob) throw new Error('Foto tidak bisa diproses');
    return blob;
  } finally { URL.revokeObjectURL(url); }
}

async function ambilFoto(p, tahap, files, dariKamera) {
  if (!files.length) return;
  const koordinat = dariKamera ? await getPosisi() : '';
  let n = 0;
  for (const f of files) {
    try {
      const tanggal = dariKamera || !f.lastModified ? todayStr() : ymd(new Date(f.lastModified));
      const blob = await olahFoto(f, p, tahap, koordinat, tanggal);
      const it = { id: uid('DK'), idPenerima: p.id, tahap: Number(tahap), blob, tipe: 'image/jpeg', tanggal, koordinat, dibuat: Date.now() };
      await DB.put(it);
      S.antrean.push(it);
      n++;
    } catch (e) { toast(e.message, 'err'); }
  }
  if (!n) return;
  segarkan();
  toast(navigator.onLine ? `${n} foto ${tahap}% disimpan, sedang diunggah` : `${n} foto disimpan di HP, diunggah saat ada sinyal`, 'ok', 2200);
  prosesAntrean();
}

// ---------- Hitungan ----------
const kabList = () => [...new Set(S.lokasi.map(l => l.kabupaten).concat(S.penerima.map(p => p.kabupaten)))].filter(Boolean);
const kampungOf = kab => {
  const urut = S.lokasi.filter(l => l.kabupaten === kab).map(l => l.kampung);
  const lain = [...new Set(S.penerima.filter(p => p.kabupaten === kab).map(p => p.kampung))].filter(k => !urut.includes(k));
  return urut.concat(lain);
};
const unitsOf = kampung => S.penerima.filter(p => p.kampung === kampung).sort((a, b) => a.unit - b.unit);
const fotoOf = (id, tahap) => S.dok.filter(d => d.idPenerima === id && (tahap === undefined || d.tahap === tahap));
const antreOf = (id, tahap) => S.antrean.filter(a => a.idPenerima === id && (tahap === undefined || a.tahap === tahap));
function statusSlot(p, t) {
  if (fotoOf(p.id, t).length) return 'ok';
  const a = antreOf(p.id, t);
  if (a.some(x => x.gagal)) return 'bad';
  return a.length ? 'wait' : '';
}
function hitung(units) {
  const per = S.tahap.map(t => units.filter(p => fotoOf(p.id, t).length).length);
  const terisi = per.reduce((a, b) => a + b, 0);
  return { per, terisi, total: units.length * S.tahap.length, persen: pct(terisi, units.length * S.tahap.length) };
}
const tgrid = (h, n) => `<div class="tgrid">${S.tahap.map((t, i) => `<div class="${h.per[i] && h.per[i] === n ? 'full' : h.per[i] ? 'part' : ''}">${t}%<b>${h.per[i]}/${n}</b></div>`).join('')}</div>`;

// ---------- Render ----------
const TITLES = { beranda: 'Beranda', lokasi: 'Lokasi', rekap: 'Rekap', atur: 'Pengaturan' };
function render() {
  $('#topTitle').textContent = TITLES[S.view];
  $('#topSub').textContent = S.view === 'beranda' ? 'Dokumentasi Sanimas' : (S.lastSync ? 'Sinkron ' + waktuLalu(S.lastSync) : '');
  $$('.view').forEach(v => v.classList.toggle('hidden', v.id !== 'view-' + S.view));
  $$('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.view === S.view));
  ({ beranda: renderBeranda, lokasi: renderLokasi, rekap: renderRekap, atur: renderAtur })[S.view]();
  tampilUpBar();
}
// Render ulang tampilan aktif + sheet detail (jika terbuka) tanpa kehilangan posisi gulir
function segarkan() {
  const y = window.scrollY;
  render(); window.scrollTo(0, y);
  if (sheetOpen && detailId) openDetail(detailId, true);
}
function waktuLalu(ms) {
  const m = Math.round((Date.now() - ms) / 60000);
  if (m < 1) return 'barusan';
  if (m < 60) return m + ' menit lalu';
  const j = Math.round(m / 60);
  return j < 24 ? j + ' jam lalu' : Math.round(j / 24) + ' hari lalu';
}
function go(view) {
  S.view = view;
  const el = $('#view-' + view);
  el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
  render(); window.scrollTo({ top: 0 });
}
const skeleton = () => `<div class="skel" style="height:160px;border-radius:26px;margin-bottom:14px"></div><div class="skel" style="height:120px;margin-bottom:12px"></div><div class="skel" style="height:120px"></div>`;
const thumbUrl = d => `https://drive.google.com/thumbnail?id=${encodeURIComponent(d.fileId)}&sz=w300`;

// ---------- BERANDA ----------
function renderBeranda() {
  const el = $('#view-beranda');
  if (!S.loaded) { el.innerHTML = skeleton(); return; }
  const h = hitung(S.penerima);
  const terbaru = S.dok.slice().sort((a, b) => (b.diunggah || 0) - (a.diunggah || 0)).slice(0, 8);
  el.innerHTML = `
    <div class="hero">
      <p class="hero-label">Kelengkapan dokumentasi progres</p>
      <div class="hero-amount num">${h.persen}% <span style="font-size:14px;font-weight:600;opacity:.9">${h.terisi} dari ${h.total} tahap</span></div>
      <div class="stat-grid">
        <div class="hero-box"><small>Unit</small><b class="num">${S.penerima.length}</b></div>
        <div class="hero-box"><small>Foto</small><b class="num">${S.dok.length}</b></div>
        <div class="hero-box"><small>Antre di HP</small><b class="num">${S.antrean.length}</b></div>
      </div>
    </div>
    <div class="card"><div class="card-title">Unit terdokumentasi per tahap</div>${tgrid(h, S.penerima.length)}</div>
    <p class="section-label">Per kabupaten</p>
    ${kabList().map(k => {
      const u = S.penerima.filter(p => p.kabupaten === k), hk = hitung(u);
      return `<button class="loc" data-kab="${esc(k)}"><div class="loc-head"><b>${esc(k)}</b><span>${hk.persen}%</span></div>
        <div class="loc-sub">${kampungOf(k).length} kampung · ${u.length} unit · ${S.dok.filter(d => d.kabupaten === k).length} foto</div>
        <div class="bar ${hk.persen === 100 ? 'done' : ''}"><i style="width:${hk.persen}%"></i></div></button>`;
    }).join('')}
    <div class="card" style="margin-top:4px"><div class="card-title">Foto terbaru</div>
      ${terbaru.length ? `<div class="thumbs">${terbaru.map(d => `<a class="thumb" href="${esc(d.url)}" target="_blank" rel="noopener" title="${esc(d.kampung + ' · ' + d.nama + ' · ' + d.tahap + '%')}">
        <div class="ph">${d.tahap}%<br>${esc(d.kampung)}</div><img loading="lazy" alt="" src="${thumbUrl(d)}" onerror="this.remove()"></a>`).join('')}</div>`
        : '<p class="muted" style="margin:0;font-size:13.5px">Belum ada foto. Buka menu Lokasi atau tekan tombol kamera di bawah.</p>'}
    </div>`;
  $$('[data-kab]', el).forEach(b => b.onclick = () => { S.nav = { kab: b.dataset.kab, kampung: '' }; go('lokasi'); });
}

// ---------- LOKASI ----------
function renderLokasi() {
  const el = $('#view-lokasi');
  if (!S.loaded) { el.innerHTML = skeleton(); return; }
  const { kab, kampung } = S.nav;
  const crumbs = `<div class="crumbs"><button data-nv="">Semua</button>${kab ? `<span class="sep">›</span>${kampung ? `<button data-nv="kab">${esc(kab)}</button>` : `<span>${esc(kab)}</span>`}` : ''}${kampung ? `<span class="sep">›</span><span>${esc(kampung)}</span>` : ''}</div>`;
  let html = crumbs;
  if (!kab) {
    html += kabList().map(k => {
      const u = S.penerima.filter(p => p.kabupaten === k), hk = hitung(u);
      return `<button class="loc" data-goKab="${esc(k)}"><div class="loc-head"><b>${esc(k)}</b><span>${hk.persen}%</span></div>
        <div class="loc-sub">${kampungOf(k).map(esc).join(', ')}</div>${tgrid(hk, u.length)}</button>`;
    }).join('');
  } else if (!kampung) {
    html += kampungOf(kab).map(k => {
      const u = unitsOf(k), hk = hitung(u), L = S.lokasi.find(l => l.kampung === k) || {};
      return `<button class="loc" data-goKmp="${esc(k)}"><div class="loc-head"><b>${esc(k)}</b><span>${hk.persen}%</span></div>
        <div class="loc-sub">${L.distrik ? 'Distrik ' + esc(L.distrik) + ' · ' : ''}${u.length} unit${L.tfl ? ' · TFL ' + esc(L.tfl) : ''}</div>${tgrid(hk, u.length)}</button>`;
    }).join('');
  } else {
    const u = unitsOf(kampung), hk = hitung(u), L = S.lokasi.find(l => l.kampung === kampung) || {};
    const ts = S.pref.tahapSel;
    html += `
      <div class="info-card"><div style="display:flex;justify-content:space-between;align-items:center"><h3>${esc(kampung)}</h3><button class="link" id="addPen2">✏️ Atur unit (${u.length})</button></div>
        <div class="kv"><span class="muted">Distrik / Kab.</span><span>${esc(L.distrik || '—')} · ${esc(kab)}</span></div>
        <div class="kv"><span class="muted">TFL</span><span>${esc(L.tfl || '—')}</span></div>
        <div class="kv"><span class="muted">Ketua Pokmas</span><span>${esc(L.ketua || '—')}</span></div>
        ${tgrid(hk, u.length)}</div>
      <div class="lbl"><span>Tampilkan / foto untuk tahap</span></div>
      <div class="chips">${['semua', ...S.tahap].map(t => `<button class="chip ${String(ts) === String(t) ? 'active' : ''}" data-ts="${t}">${t === 'semua' ? 'Semua tahap' : t + '%'}</button>`).join('')}</div>
      ${ts !== 'semua' ? `<p class="muted" style="font-size:12.5px;margin:-2px 4px 10px">Mode cepat: tekan 📷 di tiap rumah untuk foto progres ${ts}%.</p>` : ''}
      ${u.map(p => {
        if (ts === 'semua') return `<button class="unit" data-open="${esc(p.id)}"><div class="unit-no">${p.unit}</div>
          <div class="unit-main"><b>${esc(namaP(p))}</b><div class="dots">${S.tahap.map(t => `<i class="${statusSlot(p, t)}" title="${t}%"></i>`).join('')}</div></div></button>`;
        const t = Number(ts), nF = fotoOf(p.id, t).length, nA = antreOf(p.id, t).length;
        return `<div class="unit"><div class="unit-no">${p.unit}</div>
          <button class="unit-main" style="text-align:left" data-open="${esc(p.id)}"><b>${esc(namaP(p))}</b>
            <span class="unit-st ${nF ? 'ok' : nA ? 'wait' : 'no'}">${nF ? `✓ ${nF} foto ${t}%` : nA ? `⏳ ${nA} antre` : `Belum ada foto ${t}%`}</span></button>
          <div class="unit-cam">
            <label class="alt" aria-label="Galeri">${ICON.img}<input type="file" accept="image/*" multiple data-up="${esc(p.id)}"></label>
            <label aria-label="Kamera">${ICON.cam}<input type="file" accept="image/*" capture="environment" data-cam="${esc(p.id)}"></label>
          </div></div>`;
      }).join('')}
      <button class="btn btn-ghost btn-block btn-sm" id="addPen" style="margin-top:6px">✏️ Atur jumlah unit & nama penerima</button>`;
  }
  el.innerHTML = html;
  $$('[data-nv]', el).forEach(b => b.onclick = () => { S.nav = b.dataset.nv === 'kab' ? { kab, kampung: '' } : { kab: '', kampung: '' }; renderLokasi(); window.scrollTo(0, 0); });
  $$('[data-goKab]', el).forEach(b => b.onclick = () => { S.nav = { kab: b.getAttribute('data-goKab'), kampung: '' }; renderLokasi(); window.scrollTo(0, 0); });
  $$('[data-goKmp]', el).forEach(b => b.onclick = () => { S.nav = { kab, kampung: b.getAttribute('data-goKmp') }; renderLokasi(); window.scrollTo(0, 0); });
  $$('[data-ts]', el).forEach(b => b.onclick = () => { S.pref.tahapSel = b.dataset.ts === 'semua' ? 'semua' : Number(b.dataset.ts); simpanPref(); renderLokasi(); });
  $$('[data-open]', el).forEach(b => b.onclick = () => openDetail(b.dataset.open));
  $$('[data-cam],[data-up]', el).forEach(inp => inp.onchange = e => {
    const files = [...e.target.files]; e.target.value = '';
    const p = S.penerima.find(x => x.id === (inp.dataset.cam || inp.dataset.up));
    if (p) ambilFoto(p, Number(S.pref.tahapSel), files, !!inp.dataset.cam);
  });
  const add = $('#addPen', el);
  if (add) add.onclick = () => openKelolaUnit(kab, kampung);
  const add2 = $('#addPen2', el);
  if (add2) add2.onclick = () => openKelolaUnit(kab, kampung);
}

// ---------- DETAIL PENERIMA ----------
let detailId = null;
function openDetail(id, keepScroll) {
  const p = S.penerima.find(x => x.id === id);
  if (!p) return;
  detailId = id;
  const scroll = keepScroll ? $('#sheet').scrollTop : 0;
  const h = hitung([p]);
  openSheet(`
    ${sheetHead('Unit ' + p.unit + ' · ' + esc(p.kampung))}
    <h3 class="detail-title" style="margin-top:-4px">${esc(namaP(p))}</h3>
    <div class="task-pills" style="margin-top:0">
      <span class="pill pill-soft">${esc(p.kabupaten)}</span>
      <span class="pill ${h.persen === 100 ? 'st-selesai' : 'st-proses'}"><i></i>${h.terisi}/${S.tahap.length} tahap</span>
      ${p.folder ? `<a class="pill pill-soft" href="${esc(p.folder)}" target="_blank" rel="noopener" style="text-decoration:none">📁 Folder Drive</a>` : ''}
      <button class="pill pill-soft" id="dEdit">${ICON.pen.replace('<svg', '<svg style="width:13px;height:13px"')} Ubah nama</button>
    </div>
    <div style="margin-top:14px">
    ${S.tahap.map(t => {
      const fs = fotoOf(p.id, t), as = antreOf(p.id, t);
      return `<div class="tahap-sec">
        <div class="tahap-head"><div><b>Progres ${t}%</b><br><small>${fs.length ? fs.length + ' foto' : 'Belum ada foto'}${as.length ? ' · ' + as.length + ' antre' : ''}</small></div>
          <div class="tahap-btns">
            <label>${ICON.img}<input type="file" accept="image/*" multiple data-up="${t}"></label>
            <label class="main">${ICON.cam} Foto<input type="file" accept="image/*" capture="environment" data-cam="${t}"></label>
          </div></div>
        ${fs.length || as.length ? `<div class="thumbs">
          ${as.map(a => `<div class="thumb"><img alt="" src="${urlAntre(a)}"><span class="tag ${a.gagal ? 'bad' : ''}">${a.gagal ? 'gagal' : 'antre'}</span><button class="x-btn" data-dela="${esc(a.id)}" aria-label="Hapus">${ICON.close}</button></div>`).join('')}
          ${fs.map(d => `<a class="thumb" href="${esc(d.url)}" target="_blank" rel="noopener" title="${esc(d.namaFile)}"><div class="ph">${fmtTgl(d.tanggal)}</div><img loading="lazy" alt="" src="${thumbUrl(d)}" onerror="this.remove()"><button class="x-btn" data-deld="${esc(d.id)}" aria-label="Hapus">${ICON.close}</button></a>`).join('')}
        </div>` : ''}
      </div>`;
    }).join('')}
    </div>`, root => {
    root.scrollTop = scroll;
    $('#dEdit', root).onclick = () => { closeSheet(true); setTimeout(() => openFormPenerima(p), 260); };
    $$('[data-cam],[data-up]', root).forEach(inp => inp.onchange = e => {
      const files = [...e.target.files]; e.target.value = '';
      ambilFoto(p, Number(inp.dataset.cam || inp.dataset.up), files, !!inp.dataset.cam);
    });
    $$('[data-dela]', root).forEach(b => b.onclick = async e => {
      e.preventDefault(); e.stopPropagation();
      if (!(await confirmDialog('Hapus foto antrean?', 'Foto ini belum terunggah dan akan dihapus dari HP.', 'Hapus'))) return;
      await DB.del(b.dataset.dela); lepasUrl(b.dataset.dela);
      S.antrean = S.antrean.filter(x => x.id !== b.dataset.dela); segarkan();
    });
    $$('[data-deld]', root).forEach(b => b.onclick = async e => {
      e.preventDefault(); e.stopPropagation();
      if (!(await confirmDialog('Hapus foto ini?', 'Foto dipindah ke Sampah Google Drive (bisa dipulihkan 30 hari) dan dihapus dari daftar.', 'Hapus'))) return;
      try {
        const r = await api('hapusFoto', { id: b.dataset.deld });
        S.dok = S.dok.filter(x => x.id !== b.dataset.deld);
        if (r.penerima) { const i = S.penerima.findIndex(x => x.id === r.penerima.id); if (i >= 0) S.penerima[i] = r.penerima; }
        saveCache(); segarkan(); toast('Foto dihapus', 'ok');
      } catch (err) { toast(err.network ? 'Butuh internet untuk menghapus' : err.message, 'err'); }
    });
  });
}

function openFormPenerima(p, kab, kampung) {
  const baru = !p;
  const unitBaru = baru ? Math.max(0, ...unitsOf(kampung).map(x => x.unit)) + 1 : p.unit;
  openSheet(`
    ${sheetHead(baru ? 'Tambah penerima' : 'Ubah penerima')}
    <p class="muted" style="margin:-6px 0 14px;font-size:13.5px">${esc(baru ? kampung + ' · ' + kab : p.kampung + ' · ' + p.kabupaten)}</p>
    <form id="pForm" novalidate>
      <label class="field"><span>Nomor unit / rumah</span><input id="pUnit" type="number" inputmode="numeric" min="1" value="${unitBaru}"></label>
      <label class="field"><span>Nama KK (pisahkan dengan " / " jika 2 KK dalam 1 rumah)</span><input id="pNama" value="${esc(baru ? '' : p.nama)}" placeholder="Mis. Yohan Samber / Sarah Samber"></label>
      <p class="form-err" id="pErr"></p>
      <button class="btn btn-primary btn-block" type="submit" id="pSave">Simpan</button>
    </form>`, root => {
    $('#pForm', root).onsubmit = async e => {
      e.preventDefault();
      const nama = $('#pNama', root).value.trim(), unit = Number($('#pUnit', root).value);
      if (!nama) { $('#pErr', root).textContent = 'Nama KK wajib diisi'; return; }
      if (!(unit >= 1)) { $('#pErr', root).textContent = 'Nomor unit tidak valid'; return; }
      const btn = $('#pSave', root); setBusy(btn, true);
      try {
        const r = await api('simpanPenerima', baru ? { kabupaten: kab, kampung, unit, nama } : { id: p.id, unit, nama });
        const i = S.penerima.findIndex(x => x.id === r.id);
        if (i >= 0) S.penerima[i] = r; else S.penerima.push(r);
        saveCache(); closeSheet(); render(); toast(baru ? 'Penerima ditambahkan' : 'Perubahan tersimpan', 'ok');
      } catch (err) { setBusy(btn, false); $('#pErr', root).textContent = err.network ? 'Butuh internet untuk menyimpan' : err.message; }
    };
    setTimeout(() => $('#pNama', root).focus(), 300);
  });
}

// ---------- ATUR UNIT & NAMA PENERIMA PER KAMPUNG ----------
function openKelolaUnit(kab, kampung) {
  const asli = unitsOf(kampung);
  let rows = asli.map(p => ({ id: p.id, nama: p.nama }));
  const nFoto = id => (id ? fotoOf(id).length + antreOf(id).length : 0);
  const html = () => `${sheetHead('Atur unit · ' + esc(kampung))}
    <p class="muted" style="margin:-6px 0 12px;font-size:13px">Tambah atau kurangi unit, lalu isi nama penerima manfaat tiap unit. Nomor unit mengikuti urutan daftar.</p>
    <div class="info-card" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
      <div><b style="font-size:15px">Jumlah unit</b><br><small class="muted">semula ${asli.length} unit</small></div>
      <div style="display:flex;align-items:center;gap:10px">
        <button class="btn btn-ghost btn-sm" id="kMin" style="width:44px;font-size:20px" aria-label="Kurangi">−</button>
        <b class="num" style="font-size:24px;min-width:34px;text-align:center" id="kN">${rows.length}</b>
        <button class="btn btn-primary btn-sm" id="kPlus" style="width:44px;font-size:20px" aria-label="Tambah">+</button>
      </div>
    </div>
    <div id="kList">${rows.map((r, i) => `
      <div class="unit" style="padding:8px 10px">
        <div class="unit-no">${i + 1}</div>
        <input class="q-sel" style="margin:0;height:44px;flex:1;min-width:0" data-nm="${i}" value="${esc(r.nama)}" placeholder="Nama penerima unit ${i + 1}">
        ${nFoto(r.id) ? `<span class="pill pill-soft" title="Sudah ada foto">📷${nFoto(r.id)}</span>` : ''}
        <button class="x-btn" data-del="${i}" aria-label="Hapus unit ${i + 1}" style="width:34px;height:34px">${ICON.close}</button>
      </div>`).join('')}</div>
    <button class="btn btn-ghost btn-block btn-sm" id="kAdd" style="margin:4px 0 14px">+ Tambah unit</button>
    <p class="form-err" id="kErr"></p>
    <button class="btn btn-primary btn-block" id="kSave">Simpan ${rows.length} unit</button>`;
  const mount = root => {
    const sc = root.scrollTop;
    root.innerHTML = html(); root.scrollTop = sc;
    $$('[data-close]', root).forEach(b => b.onclick = () => closeSheet());
    $$('[data-nm]', root).forEach(inp => inp.oninput = () => { rows[+inp.dataset.nm].nama = inp.value; });
    const tambah = () => { rows.push({ id: '', nama: '' }); mount(root); const ins = $$('[data-nm]', root); ins[ins.length - 1].focus(); };
    $('#kPlus', root).onclick = tambah;
    $('#kAdd', root).onclick = tambah;
    $('#kMin', root).onclick = () => { if (rows.length > 1) { rows.pop(); mount(root); } else toast('Minimal 1 unit', 'err'); };
    $$('[data-del]', root).forEach(b => b.onclick = () => { if (rows.length > 1) { rows.splice(+b.dataset.del, 1); mount(root); } else toast('Minimal 1 unit', 'err'); });
    $('#kSave', root).onclick = async () => {
      const hapus = asli.filter(p => !rows.some(r => r.id === p.id));
      const berfoto = hapus.filter(p => nFoto(p.id));
      const antreHapus = hapus.filter(p => antreOf(p.id).length);
      if (antreHapus.length) return toast('Ada foto antrean untuk unit yang dihapus. Tunggu terunggah dulu.', 'err', 4000);
      if (berfoto.length) {
        const ok = await confirmDialog(`Hapus ${berfoto.length} unit yang sudah punya foto?`,
          `${berfoto.map(p => 'Unit ' + p.unit + ' ' + namaP(p) + ' (' + nFoto(p.id) + ' foto)').join(', ')}. Daftar fotonya ikut terhapus dari sheet, file di Google Drive tetap aman.`, 'Ya, hapus');
        if (!ok) return;
      }
      const btn = $('#kSave', root); setBusy(btn, true);
      try {
        const r = await api('kelolaUnit', { kabupaten: kab, kampung, units: rows.map(x => ({ id: x.id, nama: x.nama.trim() })), hapus: hapus.map(p => p.id), paksa: berfoto.length > 0 }, S.cfg, 90000);
        const idHapus = new Set(hapus.map(p => p.id));
        S.penerima = S.penerima.filter(p => p.kampung !== kampung).concat(r.penerima);
        S.dok = S.dok.filter(x => !idHapus.has(x.idPenerima));
        // perbarui nomor unit & nama di daftar foto lokal
        r.penerima.forEach(p => S.dok.forEach(x => { if (x.idPenerima === p.id) { x.unit = p.unit; x.nama = p.nama; } }));
        saveCache(); closeSheet(); render();
        const kosong = r.penerima.filter(p => !p.nama).length;
        toast(`${kampung}: ${r.penerima.length} unit tersimpan${kosong ? ` · ${kosong} nama belum diisi` : ''}`, 'ok', 3000);
      } catch (e) {
        setBusy(btn, false);
        $('#kErr', root).textContent = e.network ? 'Butuh internet untuk menyimpan' : e.message;
      }
    };
  };
  detailId = null;
  openSheet(html(), mount);
}

// ---------- UPLOAD CEPAT (tombol kamera tengah) ----------
function openUploadCepat() {
  if (!S.loaded) return toast('Data belum termuat', 'err');
  const P = S.pref;
  if (!P.qKampung || !S.penerima.some(p => p.kampung === P.qKampung)) P.qKampung = (S.penerima[0] || {}).kampung || '';
  const units = () => unitsOf(P.qKampung);
  if (!units().some(p => p.id === P.qUnit)) P.qUnit = (units()[0] || {}).id || '';
  const html = () => {
    const p = S.penerima.find(x => x.id === P.qUnit);
    const nF = p ? fotoOf(p.id, P.qTahap).length : 0, nA = p ? antreOf(p.id, P.qTahap).length : 0;
    return `${sheetHead('Foto progres')}
      <label class="lbl"><span>Kampung</span></label>
      <select class="q-sel" id="qK">${kabList().map(k => `<optgroup label="${esc(k)}">${kampungOf(k).map(x => `<option ${x === P.qKampung ? 'selected' : ''}>${esc(x)}</option>`).join('')}</optgroup>`).join('')}</select>
      <label class="lbl"><span>Penerima manfaat</span></label>
      <select class="q-sel" id="qU">${units().map(x => `<option value="${esc(x.id)}" ${x.id === P.qUnit ? 'selected' : ''}>${x.unit}. ${esc(namaP(x))}${fotoOf(x.id, P.qTahap).length ? ' ✓' : ''}</option>`).join('')}</select>
      <div class="lbl"><span>Tahap progres</span></div>
      <div class="chips">${S.tahap.map(t => `<button class="chip ${t === P.qTahap ? 'active' : ''}" data-qt="${t}">${t}%</button>`).join('')}</div>
      <p class="muted" style="font-size:13px;margin:0 2px 6px">${p ? (nF ? `✓ Sudah ada ${nF} foto ${P.qTahap}% untuk unit ini` : `Belum ada foto ${P.qTahap}% untuk unit ini`) + (nA ? ` · ${nA} antre` : '') : ''}</p>
      <div class="q-btns">
        <label class="btn btn-primary">${ICON.cam} Ambil foto<input type="file" accept="image/*" capture="environment" id="qCam"></label>
        <label class="btn btn-ghost">${ICON.img} Galeri<input type="file" accept="image/*" multiple id="qGal"></label>
      </div>
      <label class="toggle" style="margin-top:10px;border:0"><span>Lanjut ke unit berikutnya setelah foto</span><span class="sw"><input type="checkbox" id="qNext" ${P.qNext !== false ? 'checked' : ''}><span></span></span></label>`;
  };
  const mount = root => {
    root.innerHTML = html();
    $$('[data-close]', root).forEach(b => b.onclick = () => closeSheet());
    $('#qK', root).onchange = e => { P.qKampung = e.target.value; P.qUnit = (units()[0] || {}).id || ''; simpanPref(); mount(root); };
    $('#qU', root).onchange = e => { P.qUnit = e.target.value; simpanPref(); mount(root); };
    $$('[data-qt]', root).forEach(b => b.onclick = () => { P.qTahap = Number(b.dataset.qt); simpanPref(); mount(root); });
    $('#qNext', root).onchange = e => { P.qNext = e.target.checked; simpanPref(); };
    const kirim = async (files, cam) => {
      const p = S.penerima.find(x => x.id === P.qUnit);
      if (!p || !files.length) return;
      await ambilFoto(p, P.qTahap, files, cam);
      if (P.qNext !== false) {
        const u = units(), i = u.findIndex(x => x.id === p.id);
        if (i >= 0 && i < u.length - 1) { P.qUnit = u[i + 1].id; toast(`Lanjut: Unit ${u[i + 1].unit} · ${namaP(u[i + 1])}`, 'info', 1800); }
      }
      simpanPref(); if (sheetOpen) mount(root);
    };
    $('#qCam', root).onchange = e => { const f = [...e.target.files]; e.target.value = ''; kirim(f, true); };
    $('#qGal', root).onchange = e => { const f = [...e.target.files]; e.target.value = ''; kirim(f, false); };
  };
  detailId = null;
  openSheet(html(), mount);
}

// ---------- REKAP ----------
function renderRekap() {
  const el = $('#view-rekap');
  if (!S.loaded) { el.innerHTML = skeleton(); return; }
  const kabs = kabList();
  if (!kabs.includes(S.rekapKab)) S.rekapKab = '';
  const daftarKab = S.rekapKab ? [S.rekapKab] : kabs;
  el.innerHTML = `
    <div class="chips">${['', ...kabs].map(k => `<button class="chip ${S.rekapKab === k ? 'active' : ''}" data-rk="${esc(k)}">${k ? esc(k.replace('Kab. ', '')) : 'Semua'}</button>`).join('')}</div>
    ${daftarKab.map(k => kampungOf(k).map(kmp => {
      const u = unitsOf(kmp), h = hitung(u);
      return `<div class="card" style="padding:12px 10px">
        <div class="card-title" style="padding:0 4px">${esc(kmp)} <span class="muted" style="font-size:12px">${esc(k)} · ${h.persen}%</span></div>
        <table class="mx"><thead><tr><th style="text-align:left">Unit</th>${S.tahap.map(t => `<th>${t}%</th>`).join('')}</tr></thead>
        <tbody>${u.map(p => `<tr><td class="nm">${p.unit}. ${esc(namaP(p))}</td>${S.tahap.map(t => { const n = fotoOf(p.id, t).length; return `<td class="${n ? 'y' : 'n'}">${n ? '✓' + (n > 1 ? n : '') : '–'}</td>`; }).join('')}</tr>`).join('')}</tbody>
        <tfoot><tr><td style="text-align:left">Terisi</td>${h.per.map(n => `<td>${n}/${u.length}</td>`).join('')}</tr></tfoot></table></div>`;
    }).join('')).join('')}
    <div class="btn-row" style="grid-template-columns:1fr 1fr 1fr;margin-top:0">
      <button class="btn btn-ghost btn-sm" id="rCsv">Unduh Excel</button>
      <button class="btn btn-ghost btn-sm" id="rShare">Bagikan</button>
      <button class="btn btn-primary btn-sm" id="rPrint">Cetak/PDF</button>
    </div>`;
  $$('[data-rk]', el).forEach(b => b.onclick = () => { S.rekapKab = b.dataset.rk; renderRekap(); });
  $('#rCsv', el).onclick = () => unduhCsv(daftarKab);
  $('#rShare', el).onclick = () => bagikan(daftarKab);
  $('#rPrint', el).onclick = () => cetakRekap(daftarKab);
}

function unduhCsv(kabs) {
  const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = [['Kabupaten', 'Kampung', 'Unit', 'Nama KK', ...S.tahap.map(t => `Foto ${t}%`), 'Tahap terisi', 'Folder Drive']];
  kabs.forEach(k => kampungOf(k).forEach(kmp => unitsOf(kmp).forEach(p => {
    const n = S.tahap.map(t => fotoOf(p.id, t).length);
    rows.push([k, kmp, p.unit, p.nama || '', ...n, `${n.filter(Boolean).length}/${S.tahap.length}`, p.folder]);
  })));
  const csv = '﻿' + 'sep=;\r\n' + rows.map(r => r.map(q).join(';')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = `Rekap Dokumentasi Sanimas ${todayStr()}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  toast('File rekap diunduh', 'ok');
}

async function bagikan(kabs) {
  const L = [`*Rekap Dokumentasi Progres Sanimas*`, fmtPanjang(todayStr()), ''];
  kabs.forEach(k => {
    L.push(`*${k}*`);
    kampungOf(k).forEach(kmp => {
      const u = unitsOf(kmp), h = hitung(u);
      L.push(`• ${kmp} (${u.length} unit): ${S.tahap.map((t, i) => `${t}%=${h.per[i]}`).join(', ')}`);
    });
    L.push('');
  });
  const text = L.join('\n');
  try {
    if (navigator.share) { await navigator.share({ text }); return; }
    await navigator.clipboard.writeText(text); toast('Ringkasan disalin', 'ok');
  } catch (e) { if (e.name !== 'AbortError') { try { await navigator.clipboard.writeText(text); toast('Ringkasan disalin', 'ok'); } catch (_) { toast('Tidak bisa membagikan', 'err'); } } }
}

function cetakRekap(kabs) {
  const P = S.pref;
  let html = `<div class="kop"><h1>REKAP DOKUMENTASI PROGRES SANIMAS</h1><p>${esc(P.instansi)}</p><p>Per ${fmtPanjang(todayStr())}</p></div>`;
  kabs.forEach(k => kampungOf(k).forEach(kmp => {
    const u = unitsOf(kmp), h = hitung(u), L = S.lokasi.find(l => l.kampung === kmp) || {};
    html += `<h2>Kampung ${esc(kmp)} — Distrik ${esc(L.distrik || '-')}, ${esc(k)} (${h.persen}%)</h2>
      <table class="mxp"><thead><tr><th style="width:34px">Unit</th><th>Nama KK</th>${S.tahap.map(t => `<th style="width:46px">${t}%</th>`).join('')}</tr></thead>
      <tbody>${u.map(p => `<tr><td>${p.unit}</td><td class="nm">${esc(p.nama || '')}</td>${S.tahap.map(t => { const n = fotoOf(p.id, t).length; return `<td>${n ? '✓' + (n > 1 ? ' (' + n + ')' : '') : ''}</td>`; }).join('')}</tr>`).join('')}
      <tr><td colspan="2"><b>Jumlah unit terdokumentasi</b></td>${h.per.map(n => `<td><b>${n}/${u.length}</b></td>`).join('')}</tr></tbody></table>`;
  }));
  html += `<div class="ttd"><p>${esc(P.kota || 'Jayapura')}, ${fmtPanjang(todayStr())}</p><p>${esc(P.jabatan || '')}</p><div class="sp"></div><p><b><u>${esc(P.penyusun || '(nama)')}</u></b></p></div>`;
  $('#printArea').innerHTML = html;
  document.body.classList.add('printing');
  setTimeout(() => window.print(), 60);
}

// ---------- PENGATURAN ----------
function renderAtur() {
  const el = $('#view-atur'), P = S.pref;
  const gagal = S.antrean.filter(x => x.gagal);
  el.innerHTML = `
    <p class="section-label">Foto</p>
    <div class="card">
      <label class="toggle"><span>Cap info di foto<small>Kampung, unit, nama, tahap, tanggal & koordinat tercetak di bagian bawah foto</small></span><span class="sw"><input type="checkbox" id="tStamp" ${P.stamp ? 'checked' : ''}><span></span></span></label>
      <label class="toggle"><span>Catat lokasi GPS<small>Koordinat diambil saat memotret lewat tombol kamera</small></span><span class="sw"><input type="checkbox" id="tGeo" ${P.geo ? 'checked' : ''}><span></span></span></label>
    </div>
    <p class="section-label">Antrean foto di HP</p>
    <div class="card">
      <div class="kv"><span class="muted">Menunggu diunggah</span><span>${S.antrean.length - gagal.length}</span></div>
      <div class="kv"><span class="muted">Gagal</span><span>${gagal.length}</span></div>
      ${gagal.length ? `<div style="font-size:12.5px;color:#b91c1c;margin:6px 0">${esc(gagal[0].gagal)}</div>` : ''}
      <div class="btn-row">
        <button class="btn btn-ghost btn-sm" id="aRetry" ${S.antrean.length ? '' : 'disabled'}>Unggah ulang</button>
        <button class="btn btn-danger btn-sm" id="aClear" ${gagal.length ? '' : 'disabled'}>Hapus yang gagal</button>
      </div>
    </div>
    <p class="section-label">Identitas cetak</p>
    <div class="card">
      <label class="field"><span>Instansi / satker</span><input id="pInst" value="${esc(P.instansi)}"></label>
      <label class="field"><span>Disusun oleh</span><input id="pNama" value="${esc(P.penyusun)}" placeholder="Nama lengkap"></label>
      <div class="row2"><label class="field"><span>Jabatan</span><input id="pJab" value="${esc(P.jabatan)}"></label><label class="field"><span>Kota</span><input id="pKota" value="${esc(P.kota)}"></label></div>
      <button class="btn btn-ghost btn-block btn-sm" id="pSave">Simpan identitas</button>
    </div>
    <p class="section-label">Koneksi</p>
    <div class="card">
      <div class="kv"><span class="muted">Status</span><span>${navigator.onLine ? '🟢 Online' : '🟠 Offline'}</span></div>
      <div class="kv"><span class="muted">Sinkron terakhir</span><span>${S.lastSync ? waktuLalu(S.lastSync) : '—'}</span></div>
      <div class="kv"><span class="muted">Kampung · unit · foto</span><span>${S.lokasi.length} · ${S.penerima.length} · ${S.dok.length}</span></div>
      <div class="btn-row">
        ${S.urlSheet ? `<a class="btn btn-ghost btn-sm" href="${esc(S.urlSheet)}" target="_blank" rel="noopener">Buka Sheet</a>` : '<span></span>'}
        ${S.urlFolder ? `<a class="btn btn-ghost btn-sm" href="${esc(S.urlFolder)}" target="_blank" rel="noopener">Folder Drive</a>` : '<span></span>'}
      </div>
      <button class="btn btn-ghost btn-block btn-sm" id="sSync" style="margin-top:10px">Sinkron sekarang</button>
      <button class="btn btn-danger btn-block btn-sm" id="sLogout" style="margin-top:10px">Putuskan perangkat ini</button>
    </div>
    <p class="muted" style="text-align:center;font-size:12px;margin-top:18px">Dok Sanimas v1.0 · Data di Google Sheets & Drive milikmu</p>`;
  $('#tStamp', el).onchange = e => { P.stamp = e.target.checked; simpanPref(); };
  $('#tGeo', el).onchange = e => { P.geo = e.target.checked; simpanPref(); if (P.geo) getPosisi(); };
  $('#aRetry', el).onclick = async () => {
    for (const it of S.antrean) if (it.gagal) { delete it.gagal; await DB.put(it); }
    renderAtur(); prosesAntrean();
  };
  $('#aClear', el).onclick = async () => {
    if (!(await confirmDialog('Hapus foto yang gagal?', `${gagal.length} foto gagal akan dihapus dari HP.`, 'Hapus'))) return;
    for (const it of gagal) { await DB.del(it.id); lepasUrl(it.id); }
    S.antrean = S.antrean.filter(x => !x.gagal); render();
  };
  $('#pSave', el).onclick = () => {
    Object.assign(P, { instansi: $('#pInst', el).value.trim(), penyusun: $('#pNama', el).value.trim(), jabatan: $('#pJab', el).value.trim(), kota: $('#pKota', el).value.trim() });
    simpanPref(); toast('Identitas cetak disimpan', 'ok');
  };
  $('#sSync', el).onclick = () => sync(false);
  $('#sLogout', el).onclick = async () => {
    const pesan = S.antrean.length ? `PERHATIAN: ${S.antrean.length} foto di antrean belum terunggah dan akan hilang. ` : '';
    if (!(await confirmDialog('Putuskan perangkat ini?', pesan + 'URL & token dihapus dari HP ini. Data di spreadsheet & Drive tetap aman.', 'Putuskan'))) return;
    [LS.cfg, LS.cache].forEach(k => localStorage.removeItem(k)); location.reload();
  };
}

// ---------- Sheet, dialog, toast ----------
function sheetHead(title) {
  return `<div class="sheet-grip"></div><div class="sheet-head"><h2>${title}</h2><button class="close-btn" data-close aria-label="Tutup">${ICON.close}</button></div>`;
}
let sheetOpen = false;
function openSheet(html, onMount) {
  const sh = $('#sheet');
  sh.innerHTML = html; sh.scrollTop = 0;
  requestAnimationFrame(() => { sh.classList.add('show'); $('#sheetBackdrop').classList.add('show'); });
  if (!(history.state && history.state.sheet)) history.pushState({ sheet: 1 }, '');
  sheetOpen = true;
  $$('[data-close]', sh).forEach(b => b.onclick = () => closeSheet());
  if (onMount) onMount(sh);
}
function closeSheet(keepHistory) {
  if (!sheetOpen) return;
  sheetOpen = false; detailId = null;
  $('#sheet').classList.remove('show'); $('#sheetBackdrop').classList.remove('show');
  if (!keepHistory && history.state && history.state.sheet) history.back();
  if (document.activeElement) document.activeElement.blur();
}
window.addEventListener('popstate', () => { if (sheetOpen) { sheetOpen = false; detailId = null; $('#sheet').classList.remove('show'); $('#sheetBackdrop').classList.remove('show'); } });
function confirmDialog(title, text, okLabel) {
  return new Promise(res => {
    const w = $('#dialog');
    w.innerHTML = `<div class="dialog"><div class="dialog-ic">${ICON.trash}</div><h3>${esc(title)}</h3><p>${esc(text)}</p>
      <div class="btn-row" style="margin-top:0"><button class="btn btn-ghost" data-r="0">Batal</button><button class="btn btn-danger-solid" data-r="1">${esc(okLabel)}</button></div></div>`;
    w.classList.remove('hidden');
    const done = v => { w.classList.add('hidden'); w.innerHTML = ''; res(v); };
    $$('[data-r]', w).forEach(b => b.onclick = () => done(b.dataset.r === '1'));
    w.onclick = e => { if (e.target === w) done(false); };
  });
}
function toast(msg, type = 'info', ms = 2600) {
  const box = $('#toasts'), el = document.createElement('div');
  el.className = 'toast ' + type;
  el.innerHTML = `<span class="t-ic">${type === 'ok' ? '✓' : type === 'err' ? '!' : 'i'}</span><span>${esc(msg)}</span>`;
  box.appendChild(el);
  while (box.children.length > 3) box.firstChild.remove();
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 260); }, ms);
}
function setBusy(btn, busy, label = 'Menyimpan…') {
  if (!btn) return;
  btn.disabled = busy;
  if (busy) { btn.dataset.label = btn.innerHTML; btn.innerHTML = `<span class="spinner"></span> ${label}`; }
  else if (btn.dataset.label) btn.innerHTML = btn.dataset.label;
}

// ---------- Setup & mulai ----------
function showSetup() {
  $('#setup').classList.remove('hidden'); $('#app').classList.add('hidden');
  $('#setupForm').onsubmit = async e => {
    e.preventDefault();
    const url = $('#setupUrl').value.trim(), token = $('#setupToken').value.trim(), err = $('#setupErr'), btn = $('#setupBtn');
    err.textContent = '';
    if (!/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec$/.test(url)) { err.textContent = 'URL harus diawali https://script.google.com/macros/s/ dan diakhiri /exec'; return; }
    setBusy(btn, true, 'Menghubungkan…');
    try { await api('ping', {}, { url, token }); S.cfg = { url, token }; store(LS.cfg, S.cfg); toast('Terhubung! Memuat data…', 'ok'); startApp(); }
    catch (ex) { err.textContent = ex.message; } finally { setBusy(btn, false); }
  };
}
async function startApp() {
  $('#setup').classList.add('hidden'); $('#app').classList.remove('hidden');
  try { S.antrean = (await DB.all()).sort((a, b) => a.dibuat - b.dibuat); } catch (e) { S.antrean = []; }
  // Minta penyimpanan permanen agar foto antrean tidak dibersihkan browser
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  render(); sync(true);
}

$$('.nav-item').forEach(b => b.onclick = () => go(b.dataset.view));
$('#fab').onclick = () => openUploadCepat();
$('#btnSync').onclick = () => { sync(false); prosesAntrean(); };
$('#sheetBackdrop').onclick = () => closeSheet();
const setOnline = () => $('#offlineBar').classList.toggle('hidden', navigator.onLine);
window.addEventListener('online', () => { setOnline(); prosesAntrean(); sync(true); });
window.addEventListener('offline', setOnline);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible' || !S.cfg) return;
  prosesAntrean();
  if (Date.now() - S.lastSync > 60000) sync(true);
});
setOnline();
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));

if (S.cfg) startApp(); else showSetup();
