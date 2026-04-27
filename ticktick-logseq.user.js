// ==UserScript==
// @name         TickTick Logseq Link
// @namespace    https://github.com/jimall/userscript-ticktick-logseq
// @version      1.0.0
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

  function processTextNode(textNode) {
    const text = textNode.textContent;
    const regex = /\[\[([^\]]+)\]\]/g;
    if (!regex.test(text)) return;

    const parent = textNode.parentNode;
    if (!parent || parent.closest(`[${PROCESSED_ATTR}]`)) return;

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
        // Skip script/style/textarea/input elements and already-processed links
        const parent = node.parentNode;
        if (!parent) return NodeFilter.FILTER_REJECT;
        const tag = parent.tagName;
        if (tag === "SCRIPT" || tag === "STYLE" || tag === "TEXTAREA" || tag === "INPUT") {
          return NodeFilter.FILTER_REJECT;
        }
        if (parent.closest(`[${PROCESSED_ATTR}]`)) {
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

  // Intercept clicks on logseq links at the capture phase,
  // before TickTick's event handlers can swallow them.
  // Listen on both mousedown and click — the CodeMirror editor
  // in TickTick intercepts mousedown before click ever fires.
  function handleLogseqLinkClick(e) {
    const link = e.target.closest(`[${PROCESSED_ATTR}]`);
    if (!link) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    window.location.href = link.href;
  }

  document.addEventListener("mousedown", handleLogseqLinkClick, true);
  document.addEventListener("click", handleLogseqLinkClick, true);

  // Initial scan
  walkAndProcess(document.body);

  // Observe DOM changes for dynamically loaded content
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          walkAndProcess(node);
        } else if (node.nodeType === Node.TEXT_NODE) {
          processTextNode(node);
        }
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
})();
