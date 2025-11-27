// Cache simple para evitar repetir llamadas
const geocodeCache = new Map<string, string>();

export async function getAddressFromCoords(lat: number, lon: number): Promise<string> {
  const cacheKey = `${lat.toFixed(6)},${lon.toFixed(6)}`;
  
  // Verificar cache primero
  if (geocodeCache.has(cacheKey)) {
    return geocodeCache.get(cacheKey)!;
  }

  // Verificar que Google Maps esté cargado
  if (!window.google || !window.google.maps) {
    return `${lat}, ${lon}`; // Fallback: mostrar coordenadas
  }

  return new Promise((resolve) => {
    const geocoder = new window.google.maps.Geocoder();
    const latlng = { lat, lng: lon };

    // Timeout de 5 segundos
    const timeoutId = setTimeout(() => {
      const fallback = `${lat}, ${lon}`;
      geocodeCache.set(cacheKey, fallback);
      resolve(fallback);
    }, 5000);

    geocoder.geocode({ location: latlng }, (results, status) => {
      clearTimeout(timeoutId);
      
      if (status === 'OK' && results && results[0]) {
        const address = results[0].formatted_address;
        geocodeCache.set(cacheKey, address); // Guardar en cache
        resolve(address);
      } else {
        console.warn('Geocoding falló:', status);
        const fallback = `${lat}, ${lon}`;
        geocodeCache.set(cacheKey, fallback);
        resolve(fallback);
      }
    });
  });
}