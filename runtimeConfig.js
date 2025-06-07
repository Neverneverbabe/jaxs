let config = {};

if (typeof process !== 'undefined' && process.env) {
  if (process.env.FIREBASE_API_KEY) config.FIREBASE_API_KEY = process.env.FIREBASE_API_KEY;
  if (process.env.TMDB_API_KEY) config.TMDB_API_KEY = process.env.TMDB_API_KEY;
}

if ((!config.FIREBASE_API_KEY || !config.TMDB_API_KEY)) {
  if (typeof window === 'undefined') {
    try {
      const fs = await import('fs');
      const data = fs.readFileSync(new URL('./config.json', import.meta.url), 'utf8');
      const json = JSON.parse(data);
      config = { ...json, ...config };
    } catch (e) {
      // config.json might not exist
    }
  } else {
    try {
      const resp = await fetch('./config.json');
      if (resp.ok) {
        const json = await resp.json();
        config = { ...json, ...config };
      }
    } catch (e) {
      // ignore
    }
  }
}

export default config;
