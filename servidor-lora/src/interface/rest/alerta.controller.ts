import { Controller, Post, Body } from '@nestjs/common';
import { RegistrarAlertaUseCase } from '../../application/registrar-alerta.usecase';

@Controller('alerta')
export class AlertaController {
  constructor(private readonly registrarAlertaUseCase: RegistrarAlertaUseCase) {}

  @Post('lorawan-webhook')
  async recibirAlertaLoRaWAN(@Body() datos: any) {
    console.log('Datos recibidos en webhook:', JSON.stringify(datos, null, 2));
    return await this.registrarAlertaUseCase.execute(datos);
  }
}