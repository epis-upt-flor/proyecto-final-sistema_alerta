// Centralized Google Maps configuration
// Keep the libraries array as a stable exported constant to avoid re-creating it
export const GOOGLE_MAPS_API_KEY = "AIzaSyD_4MSV8UftvnM5JetkCZxHJTZRPkrtlpQ";
export const MAP_LIBRARIES: Array<"places" | "geometry" | "visualization"> = ["places", "geometry", "visualization"];

// In production use an env var, but keep a fallback for local dev. If you want to use env,
// set REACT_APP_GOOGLE_MAPS_API_KEY in your .env and replace the value here.
