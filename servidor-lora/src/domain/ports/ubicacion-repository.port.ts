import type { Ubicacion } from '../entities/ubicacion.entity';

export interface UbicacionRepositoryPort {
  save(ubicacion: Ubicacion): Promise<void>;
  getUltimasUbicaciones(): Promise<Ubicacion[]>;
}