# Project conventions

- Define heading typography through the shared CSS display token and Tailwind display family, with locally hosted WOFF2 assets included in PWA precaching, so headings stay consistent offline.
- Reuse the shared Apex Scout logo asset across screens and derive favicon and PWA sizes from the same artwork, so brand changes remain consistent.
- Generate the remote MCP function through the SDK Vite plugin; .well-known discovery advertises its canonical function URL and native OAuth issuer, never the app's HTML /mcp path.
- Exclude .well-known metadata from PWA navigation fallback so OAuth discovery cannot return cached application HTML.