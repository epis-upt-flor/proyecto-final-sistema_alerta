# Documentación Completa del Proyecto SAVIMF

**Autor:** DFVNicolle

## Índice
1. [Introducción](#introducción)
2. [Arquitectura General](#arquitectura-general)
3. [Aplicación Móvil (SAVIMF-app)](#aplicación-móvil-savimf-app)
4. [Backend (SAVIMF-backend)](#backend-savimf-backend)
5. [Dispositivo IoT (SAVIMF-dispositivo)](#dispositivo-iot-savimf-dispositivo)
6. [Aplicación Web (SAVIMF-web)](#aplicación-web-savimf-web)
7. [Contribuciones](#contribuciones)
8. [Licencia](#licencia)

---

## Introducción
El proyecto SAVIMF (Sistema de Alerta y Vigilancia Integrada para Manejo de Flotas) es una solución integral que combina tecnologías móviles, backend, IoT y web para ofrecer un sistema robusto de monitoreo y gestión de flotas. Este documento detalla cada componente del sistema, su propósito y cómo interactúan entre sí.

---

## Arquitectura General
El sistema está compuesto por los siguientes módulos:
- **Aplicación Móvil:** Permite a los usuarios interactuar con el sistema desde sus dispositivos móviles.
- **Backend:** Gestiona la lógica de negocio y la comunicación entre los diferentes componentes.
- **Dispositivo IoT:** Recoge datos en tiempo real desde los vehículos.
- **Aplicación Web:** Proporciona una interfaz administrativa para la gestión y monitoreo.

![Diagrama de Arquitectura](SAVIMF-backend/backend_alert_csharp/diagrama-arquitectura-backend.puml)

---

## Aplicación Móvil (SAVIMF-app)

### Descripción General
SAVIMF App es una aplicación móvil desarrollada en Flutter que forma parte del ecosistema de soluciones SAVIMF. Su propósito principal es asistir a patrulleros en la gestión de alertas de emergencia, proporcionando herramientas para la localización, comunicación y registro de incidentes.

### Características Principales
- **Gestión de Alertas:** Visualización y actualización del estado de alertas en tiempo real.
- **Integración con Firebase:** Uso de Firebase para autenticación, notificaciones push y almacenamiento en la nube.
- **Mapas Interactivos:** Integración con Google Maps para mostrar ubicaciones y rutas.
- **Registro de Atestados Policiales:** Formulario detallado para registrar incidentes resueltos.
- **Notificaciones:** Manejo de notificaciones en primer plano, segundo plano y cuando la aplicación está cerrada.

### Estructura del Código
El proyecto está organizado de la siguiente manera:

#### `lib/`
Contiene el código fuente principal de la aplicación.

##### **`main.dart`**
Archivo de entrada principal de la aplicación. Realiza las siguientes tareas:
- Inicializa Firebase.
- Configura el manejador de notificaciones en segundo plano.
- Lanza la aplicación con la pantalla de bienvenida (`WelcomeScreen`).

##### **`firebase_options.dart`**
Archivo generado automáticamente por FlutterFire CLI. Contiene las configuraciones específicas de Firebase para cada plataforma.

##### **`models/`**
Define las clases de datos utilizadas en la aplicación:
- **`alert.dart`**: Representa una alerta de emergencia, incluyendo su estado, ubicación, nivel de urgencia y detalles adicionales.
- **`patrulla_ubicacion.dart`**: Representa la ubicación y estado de una patrulla.

##### **`screens/`**
Contiene las pantallas principales de la aplicación:
- **`welcome_screen.dart`**: Pantalla de bienvenida con opciones para iniciar sesión o registrarse.
- **`login_screen.dart`**: Pantalla de inicio de sesión con validación de credenciales.
- **`mapa_screen.dart`**: Pantalla principal que muestra un mapa interactivo con alertas y rutas.
- **`atestado_policial_screen.dart`**: Formulario para registrar atestados policiales después de resolver una alerta.
- **`notification_test_screen.dart`**: Pantalla para probar y verificar el estado de las notificaciones.
- **`patrol_map_screen.dart`**: Pantalla para enviar la ubicación de la patrulla periódicamente.

##### **`services/`**
Implementa la lógica de negocio y servicios:
- **`notification_service.dart`**: Manejo de notificaciones push.
- **`fcm_service.dart`**: Gestión de tokens y configuración de Firebase Cloud Messaging.
- **`user_service.dart`**: Servicios relacionados con el usuario, como registro de tokens y latidos periódicos.

##### **`widgets/`**
Componentes reutilizables de la interfaz de usuario.

### Tecnologías Utilizadas
- **Flutter:** Framework principal para el desarrollo de la aplicación.
- **Firebase:**
  - Autenticación.
  - Cloud Messaging para notificaciones push.
  - Firestore para almacenamiento de datos.
- **Google Maps API:** Para mostrar mapas y calcular rutas.
- **HTTP:** Para comunicación con el backend.

### Flujo de Trabajo
1. **Inicio de Sesión:**
   - Los usuarios inician sesión con Firebase Authentication.
   - El token de Firebase se valida en el backend para asignar roles.

2. **Gestión de Alertas:**
   - Las alertas activas se cargan desde el backend.
   - Los patrulleros pueden tomar alertas, cambiar su estado y registrar atestados.

3. **Notificaciones:**
   - Las notificaciones se manejan en diferentes estados de la aplicación (abierta, en segundo plano, cerrada).

4. **Mapas y Rutas:**
   - Se muestran las ubicaciones de las alertas y las rutas hacia ellas.
   - Las rutas se actualizan dinámicamente según la ubicación del patrullero.

### Instalación y Configuración
1. Clonar el repositorio:
   ```bash
   git clone https://github.com/DFVNicolle/SAVIMF-app.git
   ```

2. Instalar las dependencias:
   ```bash
   flutter pub get
   ```

3. Configurar Firebase:
   - Descargar el archivo `google-services.json` para Android y `GoogleService-Info.plist` para iOS desde Firebase Console.
   - Colocarlos en los directorios correspondientes (`android/app/` y `ios/Runner/`).

4. Ejecutar la aplicación:
   ```bash
   flutter run
   ```

---

## Backend - SAVIMF-backend

## Estructura del Backend
El backend está desarrollado en .NET Core y sigue los principios de Clean Architecture. A continuación, se describen los componentes principales:

### Application
- **RegistrarAtestadoPolicialUseCase.cs**: 
  - **Propósito**: Caso de uso para registrar un atestado policial.
  - **Detalles**:
    - Valida que el atestado sea válido.
    - Verifica que no exista un atestado previo para la alerta.
    - Marca la alerta como resuelta y genera datos anónimos para Open Data.
    - Actualiza estadísticas agregadas del distrito y periodo.
    - **Patrones**: Use Case (Clean Architecture) + Command (CQRS).

- **ObtenerOpenDataUseCase.cs**: 
  - **Propósito**: Caso de uso para obtener datos de Open Data.
  - **Detalles**:
    - Obtiene incidentes individuales por periodo.
    - Recupera estadísticas agregadas por distrito y periodo.
    - Genera estadísticas globales para dashboards públicos.
    - **Patrones**: Use Case (Clean Architecture) + Query (CQRS).

### Domain
- **Interfaces/IAtestadoPolicialRepository.cs**: 
  - **Propósito**: Define las operaciones básicas para interactuar con la base de datos de atestados policiales.
  - **Métodos Clave**:
    - `ObtenerTodosAsync`: Recupera todos los atestados.
    - `GuardarAsync`: Almacena un nuevo atestado.
    - `RegenerarOpenDataDelMes`: Regenera datos de Open Data para un mes específico.
    - `ObtenerPorDistritoAsync`: Filtra atestados por distrito.

### Infrastructure
- **Persistence/UserRepositoryFirestore.cs**: 
  - **Propósito**: Implementación del repositorio de usuarios utilizando Firestore.
  - **Detalles**:
    - Métodos para buscar usuarios por DNI, UID o rol.
    - Vinculación de dispositivos con usuarios.
    - Registro de usuarios con roles específicos (patrullero/operador).
    - Gestión de tokens FCM y actualización de última conexión.
    - **Ejemplo**:
      - `RegistrarUsuarioAsync`: Registra un usuario en Firestore con datos como email, DNI, rol y estado.
      - `ActualizarFcmTokenAsync`: Actualiza el token FCM y la última conexión del usuario.

### WebAPI
- **Controllers/UserController.cs**: 
  - **Propósito**: Controlador para gestionar usuarios.
  - **Endpoints Clave**:
    - `GET /api/User/buscar`: Busca un usuario por DNI.
    - `POST /api/User/vincular-dispositivo`: Vincula un dispositivo a un usuario.
    - `POST /api/User/registrar`: Registra un nuevo usuario con rol y credenciales.
    - `GET /api/User/listar`: Lista usuarios con filtros opcionales (rol, límite).
    - `POST /api/User/fcm-token`: Registra o actualiza el token FCM del usuario autenticado.
    - `POST /api/User/heartbeat`: Actualiza el timestamp de última conexión del usuario.
  - **Detalles**:
    - Implementa casos de uso como `RegistrarUsuarioUseCase` y `VincularDispositivoUseCase`.
    - Maneja validaciones y errores comunes en los endpoints.

## Funcionalidades Clave
- **Registro de Atestados Policiales**: 
  - Permite registrar atestados, validar datos y generar estadísticas para Open Data.
  - Incluye la actualización de alertas y estadísticas agregadas.

- **Gestión de Usuarios**: 
  - Registro, edición y vinculación de dispositivos.
  - Gestión de roles y autenticación con Firebase.

- **Integración con Firestore**: 
  - Persistencia de datos de usuarios y alertas.
  - Gestión de tokens FCM y estadísticas de conexión.

- **Estadísticas de Open Data**: 
  - Generación de estadísticas globales y por distrito para visualización pública.

## Tecnologías Utilizadas
- **.NET Core**: Framework principal para el backend.
- **Google Firestore**: Base de datos NoSQL para persistencia.
- **Clean Architecture**: Organización del código en capas para mantener la separación de responsabilidades.
- **Firebase Admin SDK**: Gestión de usuarios y roles personalizados.

## Pruebas
Se recomienda ejecutar las pruebas unitarias y de integración para validar el correcto funcionamiento de los casos de uso y controladores. Ejemplo:

```bash
# Restaurar dependencias
 dotnet restore

# Ejecutar pruebas
 dotnet test
```

---

## Dispositivo IoT (SAVIMF-dispositivo)

### Descripción
El dispositivo IoT está basado en PlatformIO y se encarga de recopilar datos en tiempo real desde los vehículos y enviarlos al backend.

### Estructura del Código
- **`src/`**: Código fuente principal.
- **`lib/`**: Librerías adicionales.
- **`include/`**: Archivos de cabecera.

### Configuración
1. Instalar dependencias:
   ```bash
   platformio lib install
   ```
2. Compilar y subir el firmware:
   ```bash
   platformio run --target upload
   ```

---

## Aplicación Web (SAVIMF-web)

### Descripción
La aplicación web está desarrollada en TypeScript y React. Proporciona una interfaz administrativa para la gestión y monitoreo de flotas.

### Estructura del Código
- **`src/`**: Código fuente principal.
- **`public/`**: Archivos estáticos.
- **`build/`**: Archivos generados tras la compilación.

### Configuración
1. Instalar dependencias:
   ```bash
   npm install
   ```
2. Ejecutar la aplicación:
   ```bash
   npm start
   ```

---

# Aplicación Web - SAVIMF-web

## Estructura de la Aplicación Web
La aplicación web está desarrollada en React y TypeScript. Proporciona una interfaz administrativa para la gestión y monitoreo de flotas. A continuación, se describen los componentes principales:

### Estructura del Código

#### `src/App.tsx`
- **Propósito**: Punto de entrada principal de la aplicación.
- **Detalles**:
  - Configura las rutas utilizando `react-router-dom`.
  - Implementa rutas protegidas con `PrivateRoute` para garantizar que solo usuarios autenticados accedan a ciertas páginas.
  - Integra Google Maps mediante `@react-google-maps/api`.
  - **Rutas Clave**:
    - `/alerts`: Historial de alertas.
    - `/users`: Gestión de usuarios.
    - `/devices`: Gestión de dispositivos.
    - `/dashboard`: Panel principal.

#### `src/services/api.ts`
- **Propósito**: Configuración de Axios para realizar solicitudes HTTP al backend.
- **Detalles**:
  - Define la base URL del backend.
  - Agrega un interceptor para incluir el token de autenticación en las cabeceras.
  - Maneja advertencias específicas de ngrok.

#### `src/context/AuthContext.tsx`
- **Propósito**: Proporciona un contexto de autenticación para la aplicación.
- **Detalles**:
  - Define el estado del usuario y funciones para iniciar y cerrar sesión.
  - Utiliza el servicio `api` para realizar la autenticación.
  - Almacena el token de autenticación en `localStorage`.

#### `src/config/googleMaps.ts`
- **Propósito**: Configuración centralizada para Google Maps.
- **Detalles**:
  - Define la clave de la API de Google Maps.
  - Especifica las bibliotecas necesarias (`places`, `geometry`, `visualization`)

#### `src/pages/Alerts.tsx`
- **Propósito**: Página para mostrar el historial de alertas.
- **Detalles**:
  - Renderiza un componente `AlertList` para listar las alertas.
  - Permite agregar filtros y opciones de exportación.

### Componentes Clave
- **`components/`**: Contiene componentes reutilizables como formularios, tablas y listas.
- **`pages/`**: Define las páginas principales de la aplicación.
- **`services/`**: Implementa la lógica para interactuar con el backend.
- **`context/`**: Proporciona contextos globales como autenticación.
- **`config/`**: Almacena configuraciones centralizadas como claves de API.

### Funcionalidades Clave
- **Gestión de Alertas**: Visualización y filtrado del historial de alertas.
- **Gestión de Usuarios**: Registro, edición y eliminación de usuarios.
- **Gestión de Dispositivos**: Administración de dispositivos vinculados a usuarios.
- **Integración con Google Maps**: Visualización de ubicaciones y rutas.
- **Autenticación**: Inicio y cierre de sesión, protección de rutas.

### Tecnologías Utilizadas
- **React**: Framework principal para el desarrollo de la interfaz.
- **TypeScript**: Tipado estático para mayor robustez.
- **Axios**: Cliente HTTP para interactuar con el backend.
- **Google Maps API**: Para mostrar mapas y calcular rutas.
- **React Router**: Manejo de rutas y navegación.

### Instalación y Configuración
1. Clonar el repositorio:
   ```bash
   git clone https://github.com/DFVNicolle/SAVIMF-web.git
   ```
2. Instalar dependencias:
   ```bash
   npm install
   ```
3. Configurar variables de entorno:
   - Crear un archivo `.env` en la raíz del proyecto.
   - Agregar la clave de la API de Google Maps:
     ```env
     REACT_APP_GOOGLE_MAPS_API_KEY=clave
     ```
4. Ejecutar la aplicación:
   ```bash
   npm start
   ```

---

## Licencia
Este proyecto está licenciado bajo la Licencia MIT. Para más detalles, consulta el archivo `LICENSE`.

---

**Creado por DFVNicolle**



