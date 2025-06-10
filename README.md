# jaxs

This project is licensed under the [ISC License](./LICENSE).

## Project structure

Two versions of the site live in this repository:

1. **Root site** – the files in the repository root (`index.html`, `main.js` and
   friends). This version is bundled with webpack.
2. **`/app` subdirectory** – an older, standalone version of the application
   that can be served as static files.

Both versions share some utilities (e.g. `firebase.js`), but are built and
served separately.

## Prerequisites

- **Node.js**: version 18 or higher is recommended. Install from [nodejs.org](https://nodejs.org/).
- **NPM**: comes bundled with Node.js.
- **API Keys**: The application requires a TMDB API key and Firebase credentials. You can either
  edit `app/config.js` and `firebase.js` with your keys or expose them as environment variables
  (`TMDB_API_KEY`, `FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN`, `FIREBASE_PROJECT_ID`,
  `FIREBASE_STORAGE_BUCKET`, `FIREBASE_MESSAGING_SENDER_ID`, `FIREBASE_APP_ID`, `FIREBASE_MEASUREMENT_ID`).

## Installation

Install dependencies using npm:

```bash
npm install
```

## Development server

### Root site

Start the webpack dev server which serves `index.html` from the repository root
and watches for changes:

```bash
npm start
```

The site will be available at `http://localhost:8080/` by default.

### `/app` subdirectory

The contents of the `app/` directory are plain static files. To preview them you
can use any static file server, for example:

```bash
npx serve app
```

Alternatively open `app/index.html` directly in your browser.

## Tests

Run the Jest test suite:

```bash
npm test
```

The test script sets `NODE_OPTIONS=--experimental-vm-modules` to enable ESM support required by Jest.

## Build

### Root site

Create a production build with webpack:

```bash
npm run build
```

The bundled files will be placed in the `dist/` directory. Serve them with any
static file server, for example:

```bash
npx serve dist
```

### `/app` subdirectory

The files under `app/` are ready to serve as-is and do not require a build
step.
