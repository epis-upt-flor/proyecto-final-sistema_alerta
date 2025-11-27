export interface PatrullaUbicacion {
  patrulleroId: string;
  lat: number;
  lon: number;
  timestamp: string;
  estado: "Activa" | "Inactiva";
  minutosDesdeUltimaActualizacion: number;
}