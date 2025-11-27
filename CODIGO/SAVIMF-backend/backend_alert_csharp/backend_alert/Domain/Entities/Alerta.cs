public enum AlertaEstado
{
    Disponible,
    Tomada,
    EnCamino,
    Resuelto,
    NoAtendida,
    Vencida  // 🔥 NUEVO ESTADO PARA ALERTAS QUE CUMPLIERON 10 MIN
}

public class Alerta
{
    // 🆔 ID del documento de Firestore (se asigna después de leer de BD)
    public string Id { get; set; } = "";

    // 📋 Campos obligatorios (siempre llenos)
    public string DevEUI { get; set; }
    public double Lat { get; set; }
    public double Lon { get; set; }
    public double Bateria { get; set; }
    public DateTime Timestamp { get; set; }  // ⏰ Se actualiza con cada evento
    public DateTime FechaCreacion { get; set; }  // 🏁 NO se actualiza, solo primera vez
    public string DeviceId { get; set; }
    public string NombreVictima { get; set; }

    // 🔥 NUEVOS CAMPOS PARA SISTEMA DE PRIORIDADES
    public int CantidadActivaciones { get; set; } = 1;
    public DateTime UltimaActivacion { get; set; }
    public string NivelUrgencia { get; set; } = "baja"; // baja, media, critica
    public bool EsRecurrente { get; set; } = false;

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
        FechaCreacion = timestamp;  // 🏁 Se asigna solo en la creación inicial
        DeviceId = deviceId;
        NombreVictima = nombreVictima;

        // � INICIALIZACIÓN NUEVOS CAMPOS
        CantidadActivaciones = 1;
        UltimaActivacion = timestamp;
        NivelUrgencia = "baja";
        EsRecurrente = false;

        // �🔧 Valores por defecto para campos opcionales
        Estado = "disponible";
        FechaEnCamino = null;
        FechaResuelto = null;
        FechaTomada = null;
        PatrulleroAsignado = "";
    }

    // 🆕 Constructor adicional para cuando se leen datos completos de la BD
    public Alerta(string devEUI, double lat, double lon, double bateria, DateTime timestamp, DateTime fechaCreacion,
                  string deviceId, string nombreVictima, string estado, DateTime? fechaEnCamino,
                  DateTime? fechaResuelto, DateTime? fechaTomada, string patrulleroAsignado,
                  int cantidadActivaciones = 1, DateTime? ultimaActivacion = null, string nivelUrgencia = "baja", bool esRecurrente = false)
    {
        DevEUI = devEUI;
        Lat = lat;
        Lon = lon;
        Bateria = bateria;
        Timestamp = timestamp;
        FechaCreacion = fechaCreacion;
        DeviceId = deviceId;
        NombreVictima = nombreVictima;
        Estado = estado;
        FechaEnCamino = fechaEnCamino;
        FechaResuelto = fechaResuelto;
        FechaTomada = fechaTomada;
        PatrulleroAsignado = patrulleroAsignado;

        // 🔥 NUEVOS CAMPOS
        CantidadActivaciones = cantidadActivaciones;
        UltimaActivacion = ultimaActivacion ?? timestamp;
        NivelUrgencia = nivelUrgencia;
        EsRecurrente = esRecurrente;
    }

    // 🎯 MÉTODO PARA CALCULAR NIVEL DE URGENCIA
    public string CalcularNivelUrgencia()
    {
        if (CantidadActivaciones >= 4) return "critica";
        if (CantidadActivaciones >= 2) return "media";
        return "baja";
    }

    // ⏰ MÉTODO PARA VERIFICAR SI DEBE ARCHIVARSE (5+ horas sin atender)
    public bool DebeArchivarse()
    {
        var tiempoLimite = FechaCreacion.AddHours(5);
        return DateTime.UtcNow > tiempoLimite && Estado == "disponible";
    }

    // 🕒 MÉTODO PARA VERIFICAR SI ESTÁ DENTRO DEL RANGO DE 10 MINUTOS
    public bool EstaDentroDelRango()
    {
        var tiempoLimite = UltimaActivacion.AddMinutes(10);
        return DateTime.UtcNow <= tiempoLimite;
    }

    // 🔥 MÉTODO PARA INCREMENTAR ACTIVACIONES
    public void IncrementarActivacion()
    {
        CantidadActivaciones++;
        UltimaActivacion = DateTime.UtcNow;
        Timestamp = DateTime.UtcNow; // Actualizar timestamp también

        // Actualizar nivel de urgencia automáticamente
        NivelUrgencia = CalcularNivelUrgencia();

        // Marcar como recurrente si se activa más de una vez
        if (CantidadActivaciones > 1)
        {
            EsRecurrente = true;
        }
    }

    // ❌ MÉTODO PARA MARCAR COMO VENCIDA (cuando se crea nueva alerta del mismo dispositivo)
    public void MarcarComoVencida()
    {
        Estado = "vencida";
    }

    // 🎯 MÉTODO PARA OBTENER ESTADO COMO ENUM
    public AlertaEstado EstadoAlerta
    {
        get
        {
            return Estado.ToLower() switch
            {
                "disponible" => AlertaEstado.Disponible,
                "tomada" => AlertaEstado.Tomada,
                "encamino" => AlertaEstado.EnCamino,
                "resuelto" => AlertaEstado.Resuelto,
                "noatendida" => AlertaEstado.NoAtendida,
                "vencida" => AlertaEstado.Vencida,
                _ => AlertaEstado.Disponible
            };
        }
    }
}