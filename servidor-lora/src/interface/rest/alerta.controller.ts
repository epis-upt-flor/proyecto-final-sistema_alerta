import { Controller, Post, Body, Get, Req, UseGuards } from '@nestjs/common';
import { RegistrarAlertaUseCase } from '../../application/registrar-alerta.usecase';
import { FirebaseAuthGuard } from '../../infrastructure/auth/firebase-auth.guard';

@Controller('alerta')
export class AlertaController {
  constructor(private readonly registrarAlerta: RegistrarAlertaUseCase) {}

  @Post('lorawan-webhook')
  async registrarLorawanWebhook(@Body() datos: any) {
    // LOG PARA VERIFICA SI LLEGA EL WEBHOOK
    console.log('Webhook recibido:', datos);
    
    let bateria: number | undefined;
    let ubicacion: { lat: number; lon: number } | undefined;

    try {
      const payloadDecoded = Buffer.from(datos.uplink_message.frm_payload, 'base64').toString('utf8');
      const payloadJson = JSON.parse(payloadDecoded);

      // GPS
      if (payloadJson.GPS) {
        const [lat, lon] = payloadJson.GPS.split(',').map(Number);
        if (!isNaN(lat) && !isNaN(lon)) {
          ubicacion = { lat, lon };
        }
      } else if (datos.uplink_message.locations?.user) {
        const lat = datos.uplink_message.locations.user.latitude;
        const lon = datos.uplink_message.locations.user.longitude;
        if (typeof lat === "number" && typeof lon === "number") {
          ubicacion = { lat, lon };
        }
      }
      // Batería
      if (typeof payloadJson.Battery === 'number') {
        bateria = payloadJson.Battery;
      }
    } catch (e) {
      // fallback
      if (datos.uplink_message.locations?.user) {
        const lat = datos.uplink_message.locations.user.latitude;
        const lon = datos.uplink_message.locations.user.longitude;
        if (typeof lat === "number" && typeof lon === "number") {
          ubicacion = { lat, lon };
        }
      }
    }

    // Si falta algún dato, responde con error 400
    if (!datos.end_device_ids?.dev_eui || !ubicacion || bateria === undefined) {
      return { mensaje: "Datos incompletos o inválidos" };
    }

    // Todos los datos están OK
    const alerta = {
      devEUI: datos.end_device_ids.dev_eui,
      ubicacion,
      bateria,
      timestamp: datos.received_at ? new Date(datos.received_at) : new Date(),
    };

    await this.registrarAlerta.ejecutar(alerta);
    return { mensaje: 'Alerta LoraWAN recibida correctamente' };
  }

  @UseGuards(FirebaseAuthGuard)
  @Get('cantidad')
  async cantidadAlertas(@Req() req) {
    console.log('Usuario autenticado:', req.user); // Aquí puedes ver los datos del usuario
    return { mensaje: "OK", usuario: req.user };
  }
}