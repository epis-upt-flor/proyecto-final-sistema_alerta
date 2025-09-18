export class Alerta {
  constructor(
    public readonly devEUI: string,
    public readonly ubicacion: { lat: number; lon: number },
    public readonly bateria: number,
    public readonly timestamp: Date
  ) {}
}