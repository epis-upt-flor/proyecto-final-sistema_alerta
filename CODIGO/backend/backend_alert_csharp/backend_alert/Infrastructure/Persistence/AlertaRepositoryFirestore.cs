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

            await _firestoreDb.Collection("alertas").AddAsync(new
            {
                // 📋 Campos obligatorios (siempre presentes)
                devEUI = alerta.DevEUI,
                lat = alerta.Lat,
                lon = alerta.Lon,
                bateria = alerta.Bateria,
                timestamp = utcTimestamp,
                nombre_victima = alerta.NombreVictima,
                
                // 🆕 Campos opcionales (por defecto o nulos)
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
            await docRef.UpdateAsync(updates);
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
                
                // 🆔 IMPORTANTE: Obtener el ID del documento de Firestore
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

                // 🆕 Leer campos opcionales
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

                // 🆔 Crear alerta con el ID del documento incluido
                var alerta = new Alerta(
                    data.ContainsKey("devEUI") ? data["devEUI"]?.ToString() ?? "" : "",
                    lat,
                    lon,
                    bateria,
                    fecha,
                    deviceId,
                    nombreVictima,
                    estado,
                    fechaEnCamino,
                    fechaResuelto,
                    fechaTomada,
                    patrulleroAsignado
                );
                
                // 🆔 Asignar el ID del documento de Firestore
                alerta.Id = documentId;
                alertas.Add(alerta);
            }
            return alertas;
        }
    }
}