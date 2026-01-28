# Contributing to ADS for Overleaf

Thank you for your interest in contributing! This document provides guidelines for contributing to the project.

## Getting Started

### Prerequisites

- Git
- A modern web browser (Chrome, Firefox, or Edge)
- Text editor or IDE

### Development Setup

1. **Fork the repository**
   
   Click the "Fork" button on GitHub to create your own copy.

2. **Clone your fork**
   ```bash
   git clone https://github.com/YOUR-USERNAME/inspire-for-overleaf.git
   cd inspire-for-overleaf
   ```

3. **Load the extension in your browser**

   **Chrome:**
   - Go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `inspire-for-overleaf` folder

   **Firefox:**
   - Go to `about:debugging#/runtime/this-firefox`
   - Click "Load Temporary Add-on"
   - Select `manifest.json`

4. **Make changes and test**
   
   After making changes, reload the extension:
   - Chrome: Click the reload icon on the extension card
   - Firefox: Click "Reload" in the debugging page

## How to Contribute

### Reporting Bugs

1. Check if the bug has already been reported in [Issues](https://github.com/yipihey/inspire-for-overleaf/issues)
2. If not, create a new issue with:
   - Clear, descriptive title
   - Steps to reproduce
   - Expected vs actual behavior
   - Browser and version
   - Screenshots if applicable

### Suggesting Features

1. Check if the feature has been suggested in [Issues](https://github.com/yipihey/inspire-for-overleaf/issues)
2. If not, create a new issue with:
   - Clear description of the feature
   - Use case / why it would be useful
   - Possible implementation approach (optional)

### Submitting Code

1. **Create a branch**
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/your-bug-fix
   ```

2. **Make your changes**
   - Follow the existing code style
   - Add comments for complex logic
   - Test your changes thoroughly

3. **Commit with clear messages**
   ```bash
   git commit -m "Add feature: description of feature"
   # or
   git commit -m "Fix: description of bug fix"
   ```

4. **Push and create a Pull Request**
   ```bash
   git push origin feature/your-feature-name
   ```
   Then open a PR on GitHub.

## Code Style

### JavaScript

- Use ES6+ features (const/let, arrow functions, async/await)
- Use meaningful variable and function names
- Add JSDoc comments for public functions
- Keep functions small and focused

```javascript
/**
 * Fetch libraries from ADS API
 * @param {boolean} forceRefresh - Skip cache if true
 * @returns {Promise<Array>} Array of library objects
 */
async function getLibraries(forceRefresh = false) {
  // Implementation
}
```

### CSS

- Use meaningful class names (`.ads-sidebar`, not `.s1`)
- Group related styles together
- Add comments for non-obvious styling

### HTML

- Use semantic HTML elements
- Include appropriate ARIA labels for accessibility
- Keep markup clean and well-indented

## Project Structure

```
inspire-for-overleaf/
├── manifest.json          # Extension configuration
├── background/
│   └── service-worker.js  # Background script
├── content/
│   └── overleaf-injector.js  # Injected into Overleaf
├── popup/
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── options/
│   ├── options.html
│   ├── options.css
│   └── options.js
├── lib/
│   ├── ads-api.js         # ADS API client
│   ├── storage.js         # Storage wrapper
│   └── bibtex-utils.js    # BibTeX utilities
├── styles/
│   └── overleaf-panel.css # Styles for injected UI
└── icons/                 # Extension icons
```

## Testing

### Manual Testing Checklist

Before submitting a PR, please test:

- [ ] Extension loads without errors
- [ ] Can save and validate API token
- [ ] Libraries load correctly
- [ ] Search returns results
- [ ] Citation insertion works in Overleaf
- [ ] BibTeX export works
- [ ] Keyboard shortcut works
- [ ] Settings are saved and applied
- [ ] Works in both Chrome and Firefox

### Testing Tips

- Open browser DevTools (F12) to check for console errors
- Test with different Overleaf projects
- Test with empty and full libraries
- Test with slow network (DevTools > Network > Throttling)

## Pull Request Guidelines

- Keep PRs focused on a single feature or fix
- Update documentation if needed
- Add yourself to contributors in README (optional)
- Be patient during review; we're volunteers!

## Questions?

- Open a [Discussion](https://github.com/yipihey/inspire-for-overleaf/discussions) for general questions
- Tag maintainers in issues if you need help

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for helping make ADS for Overleaf better! 🌟
