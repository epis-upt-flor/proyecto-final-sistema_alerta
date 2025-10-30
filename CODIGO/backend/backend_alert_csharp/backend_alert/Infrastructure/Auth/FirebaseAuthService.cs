using FirebaseAdmin;
using FirebaseAdmin.Auth;
using System.Threading.Tasks;
using Domain.Interfaces;
using WebAPI.Models; // Importa tu DTO

namespace Infrastructure.Auth
{
    public class FirebaseAuthService : IFirebaseAuthService
    {
        private readonly FirebaseApp _firebaseApp;
        public FirebaseAuthService(FirebaseApp firebaseApp)
        {
            _firebaseApp = firebaseApp;
        }

        public async Task<UsuarioFirebaseDto> VerifyIdTokenAsync(string idToken)
        {
            try
            {
                var firebaseAuth = FirebaseAuth.GetAuth(_firebaseApp);
                var decodedToken = await firebaseAuth.VerifyIdTokenAsync(idToken);
                var userRecord = await firebaseAuth.GetUserAsync(decodedToken.Uid);

                return new UsuarioFirebaseDto
                {
                    Uid = userRecord.Uid,
                    Email = userRecord.Email
                };
            }
            catch
            {
                throw new Exception("Token firebase inválido o expirado");
            }
        }
    }
}