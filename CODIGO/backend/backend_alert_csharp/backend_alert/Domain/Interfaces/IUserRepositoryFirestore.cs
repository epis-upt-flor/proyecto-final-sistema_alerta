using System.Threading.Tasks;
using System.Collections.Generic;
using WebAPI.Models;

namespace Domain.Interfaces
{
    public interface IUserRepositoryFirestore
    {
        Task<UsuarioDto?> BuscarPorDniAsync(string dni);
        Task<UsuarioDto?> BuscarPorUidAsync(string uid);
        Task<List<UsuarioDto>> BuscarPorRolAsync(string rol); // e.g. "victima"
        Task<string?> GetRoleByUidAsync(string uid);
        Task VincularDispositivoAsync(VincularDispositivoDto vincularDto);
        Task<UsuarioDto?> BuscarPorDeviceIdAsync(string deviceId);
    }
}