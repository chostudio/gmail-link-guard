// Gmail Link Guard v1.3

(function () {
  'use strict';

  const processed = new WeakSet();

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

  function getRealUrl(href) {
    let url = href || '';
    try {
      if (url.startsWith('//')) url = 'https:' + url;
      if (url.includes('google.com/url')) {
        const q = new URL(url).searchParams.get('q');
        if (q) url = q;
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

  // ── Feature 1: Replace <a> tags with plain <span> showing the URL ────────
  // The entire anchor element is removed from the DOM and replaced with
  // a plain non-interactive span. No <a> remains — no hover, no click.

  function replaceAnchorWithPlainText(anchor) {
    if (processed.has(anchor)) return;
    if (isInCompose(anchor)) return;

    const href = anchor.getAttribute('href') || anchor.getAttribute('data-url') || '';
    if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;

    // mailto: keep as-is but still kill the link
    if (href.startsWith('mailto:')) {
      // Replace with plain text of the email address
      const email = href.replace('mailto:', '');
      const span = document.createElement('span');
      span.className = 'glg-plain-url';
      span.textContent = email;
      anchor.parentNode.replaceChild(span, anchor);
      processed.add(span);
      return;
    }

    const url = getRealUrl(href);
    if (!url) return;

    const suspicious = isLikelySuspicious(url);

    const span = document.createElement('span');
    span.className = 'glg-plain-url' + (suspicious ? ' glg-plain-suspicious' : '');
    span.textContent = url;
    // Store URL for click handler
    span.dataset.glgUrl = url;

    anchor.parentNode.replaceChild(span, anchor);
    processed.add(span);
  }

  function replaceAllLinks(root) {
    // querySelectorAll returns a static list — safe to iterate while mutating
    const anchors = Array.from((root || document).querySelectorAll('a[href]'));
    anchors.forEach(a => {
      if (!processed.has(a)) replaceAnchorWithPlainText(a);
    });
  }

  // ── Feature 2: Sender email shown inline ────────────────────────────────

  function revealSenderEmails(root) {
    const scope = root || document;

    // Gmail's sender name spans carry the email in an attribute.
    // We rewrite the text content of the span itself to include it,
    // rather than inserting a sibling (which caused overlap).
    const selectors = ['span[email]', 'span.gD', '[data-hovercard-id]'];

    selectors.forEach(sel => {
      scope.querySelectorAll(sel).forEach(el => {
        if (processed.has(el)) return;

        const email = el.getAttribute('email') ||
                      el.getAttribute('data-hovercard-id') || '';
        if (!email || !email.includes('@')) return;

        const name = el.textContent.trim();
        if (!name || name.includes(email)) { processed.add(el); return; }

        // Rewrite text in-place: "John Doe" → "John Doe <john@example.com>"
        el.textContent = name + ' <' + email + '>';
        processed.add(el);
      });
    });
  }

  // ── Click handler for plain-text URL spans ───────────────────────────────
  // When the user clicks a replaced URL span we show a small info panel
  // (so they can see risk status). No hover — click only.

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
      e.stopPropagation();
      hidePanel();
    });
    panel.querySelector('.glg-panel-url').addEventListener('mousedown', e => e.stopPropagation());
    panel.querySelector('.glg-panel-url').addEventListener('click', e => e.stopPropagation());
  }

  function showPanel(url, event) {
    if (!panel) createPanel();
    const suspicious = isLikelySuspicious(url);

    panel.querySelector('.glg-panel-url').textContent = url;
    panel.querySelector('.glg-panel-domain').textContent = '🌐 ' + getDomain(url);

    const riskEl = panel.querySelector('.glg-panel-risk');
    if (suspicious) {
      riskEl.textContent = '⚠️ SUSPICIOUS';
      riskEl.className = 'glg-panel-risk glg-risk-warn';
      panel.querySelector('.glg-panel-url').className = 'glg-panel-url glg-url-suspicious';
    } else {
      riskEl.textContent = '✓ Looks OK';
      riskEl.className = 'glg-panel-risk glg-risk-ok';
      panel.querySelector('.glg-panel-url').className = 'glg-panel-url';
    }

    positionPanel(event);
    panel.classList.add('glg-visible');
  }

  function positionPanel(event) {
    const margin = 14;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    panel.style.visibility = 'hidden';
    panel.style.display = 'block';
    const pw = panel.offsetWidth;
    const ph = panel.offsetHeight;
    panel.style.display = '';
    panel.style.visibility = '';

    let x = event.clientX + margin;
    let y = event.clientY + margin;
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

    // Block any residual <a> tags that got through (e.g. Gmail re-renders)
    const anchor = e.target.closest('a[href]');
    if (anchor && !isInCompose(anchor)) {
      e.preventDefault();
      e.stopImmediatePropagation();
      // Re-replace it now
      replaceAnchorWithPlainText(anchor);
      return;
    }

    // Click on our plain-text URL span
    const span = e.target.closest('.glg-plain-url[data-glg-url]');
    if (span) {
      e.stopPropagation();
      showPanel(span.dataset.glgUrl, e);
    }
  }, true);

  // Block middle-click too
  document.addEventListener('auxclick', (e) => {
    const anchor = e.target.closest('a[href]');
    if (anchor) { e.preventDefault(); e.stopImmediatePropagation(); }
  }, true);

  // Block keyboard Enter on links
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const anchor = document.activeElement?.closest?.('a[href]');
      if (anchor && !isInCompose(anchor)) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    }
  }, true);

  // ── MutationObserver ─────────────────────────────────────────────────────

  let debounceTimer = null;
  const pendingNodes = new Set();

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === 1) pendingNodes.add(node);
      }
      if (mutation.type === 'attributes' && mutation.target.nodeType === 1) {
        pendingNodes.add(mutation.target);
      }
    }
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      pendingNodes.forEach(node => {
        replaceAllLinks(node);
        revealSenderEmails(node);
        if (node.tagName === 'A' && !processed.has(node)) {
          replaceAnchorWithPlainText(node);
        }
      });
      pendingNodes.clear();
    }, 80);
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['email', 'data-hovercard-id', 'href']
  });

  // Initial pass
  replaceAllLinks();
  revealSenderEmails();

})();
