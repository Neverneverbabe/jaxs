# jaxs

This project is licensed under the [ISC License](./LICENSE).

## Configuration

API keys are loaded from environment variables or an optional `config.json` file
located at the project root. A template is provided as `config.example.json`.

1. Copy `config.example.json` to `config.json` and fill in your real values.
2. Alternatively set the environment variables `FIREBASE_API_KEY` and
   `TMDB_API_KEY` when running the application or tests.

The real `config.json` (and any `.env` file) is ignored by git via the
repository `.gitignore`.
