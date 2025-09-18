import { Inject, Injectable } from '@nestjs/common';
import type { AlertaRepositoryPort } from '../domain/ports/alerta-repository.port';
import { Alerta } from '../domain/entities/alerta.entity';

@Injectable()
export class RegistrarAlertaUseCase {
  constructor(
    @Inject('AlertaRepositoryPort')
    private readonly alertaRepo: AlertaRepositoryPort
  ) {}

  async execute(datos: any) {
    // Mapea datos de TTS a tu entidad
    const alerta = new Alerta(
      datos.devEUI,
      datos.uplink_message?.decoded_payload?.location,
      datos.uplink_message?.decoded_payload?.battery,
      new Date()
    );
    await this.alertaRepo.save(alerta);
    return { ok: true };
  }
}