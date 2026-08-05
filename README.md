# TickTick Logseq Link

A userscript that converts `[[page name]]` syntax in TickTick / Dida365 into clickable links that open the corresponding page in Logseq.

![gif demo](assets/iShot_2026-04-27_17.04.44.gif)

## Prerequisites

- A userscript manager browser extension, such as:
  - [Tampermonkey](https://www.tampermonkey.net/) (recommended)
  - [Violentmonkey](https://violentmonkey.github.io/)
  - [Greasemonkey](https://www.greasespot.net/) (Firefox only)
- [Logseq](https://logseq.com/) desktop app installed on your machine

## Installation

1. Make sure your userscript manager extension is installed and enabled.

2. Click the link below to install directly — your userscript manager should prompt you to confirm:
   
   **[Install TickTick Logseq Link](https://raw.githubusercontent.com/shangjihao/userscript-ticktick-logseq/main/ticktick-logseq.user.js)**

3. Alternatively, open your userscript manager dashboard, create a new script, and paste the contents of [`ticktick-logseq.user.js`](ticktick-logseq.user.js).

## Configuration

### Set your Logseq Graph name

The script needs to know your Logseq graph name to generate the correct `logseq://` URL.

1. Open [TickTick](https://ticktick.com) or [Dida365](https://dida365.com).
2. Click the userscript manager icon in your browser toolbar.
3. Under **TickTick Logseq Link**, click **Set Logseq Graph Name**.
   
   ![](assets/2026-04-27-18-16-53-image.png)
4. Enter your graph name in the prompt and confirm.

> **How to find your graph name:** Open Logseq, click the graph name in the top-left corner — that's the name you need.

The default graph name is `logseq`. Your setting is saved persistently and only needs to be configured once.

## Usage

Write `[[page name]]` anywhere in your TickTick / Dida365 tasks (title, description, comments, etc.). The script displays it as a blue underlined link with a pointer cursor. In editing mode, clicking `[[page name]]` opens Logseq while clicking any other text continues to position the caret normally.

**Examples:**

| You write                | Link opens                                             |
| ------------------------ | ------------------------------------------------------ |
| `[[Meeting Notes]]`      | `logseq://graph/YourGraph?page=Meeting%20Notes`        |
| `[[Project/Design Doc]]` | `logseq://graph/YourGraph?page=Project%2FDesign%20Doc` |

## Supported Sites

- `ticktick.com`
- `dida365.com`
