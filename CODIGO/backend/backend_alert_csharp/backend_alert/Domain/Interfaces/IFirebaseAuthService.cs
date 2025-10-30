using System.Threading.Tasks;
using Domain.Entities;
using FirebaseAdmin.Auth;
namespace Domain.Interfaces
{
    public interface IFirebaseAuthService
    {
        Task<UsuarioFirebaseDto> VerifyIdTokenAsync(string idToken);
    }

}