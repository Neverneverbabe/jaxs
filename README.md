# jaxs

This project is licensed under the [ISC License](./LICENSE).

## Website vs PWA

- `/index.html` is the entry point for the standard web experience.
- `/app/index.html` loads the Progressive Web App (PWA) which registers a service worker to enable offline usage.

## Development

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the development server:
   ```bash
   npm start
   ```
   This uses Webpack Dev Server and serves the files from the `app/` directory.
3. Build for production:
   ```bash
   npm run build
   ```

The PWA registers `app/sw.js` to cache key assets including `app/index.html` and `app/appMain.js` so the app continues to work offline.
