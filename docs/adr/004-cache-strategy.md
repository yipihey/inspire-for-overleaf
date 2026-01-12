# ADR-004: TTL-Based Caching Strategy

## Status
Accepted

## Context
The extension makes API calls to NASA ADS for:
- User's library list
- Documents within each library
- Search results
- BibTeX exports

Without caching:
- Every sidebar open would trigger API calls
- Poor user experience with loading delays
- Unnecessary load on ADS servers
- Risk of hitting rate limits

## Decision
Implement a TTL (Time-To-Live) based cache with the following characteristics:
- **Cache Location**: `chrome.storage.local`
- **Default TTL**: 5 minutes
- **Cached Data**: Libraries list, library documents
- **Not Cached**: Search results, BibTeX exports (fresh each time)
- **Manual Refresh**: Users can force refresh via UI button

## Consequences

### Positive
- **Fast UI**: Sidebar opens instantly with cached data
- **Reduced API Calls**: Fewer requests to ADS servers
- **Offline Resilience**: Cached data available if ADS is temporarily down
- **Rate Limit Protection**: Less likely to hit API rate limits

### Negative
- **Stale Data**: Users may see outdated library contents for up to 5 minutes
- **Storage Usage**: Cached data consumes local storage quota
- **Complexity**: Cache invalidation logic required
- **Debugging**: Cached data can mask API issues

### Cache Invalidation
Cache is invalidated when:
1. TTL expires (5 minutes)
2. User clicks refresh button
3. User modifies library (add paper)
4. User clears cache via settings

### Configuration
```javascript
const CACHE_CONFIG = {
  libraryTTL: 5 * 60 * 1000,    // 5 minutes
  documentsTTL: 5 * 60 * 1000,  // 5 minutes
};
```

### Future Improvements
- Make TTL configurable in user preferences
- Implement smarter cache invalidation (e.g., ETag-based)
- Add cache size limits to prevent storage bloat
- Consider IndexedDB for larger datasets
