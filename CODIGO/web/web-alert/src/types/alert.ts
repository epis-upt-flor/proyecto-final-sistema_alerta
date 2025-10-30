export interface Alert {
  estado: string;
  nombre: string;
  apellido: string; // <--- agrega esto
  dni: string;      // <--- y esto
  lat: number;
  lon: number;
  bateria: number;
  timestamp: string;
  device_id: string;
  direccion?: string;
}