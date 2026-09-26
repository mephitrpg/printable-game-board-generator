# Printable Game Board Generator

A browser-based tool for designing printable square and hexagonal game boards. It includes page sizing, themes, grid configuration, and PDF export.

https://mephitrpg.github.io/printable-game-board-generator/

## Getting started

This is a dependency-free static web app. Open `index.html` in a modern browser to use it.

For browser features that require an HTTP origin, serve this folder with any static-file server. For example, in a terminal with Node installed:

```bash
npx http-server
```

Then open `http://localhost:8000`.

## Notes

The app loads jsPDF from a CDN for PDF generation, so exporting PDFs needs an internet connection unless that dependency is later vendored locally.

On mobile, the preview loads PDF.js from a CDN and renders the generated PDF inside the page. Download PDF saves the same document. Desktop browsers with native PDF support use the embedded viewer.
