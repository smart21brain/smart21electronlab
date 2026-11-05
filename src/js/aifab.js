/* ---------------------------------------------------------------
   Smart21 ElectroLab — floating AI assistant (bottom-right corner)
   A small chat window available on every page. It uses the very same
   tutor engine and chat history as the full "AI Tutor" page
   (offline tutor, or Claude / OpenAI-compatible / Ollama if connected).
   --------------------------------------------------------------- */
(function () {
  'use strict';
  const S21 = window.S21;
  const $ = (s, r) => (r || document).querySelector(s);
  const Fab = { open: false };
  S21.AiFab = Fab;

  const T = () => S21.Tutor;
  let root, panel, btn, stage, thread, welcome, input, sendBtn, ctx;

  /* ---------- rendering ---------- */
  function addMsg(m, typing) {
    const d = document.createElement('div'); d.className = 'msg ' + (m.r === 'u' ? 'user' : 'ai');
    if (m.r === 'u') { d.innerHTML = '<div class="bubble"></div>'; d.firstChild.textContent = m.t; }
    else {
      d.innerHTML = '<img class="av" src="img/logo-64.png" alt=""><div class="bubble"></div>';
      const b = d.lastChild;
      if (typing) b.innerHTML = '<span class="typing"><span></span><span></span><span></span></span>'; else { b.innerHTML = T().md(m.t); T().decorate(b); }
    }
    thread.appendChild(d); return d;
  }
  function scrollDown() { stage.scrollTop = stage.scrollHeight; }
  function render() {
    const c = T().cur; thread.innerHTML = '';
    const has = !!(c && c.msgs.length);
    welcome.style.display = has ? 'none' : '';
    if (has) c.msgs.forEach(m => addMsg(m));
    scrollDown();
  }
  function setBusy(b) {
    sendBtn.innerHTML = '<svg class="ic"><use href="#' + (b ? 'i-stopai' : 'i-send') + '"/></svg>';
    sendBtn.dataset.busy = b ? '1' : ''; sendBtn.disabled = b ? false : !input.value.trim();
  }

  /* ---------- sending ---------- */
  async function send(text) {
    text = (text || '').trim(); const tutor = T();
    if (!text || tutor.busy) return;
    const chat = tutor.cur || tutor.newChat();
    chat.msgs.push({ r: 'u', t: text }); if (chat.title === 'New chat') chat.title = text.slice(0, 48); chat.ts = Date.now();
    welcome.style.display = 'none'; addMsg(chat.msgs[chat.msgs.length - 1]);
    const reply = { r: 'a', t: '' }; chat.msgs.push(reply);
    const bub = addMsg(reply, true).querySelector('.bubble'); scrollDown(); setBusy(true);
    await tutor.respond(chat, text, '', ctx.checked, reply, bub);
    setBusy(false); scrollDown();
  }

  /* ---------- open / close ---------- */
  function setOpen(on, focus) {
    Fab.open = !!on; root.dataset.open = on ? '1' : '0'; panel.hidden = !on; btn.setAttribute('aria-expanded', on ? 'true' : 'false');
    btn.setAttribute('aria-label', on ? 'Close AI Tutor' : 'Open AI Tutor');
    if (on) { render(); if (focus !== false) setTimeout(() => input.focus(), 60); } else if (focus) btn.focus();
  }
  Fab.toggle = () => setOpen(!Fab.open, true);
  Fab.openWith = text => { setOpen(true); if (text) send(text); };
  // hide the button on the full AI page (it would be redundant there)
  Fab.sync = function (view) { document.body.dataset.view = view; root.hidden = view === 'ai'; if (view === 'ai' && Fab.open) setOpen(false); };

  function init() {
    root = $('#aiFab'); panel = $('#fabPanel'); btn = $('#fabBtn'); stage = $('#fabStage'); thread = $('#fabThread');
    welcome = $('#fabWelcome'); input = $('#fabInput'); sendBtn = $('#fabSend'); ctx = $('#fabCtx');
    if (!root) return;

    const h = new Date().getHours(); $('#fabGreet').textContent = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
    $('#fabChips').innerHTML = T().CARDS.slice(0, 4).map((c, i) => '<button type="button" class="fab-chip" data-i="' + i + '">' + c[0] + ' ' + c[1] + '</button>').join('');
    $('#fabChips').addEventListener('click', e => { const b = e.target.closest('.fab-chip'); if (b) send(T().CARDS[+b.dataset.i][3]); });

    btn.addEventListener('click', Fab.toggle);
    $('#fabClose').addEventListener('click', () => setOpen(false, true));
    $('#fabNew').addEventListener('click', () => { if (T().busy) return; T().newChat(); render(); input.focus(); });
    $('#fabExpand').addEventListener('click', () => { setOpen(false); S21.App.show('ai'); });
    panel.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false, true); } });

    input.addEventListener('input', () => { input.style.height = 'auto'; input.style.height = Math.min(110, input.scrollHeight) + 'px'; if (!T().busy) sendBtn.disabled = !input.value.trim(); });
    input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('#fabForm').requestSubmit(); } });
    $('#fabForm').addEventListener('submit', e => {
      e.preventDefault();
      if (T().busy) { T().stop(); setBusy(false); return; }
      const t = input.value; input.value = ''; input.style.height = 'auto'; setBusy(false); send(t);
    });

    // streamed answers keep the newest text in view
    new MutationObserver(() => { if (Fab.open && stage.scrollHeight - stage.scrollTop - stage.clientHeight < 140) scrollDown(); }).observe(thread, { childList: true, subtree: true, characterData: true });

    // engine label (offline / Claude / local model)
    const setLabel = l => { $('#fabEngine').textContent = l || 'Smart21 Tutor · offline'; };
    T().onEngine.push(setLabel); setLabel(T().engineLabel);
    Fab.sync((S21.App && S21.App.view) || 'home');
  }
  Fab.init = init;
})();
