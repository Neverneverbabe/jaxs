# jaxs

This project is licensed under the [ISC License](./LICENSE).

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

Start the webpack dev server which serves `index.html` and watches for changes:

```bash
npm start
```

This will open the application at `http://localhost:8080/` by default.

## Tests

Run the Jest test suite:

```bash
npm test
```

Some environments may require `NODE_OPTIONS=--experimental-vm-modules` for ESM support.

## Build

Create a production build with webpack:

```bash
npm run build
```

The resulting files will be placed in the `dist/` directory.

To serve the built `index.html`, you can use any static file server, e.g.:

```bash
npx serve dist
```
