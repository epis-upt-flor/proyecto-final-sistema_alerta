using Domain.Entities;
using Domain.Interfaces;
namespace Application.UseCases
{
    public class RegistrarAlertaUseCase
    {
        private readonly IAlertaRepository _alertaRepository;

        public RegistrarAlertaUseCase(IAlertaRepository alertaRepository)
        {
            _alertaRepository = alertaRepository;
        }

        public async Task EjecutarAsync(Alerta alerta)
        {
            await _alertaRepository.SaveAsync(alerta);
        }
    }
}