---
name: playwright-cli
description: Automate browser tasks with playwright-cli—navigation, form filling, snapshots, screenshots, and data extraction for web testing.
homepage: https://github.com/microsoft/playwright-cli
metadata:
  {
    "openclaw":
      {
        "emoji": "🌐",
        "requires": { "bins": ["playwright-cli"] },
        "install":
          [
            {
              "id": "npx",
              "kind": "node",
              "package": "playwright-cli",
              "bins": ["playwright-cli"],
              "label": "Use playwright-cli (npx)",
            },
          ],
      },
  }
---

# Browser Automation with playwright-cli

Use when the user needs to navigate websites, interact with web pages, fill forms, take screenshots, test web applications, or extract information from web pages.

## Quick start

```bash
playwright-cli open https://playwright.dev
playwright-cli click e15
playwright-cli type "page.click"
playwright-cli press Enter
```

## Core workflow

1. Navigate: `playwright-cli open https://example.com`
2. Take snapshot to get element refs: `playwright-cli snapshot`
3. Interact using refs (e1, e5, etc.) from the snapshot
4. Re-snapshot after significant changes

## Commands

### Core

```bash
playwright-cli open https://example.com/
playwright-cli close
playwright-cli type "search query"
playwright-cli click e3
playwright-cli dblclick e7
playwright-cli fill e5 "[email protected]"
playwright-cli drag e2 e8
playwright-cli hover e4
playwright-cli select e9 "option-value"
playwright-cli upload ./document.pdf
playwright-cli check e12
playwright-cli uncheck e12
playwright-cli snapshot
playwright-cli eval "document.title"
playwright-cli eval "el => el.textContent" e5
playwright-cli dialog-accept
playwright-cli dialog-dismiss
playwright-cli resize 1920 1080
```

### Navigation

```bash
playwright-cli go-back
playwright-cli go-forward
playwright-cli reload
```

### Keyboard

```bash
playwright-cli press Enter
playwright-cli press ArrowDown
```

### Save

```bash
playwright-cli screenshot
playwright-cli screenshot e5
playwright-cli pdf
```

### Tabs

```bash
playwright-cli tab-list
playwright-cli tab-new
playwright-cli tab-new https://example.com/page
playwright-cli tab-close
playwright-cli tab-select 0
```

## Best practices

- Take a snapshot after opening a page to get stable element references before interacting.
- Use element refs (e5, e12) from snapshots rather than fragile CSS/XPath strings.
- Resize the viewport for consistent screenshots.
