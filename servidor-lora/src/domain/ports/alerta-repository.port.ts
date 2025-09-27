import type { Alerta } from '../entities/alerta.entity';

export interface AlertaRepositoryPort {
  save(alerta: Alerta): Promise<void>;
}