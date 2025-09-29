src/
 ├── domain/                       # 100% agnóstico (no depende de NestJS)
 │   ├── entities/                 # Entidades de negocio
 │   │    ├── alerta.entity.ts
 │   ├── value-objects/            # Reglas inmutables del dominio
 │   └── ports/                    # Interfaces (contratos)
 │        ├── alerta-repository.port.ts
 │
 ├── application/                  # Casos de uso (orquestan la lógica)
 │   ├── registrar-alerta.usecase.ts
 │
 ├── infrastructure/               # Implementaciones técnicas
 │   ├── persistence/              # DB adapters
 │   │    └── alerta-repository.firestore.ts
 │   ├── communication/            # LoRaWAN, SMS, Email, etc.
 │   ├── auth/                     # Seguridad
 |        └── firebase-auth.guard.ts
 |        └── firebase-auth.service.ts
 │   └── services/                 # Implementación de puertos
 │        └── validador-datos.service.ts
 ├── interface/                    # Entrada/Salida (controladores)
 │   └── rest/
 │        ├── alerta.controller.ts
 │
 ├── app.module.ts                 # Configuración raíz de Nest
 └── main.ts                       # Bootstrap


 -----------------------------------------------------------
 src/domain/entities/alerta.entity.ts
Define qué es una alerta (id, ubicación, estado, víctima, fecha, etc).

src/domain/ports/alerta-repository.port.ts
Define el contrato que deben implementar los repositorios de persistencia.

src/application/registrar-alerta.usecase.ts
Caso de uso que recibe los datos del TTS, crea la alerta y la guarda.

src/infrastructure/communication/lorawan.adapter.ts
Aquí va la lógica para recibir el JSON del TTS (webhook).

src/interface/rest/alerta.controller.ts
Endpoint POST /alerta/recibir → invoca el caso de uso.