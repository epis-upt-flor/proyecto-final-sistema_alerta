import { Injectable } from '@nestjs/common';
import { AlertaRepositoryPort } from '../../domain/ports/alerta-repository.port';
import { Alerta } from '../../domain/entities/alerta.entity';

@Injectable()
export class AlertaRepositoryInMemory implements AlertaRepositoryPort {
  private readonly alertas: Alerta[] = [];

  async save(alerta: Alerta): Promise<void> {
    this.alertas.push(alerta);
  }

  // Puedes agregar métodos para consultar alertas, etc.
}

