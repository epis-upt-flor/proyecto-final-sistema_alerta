using System.Threading.Tasks;
using Domain.Interfaces;
using Domain.Entities; // Importa la entidad Usuario
using FirebaseAdmin.Auth;

namespace Application.UseCases
{
    public class LoginUseCase
    {
        private readonly IFirebaseAuthService _firebaseAuthService;
        private readonly IUserRepositoryFirestore _userRepo;

        public LoginUseCase(
            IFirebaseAuthService firebaseAuthService,
            IUserRepositoryFirestore userRepo)
        {
            _firebaseAuthService = firebaseAuthService;
            _userRepo = userRepo;
        }

        // Ahora devuelve Usuario (la entidad), no LoginResult
        public async Task<Usuario?> EjecutarAsync(string token)
        {
            var userDto = await _firebaseAuthService.VerifyIdTokenAsync(token);
            var role = await _userRepo.GetRoleByUidAsync(userDto.Uid);

            if (string.IsNullOrEmpty(role))
                return null;

            return new Usuario(userDto.Uid, userDto.Email, role);
        }
    }
}