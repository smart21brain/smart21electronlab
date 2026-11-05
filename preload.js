'use strict';
// The renderer has no Node access. It only gets this small, explicit API.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('s21', {
  version: () => ipcRenderer.invoke('app:version'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (s) => ipcRenderer.invoke('settings:set', s),
  saveProject: (json) => ipcRenderer.invoke('project:save', String(json)),
  openProject: () => ipcRenderer.invoke('project:open'),
  takePendingOpen: () => ipcRenderer.invoke('project:pending'),
  onOpenProject: (cb) => { ipcRenderer.on('project:opened', (_e, r) => cb(r)); },
  saveFile: (opts) => ipcRenderer.invoke('file:save', { name: String(opts.name), data: String(opts.data), encoding: opts.encoding === 'base64' ? 'base64' : 'utf8' }),
  exportPdf: (html, name) => ipcRenderer.invoke('report:pdf', String(html), String(name)),
  exportSketch: (code) => ipcRenderer.invoke('sketch:export', String(code)),
  importSketch: () => ipcRenderer.invoke('sketch:import'),
  aiStart: (req) => ipcRenderer.send('ai:start', req),
  aiAbort: (id) => ipcRenderer.send('ai:abort', id),
  onAi: (cb) => { ipcRenderer.on('ai:event', (_e, ev) => cb(ev)); },
  onMenu: (cb) => { ipcRenderer.on('menu:action', (_e, a) => cb(a)); }
});
