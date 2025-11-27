using Google.Cloud.Firestore;
using FirebaseAdmin;
using Google.Apis.Auth.OAuth2;
using Domain.Interfaces;
using backend_alert.Domain.Interfaces;
using backend_alert.Domain.Entities;
using Infrastructure.Persistence;
using backend_alert.Infrastructure.Persistence;
using Infrastructure.Auth;
using Infrastructure.Services;
using Application.UseCases;
using backend_alert.Application.UseCases;
using Infrastructure.Communication;
using WebAPI.Hubs;
using Microsoft.AspNetCore.SignalR;

var builder = WebApplication.CreateBuilder(args);

// Configurar logging específico para SignalR
builder.Logging.ClearProviders();
builder.Logging.AddConsole();
builder.Logging.AddDebug();
builder.Logging.SetMinimumLevel(LogLevel.Debug);

// Configuración específica para categorías
builder.Logging.AddFilter("Microsoft.AspNetCore.SignalR", LogLevel.Debug);
builder.Logging.AddFilter("Microsoft.AspNetCore.Http.Connections", LogLevel.Debug);

// === CONFIGURACIÓN FIREBASE Y FIRESTORE ===

// Ruta al archivo de credenciales (ajusta según tu entorno)
string credentialsPath = "sis-alert-firebase-admin.json";
string projectId = "sis-alert-1e7a7";

// Inicializa FirebaseApp una sola vez y regístralo en DI
var firebaseApp = FirebaseApp.Create(new AppOptions
{
    Credential = GoogleCredential.FromFile(credentialsPath)
});
builder.Services.AddSingleton(firebaseApp);

// Registra FirestoreDb como Singleton en DI
builder.Services.AddSingleton(provider =>
{
    Environment.SetEnvironmentVariable("GOOGLE_APPLICATION_CREDENTIALS", credentialsPath);
    return FirestoreDb.Create(projectId);
});

// === REGISTRA SERVICIOS Y CASOS DE USO ===
builder.Services.AddScoped<IAlertaRepository, AlertaRepositoryFirestore>();
builder.Services.AddScoped<IPatrulleroRepository, PatrullaRepositoryFirestore>();
builder.Services.AddScoped<ValidadorDatosService>();
builder.Services.AddScoped<RegistrarAlertaUseCase>();
builder.Services.AddScoped<ActualizarUbicacionPatrullaUseCase>();
builder.Services.AddSingleton<UserRepositoryFirestore>();
builder.Services.AddScoped<LoginUseCase>();
builder.Services.AddScoped<IFirebaseAuthService, FirebaseAuthService>();
builder.Services.AddScoped<IUserRepositoryFirestore, UserRepositoryFirestore>();
builder.Services.AddScoped<RegistrarDispositivoTTSUseCase>();
builder.Services.AddScoped<ITTSDeviceService, TTSDeviceService>();
builder.Services.AddScoped<IDispositivoRepository, DispositivoRepositoryFirestore>();
builder.Services.AddScoped<BuscarUsuarioPorDniUseCase>();
builder.Services.AddScoped<VincularDispositivoUseCase>();
builder.Services.AddScoped<ListarDispositivosConVinculoUseCase>();
builder.Services.AddScoped<ListarAlertasUseCase>();
builder.Services.AddScoped<ListarUbicacionesPatrullasUseCase>();
builder.Services.AddScoped<RegistrarUsuarioUseCase>(); // 🆕 Nuevo caso de uso
builder.Services.AddScoped<ListarUsuariosUseCase>(); // 🆕 Nuevo caso de uso
builder.Services.AddScoped<EditarUsuarioUseCase>(); // 🆕 Nuevo caso de uso

// 🔥 === REGISTRO DEL NUEVO USECASE FCM ===
builder.Services.AddScoped<RegistrarTokenFcmUseCase>(); // 🚀 UseCase para FCM siguiendo Clean Architecture

// 🆕 Servicio FCM para notificaciones push
builder.Services.AddScoped<IFCMService, FCMService>();

// 🎯 === REGISTRO DE NUEVOS REPOSITORIOS Y USECASES (ATESTADOS + OPEN DATA) ===
builder.Services.AddScoped<IAtestadoPolicialRepository, AtestadoPolicialRepositoryFirestore>();
builder.Services.AddScoped<IOpenDataRepository, OpenDataRepositoryFirestore>();
builder.Services.AddScoped<RegistrarAtestadoPolicialUseCase>();
builder.Services.AddScoped<ObtenerOpenDataUseCase>();

// === CONFIGURACIÓN DE CORS ===
// En desarrollo: permitir cualquier origen
// En producción: usar dominio real (por ejemplo, https://sis-alert.pe)
builder.Services.AddCors(options =>
{
    options.AddPolicy("DefaultCorsPolicy", policy =>
    {
        policy.SetIsOriginAllowed(_ => true) // Permite CUALQUIER origen en desarrollo
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials(); // Necesario para SignalR
    });

    // Política específica para SignalR (más permisiva)
    options.AddPolicy("SignalRCorsPolicy", policy =>
    {
        policy.SetIsOriginAllowed(_ => true) // Permite cualquier origen para SignalR
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

// === SERVICIOS DE INFRAESTRUCTURA ===
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddControllers();
builder.Services.AddHttpClient(); // para IHttpClientFactory

// === CONFIGURACIÓN DE AUTENTICACIÓN FIREBASE JWT ===
builder.Services
    .AddAuthentication(options =>
    {
        // Configurar esquema por defecto como JWT Bearer
        options.DefaultAuthenticateScheme = Microsoft.AspNetCore.Authentication.JwtBearer.JwtBearerDefaults.AuthenticationScheme;
        options.DefaultChallengeScheme = Microsoft.AspNetCore.Authentication.JwtBearer.JwtBearerDefaults.AuthenticationScheme;
    })
    .AddJwtBearer(options =>
    {
        // Firebase Project ID
        options.Authority = $"https://securetoken.google.com/{projectId}";
        options.TokenValidationParameters = new Microsoft.IdentityModel.Tokens.TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = $"https://securetoken.google.com/{projectId}",
            ValidateAudience = true,
            ValidAudience = projectId,
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromMinutes(5) // Tolerancia de 5 minutos
        };
        
        // Configuración adicional para debugging
        options.Events = new Microsoft.AspNetCore.Authentication.JwtBearer.JwtBearerEvents
        {
            OnAuthenticationFailed = context =>
            {
                Console.WriteLine($"❌ Authentication failed: {context.Exception.Message}");
                return Task.CompletedTask;
            },
            OnTokenValidated = context =>
            {
                Console.WriteLine($"✅ Token validated for user: {context.Principal?.Identity?.Name}");
                return Task.CompletedTask;
            },
            OnChallenge = context =>
            {
                Console.WriteLine($"⚠️ Authentication challenge: {context.Error} - {context.ErrorDescription}");
                return Task.CompletedTask;
            }
        };
    });

builder.Services.AddAuthorization();

// Configuración mejorada de SignalR
builder.Services.AddSignalR(options =>
{
    options.EnableDetailedErrors = true; // Para debug
    options.KeepAliveInterval = TimeSpan.FromSeconds(15);
    options.ClientTimeoutInterval = TimeSpan.FromSeconds(60); // Aumentado
    options.HandshakeTimeout = TimeSpan.FromSeconds(30); // Aumentado
    options.MaximumReceiveMessageSize = 32 * 1024; // 32KB
    options.StreamBufferCapacity = 10;
}).AddJsonProtocol(options =>
{
    options.PayloadSerializerOptions.PropertyNamingPolicy = null; // Mantener nombres originales
});

var app = builder.Build();

// === CONFIGURACIÓN DEL PIPELINE ===
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();

// CORS debe ir antes de routing y auth
app.UseCors("DefaultCorsPolicy");

app.UseRouting();
app.UseAuthentication(); // Agregar Authentication middleware
app.UseAuthorization();  // Agregar Authorization middleware

// Mapea controladores
app.MapControllers();


// // Endpoint de diagnóstico para SignalR
// app.MapGet("/signalr-test", async (IHubContext<AlertaHub> hubContext) =>
// {
//     await hubContext.Clients.All.SendAsync("mensajePrueba", new
//     {
//         mensaje = "SignalR está funcionando correctamente",
//         timestamp = DateTime.UtcNow
//     });
//     return Results.Ok(new { mensaje = "Mensaje de prueba enviado via SignalR" });
// });

// // 🆕 Endpoint de prueba para FCM
// app.MapPost("/fcm-test", async (IFCMService fcmService, IUserRepositoryFirestore userRepository) =>
// {
//     try
//     {
//         var tokensFcm = await userRepository.ObtenerTokensFcmPorRoleAsync("patrullero", soloActivos: true);

//         if (!tokensFcm.Any())
//         {
//             return Results.BadRequest(new
//             {
//                 mensaje = "No hay tokens FCM de patrulleros para probar",
//                 sugerencia = "Asegúrate de que al menos un patrullero tenga token FCM registrado"
//             });
//         }

//         var data = new Dictionary<string, string>
//         {
//             ["type"] = "test_notification",
//             ["timestamp"] = DateTime.UtcNow.ToString("O")
//         };

//         int notificacionesEnviadas = await fcmService.EnviarNotificacionMultipleAsync(
//             tokensFcm,
//             "🧪 Prueba de Notificación",
//             "Esta es una notificación de prueba del sistema SAVIMF",
//             data
//         );

//         return Results.Ok(new
//         {
//             mensaje = $"Notificaciones FCM enviadas: {notificacionesEnviadas}/{tokensFcm.Count}",
//             tokensEncontrados = tokensFcm.Count,
//             notificacionesExitosas = notificacionesEnviadas
//         });
//     }
//     catch (Exception ex)
//     {
//         return Results.Problem($"Error enviando notificaciones FCM: {ex.Message}");
//     }
// });

// // 🆕 Endpoint de diagnóstico para ver usuarios en la BD
// app.MapGet("/debug-users", async (IUserRepositoryFirestore userRepository) =>
// {
//     try
//     {
//         // Ver todos los usuarios
//         var todosUsuarios = await userRepository.ListarUsuariosAsync(limite: 100);

//         // Filtrar por roles
//         var patrulleros = todosUsuarios.Where(u => u.Role == "patrullero").ToList();
//         var operadores = todosUsuarios.Where(u => u.Role == "operador").ToList();
//         var victimas = todosUsuarios.Where(u => u.Role == "victima").ToList();

//         // Usuarios con FCM tokens
//         var usuariosConFcm = todosUsuarios.Where(u => !string.IsNullOrEmpty(u.FcmToken)).ToList();

//         return Results.Ok(new
//         {
//             totalUsuarios = todosUsuarios.Count,
//             rolesSummary = new
//             {
//                 patrulleros = patrulleros.Count,
//                 operadores = operadores.Count,
//                 victimas = victimas.Count
//             },
//             fcmSummary = new
//             {
//                 usuariosConTokenFcm = usuariosConFcm.Count,
//                 patrullerosConFcm = patrulleros.Count(p => !string.IsNullOrEmpty(p.FcmToken))
//             },
//             usuarios = todosUsuarios.Select(u => new
//             {
//                 uid = u.Uid,
//                 email = u.Email,
//                 nombre = u.Nombre,
//                 role = u.Role,
//                 estado = u.Estado,
//                 tieneFcmToken = !string.IsNullOrEmpty(u.FcmToken),
//                 fcmToken = string.IsNullOrEmpty(u.FcmToken) ? null : u.FcmToken.Substring(0, Math.Min(20, u.FcmToken.Length)) + "...",
//                 ultimaConexion = u.UltimaConexion
//             }).ToList()
//         });
//     }
//     catch (Exception ex)
//     {
//         return Results.Problem($"Error obteniendo usuarios: {ex.Message}");
//     }
// });

// // 🆕 Endpoint temporal para simular registro de FCM token (SOLO PARA PRUEBAS)
// app.MapPost("/simulate-fcm-registration", async (IUserRepositoryFirestore userRepository) =>
// {
//     try
//     {
//         // Generar token FCM simulado
//         var tokenFcmSimulado = $"fakeToken_{Guid.NewGuid().ToString().Substring(0, 8)}_{DateTime.Now.Ticks}";

//         // Buscar el primer patrullero activo
//         var todosUsuarios = await userRepository.ListarUsuariosAsync(limite: 100);
//         var patrullero = todosUsuarios.FirstOrDefault(u => u.Role == "patrullero" && u.Estado == "activo");

//         if (patrullero == null)
//         {
//             return Results.BadRequest(new
//             {
//                 mensaje = "No se encontró ningún patrullero activo",
//                 sugerencia = "Asegúrate de tener al menos un usuario con role='patrullero' y estado='activo'"
//             });
//         }

//         // Actualizar el token FCM
//         var exito = await userRepository.ActualizarFcmTokenAsync(patrullero.Uid, tokenFcmSimulado);

//         if (exito)
//         {
//             return Results.Ok(new
//             {
//                 mensaje = "Token FCM simulado registrado exitosamente",
//                 usuario = new
//                 {
//                     uid = patrullero.Uid,
//                     email = patrullero.Email,
//                     nombre = patrullero.Nombre,
//                     role = patrullero.Role
//                 },
//                 tokenFcmSimulado = tokenFcmSimulado,
//                 nota = "Este es solo un token de prueba. En producción, el token debe venir de la aplicación móvil."
//             });
//         }
//         else
//         {
//             return Results.Problem("Error al actualizar el token FCM");
//         }
//     }
//     catch (Exception ex)
//     {
//         return Results.Problem($"Error: {ex.Message}");
//     }
// });


// // 🆕 Endpoint detallado para debug de FCM
// app.MapPost("/debug-fcm-token", async (HttpContext context, IUserRepositoryFirestore userRepository) =>
// {
//     try
//     {
//         using var reader = new StreamReader(context.Request.Body);
//         var body = await reader.ReadToEndAsync();

//         return Results.Ok(new
//         {
//             mensaje = "Debug FCM Token - Payload recibido",
//             headers = context.Request.Headers.ToDictionary(h => h.Key, h => h.Value.ToString()),
//             contentType = context.Request.ContentType,
//             bodyRaw = body,
//             timestamp = DateTime.UtcNow,
//             instrucciones = new
//             {
//                 endpoint = "POST /api/User/fcm-token",
//                 formatosAceptados = new[] {
//                     """{"fcmToken": "tu_token_aqui"}""",
//                     """{"token": "tu_token_aqui"}""",
//                     """{"registrationToken": "tu_token_aqui"}"""
//                 },
//                 requerido = "Header Authorization: Bearer {firebase_id_token}"
//             }
//         });
//     }
//     catch (Exception ex)
//     {
//         return Results.Problem($"Error en debug: {ex.Message}");
//     }
// });


// // Endpoint para interceptar requests a /negotiate (para debug)
// app.MapMethods("/negotiate", new[] { "GET", "POST", "OPTIONS" }, () =>
// {
//     return Results.BadRequest(new
//     {
//         error = "Endpoint incorrecto",
//         mensaje = "Use /alertaHub/negotiate en lugar de /negotiate",
//         correctEndpoint = "/alertaHub/negotiate",
//         timestamp = DateTime.UtcNow
//     });
// });


// Hub de SignalR con configuraciones específicas
app.MapHub<AlertaHub>("/alertaHub", options =>
{
    options.Transports = Microsoft.AspNetCore.Http.Connections.HttpTransportType.WebSockets |
                        Microsoft.AspNetCore.Http.Connections.HttpTransportType.LongPolling |
                        Microsoft.AspNetCore.Http.Connections.HttpTransportType.ServerSentEvents;
}); // Usar la política de CORS por defecto

app.Run();
