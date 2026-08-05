// ==UserScript==
// @name         TickTick Logseq Link
// @namespace    https://github.com/jimall/userscript-ticktick-logseq
// @version      1.0.5
// @description  Convert [[page name]] syntax in TickTick to clickable Logseq links
// @match        https://ticktick.com/*
// @match        https://www.ticktick.com/*
// @match        https://dida365.com/*
// @match        https://www.dida365.com/*
// @grant        GM_registerMenuCommand
// @grant        GM_getValue
// @grant        GM_setValue
// ==/UserScript==

(function () {
  "use strict";

  const DEFAULT_GRAPH = "logseq";

  function getGraphName() {
    return GM_getValue("logseq_graph_name", DEFAULT_GRAPH);
  }

  function buildLogseqUrl(pageName) {
    return `logseq://graph/${encodeURIComponent(getGraphName())}?page=${encodeURIComponent(pageName)}`;
  }

  // Register menu command for configuring graph name
  GM_registerMenuCommand("Set Logseq Graph Name", () => {
    const current = getGraphName();
    const name = prompt("Enter your Logseq graph name:", current);
    if (name !== null && name.trim() !== "") {
      GM_setValue("logseq_graph_name", name.trim());
      alert(`Graph name set to: ${name.trim()}`);
    }
  });

  const PROCESSED_ATTR = "data-logseq-linked";
  const EDITOR_SELECTOR = '.CodeMirror, .cm-editor, [role="textbox"]';
  const HIGHLIGHT_NAME = "logseq-links";
  const HOVER_CLASS = "logseq-link-hover";
  let highlightRefreshPending = false;
  let hoveredLinkTarget = null;

  function installHighlightStyle() {
    const style = document.createElement("style");
    style.textContent = `
      ::highlight(${HIGHLIGHT_NAME}) {
        color: #4a9eff;
        text-decoration: underline;
      }

      .${HOVER_CLASS},
      .${HOVER_CLASS} * {
        cursor: pointer !important;
      }
    `;
    document.head.appendChild(style);
  }

  function isInEditableArea(node) {
    const element =
      node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
    return Boolean(
      element &&
        (element.isContentEditable || element.closest(EDITOR_SELECTOR)),
    );
  }

  function restoreLinksInEditableArea(root) {
    const links = [];
    if (root.nodeType === Node.ELEMENT_NODE) {
      if (root.matches(`[${PROCESSED_ATTR}]`)) links.push(root);
      links.push(...root.querySelectorAll(`[${PROCESSED_ATTR}]`));
    }

    for (const link of links) {
      if (!isInEditableArea(link)) continue;
      link.replaceWith(document.createTextNode(link.textContent));
    }
  }

  function refreshEditableLinkHighlights() {
    highlightRefreshPending = false;
    if (!CSS.highlights || typeof Highlight === "undefined") return;

    const ranges = [];
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          return isInEditableArea(node)
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_REJECT;
        },
      },
    );
    const regex = /\[\[([^\]]+)\]\]/g;

    while (walker.nextNode()) {
      const textNode = walker.currentNode;
      regex.lastIndex = 0;

      let match;
      while ((match = regex.exec(textNode.textContent)) !== null) {
        const range = document.createRange();
        range.setStart(textNode, match.index);
        range.setEnd(textNode, regex.lastIndex);
        ranges.push(range);
      }
    }

    CSS.highlights.set(HIGHLIGHT_NAME, new Highlight(...ranges));
  }

  function scheduleHighlightRefresh() {
    if (highlightRefreshPending) return;
    highlightRefreshPending = true;
    requestAnimationFrame(refreshEditableLinkHighlights);
  }

  function processTextNode(textNode) {
    const text = textNode.textContent;
    const regex = /\[\[([^\]]+)\]\]/g;
    if (!regex.test(text)) return;

    const parent = textNode.parentNode;
    if (
      !parent ||
      isInEditableArea(parent) ||
      parent.closest(`[${PROCESSED_ATTR}]`)
    ) {
      return;
    }

    const fragment = document.createDocumentFragment();
    let lastIndex = 0;
    regex.lastIndex = 0;

    let match;
    while ((match = regex.exec(text)) !== null) {
      // Add text before the match
      if (match.index > lastIndex) {
        fragment.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
      }

      const pageName = match[1];
      const link = document.createElement("a");
      link.href = buildLogseqUrl(pageName);
      link.textContent = `[[${pageName}]]`;
      link.title = `Open "${pageName}" in Logseq`;
      link.setAttribute(PROCESSED_ATTR, "true");
      link.style.cssText =
        "color: #4a9eff; text-decoration: underline; cursor: pointer;";
      fragment.appendChild(link);
      lastIndex = regex.lastIndex;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
    }

    parent.replaceChild(fragment, textNode);
  }

  function walkAndProcess(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        // Never replace an editor's text nodes: doing so breaks its selection
        // model and prevents the mouse from positioning the caret.
        const parent = node.parentNode;
        if (!parent) return NodeFilter.FILTER_REJECT;
        const tag = parent.tagName;
        if (tag === "SCRIPT" || tag === "STYLE" || tag === "TEXTAREA" || tag === "INPUT") {
          return NodeFilter.FILTER_REJECT;
        }
        if (parent.closest(`[${PROCESSED_ATTR}]`)) {
          return NodeFilter.FILTER_REJECT;
        }
        if (isInEditableArea(parent)) {
          return NodeFilter.FILTER_REJECT;
        }
        if (/\[\[[^\]]+\]\]/.test(node.textContent)) {
          return NodeFilter.FILTER_ACCEPT;
        }
        return NodeFilter.FILTER_SKIP;
      },
    });

    const nodes = [];
    while (walker.nextNode()) {
      nodes.push(walker.currentNode);
    }
    nodes.forEach(processTextNode);
  }

  function findEditableHost(target) {
    if (!(target instanceof Element)) return null;

    const managedEditor = target.closest(EDITOR_SELECTOR);
    if (managedEditor) return managedEditor;

    if (!target.isContentEditable) return null;

    let host = target;
    while (host.parentElement?.isContentEditable) {
      host = host.parentElement;
    }
    return host;
  }

  function findEditableLinkAtPoint(root, x, y) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const regex = /\[\[([^\]]+)\]\]/g;

    while (walker.nextNode()) {
      const textNode = walker.currentNode;
      regex.lastIndex = 0;

      let match;
      while ((match = regex.exec(textNode.textContent)) !== null) {
        const range = document.createRange();
        range.setStart(textNode, match.index);
        range.setEnd(textNode, regex.lastIndex);

        for (const rect of range.getClientRects()) {
          if (
            x >= rect.left &&
            x <= rect.right &&
            y >= rect.top &&
            y <= rect.bottom
          ) {
            return match[1];
          }
        }
      }
    }

    return null;
  }

  // Keep editor DOM untouched. Only consume mousedown when its coordinates
  // fall directly on [[page name]]; all other positions remain available to
  // TickTick for caret placement and text selection.
  function handleEditableLogseqLinkMouseDown(e) {
    if (e.button !== 0) return;

    const editable = findEditableHost(e.target);
    if (!editable) return;

    const pageName = findEditableLinkAtPoint(e.target, e.clientX, e.clientY);
    if (!pageName) return;

    e.preventDefault();
    e.stopImmediatePropagation();
    window.location.href = buildLogseqUrl(pageName);
  }

  function setHoveredLinkTarget(target) {
    if (target === hoveredLinkTarget) return;
    hoveredLinkTarget?.classList.remove(HOVER_CLASS);
    hoveredLinkTarget = target;
    hoveredLinkTarget?.classList.add(HOVER_CLASS);
  }

  function handleEditableLogseqLinkMouseMove(e) {
    const editable = findEditableHost(e.target);
    if (!editable) {
      setHoveredLinkTarget(null);
      return;
    }

    const pageName = findEditableLinkAtPoint(e.target, e.clientX, e.clientY);
    setHoveredLinkTarget(pageName ? e.target : null);
  }

  // Read-only links are real anchors. Intercept their completed clicks at the
  // capture phase before TickTick's handlers can swallow them.
  function handleLogseqLinkClick(e) {
    const link = e.target.closest(`[${PROCESSED_ATTR}]`);
    if (!link) return;

    e.preventDefault();
    e.stopImmediatePropagation();
    window.location.href = link.href;
  }

  document.addEventListener(
    "mousedown",
    handleEditableLogseqLinkMouseDown,
    true,
  );
  document.addEventListener(
    "mousemove",
    handleEditableLogseqLinkMouseMove,
    true,
  );
  document.addEventListener("click", handleLogseqLinkClick, true);
  window.addEventListener("blur", () => setHoveredLinkTarget(null));

  installHighlightStyle();

  // Initial scan
  walkAndProcess(document.body);
  scheduleHighlightRefresh();

  // Observe DOM changes for dynamically loaded content
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === "attributes") {
        if (isInEditableArea(mutation.target)) {
          restoreLinksInEditableArea(mutation.target);
        } else {
          walkAndProcess(mutation.target);
        }
        continue;
      }

      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          restoreLinksInEditableArea(node);
          walkAndProcess(node);
        } else if (node.nodeType === Node.TEXT_NODE) {
          processTextNode(node);
        }
      }
    }

    scheduleHighlightRefresh();
  });

  observer.observe(document.body, {
    attributes: true,
    attributeFilter: ["contenteditable"],
    childList: true,
    subtree: true,
  });
})();
