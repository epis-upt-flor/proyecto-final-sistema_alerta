using Microsoft.AspNetCore.Mvc;
using Application.UseCases;
using WebAPI.Filters;
using WebAPI.Models;

[ApiController]
[Route("api/[controller]")]
public class UserController : ControllerBase
{
    private readonly BuscarUsuarioPorDniUseCase _buscarUsuarioPorDniUseCase;
    private readonly VincularDispositivoUseCase _vincularDispositivoUseCase;

    public UserController(BuscarUsuarioPorDniUseCase buscarUsuarioPorDniUseCase, VincularDispositivoUseCase vincularDispositivoUseCase)
    {
        _buscarUsuarioPorDniUseCase = buscarUsuarioPorDniUseCase;
        _vincularDispositivoUseCase = vincularDispositivoUseCase;
    }

    [FirebaseAuthGuardAttribute]
    [HttpGet("buscar")]
    public async Task<IActionResult> BuscarPorDni([FromQuery] string dni, [FromQuery] string? role = null)
    {
        if (string.IsNullOrWhiteSpace(dni))
            return BadRequest(new { mensaje = "Debes enviar un DNI" });

        var usuario = await _buscarUsuarioPorDniUseCase.EjecutarAsync(dni, role);
        if (usuario == null)
            return NotFound(new { mensaje = "No se encontró el usuario" });

        return Ok(usuario);
    }

    // NUEVO ENDPOINT
    [FirebaseAuthGuardAttribute]
    [HttpPost("vincular-dispositivo")]
    public async Task<IActionResult> VincularDispositivo([FromBody] VincularDispositivoDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Dni) || string.IsNullOrWhiteSpace(dto.DeviceId))
            return BadRequest(new { mensaje = "Debes enviar DNI y deviceId" });

        try
        {
            var mensaje = await _vincularDispositivoUseCase.EjecutarAsync(dto);
            return Ok(new { mensaje });
        }
        catch (Exception ex)
        {
            return BadRequest(new { mensaje = ex.Message });
        }
    }
}