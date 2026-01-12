# ADR-005: Content Script Architecture

## Status
Accepted

## Context
To integrate with Overleaf, we need to:
1. Display a UI for browsing libraries and search
2. Insert citations into the LaTeX editor
3. Respond to keyboard shortcuts

Browser extensions offer several approaches:
- **Content Scripts**: JavaScript injected into web pages
- **iframes**: Extension pages embedded in the host page
- **Popup Only**: All functionality in the toolbar popup

## Decision
Use a content script that injects a sidebar panel directly into Overleaf's DOM.

### Implementation Details
- Sidebar slides in from the right edge
- Toggle button injected into Overleaf's toolbar (or fixed position fallback)
- CSS styles injected to style the sidebar
- Direct DOM manipulation for the UI
- Script injection for editor access (CodeMirror/Ace APIs are in page context)

## Consequences

### Positive
- **Seamless Integration**: Sidebar feels like part of Overleaf
- **Direct Editor Access**: Can insert text at cursor position
- **Keyboard Shortcuts**: Can respond to shortcuts while editing
- **Context Awareness**: Knows when user is in an Overleaf project

### Negative
- **DOM Coupling**: Tightly coupled to Overleaf's DOM structure
- **Breakage Risk**: Overleaf UI updates may break the extension
- **CSS Conflicts**: Must namespace all styles to avoid conflicts
- **Isolation Challenges**: Content scripts are isolated from page JS context
- **Maintenance Burden**: Must track Overleaf changes

### Technical Challenges

**Editor Access**
Content scripts run in an isolated world and cannot access page JavaScript objects like CodeMirror or Ace editor instances. Solution: Inject a `<script>` tag that runs in the page context, communicates back via `postMessage()`.

```javascript
// Inject script into page context
const script = document.createElement('script');
script.textContent = `
  // This runs in page context, can access window._ide, ace, etc.
  // Communicate back via postMessage
`;
document.documentElement.appendChild(script);
```

**Toolbar Integration**
Overleaf's toolbar DOM varies between views. Solution: Try multiple selectors, fall back to fixed positioning.

**Style Isolation**
All CSS classes are prefixed with `ads-` to avoid conflicts with Overleaf's styles.

### Alternatives Considered

**iframe-based Sidebar**
- Pros: Complete isolation, no CSS conflicts
- Cons: Cannot access editor for citation insertion, feels disconnected

**Popup Only**
- Pros: Simpler, no DOM injection
- Cons: User must switch context, cannot insert directly into editor

**Browser Side Panel API**
- Pros: Native browser UI, stable
- Cons: Chrome-only, still cannot access editor directly

### Maintenance Plan
- Monitor Overleaf changelog for breaking changes
- Use resilient selectors that don't depend on exact class names
- Provide fallbacks when preferred injection points aren't found
- Test after major Overleaf updates
