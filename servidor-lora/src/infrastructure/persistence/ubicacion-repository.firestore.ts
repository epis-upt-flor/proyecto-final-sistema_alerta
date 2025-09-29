import { Injectable } from '@nestjs/common';
import { Firestore } from '@google-cloud/firestore';
import { Ubicacion } from '../../domain/entities/ubicacion.entity';
import { UbicacionRepositoryPort } from '../../domain/ports/ubicacion-repository.port';

@Injectable()
export class UbicacionRepositoryFirestore implements UbicacionRepositoryPort {
  private firestore = new Firestore();

  async save(ubicacion: Ubicacion): Promise<void> {
    // Usa patrulleroId como ID del documento
    await this.firestore.collection('ubicaciones_patrullas')
      .doc(ubicacion.patrulleroId)
      .set({
        lat: ubicacion.lat,
        lon: ubicacion.lon,
        patrulleroId: ubicacion.patrulleroId,
        timestamp: ubicacion.timestamp,
      }, { merge: true }); // merge: true permite actualizar solo los campos nuevos
  }

  async getUltimasUbicaciones(): Promise<Ubicacion[]> {
    // Consulta todos los documentos (uno por patrullero)
    const snapshot = await this.firestore.collection('ubicaciones_patrullas').get();
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return new Ubicacion(data.patrulleroId, data.lat, data.lon, data.timestamp.toDate());
    });
  }
}