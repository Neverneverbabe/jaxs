// config.js 

// TMDB API Key
// IMPORTANT: This key is sensitive and should ideally be loaded from environment variables
// in a production setup, not hardcoded in client-side code.
export const API_KEY = "e27a888783eeaa67643bd81c5fb4422f";
export const TMDB_BASE_URL = "https://api.themoviedb.org/3";
export const TMDB_IMG_BASE_URL = "https://image.tmdb.org/t/p/w500";
export const TMDB_BACKDROP_BASE_URL = "https://image.tmdb.org/t/p/w1280";

// Streaming provider URLs (do not require secret keys)
export const VIDSRC_PROVIDERS = [
    { name: "Vidsrc.xyz", movieUrl: "https://vidsrc.xyz/embed/movie/", tvUrl: "https://vidsrc.xyz/embed/tv/" },
    { name: "Vidsrc.pm",  movieUrl: "https://vidsrc.pm/embed/movie/",  tvUrl: "https://vidsrc.pm/embed/tv/" },
    { name: "Vidsrc.in",  movieUrl: "https://vidsrc.in/embed/movie/",  tvUrl: "https://vidsrc.in/embed/tv/" },
    { name: "Vidsrc.net", movieUrl: "https://vidsrc.net/embed/movie/", tvUrl: "https://vidsrc.net/embed/tv/" },
];
 
