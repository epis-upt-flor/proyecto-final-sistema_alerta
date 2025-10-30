using Microsoft.AspNetCore.Mvc;
using System.Text.Json;
using Domain.Entities;
using WebAPI.Filters;
using Application.UseCases;
using WebAPI.Models;
using Domain.Interfaces;
using WebAPI.Hubs;
using Microsoft.AspNetCore.SignalR;


[ApiController]
[Route("api/[controller]")]
public class AlertaController : ControllerBase
{
    private readonly RegistrarAlertaUseCase _registrarAlertaUseCase;
    private readonly IUserRepositoryFirestore _userRepository; // Inyección del repo
    private readonly ListarAlertasUseCase _listarAlertasUseCase;
    private readonly IHubContext<AlertaHub> _hubContext; 
    private readonly IAlertaRepository _alertaRepository;

        public AlertaController(
        RegistrarAlertaUseCase registrarAlertaUseCase,
        ListarAlertasUseCase listarAlertasUseCase,
        IUserRepositoryFirestore userRepository,
        IHubContext<AlertaHub> hubContext,
        IAlertaRepository alertaRepository)
    {
        _registrarAlertaUseCase = registrarAlertaUseCase;
        _listarAlertasUseCase = listarAlertasUseCase;
        _userRepository = userRepository;
        _hubContext = hubContext;
        _alertaRepository = alertaRepository;
    }

    [HttpPost("lorawan-webhook")]
    public async Task<IActionResult> RegistrarLorawanWebhook([FromBody] JsonElement data)
    {
        Console.WriteLine(data.ToString()); // Log para depuración

        string? devEUI = null;
        string? deviceId = null;
        double? lat = null;
        double? lon = null;
        double? bateria = null;
        DateTime timestamp = DateTime.UtcNow;

        try
        {
            // DevEUI y DeviceId
            if (data.TryGetProperty("end_device_ids", out JsonElement endDeviceIds))
            {
                if (endDeviceIds.TryGetProperty("dev_eui", out JsonElement devEuiProp))
                    devEUI = devEuiProp.GetString();

                if (endDeviceIds.TryGetProperty("device_id", out JsonElement deviceIdProp))
                    deviceId = deviceIdProp.GetString();
            }

            // Uplink_message y payload
            if (data.TryGetProperty("uplink_message", out JsonElement uplinkMessage) &&
                uplinkMessage.TryGetProperty("frm_payload", out JsonElement frmPayloadProp) &&
                frmPayloadProp.ValueKind == JsonValueKind.String)
            {
                var frmPayloadBase64 = frmPayloadProp.GetString();
                if (!string.IsNullOrEmpty(frmPayloadBase64))
                {
                    byte[] decodedBytes;
                    try
                    {
                        decodedBytes = Convert.FromBase64String(frmPayloadBase64);
                    }
                    catch (FormatException)
                    {
                        return BadRequest(new { mensaje = "Formato de frm_payload inválido (no es Base64 válido)" });
                    }

                    string payloadDecoded = System.Text.Encoding.UTF8.GetString(decodedBytes);

                    using var doc = JsonDocument.Parse(payloadDecoded);
                    var payloadJson = doc.RootElement;

                    // GPS
                    if (payloadJson.TryGetProperty("GPS", out JsonElement gpsProp))
                    {
                        var gpsString = gpsProp.GetString();
                        if (!string.IsNullOrEmpty(gpsString))
                        {
                            var coords = gpsString.Split(',');
                            if (coords.Length == 2 &&
                                double.TryParse(coords[0], out var latVal) &&
                                double.TryParse(coords[1], out var lonVal))
                            {
                                lat = latVal;
                                lon = lonVal;
                            }
                        }
                    }

                    // Batería
                    if (payloadJson.TryGetProperty("Battery", out JsonElement batteryProp) &&
                        batteryProp.TryGetDouble(out var batteryVal))
                    {
                        bateria = batteryVal;
                    }
                }
            }

            // Fallback: ubicación por locations.user
            if ((lat == null || lon == null) &&
                data.TryGetProperty("uplink_message", out JsonElement uplinkMessage2) &&
                uplinkMessage2.TryGetProperty("locations", out JsonElement locations) &&
                locations.TryGetProperty("user", out JsonElement user))
            {
                if (user.TryGetProperty("latitude", out JsonElement latProp) &&
                    user.TryGetProperty("longitude", out JsonElement lonProp) &&
                    latProp.TryGetDouble(out var latVal) &&
                    lonProp.TryGetDouble(out var lonVal))
                {
                    lat = latVal;
                    lon = lonVal;
                }
            }

            // Timestamp
            if (data.TryGetProperty("received_at", out JsonElement receivedAtProp) &&
                receivedAtProp.ValueKind == JsonValueKind.String &&
                DateTime.TryParse(receivedAtProp.GetString(), out var ts))
            {
                timestamp = ts;
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error parseando Lorawan: {ex.Message}");
        }

        // Validación básica
        if (string.IsNullOrEmpty(devEUI) || lat == null || lon == null || bateria == null)
            return BadRequest(new { mensaje = "Datos incompletos o inválidos" });

        // Buscar víctima por deviceId
        UsuarioDto? victima = null;
        string nombreVictima = "Sin asignar";
        string apellidoVictima = "";
        string dniVictima = "";
        if (!string.IsNullOrEmpty(deviceId))
        {
            victima = await _userRepository.BuscarPorDeviceIdAsync(deviceId);
            if (victima != null)
            {
                nombreVictima = victima.Nombre;
                apellidoVictima = victima.Apellido;
                dniVictima = victima.Dni;
            }
        }

        // Guarda la alerta en Firestore
        var alerta = new Alerta(
            devEUI,
            lat.Value,
            lon.Value,
            bateria.Value,
            timestamp,
            deviceId,
            $"{nombreVictima} {apellidoVictima}"
        );
        await _registrarAlertaUseCase.EjecutarAsync(alerta);

        // --- ENVÍA LA ALERTA EN TIEMPO REAL AL FRONTEND WEB ---
        await _hubContext.Clients.All.SendAsync("RecibirAlerta", new {
            estado = "Despachada",
            nombre = nombreVictima,
            apellido = apellidoVictima,
            dni = dniVictima,
            lat = lat,
            lon = lon,
            bateria = bateria,
            timestamp = timestamp,
            device_id = deviceId, 
        });

        // Respuesta HTTP normal
        return Ok(new {
            estado = "Despachada",
            nombre = nombreVictima,
            apellido = apellidoVictima,
            dni = dniVictima,
            lat = lat,
            lon = lon,
            bateria = bateria,
            timestamp = timestamp,
            device_id = deviceId
        });
    }

    [FirebaseAuthGuardAttribute]
    [HttpGet("listar")]
    public async Task<IActionResult> ListarAlertas()
    {
        var alertas = await _listarAlertasUseCase.EjecutarAsync();
        var result = alertas.Select(a => new
        {
            id = a.Id,  // 🆔 ¡IMPORTANTE! Incluir el ID del documento
            estado = a.Estado ?? "disponible",  // Usar el estado real de la BD
            nombre = string.IsNullOrWhiteSpace(a.NombreVictima) ? "Sin asignar" : a.NombreVictima,
            lat = a.Lat,
            lon = a.Lon,
            bateria = a.Bateria,
            timestamp = a.Timestamp,
            device_id = a.DeviceId,
            devEUI = a.DevEUI,
            patrulleroAsignado = a.PatrulleroAsignado ?? "",
            fechaTomada = a.FechaTomada,
            fechaEnCamino = a.FechaEnCamino,
            fechaResuelto = a.FechaResuelto
        }).ToList();

        return Ok(result);
    }

    // ==================================================
    // Endpoint: Tomar una alerta (asignar patrullero)
    // POST /api/alerta/tomar
    // Body: { "alertaId": "id", "patrulleroId": "patrullero_123" }
    // ==================================================
    [FirebaseAuthGuardAttribute]
    [HttpPost("tomar")]
    public async Task<IActionResult> TomarAlerta([FromBody] WebAPI.Models.TomarAlertaRequestDto body)
    {
        if (body == null || string.IsNullOrEmpty(body.alertaId) || string.IsNullOrEmpty(body.patrulleroId))
            return BadRequest(new { mensaje = "alertaId y patrulleroId son requeridos" });

        try
        {
            var updates = new Dictionary<string, object>
            {
                { "patrulleroAsignado", body.patrulleroId },
                { "estado", "tomada" },
                { "fechaTomada", DateTime.UtcNow }
            };

            await _alertaRepository.UpdateFieldsAsync(body.alertaId, updates);
            return Ok(new { mensaje = "Alerta tomada correctamente" });
        }
        catch (Exception ex) when (ex.Message.Contains("No document to update"))
        {
            Console.WriteLine($"❌ Alerta no encontrada: {body?.alertaId}");
            return NotFound(new { 
                mensaje = $"La alerta con ID '{body.alertaId}' no existe",
                alertaIdEnviado = body.alertaId,
                sugerencia = "Verifica que el ID de la alerta sea correcto"
            });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error tomando alerta {body?.alertaId}: {ex.Message}");
            return StatusCode(500, new { mensaje = "Error interno al tomar la alerta" });
        }
    }

    // ==================================================
    // Endpoint: Cambiar estado de una alerta
    // POST /api/alerta/cambiar-estado
    // Body: { "alertaId": "id", "patrulleroId": "patrullero_123", "nuevoEstado": "enCamino" }
    // ==================================================
    [FirebaseAuthGuardAttribute]
    [HttpPost("cambiar-estado")]
    public async Task<IActionResult> CambiarEstado([FromBody] WebAPI.Models.CambiarEstadoRequestDto body)
    {
        if (body == null || string.IsNullOrEmpty(body.alertaId) || string.IsNullOrEmpty(body.nuevoEstado))
            return BadRequest(new { mensaje = "alertaId y nuevoEstado son requeridos" });

        try
        {
            var updates = new Dictionary<string, object>
            {
                { "estado", body.nuevoEstado }
            };

            if (!string.IsNullOrEmpty(body.patrulleroId))
                updates["patrulleroAsignado"] = body.patrulleroId;

            // Ajustar marcas de tiempo según el nuevo estado
            if (body.nuevoEstado.Equals("enCamino", StringComparison.OrdinalIgnoreCase))
            {
                updates["fechaEnCamino"] = DateTime.UtcNow;
            }
            else if (body.nuevoEstado.Equals("resuelto", StringComparison.OrdinalIgnoreCase)
                     || body.nuevoEstado.Equals("resuelta", StringComparison.OrdinalIgnoreCase)
                     || body.nuevoEstado.Equals("finalizada", StringComparison.OrdinalIgnoreCase))
            {
                updates["fechaResuelto"] = DateTime.UtcNow;
            }

            await _alertaRepository.UpdateFieldsAsync(body.alertaId, updates);
            return Ok(new { mensaje = "Estado de alerta actualizado" });
        }
        catch (Exception ex) when (ex.Message.Contains("No document to update"))
        {
            Console.WriteLine($"❌ Alerta no encontrada: {body?.alertaId}");
            return NotFound(new { 
                mensaje = $"La alerta con ID '{body.alertaId}' no existe",
                alertaIdEnviado = body.alertaId,
                sugerencia = "Verifica que el ID de la alerta sea correcto"
            });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error cambiando estado de alerta {body?.alertaId}: {ex.Message}");
            return StatusCode(500, new { mensaje = "Error interno al cambiar el estado" });
        }
    }
    
    [FirebaseAuthGuardAttribute]
    [HttpGet("cantidad")]
    public IActionResult CantidadAlertas()
    {
        return Ok(new { mensaje = "OK" });
    }
}