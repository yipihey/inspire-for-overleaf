# Replacing Icons with Official ADS Logos

The ADS logos are available under CC BY 4.0 license at:
https://ui.adsabs.harvard.edu/help/logos/

## Steps to Replace

1. **Download the official logo**
   - Visit the logos page above
   - Right-click on the desired logo → "Save image as"
   - Save `transparent_logo.svg` to this `icons/` folder

2. **Convert SVG to PNG**
   
   You can use any of these methods:

   **Online (easiest):**
   - https://cloudconvert.com/svg-to-png
   - Upload the SVG, set sizes to 16, 48, and 128 pixels

   **macOS Terminal:**
   ```bash
   # Install rsvg-convert via Homebrew
   brew install librsvg

   # Convert to different sizes
   rsvg-convert -w 16 -h 16 transparent_logo.svg -o icon-16.png
   rsvg-convert -w 48 -h 48 transparent_logo.svg -o icon-48.png
   rsvg-convert -w 128 -h 128 transparent_logo.svg -o icon-128.png
   ```

   **Using Python:**
   ```python
   from PIL import Image
   import cairosvg
   
   for size in [16, 48, 128]:
       cairosvg.svg2png(url='transparent_logo.svg', 
                        write_to=f'icon-{size}.png',
                        output_width=size, 
                        output_height=size)
   ```

3. **Replace the placeholder icons**
   - Replace `icon-16.png`, `icon-48.png`, `icon-128.png` with your converted files

4. **Reload the extension**
   - Chrome: Go to `chrome://extensions/` and click the reload button
   - Firefox: Go to `about:debugging` and click "Reload"

## Attribution Requirement

Since the ADS logos are CC BY 4.0, include this attribution in your README/About:

> This extension uses the NASA ADS logo under the 
> [Creative Commons Attribution 4.0 License](http://creativecommons.org/licenses/by/4.0/).

This is already included in the main README.md.

## Logo Variations

The ADS logos page may include:
- Full wordmark ("astrophysics data system")
- Icon only (the stylized "ads")
- Light and dark variants

Choose whichever works best for the small icon sizes needed by browser extensions.
