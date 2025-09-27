import { Injectable } from '@nestjs/common';
import { Firestore } from '@google-cloud/firestore';
import { Alerta } from '../../domain/entities/alerta.entity';
import { AlertaRepositoryPort } from '../../domain/ports/alerta-repository.port';

@Injectable()
export class AlertaRepositoryFirestore implements AlertaRepositoryPort {
  private firestore = new Firestore();

  async save(alerta: Alerta): Promise<void> {
    await this.firestore.collection('alertas').add({
      devEUI: alerta.devEUI,
      ubicacion: alerta.ubicacion,
      bateria: alerta.bateria,
      timestamp: alerta.timestamp,
    });
  }
}