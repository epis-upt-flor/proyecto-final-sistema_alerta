# 📋 SAVIMF Backend - Guía de Arquitectura e Interacciones

## 🏛️ Visión General del Sistema

El SAVIMF Backend es un sistema de alertas de emergencia construido con **Clean Architecture** que gestiona alertas IoT, patrullas y usuarios usando .NET 8, Firebase/Firestore y SignalR.

---

## 📁 Estructura del Proyecto

```
backend_alert/
├── 🎯 Domain/               # Núcleo del negocio (independiente)
├── 📋 Application/          # Casos de uso (lógica aplicación)
├── 🔧 Infrastructure/       # Implementaciones técnicas
└── 🌐 WebAPI/              # Controladores y DTOs
```

---

## 🎯 Domain Layer - El Corazón del Sistema

### 📂 `Domain/Entities/`

#### `Alerta.cs` - Entidad Principal
```csharp
// Representa una alerta de emergencia del sistema IoT
public class Alerta 
{
    public string Id { get; set; }           // ID único del documento Firestore
    public string DevEUI { get; set; }       // Identificador del dispositivo LoRaWAN
    public double Lat { get; set; }          // Latitud GPS
    public double Lon { get; set; }          // Longitud GPS
    public DateTime Timestamp { get; set; }  // Momento de la alerta
    public string Estado { get; set; }       // "Pendiente", "EnCamino", "Resuelto"
    // ... más propiedades
}
```

**💡 Cómo Interactúa:**
- **Creada por:** Webhook LoRaWAN → `AlertaController` → `RegistrarAlertaUseCase`
- **Modificada por:** Operadores via `AlertaController.TomarAlerta()` y `CambiarEstado()`
- **Persistida en:** Firestore via `AlertaRepositoryFirestore`
- **Notificada via:** SignalR `AlertaHub` a clientes conectados

#### `Patrulla.cs` - Ubicación de Patrullas
```csharp
// Rastrea la ubicación en tiempo real de las patrullas
public class Patrulla 
{
    public string PatrulleroId { get; set; }  // ID único del patrullero
    public double Lat { get; set; }           // Ubicación actual
    public double Lon { get; set; }
    public DateTime Timestamp { get; set; }   // Última actualización
}
```

**💡 Cómo Interactúa:**
- **Actualizada por:** App móvil → `PatrullaController.ActualizarUbicacion()` 
- **Consultada por:** Dashboard → `PatrullaController.ObtenerUbicaciones()`
- **Persistida en:** Firestore via `PatrullaRepositoryFirestore`

#### `Usuario.cs` - Usuarios del Sistema
```csharp
// Representa usuarios autenticados (operadores y patrullas)
public class Usuario 
{
    public string Uid { get; set; }     // Firebase Auth UID
    public string Email { get; set; }   // Email de autenticación  
    public string Role { get; set; }    // "operador" o "patrulla"
}
```

### 📂 `Domain/Interfaces/` - Contratos del Sistema

Estas interfaces definen **QUÉ** puede hacer el sistema, no **CÓMO**:

#### `IAlertaRepository.cs`
```csharp
// Contrato para gestionar alertas (independiente de la BD)
public interface IAlertaRepository 
{
    Task SaveAsync(Alerta alerta);                    // Guardar nueva alerta
    Task<List<Alerta>> ListarAlertasAsync();         // Obtener todas las alertas
    Task UpdateFieldsAsync(string alertaId, ...);    // Actualizar campos específicos
}
```

---

## 📋 Application Layer - Lógica de Negocio

### 📂 `Application/UseCases/` - Casos de Uso del Sistema

Cada archivo representa una **operación específica** del negocio:

#### `RegistrarAlertaUseCase.cs` - Procesar Nueva Alerta
```csharp
public class RegistrarAlertaUseCase 
{
    private readonly IAlertaRepository _alertaRepository;
    
    // 🔄 FLUJO DE EJECUCIÓN:
    public async Task EjecutarAsync(Alerta alerta)
    {
        // 1. Validar datos de la alerta
        // 2. Asignar ID único y timestamp
        // 3. Guardar en base de datos
        // 4. (El controller maneja notificación SignalR)
    }
}
```

**💡 Flujo Completo de una Alerta:**
1. **Dispositivo IoT** envía datos via LoRaWAN
2. **Webhook** llama a `AlertaController.RegistrarLorawanWebhook()`
3. **Controller** parsea JSON y crea entidad `Alerta`
4. **Controller** llama a `RegistrarAlertaUseCase.EjecutarAsync()`
5. **Use Case** valida y guarda via `IAlertaRepository`
6. **Controller** notifica via `AlertaHub` (SignalR)
7. **Clientes** reciben notificación en tiempo real

#### `ListarAlertasUseCase.cs` - Obtener Alertas
```csharp
// Simple: delega al repositorio para obtener todas las alertas
public async Task<List<Alerta>> EjecutarAsync()
{
    return await _alertaRepository.ListarAlertasAsync();
}
```

#### `ActualizarUbicacionPatrullaUseCase.cs` - Tracking GPS
```csharp
// Actualiza la ubicación de una patrulla específica
public async Task EjecutarAsync(string patrulleroId, double lat, double lon)
{
    var patrulla = new Patrulla(patrulleroId, lat, lon, DateTime.UtcNow);
    await _patrullaRepository.SaveAsync(patrulla);
}
```

#### `LoginUseCase.cs` - Autenticación Firebase
```csharp
public class LoginUseCase 
{
    // 🔐 PROCESO DE LOGIN:
    public async Task<Usuario?> EjecutarAsync(string firebaseToken)
    {
        // 1. Verificar token con Firebase Admin SDK
        var firebaseUser = await _firebaseAuthService.VerifyIdTokenAsync(token);
        
        // 2. Buscar rol del usuario en Firestore
        var role = await _userRepo.GetRoleByUidAsync(firebaseUser.Uid);
        
        // 3. Crear objeto Usuario completo
        return new Usuario(firebaseUser.Uid, firebaseUser.Email, role);
    }
}
```

---

## 🔧 Infrastructure Layer - Implementaciones Técnicas

### 📂 `Infrastructure/Persistence/` - Acceso a Datos

#### `AlertaRepositoryFirestore.cs` - Implementación Firestore
```csharp
public class AlertaRepositoryFirestore : IAlertaRepository 
{
    private readonly FirestoreDb _firestoreDb;
    
    // 💾 IMPLEMENTACIÓN ESPECÍFICA DE FIRESTORE:
    public async Task SaveAsync(Alerta alerta)
    {
        // 1. Obtener referencia de colección "alertas"
        var collection = _firestoreDb.Collection("alertas");
        
        // 2. Agregar documento y obtener ID generado
        var docRef = await collection.AddAsync(alerta);
        
        // 3. Actualizar entidad con ID del documento
        alerta.Id = docRef.Id;
    }
    
    public async Task<List<Alerta>> ListarAlertasAsync()
    {
        // 1. Query a Firestore ordenado por timestamp
        var snapshot = await _firestoreDb.Collection("alertas")
            .OrderByDescending("Timestamp")
            .GetSnapshotAsync();
            
        // 2. Convertir documentos a entidades
        var alertas = new List<Alerta>();
        foreach (var doc in snapshot.Documents)
        {
            var alerta = doc.ConvertTo<Alerta>();
            alerta.Id = doc.Id;  // ⚠️ CRÍTICO: Asignar ID del documento
            alertas.Add(alerta);
        }
        return alertas;
    }
}
```

**🔄 Patrón Repository en Acción:**
- **Abstracción:** `IAlertaRepository` (Domain)
- **Implementación:** `AlertaRepositoryFirestore` (Infrastructure)  
- **Beneficio:** Cambiar BD sin afectar lógica de negocio

### 📂 `Infrastructure/Auth/` - Autenticación

#### `FirebaseAuthService.cs` - Verificación JWT
```csharp
public class FirebaseAuthService : IFirebaseAuthService
{
    // 🔐 VERIFICAR TOKENS FIREBASE:
    public async Task<UsuarioFirebaseDto> VerifyIdTokenAsync(string idToken)
    {
        // 1. Verificar token con Firebase Admin SDK
        var decodedToken = await FirebaseAuth.DefaultInstance.VerifyIdTokenAsync(idToken);
        
        // 2. Extraer información del usuario
        return new UsuarioFirebaseDto 
        {
            Uid = decodedToken.Uid,
            Email = decodedToken.Claims.GetValueOrDefault("email")?.ToString()
        };
    }
}
```

### 📂 `Infrastructure/Communication/` - APIs Externas

#### `TTSDeviceService.cs` - The Things Stack Integration
```csharp
public class TTSDeviceService : ITTSDeviceService
{
    // 📡 INTEGRACIÓN CON THE THINGS STACK:
    public async Task RegistrarDispositivoAsync(string deviceId, string devEui, ...)
    {
        // 1. Preparar payload para TTS API
        var payload = new { 
            ids = new { device_id = deviceId, dev_eui = devEui },
            // ... más configuración LoRaWAN
        };
        
        // 2. HTTP POST a The Things Stack API
        var response = await _httpClient.PostAsync($"/applications/{appId}/devices", ...);
        
        // 3. Manejar respuesta y errores
    }
}
```

---

## 🌐 WebAPI Layer - Interfaz HTTP

### 📂 `WebAPI/Controllers/` - Endpoints REST

#### `AlertaController.cs` - API de Alertas
```csharp
[ApiController]
[Route("api/[controller]")]
public class AlertaController : ControllerBase 
{
    // 🎯 ENDPOINT PRINCIPAL - Recibir alertas LoRaWAN
    [HttpPost("lorawan-webhook")]
    public async Task<IActionResult> RegistrarLorawanWebhook([FromBody] JsonElement data)
    {
        // 1. 🔍 PARSEAR JSON del webhook LoRaWAN
        var devEUI = data.GetProperty("end_device_ids").GetProperty("dev_eui").GetString();
        var location = data.GetProperty("uplink_message").GetProperty("decoded_payload");
        var lat = location.GetProperty("latitude").GetDouble();
        var lon = location.GetProperty("longitude").GetDouble();
        
        // 2. 🏗️ CREAR ENTIDAD DE DOMINIO
        var alerta = new Alerta(devEUI, lat, lon, bateria, DateTime.UtcNow, deviceId, nombreVictima);
        
        // 3. 📋 EJECUTAR CASO DE USO
        await _registrarAlertaUseCase.EjecutarAsync(alerta);
        
        // 4. 📡 NOTIFICAR VIA SIGNALR
        await _hubContext.Clients.All.SendAsync("NuevaAlerta", alerta);
        
        // 5. ✅ RESPONDER AL WEBHOOK
        return Ok(new { mensaje = "Alerta registrada correctamente" });
    }
    
    // 🔐 ENDPOINT PROTEGIDO - Listar alertas (requiere auth)
    [FirebaseAuthGuard]
    [HttpGet("listar")]
    public async Task<IActionResult> ListarAlertas()
    {
        // 1. 📋 OBTENER ALERTAS VIA USE CASE
        var alertas = await _listarAlertasUseCase.EjecutarAsync();
        
        // 2. 📤 RETORNAR JSON CON IDs DE DOCUMENTO
        return Ok(alertas);  // ⚠️ Incluye alerta.Id para mobile app
    }
    
    // 👮 TOMAR ALERTA - Asignar patrulla
    [FirebaseAuthGuard]
    [HttpPost("tomar")]
    public async Task<IActionResult> TomarAlerta([FromBody] TomarAlertaRequestDto body)
    {
        // 1. 🔍 VALIDAR DATOS
        if (string.IsNullOrEmpty(body.alertaId) || string.IsNullOrEmpty(body.patrulleroId))
            return BadRequest("Faltan datos requeridos");
            
        // 2. 📝 ACTUALIZAR ESTADO VIA REPOSITORY
        var updates = new Dictionary<string, object>
        {
            ["Estado"] = "EnCamino",
            ["PatrulleroAsignado"] = body.patrulleroId,
            ["FechaTomada"] = DateTime.UtcNow
        };
        await _alertaRepository.UpdateFieldsAsync(body.alertaId, updates);
        
        // 3. 📡 NOTIFICAR CAMBIO
        await _hubContext.Clients.All.SendAsync("AlertaTomada", body.alertaId, body.patrulleroId);
        
        return Ok(new { mensaje = "Alerta asignada correctamente" });
    }
}
```

**🔄 Flujo Completo de Tomar Alerta:**
1. **Mobile App** envía POST con `alertaId` y `patrulleroId`
2. **FirebaseAuthGuard** verifica JWT token
3. **Controller** valida datos del DTO
4. **Controller** actualiza documento en Firestore
5. **SignalR** notifica a todos los clientes conectados
6. **Dashboard** recibe actualización en tiempo real

#### `PatrullaController.cs` - Tracking GPS
```csharp
[ApiController]
[Route("api/[controller]")]
public class PatrullaController : ControllerBase 
{
    // 📍 ACTUALIZAR UBICACIÓN GPS
    [FirebaseAuthGuard]
    [HttpPost("ubicacion")]
    public async Task<IActionResult> ActualizarUbicacionPatrulla([FromBody] UbicacionPatrullaDto body)
    {
        // 1. 🚁 EJECUTAR CASO DE USO DE TRACKING
        await _actualizarUbicacionUseCase.EjecutarAsync(body.PatrulleroId, body.Lat, body.Lon);
        
        // 2. 📡 NOTIFICAR VIA SIGNALR (tiempo real)
        await _hubContext.Clients.All.SendAsync("UbicacionPatrullaActualizada", body);
        
        return Ok();
    }
    
    // 🗺️ OBTENER TODAS LAS UBICACIONES
    [FirebaseAuthGuard]  
    [HttpGet("ubicaciones")]
    public async Task<IActionResult> ObtenerUbicacionesPatrullas()
    {
        // 1. 📋 OBTENER DATOS VIA USE CASE
        var patrullas = await _listarUbicacionesUseCase.EjecutarAsync();
        
        // 2. 🔄 CONVERTIR A DTO CON ESTADO CALCULADO
        var ubicacionesDto = patrullas.Select(p => new PatrullaUbicacionDto(p.PatrulleroId, p.Lat, p.Lon, p.Timestamp)).ToList();
        
        return Ok(ubicacionesDto);
    }
}
```

#### `AuthController.cs` - Login Firebase
```csharp
[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase 
{
    // 🔐 LOGIN CON FIREBASE
    [HttpPost("firebase")]
    public async Task<IActionResult> LoginWithFirebase([FromBody] LoginFirebaseRequestDto body)
    {
        // 1. ✅ VALIDAR TOKEN
        if (string.IsNullOrEmpty(body.token))
            return BadRequest("Token requerido");
            
        // 2. 🔐 EJECUTAR CASO DE USO DE LOGIN  
        var usuario = await _loginUseCase.EjecutarAsync(body.token);
        
        // 3. 🚫 VERIFICAR AUTORIZACIÓN
        if (usuario == null)
            return Unauthorized("Usuario sin rol asignado");
            
        // 4. ✅ RESPUESTA EXITOSA
        return Ok(new {
            token = body.token,
            user = new {
                uid = usuario.Uid,
                email = usuario.Email,
                role = usuario.Role
            }
        });
    }
}
```

### 📂 `WebAPI/Models/` - DTOs (Data Transfer Objects)

#### Request DTOs (Comandos Entrantes)
```csharp
// 👮 Comando para tomar una alerta
public class TomarAlertaRequestDto 
{
    public string alertaId { get; set; }      // ID del documento Firestore  
    public string patrulleroId { get; set; }  // UID del patrullero
}

// 🔐 Comando de login
public class LoginFirebaseRequestDto 
{
    public string token { get; set; }  // JWT token de Firebase Auth
}

// 📍 Comando de ubicación GPS
public class UbicacionPatrullaDto 
{
    public string PatrulleroId { get; set; }
    public double Lat { get; set; }
    public double Lon { get; set; }
    public DateTime Timestamp { get; set; }
}
```

#### Response DTOs (Datos Salientes)
```csharp
// 🗺️ Ubicación de patrulla con estado calculado
public class PatrullaUbicacionDto 
{
    public string PatrulleroId { get; set; }
    public double Lat { get; set; }
    public double Lon { get; set; }
    public DateTime Timestamp { get; set; }
    public string Estado { get; set; }  // "Activo", "Inactivo"
    public double MinutosDesdeUltimaActualizacion { get; set; }
    
    // 🧮 LÓGICA DE CÁLCULO DEL ESTADO
    public PatrullaUbicacionDto(string patrulleroId, double lat, double lon, DateTime timestamp)
    {
        PatrulleroId = patrulleroId;
        Lat = lat;
        Lon = lon;
        Timestamp = timestamp;
        
        // Calcular minutos desde última actualización
        MinutosDesdeUltimaActualizacion = (DateTime.UtcNow - timestamp).TotalMinutes;
        
        // Determinar estado basado en tiempo
        Estado = MinutosDesdeUltimaActualizacion > 30 ? "Inactivo" : "Activo";
    }
}
```

### 📂 `WebAPI/Hubs/` - SignalR (Tiempo Real)

#### `AlertaHub.cs` - Comunicación en Tiempo Real
```csharp
public class AlertaHub : Hub
{
    // 📡 EVENTOS QUE PUEDEN RECIBIR LOS CLIENTES:
    
    // 1. "NuevaAlerta" - Nueva alerta registrada
    // 2. "AlertaTomada" - Alerta asignada a patrulla  
    // 3. "EstadoAlertaCambiado" - Cambio de estado de alerta
    // 4. "UbicacionPatrullaActualizada" - GPS actualizado
    
    // 🔗 MANEJO DE CONEXIONES
    public override async Task OnConnectedAsync()
    {
        // Cliente conectado - listo para recibir notificaciones
        Console.WriteLine($"Cliente conectado: {Context.ConnectionId}");
        await base.OnConnectedAsync();
    }
}
```

**🔄 Flujo SignalR:**
1. **Cliente** (Dashboard/Mobile) se conecta al Hub
2. **Controller** ejecuta acción (crear alerta, actualizar ubicación)
3. **Controller** usa `IHubContext<AlertaHub>` para notificar
4. **SignalR** envía evento a todos los clientes conectados
5. **Clientes** actualizan UI automáticamente

### 📂 `WebAPI/Filters/` - Middlewares

#### `FirebaseAuthGuardAttribute.cs` - Protección de Endpoints
```csharp
public class FirebaseAuthGuardAttribute : Attribute, IAsyncAuthorizationFilter
{
    // 🛡️ FILTRO DE AUTORIZACIÓN AUTOMÁTICO
    public async Task OnAuthorizationAsync(AuthorizationFilterContext context)
    {
        // 1. 🔍 EXTRAER TOKEN DEL HEADER
        var authHeader = context.HttpContext.Request.Headers["Authorization"].FirstOrDefault();
        if (string.IsNullOrEmpty(authHeader) || !authHeader.StartsWith("Bearer "))
        {
            context.Result = new UnauthorizedResult();
            return;
        }
        
        var token = authHeader.Substring("Bearer ".Length).Trim();
        
        // 2. ✅ VERIFICAR CON FIREBASE
        try
        {
            var decodedToken = await FirebaseAuth.DefaultInstance.VerifyIdTokenAsync(token);
            var userRecord = await FirebaseAuth.DefaultInstance.GetUserAsync(decodedToken.Uid);
            
            // 3. 💾 GUARDAR USUARIO EN CONTEXTO
            context.HttpContext.Items["FirebaseUser"] = userRecord;
        }
        catch
        {
            // 4. 🚫 TOKEN INVÁLIDO
            context.Result = new UnauthorizedResult();
        }
    }
}
```

---

## 🔧 Configuración del Sistema

### `Program.cs` - Punto de Entrada
```csharp
var builder = WebApplication.CreateBuilder(args);

// 🔥 CONFIGURAR FIREBASE
var firebaseApp = FirebaseApp.Create(new AppOptions()
{
    Credential = GoogleCredential.FromFile("sis-alert-firebase-admin.json")
});

// 💾 CONFIGURAR FIRESTORE  
var firestoreDb = FirestoreDb.Create("sis-alert-fa176");
builder.Services.AddSingleton(firestoreDb);

// 💉 DEPENDENCY INJECTION - REPOSITORIOS
builder.Services.AddScoped<IAlertaRepository, AlertaRepositoryFirestore>();
builder.Services.AddScoped<IPatrulleroRepository, PatrullaRepositoryFirestore>();
builder.Services.AddScoped<IUserRepositoryFirestore, UserRepositoryFirestore>();

// 💉 DEPENDENCY INJECTION - CASOS DE USO
builder.Services.AddScoped<RegistrarAlertaUseCase>();
builder.Services.AddScoped<ListarAlertasUseCase>();
builder.Services.AddScoped<ActualizarUbicacionPatrullaUseCase>();
builder.Services.AddScoped<LoginUseCase>();

// 💉 DEPENDENCY INJECTION - SERVICIOS
builder.Services.AddScoped<IFirebaseAuthService, FirebaseAuthService>();
builder.Services.AddScoped<ITTSDeviceService, TTSDeviceService>();
builder.Services.AddHttpClient(); // Para TTSDeviceService

// 📡 CONFIGURAR SIGNALR
builder.Services.AddSignalR();

// 🌐 CONFIGURAR CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("DefaultCorsPolicy", policy =>
    {
        policy.WithOrigins("http://localhost:3000")  // Dashboard
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

var app = builder.Build();

// 🔧 CONFIGURAR PIPELINE
app.UseCors("DefaultCorsPolicy");
app.MapControllers();
app.MapHub<AlertaHub>("/alertaHub");  // SignalR endpoint

app.Run();
```

---

## 🔄 Flujos Principales del Sistema

### 1. 🚨 Flujo de Nueva Alerta (End-to-End)

```
[Dispositivo IoT] 
    ↓ HTTP POST (LoRaWAN)
[Webhook Provider] 
    ↓ HTTP POST /api/alerta/lorawan-webhook
[AlertaController.RegistrarLorawanWebhook()]
    ↓ Parse JSON + Create Alerta entity
[RegistrarAlertaUseCase.EjecutarAsync()]
    ↓ Validate + Business logic
[AlertaRepositoryFirestore.SaveAsync()]
    ↓ Firestore.Collection("alertas").AddAsync()
[Firestore Database]
    ↓ Return success
[AlertaController] 
    ↓ IHubContext<AlertaHub>.Clients.All.SendAsync("NuevaAlerta")
[SignalR Hub]
    ↓ WebSocket broadcast
[Dashboard + Mobile Apps]
    ↓ Real-time UI update
[Usuario Final]
```

### 2. 👮 Flujo de Tomar Alerta

```
[Mobile App Patrulla]
    ↓ HTTP POST /api/alerta/tomar + JWT token
[FirebaseAuthGuardAttribute]
    ↓ Verify JWT with Firebase
[AlertaController.TomarAlerta()]
    ↓ Receive TomarAlertaRequestDto
[AlertaRepositoryFirestore.UpdateFieldsAsync()]
    ↓ Update Firestore document fields
[Firestore Database]
    ↓ Document updated
[AlertaController]
    ↓ SignalR notification "AlertaTomada"
[Dashboard Operadores]
    ↓ Real-time update - alerta assigned
[Operadores]
```

### 3. 📍 Flujo de Tracking GPS

```
[Mobile App Patrulla]
    ↓ HTTP POST /api/patrulla/ubicacion every 30s
[FirebaseAuthGuardAttribute]
    ↓ JWT verification
[PatrullaController.ActualizarUbicacionPatrulla()]
    ↓ Receive UbicacionPatrullaDto
[ActualizarUbicacionPatrullaUseCase.EjecutarAsync()]
    ↓ Create Patrulla entity with GPS coords
[PatrullaRepositoryFirestore.SaveAsync()]
    ↓ Save to Firestore "patrullas" collection
[PatrullaController]
    ↓ SignalR "UbicacionPatrullaActualizada"
[Dashboard Map View]
    ↓ Real-time map marker update
[Operadores]
```

### 4. 🔐 Flujo de Autenticación

```
[Mobile App / Dashboard]
    ↓ Firebase Auth login (Google, Email/Password)
[Firebase Authentication]
    ↓ Return JWT ID token
[Client App]
    ↓ HTTP POST /api/auth/firebase + token
[AuthController.LoginWithFirebase()]
    ↓ Receive LoginFirebaseRequestDto
[LoginUseCase.EjecutarAsync()]
    ↓ VerifyIdTokenAsync() + GetRoleByUidAsync()
[FirebaseAuthService + UserRepositoryFirestore]
    ↓ Validate token + fetch user role
[AuthController]
    ↓ Return user object with role
[Client App]
    ↓ Store token + redirect based on role
[Dashboard or Mobile Interface]
```

---

## 🎯 Patrones de Diseño en Acción

### 🏗️ **Clean Architecture Pattern**
- **Domain** → Define QUÉ hace el sistema (entidades + interfaces)
- **Application** → Define CÓMO se ejecutan los casos de uso
- **Infrastructure** → Define CON QUÉ tecnologías (Firestore, Firebase, HTTP)
- **WebAPI** → Define la interfaz de comunicación (REST + SignalR)

### 📚 **Repository Pattern**
```
IAlertaRepository (Domain) ←→ AlertaRepositoryFirestore (Infrastructure)
```
- **Beneficio:** Cambiar de Firestore a MongoDB solo requiere nueva implementación
- **Testeo:** Mock IAlertaRepository para unit tests

### 🎯 **Use Case Pattern** 
```
Controller → Use Case → Repository → Database
```
- **Beneficio:** Lógica de negocio centralizada y reutilizable
- **Ejemplo:** `RegistrarAlertaUseCase` puede ser llamado desde Controller, background job, etc.

### 💉 **Dependency Injection Pattern**
```csharp
// Program.cs - Configuración
builder.Services.AddScoped<IAlertaRepository, AlertaRepositoryFirestore>();

// AlertaController - Uso
public AlertaController(IAlertaRepository alertaRepository) // ← DI automático
```

### 🔄 **Mediator Pattern**
```
HTTP Request → Controller → Use Case → Repository
```
- **Controllers** median entre HTTP y lógica de negocio
- **Use Cases** median entre Controllers y datos

### 📡 **Observer Pattern (SignalR)**
```csharp
// Publisher
await _hubContext.Clients.All.SendAsync("NuevaAlerta", alerta);

// Subscribers (JavaScript clients)
connection.on("NuevaAlerta", function (alerta) {
    // Update UI automatically
});
```

### 🛡️ **Decorator Pattern (Filters)**
```csharp
[FirebaseAuthGuardAttribute]  // ← Decorator adds auth functionality
[HttpPost("tomar")]
public async Task<IActionResult> TomarAlerta(...)
```

### 📝 **Command Pattern (DTOs)**
```csharp
// Commands encapsulate requests
public class TomarAlertaRequestDto  // ← Command object
{
    public string alertaId { get; set; }
    public string patrulleroId { get; set; }
}
```

---

## 📱 Integración con Clientes

### Mobile App (Flutter)
```dart
// Enviar ubicación GPS cada 30 segundos
Timer.periodic(Duration(seconds: 30), (timer) async {
  final position = await Geolocator.getCurrentPosition();
  
  await http.post(
    Uri.parse('$API_BASE/api/patrulla/ubicacion'),
    headers: {'Authorization': 'Bearer $firebaseToken'},
    body: jsonEncode({
      'PatrulleroId': currentUser.uid,
      'Lat': position.latitude,
      'Lon': position.longitude,
      'Timestamp': DateTime.now().toIso8601String(),
    }),
  );
});
```

### Dashboard (React/Angular)
```javascript
// SignalR connection para tiempo real
const connection = new signalR.HubConnectionBuilder()
    .withUrl("https://api.savimf.pe/alertaHub")
    .build();

// Suscribirse a eventos
connection.on("NuevaAlerta", (alerta) => {
    // Agregar nueva alerta a la tabla
    addAlertToTable(alerta);
    showNotification("Nueva alerta recibida");
});

connection.on("UbicacionPatrullaActualizada", (ubicacion) => {
    // Actualizar marcador en mapa
    updateMapMarker(ubicacion.PatrulleroId, ubicacion.Lat, ubicacion.Lon);
});
```

---

## 🚀 Despliegue y Configuración

### Variables de Entorno
```bash
# appsettings.Production.json
{
  "FirebaseProjectId": "sis-alert-fa176",
  "TTSApiUrl": "https://eu1.cloud.thethings.network",
  "TTSApiKey": "NNSXS.xxx...",
  "Cors": {
    "AllowedOrigins": ["https://dashboard.savimf.pe", "https://app.savimf.pe"]
  }
}
```

### Docker Deployment
```dockerfile
FROM mcr.microsoft.com/dotnet/aspnet:8.0
COPY . /app
WORKDIR /app
EXPOSE 80
ENTRYPOINT ["dotnet", "backend_alert.dll"]
```

---

## 🔍 Debugging y Monitoreo

### Logs Importantes
```csharp
// En cada controller
_logger.LogInformation("Alerta registrada: {AlertaId}", alerta.Id);
_logger.LogWarning("Token inválido para usuario: {UserId}", userId);
_logger.LogError(ex, "Error al guardar alerta: {Message}", ex.Message);
```

### Health Checks
```csharp
// Verificar conectividad a Firestore
public async Task<bool> CheckFirestoreHealth()
{
    try 
    {
        await _firestoreDb.Collection("health").Document("test").GetSnapshotAsync();
        return true;
    }
    catch 
    {
        return false;
    }
}
```

---

## 💡 Mejores Prácticas Implementadas

### ✅ **Seguridad**
- JWT tokens en todos los endpoints protegidos
- Validación de entrada en DTOs  
- CORS configurado para dominios específicos
- Firebase Admin SDK para verificación segura

### ✅ **Performance**
- SignalR para comunicación en tiempo real (vs polling)
- Singleton para conexiones Firebase/Firestore
- HttpClient factory para conexiones HTTP eficientes
- Queries Firestore optimizados con índices

### ✅ **Escalabilidad**
- Clean Architecture permite cambios sin romper sistema
- Repository pattern facilita cambio de base de datos
- Use Cases reutilizables entre diferentes interfaces
- DTOs permiten evolución de APIs sin romper clientes

### ✅ **Mantenibilidad**  
- Separación clara de responsabilidades
- Inyección de dependencias facilita testing
- Interfaces permiten mocking para unit tests
- Logging comprehensivo para debugging

---

Esta guía te da una visión completa de cómo cada archivo interactúa en tu sistema SAVIMF. El diseño modular y los patrones implementados hacen que sea fácil entender, mantener y escalar el sistema. 🚀