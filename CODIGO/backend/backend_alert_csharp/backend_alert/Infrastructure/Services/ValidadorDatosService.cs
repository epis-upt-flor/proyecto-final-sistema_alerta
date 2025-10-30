using Domain.Entities;

namespace Infrastructure.Services
{
    public class ValidadorDatosService
    {
        public bool ValidarDatosAlerta(Alerta alerta)
        {
            return !string.IsNullOrEmpty(alerta.DevEUI)
                && alerta.Lat != 0
                && alerta.Lon != 0
                && alerta.Bateria != 0;
        }
    }
}