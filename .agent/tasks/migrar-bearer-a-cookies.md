# Plan: Migrar de Authorization Bearer a Cookies HTTP-Only

## Contexto

Auth-MS actualmente usa `Authorization: Bearer <token>` para access tokens y un header custom `refresh-token` para refresh tokens. Los tokens se retornan en el body JSON. No hay cookies, no hay CORS configurado, no hay `cookie-parser`.

### Problema a resolver

1. Migrar a cookies HTTP-only para `auth_token` y `refresh_token`.
2. Los tokens dejan de retornarse en el body JSON (login y refresh solo setean cookies).
3. Los endpoints consumidos por otros microservicios (`can-do` y `me`) requieren doble autenticación: API key del microservicio + Bearer token del usuario.
4. El esquema actual de JWT + Redis sessions se mantiene intacto.

---

## Análisis del estado actual

| Componente | Archivo | Descripción |
|---|---|---|
| `AuthGuard` | `src/middlewares/auth.middleware.ts` | Extrae Bearer de `Authorization` header, valida JWT, carga sesión de Redis |
| `JwtService` | `src/services/JWT/jwt.service.ts` | Genera/valida tokens, lógica de refresh con rotación condicional |
| `UsersService.login()` | `src/services/users/users.service.ts` | Crea sesión en Redis, retorna `{ accessToken, refreshToken }` en body |
| `UsersService.refreshToken()` | `src/services/users/users.service.ts` | Recibe refresh token del header `refresh-token` |
| `UsersService.logout()` | `src/services/users/users.service.ts` | Borra sesión de Redis |
| `UsersController` | `src/services/users/users.controller.ts` | Endpoints: login, logout, refresh-token, can-do, me, etc. |
| `main.ts` | `src/main.ts` | Trust proxy habilitado, no hay CORS ni cookie-parser |
| `ApiKeyGuard` | `src/middlewares/api-key.middleware.ts` | Auth M2M por `x-api-key` |

---

## Decisiones de diseño

### 1. Cookies como único canal para el frontend — Bearer + API key para endpoints inter-microservicio

**El frontend nunca recibe tokens en el body.** Login y refresh solo setean cookies HTTP-only. El frontend no tiene acceso a los tokens desde JavaScript — son completamente opacos.

El header `Authorization: Bearer` se mantiene **exclusivamente** para los endpoints consumidos por otros microservicios (`can-do` y `me`), nunca por el navegador directamente. Todos los demás endpoints protegidos solo aceptan cookies.

**Endpoints inter-microservicio** (usan doble auth: API key + Bearer):
- `GET /users/can-do/:permission` — Verificación de permisos del usuario.
- `GET /users/me` — Obtener datos del usuario logueado. Usado por `RequestContextMiddleware` de otros microservicios y para auditoría.

**Justificación**:
- **Seguridad máxima**: Sin tokens en el body, no hay posibilidad de almacenamiento inseguro en localStorage/sessionStorage.
- **Simplicidad**: El frontend no necesita lógica de manejo de tokens. Las cookies se envían automáticamente.
- **Separación clara**: Cookies = frontend humano. Bearer + API key = microservicio.

### 2. Endpoints inter-microservicio con doble autenticación (API key + Bearer)

Los endpoints `can-do` y `me` son los puntos de entrada para que **otros microservicios** consulten datos y permisos de un usuario. Ambos requieren **doble autenticación**:

1. **API key** (`x-api-key` header): Identifica y autoriza al microservicio que llama. Usa el `ApiKeyGuard` existente.
2. **Bearer token** (`Authorization: Bearer` header): El access token JWT del usuario cuyos datos/permisos se verifican.

```
Browser ──cookie(auth_token)──► Audit-MS ──(x-api-key + Bearer)──► Auth-MS /users/can-do/:perm
Browser ──cookie(auth_token)──► Audit-MS ──(x-api-key + Bearer)──► Auth-MS /users/me
```

**Flujo completo** (aplica a `can-do` y `me`):
1. El navegador envía un request a Audit-MS. La cookie `auth_token` viaja automáticamente (mismo dominio/subdominios).
2. Audit-MS extrae el token de la cookie del request del usuario.
3. Audit-MS llama a Auth-MS con:
   - Header `x-api-key: <api_key_de_audit_ms>` → identifica al microservicio.
   - Header `Authorization: Bearer <token_del_usuario>` → identifica al usuario.
4. Auth-MS valida:
   - Primero el API key (¿es un microservicio autorizado?).
   - Luego el Bearer token del usuario (JWT válido, sesión activa en Redis).
5. Retorna los datos solicitados o lanza error.

**Casos de uso del endpoint `me` desde otros microservicios**:
- **`RequestContextMiddleware`**: Al recibir un request, el microservicio llama a `GET /users/me` para hidratar el contexto con datos del usuario (id, email, persona, etc.).
- **Auditoría**: Obtener datos del usuario que realizó una acción para registrar en logs de auditoría.

**Ventajas de la doble autenticación**:
- **Defense in depth**: Si un atacante obtiene un access token del usuario, no puede llamar a estos endpoints directamente sin el API key del microservicio.
- **Auditoría**: Se sabe qué microservicio hizo la consulta (por el API key) y para qué usuario (por el Bearer token).
- **Control granular**: Se puede revocar el acceso de un microservicio específico sin afectar usuarios.
- **Previene abuso**: Un usuario no puede llamar directamente a `can-do` o `me` desde el navegador vía herramientas externas sin API key.

**Implementación**: Se crea un nuevo guard `MicroserviceGuard` que verifica ambas credenciales en secuencia. Se aplica a ambos endpoints (`can-do` y `me`). Nombre genérico porque puede cubrir futuros endpoints inter-microservicio.

### 3. Configuración de cookies

| Cookie | Flags | Valor |
|---|---|---|
| `auth_token` | `httpOnly`, `secure` (en prod), `sameSite: Strict`, `path: /` | JWT access token |
| `refresh_token` | `httpOnly`, `secure` (en prod), `sameSite: Strict`, `path: /users/refresh-token` | JWT refresh token |

- **`sameSite: Strict`**: El frontend solo se comunica con sus propios microservicios. No hay navegación cross-origin que necesite enviar cookies. Strict elimina todo vector CSRF.
- **`path` del `refresh_token`**: Restringido a `/users/refresh-token` para que solo se envíe al endpoint de refresh. Esto minimiza la superficie de exposición del refresh token.

### 4. CSRF: No se necesita token adicional

Con `sameSite: Strict`, las cookies **nunca** se envían en requests cross-origin de ningún tipo (ni GET, ni POST, ni fetch). Esto hace que un token CSRF sea redundante:

- Un atacante en `sitio-malicioso.com` no puede hacer que el navegador envíe la cookie a Auth-MS.
- Form POSTs, iframes, imágenes, fetch — todo bloqueado.
- La única forma de enviar la cookie es que el request se origine desde el mismo sitio.

**No se implementa token CSRF.** Si en el futuro se necesita cambiar a `Lax` (por ejemplo, para soportar navegación desde links externos), se reevaluará.

### 5. Variables de entorno nuevas

| Variable | Tipo | Default | Descripción |
|---|---|---|---|
| `COOKIE_DOMAIN` | string | `undefined` | Dominio de las cookies (ej: `.midominio.com`). Si no se define, se usa el dominio del request. |
| `COOKIE_SECURE` | boolean | `true` | `secure` flag. `false` solo para desarrollo local sin HTTPS. |
| `CORS_ORIGIN` | string | `''` | Orígenes permitidos para CORS (comma-separated o URL única). Requerido para que el navegador envíe cookies. |

### 6. Datos del usuario logueado en el frontend (Empleados-MS como compositor)

El frontend **no obtiene datos del usuario desde Auth-MS**. En su lugar, el futuro microservicio de Empleados (Empleados-MS) actúa como agregador/compositor:

```
Browser ──cookie(auth_token)──► Empleados-MS ──(x-api-key + Bearer)──► Auth-MS /users/me
                                     │
                                     ├──► Person-MS (datos de persona)
                                     ├──► DatosPersonales-MS (datos sensibles)
                                     └──► DB propia (datos del empleado)
                                     │
                                     ▼
                               GET /employees/me  ──► Frontend
```

**Justificación**:
- Auth-MS solo se encarga de autenticación/autorización, no de armar perfiles.
- El concepto "empleado" es una composición de datos de múltiples fuentes — Empleados-MS es el dueño natural de esa agregación.
- El frontend hace una sola llamada (`GET /employees/me`) y obtiene todo lo que necesita.
- Se evita crear endpoints de "perfil" en Auth-MS que dupliquen responsabilidades.

**Consecuencia para Auth-MS**: No se crea ningún endpoint adicional para el frontend. Login retorna solo `{ message: 'Login successful' }` (o similar) sin datos de usuario ni tokens.

---

### Fase 1: Infraestructura base

#### 1.1 Instalar `cookie-parser`
```bash
npm install cookie-parser
npm install -D @types/cookie-parser
```

#### 1.2 Configurar `cookie-parser` en `main.ts`
- Registrar `app.use(cookieParser())` antes de otros middlewares.
- Habilitar CORS con `app.enableCors({ origin, credentials: true })`.

#### 1.3 Agregar variables de entorno
- Agregar `COOKIE_DOMAIN`, `COOKIE_SECURE`, `CORS_ORIGIN` al esquema de validación en `src/config/env-validation.ts`.
- Actualizar `example.env`.

#### 1.4 Crear utility de cookies
- Crear `src/common/tools/cookie-options.ts` con una función que genere las opciones de `res.cookie()` para cada tipo de cookie (auth, refresh).
- Centralizar la lógica de maxAge (derivar de `JWT_AUTH_EXPIRES_IN` y `JWT_REFRESH_EXPIRES_IN` usando `getTtlFromEnv`).

### Fase 2: Modificar respuestas (login, refresh, logout)

#### 2.1 Login (`UsersController.login()` + `UsersService.login()`)

**Cambios en el controller**:
- Inyectar `@Res({ passthrough: true }) response: Response`.
- Después de obtener los tokens del service, setear ambas cookies:
  ```typescript
  response.cookie('auth_token', tokens.accessToken, getAuthCookieOptions());
  response.cookie('refresh_token', tokens.refreshToken, getRefreshCookieOptions());
  ```
- **Ya no retorna tokens en el body.** Retorna `{ message: 'Login successful' }`. Los datos del usuario logueado se obtienen desde Empleados-MS, no desde Auth-MS.

**Cambios en el service**:
- `login()` sigue generando los tokens y retornándolos al controller internamente. Pero el controller ya no los expone al cliente.

**Cambios en interfaces**:
- `AuthInterface` (`{ accessToken, refreshToken }`) se mantiene como tipo de retorno **interno** entre service → controller. El controller lo usa para setear cookies pero retorna `{ message: string }` al cliente.

#### 2.2 Refresh token (`UsersController.refreshToken()`)

**Cambios en el controller**:
- Inyectar `@Res({ passthrough: true }) response: Response`.
- Extraer el refresh token **solo de la cookie**: `request.cookies['refresh_token']`.
- Después de obtener los nuevos tokens, setear ambas cookies con los valores actualizados.
- **Ya no retorna tokens en el body.** Retorna `{ message: 'Token refreshed' }` o similar.

**Nota**: El header `refresh-token` se elimina como fuente. Solo se lee de la cookie. Los microservicios no necesitan hacer refresh — eso es responsabilidad del frontend.

#### 2.3 Logout (`UsersController.logout()`)

**Cambios en el controller**:
- Inyectar `@Res({ passthrough: true }) response: Response`.
- Después de limpiar la sesión en Redis, limpiar las cookies:
  ```typescript
  response.clearCookie('auth_token', { path: '/' });
  response.clearCookie('refresh_token', { path: '/users/refresh-token' });
  ```

### Fase 3: Modificar AuthGuard (solo cookies para endpoints normales)

#### 3.1 Actualizar `AuthGuard` (`src/middlewares/auth.middleware.ts`)

El `AuthGuard` ahora **solo** lee de cookies:

```typescript
private extractToken(request: Request): string | null {
  return request.cookies?.['auth_token'] ?? null;
}
```

- Reemplazar la lógica actual de extracción del header `Authorization` por lectura de cookie.
- El resto del guard (validación JWT, Redis, IP, permisos) no cambia.
- El header Bearer **ya no es aceptado** por el AuthGuard general. Solo se acepta en `can-do` (ver Fase 4).

### Fase 4: Endpoints inter-microservicio con doble autenticación (`can-do` y `me`)

#### 4.1 Crear `MicroserviceGuard` (`src/middlewares/microservice.middleware.ts`) — **NUEVO**

Guard compuesto que valida:

1. **API key** (reutiliza lógica del `ApiKeyGuard` existente):
   - Extrae `x-api-key` del header.
   - Valida contra la base de datos.
   - Verifica que el API key tenga los permisos necesarios.

2. **Bearer token del usuario**:
   - Extrae `Authorization: Bearer <token>` del header.
   - Valida el JWT con `jwtService.getPayload(token, 'auth')`.
   - Carga la sesión de Redis.
   - Valida sesión activa y email match.
   - **No aplica verificación de IP** (el request viene del microservicio, no del usuario original).
   - Adjunta los datos del usuario al request.

**Diseño del guard**:
```typescript
@Injectable()
export class MicroserviceGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // Paso 1: Validar API key del microservicio
    await this.validateApiKey(request);

    // Paso 2: Validar Bearer token del usuario
    await this.validateUserToken(request);

    return true;
  }
}
```

#### 4.2 Actualizar `UsersController.canDo()`

**Cambios**:
- Reemplazar `@UseGuards(AuthGuard)` por `@UseGuards(MicroserviceGuard)`.
- Reemplazar `@ApiBearerAuth()` por `@ApiSecurity('api-key')` + `@ApiBearerAuth()`.
- Actualizar decoradores Swagger para documentar la doble autenticación.

#### 4.3 Actualizar `UsersController.me()`

**Cambios**:
- Reemplazar `@UseGuards(AuthGuard)` por `@UseGuards(MicroserviceGuard)`.
- Reemplazar `@ApiBearerAuth()` por `@ApiSecurity('api-key')` + `@ApiBearerAuth()`.
- El endpoint sigue retornando los datos del usuario como antes — solo cambia el mecanismo de autenticación.

**Nota sobre el frontend**: El frontend ya no llama a `GET /users/me` directamente (requiere API key). Los datos del empleado/usuario logueado se obtienen desde el futuro microservicio de Empleados (Empleados-MS), que actúa como compositor/agregador: llama a Auth-MS `GET /users/me` (con doble auth), combina con datos de person, datos personales y datos del empleado, y expone un único endpoint al frontend (ej: `GET /employees/me`). No se crea endpoint `/users/profile` en Auth-MS.

#### 4.4 Actualizar `UsersService.canDo()`

**Cambios menores**:
- Recibe `AuthUser` igual que antes (el guard se encarga de construirlo).
- La lógica de verificación de permisos no cambia.

### Fase 5: Documentación Swagger

#### 5.1 Actualizar decoradores Swagger
- Endpoints protegidos (cookie): Cambiar `@ApiBearerAuth()` por `@ApiCookieAuth('auth_token')`.
- Endpoints inter-microservicio (`can-do`, `me`): `@ApiSecurity('api-key')` + `@ApiBearerAuth()`.
- En el setup de Swagger en `main.ts`:
  ```typescript
  .addCookieAuth('auth_token')
  .addApiKey({ type: 'apiKey', in: 'header', name: 'x-api-key' }, 'api-key')
  ```

### Fase 6: Validación y env

#### 6.1 Actualizar `env-validation.ts`
- Agregar las nuevas variables con sus validaciones (opcionales con defaults sensatos).

#### 6.2 Actualizar `example.env`
- Documentar las nuevas variables.

---

## Archivos a modificar

| # | Archivo | Cambio |
|---|---|---|
| 1 | `package.json` | Agregar `cookie-parser` y `@types/cookie-parser` |
| 2 | `src/main.ts` | Registrar `cookieParser()`, habilitar CORS, agregar cookie auth a Swagger |
| 3 | `src/config/env-validation.ts` | Agregar `COOKIE_DOMAIN`, `COOKIE_SECURE`, `CORS_ORIGIN` |
| 4 | `src/common/tools/cookie-options.ts` | **NUEVO** — factory de opciones para cookies |
| 5 | `src/middlewares/auth.middleware.ts` | Cambiar extracción de Bearer a cookie (solo cookie) |
| 6 | `src/middlewares/microservice.middleware.ts` | **NUEVO** — guard con doble auth (API key + Bearer) para endpoints inter-microservicio |
| 7 | `src/services/users/users.controller.ts` | Login: setear cookies, sin tokens en body. Refresh: leer cookie, setear cookies, sin tokens en body. Logout: limpiar cookies. `can-do` y `me`: usar `MicroserviceGuard`. |
| 8 | `src/services/users/users.service.ts` | Sin cambios en lógica de negocio. Posible ajuste en tipos de retorno si se cambia la interfaz de respuesta de login. |
| 9 | `example.env` | Documentar nuevas variables |

## Archivos que NO cambian

- `src/services/JWT/jwt.service.ts` — La generación/validación de JWT no cambia.
- `src/common/redis/redis.service.ts` — Redis no cambia.
- `src/middlewares/api-key.middleware.ts` — Se reutiliza su lógica desde `MicroserviceGuard`, pero el archivo en sí no se modifica.
- `src/entities/*` — No hay cambios en DB.

---

## Guía para microservicios consumidores (Audit-MS y otros)

Todo microservicio que necesite verificar permisos u obtener datos de un usuario debe:

### 1. Tener un API key registrado en Auth-MS
El API key se genera desde Auth-MS con los permisos necesarios.

### 2. Extraer el access token del request del usuario

```typescript
// En el middleware/guard del microservicio:
function extractUserToken(request: Request): string | null {
  // Opción 1: Cookie del usuario (requiere cookie-parser)
  const cookie = request.cookies?.['auth_token'];
  if (cookie) return cookie;

  // Opción 2: Header Bearer (si el cliente envía así)
  const auth = request.headers['authorization'];
  if (auth?.startsWith('Bearer ')) return auth.slice(7);

  return null;
}
```

### 3. Llamar a Auth-MS con doble autenticación

```typescript
const userToken = extractUserToken(req);

// Verificar permisos
const canDoResponse = await axios.get(
  `${AUTH_MS_URL}/users/can-do/${permission}`,
  {
    headers: {
      'x-api-key': process.env.AUTH_API_KEY,
      'Authorization': `Bearer ${userToken}`,
    },
  },
);

// Obtener datos del usuario (para RequestContextMiddleware, auditoría, etc.)
const meResponse = await axios.get(
  `${AUTH_MS_URL}/users/me`,
  {
    headers: {
      'x-api-key': process.env.AUTH_API_KEY,
      'Authorization': `Bearer ${userToken}`,
    },
  },
);
```

### 4. Requisitos del microservicio
- Necesita `cookie-parser` instalado si quiere leer la cookie `auth_token` del request del usuario.
- Necesita su propio API key almacenado como variable de entorno.
- **No necesita** hacer refresh de tokens — eso es responsabilidad exclusiva del frontend.

---

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| CSRF | `sameSite: Strict` elimina todo vector CSRF. No se necesita token adicional. |
| XSS accede a tokens | Cookies `httpOnly` — JavaScript no puede leer los tokens. |
| Microservicio no puede llamar `can-do` o `me` sin API key | Los microservicios deben tener un API key registrado. Documentar en guía de onboarding. |
| Refresh token expuesto en todas las rutas | `path: /users/refresh-token` restringe el envío solo al endpoint de refresh. |
| Desarrollo local sin HTTPS | `COOKIE_SECURE=false` para desarrollo. **Nunca en producción.** |
| Navegación desde links externos pierde sesión (Strict) | Aceptable: el front solo se accede directamente, no desde links externos. Si cambia, reevaluar `Lax` + CSRF token. |
| API key de microservicio comprometido | El API key tiene permisos limitados. Se puede revocar individualmente sin afectar otros servicios. |
| Token de usuario + API key ambos necesarios para `can-do` y `me` | Defense in depth: comprometer uno solo no es suficiente. |
| Frontend pierde acceso directo a `me` | El frontend obtiene datos del empleado/usuario desde Empleados-MS (compositor). Empleados-MS llama a Auth-MS `me` con doble auth, combina con datos de otros microservicios, y expone `GET /employees/me`. No se necesita endpoint adicional en Auth-MS. |

---

## Orden de ejecución sugerido

1. Fase 1 (infraestructura: cookie-parser, CORS, env, utility) → build y verificar que no rompe nada.
2. Fase 3 (AuthGuard lee de cookie) + Fase 4 (MicroserviceGuard con doble auth para `can-do` y `me`) → tests unitarios.
3. Fase 2 (login/refresh/logout setean cookies, sin tokens en body) → test manual con cookies.
4. Fase 5 (Swagger) → documentación actualizada.
5. Fase 6 (env) → variables documentadas.

---

## Criterios de aceptación

- [ ] Login setea cookies `auth_token` y `refresh_token` con flags correctos (`httpOnly`, `secure`, `sameSite: Strict`).
- [ ] Login **no** retorna tokens en el body de respuesta.
- [ ] Refresh lee `refresh_token` de cookie, setea nuevas cookies.
- [ ] Refresh **no** retorna tokens en el body de respuesta.
- [ ] Refresh **no** acepta el header `refresh-token` (solo cookie).
- [ ] Logout limpia ambas cookies.
- [ ] `AuthGuard` acepta token **solo** de cookie `auth_token`.
- [ ] Endpoints protegidos funcionan con cookies (test desde navegador).
- [ ] `can-do` requiere **ambos**: API key (`x-api-key`) + Bearer token del usuario (`Authorization: Bearer`).
- [ ] `can-do` rechaza requests que solo tengan API key (sin Bearer).
- [ ] `can-do` rechaza requests que solo tengan Bearer (sin API key).
- [ ] `can-do` funciona cuando un microservicio envía ambos headers.
- [ ] `me` requiere **ambos**: API key (`x-api-key`) + Bearer token del usuario (`Authorization: Bearer`).
- [ ] `me` rechaza requests que solo tengan API key (sin Bearer).
- [ ] `me` rechaza requests que solo tengan Bearer (sin API key).
- [ ] `me` funciona cuando un microservicio envía ambos headers y retorna datos del usuario.
- [ ] `MicroserviceGuard` **no** aplica verificación de IP/subnet (el request viene del microservicio).
- [ ] CORS configurado con `credentials: true` y orígenes explícitos.
- [ ] Tests existentes pasan (ajustados si es necesario para usar cookies en lugar de Bearer).
- [ ] Build compila sin errores.
