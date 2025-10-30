namespace WebAPI.Models
{
    public class CambiarEstadoRequestDto
    {
        public string alertaId { get; set; }
        public string patrulleroId { get; set; }
        public string nuevoEstado { get; set; }
    }
}