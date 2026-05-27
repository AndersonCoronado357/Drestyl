# Drestyl — Diseño de la app

> Propuesta de cómo va a ser Drestyl. Esta es **la** versión: no hay V2 ni
> roadmap. Lo que está acá es lo que se construye, y solo eso. Léelo y márcame
> lo que cambies, recortes o agregues. Cuando lo aprobemos, empezamos por
> fases (ver el final).

---

## 1. Qué es Drestyl, en una frase

Una PWA mobile-first, privada, para que un grupo chico (~10–15 personas) suba
las prendas de su clóset y reciba cada mañana una sugerencia de outfit pensada
para el clima real de su ubicación y para lo que va a hacer ese día — sin
repetir lo recién usado.

---

## 2. Qué hace la app

- Cuenta personal: cada usuario solo ve y maneja su propio clóset.
- Subir prendas con foto + categoría. La foto se procesa en el navegador
  antes de subir: se le quita el fondo y se normaliza la iluminación para
  que todo el clóset se vea uniforme y la IA "entienda" mejor cada prenda.
- Pantalla "Hoy": clima del lugar + casilla para elegir lo que va a hacer
  el día + botón "Sugerir outfit".
- Sugerencia completa hecha por IA (Gemini), que recibe **todas** tus
  prendas activas + clima + ocasión + historial reciente y arma una
  combinación que no repita lo usado hace poco.
- Aceptar la sugerencia → se guarda en historial como "usada hoy".
- Regenerar la sugerencia completa con nueva llamada a la IA.
- Cambiar una pieza suelta del outfit **sin** llamar a la IA: se abre una
  pantalla con todas tus prendas de esa categoría y eliges manualmente.
  (Esto ahorra cuota de IA, que es lo escaso.)
- Pantalla "Mi clóset": ver, editar, activar/desactivar y eliminar prendas.
- Pantalla "Historial": qué se usó cada día. Editable si te equivocaste.
- Instalación como PWA en el celular con prompt automático donde el
  navegador lo soporta, y guía visual para iPhone.

---

## 3. Decisiones de producto que tomé

Estas las decidí yo con criterio. Cualquiera es opinable — márcame las que
cambies.

| Decisión | Por qué |
|---|---|
| Una sola sugerencia por vez, no varias en grid | Más decidido, menos parálisis, más mobile-friendly |
| Cambiar piezas sueltas es un picker manual del clóset, sin IA | El usuario lo pidió: ahorra cuota y es instantáneo |
| Regenerar todo sí llama a la IA (es la única forma) | Es lo único que requiere "razonamiento" nuevo |
| El plan del día con **chips de ocasión** + texto libre opcional | Rápido la mayoría de los días, flexible cuando hace falta |
| Marcar como "usada hoy" automáticamente al aceptar | Menos fricción |
| Historial editable | Mantiene los datos honestos para la IA |
| Foto obligatoria por prenda | Sin foto la app pierde valor y la IA pierde su mejor señal |
| Procesar la foto en el navegador (fondo + luz) | Capa gratuita (no servidor) y respeta la privacidad |
| Ventana de "no repetir" = 10 días por defecto, configurable | Equilibrio entre variedad y dejar usar los básicos |
| Atribución de Open-Meteo en la pantalla Hoy, pie discreto | Lo pide su licencia, no es opcional |
| Sin modales / diálogos / overlays en ningún flujo | Preferencia del usuario; todo va por pantallas dedicadas |
| Sin límite numérico de sugerencias por día | El grupo es chico; solo manejamos "cuota agotada" cuando pase |

---

## 4. Atributos de cada prenda

Minimalismo deliberado. La IA es multimodal: ve la foto y deduce por sí
sola color, material, manga larga/corta, formalidad, abrigo, lluvia, etc.
No le ponemos al usuario un formulario interminable.

Cuando subes una prenda, solo registras:

- **Foto** (obligatoria). Se procesa en el cliente antes de subir:
  1. Se remueve el fondo (queda solo la prenda sobre transparencia).
  2. Se normaliza la iluminación (auto-balance de blancos + auto-niveles).
  3. Se comprime a webp ~1280px lado mayor.
- **Categoría** (obligatoria, lista cerrada con términos colombianos).
  Lista provisional para arrancar (la afinamos al construir Fase 2):
  *camisa, camiseta, buzo / suéter, chaqueta, pantalón, bermuda /
  pantaloneta, jean, vestido, falda, zapatos, tenis, accesorio*. No hay
  subcategoría.
- **Nombre corto** (opcional). Si no lo pones, se autogenera tipo
  "Camiseta #3".
- **Activa** (sí/no). Si está apagada, sigue en el clóset pero la IA no la
  sugiere (lavandería, no me gusta últimamente, está dañada, no es de
  temporada, lo que sea).

Eso es todo. Nada de subcategoría, paleta de colores manual, escalas de
abrigo, escalas de formalidad, "resiste lluvia", ocasiones permitidas, etc.
Todo eso lo infiere la IA mirando la foto.

---

## 5. Pantallas y navegación

**Estructura:** barra inferior de navegación (mobile pattern), 4 tabs.

```
┌───────────────────────────────────┐
│                                   │
│          [contenido]              │
│                                   │
├───────────────────────────────────┤
│ [Hoy]  [Clóset]  [Historial] [⚙] │
└───────────────────────────────────┘
```

### 5.1 Onboarding (solo la primera vez)

1. **Bienvenida** — explicación corta y botón "Crear cuenta".
2. **Crear cuenta** — email + contraseña (Supabase Auth).
3. **Permisos** — pedir geolocalización con texto que explique por qué.
4. **Instalar como app** — en Chrome/Android usa el prompt nativo; en iPhone
   muestra una guía visual ("Toca compartir → Agregar a inicio").
5. **Clóset vacío** — pantalla "Tu clóset está vacío. Sumemos tu primera
   prenda" → lleva directo al flujo de agregar.

Todo en pantallas, no modales.

### 5.2 Hoy

Pantalla principal. Una sola columna mobile.

```
─────────────────────────────────
Buenos días, Ander       [perfil]
miércoles, 27 de mayo
─────────────────────────────────

🌤  Bogotá · 18° · Parcialmente nublado
    Datos meteorológicos por Open-Meteo

─────────────────────────────────

¿Qué vas a hacer hoy?

[Trabajo] [Casual] [Salida]
[Formal]  [Deporte] [Casa]

(Opcional: "reunión con cliente")
[__________________________]

─────────────────────────────────

         [ Sugerir outfit ]

─────────────────────────────────
```

Después de "Sugerir outfit", la misma pantalla muestra:

```
─────────────────────────────────
Tu outfit para hoy
─────────────────────────────────

  ┌──────┐ ┌──────┐
  │ foto │ │ foto │
  └──────┘ └──────┘
   ┌──────┐
   │ foto │
   └──────┘

Por qué: "Como va a hacer 18° y tu plan es
trabajo, te combiné el buzo beige con el
pantalón gris y los tenis blancos."

[ Aceptar y guardar ]
[ Cambiar una pieza ]
[ Regenerar todo ]
─────────────────────────────────
```

- **Aceptar y guardar** → guarda en historial y vuelve al estado normal de
  Hoy con el outfit ya marcado como "usado hoy".
- **Cambiar una pieza** → navega a la pantalla picker (5.3). No es un modal.
- **Regenerar todo** → llama de nuevo a la IA, reemplaza la sugerencia.

### 5.3 Picker para cambiar una pieza (pantalla dedicada)

Cuando tocas "Cambiar una pieza" o tocas una de las fotos del outfit:

```
─────────────────────────────────
←  Cambiar el pantalón
─────────────────────────────────

  ┌──────┐ ┌──────┐ ┌──────┐
  │ foto │ │ foto │ │ foto │
  └──────┘ └──────┘ └──────┘
  ┌──────┐ ┌──────┐ ┌──────┐
  │ foto │ │ foto │ │ foto │
  └──────┘ └──────┘ └──────┘

  (todas tus prendas activas de
  esa categoría)
─────────────────────────────────
```

Tap en una prenda → se actualiza el outfit y vuelves. Sin llamada a la IA.

### 5.4 Mi clóset

- Grilla de 2 o 3 columnas con las fotos procesadas.
- Filtros arriba: categoría, activas/todas.
- Tap en una prenda → pantalla detalle/editar.
- Botón "Agregar" fijo en la parte inferior.

### 5.5 Agregar / editar prenda

Es un flujo de **varias pantallas** (no un modal grande), una decisión por
pantalla, con flechas back/next:

1. **Pantalla A** — Tomar / elegir foto (cámara o galería).
2. **Pantalla B** — Procesamiento: muestra el antes / después, opción
   "Volver a tomar" o "Está bien".
3. **Pantalla C** — Categoría (lista de chips en una columna).
4. **Pantalla D** — Nombre (opcional) + switch "Activa".
5. **Confirmación** — "Listo, tu prenda está en el clóset".

En edición, mismo flujo pero con valores precargados; además un botón
"Eliminar" que, en lugar de un dialog de confirmación, se transforma en
"Confirmar eliminación" en rojo durante 3 segundos.

### 5.6 Historial

Lista cronológica inversa. Cada item:
- Fecha
- Mini-grilla con las fotos del outfit
- Ocasión y clima del día
- Tap → pantalla de detalle, donde puedes marcar "no usé este" o ajustarlo.

### 5.7 Ajustes

- Mi perfil (nombre, email).
- Ubicación por defecto (si negaste la geo del navegador).
- Ventana de "no repetir" (chips: 3, 7, 10, 14, 21 días).
- Cerrar sesión.
- Versión + créditos (con la atribución de Open-Meteo).

---

## 6. Modelo de datos (Supabase / Postgres)

Tablas, en simple. Todas con `id uuid primary key default gen_random_uuid()` y
`created_at timestamptz default now()`.

### `profiles`
- `id` — uuid, FK a `auth.users`
- `display_name` — text
- `default_lat`, `default_lng` — float (plan B si niega geo)
- `repeat_window_days` — int, default 10

### `garments` (prendas)
- `user_id` — uuid, FK
- `name` — text (puede estar vacío; el cliente arma "Camiseta #N")
- `category` — text (de lista cerrada; valor final se decide en Fase 2)
- `photo_path` — text (key de Supabase Storage, no URL pública)
- `is_active` — bool, default true

### `outfits`
- `user_id` — uuid, FK
- `worn_date` — date
- `garment_ids` — uuid[]
- `occasion` — text
- `plan_text` — text (lo que escribió el usuario, si algo)
- `weather_snapshot` — jsonb (temp, condición, lluvia esperada, etc.)
- `source` — enum: `ai_suggested | user_edited | user_picked`

**Storage bucket:** `garments` privado. Las fotos procesadas se guardan en
`{user_id}/{garment_id}.webp`. Se sirven con URLs firmadas temporales, no
públicas.

**RLS (Row Level Security):** en cada tabla, política `auth.uid() = user_id`
para SELECT/INSERT/UPDATE/DELETE. Esto garantiza que un usuario no pueda
leer ni tocar datos de otro, ni siquiera con la URL exacta.

---

## 7. Lógica de la sugerencia de outfit

El cliente nunca llama a la IA directo. Todo pasa por un endpoint del servidor.

### Endpoint: `POST /api/suggest-outfit`

Recibe del cliente:
- `occasion` (de la lista cerrada)
- `plan_text` (opcional)

En el servidor (Next.js API route):

1. **Autenticación** — verifica la sesión de Supabase. Sin sesión, 401.
2. **Clima** — consulta Open-Meteo con la lat/lng del usuario (geo o
   default). Si falla, sigue sin clima y avisa al cliente.
3. **Cargar contexto** — desde Supabase, con el `user_id` que sale de la
   sesión (no del request):
   - **todas** las prendas activas del usuario (no hay filtro previo: si la
     prenda está activa, la IA la ve);
   - outfits de los últimos `repeat_window_days` (10 por defecto).
4. **Llamada a Gemini** (server-side, multimodal). El prompt incluye:
   - el clima real;
   - la ocasión y el texto libre;
   - una lista de prendas activas: por cada una, `id`, categoría, nombre,
     y **URL firmada de la foto procesada** (para que Gemini mire la imagen);
   - una lista de prendas usadas recientemente con fecha;
   - reglas: armar un outfit completo (al menos top + bottom + calzado;
     agregar chaqueta si el clima lo pide), no repetir lo usado en la
     ventana de "no repetir" salvo que no haya alternativa razonable, y
     explicar la elección en 1–2 frases;
   - formato de salida JSON estricto:
     `{ "garment_ids": [...], "reasoning": "..." }`.
5. **Validación** — el servidor verifica que los `garment_ids` devueltos
   sean del usuario y estén activos (defensa contra alucinaciones o
   inyección). Si la IA devuelve algo inválido, reintenta una vez; si vuelve
   a fallar, cae a un algoritmo simple no-IA (toma una prenda por
   categoría que no haya sido usada hace poco) y avisa al cliente.
6. **Respuesta** — `{ outfit: [...], reasoning: "...", source: "ai_suggested" }`.

Nada se guarda todavía. Se guarda cuando el usuario toca **Aceptar**.

### Cambiar una pieza — sin IA

Cuando el usuario edita el outfit cambiando una pieza, el cliente:
1. Pide al servidor la lista de prendas activas del usuario filtradas por
   categoría (endpoint simple: `GET /api/garments?category=pantalón`).
2. El usuario elige una.
3. El outfit en memoria del cliente se actualiza.
4. Al guardar, el `source` cambia a `user_edited`.

**No** hay llamada a la IA en este flujo. Es lo que pidió el usuario y tiene
sentido: ahorra cuota y es instantáneo.

### Regenerar todo

Tap en "Regenerar todo" → nueva llamada a `/api/suggest-outfit` con la
misma ocasión y plan_text. La IA puede proponer un outfit distinto. La
sugerencia anterior no se guarda (solo la aceptada se persiste).

### Cuota agotada

Si Gemini devuelve 429 o nos quedamos sin créditos, el servidor responde con
un mensaje claro al cliente. El cliente muestra un texto amable ("la IA
descansa por hoy") y propone el fallback no-IA o esperar.

### Por qué este diseño es seguro
- La key de Gemini solo vive en el servidor.
- El cliente no puede pedir sugerencias para outfits de otro usuario: el
  `user_id` sale de la sesión, no del request.
- La IA solo ve datos del propio usuario.
- Si la IA alucina un `garment_id` que no es del usuario, el servidor lo
  rechaza.

---

## 8. Clima y ubicación

- **API**: Open-Meteo, `https://api.open-meteo.com/v1/forecast`. Sin key,
  sin registro.
- **Cómo se obtiene la ubicación**:
  1. Si el usuario dio permiso, `navigator.geolocation.getCurrentPosition`,
     con timeout corto (4s).
  2. Si negó o falló: `default_lat/lng` del perfil.
  3. Si tampoco tiene default: la pantalla Hoy muestra el plan del día sin
     clima y la IA recibe "clima desconocido" (sugerirá algo genérico).
- **Privacidad**: la geo del navegador **no se persiste**. Solo se usa en el
  momento para consultar Open-Meteo. Lo único que persiste es la ubicación
  por defecto que el usuario configure en Ajustes.
- **Atribución**: línea pequeña debajo del bloque de clima en la pantalla
  Hoy: "Datos meteorológicos por Open-Meteo".

---

## 9. PWA: instalación y comportamiento

- `manifest.webmanifest` con: `name: "Drestyl"`, `short_name`,
  `theme_color: #FAFAFA`, `background_color: #FAFAFA`, íconos en varios
  tamaños (mínimo 192 y 512px, idealmente con maskable icon).
- **Service Worker** liviano (caché de shell + offline básico). No se
  cachea data del usuario para que siempre esté fresca; sí los assets.
- **Prompt de instalación**:
  - Android / Chrome: capturamos `beforeinstallprompt` y mostramos un
    banner suave la primera vez que el usuario llega a Hoy con el clóset
    armado. Si lo cierra, no insistimos.
  - iOS / Safari: como no expone el evento, mostramos una guía visual con
    íconos: "Toca ⎘ → Agregar a pantalla de inicio".
- **Theme color** del navegador en `#FAFAFA` para que la barra superior
  coincida con la app.
- **Viewport**: `viewport-fit=cover` para respetar notch en iPhones, con
  `safe-area-inset` en la barra inferior.

---

## 10. Identidad visual

### Paleta (definida por el usuario)
- Fondo: `#FAFAFA` (off-white)
- Texto principal y oscuros: `#1A1A1A` (carbón)
- Bordes y separadores: `#E4E4E4` (gris suave)
- Acento (botón primario, focus, links activos): `#7C5CFF` (lila)

Para feedback se derivan tonos planos a partir de esos cuatro (sin
gradientes, sin sombras agresivas).

### Tipografía
- **Inter** (Google Fonts), cargada vía `next/font/google`. Una sola
  familia para mantenerlo limpio en mobile.
- Pesos: 400 (cuerpo), 500 (énfasis), 600 (títulos), 700 (botón principal y
  números grandes).
- Tamaños base: 14–16px cuerpo, 20–24px títulos, 32px hero.

### Reglas visuales
- Sin gradientes, sin sombras agresivas. Bordes sutiles `1px #E4E4E4`.
- Esquinas: `12px` en botones y cards, `8px` en inputs.
- Tap targets mínimos 44×44px.
- Espaciado escala de 4: 4, 8, 12, 16, 24, 32...
- Animaciones mínimas: 150ms ease-out en hover/press, fade de 200ms en
  cambio de pantalla.
- **Sin modales** en ninguna parte (ver decisión en Sección 3): todo flujo
  va por una pantalla con su propia URL.

---

## 11. Stack técnico y arquitectura

- **Frontend**: Next.js 15 (App Router), React, TypeScript, Tailwind CSS.
  Tokens de color en `tailwind.config.ts` (`bg`, `fg`, `muted`, `accent`).
  Componentes base de `shadcn/ui` solo los que **no** sean modales (button,
  input, tabs, toast, switch, slider…). Nada de `Dialog`, `AlertDialog` ni
  `Sheet` con overlay.
- **PWA**: `next-pwa` o config manual de service worker (lo decidimos al
  llegar a esa fase).
- **Procesamiento de imagen en cliente**:
  - Background removal: `@imgly/background-removal` (ONNX en navegador,
    gratis, no envía la foto a terceros).
  - Normalización de luz: pipeline canvas (auto-niveles + balance de
    blancos por grey-world).
  - Compresión: `browser-image-compression` (resize 1280px, webp).
- **Backend / DB / Auth / Storage**: Supabase.
- **IA**: **Gemini** vía Google AI Studio API, server-side. Modelo concreto
  (`gemini-2.5-flash` vs `gemini-2.5-pro`) lo confirmamos cuando lleguemos
  a Fase 4 — `flash` suele ser suficiente para esto y es más barato.
- **Hosting**: Vercel, plan gratis.
- **Validación**: `zod` en cliente y servidor.

### Estructura de carpetas (propuesta)

```
/app
  /(auth)/login
  /(auth)/signup
  /(app)/hoy
  /(app)/hoy/picker/[slot]
  /(app)/closet
  /(app)/closet/nueva/(pasos)
  /(app)/closet/[id]
  /(app)/historial
  /(app)/historial/[id]
  /(app)/ajustes
  /api/suggest-outfit
  /api/weather
  /api/garments
/components
  /ui            (shadcn, sin modales)
  /closet
  /outfit
  /pwa
/lib
  /supabase       (server, client, types)
  /ai             (prompts, llamada a Gemini)
  /weather        (open-meteo)
  /image          (bg-removal, levels, compress)
  /utils
/styles
/public
  manifest.webmanifest
  icons/
```

---

## 12. Seguridad (DevSecOps integrado)

- **Secrets**: solo en variables de entorno (`.env.local` en dev, Vercel env
  en prod). `.env.local` en `.gitignore` siempre.
- **Aislamiento por usuario**: RLS activa en todas las tablas con
  `auth.uid() = user_id`. Sin RLS, no hay deploy.
- **Storage privado**: bucket `garments` con políticas que solo permiten al
  dueño leer/escribir su propio path. URLs firmadas con expiración corta
  cuando se muestran fotos o cuando Gemini las consume.
- **Validación de entrada**: schemas `zod` en cada API route. Errores
  devuelven mensajes genéricos al cliente; el detalle queda en logs del
  servidor.
- **Manejo de cuota**: no hay límite numérico arbitrario; sí hay manejo
  elegante de 429 / cuota agotada con fallback no-IA.
- **CORS / CSRF**: API routes Next.js solo aceptan same-origin por default;
  añadimos check explícito de `Origin` en handlers sensibles.
- **CSP**: header `Content-Security-Policy` restringido (solo orígenes que
  usamos: dominio propio + Supabase + Open-Meteo + Gemini).
- **Dependencias**: `npm audit` + Dependabot/Renovate para alertas.
- **Geolocalización**: pedida con consentimiento explícito, no persistida.
- **Sanitización**: ningún texto de usuario se inyecta en el prompt de IA
  sin escapado; React escapa en la UI por default.
- **Errores**: la app nunca muestra stack traces ni IDs internos. Logs
  detallados solo en servidor.

---

## 13. Plan de construcción por fases

Pasos chicos. Cada fase termina con algo probable en el celular antes de
seguir. Te aviso antes de cada commit.

### Fase 0 — Cimientos
1. Conectar el directorio local al repo
   `https://github.com/AndersonCoronado357/Drestyl.git` (te pregunto si
   quieres que sea privado y si tiene contenido para reconciliar).
2. Inicializar Next.js + TypeScript + Tailwind.
3. Configurar paleta (#FAFAFA / #1A1A1A / #E4E4E4 / #7C5CFF) y tipografía
   Inter como tokens.
4. Instalar shadcn/ui base — solo componentes no-modales.
5. Manifest + íconos placeholder + service worker mínimo (PWA mínima).
6. Layout raíz con barra inferior vacía y `safe-area`.

**Probar:** abrir en celular vía LAN, ver que se siente nativa, que se
puede instalar a inicio.

**Te voy a pedir aquí:** confirmar si el repo está vacío o no.

---

### Fase 1 — Auth y cuenta
1. Crear proyecto Supabase (te pido la URL y la anon key).
2. Configurar Supabase Auth (email/password).
3. Pantalla bienvenida + login + signup.
4. Tabla `profiles` con trigger que se crea automáticamente al registrarse.
5. Protección de rutas: todo `/(app)/*` requiere sesión.
6. Pantalla Ajustes mínima (cerrar sesión).

**Probar:** registrarse, entrar, salir.

**Te voy a pedir:**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

---

### Fase 2 — Clóset
1. Tabla `garments` (5 columnas — ver Sección 6) + RLS + storage bucket
   `garments` + policies.
2. Cerrar contigo la **lista final de categorías** (vocabulario colombiano).
3. Pantalla "Mi clóset" con estado vacío.
4. Flujo de varias pantallas para agregar prenda (Sección 5.5).
5. Procesamiento de foto en cliente: background removal + auto-niveles +
   compresión webp. Pantalla intermedia con antes/después.
6. Subida a Supabase Storage con path `{user_id}/{garment_id}.webp`.
7. Grilla con filtros (categoría, activas/todas).
8. Pantalla detalle/editar/eliminar (con "Confirmar eliminación" en rojo,
   sin dialog).

**Probar:** subir varias prendas reales, ver que el fondo se quita y la luz
se normaliza, editar una, eliminar una.

---

### Fase 3 — Pantalla Hoy con clima (sin IA aún)
1. Permiso de geolocalización + fallback a default.
2. API route `/api/weather` server-side para consultar Open-Meteo
   (no exponemos la geo a terceros desde el cliente y podemos cachear).
3. Render del clima en la pantalla Hoy.
4. Chips de ocasión + input de texto.
5. Atribución de Open-Meteo visible.

**Probar:** ver el clima real, elegir una ocasión.

---

### Fase 4 — Sugerencia con IA
1. Tabla `outfits`.
2. API route `/api/suggest-outfit` con toda la lógica de la Sección 7,
   usando Gemini.
3. API route `/api/garments?category=...` para el picker.
4. UI de sugerencia (cards de las prendas + reasoning + botones).
5. Aceptar → guarda en `outfits` con `source = ai_suggested`.
6. Regenerar todo → nueva llamada.
7. Cambiar pieza → navega al picker, sin IA, `source = user_edited`.
8. Fallback no-IA si Gemini falla.

**Probar:** generar sugerencias reales, aceptar, regenerar, cambiar piezas.

**Te voy a pedir:**
- `GEMINI_API_KEY`
- Confirmar el modelo (`gemini-2.5-flash` recomendado).

---

### Fase 5 — Historial y "no repetir"
1. Pantalla Historial.
2. Pasar el historial reciente al prompt de IA (Sección 7 ya lo
   contempla — acá lo pulimos).
3. Chips de "ventana de no repetir" en Ajustes.
4. Editar / borrar entradas del historial (sin modales).

**Probar:** después de usar algo, ver que la IA no lo repite dentro de la
ventana.

---

### Fase 6 — PWA pulida + pulido general
1. Íconos finales (te pregunto si los diseñas tú o uso placeholders).
2. Banner de instalación con UX no agresivo.
3. Guía visual para iPhone.
4. Estados vacíos, loadings, errores en cada pantalla.
5. Mensajes de "la IA descansa por hoy" cuando hay cuota agotada.
6. Pulido de animaciones.
7. Lighthouse/PWA score check.

**Probar:** todo el flujo desde cero, instalar como app, usar offline lo
que se pueda.

---

### Fase 7 — Lanzamiento al grupo
1. Deploy a Vercel.
2. Configurar variables de entorno en Vercel.
3. Dominio (te pregunto si tienes uno o usamos `drestyl.vercel.app`).
4. Subir las claves a Vercel.
5. Test con 2-3 personas antes de abrir a los 10-15.

---

## 14. Lo que voy a necesitar de ti

Te lo aviso cuando llegue cada paso, no todo ahora:

1. **¿El repo está vacío o ya tiene contenido?** ¿Privado o público?
   (Fase 0.)
2. **Variables de Supabase** (Fase 1).
3. **Lista final de categorías de prenda** en colombiano (inicio Fase 2).
4. **`GEMINI_API_KEY` y modelo a usar** (Fase 4).
5. **Íconos finales** o aprobación para placeholders (Fase 6).
6. **Dominio** o `drestyl.vercel.app` (Fase 7).
7. **Aprobar este documento ahora.** Corrígelo, recorta lo que no quieras
   y suma lo que falte.

---

## 15. Lo que NO voy a hacer sin tu aprobación

- Hacer deploys a producción.
- Borrar nada que esté en uso.
- Agregar dependencias "porque sí" — solo las del stack acordado.
- Cambiar el alcance fuera de lo que dice este documento.
- Subir secretos a git (esto nunca, ni con aprobación).

---

**Tu turno.** Marca qué cambias de Secciones 2, 3, 4, 5, 7 o cualquier
otra. Cuando me digas "está bien", arrancamos Fase 0.
