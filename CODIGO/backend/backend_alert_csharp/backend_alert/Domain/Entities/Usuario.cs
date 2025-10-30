namespace Domain.Entities
{
    public class Usuario
    {
        public string Uid { get; set; }
        public string Email { get; set; }
        public string Role { get; set; }

        public Usuario(string uid, string email, string role)
        {
            Uid = uid;
            Email = email;
            Role = role;
        }

        // Puedes agregar lógica como:
        public bool EsOperador() => Role == "operador";
        public bool EsPatrulla() => Role == "patrulla";
    }
}