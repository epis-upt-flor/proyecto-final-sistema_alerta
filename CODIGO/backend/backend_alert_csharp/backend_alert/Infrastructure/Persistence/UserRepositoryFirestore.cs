using Google.Cloud.Firestore;
using System.Threading.Tasks;
using Domain.Interfaces;
using WebAPI.Models;
using System.Collections.Generic;

namespace Infrastructure.Persistence
{
    public class UserRepositoryFirestore : IUserRepositoryFirestore
    {
        private readonly FirestoreDb _firestoreDb;

        public UserRepositoryFirestore(FirestoreDb firestoreDb)
        {
            _firestoreDb = firestoreDb;
        }

        public async Task<UsuarioDto?> BuscarPorDniAsync(string dni)
        {
            Console.WriteLine($"[BuscarPorDniAsync] Buscando en Firestore por DNI: [{dni}]");
            var query = _firestoreDb.Collection("users").WhereEqualTo("dni", dni);
            var snapshot = await query.GetSnapshotAsync();
            Console.WriteLine($"[BuscarPorDniAsync] Cantidad de documentos encontrados: {snapshot.Documents.Count}");
            foreach (var doc in snapshot.Documents)
            {
                Console.WriteLine($"[BuscarPorDniAsync] Documento encontrado: {doc.Id}");
                return doc.ConvertTo<UsuarioDto>();
            }
            Console.WriteLine("[BuscarPorDniAsync] No se encontró ningún usuario con ese DNI.");
            return null;
        }

        public async Task<UsuarioDto?> BuscarPorUidAsync(string uid)
        {
            var docRef = _firestoreDb.Collection("users").Document(uid);
            var snapshot = await docRef.GetSnapshotAsync();
            if (!snapshot.Exists)
                return null;
            return snapshot.ConvertTo<UsuarioDto>();
        }

        public async Task<List<UsuarioDto>> BuscarPorRolAsync(string rol)
        {
            var query = _firestoreDb.Collection("users").WhereEqualTo("role", rol);
            var snapshot = await query.GetSnapshotAsync();
            var usuarios = new List<UsuarioDto>();
            foreach (var doc in snapshot.Documents)
            {
                usuarios.Add(doc.ConvertTo<UsuarioDto>());
            }
            return usuarios;
        }

        public async Task<string?> GetRoleByUidAsync(string uid)
        {
            var docRef = _firestoreDb.Collection("users").Document(uid);
            var snapshot = await docRef.GetSnapshotAsync();
            if (!snapshot.Exists)
                return null;
            return snapshot.GetValue<string>("role");
        }

        public async Task VincularDispositivoAsync(VincularDispositivoDto vincularDto)
        {
            var dni = vincularDto.Dni;
            var deviceId = vincularDto.DeviceId;

            var query = _firestoreDb.Collection("users").WhereEqualTo("dni", dni);
            var snapshot = await query.GetSnapshotAsync();
            foreach (var doc in snapshot.Documents)
            {
                await doc.Reference.UpdateAsync(new Dictionary<string, object>
                {
                    { "device_id", deviceId }
                });
                return;
            }
            throw new Exception("Usuario no encontrado para vincular.");
        }

        public async Task<UsuarioDto?> BuscarPorDeviceIdAsync(string deviceId)
        {
            var query = _firestoreDb.Collection("users").WhereEqualTo("device_id", deviceId);
            var snapshot = await query.GetSnapshotAsync();
            foreach (var doc in snapshot.Documents)
            {
                return doc.ConvertTo<UsuarioDto>();
            }
            return null;
        }
    }
}