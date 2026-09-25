# Printable Game Board Generator

A browser-based tool for designing printable square and hexagonal game boards. It includes page sizing, themes, grid configuration, and PDF export.

## Getting started

This is a dependency-free static web app. Open `index.html` in a modern browser to use it.

For browser features that require an HTTP origin, serve this folder with any static-file server. For example, in a terminal with Python installed:

```bash
npx http-server
```

Then open `http://localhost:8000`.

## Project layout

- `index.html` — application UI, board-rendering logic, and styling.
- `img/` — board textures and image assets.
- `boards/` — generated/example printable boards.
- `rules/` — game rules and reference PDFs.
- `templates/` and `assets/` — source design assets.

## Notes

The app loads jsPDF from a CDN for PDF generation, so exporting PDFs needs an internet connection unless that dependency is later vendored locally.