export class Ubicacion {
  constructor(
    public readonly patrulleroId: string,
    public readonly lat: number,
    public readonly lon: number,
    public readonly timestamp: Date = new Date(),
  ) {}
}