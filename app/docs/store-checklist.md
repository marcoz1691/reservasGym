# Checklist de Publicación en App Store y Google Play — Zona Cero Performance Center

Guía exhaustiva de preparación, metadatos, requerimientos de privacidad, exenciones de pago in-app y checklist de envío a tiendas para **Zona Cero Performance Center** (Quito, Ecuador).

---

## 1. Identificación y Configuración del Proyecto Mobile

| Parámetro | Valor Configurado |
|---|---|
| **Nombre de la App (Display Name)** | Zona Cero |
| **Nombre Completo / Subtítulo** | Zona Cero Performance Center |
| **Bundle ID (iOS) / Application ID (Android)** | `com.reservasgym.zonacero` |
| **Versión / Build** | `1.0.0` (Build `1`) |
| **Categoría Principal (iOS / Android)** | Health & Fitness (Salud y bienestar) |
| **Categoría Secundaria** | Sports (Deportes) |
| **Clasificación de Edad / Content Rating** | 4+ (iOS) / PEGI 3 / Para todos (Android) |
| **Esquema de Color de Marca** | Background `#0E1117`, Accent `#FF6146` (Naranja atlético) |
| **URL de Política de Privacidad** | `https://zonacero.reservasgym.com/privacidad` (o URL oficial del gimnasio) |
| **Soporte / Contacto** | `soporte@zonacerocenter.com` / `+593 99 999 9999` (Quito, Ecuador) |

---

## 2. Apple App Store Connect

### 2.1. Ficha Técnica y Metadatos
- **Nombre de la App (máx. 30 car.)**: `Zona Cero Performance Center`
- **Subtítulo (máx. 30 car.)**: `Entrenamiento y Reservas`
- **Descripción Promocional**:
  > Gestiona tus reservas de entrenamiento, seguimiento antropométrico de peso e IMC, y membresías en Zona Cero Performance Center en Quito.
- **Descripción Completa**:
  > Zona Cero Performance Center es la aplicación oficial para socios y atletas de nuestro centro de alto rendimiento en Quito, Ecuador.
  >
  > Funcionalidades principales:
  > - **Reserva de Sesiones y Clases**: Reserva tu lugar en sesiones de Fuerza, Funcional, Boxeo, CrossFit y Acondicionamiento con control de aforo en tiempo real.
  > - **Lista de Espera Inteligente**: Recibe cupo automático ante cancelaciones.
  > - **Check-in Rápido con Código QR**: Validación ágil en recepción.
  > - **Seguimiento Antropométrico & Peso**: Registra tu peso corporal, índice de masa corporal (IMC), medidas anatómicas y progreso hacia tus metas deportivas.
  > - **Gestión de Membresías y Renovaciones**: Consulta el estado de tu plan presencial, historial de pagos y fechas de vigencia.
  > - **Perfil y Control de Privacidad**: Edita tus datos y gestiona el borrado total de tu cuenta en cualquier momento.
- **Palabras Clave (Keywords - máx. 100 car.)**:
  `gimnasio,fitness,entrenamiento,pesas,crossfit,quito,ecuador,reservas,pesas,salud,imc,zona cero`
- **URL de Soporte**: `https://zonacero.reservasgym.com/soporte`
- **URL de Marketing**: `https://zonacerocenter.com`
- **URL de Política de Privacidad**: `https://zonacero.reservasgym.com/privacidad`

---

### 2.2. Privacy Nutrition Labels (Etiquetas de Privacidad de Apple)

Apple exige declarar cada categoría de datos recopilada, el propósito de uso y si está vinculada a la identidad del usuario o se usa para rastreo.

| Categoría de Datos | Tipos Específicos | Propósito de Uso | ¿Vinculado al Usuario? | ¿Rastreo (Tracking)? |
|---|---|---|---|---|
| **Health & Fitness (Salud y forma física)** | Peso corporal, estatura, cálculo de IMC, perímetros musculares (pecho, brazo, cintura, cadera, muslo), dolencias/notas médicas deportivas y metas físicas. | **App Functionality** (Funcionalidad de la app: cálculo de progreso atlético y adaptación de sesiones por el entrenador). | **Sí** (asociado a la cuenta del socio para su histórico). | **NO** (0% rastreo, no compartido con data brokers). |
| **Contact Info (Información de contacto)** | Nombre y apellido, correo electrónico, ciudad de residencia. | **Account Management** (Gestión de cuenta, autenticación y comunicación de reservas). | **Sí** (asociado a la cuenta). | **NO** |
| **User Content (Contenido del usuario)** | Registros de notas deportivas, asistencias y check-ins. | **App Functionality** (Control de acceso presencial al centro y reservas). | **Sí** | **NO** |
| **Identifiers (Identificadores)** | User ID interno (UUID de Supabase). | **App Functionality** (Sesión segura y autenticación). | **Sí** | **NO** |

> **Declaración de Cero Rastreo (Zero Tracking)**:
> La app **NO** utiliza IDFA (Identifier for Advertisers), **NO** integra SDKs de terceros para publicidad (Meta Pixel, Google Ads, AppsFlyer) y **NO** vende ni comparte información con intermediarios o corredores de datos (*data brokers*).

---

### 2.3. Cumplimiento de Eliminación de Cuenta (Apple Guideline 5.1.1(v))

Apple rechaza apps con registro de usuarios que no ofrezcan un mecanismo directo dentro de la app para eliminar la cuenta y todos sus datos asociados.

- **Ruta exacta en la app**:
  1. Iniciar sesión en la app.
  2. Ir a la pestaña **Perfil** (o avatar superior derecho).
  3. Deslizar hasta la sección inferior: **"Privacidad y eliminación de cuenta"**.
  4. Presionar el botón rojo: **"Eliminar mi cuenta y mis datos"**.
  5. Confirmar escribiendo la palabra `ELIMINAR` en el modal interactivo.
- **Acción técnica ejecutada**:
  - Borrado en cascada en la base de datos de: mediciones antropométricas (`measurements`), reservas futuras y pasadas (`bookings`), perfil de usuario (`users`) y credenciales de autenticación.
  - Cierre inmediato de sesión y revocación de tokens JWT.

---

### 2.4. Justificación de Exención de Pagos In-App (Apple Guideline 3.1.3(e))

> **IMPORTANTE**: Agregar este texto textual en la sección **App Review Information -> Notes** de App Store Connect para evitar rechazos erróneos por no usar compras In-App (IAP de Apple):

```text
NOTE TO APPLE APP REVIEW TEAM REGARDING IN-APP PURCHASES:

This application is designed specifically for members and clients of "Zona Cero Performance Center", a physical fitness and athletic conditioning facility located in Quito, Ecuador.

In accordance with Apple App Store Review Guideline 3.1.3(e) (Goods and Services Outside of the App):
"If your app allows people to purchase physical goods or services that will be consumed outside the app, you must use purchase methods other than in-app purchase to collect those payments, such as Apple Pay or traditional credit cards."

All membership plans, access passes, and payment transactions managed or recorded through this app correspond 100% to physical gym access, in-person training equipment usage, and on-site coaching at our physical facility in Quito, Ecuador. No digital goods, virtual currency, or locked digital features are sold through this application.

For testing, please use the provided demo accounts below.
```

---

### 2.5. Credenciales Demo para el Revisor de Apple (App Reviewer)

Configurar en **App Review Information -> Sign-in required**:

- **Usuario Socio (Member Demo)**:
  - **Email**: `socio@gym.local`
  - **Contraseña**: `demo1234`
  - *Permisos*: Acceso a catálogo, reservas de clase, check-in QR, registro de peso/antropometría y vista de membresía.
- **Usuario Administrador / Entrenador (Staff Demo)**:
  - **Email**: `staff@gym.local`
  - **Contraseña**: `demo1234`
  - *Permisos*: Panel administrativo, scanner de check-in, agenda multizona, gestión de cobros y métricas.

---

## 3. Google Play Console

### 3.1. Declaración del Formulario de Seguridad de los Datos (Data Safety Form)

En la sección **Contenido de la aplicación -> Seguridad de los datos**, responder:

1. **¿La app recopila o comparte datos del usuario?**
   - Respuesta: **Sí, recopila datos** (no comparte con terceros para fines ajenos al servicio).
2. **¿Todos los datos recopilados están cifrados en tránsito?**
   - Respuesta: **Sí** (todas las conexiones se realizan mediante HTTPS / TLS 1.3 con certificados válidos).
3. **¿Ofreces un método para que los usuarios soliciten la eliminación de sus datos?**
   - Respuesta: **Sí** (auto-servicio directo dentro de la app en la pantalla de Perfil y mediante solicitud por correo al responsable del tratamiento).
4. **Desglose de datos recopilados**:
   - **Salud y forma física**:
     - *Información sobre salud* (Peso, altura, IMC, lesiones deportivas): **Recopilado** para funcionalidad de la app (gestión de rendimiento deportivo). **Opcional** para el usuario. **No compartido** con fines comerciales.
     - *Información sobre forma física* (Objetivos y mediciones): **Recopilado**, funcionalidad de app.
   - **Información personal**:
     - *Nombre*: **Recopilado**, obligatorio para control de aforo e identificación presencial.
     - *Dirección de correo electrónico*: **Recopilado**, obligatorio para autenticación de cuenta.
     - *Ubicación aproximada / Ciudad*: **Recopilado**, opcional.
   - **Actividad en la app**:
     - *Historial de reservas e interacciones*: **Recopilado**, funcionalidad de la app.
   - **Información de la cuenta / Identificadores**:
     - *ID de usuario*: **Recopilado**, gestión de cuentas.

---

### 3.2. Acceso a Aplicaciones (App Access)
- Seleccionar: **"Todas o algunas funciones están restringidas"**.
- Proporcionar las credenciales demo: `socio@gym.local` / `demo1234` con instrucciones de cómo ingresar y explorar el módulo de reservas y peso.

---

### 3.3. Requisitos Técnicos de Android
- **Target SDK**: Android 14 / 15 (API level 34 o 35 según requerimiento vigente de Google Play).
- **Min SDK**: API level 22 (Android 5.1 Lollipop) o superior.
- **Formato de Entrega**: Android App Bundle (`.aab`) firmado con clave de producción (Play App Signing).

---

## 4. Especificaciones de Recursos Gráficos y Assets de Tienda

| Asset | Plataforma | Dimensiones / Formato | Requisitos Específicos |
|---|---|---|---|
| **App Icon (Store)** | iOS App Store | 1024 × 1024 px, PNG | Sin canal alfa (sin transparencia), esquinas cuadradas (Apple aplica el redondeo). Fondo `#0E1117` con logo Zona Cero. |
| **App Icon (Store)** | Google Play | 512 × 512 px, PNG / 32 bits | Hasta 1 MB, esquinas cuadradas. |
| **Gráfico de Funciones (Feature Graphic)** | Google Play | 1024 × 500 px, JPG/PNG | Banner horizontal representativo de Zona Cero con el logo y slogan de alto rendimiento. |
| **Screenshots iPhone 6.7"** | App Store (Obligatorio) | 1290 × 2796 px (o 1284 × 2778 px) | Capturas en modo oscuro de: Inicio, Agenda con cupos, Detalle de Reserva, Métricas de Peso/IMC, Mi Plan. |
| **Screenshots iPhone 6.5"** | App Store (Obligatorio) | 1242 × 2688 px (o 1284 × 2778 px) | Mismas pantallas adaptadas a pantalla completa. |
| **Screenshots iPad 12.9"** | App Store (Si aplica soporte tablet) | 2048 × 2732 px | Pantallas en formato tablet. |
| **Screenshots Android Móvil** | Google Play | 1080 × 1920 px (o 1080 × 2400 px) | Mínimo 2 capturas, recomendado 5 a 6 capturas clave. |

---

## 5. Procedimiento de Build y Sincronización Local

Para generar la compilación web y sincronizarla con los contenedores nativos Capacitor de Android e iOS:

```bash
# 1. Posicionarse en el directorio de la aplicación
cd app

# 2. Instalar dependencias
npm install

# 3. Compilar TypeScript y empaquetar con Vite
npm run build

# 4. Sincronizar activos web y plugins nativos a las carpetas android/ e ios/
npm run cap:sync

# 5. Para abrir en Android Studio (generar AAB firmado):
npm run cap:android

# 6. Para abrir en Xcode (macOS - generar Archive para App Store Connect):
npm run cap:ios
```

---

## 6. Checklist de Verificación Pre-Lanzamiento

- [x] `app/capacitor.config.ts` configurado con `appId: 'com.reservasgym.zonacero'` y `appName: 'Zona Cero'`.
- [x] Configuración de `SplashScreen` y `StatusBar` con paleta oscura `#0A0D06` / `#0E1117`.
- [x] Botón de eliminación de cuenta funcional en `app/src/features/profile/ProfilePage.tsx` con confirmación (Apple 5.1.1(v)).
- [x] Texto de exención de pagos físicos in-app preparado para los revisores de Apple (Guideline 3.1.3(e)).
- [x] Documento formal de Política de Privacidad creado en `app/docs/privacy-policy-zonacero.md` bajo LOPDP (Ecuador) y RGPD.
- [ ] Subida de AAB a Google Play Internal Testing para pruebas cerradas.
- [ ] Subida de Build a TestFlight en App Store Connect.
- [ ] Aprobación de pruebas de humo en dispositivos físicos antes de solicitar revisión pública.
