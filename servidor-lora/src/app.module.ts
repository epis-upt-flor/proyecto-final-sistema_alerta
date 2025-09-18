import { Module } from '@nestjs/common';
import { AlertaController } from './interface/rest/alerta.controller';
import { RegistrarAlertaUseCase } from './application/registrar-alerta.usecase';
import { AlertaRepositoryInMemory } from './infrastructure/persistence/alerta-repository.inmemory';

@Module({
  controllers: [AlertaController],
  providers: [
    RegistrarAlertaUseCase,
    { provide: 'AlertaRepositoryPort', useClass: AlertaRepositoryInMemory }
  ]
})
export class AppModule {}