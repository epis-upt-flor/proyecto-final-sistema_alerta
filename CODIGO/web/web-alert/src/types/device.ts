export interface Device {
  deviceId: string;
  devEui: string;
  joinEui: string;
  appKey: string;
  createdAt: string;
  updatedAt: string;
  vinculado?: string; // <-- agrega esto si no está
}