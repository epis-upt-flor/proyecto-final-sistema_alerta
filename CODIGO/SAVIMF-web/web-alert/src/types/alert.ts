export interface Alert {
  id?: string; // ID del documento de Firestore
  estado: string;
  nombre: string;
  apellido?: string;
  dni?: string;
  lat: number;
  lon: number;
  bateria: number;
  timestamp: string;
  device_id: string;
  direccion?: string;
  fechaCreacion?: string;
  
  // 🆕 Campos para manejo de estados y patrullas asignadas
  patrulleroAsignado?: string; // ID del patrullero que tomó la alerta
  fechaTomada?: string;
  fechaEnCamino?: string;
  fechaResuelto?: string;
  
  // 🔥 NUEVOS CAMPOS SISTEMA DE PRIORIDADES
  cantidadActivaciones?: number;
  ultimaActivacion?: string;
  nivelUrgencia?: 'baja' | 'media' | 'critica';
  esRecurrente?: boolean;
}