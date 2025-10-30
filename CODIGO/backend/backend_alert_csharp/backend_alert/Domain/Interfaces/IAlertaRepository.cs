using System.Threading.Tasks;
using System.Collections.Generic;
using Domain.Entities;

namespace Domain.Interfaces
{
    public interface IAlertaRepository
    {
        Task SaveAsync(Alerta alerta);
        Task<List<Alerta>> ListarAlertasAsync();

        // Actualiza campos específicos de una alerta por su ID
        Task UpdateFieldsAsync(string alertaId, IDictionary<string, object> updates);
    }
}