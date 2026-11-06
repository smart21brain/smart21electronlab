'use strict';
const { app, BrowserWindow, Menu, ipcMain, dialog, shell, safeStorage, nativeTheme } = require('electron');
const path = require('path');
const fs = require('fs');

let win = null;
const aiJobs = new Map();            // request id -> AbortController

/* ----------------------------- settings ----------------------------- */
const settingsFile = () => path.join(app.getPath('userData'), 'settings.json');
function readSettings() {
  try { return JSON.parse(fs.readFileSync(settingsFile(), 'utf8')); } catch (_) { return {}; }
}
function writeSettings(s) { fs.mkdirSync(path.dirname(settingsFile()), { recursive: true }); fs.writeFileSync(settingsFile(), JSON.stringify(s, null, 2), { mode: 0o600 }); }
function getKey(s) {
  if (!s.key) return '';
  try { return s.keyEnc ? safeStorage.decryptString(Buffer.from(s.key, 'base64')) : s.key; } catch (_) { return ''; }
}

ipcMain.handle('app:version', () => app.getVersion());
ipcMain.handle('settings:get', () => {
  const s = readSettings();
  return { provider: s.provider || 'offline', model: s.model || '', base: s.base || '', hasKey: !!s.key, encrypted: safeStorage.isEncryptionAvailable() };
});
ipcMain.handle('settings:set', (_e, patch) => {
  try {
    const s = readSettings();
    if (patch && typeof patch === 'object') {
      if (['offline', 'anthropic', 'openai'].includes(patch.provider)) s.provider = patch.provider;
      if (typeof patch.model === 'string') s.model = patch.model.slice(0, 120);
      if (typeof patch.base === 'string') s.base = patch.base.slice(0, 300);
      if (patch.clearKey) { delete s.key; delete s.keyEnc; }
      if (typeof patch.key === 'string' && patch.key) {
        if (safeStorage.isEncryptionAvailable()) { s.key = safeStorage.encryptString(patch.key).toString('base64'); s.keyEnc = true; }
        else { s.key = patch.key; s.keyEnc = false; }
      }
    }
    writeSettings(s);
    return { ok: true };
  } catch (e) { return { ok: false, error: e.message }; }
});

/* ----------------------------- projects ----------------------------- */
ipcMain.handle('project:save', async (_e, json) => {
  const r = await dialog.showSaveDialog(win, { title: 'Save project', defaultPath: 'circuit.s21lab', filters: [{ name: 'ElectroLab project', extensions: ['s21lab'] }] });
  if (r.canceled || !r.filePath) return { ok: false };
  fs.writeFileSync(r.filePath, json, 'utf8');
  return { ok: true, name: path.basename(r.filePath) };
});
// generic save for exports: PNG (base64), CSV, SPICE netlist, certificate …
ipcMain.handle('file:save', async (_e, opts) => {
  opts = opts || {};
  const name = String(opts.name || 'export.txt').replace(/[\\/:*?"<>|]/g, '_').slice(0, 80);
  const ext = path.extname(name).replace('.', '') || 'txt';
  const r = await dialog.showSaveDialog(win, { title: 'Save', defaultPath: name, filters: [{ name: ext.toUpperCase() + ' file', extensions: [ext] }] });
  if (r.canceled || !r.filePath) return { ok: false };
  const data = opts.encoding === 'base64' ? Buffer.from(String(opts.data || ''), 'base64') : String(opts.data || '');
  if (data.length > 50 * 1024 * 1024) return { ok: false, error: 'File too large' };
  fs.writeFileSync(r.filePath, data);
  return { ok: true, name: path.basename(r.filePath) };
});
// circuit report: render the HTML in a hidden, script-free window and print it to a PDF
ipcMain.handle('report:pdf', async (_e, html, name) => {
  const os = require('os');
  const file = path.join(os.tmpdir(), 'smart21-report-' + Date.now() + '.html');
  let w = null;
  try {
    if (String(html).length > 40 * 1024 * 1024) return { ok: false, error: 'Report too large' };
    fs.writeFileSync(file, String(html), 'utf8');
    w = new BrowserWindow({ show: false, webPreferences: { sandbox: true, javascript: false, contextIsolation: true } });
    await w.loadFile(file);
    const pdf = await w.webContents.printToPDF({ pageSize: 'A4', printBackground: true });
    const safe = String(name || 'circuit-report.pdf').replace(/[\\/:*?"<>|]/g, '_').slice(0, 80);
    const r = await dialog.showSaveDialog(win, { title: 'Save report', defaultPath: safe, filters: [{ name: 'PDF', extensions: ['pdf'] }] });
    if (r.canceled || !r.filePath) return { ok: false };
    fs.writeFileSync(r.filePath, pdf);
    return { ok: true, name: path.basename(r.filePath) };
  } catch (e) { return { ok: false, error: e.message }; }
  finally { try { if (w) w.destroy(); } catch (_) {} try { fs.unlinkSync(file); } catch (_) {} }
});
ipcMain.handle('project:open', async () => {
  const r = await dialog.showOpenDialog(win, { title: 'Open project', properties: ['openFile'], filters: [{ name: 'ElectroLab project', extensions: ['s21lab', 'json'] }] });
  if (r.canceled || !r.filePaths[0]) return { ok: false };
  const st = fs.statSync(r.filePaths[0]);
  if (st.size > 5 * 1024 * 1024) return { ok: false, error: 'File too large' };
  return { ok: true, name: path.basename(r.filePaths[0]), data: fs.readFileSync(r.filePaths[0], 'utf8') };
});

ipcMain.handle('sketch:export', async (_e, code) => {
  const r = await dialog.showSaveDialog(win, { title: 'Export sketch', defaultPath: 'sketch.ino', filters: [{ name: 'Arduino sketch', extensions: ['ino'] }] });
  if (r.canceled || !r.filePath) return { ok: false };
  fs.writeFileSync(r.filePath, code, 'utf8');
  return { ok: true, name: path.basename(r.filePath) };
});
ipcMain.handle('sketch:import', async () => {
  const r = await dialog.showOpenDialog(win, { title: 'Import sketch', properties: ['openFile'], filters: [{ name: 'Arduino sketch', extensions: ['ino', 'txt', 'cpp'] }] });
  if (r.canceled || !r.filePaths[0]) return { ok: false };
  if (fs.statSync(r.filePaths[0]).size > 1024 * 1024) return { ok: false, error: 'That file is too large for a sketch.' };
  return { ok: true, data: fs.readFileSync(r.filePaths[0], 'utf8') };
});

/* ----------------------------- AI streaming ----------------------------- */
function send(ev) { if (win && !win.isDestroyed()) win.webContents.send('ai:event', ev); }

async function readSSE(res, onData, signal) {
  const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = '';
  for (;;) {
    if (signal.aborted) { try { await reader.cancel(); } catch (_) {} return; }
    const { done, value } = await reader.read(); if (done) break;
    buf += dec.decode(value, { stream: true });
    let i; while ((i = buf.indexOf('\n')) >= 0) { const line = buf.slice(0, i).replace(/\r$/, ''); buf = buf.slice(i + 1); if (line.startsWith('data:')) onData(line.slice(5).trim()); }
  }
}

ipcMain.on('ai:start', async (_e, req) => {
  const id = req && req.id; if (typeof id !== 'number') return;
  const ctl = new AbortController(); aiJobs.set(id, ctl);
  try {
    const s = readSettings(), key = getKey(s);
    const provider = ['anthropic', 'openai'].includes(req.provider) ? req.provider : s.provider;
    const model = String(req.model || s.model || '').trim();
    const messages = (Array.isArray(req.messages) ? req.messages : []).slice(-20).map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content || '').slice(0, 24000) }));
    if (!messages.length) throw new Error('Nothing to send.');
    const system = String(req.system || '').slice(0, 12000);
    let res;
    if (provider === 'anthropic') {
      if (!key) throw new Error('No API key saved for Anthropic.');
      res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST', signal: ctl.signal,
        headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: model || 'claude-sonnet-5-5', max_tokens: 2500, system, messages, stream: true })
      });
    } else {
      let base = String(req.base || s.base || 'https://api.openai.com/v1').replace(/\/+$/, '');
      if (!/^https?:\/\//i.test(base)) throw new Error('The base URL must start with http:// or https://');
      const local = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])/i.test(base);
      if (!key && !local) throw new Error('No API key saved.');
      if (!model) throw new Error('Enter a model name in Settings.');
      const headers = { 'content-type': 'application/json' }; if (key) headers.authorization = 'Bearer ' + key;
      res = await fetch(base + '/chat/completions', { method: 'POST', signal: ctl.signal, headers, body: JSON.stringify({ model, messages: [{ role: 'system', content: system }, ...messages], stream: true, max_tokens: 2500 }) });
    }
    if (!res.ok) {
      let detail = ''; try { const j = await res.json(); detail = (j.error && (j.error.message || j.error)) || JSON.stringify(j).slice(0, 200); } catch (_) {}
      throw new Error('The AI service answered ' + res.status + (detail ? ': ' + detail : ''));
    }
    await readSSE(res, data => {
      if (!data || data === '[DONE]') return;
      let j; try { j = JSON.parse(data); } catch (_) { return; }
      if (provider === 'anthropic') {
        if (j.type === 'content_block_delta' && j.delta && j.delta.type === 'text_delta') send({ id, type: 'chunk', text: j.delta.text });
        else if (j.type === 'error') throw new Error((j.error && j.error.message) || 'Stream error');
      } else {
        const d = j.choices && j.choices[0] && j.choices[0].delta; if (d && d.content) send({ id, type: 'chunk', text: d.content });
      }
    }, ctl.signal);
    send({ id, type: 'done' });
  } catch (e) {
    if (ctl.signal.aborted) send({ id, type: 'done' });
    else send({ id, type: 'error', message: e && e.cause && e.cause.code === 'ECONNREFUSED' ? 'Could not connect. Is the local model server running?' : (e.message || String(e)) });
  } finally { aiJobs.delete(id); }
});
ipcMain.on('ai:abort', (_e, id) => { const c = aiJobs.get(id); if (c) c.abort(); });

/* ----------------------------- window / menu ----------------------------- */
function menu() {
  const act = a => () => win && win.webContents.send('menu:action', a);
  const t = [
    { label: 'File', submenu: [
      { label: 'New project', accelerator: 'CmdOrCtrl+N', click: act('new') }, { label: 'Open…', accelerator: 'CmdOrCtrl+O', click: act('open') },
      { label: 'Save…', accelerator: 'CmdOrCtrl+S', click: act('save') }, { type: 'separator' }, { role: 'quit' }] },
    { label: 'Simulation', submenu: [{ label: 'Run / Pause', accelerator: 'F5', click: act('run') }, { label: 'Stop', accelerator: 'Shift+F5', click: act('stop') }] },
    { label: 'Go', submenu: [{ label: 'Home', accelerator: 'CmdOrCtrl+0', click: act('view:home') }, { label: 'Circuit Lab', accelerator: 'CmdOrCtrl+1', click: act('view:lab') }, { label: 'Lessons', accelerator: 'CmdOrCtrl+2', click: act('view:learn') }, { label: 'Challenges', accelerator: 'CmdOrCtrl+3', click: act('view:challenges') }, { label: 'AI Tutor', accelerator: 'CmdOrCtrl+4', click: act('view:ai') }, { label: 'Settings', accelerator: 'CmdOrCtrl+5', click: act('view:settings') }] },
    { label: 'Help', submenu: [{ label: 'Take the tour', click: act('tour') }, { label: 'Examples gallery', click: act('gallery') }] },
    { label: 'View', submenu: [{ role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' }, { role: 'togglefullscreen' }, { role: 'toggleDevTools' }] }
  ];
  if (process.platform === 'darwin') t.unshift({ role: 'appMenu' });
  Menu.setApplicationMenu(Menu.buildFromTemplate(t));
}

let splash = null;
function createSplash() {
  splash = new BrowserWindow({
    width: 420, height: 500, frame: false, resizable: false, movable: false,
    alwaysOnTop: true, show: false, center: true, skipTaskbar: true,
    backgroundColor: '#000000',
    icon: path.join(__dirname, 'src', 'img', 'appicon-512.png'),
    webPreferences: { contextIsolation: true, nodeIntegration: false }
  });
  // Same logo as the window / taskbar icon (src/img/appicon-512.png), embedded so it always loads
  let logo = '';
  try { logo = 'data:image/png;base64,' + fs.readFileSync(path.join(__dirname, 'src', 'img', 'appicon-512.png')).toString('base64'); } catch (e) { /* splash still shows the ring */ }
  const html = `<!doctype html><meta charset="utf-8"><style>
    html,body{margin:0;height:100%;overflow:hidden;background:#000;font-family:'Segoe UI',Arial,sans-serif;user-select:none}
    body{display:flex;flex-direction:column;align-items:center;justify-content:space-between;padding:70px 0 44px;box-sizing:border-box}
    .stage{position:relative;width:240px;height:240px;flex:none}
    .stage img{position:absolute;inset:26px;width:188px;height:188px;object-fit:contain}
    .stage svg{position:absolute;inset:0;width:100%;height:100%}
    .spin{transform-origin:120px 120px;animation:r 1.6s linear infinite}
    @keyframes r{to{transform:rotate(360deg)}}
    .pw{text-align:center;color:#9aa3a0;font-size:14px;letter-spacing:.4px}
    .pw b{display:block;margin-top:4px;color:#fff;font-size:18px;font-weight:600;letter-spacing:.6px}
    .pw b span{color:#FFC93C}
  </style>
  <div class="stage">
    <svg viewBox="0 0 240 240">
      <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#21C03A"/><stop offset="1" stop-color="#FFB800"/></linearGradient></defs>
      <circle cx="120" cy="120" r="108" fill="none" stroke="#3a403e" stroke-width="2"/>
      <g class="spin"><circle cx="120" cy="120" r="108" fill="none" stroke="url(#g)" stroke-width="12" stroke-linecap="round" stroke-dasharray="500 679" transform="rotate(-90 120 120)"/></g>
    </svg>
    <img src="${logo}">
  </div>
  <div class="pw">Powered by<b>Smart21<span>Brain</span></b></div>`;
  splash.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
  splash.once('ready-to-show', () => splash && splash.show());
}

function createWindow() {
  const started = Date.now();
  win = new BrowserWindow({
    width: 1480, height: 920, minWidth: 1050, minHeight: 680, title: 'Smart21 ElectroLab', icon: path.join(__dirname, 'src', 'img', 'appicon-512.png'),
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#0e1411' : '#f4f8f5', show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true, spellcheck: false }
  });
  win.once('ready-to-show', () => {
    const wait = Math.max(0, 1400 - (Date.now() - started));   // keep the splash up for at least ~1.4 s
    setTimeout(() => {
      if (splash) { splash.destroy(); splash = null; }
      if (win && !win.isDestroyed()) win.show();
    }, wait);
  });
  win.loadFile(path.join(__dirname, 'src', 'index.html'));
  // the app never navigates away; external links open in the browser
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('file://')) { e.preventDefault(); if (/^https?:/i.test(url)) shell.openExternal(url); } });
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/i.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.on('closed', () => { win = null; });
}

/* ---- double-clicking a .s21lab file opens it in the app (Windows / Linux: command line, macOS: open-file) ---- */
let pendingOpen = null;
function readProjectFile(p) {
  try {
    if (!p || !/\.s21lab$/i.test(p) || !fs.existsSync(p)) return null;
    const st = fs.statSync(p); if (!st.isFile() || st.size > 5 * 1024 * 1024) return null;
    return { name: path.basename(p), data: fs.readFileSync(p, 'utf8') };
  } catch (_) { return null; }
}
function fileFromArgv(argv) { for (const a of argv.slice(1)) { const r = readProjectFile(a); if (r) return r; } return null; }
function deliver(r) { if (!r) return; if (win && !win.isDestroyed()) { if (win.isMinimized()) win.restore(); win.focus(); win.webContents.send('project:opened', r); } else pendingOpen = r; }
ipcMain.handle('project:pending', () => { const r = pendingOpen; pendingOpen = null; return r; });
app.on('open-file', (e, p) => { e.preventDefault(); deliver(readProjectFile(p)); });
pendingOpen = fileFromArgv(process.argv);

const lock = app.requestSingleInstanceLock();
if (!lock) app.quit();
else {
  app.on('second-instance', (_e, argv) => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } deliver(fileFromArgv(argv)); });
  app.whenReady().then(() => { menu(); createSplash(); createWindow(); app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); }); });
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
}
