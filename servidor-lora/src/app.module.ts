import { Module } from '@nestjs/common';
import { AlertaController } from './interface/rest/alerta.controller';
import { RegistrarAlertaUseCase } from './application/registrar-alerta.usecase';
//import { AlertaRepositoryInMemory } from './infrastructure/persistence/alerta-repository.inmemory';
import { AlertaRepositoryFirestore } from './infrastructure/persistence/alerta-repository.firestore';
// (Opcional) Importa el ValidadorDatos si lo usas como servicio
import { ValidadorDatos } from './infrastructure/services/validador-datos.service';

// IMPORTA tus servicios y guards de autenticación
import { FirebaseAuthService } from './infrastructure/auth/firebase-auth.service';
import { FirebaseAuthGuard } from './infrastructure/auth/firebase-auth.guard';

@Module({
  controllers: [AlertaController],
  providers: [
    RegistrarAlertaUseCase,
    ValidadorDatos, // <- Añade esto si usas el validador como servicio
    FirebaseAuthService, // <-- Añadir servicio de autenticación
    FirebaseAuthGuard,   // <-- Añadir guard de autenticación
    //{ provide: 'AlertaRepositoryPort', useClass: AlertaRepositoryInMemory }
    { provide: 'AlertaRepositoryPort', useClass: AlertaRepositoryFirestore }
  ]
})
export class AppModule {}