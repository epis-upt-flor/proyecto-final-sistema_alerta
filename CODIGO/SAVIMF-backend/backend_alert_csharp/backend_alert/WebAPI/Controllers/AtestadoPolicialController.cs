using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using backend_alert.Application.UseCases;
using backend_alert.Domain.Entities;
using backend_alert.Domain.Interfaces;
using backend_alert.WebAPI.Controllers.Models;
using WebAPI.Filters;  // 🔥 CORRECTO: Sin "backend_alert"
using System.Security.Claims;
using System.Linq;
using Google.Cloud.Firestore; // Cambiado para usar Google.Cloud.Firestore.Timestamp

namespace backend_alert.WebAPI.Controllers;

/// <summary>
/// Controlador para gestión de Atestados Policiales
/// Pattern: Controller (MVC) - maneja peticiones HTTP
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Authorize] // Solo usuarios autenticados
public class AtestadoPolicialController : ControllerBase
{
    private readonly RegistrarAtestadoPolicialUseCase _registrarUseCase;
    private readonly IAtestadoPolicialRepository _repository;
    private readonly ILogger<AtestadoPolicialController> _logger;

    public AtestadoPolicialController(
        RegistrarAtestadoPolicialUseCase registrarUseCase,
        IAtestadoPolicialRepository repository,
        ILogger<AtestadoPolicialController> logger)
    {
        _registrarUseCase = registrarUseCase;
        _repository = repository;
        _logger = logger;
    }

    /// <summary>
    /// Registra un nuevo atestado policial (desde la app móvil del patrullero)
    /// POST /api/atestadopolicial
    /// </summary>
    [FirebaseAuthGuardAttribute]
    [HttpPost]
    public async Task<IActionResult> RegistrarAtestado([FromBody] RegistrarAtestadoRequestDto request)
    {
        try
        {
            // Obtener UID y nombre del patrullero desde el token JWT
            var uid = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            var nombre = User.FindFirst(ClaimTypes.Name)?.Value ?? "Patrullero";

            if (string.IsNullOrEmpty(uid))
            {
                return Unauthorized(new { mensaje = "Usuario no autenticado" });
            }

            // Crear entidad de dominio
            var atestado = new AtestadoPolicial(
                alertaId: request.AlertaId,
                patrulleroUid: uid,
                patrulleroNombre: nombre,
                fechaIncidente: Timestamp.FromDateTime(request.FechaIncidente.ToUniversalTime()),
                latitud: request.Latitud,
                longitud: request.Longitud,
                distrito: request.Distrito,
                tipoViolencia: request.TipoViolencia,
                nivelRiesgo: request.NivelRiesgo,
                alertaVeridica: request.AlertaVeridica,
                descripcionHechos: request.DescripcionHechos,
                nombreVictima: request.NombreVictima,
                dniVictima: request.DniVictima,
                edadAproximada: request.EdadAproximada
            )
            {
                DireccionReferencial = request.DireccionReferencial ?? string.Empty,
                RequirioAmbulancia = request.RequirioAmbulancia,
                RequirioRefuerzo = request.RequirioRefuerzo,
                VictimaTrasladadaComisaria = request.VictimaTrasladadaComisaria,
                AccionesRealizadas = request.AccionesRealizadas ?? string.Empty,
                Observaciones = request.Observaciones ?? string.Empty
            };

            // Ejecutar caso de uso
            var atestadoId = await _registrarUseCase.EjecutarAsync(atestado);

            _logger.LogInformation("Atestado {AtestadoId} registrado exitosamente por patrullero {PatrulleroUid}", 
                atestadoId, uid);

            // Regenerar Open Data automáticamente después de registrar un atestado
            try
            {
                var anio = atestado.FechaIncidente.ToDateTime().Year;
                var mes = atestado.FechaIncidente.ToDateTime().Month;
                await _repository.RegenerarOpenDataDelMes(anio, mes);
                _logger.LogInformation("Open Data regenerado automáticamente para {Anio}-{Mes}", anio, mes);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al regenerar Open Data para {Anio}-{Mes}", atestado.FechaIncidente.ToDateTime().Year, atestado.FechaIncidente.ToDateTime().Month);
            }

            return Ok(new 
            { 
                exito = true,
                mensaje = "Atestado policial registrado correctamente",
                atestadoId = atestadoId
            });
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogWarning(ex, "Error de negocio al registrar atestado");
            return BadRequest(new { exito = false, mensaje = ex.Message });
        }
        catch (ArgumentException ex)
        {
            _logger.LogWarning(ex, "Datos inválidos en atestado");
            return BadRequest(new { exito = false, mensaje = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al registrar atestado policial");
            return StatusCode(500, new { exito = false, mensaje = "Error interno del servidor" });
        }
    }

    /// <summary>
    /// Obtiene un atestado policial por su ID
    /// GET /api/atestadopolicial/{id}
    /// </summary>
    [FirebaseAuthGuardAttribute]
    [HttpGet("{id}")]
    public async Task<IActionResult> ObtenerPorId(string id)
    {
        try
        {
            var atestado = await _repository.ObtenerPorIdAsync(id);
            
            if (atestado == null)
            {
                return NotFound(new { mensaje = $"Atestado {id} no encontrado" });
            }

            return Ok(atestado);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al obtener atestado {Id}", id);
            return StatusCode(500, new { mensaje = "Error interno del servidor" });
        }
    }

    /// <summary>
    /// Obtiene el atestado asociado a una alerta específica
    /// GET /api/atestadopolicial/alerta/{alertaId}
    /// </summary>
    [HttpGet("alerta/{alertaId}")]
    public async Task<IActionResult> ObtenerPorAlerta(string alertaId)
    {
        try
        {
            var atestado = await _repository.ObtenerPorAlertaIdAsync(alertaId);
            
            if (atestado == null)
            {
                return NotFound(new { mensaje = $"No existe atestado para la alerta {alertaId}" });
            }

            return Ok(atestado);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al obtener atestado de alerta {AlertaId}", alertaId);
            return StatusCode(500, new { mensaje = "Error interno del servidor" });
        }
    }

    /// <summary>
    /// Obtiene todos los atestados de un patrullero
    /// GET /api/atestadopolicial/patrullero/{uid}
    /// </summary>
    [FirebaseAuthGuardAttribute]
    [HttpGet("patrullero/{uid}")]
    public async Task<IActionResult> ObtenerPorPatrullero(string uid)
    {
        try
        {
            // Verificar que el patrullero solo pueda ver sus propios atestados
            var uidToken = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            var esAdmin = User.IsInRole("admin");

            if (!esAdmin && uidToken != uid)
            {
                return Forbid();
            }

            var atestados = await _repository.ObtenerPorPatrulleroAsync(uid);
            return Ok(new { total = atestados.Count(), atestados });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al obtener atestados del patrullero {Uid}", uid);
            return StatusCode(500, new { mensaje = "Error interno del servidor" });
        }
    }

    /// <summary>
    /// Obtiene atestados por rango de fechas (requiere autenticación)
    /// GET /api/atestadopolicial/rango?fechaInicio=...&fechaFin=...
    /// </summary>
    [FirebaseAuthGuardAttribute]
    [HttpGet("rango")]
    // [Authorize(Roles = "admin")] // ❌ DESHABILITADO temporalmente para pruebas
    public async Task<IActionResult> ObtenerPorRango([FromQuery] DateTime fechaInicio, [FromQuery] DateTime fechaFin)
    {
        try
        {
            var atestados = await _repository.ObtenerPorRangoFechasAsync(fechaInicio, fechaFin);
            return Ok(new { total = atestados.Count(), atestados });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al obtener atestados por rango");
            return StatusCode(500, new { mensaje = "Error interno del servidor" });
        }
    }

    /// <summary>
    /// Obtiene atestados de un distrito específico (solo para admins)
    /// GET /api/atestadopolicial/distrito/{distrito}
    /// </summary>
    [FirebaseAuthGuardAttribute]
    [HttpGet("distrito/{distrito}")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> ObtenerPorDistrito(string distrito)
    {
        try
        {
            var atestados = await _repository.ObtenerPorDistritoAsync(distrito);
            return Ok(new { distrito, total = atestados.Count(), atestados });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al obtener atestados del distrito {Distrito}", distrito);
            return StatusCode(500, new { mensaje = "Error interno del servidor" });
        }
    }
}
