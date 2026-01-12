# ADR-002: No Build Tooling

## Status
Accepted

## Context
Modern JavaScript projects typically use build tools like:
- **Bundlers**: Webpack, Rollup, Vite
- **Transpilers**: Babel, TypeScript
- **Package managers**: npm, yarn, pnpm

These tools provide benefits like:
- Module bundling
- Tree shaking
- TypeScript support
- Modern JS features in older browsers
- Minification

However, they also add complexity:
- Build step required for every change
- Node.js/npm dependency
- Configuration complexity
- Larger barrier to contribution

## Decision
We will not use build tooling. The extension uses vanilla JavaScript with ES modules directly supported by modern browsers.

## Consequences

### Positive
- **Zero setup**: Clone and load in browser - that's it
- **Lower contribution barrier**: No need to install Node.js or understand build tools
- **Faster iteration**: Edit file, reload extension, test
- **No dependency vulnerabilities**: No npm packages in production code
- **Transparency**: What you see in source is what runs

### Negative
- **No TypeScript**: Lose type checking and IDE intelligence
- **No minification**: Slightly larger file sizes (minimal impact)
- **No polyfills**: Must use only APIs supported by target browsers
- **No code splitting**: All code loads upfront
- **Manual module management**: Must use ES module imports correctly

### Mitigations
- Use JSDoc comments for type hints in IDEs
- Target modern browsers only (Chrome 88+, Firefox 78+)
- Keep individual files small and focused
- Consider adding build tooling if project complexity grows significantly
