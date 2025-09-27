import { Module } from '@nestjs/common';
import { AlertaController } from './interface/rest/alerta.controller';
import { RegistrarAlertaUseCase } from './application/registrar-alerta.usecase';
//import { AlertaRepositoryInMemory } from './infrastructure/persistence/alerta-repository.inmemory';
import { AlertaRepositoryFirestore } from './infrastructure/persistence/alerta-repository.firestore';
// (Opcional) Importa el ValidadorDatos solo si se usa como servicio
import { ValidadorDatos } from './infrastructure/services/validador-datos.service';

@Module({
  controllers: [AlertaController],
  providers: [
    RegistrarAlertaUseCase,
    ValidadorDatos, // <- Añade esto si usas el validador como servicio
    //{ provide: 'AlertaRepositoryPort', useClass: AlertaRepositoryInMemory }
    { provide: 'AlertaRepositoryPort', useClass: AlertaRepositoryFirestore }
  ]
})
export class AppModule {}