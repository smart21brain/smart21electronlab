/* ---------------------------------------------------------------
   Smart21 ElectroLab — printable circuit report (picture, parts list, notes, sketch) saved as PDF
   --------------------------------------------------------------- */
(function (root) {
  'use strict';
  const S21 = root.S21 = root.S21 || {};
  const Report = {}; S21.Report = Report;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // o: { title, author, notes, date, svgText (trusted: made by the app), parts [{qty, refs[], name, value, note}], sketch, checks [text] }
  Report.html = function (o) {
    const title = esc(o.title || 'Circuit report'), parts = o.parts || [], total = parts.reduce((a, r) => a + r.qty, 0);
    const fig = o.svgText ? '<figure class="fig">' + String(o.svgText).replace(/<\?xml[^>]*\?>/, '').replace(/ width="[\d.]+"/, ' width="100%"').replace(/ height="[\d.]+"/, '') + '<figcaption>Circuit diagram</figcaption></figure>' : '';
    return '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>' + title + '</title><style>' +
      '@page{size:A4;margin:16mm 14mm}*{box-sizing:border-box}body{font:11pt/1.45 "Segoe UI",Helvetica,Arial,sans-serif;color:#1b2420;margin:0}' +
      'h1{font-size:22pt;margin:0 0 2mm;color:#0f5a43}h2{font-size:13pt;margin:7mm 0 2mm;color:#0f5a43;border-bottom:1px solid #cfe0d8;padding-bottom:1mm}' +
      '.meta{color:#5a6b64;font-size:10pt;margin-bottom:4mm}.fig{margin:0;border:1px solid #cfe0d8;border-radius:6px;padding:4mm;background:#fff;text-align:center;break-inside:avoid}.fig svg{max-width:100%;max-height:150mm;height:auto}.fig figcaption{font-size:9pt;color:#5a6b64;margin-top:2mm}' +
      'table{width:100%;border-collapse:collapse;font-size:10pt}th{text-align:left;background:#eef6f2;border-bottom:1.5px solid #9cc4b3;padding:2mm 3mm}td{padding:1.6mm 3mm;border-bottom:1px solid #dde8e2;vertical-align:top}td.m{font-family:Consolas,monospace}' +
      '.notes{white-space:pre-wrap;background:#f7faf8;border-left:3px solid #2fbf8a;padding:3mm 4mm}pre{font:9pt/1.35 Consolas,"DejaVu Sans Mono",monospace;background:#f4f6f5;border:1px solid #dfe7e3;border-radius:4px;padding:3mm;white-space:pre-wrap;word-break:break-word}' +
      'ul{margin:0;padding-left:5mm}.foot{margin-top:8mm;font-size:8.5pt;color:#7a8a83;border-top:1px solid #dde8e2;padding-top:2mm}' +
      '</style></head><body><h1>' + title + '</h1><div class="meta">' + (o.author ? esc(o.author) + ' · ' : '') + esc(o.date || '') + '</div>' + fig +
      (o.notes && String(o.notes).trim() ? '<h2>Notes</h2><div class="notes">' + esc(String(o.notes).trim()) + '</div>' : '') +
      (parts.length ? '<h2>Parts list (' + total + ' part' + (total === 1 ? '' : 's') + ')</h2><table><thead><tr><th>Qty</th><th>Reference</th><th>Part</th><th>Value</th><th>Notes</th></tr></thead><tbody>' + parts.map(r => '<tr><td>' + r.qty + '</td><td class="m">' + esc(r.refs.join(', ')) + '</td><td>' + esc(r.name) + '</td><td>' + esc(r.value) + '</td><td>' + esc(r.note) + '</td></tr>').join('') + '</tbody></table>' : '') +
      (o.checks && o.checks.length ? '<h2>Circuit check</h2><ul>' + o.checks.map(c => '<li>' + esc(c) + '</li>').join('') + '</ul>' : '') +
      (o.sketch && String(o.sketch).trim() ? '<h2>Arduino sketch</h2><pre>' + esc(o.sketch) + '</pre>' : '') +
      '<div class="foot">Made with Smart21 ElectroLab</div></body></html>';
  };
  Report.fileName = t => (String(t || 'circuit-report').trim().replace(/[^\w\- ]+/g, '').replace(/\s+/g, '-').slice(0, 40) || 'circuit-report') + '.pdf';

  /* ---------- dialog ---------- */
  Report.open = function () {
    const Tools = S21.Tools, lab = S21.Lab, circ = lab.editor.circuit;
    if (!circ.parts.length) { lab.toast('The canvas is empty: build a circuit first.', 'warn'); return; }
    const hasSketch = !!circ.parts.find(p => p.type === 'arduino'), dflt = S21.Examples.list.find(e => e.id === 'blink');
    const m = Tools.modal({
      title: 'Circuit report (PDF)',
      body: '<p class="soft">A one-page-style report for homework, a lab book or a project file: the circuit picture, parts list, your notes' + (hasSketch ? ' and the Arduino sketch' : '') + '.</p>' +
        '<div class="form-grid"><label>Title<input id="repTitle" type="text" maxlength="80" value="My circuit"></label><label>Name (optional)<input id="repAuthor" type="text" maxlength="60" placeholder="Your name or class"></label></div>' +
        '<label style="margin-top:.6rem">Notes: what does it do, what did you learn?<textarea id="repNotes" rows="4" style="padding:.5rem;border-radius:8px;border:1px solid var(--line);background:var(--bg);color:var(--text);font:inherit"></textarea></label>' +
        '<label class="chk"><input type="checkbox" id="repParts" checked> Include the parts list</label>' + (hasSketch ? '<label class="chk"><input type="checkbox" id="repCode" checked> Include the Arduino sketch</label>' : '') + '<label class="chk"><input type="checkbox" id="repCheck" checked> Include the circuit check results</label>',
      actions: [{ label: 'Cancel', onClick: a => a.close() }, { label: (window.s21 && window.s21.exportPdf) ? 'Save PDF…' : 'Print / Save as PDF…', primary: true, onClick: async a => {
        const v = id => { const e = a.body.querySelector(id); return e ? e : null; };
        try {
          const r = Tools.circuitSvgText(circ, { background: '#ffffff', wireColor: null, live: false });
          let checks = []; if (v('#repCheck').checked && S21.Doctor) { try { const st = S21.Doctor.analyze(circ); let dyn = []; try { dyn = S21.Doctor.analyzeRun(circ, lab.sketch || ''); } catch (_) {} const seen = new Set(); checks = st.concat(dyn).filter(f => !seen.has(f.id) && seen.add(f.id)).sort((a, b) => S21.Doctor.SEV[a.sev] - S21.Doctor.SEV[b.sev]).map(f => f.sev.toUpperCase() + ': ' + f.title); if (!checks.length) checks = ['No problems found.']; } catch (_) { checks = []; } }
          const html = Report.html({ title: v('#repTitle').value, author: v('#repAuthor').value, notes: v('#repNotes').value, date: new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }), svgText: r.svgText,
            parts: v('#repParts').checked ? S21.Export.partsList(circ) : [], sketch: v('#repCode') && v('#repCode').checked ? lab.sketch : '', checks });
          const name = Report.fileName(v('#repTitle').value);
          if (window.s21 && window.s21.exportPdf) { const res = await window.s21.exportPdf(html, name); if (res && res.ok) { lab.toast('Saved ' + res.name, ''); a.close(); } else if (res && res.error) lab.toast(res.error, 'error'); return; }
          const f = document.createElement('iframe'); f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'; document.body.appendChild(f);
          f.contentDocument.open(); f.contentDocument.write(html); f.contentDocument.close();
          setTimeout(() => { f.contentWindow.focus(); f.contentWindow.print(); setTimeout(() => f.remove(), 2000); }, 300); a.close();
        } catch (e) { lab.toast('Could not make the report: ' + e.message, 'error'); }
      } }]
    });
    S21.Stats && S21.Stats.mark && S21.Stats.mark('exports', 'report');
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = Report;
})(typeof window !== 'undefined' ? window : globalThis);
