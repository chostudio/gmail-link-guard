// Gmail Link Guard v1.4
// Only active inside individual email views (URL contains a message ID).
// Uses MutationObserver to detect when Gmail renders email content — no refresh needed.

(function () {
  'use strict';

  const processed = new WeakSet();

  // ── Is the current URL an individual email? ──────────────────────────────
  // Gmail email URLs look like: /mail/u/0/#inbox/FMfcgz...
  // List/inbox views look like: /mail/u/0/#inbox  (no message ID after)
  // We consider it an email view if the hash contains a second path segment.

  function isEmailView() {
    const hash = location.hash; // e.g. "#inbox/FMfcgzQgLrv..."
    const parts = hash.replace('#', '').split('/');
    // Must have at least folder + message ID, and message ID must look substantial
    return parts.length >= 2 && parts[parts.length - 1].length > 10;
  }

  // ── Compose/editor detection ─────────────────────────────────────────────

  function isInCompose(el) {
    let node = el;
    while (node && node !== document.body) {
      if (
        node.getAttribute('role') === 'textbox' ||
        node.getAttribute('contenteditable') === 'true' ||
        node.getAttribute('g_editable') === 'true' ||
        (node.classList && (
          node.classList.contains('Am') ||
          node.classList.contains('editable') ||
          node.classList.contains('LW-avf')
        ))
      ) return true;
      node = node.parentElement;
    }
    return false;
  }

  // ── URL helpers ──────────────────────────────────────────────────────────

  function getRealUrl(href, el) {
    // data-saferedirecturl is how Gmail wraps links in notification emails
    let url = (el && el.getAttribute('data-saferedirecturl')) || href || '';
    try {
      if (url.startsWith('//')) url = 'https:' + url;
      // Unwrap Google redirect (both google.com/url?q= and related forms)
      if (url.includes('google.com/url')) {
        const q = new URL(url).searchParams.get('q');
        if (q) url = decodeURIComponent(q);
      }
    } catch (e) {}
    return url;
  }

  function getDomain(url) {
    try { return new URL(url).hostname; }
    catch (e) { return url; }
  }

  function isLikelySuspicious(url) {
    if (!url) return false;
    const checks = [
      /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/,
      /bit\.ly|tinyurl|goo\.gl|t\.co|ow\.ly|short\.link|rb\.gy|cutt\.ly|is\.gd|v\.gd|buff\.ly/,
      /[\u0400-\u04FF]/,
      /xn--/,
      /@/,
    ];
    const domain = getDomain(url).toLowerCase();
    const typosquat = ['google','gmail','paypal','amazon','apple','microsoft','facebook','netflix']
      .map(b => new RegExp(`${b}[^.]+\\.`))
      .some(p => p.test(domain));
    return checks.some(p => p.test(url)) || typosquat;
  }

  // ── Replace <a> with plain <span> ───────────────────────────────────────

  // Extract the best human-readable label from any element —
  // works for plain text, button-wrapped anchors, image-only links, etc.
  function getVisibleLabel(el) {
    const text = el.textContent.trim();
    if (text) return text;
    // Fallback: alt text from images
    const imgs = el.querySelectorAll('img[alt]');
    if (imgs.length) {
      return Array.from(imgs).map(i => i.getAttribute('alt')).filter(Boolean).join(' ').trim();
    }
    return '';
  }

  function replaceAnchor(anchor) {
    if (processed.has(anchor)) return;
    if (isInCompose(anchor)) return;

    const href = anchor.getAttribute('href') || '';
    if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;

    let displayUrl, suspicious = false;

    if (href.startsWith('mailto:')) {
      displayUrl = href.replace('mailto:', '');
    } else {
      displayUrl = getRealUrl(href, anchor);
      suspicious = isLikelySuspicious(displayUrl);
    }

    if (!displayUrl) return;

    const originalText = getVisibleLabel(anchor);
    const showOriginal = originalText && originalText !== displayUrl;

    // Detect button-style links by multiple signals:
    // - wraps a <button> or role=button element
    // - has role=button or role=link on a styled element
    // - contains table cells (HTML email CTA pattern)
    // - inline style with border-radius (pill/rounded button)
    // - class name containing 'button' or 'btn'
    // - display is block or inline-block with min-height (sized like a button)
    const inlineStyle = anchor.getAttribute('style') || '';
    const cls = anchor.className || '';
    const computedDisplay = getComputedStyle(anchor).display;
    const isButton = !!(
      anchor.querySelector('button, [role="button"]') ||
      anchor.getAttribute('role') === 'button' ||
      anchor.querySelector('td, th') ||
      /border-radius/.test(inlineStyle) ||
      /\bbtn\b|button/i.test(cls) ||
      (computedDisplay === 'block') ||
      (computedDisplay === 'inline-block' && getComputedStyle(anchor).minHeight !== '0px')
    );

    const wrapper = document.createElement('span');
    wrapper.className = 'glg-link-wrapper' + (isButton ? ' glg-button-wrapper' : '');

    if (showOriginal) {
      const label = document.createElement('span');
      label.className = 'glg-original-text' + (isButton ? ' glg-original-button' : '');
      label.textContent = originalText;
      wrapper.appendChild(label);
    }

    const span = document.createElement('span');
    span.className = 'glg-plain-url' + (suspicious ? ' glg-plain-suspicious' : '');
    span.textContent = displayUrl;
    span.dataset.glgUrl = displayUrl;
    wrapper.appendChild(span);

    anchor.parentNode.replaceChild(wrapper, anchor);
    processed.add(wrapper);
    processed.add(span);
  }

  function replaceAllLinks(root) {
    Array.from((root || document).querySelectorAll('a[href]'))
      .filter(a => !processed.has(a))
      .forEach(replaceAnchor);
  }

  // ── Sender email shown inline ────────────────────────────────────────────

  function revealSenderEmails(root) {
    const scope = root || document;
    ['span[email]', 'span.gD', '[data-hovercard-id]'].forEach(sel => {
      scope.querySelectorAll(sel).forEach(el => {
        if (processed.has(el)) return;
        const email = el.getAttribute('email') || el.getAttribute('data-hovercard-id') || '';
        if (!email || !email.includes('@')) return;
        const name = el.textContent.trim();
        if (!name || name.includes(email)) { processed.add(el); return; }
        el.textContent = name + ' <' + email + '>';
        processed.add(el);
      });
    });
  }

  // ── Click-only info panel ────────────────────────────────────────────────

  let panel = null;

  function createPanel() {
    panel = document.createElement('div');
    panel.className = 'glg-panel';
    panel.innerHTML = `
      <div class="glg-panel-inner">
        <div class="glg-panel-header">
          <span class="glg-panel-icon">🛡</span>
          <span class="glg-panel-label">LINK BLOCKED</span>
          <button class="glg-panel-close">✕</button>
        </div>
        <div class="glg-panel-url"></div>
        <div class="glg-panel-meta">
          <span class="glg-panel-domain"></span>
          <span class="glg-panel-risk"></span>
        </div>
        <div class="glg-panel-note">Copy the URL above to open it manually</div>
      </div>
    `;
    document.body.appendChild(panel);
    panel.querySelector('.glg-panel-close').addEventListener('click', e => {
      e.stopPropagation(); hidePanel();
    });
    panel.querySelector('.glg-panel-url').addEventListener('mousedown', e => e.stopPropagation());
    panel.querySelector('.glg-panel-url').addEventListener('click', e => e.stopPropagation());
  }

  function showPanel(url, event) {
    if (!panel) createPanel();
    const suspicious = isLikelySuspicious(url);

    panel.querySelector('.glg-panel-url').textContent = url;
    panel.querySelector('.glg-panel-domain').textContent = '🌐 ' + getDomain(url);
    panel.querySelector('.glg-panel-url').className =
      'glg-panel-url' + (suspicious ? ' glg-url-suspicious' : '');

    const riskEl = panel.querySelector('.glg-panel-risk');
    riskEl.textContent = suspicious ? '⚠️ SUSPICIOUS' : '✓ Looks OK';
    riskEl.className = 'glg-panel-risk ' + (suspicious ? 'glg-risk-warn' : 'glg-risk-ok');

    positionPanel(event);
    panel.classList.add('glg-visible');
  }

  function positionPanel(event) {
    const margin = 14, vw = window.innerWidth, vh = window.innerHeight;
    panel.style.visibility = 'hidden';
    panel.style.display = 'block';
    const pw = panel.offsetWidth, ph = panel.offsetHeight;
    panel.style.display = '';
    panel.style.visibility = '';
    let x = event.clientX + margin, y = event.clientY + margin;
    if (x + pw > vw - margin) x = event.clientX - pw - margin;
    if (y + ph > vh - margin) y = event.clientY - ph - margin;
    if (x < margin) x = margin;
    if (y < margin) y = margin;
    panel.style.left = x + 'px';
    panel.style.top = y + 'px';
  }

  function hidePanel() {
    panel?.classList.remove('glg-visible');
  }

  // ── Global click handler ─────────────────────────────────────────────────

  document.addEventListener('click', (e) => {
    // Close panel on outside click
    if (panel?.classList.contains('glg-visible') && !panel.contains(e.target)) {
      hidePanel();
      return;
    }
    // Catch any <a> tags that survived (Gmail re-renders)
    const anchor = e.target.closest('a[href]');
    if (anchor && !isInCompose(anchor)) {
      e.preventDefault();
      e.stopImmediatePropagation();
      replaceAnchor(anchor);
      return;
    }
    // Click on replaced URL span
    const span = e.target.closest('.glg-plain-url[data-glg-url]');
    if (span) {
      e.stopPropagation();
      showPanel(span.dataset.glgUrl, e);
    }
  }, true);

  document.addEventListener('auxclick', (e) => {
    const anchor = e.target.closest('a[href]');
    if (anchor) { e.preventDefault(); e.stopImmediatePropagation(); }
  }, true);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const anchor = document.activeElement?.closest?.('a[href]');
      if (anchor && !isInCompose(anchor)) {
        e.preventDefault(); e.stopImmediatePropagation();
      }
    }
  }, true);

  // ── SPA navigation + email body watcher ─────────────────────────────────
  // Strategy:
  // 1. Watch for URL hash changes (Gmail's SPA navigation).
  // 2. When we land on an email view, wait for the email body to appear
  //    in the DOM, then process it.
  // 3. Also watch the email body container for any lazy-loaded content.

  let emailBodyObserver = null;
  let currentHash = location.hash;

  // Gmail's email body lives inside a container with role="main",
  // and the actual message content is inside .a3s or [data-message-id] divs.
  const EMAIL_BODY_SELECTORS = [
    '.a3s',           // primary message body
    '.ii.gt',         // another Gmail body wrapper
    '[data-message-id]', // message containers
  ];

  function processEmailContent() {
    if (!isEmailView()) return;

    // Run on whole document for sender reveals (header is outside body)
    revealSenderEmails(document);

    // Find and process all email body containers
    EMAIL_BODY_SELECTORS.forEach(sel => {
      document.querySelectorAll(sel).forEach(container => {
        replaceAllLinks(container);
      });
    });
  }

  // Watch for the email body to appear after SPA navigation
  function waitForEmailBody() {
    if (!isEmailView()) return;

    // Kill any existing body observer
    if (emailBodyObserver) { emailBodyObserver.disconnect(); emailBodyObserver = null; }

    // Check if body already present
    const alreadyHere = EMAIL_BODY_SELECTORS.some(sel => document.querySelector(sel));
    if (alreadyHere) {
      processEmailContent();
    }

    // Watch for it to appear
    emailBodyObserver = new MutationObserver(() => {
      const found = EMAIL_BODY_SELECTORS.some(sel => document.querySelector(sel));
      if (found) {
        processEmailContent();
        // Keep watching for lazy-loaded content (quoted threads, etc.)
      }
    });
    emailBodyObserver.observe(document.body, { childList: true, subtree: true });
  }

  // Poll for hash changes (hashchange event isn't always reliable in Gmail)
  setInterval(() => {
    if (location.hash !== currentHash) {
      currentHash = location.hash;
      if (isEmailView()) {
        // Small delay to let Gmail start rendering
        setTimeout(waitForEmailBody, 200);
      } else {
        // Left email view — stop body observer
        if (emailBodyObserver) { emailBodyObserver.disconnect(); emailBodyObserver = null; }
        hidePanel();
      }
    }
  }, 300);

  // Also listen for hashchange as a faster signal
  window.addEventListener('hashchange', () => {
    currentHash = location.hash;
    if (isEmailView()) {
      setTimeout(waitForEmailBody, 200);
    } else {
      if (emailBodyObserver) { emailBodyObserver.disconnect(); emailBodyObserver = null; }
      hidePanel();
    }
  });

  // Initial load — if page loads directly on an email URL, run immediately
  if (isEmailView()) {
    waitForEmailBody();
  }

})();
