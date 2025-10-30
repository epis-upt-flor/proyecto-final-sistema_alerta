public class Alerta
{
    // 🆔 ID del documento de Firestore (se asigna después de leer de BD)
    public string Id { get; set; } = "";
    
    // 📋 Campos obligatorios (siempre llenos)
    public string DevEUI { get; set; }
    public double Lat { get; set; }
    public double Lon { get; set; }
    public double Bateria { get; set; }
    public DateTime Timestamp { get; set; }
    public string DeviceId { get; set; }
    public string NombreVictima { get; set; }

    // 🆕 Campos opcionales (se llenan después)
    public string Estado { get; set; }
    public DateTime? FechaEnCamino { get; set; }
    public DateTime? FechaResuelto { get; set; }
    public DateTime? FechaTomada { get; set; }
    public string PatrulleroAsignado { get; set; }

    public Alerta(string devEUI, double lat, double lon, double bateria, DateTime timestamp, string deviceId, string nombreVictima)
    {
        // Campos obligatorios
        DevEUI = devEUI;
        Lat = lat;
        Lon = lon;
        Bateria = bateria;
        Timestamp = timestamp;
        DeviceId = deviceId;
        NombreVictima = nombreVictima;

        // 🔧 Valores por defecto para campos opcionales
        Estado = "disponible";
        FechaEnCamino = null;
        FechaResuelto = null;
        FechaTomada = null;
        PatrulleroAsignado = "";
    }

    // 🆕 Constructor adicional para cuando se leen datos completos de la BD
    public Alerta(string devEUI, double lat, double lon, double bateria, DateTime timestamp, 
                  string deviceId, string nombreVictima, string estado, DateTime? fechaEnCamino,
                  DateTime? fechaResuelto, DateTime? fechaTomada, string patrulleroAsignado)
    {
        DevEUI = devEUI;
        Lat = lat;
        Lon = lon;
        Bateria = bateria;
        Timestamp = timestamp;
        DeviceId = deviceId;
        NombreVictima = nombreVictima;
        Estado = estado;
        FechaEnCamino = fechaEnCamino;
        FechaResuelto = fechaResuelto;
        FechaTomada = fechaTomada;
        PatrulleroAsignado = patrulleroAsignado;
    }
}