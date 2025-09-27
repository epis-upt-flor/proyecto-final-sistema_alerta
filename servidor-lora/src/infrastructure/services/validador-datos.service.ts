import { Injectable } from '@nestjs/common';

@Injectable()
export class ValidadorDatos {
  validarDatosAlerta(datos: any): boolean {
    return (
      typeof datos.devEUI === 'string' &&
      typeof datos.ubicacion?.lat === 'number' &&
      typeof datos.ubicacion?.lon === 'number' &&
      typeof datos.bateria === 'number'
    );
  } 
}