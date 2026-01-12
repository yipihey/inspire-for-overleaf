# ADR-001: Use Chrome Manifest V3

## Status
Accepted

## Context
Chrome extensions can use either Manifest V2 or Manifest V3. As of 2024, Google is deprecating Manifest V2 and requiring all new extensions to use Manifest V3. Existing V2 extensions will eventually stop working.

Key differences:
- **Background pages** (V2) vs **Service workers** (V3)
- **Blocking webRequest** (V2) vs **declarativeNetRequest** (V3)
- Different permission model
- Service workers have a limited lifecycle (can be terminated when idle)

## Decision
We will use Manifest V3 for this extension.

## Consequences

### Positive
- Future-proof: Won't be deprecated
- Required for Chrome Web Store new submissions
- Better security model with more granular permissions
- Service workers use less memory when idle

### Negative
- Service workers can be terminated unexpectedly, requiring careful state management
- Cannot use persistent background pages for long-running operations
- Some V2 APIs are not available (blocking webRequest)
- Need to use ES modules with `importScripts()` workarounds in some cases

### Mitigations
- Store important state in `chrome.storage.local` rather than in-memory variables
- Use message passing instead of direct function calls
- Design API interactions to be stateless and idempotent
