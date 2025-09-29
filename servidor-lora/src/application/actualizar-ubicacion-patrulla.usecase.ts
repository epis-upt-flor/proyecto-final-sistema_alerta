import { Injectable, Inject } from '@nestjs/common';
import type { UbicacionRepositoryPort } from '../domain/ports/ubicacion-repository.port';
import { Ubicacion } from '../domain/entities/ubicacion.entity';

@Injectable()
export class ActualizarUbicacionPatrullaUseCase {
  constructor(
    @Inject('UbicacionRepositoryPort') private readonly ubicacionRepository: UbicacionRepositoryPort,
  ) {}

  async ejecutar(datos: { patrulleroId: string; lat: number; lon: number }) {
    const ubicacion = new Ubicacion(datos.patrulleroId, datos.lat, datos.lon);
    await this.ubicacionRepository.save(ubicacion);
  }
}