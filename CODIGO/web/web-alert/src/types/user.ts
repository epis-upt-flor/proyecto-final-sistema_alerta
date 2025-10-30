export interface User {
  uid: string;
  dni: string;
  nombre: string;
  apellido: string;
  email: string;
  role: string;
  ordenJuez: boolean;
  deviceId ?: string; // el device vinculado, si hay
}