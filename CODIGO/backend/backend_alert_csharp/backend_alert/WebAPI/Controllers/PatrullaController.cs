using Microsoft.AspNetCore.Mvc;
using WebAPI.Models;
using FirebaseAdmin.Auth; // <-- Importante
using WebAPI.Filters;
using Application.UseCases;

[ApiController]
[Route("api/[controller]")]
public class PatrullaController : ControllerBase
{
    private readonly ActualizarUbicacionPatrullaUseCase _actualizarUbicacionUseCase;
    private readonly ListarUbicacionesPatrullasUseCase _listarUbicacionesUseCase;

    public PatrullaController(
        ActualizarUbicacionPatrullaUseCase actualizarUbicacionUseCase,
        ListarUbicacionesPatrullasUseCase listarUbicacionesUseCase)
    {
        _actualizarUbicacionUseCase = actualizarUbicacionUseCase;
        _listarUbicacionesUseCase = listarUbicacionesUseCase;
    }

    [FirebaseAuthGuardAttribute]
    [HttpPost("ubicacion")]
    public async Task<IActionResult> ActualizarUbicacionPatrulla([FromBody] UbicacionPatrullaDto body)
    {
        // Obtén el usuario Firebase guardado por el filtro (como UserRecord)
        var firebaseUser = HttpContext.Items["FirebaseUser"] as UserRecord;
        if (firebaseUser == null)
        {
            return Unauthorized(new { mensaje = "Usuario no autenticado" });
        }
        string patrulleroId = firebaseUser.Uid;

        await _actualizarUbicacionUseCase.EjecutarAsync(patrulleroId, body.lat, body.lon);

        return Ok(new { 
            mensaje = "Ubicación actualizada correctamente",
            patrulleroId = patrulleroId,
            timestamp = DateTime.UtcNow
        });
    }

    [FirebaseAuthGuardAttribute]
    [HttpGet("ubicaciones")]
    public async Task<IActionResult> ObtenerUbicacionesPatrullas()
    {
        try
        {
            var patrullas = await _listarUbicacionesUseCase.EjecutarAsync();
            
            var result = patrullas.Select(p => new PatrullaUbicacionDto(
                p.PatrulleroId,
                p.Lat,
                p.Lon,
                p.Timestamp
            )).ToList();

            return Ok(result);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error obteniendo ubicaciones de patrullas: {ex.Message}");
            return StatusCode(500, new { mensaje = "Error interno del servidor" });
        }
    }

    /// <summary>
    /// � Endpoint para obtener la ubicación de una patrulla específica
    /// </summary>
    [FirebaseAuthGuardAttribute]
    [HttpGet("ubicaciones/{patrulleroId}")]
    public async Task<IActionResult> ObtenerUbicacionPatrulla(string patrulleroId)
    {
        try
        {
            var patrullas = await _listarUbicacionesUseCase.EjecutarAsync();
            var patrulla = patrullas.FirstOrDefault(p => p.PatrulleroId == patrulleroId);

            if (patrulla == null)
            {
                return NotFound(new { mensaje = $"No se encontró la patrulla con ID: {patrulleroId}" });
            }

            var result = new PatrullaUbicacionDto(
                patrulla.PatrulleroId,
                patrulla.Lat,
                patrulla.Lon,
                patrulla.Timestamp
            );

            return Ok(result);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error obteniendo ubicación de patrulla {patrulleroId}: {ex.Message}");
            return StatusCode(500, new { mensaje = "Error interno del servidor" });
        }
    }

    /// <summary>
    /// �📊 Endpoint para obtener estadísticas de patrullas
    /// </summary>
    [FirebaseAuthGuardAttribute]
    [HttpGet("estadisticas")]
    public async Task<IActionResult> ObtenerEstadisticasPatrullas()
    {
        try
        {
            var patrullas = await _listarUbicacionesUseCase.EjecutarAsync();
            
            var ahora = DateTime.UtcNow;
            var patrullasActivas = patrullas.Where(p => 
                (ahora - p.Timestamp).TotalMinutes <= 10 // Activa si reportó en los últimos 10 min
            ).Count();

            return Ok(new
            {
                totalPatrullas = patrullas.Count,
                patrullasActivas = patrullasActivas,
                patrullasInactivas = patrullas.Count - patrullasActivas,
                ultimaActualizacion = ahora,
                patrullas = patrullas.Select(p => new {
                    patrulleroId = p.PatrulleroId,
                    estado = (ahora - p.Timestamp).TotalMinutes <= 10 ? "Activa" : "Inactiva",
                    minutosDesdeUltimaActualizacion = Math.Round((ahora - p.Timestamp).TotalMinutes, 1)
                })
            });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error obteniendo estadísticas: {ex.Message}");
            return StatusCode(500, new { mensaje = "Error interno del servidor" });
        }
    }
}