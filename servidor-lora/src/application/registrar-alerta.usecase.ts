import { Injectable, Inject } from '@nestjs/common';
import type { AlertaRepositoryPort } from '../domain/ports/alerta-repository.port';
import { Alerta } from '../domain/entities/alerta.entity';
import { ValidadorDatos } from '../infrastructure/services/validador-datos.service';

@Injectable()
export class RegistrarAlertaUseCase {
  constructor(
    @Inject('AlertaRepositoryPort') private readonly alertaRepository: AlertaRepositoryPort,
    private readonly validadorDatos: ValidadorDatos
  ) {}

  async ejecutar(datos: { devEUI: string; ubicacion: { lat: number; lon: number }; bateria: number; timestamp: Date }) {
    // 1. Validar datos aquí
    if (!this.validadorDatos.validarDatosAlerta(datos)) {
      throw new Error('Datos de alerta inválidos');
    }
    // 2. Crear entidad
    const alerta = new Alerta(datos.devEUI, datos.ubicacion, datos.bateria, datos.timestamp);
    // 3. Guardar
    await this.alertaRepository.save(alerta);
  }
}