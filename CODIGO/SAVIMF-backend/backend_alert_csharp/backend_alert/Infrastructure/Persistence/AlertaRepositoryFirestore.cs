using Google.Cloud.Firestore;
using System.Threading.Tasks;
using System.Collections.Generic;
using System;
using Domain.Entities;
using Domain.Interfaces;

namespace Infrastructure.Persistence
{
    public class AlertaRepositoryFirestore : IAlertaRepository
    {
        private readonly FirestoreDb _firestoreDb;

        public AlertaRepositoryFirestore(FirestoreDb firestoreDb)
        {
            _firestoreDb = firestoreDb;
        }

        public async Task SaveAsync(Alerta alerta)
        {
            // Asegura que el timestamp es UTC
            DateTime utcTimestamp = alerta.Timestamp.Kind == DateTimeKind.Utc
                ? alerta.Timestamp
                : alerta.Timestamp.ToUniversalTime();

            // Asegura que fechaCreacion también es UTC
            DateTime utcFechaCreacion = alerta.FechaCreacion.Kind == DateTimeKind.Utc
                ? alerta.FechaCreacion
                : alerta.FechaCreacion.ToUniversalTime();

            await _firestoreDb.Collection("alertas").AddAsync(new
            {
                // Campos obligatorios (siempre presentes)
                devEUI = alerta.DevEUI,
                lat = alerta.Lat,
                lon = alerta.Lon,
                bateria = alerta.Bateria,
                timestamp = utcTimestamp,
                fechaCreacion = utcFechaCreacion,  // 🏁 NO se actualiza nunca
                nombre_victima = alerta.NombreVictima,

                // 🔥 NUEVOS CAMPOS SISTEMA DE PRIORIDADES
                cantidadActivaciones = alerta.CantidadActivaciones,
                ultimaActivacion = utcTimestamp,
                nivelUrgencia = alerta.NivelUrgencia,
                esRecurrente = alerta.EsRecurrente,

                // Campos opcionales (por defecto o nulos)
                estado = alerta.Estado,
                fechaEnCamino = alerta.FechaEnCamino,
                fechaResuelto = alerta.FechaResuelto,
                fechaTomada = alerta.FechaTomada,
                patrulleroAsignado = alerta.PatrulleroAsignado
            });
        }

        // Actualiza campos específicos de una alerta por su Id
        public async Task UpdateFieldsAsync(string alertaId, IDictionary<string, object> updates)
        {
            if (string.IsNullOrEmpty(alertaId))
                throw new ArgumentException("alertaId es requerido", nameof(alertaId));

            var docRef = _firestoreDb.Collection("alertas").Document(alertaId);
            // Convertir DateTime en Timestamp para asegurar consistencia en Firestore
            var normalized = new Dictionary<string, object>();
            foreach (var kv in updates)
            {
                if (kv.Value is DateTime dt)
                {
                    normalized[kv.Key] = Google.Cloud.Firestore.Timestamp.FromDateTime(dt.ToUniversalTime());
                }
                else if (kv.Value is DateTimeOffset dto)
                {
                    normalized[kv.Key] = Google.Cloud.Firestore.Timestamp.FromDateTime(dto.UtcDateTime);
                }
                else
                {
                    normalized[kv.Key] = kv.Value!;
                }
            }

            Console.WriteLine($"[AlertaRepo] UpdateFieldsAsync: alertaId={alertaId} updates={{ {string.Join(", ", normalized.Keys)} }}");
            await docRef.UpdateAsync(normalized);
        }
        
        // Obtiene una alerta por su ID
        public async Task<Alerta?> ObtenerPorIdAsync(string alertaId)
        {
            if (string.IsNullOrEmpty(alertaId))
                return null;

            var docRef = _firestoreDb.Collection("alertas").Document(alertaId);
            var snapshot = await docRef.GetSnapshotAsync();

            if (!snapshot.Exists)
                return null;

            var data = snapshot.ToDictionary();
            string documentId = snapshot.Id;

            DateTime fecha = DateTime.MinValue;
            if (data.ContainsKey("timestamp") && data["timestamp"] is Google.Cloud.Firestore.Timestamp ts)
            {
                fecha = ts.ToDateTime();
            }

            double lat = data.ContainsKey("lat") ? Convert.ToDouble(data["lat"]) : 0;
            double lon = data.ContainsKey("lon") ? Convert.ToDouble(data["lon"]) : 0;
            double bateria = data.ContainsKey("bateria") ? Convert.ToDouble(data["bateria"]) : 0;

            string deviceId = data.ContainsKey("device_id") ? data["device_id"]?.ToString() ?? "" : "";
            string nombreVictima = data.ContainsKey("nombre_victima") ? data["nombre_victima"]?.ToString() ?? "Sin asignar" : "Sin asignar";

            string estado = data.ContainsKey("estado") ? data["estado"]?.ToString() ?? "disponible" : "disponible";
            string patrulleroAsignado = data.ContainsKey("patrulleroAsignado") ? data["patrulleroAsignado"]?.ToString() ?? "" : "";

            DateTime? fechaEnCamino = null;
            if (data.ContainsKey("fechaEnCamino") && data["fechaEnCamino"] is Google.Cloud.Firestore.Timestamp tsEnCamino)
            {
                fechaEnCamino = tsEnCamino.ToDateTime();
            }

            DateTime? fechaResuelto = null;
            if (data.ContainsKey("fechaResuelto") && data["fechaResuelto"] is Google.Cloud.Firestore.Timestamp tsResuelto)
            {
                fechaResuelto = tsResuelto.ToDateTime();
            }

            DateTime? fechaTomada = null;
            if (data.ContainsKey("fechaTomada") && data["fechaTomada"] is Google.Cloud.Firestore.Timestamp tsTomada)
            {
                fechaTomada = tsTomada.ToDateTime();
            }

            DateTime fechaCreacion = fecha;
            if (data.ContainsKey("fechaCreacion") && data["fechaCreacion"] is Google.Cloud.Firestore.Timestamp tsCreacion)
            {
                fechaCreacion = tsCreacion.ToDateTime();
            }

            int cantidadActivaciones = data.ContainsKey("cantidadActivaciones") ? Convert.ToInt32(data["cantidadActivaciones"]) : 1;

            DateTime ultimaActivacion = fecha;
            if (data.ContainsKey("ultimaActivacion") && data["ultimaActivacion"] is Google.Cloud.Firestore.Timestamp tsUltimaActivacion)
            {
                ultimaActivacion = tsUltimaActivacion.ToDateTime();
            }

            string nivelUrgencia = data.ContainsKey("nivelUrgencia") ? data["nivelUrgencia"]?.ToString() ?? "baja" : "baja";
            bool esRecurrente = data.ContainsKey("esRecurrente") ? Convert.ToBoolean(data["esRecurrente"]) : false;

            var alerta = new Alerta(
                data.ContainsKey("devEUI") ? data["devEUI"]?.ToString() ?? "" : "",
                lat,
                lon,
                bateria,
                fecha,
                fechaCreacion,
                deviceId,
                nombreVictima,
                estado,
                fechaEnCamino,
                fechaResuelto,
                fechaTomada,
                patrulleroAsignado,
                cantidadActivaciones,
                ultimaActivacion,
                nivelUrgencia,
                esRecurrente
            )
            {
                Id = documentId
            };

            return alerta;
        }
        
        public async Task<List<Alerta>> ListarAlertasAsync()
        {
            var snapshot = await _firestoreDb.Collection("alertas")
                .OrderByDescending("timestamp")
                .GetSnapshotAsync();

            var alertas = new List<Alerta>();
            foreach (var doc in snapshot.Documents)
            {
                var data = doc.ToDictionary();

                // IMPORTANTE: Obtener el ID del documento de Firestore
                string documentId = doc.Id;

                DateTime fecha = DateTime.MinValue;
                if (data.ContainsKey("timestamp") && data["timestamp"] is Google.Cloud.Firestore.Timestamp ts)
                {
                    fecha = ts.ToDateTime();
                }

                double lat = data.ContainsKey("lat") ? Convert.ToDouble(data["lat"]) : 0;
                double lon = data.ContainsKey("lon") ? Convert.ToDouble(data["lon"]) : 0;
                double bateria = data.ContainsKey("bateria") ? Convert.ToDouble(data["bateria"]) : 0;

                string deviceId = data.ContainsKey("device_id") ? data["device_id"]?.ToString() ?? "" : "";
                string nombreVictima = data.ContainsKey("nombre_victima") ? data["nombre_victima"]?.ToString() ?? "Sin asignar" : "Sin asignar";

                // Leer campos opcionales
                string estado = data.ContainsKey("estado") ? data["estado"]?.ToString() ?? "disponible" : "disponible";
                string patrulleroAsignado = data.ContainsKey("patrulleroAsignado") ? data["patrulleroAsignado"]?.ToString() ?? "" : "";

                // Fechas opcionales
                DateTime? fechaEnCamino = null;
                if (data.ContainsKey("fechaEnCamino") && data["fechaEnCamino"] is Google.Cloud.Firestore.Timestamp tsEnCamino)
                {
                    fechaEnCamino = tsEnCamino.ToDateTime();
                }

                DateTime? fechaResuelto = null;
                if (data.ContainsKey("fechaResuelto") && data["fechaResuelto"] is Google.Cloud.Firestore.Timestamp tsResuelto)
                {
                    fechaResuelto = tsResuelto.ToDateTime();
                }

                DateTime? fechaTomada = null;
                if (data.ContainsKey("fechaTomada") && data["fechaTomada"] is Google.Cloud.Firestore.Timestamp tsTomada)
                {
                    fechaTomada = tsTomada.ToDateTime();
                }

                // Leer fechaCreacion (si no existe, usar timestamp como fallback)
                DateTime fechaCreacion = fecha; // Fallback
                if (data.ContainsKey("fechaCreacion") && data["fechaCreacion"] is Google.Cloud.Firestore.Timestamp tsCreacion)
                {
                    fechaCreacion = tsCreacion.ToDateTime();
                }

                // 🔥 LEER NUEVOS CAMPOS SISTEMA DE PRIORIDADES
                int cantidadActivaciones = data.ContainsKey("cantidadActivaciones") ? Convert.ToInt32(data["cantidadActivaciones"]) : 1;

                DateTime ultimaActivacion = fecha; // Fallback
                if (data.ContainsKey("ultimaActivacion") && data["ultimaActivacion"] is Google.Cloud.Firestore.Timestamp tsUltimaActivacion)
                {
                    ultimaActivacion = tsUltimaActivacion.ToDateTime();
                }

                string nivelUrgencia = data.ContainsKey("nivelUrgencia") ? data["nivelUrgencia"]?.ToString() ?? "baja" : "baja";
                bool esRecurrente = data.ContainsKey("esRecurrente") ? Convert.ToBoolean(data["esRecurrente"]) : false;

                // Crear alerta con el ID del documento incluido
                var alerta = new Alerta(
                    data.ContainsKey("devEUI") ? data["devEUI"]?.ToString() ?? "" : "",
                    lat,
                    lon,
                    bateria,
                    fecha,
                    fechaCreacion,
                    deviceId,
                    nombreVictima,
                    estado,
                    fechaEnCamino,
                    fechaResuelto,
                    fechaTomada,
                    patrulleroAsignado,
                    cantidadActivaciones,
                    ultimaActivacion,
                    nivelUrgencia,
                    esRecurrente
                );

                // Asignar el ID del documento de Firestore
                alerta.Id = documentId;
                alertas.Add(alerta);
            }
            return alertas;
        }

        public async Task<Alerta?> BuscarAlertaRecienteAsync(string deviceId, DateTime desde)
        {
            var query = _firestoreDb.Collection("alertas")
                .WhereEqualTo("devEUI", deviceId)
                .WhereGreaterThanOrEqualTo("timestamp", desde);

            var snapshot = await query.GetSnapshotAsync();

            if (snapshot.Documents.Count > 0)
            {
                var doc = snapshot.Documents.First();
                var data = doc.ToDictionary();
                string documentId = doc.Id;

                // Leer los campos manualmente (como en ListarAlertasAsync)
                DateTime fecha = DateTime.MinValue;
                if (data.ContainsKey("timestamp") && data["timestamp"] is Google.Cloud.Firestore.Timestamp ts)
                {
                    fecha = ts.ToDateTime();
                }

                double lat = data.ContainsKey("lat") ? Convert.ToDouble(data["lat"]) : 0;
                double lon = data.ContainsKey("lon") ? Convert.ToDouble(data["lon"]) : 0;
                double bateria = data.ContainsKey("bateria") ? Convert.ToDouble(data["bateria"]) : 0;

                string devEUI = data.ContainsKey("devEUI") ? data["devEUI"]?.ToString() ?? "" : "";
                string deviceIdField = data.ContainsKey("device_id") ? data["device_id"]?.ToString() ?? "" : "";
                string nombreVictima = data.ContainsKey("nombre_victima") ? data["nombre_victima"]?.ToString() ?? "Sin asignar" : "Sin asignar";
                string estado = data.ContainsKey("estado") ? data["estado"]?.ToString() ?? "disponible" : "disponible";
                string patrulleroAsignado = data.ContainsKey("patrulleroAsignado") ? data["patrulleroAsignado"]?.ToString() ?? "" : "";

                // Leer fechaCreacion (si no existe, usar timestamp como fallback)
                DateTime fechaCreacion = fecha; // Fallback
                if (data.ContainsKey("fechaCreacion") && data["fechaCreacion"] is Google.Cloud.Firestore.Timestamp tsCreacion)
                {
                    fechaCreacion = tsCreacion.ToDateTime();
                }

                // 🔥 LEER NUEVOS CAMPOS EN BuscarAlertaRecienteAsync
                int cantidadActivaciones = data.ContainsKey("cantidadActivaciones") ? Convert.ToInt32(data["cantidadActivaciones"]) : 1;

                DateTime ultimaActivacion = fecha;
                if (data.ContainsKey("ultimaActivacion") && data["ultimaActivacion"] is Google.Cloud.Firestore.Timestamp tsUltimaActivacion)
                {
                    ultimaActivacion = tsUltimaActivacion.ToDateTime();
                }

                string nivelUrgencia = data.ContainsKey("nivelUrgencia") ? data["nivelUrgencia"]?.ToString() ?? "baja" : "baja";
                bool esRecurrente = data.ContainsKey("esRecurrente") ? Convert.ToBoolean(data["esRecurrente"]) : false;

                var alerta = new Alerta(devEUI, lat, lon, bateria, fecha, fechaCreacion, deviceIdField, nombreVictima, estado, null, null, null, patrulleroAsignado, cantidadActivaciones, ultimaActivacion, nivelUrgencia, esRecurrente);
                alerta.Id = documentId;
                return alerta;
            }

            return null;
        }

        // 🔥 BUSCAR ALERTAS ARCHIVADAS DE UN DISPOSITIVO (para detectar recurrencia)
        public async Task<List<Alerta>> BuscarAlertasArchivadasAsync(string deviceId)
        {
            try
            {
                var query = _firestoreDb.Collection("alertas")
                    .WhereEqualTo("devEUI", deviceId)
                    .WhereEqualTo("estado", "no-atendida");

                var snapshot = await query.GetSnapshotAsync();
                var alertas = new List<Alerta>();

                foreach (var doc in snapshot.Documents)
                {
                    var data = doc.ToDictionary();

                    // Crear una alerta simplificada (solo necesitamos saber que existe)
                    var alerta = new Alerta(
                        data.ContainsKey("devEUI") ? data["devEUI"]?.ToString() ?? "" : "",
                        0, 0, 0,
                        DateTime.UtcNow,
                        DateTime.UtcNow,
                        deviceId,
                        "Archivada",
                        "no-atendida", // estado requerido
                        null, null, null, "", // fechas y patrullero
                        1, DateTime.UtcNow, "baja", false // nuevos campos
                    );
                    alerta.Id = doc.Id;
                    alertas.Add(alerta);
                }

                return alertas;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error buscando alertas archivadas: {ex.Message}");
                return new List<Alerta>(); // Retornar lista vacía en caso de error
            }
        }

        // ⏰ ARCHIVAR ALERTAS VENCIDAS (5+ horas sin atender) - DESACTIVADO POR ÍNDICES
        public async Task ArchivarAlertasVencidas()
        {
            try
            {
                // 🚫 TEMPORALMENTE DESACTIVADO PARA EVITAR ERROR DE ÍNDICES
                Console.WriteLine("⚠️ Auto-archivado temporalmente desactivado (requiere índices Firestore)");
                return;

                /*
                var tiempoLimite = DateTime.UtcNow.AddHours(-5);
                
                var query = _firestoreDb.Collection("alertas")
                    .WhereEqualTo("estado", "disponible")
                    .WhereLessThan("fechaCreacion", tiempoLimite);

                var snapshot = await query.GetSnapshotAsync();

                Console.WriteLine($"🗂️ Encontradas {snapshot.Count} alertas para archivar (más de 5 horas)");

                foreach (var doc in snapshot.Documents)
                {
                    await doc.Reference.UpdateAsync(new Dictionary<string, object>
                    {
                        { "estado", "no-atendida" },
                        { "fechaArchivada", DateTime.UtcNow }
                    });
                }
                */
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ Error archivando alertas vencidas: {ex.Message}");
                // No lanzar excepción para no interrumpir el flujo principal
            }
        }

        // 📋 LISTAR SOLO ALERTAS ACTIVAS (no archivadas, no vencidas)
        public async Task<List<Alerta>> ListarAlertasActivasAsync()
        {
            try
            {
                // 🔥 CONSULTA SIMPLE SIN ÍNDICES COMPLEJOS
                var snapshot = await _firestoreDb.Collection("alertas")
                    .OrderByDescending("timestamp")
                    .GetSnapshotAsync();

                var alertas = new List<Alerta>();
                Console.WriteLine($"📋 Encontradas {snapshot.Count} alertas totales, filtrando manualmente...");

                foreach (var doc in snapshot.Documents)
                {
                    try
                    {
                        // Usar misma lógica que ListarAlertasAsync para convertir documentos
                        var data = doc.ToDictionary();
                        string documentId = doc.Id;

                        DateTime fecha = DateTime.MinValue;
                        if (data.ContainsKey("timestamp") && data["timestamp"] is Google.Cloud.Firestore.Timestamp ts)
                        {
                            fecha = ts.ToDateTime();
                        }

                        double lat = data.ContainsKey("lat") ? Convert.ToDouble(data["lat"]) : 0;
                        double lon = data.ContainsKey("lon") ? Convert.ToDouble(data["lon"]) : 0;
                        double bateria = data.ContainsKey("bateria") ? Convert.ToDouble(data["bateria"]) : 0;

                        string deviceId = data.ContainsKey("device_id") ? data["device_id"]?.ToString() ?? "" : "";
                        string nombreVictima = data.ContainsKey("nombre_victima") ? data["nombre_victima"]?.ToString() ?? "Sin asignar" : "Sin asignar";

                        string estado = data.ContainsKey("estado") ? data["estado"]?.ToString() ?? "disponible" : "disponible";
                        string patrulleroAsignado = data.ContainsKey("patrulleroAsignado") ? data["patrulleroAsignado"]?.ToString() ?? "" : "";

                        DateTime? fechaEnCamino = null;
                        if (data.ContainsKey("fechaEnCamino") && data["fechaEnCamino"] is Google.Cloud.Firestore.Timestamp tsEnCamino)
                        {
                            fechaEnCamino = tsEnCamino.ToDateTime();
                        }

                        DateTime? fechaResuelto = null;
                        if (data.ContainsKey("fechaResuelto") && data["fechaResuelto"] is Google.Cloud.Firestore.Timestamp tsResuelto)
                        {
                            fechaResuelto = tsResuelto.ToDateTime();
                        }

                        DateTime? fechaTomada = null;
                        if (data.ContainsKey("fechaTomada") && data["fechaTomada"] is Google.Cloud.Firestore.Timestamp tsTomada)
                        {
                            fechaTomada = tsTomada.ToDateTime();
                        }

                        DateTime fechaCreacion = fecha;
                        if (data.ContainsKey("fechaCreacion") && data["fechaCreacion"] is Google.Cloud.Firestore.Timestamp tsCreacion)
                        {
                            fechaCreacion = tsCreacion.ToDateTime();
                        }

                        int cantidadActivaciones = data.ContainsKey("cantidadActivaciones") ? Convert.ToInt32(data["cantidadActivaciones"]) : 1;

                        DateTime ultimaActivacion = fecha;
                        if (data.ContainsKey("ultimaActivacion") && data["ultimaActivacion"] is Google.Cloud.Firestore.Timestamp tsUltimaActivacion)
                        {
                            ultimaActivacion = tsUltimaActivacion.ToDateTime();
                        }

                        string nivelUrgencia = data.ContainsKey("nivelUrgencia") ? data["nivelUrgencia"]?.ToString() ?? "baja" : "baja";
                        bool esRecurrente = data.ContainsKey("esRecurrente") ? Convert.ToBoolean(data["esRecurrente"]) : false;

                        var alerta = new Alerta(
                            data.ContainsKey("devEUI") ? data["devEUI"]?.ToString() ?? "" : "",
                            lat,
                            lon,
                            bateria,
                            fecha,
                            fechaCreacion,
                            deviceId,
                            nombreVictima,
                            estado,
                            fechaEnCamino,
                            fechaResuelto,
                            fechaTomada,
                            patrulleroAsignado,
                            cantidadActivaciones,
                            ultimaActivacion,
                            nivelUrgencia,
                            esRecurrente
                        );

                        alerta.Id = documentId;

                        // 🔥 FILTRO MANUAL PARA EXCLUIR ALERTAS VENCIDAS Y ARCHIVADAS
                        if (estado != "no-atendida" && estado != "vencida")
                        {
                            alertas.Add(alerta);
                        }
                    }
                    catch (Exception ex)
                    {
                        Console.WriteLine($"⚠️ Error procesando alerta {doc.Id}: {ex.Message}");
                        // Continuar con la siguiente alerta
                    }
                }

                Console.WriteLine($"✅ Procesadas {alertas.Count} alertas activas correctamente");
                return alertas;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ Error listando alertas activas: {ex.Message}");
                // En caso de error, intentar usar el método original como fallback
                return await ListarAlertasAsync();
            }
        }

        // 🔍 BUSCAR ALERTAS POR DEVICE_ID Y TIEMPO (para implementar vencimiento automático)
        public async Task<List<Alerta>> BuscarAlertasPorDeviceIdYTiempoAsync(string devEUI, DateTime fechaDesde)
        {
            try
            {
                var snapshot = await _firestoreDb.Collection("alertas")
                    .WhereEqualTo("devEUI", devEUI)
                    .WhereGreaterThanOrEqualTo("fechaCreacion", fechaDesde)
                    .OrderByDescending("fechaCreacion")
                    .GetSnapshotAsync();

                var alertas = new List<Alerta>();
                Console.WriteLine($"🔍 Encontradas {snapshot.Count} alertas para deviceId {devEUI} desde {fechaDesde}");

                foreach (var doc in snapshot.Documents)
                {
                    try
                    {
                        var data = doc.ToDictionary();
                        string documentId = doc.Id;

                        DateTime fecha = DateTime.MinValue;
                        if (data.ContainsKey("timestamp") && data["timestamp"] is Google.Cloud.Firestore.Timestamp ts)
                        {
                            fecha = ts.ToDateTime();
                        }

                        double lat = data.ContainsKey("lat") ? Convert.ToDouble(data["lat"]) : 0;
                        double lon = data.ContainsKey("lon") ? Convert.ToDouble(data["lon"]) : 0;
                        double bateria = data.ContainsKey("bateria") ? Convert.ToDouble(data["bateria"]) : 0;

                        string deviceId = data.ContainsKey("device_id") ? data["device_id"]?.ToString() ?? "" : "";
                        string nombreVictima = data.ContainsKey("nombre_victima") ? data["nombre_victima"]?.ToString() ?? "Sin asignar" : "Sin asignar";

                        string estado = data.ContainsKey("estado") ? data["estado"]?.ToString() ?? "disponible" : "disponible";
                        string patrulleroAsignado = data.ContainsKey("patrulleroAsignado") ? data["patrulleroAsignado"]?.ToString() ?? "" : "";

                        DateTime? fechaEnCamino = null;
                        if (data.ContainsKey("fechaEnCamino") && data["fechaEnCamino"] is Google.Cloud.Firestore.Timestamp tsEnCamino)
                        {
                            fechaEnCamino = tsEnCamino.ToDateTime();
                        }

                        DateTime? fechaResuelto = null;
                        if (data.ContainsKey("fechaResuelto") && data["fechaResuelto"] is Google.Cloud.Firestore.Timestamp tsResuelto)
                        {
                            fechaResuelto = tsResuelto.ToDateTime();
                        }

                        DateTime? fechaTomada = null;
                        if (data.ContainsKey("fechaTomada") && data["fechaTomada"] is Google.Cloud.Firestore.Timestamp tsTomada)
                        {
                            fechaTomada = tsTomada.ToDateTime();
                        }

                        DateTime fechaCreacion = fecha;
                        if (data.ContainsKey("fechaCreacion") && data["fechaCreacion"] is Google.Cloud.Firestore.Timestamp tsCreacion)
                        {
                            fechaCreacion = tsCreacion.ToDateTime();
                        }

                        int cantidadActivaciones = data.ContainsKey("cantidadActivaciones") ? Convert.ToInt32(data["cantidadActivaciones"]) : 1;

                        DateTime ultimaActivacion = fecha;
                        if (data.ContainsKey("ultimaActivacion") && data["ultimaActivacion"] is Google.Cloud.Firestore.Timestamp tsUltimaActivacion)
                        {
                            ultimaActivacion = tsUltimaActivacion.ToDateTime();
                        }

                        string nivelUrgencia = data.ContainsKey("nivelUrgencia") ? data["nivelUrgencia"]?.ToString() ?? "baja" : "baja";
                        bool esRecurrente = data.ContainsKey("esRecurrente") ? Convert.ToBoolean(data["esRecurrente"]) : false;

                        var alerta = new Alerta(
                            data.ContainsKey("devEUI") ? data["devEUI"]?.ToString() ?? "" : "",
                            lat,
                            lon,
                            bateria,
                            fecha,
                            fechaCreacion,
                            deviceId,
                            nombreVictima,
                            estado,
                            fechaEnCamino,
                            fechaResuelto,
                            fechaTomada,
                            patrulleroAsignado,
                            cantidadActivaciones,
                            ultimaActivacion,
                            nivelUrgencia,
                            esRecurrente
                        );

                        alerta.Id = documentId;
                        alertas.Add(alerta);
                    }
                    catch (Exception ex)
                    {
                        Console.WriteLine($"⚠️ Error procesando alerta {doc.Id}: {ex.Message}");
                    }
                }

                Console.WriteLine($"✅ Procesadas {alertas.Count} alertas para deviceId {devEUI}");
                return alertas;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ Error buscando alertas por deviceId {devEUI}: {ex.Message}");
                return new List<Alerta>();
            }
        }

        // 📊 OBTENER ALERTAS POR RANGO DE FECHAS (para análisis y mapa de calor)
        public async Task<List<Alerta>> ObtenerAlertasPorRangoFechas(DateTime fechaInicio, DateTime fechaFin)
        {
            try
            {
                Console.WriteLine($"📊 Consultando alertas desde {fechaInicio:yyyy-MM-dd} hasta {fechaFin:yyyy-MM-dd}");

                var snapshot = await _firestoreDb.Collection("alertas")
                    .WhereGreaterThanOrEqualTo("fechaCreacion", fechaInicio)
                    .WhereLessThanOrEqualTo("fechaCreacion", fechaFin)
                    .OrderByDescending("fechaCreacion")
                    .GetSnapshotAsync();

                var alertas = new List<Alerta>();
                Console.WriteLine($"📋 Encontradas {snapshot.Count} alertas para análisis");

                foreach (var doc in snapshot.Documents)
                {
                    try
                    {
                        var data = doc.ToDictionary();
                        string documentId = doc.Id;

                        DateTime fecha = DateTime.MinValue;
                        if (data.ContainsKey("timestamp") && data["timestamp"] is Google.Cloud.Firestore.Timestamp ts)
                        {
                            fecha = ts.ToDateTime();
                        }

                        double lat = data.ContainsKey("lat") ? Convert.ToDouble(data["lat"]) : 0;
                        double lon = data.ContainsKey("lon") ? Convert.ToDouble(data["lon"]) : 0;
                        double bateria = data.ContainsKey("bateria") ? Convert.ToDouble(data["bateria"]) : 0;

                        string deviceId = data.ContainsKey("device_id") ? data["device_id"]?.ToString() ?? "" : "";
                        string nombreVictima = data.ContainsKey("nombre_victima") ? data["nombre_victima"]?.ToString() ?? "Sin asignar" : "Sin asignar";

                        string estado = data.ContainsKey("estado") ? data["estado"]?.ToString() ?? "disponible" : "disponible";
                        string patrulleroAsignado = data.ContainsKey("patrulleroAsignado") ? data["patrulleroAsignado"]?.ToString() ?? "" : "";

                        DateTime? fechaEnCamino = null;
                        if (data.ContainsKey("fechaEnCamino") && data["fechaEnCamino"] is Google.Cloud.Firestore.Timestamp tsEnCamino)
                        {
                            fechaEnCamino = tsEnCamino.ToDateTime();
                        }

                        DateTime? fechaResuelto = null;
                        if (data.ContainsKey("fechaResuelto") && data["fechaResuelto"] is Google.Cloud.Firestore.Timestamp tsResuelto)
                        {
                            fechaResuelto = tsResuelto.ToDateTime();
                        }

                        DateTime? fechaTomada = null;
                        if (data.ContainsKey("fechaTomada") && data["fechaTomada"] is Google.Cloud.Firestore.Timestamp tsTomada)
                        {
                            fechaTomada = tsTomada.ToDateTime();
                        }

                        DateTime fechaCreacion = fecha;
                        if (data.ContainsKey("fechaCreacion") && data["fechaCreacion"] is Google.Cloud.Firestore.Timestamp tsCreacion)
                        {
                            fechaCreacion = tsCreacion.ToDateTime();
                        }

                        int cantidadActivaciones = data.ContainsKey("cantidadActivaciones") ? Convert.ToInt32(data["cantidadActivaciones"]) : 1;

                        DateTime ultimaActivacion = fecha;
                        if (data.ContainsKey("ultimaActivacion") && data["ultimaActivacion"] is Google.Cloud.Firestore.Timestamp tsUltimaActivacion)
                        {
                            ultimaActivacion = tsUltimaActivacion.ToDateTime();
                        }

                        string nivelUrgencia = data.ContainsKey("nivelUrgencia") ? data["nivelUrgencia"]?.ToString() ?? "baja" : "baja";
                        bool esRecurrente = data.ContainsKey("esRecurrente") ? Convert.ToBoolean(data["esRecurrente"]) : false;

                        var alerta = new Alerta(
                            data.ContainsKey("devEUI") ? data["devEUI"]?.ToString() ?? "" : "",
                            lat,
                            lon,
                            bateria,
                            fecha,
                            fechaCreacion,
                            deviceId,
                            nombreVictima,
                            estado,
                            fechaEnCamino,
                            fechaResuelto,
                            fechaTomada,
                            patrulleroAsignado,
                            cantidadActivaciones,
                            ultimaActivacion,
                            nivelUrgencia,
                            esRecurrente
                        );

                        alerta.Id = documentId;
                        alertas.Add(alerta);
                    }
                    catch (Exception ex)
                    {
                        Console.WriteLine($"⚠️ Error procesando alerta para análisis {doc.Id}: {ex.Message}");
                    }
                }

                Console.WriteLine($"✅ Procesadas {alertas.Count} alertas para análisis");
                return alertas;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ Error consultando alertas por rango de fechas: {ex.Message}");
                return new List<Alerta>();
            }
        }
    }
}