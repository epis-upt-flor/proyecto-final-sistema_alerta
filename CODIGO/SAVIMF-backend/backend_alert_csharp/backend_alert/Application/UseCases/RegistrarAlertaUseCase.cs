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

        public async Task EjecutarAsync(Alerta nuevaAlerta)
        {
            // 🔍 LÓGICA ORIGINAL - Buscar alertas recientes para el mismo dispositivo en los últimos 10 minutos
            var alertaReciente = await _alertaRepository.BuscarAlertaRecienteAsync(
                nuevaAlerta.DevEUI,
                DateTime.UtcNow.AddMinutes(-10) // Últimos 10 minutos
            );

            if (alertaReciente != null)
            {
                // 🔥 INCREMENTAR CONTADOR DE ACTIVACIONES (COMO ANTES)
                var nuevasCantidadActivaciones = alertaReciente.CantidadActivaciones + 1;
                var nuevoNivelUrgencia = CalcularNivelUrgencia(nuevasCantidadActivaciones);

                // Actualizar la alerta existente con los nombres de campos correctos + nuevos campos
                var updates = new Dictionary<string, object>
                {
                    { "lat", nuevaAlerta.Lat },
                    { "lon", nuevaAlerta.Lon },
                    { "bateria", nuevaAlerta.Bateria },
                    { "timestamp", DateTime.UtcNow },
                    { "cantidadActivaciones", nuevasCantidadActivaciones },
                    { "ultimaActivacion", DateTime.UtcNow },
                    { "nivelUrgencia", nuevoNivelUrgencia }
                };
                await _alertaRepository.UpdateFieldsAsync(alertaReciente.Id, updates);
            }
            else
            {
                // 🔥 FUERA DE 10 MIN - MARCAR ALERTAS ANTERIORES COMO VENCIDAS Y CREAR NUEVA
                try
                {
                    Console.WriteLine($"🔍 Buscando alertas anteriores para dispositivo: {nuevaAlerta.DevEUI}");

                    // 🔥 BUSCAR TODAS LAS ALERTAS DEL MISMO DISPOSITIVO QUE ESTÁN ACTIVAS
                    var todasLasAlertas = await _alertaRepository.ListarAlertasAsync();
                    var alertasDelMismoDispositivo = todasLasAlertas.Where(a =>
                        a.DevEUI == nuevaAlerta.DevEUI &&
                        (a.Estado == "disponible" || a.Estado == "tomada" || a.Estado == "encamino")
                    ).ToList();

                    Console.WriteLine($"📋 Encontradas {alertasDelMismoDispositivo.Count} alertas activas del dispositivo {nuevaAlerta.DevEUI}");

                    foreach (var alertaAnterior in alertasDelMismoDispositivo)
                    {
                        var updateVencida = new Dictionary<string, object>
                        {
                            { "estado", "vencida" }
                        };
                        await _alertaRepository.UpdateFieldsAsync(alertaAnterior.Id, updateVencida);
                        Console.WriteLine($"✅ Alerta {alertaAnterior.Id} marcada como VENCIDA");
                    }
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"❌ Error marcando alertas anteriores como vencidas: {ex.Message}");
                }

                // 🔍 VERIFICAR SI ES RECURRENTE
                try
                {
                    var alertasArchivadas = await _alertaRepository.BuscarAlertasArchivadasAsync(nuevaAlerta.DevEUI);

                    if (alertasArchivadas.Count > 0)
                    {
                        nuevaAlerta.EsRecurrente = true;
                        nuevaAlerta.NivelUrgencia = "critica";
                        Console.WriteLine($"🔁 Dispositivo {nuevaAlerta.DevEUI} marcado como RECURRENTE");
                    }
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"⚠️ Error verificando recurrencia: {ex.Message}");
                }

                // ➕ CREAR NUEVA ALERTA (FUERA DEL RANGO DE 10 MIN)
                await _alertaRepository.SaveAsync(nuevaAlerta);
                Console.WriteLine($"🆕 Nueva alerta creada para {nuevaAlerta.DevEUI}");
            }
        }

        // 🎯 MÉTODO PARA CALCULAR NIVEL DE URGENCIA BASADO EN ACTIVACIONES
        private string CalcularNivelUrgencia(int cantidadActivaciones)
        {
            if (cantidadActivaciones >= 4) return "critica";
            if (cantidadActivaciones >= 2) return "media";
            return "baja";
        }
    }
}