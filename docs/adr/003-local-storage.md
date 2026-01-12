# ADR-003: Local Storage vs Sync Storage

## Status
Accepted

## Context
Chrome extensions have two storage options:
- **`chrome.storage.local`**: Data stored only on the current device
- **`chrome.storage.sync`**: Data synced across user's Chrome browsers via Google account

The extension stores:
1. **API Token**: NASA ADS personal access token
2. **User Preferences**: Citation format, default library, etc.
3. **Cache Data**: Libraries and documents

## Decision
We will use `chrome.storage.local` exclusively for all data, including the API token and preferences.

## Consequences

### Positive
- **Security**: API tokens are sensitive credentials. Syncing them across devices increases attack surface and potential for token leakage.
- **Privacy**: Users may not want their ADS usage data synced to Google's servers.
- **Reliability**: Sync storage has quotas and can fail silently. Local storage is more predictable.
- **Simplicity**: One storage mechanism to manage, test, and debug.

### Negative
- **Manual Setup**: Users must configure the extension on each browser/device they use.
- **No Cross-Device Continuity**: Preferences don't follow the user.
- **Potential Token Duplication**: Same token may need to be entered multiple times.

### Alternatives Considered

**Hybrid Approach**: Sync preferences, store token locally
- Rejected: Added complexity, and some users may consider even preferences private

**User Choice**: Let user decide what to sync
- Rejected: Adds UI complexity, most users won't understand the security implications

### Future Considerations
If users strongly request preference syncing, we could:
1. Add an opt-in setting to sync preferences only (not tokens)
2. Implement encrypted sync storage for tokens (significant complexity)
