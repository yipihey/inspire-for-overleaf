# INSPIRE for Overleaf

<p align="center">
  <img src="icons/icon.svg" alt="INSPIRE for Overleaf Logo" width="128" height="128">
</p>

[![Download Latest Release](https://img.shields.io/github/v/release/yipihey/inspire-for-overleaf?label=Download&style=for-the-badge)](https://github.com/yipihey/inspire-for-overleaf/releases/latest)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![GitHub Release](https://img.shields.io/github/v/release/yipihey/inspire-for-overleaf)](https://github.com/yipihey/inspire-for-overleaf/releases/latest)

Search INSPIRE HEP and cite papers directly in Overleaf. Load your .bib file, search the literature, and insert citations without leaving the editor.

![INSPIRE for Overleaf Screenshot](docs/screenshot.jpg)

## Features

- 🔍 **Search INSPIRE HEP** — Find papers across all of INSPIRE without leaving your document
- 📚 **Load Your Bibliography** — Import your existing .bib file to see what's already cited
- 📝 **One-Click Citations** — Insert `\cite{}` commands at your cursor with a single click
- 📋 **Export BibTeX** — Copy BibTeX for any paper directly to your clipboard
- ⌨️ **Keyboard Shortcut** — Quick access with `Ctrl+Shift+C` (or `Cmd+Shift+C` on Mac)
- 🎨 **Dark Mode Support** — Automatically adapts to your system preferences

## Installation

### Chrome / Edge / Brave

1. Download the latest release from [Releases](https://github.com/yipihey/inspire-for-overleaf/releases)
2. Unzip the file
3. Go to `chrome://extensions/`
4. Enable "Developer mode" (top right)
5. Click "Load unpacked" and select the unzipped folder

*Coming soon to Chrome Web Store*

### Firefox

1. Download the latest release from [Releases](https://github.com/yipihey/inspire-for-overleaf/releases)
2. Go to `about:debugging#/runtime/this-firefox`
3. Click "Load Temporary Add-on"
4. Select any file in the unzipped folder

*Coming soon to Firefox Add-ons*

## Setup

1. **Open any project on [Overleaf](https://www.overleaf.com)**

2. **Open the INSPIRE panel**
   - Click the "INSPIRE" button in the toolbar, or
   - Use the keyboard shortcut `Ctrl+Shift+C` (or `Cmd+Shift+C` on Mac)

3. **Start searching and citing!**
   - Search for papers by title, author, arXiv ID, or DOI
   - Click any paper to insert a citation at your cursor
   - Use the BibTeX button to copy the entry for your .bib file

No API token required — INSPIRE HEP's literature search is open access!

## Usage

### Inserting Citations

1. Place your cursor where you want the citation
2. Open the INSPIRE panel (`Ctrl+Shift+C`)
3. Search for your paper by title, author, arXiv ID, or DOI
4. Click the paper to insert `\cite{key}`

### Exporting BibTeX

1. Find the paper in the INSPIRE panel
2. Click the "BibTeX" button
3. The BibTeX entry is copied to your clipboard
4. Paste into your `.bib` file

### Loading Your Bibliography

The extension can detect citations already in your document, helping you avoid duplicate entries and quickly find papers you've already cited.

### Customization

In Settings, you can configure:

- **Citation key format** — Choose between INSPIRE keys, Author2024, Author:2024, etc.
- **Journal format** — Full names or abbreviations
- **Citation command** — `\cite`, `\citep`, `\citet`, etc.

## Privacy

This extension:

- ✅ Only communicates with `inspirehep.net` and `overleaf.com`
- ✅ Stores preferences locally in your browser
- ❌ Does not collect any personal data
- ❌ Does not use analytics or tracking
- ❌ Does not require an API token

See [PRIVACY.md](PRIVACY.md) for the full privacy policy.

## Development

### Prerequisites

- A browser with developer mode enabled

### Running Locally

```bash
# Clone the repository
git clone https://github.com/yipihey/inspire-for-overleaf.git
cd inspire-for-overleaf

# Load in Chrome
# 1. Go to chrome://extensions/
# 2. Enable Developer mode
# 3. Click "Load unpacked"
# 4. Select the inspire-for-overleaf folder
```

### Project Structure

```
inspire-for-overleaf/
├── manifest.json          # Extension manifest
├── background/            # Service worker
├── content/               # Content scripts (injected into Overleaf)
├── popup/                 # Browser toolbar popup
├── options/               # Settings page
├── lib/                   # Shared libraries
├── styles/                # CSS styles
└── icons/                 # Extension icons
```

### Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

See [CONTRIBUTING.md](CONTRIBUTING.md) for more details.

## Related Projects

- [ADS for Overleaf](https://github.com/yipihey/ads-for-overleaf) — Similar extension for NASA ADS
- [INSPIRE HEP](https://inspirehep.net/) — High-Energy Physics literature database
- [Overleaf](https://www.overleaf.com) — Collaborative LaTeX editor

## Acknowledgments

This extension is a fork of [ADS for Overleaf](https://github.com/yipihey/ads-for-overleaf), adapted to work with INSPIRE HEP.

This extension is not affiliated with CERN or the INSPIRE collaboration. INSPIRE HEP is a trusted community hub that helps researchers find accurate scholarly information in high energy physics.

## License

MIT License — see [LICENSE](LICENSE) for details.

---

**Made with love for the particle physics community**
