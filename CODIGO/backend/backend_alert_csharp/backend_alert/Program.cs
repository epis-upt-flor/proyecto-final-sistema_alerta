using Google.Cloud.Firestore;
using FirebaseAdmin;
using Google.Apis.Auth.OAuth2;
using Domain.Interfaces;
using Infrastructure.Persistence;
using Infrastructure.Auth;
using Infrastructure.Services;
using Application.UseCases;
using Infrastructure.Communication;
using WebAPI.Hubs;

var builder = WebApplication.CreateBuilder(args);

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

// === CONFIGURACIÓN DE CORS ===
// En desarrollo: http://localhost:3000
// En producción: usar dominio real (por ejemplo, https://sis-alert.pe)
var allowedOrigins = builder.Configuration
    .GetSection("Cors:AllowedOrigins")
    .Get<string[]>() ?? new[] { "http://localhost:3000" };

builder.Services.AddCors(options =>
{
    options.AddPolicy("DefaultCorsPolicy", policy =>
    {
        policy.WithOrigins(allowedOrigins)
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
builder.Services.AddSignalR();

var app = builder.Build();

// === CONFIGURACIÓN DEL PIPELINE ===
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();

// Aplica la política CORS configurada
app.UseCors("DefaultCorsPolicy");

// Mapea controladores y hubs
app.MapControllers();
app.MapHub<AlertaHub>("/alertaHub");

app.Run();
