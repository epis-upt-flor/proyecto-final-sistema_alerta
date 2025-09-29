import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { ActualizarUbicacionPatrullaUseCase } from '../../application/actualizar-ubicacion-patrulla.usecase';
import { FirebaseAuthGuard } from '../../infrastructure/auth/firebase-auth.guard';

@Controller('patrulla')
export class PatrullaController {
  constructor(private readonly actualizarUbicacion: ActualizarUbicacionPatrullaUseCase) {}

  @UseGuards(FirebaseAuthGuard)
  @Post('ubicacion')
  async actualizarUbicacionPatrulla(@Req() req, @Body() body: { lat: number; lon: number }) {
    const patrulleroId = req.user.uid; // El UID del patrullero autenticado
    await this.actualizarUbicacion.ejecutar({ patrulleroId, lat: body.lat, lon: body.lon });
    return { mensaje: 'Ubicación actualizada correctamente' };
  }
}