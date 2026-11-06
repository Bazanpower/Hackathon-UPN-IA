# SPEC — AYUDA IA ("¡Ayuda ya!") · fuente única de verdad para Codex

Hackathon IA+ UPN 2026 · pitch HOY 18:30. Lo que no esté aquí, no se construye.
Regla: todo dato simulado se marca `simulado=true` y se ve en pantalla con la etiqueta **SIMULADO**.

## 0. Qué es
Central ciudadana de alertas por WhatsApp. El vecino manda texto, audio, foto, video o ubicación. La IA entiende la alerta; la app calcula un **puntaje de credibilidad (0–100) explicado**, **pide confirmación SÍ/NO a vecinos cercanos**, decide (pedir evidencia / verificar / despachar / descartar), **enruta a la entidad** (conector simulado), muestra todo en un **mapa de calor en tiempo real** y permite **anuncios por zona**. No reemplaza al 116/105/106/COEN: filtra y valida antes.

## 1. Arquitectura
```
WhatsApp ─ Evolution (instancia "IA") ─ n8n workflow bXTBFNMKpEhwcjsM (webhook /demoteva, SE EDITA ESTE)
   n8n: normaliza → agrupa (Redis) → audio→texto, imagen→clasificación (OpenAI) → agente AYUDA IA (memoria Postgres existente)
   n8n ──POST /api/n8n/evento──► App AYUDA IA (Node 20 + Express + Postgres) ──► respuesta { reply } ──► n8n envía por Evolution
   App ──► Evolution API directo: pedidos de confirmación a vecinos y anuncios por zona
   App ──► Tablero web (Leaflet + leaflet.heat + SSE) en https://ayudaia.crm-ia.org
```

## 2. App AYUDA IA (carpeta `app/`)
Stack: Node 20, Express, `pg`, HTML/JS plano (sin framework), Leaflet + leaflet.heat desde CDN, SSE para tiempo real. Sin build step.
Si no hay `DATABASE_URL` → almacenamiento en memoria (mismo interfaz) para correr en la laptop como respaldo.

### 2.1 Variables (`app/.env.example`, nunca valores reales en git)
`PORT=3000` · `DATABASE_URL` · `N8N_SHARED_SECRET` · `EVOLUTION_URL` · `EVOLUTION_APIKEY` · `EVOLUTION_INSTANCE=IA` · `DEMO_RADIUS_M=300` · `DEMO_WINDOW_MIN=30` · `MAX_CONFIRM_REQUESTS=15` · `SIN_AGUA_HORAS_DENGUE=48` (demo: permitir minutos con `SIN_AGUA_MINUTOS_DENGUE_DEMO=2`) · `WA_NUMBER` (para el QR).

### 2.2 Tablas
- `vecinos(phone PK, nombre, dni NULL, lat, lng, ubic_at, reputacion INT DEFAULT 0, created_at)`
- `alertas(id SERIAL, phone, tipo, gravedad, descripcion, lugar_texto, lat, lng, vulnerables TEXT, evidencia JSONB, media JSONB, credibilidad INT, razones JSONB, estado, entidad, simulado BOOL DEFAULT false, created_at, updated_at)`
  - `tipo ∈ inundacion|huaico|sin_agua|desague|incendio|herido|derrumbe|vivienda_danada|otro`
  - `estado ∈ nueva|pide_evidencia|verificando|despachada|descartada`
- `confirmaciones(id, alerta_id, phone, respuesta ∈ si|no, created_at)` — un voto por phone por alerta
- `pedidos_confirmacion(alerta_id, phone, enviado_at)` — para saber a qué alerta responde un "SÍ"
- `anuncios(id, texto, lat, lng, radio_m, enviados INT, simulado BOOL, created_at)`
- `bitacora(id, alerta_id NULL, evento, detalle JSONB, at)` — TODO cambio de estado/puntaje se registra aquí
- `media(id, alerta_id, phone, mime, path, created_at)` — archivos en `app/data/media/`

### 2.3 Endpoint principal: `POST /api/n8n/evento`
Header `x-ayuda-secret: N8N_SHARED_SECRET`. Body:
```json
{ "phone":"519...", "nombre":"Ana", "tipo_mensaje":"text|audio|image|video|location",
  "texto":"transcripción o texto", "lat":-12.05, "lng":-77.05,
  "media": { "mime":"image/jpeg", "base64":"..." },
  "ia": { "intencion":"alerta|confirmacion|registro|consulta|otro",
          "alerta": { "tipo":"inundacion","gravedad":1-5,"descripcion":"...","lugar_texto":"...","vulnerables":"...","evidencia_coherente":true|false|null },
          "confirmacion":"si|no|null",
          "respuesta_sugerida":"texto corto para el vecino" } }
```
Lógica:
1. Upsert `vecinos`. Si trae lat/lng → guardar ubicación del vecino.
2. Si trae `media.base64` → guardar en `media` (asociar a la última alerta abierta del phone de los últimos 10 min, o a la que se cree).
3. `intencion=registro` o solo ubicación sin alerta abierta → reply: "✅ Quedaste registrado como vecino. Si ves un siniestro, mándanos audio, foto y tu ubicación."
4. `intencion=alerta` → si el phone tiene alerta abierta < 10 min, **fusionar** (agregar evidencia, completar lat/lng); si no, crear. Recalcular credibilidad (§2.4) y aplicar decisión (§2.5).
5. `intencion=confirmacion` → buscar el último `pedidos_confirmacion` de ese phone (< 60 min) → guardar voto → recalcular → decisión.
6. Responder `{ "reply": "..." }` (texto que n8n envía). Emitir SSE `alerta_actualizada`.
Si no hay ubicación en una alerta: reply pide "📍 Comparte tu ubicación (clip → Ubicación)".

### 2.4 Motor de credibilidad (determinista, cada punto con razón legible)
| Señal | Puntos |
|---|---|
| Base | 30 |
| Evidencia coherente con lo dicho (foto/audio, `evidencia_coherente=true`) | +20 · si `false` −15 |
| Ubicación GPS compartida | +10 |
| Otros reportes del mismo tipo, de otros números, ≤ `DEMO_RADIUS_M` y ≤ `DEMO_WINDOW_MIN` | +15 c/u, máx +30 |
| Zona con aviso oficial / punto crítico (lista `app/data/zonas_oficiales.json`, rotulada con su fuente) | +10 |
| Cada confirmación SÍ | +10, máx +30 |
| Cada confirmación NO | −15 |
| Reputación del número (alertas previas confirmadas +5 / descartadas −10) | ±10 |
Limitar 0–100. Guardar `razones` como lista de `{señal, puntos, detalle}`.

### 2.5 Decisión
- `< 40` → `pide_evidencia`: reply pide foto/audio/ubicación.
- `40–69` → `verificando`: enviar por Evolution a vecinos con ubicación dentro del radio (excluye al autor, máx `MAX_CONFIRM_REQUESTS`, una vez por alerta): *"⚠️ AYUDA IA: reportan {tipo} cerca de ti ({lugar}). ¿Está pasando? Responde SÍ o NO."* Registrar `pedidos_confirmacion`.
- `≥ 70` → `despachada`: `entidad` por tabla §2.6 (conector **SIMULADO**), bitácora, anuncio automático a la zona, reply al autor: "🚨 Alerta verificada y enviada a {entidad}. Mantente a salvo."
- Si ≥ 2 NO y puntaje < 25 → `descartada`: reply "Gracias, tu reporte no pudo verificarse. Si sigue pasando, mándanos foto y ubicación." Tablero muestra "Descartada: no se gastó una brigada".
- `sin_agua` despachada → además crear marcador **"Riesgo de dengue (regla)"** en la zona cuando pase `SIN_AGUA_HORAS_DENGUE` (o el valor demo) → entidad extra "Diresa – control larvario (SIMULADO)" + anuncio "Tapa y lava tus recipientes de agua".

### 2.6 Enrutamiento (todos SIMULADOS en la demo)
inundacion/huaico/derrumbe/vivienda_danada → "Defensa Civil municipal / COE" · incendio → "Bomberos 116" · herido → "SAMU 106" · sin_agua/desague → "EPS Grau" (+ Diresa por regla dengue) · otro → "COE".

### 2.7 Otros endpoints
- `GET /api/estado` → alertas, vecinos (solo conteo + puntos), anuncios.
- `GET /api/stream` → SSE (`alerta_nueva`, `alerta_actualizada`, `voto`, `anuncio`, `vecino`).
- `POST /api/alertas/:id/decision` `{accion: despachar|descartar}` (operador humano, queda en bitácora).
- `POST /api/anuncios` `{texto, lat, lng, radio_m}` → envía por Evolution a vecinos en radio; si no hay Evolution → `simulado=true`.
- `POST /api/demo/seed` → 25 alertas **SIMULADAS** en Piura/Castilla/Veintiséis de Octubre (para que el mapa de calor se vea a escala ciudad). `POST /api/demo/reset` borra lo simulado y lo de la demo.
- `GET /media/:id` sirve la imagen.

### 2.8 Tablero (`app/public/index.html`) — pantalla grande del salón
- Izquierda 65 %: mapa (OSM) con capa de calor (peso = credibilidad/100, más alto si `despachada`) + marcadores por estado (gris nueva, amarillo verificando, rojo despachada, tachado descartada, morado riesgo dengue). Botones: "Ver Piura (simulado)" / "Ver salón (en vivo)".
- Derecha 35 %: feed en vivo; tarjeta por alerta: tipo, foto miniatura, transcripción, **barra de credibilidad animada con razones**, votos SÍ/NO en vivo, estado, entidad, hora; desplegable bitácora.
- Arriba: contadores (alertas, verificadas, descartadas, vecinos conectados) + **QR** a `https://wa.me/{WA_NUMBER}?text=HOLA` + botón "Anuncio por zona".
- Banner fijo: "Prototipo. No reemplaza alertas oficiales (INDECI, Senamhi, Minsa). Conectores marcados SIMULADO."
- Estilo: oscuro, alto contraste, legible a 5 m. Español.

### 2.9 Despliegue
`app/Dockerfile` (node:20-alpine). Stack Portainer `ayudaia` en la red Swarm existente con labels Traefik: host `ayudaia.crm-ia.org`, entrypoint y certresolver según `server tec.env` (`TRAEFIK_CERTRESOLVER`). Base de datos nueva `ayudaia` en el Postgres compartido. Volumen para `app/data/media`. **Servidor: Server TEC `158.220.118.109`** (el mismo de `devn8n.crm-ia.org`). DNS `ayudaia.crm-ia.org` → A `158.220.118.109` **ya creado**. Todos los datos de despliegue (Portainer, Traefik, red, registry) salen **solo** de `..\server tec\.env`.

## 3. Cambios en n8n (workflow `bXTBFNMKpEhwcjsM`, editar el existente)
**Antes de tocar nada: exportar el JSON completo a `n8n/backup-demoteva-ANTES.json`.** Llave de API de n8n: variable `API_KEY_SERVICIO` en `server tec/.env` (no imprimirla). Mantener webhook `/demoteva`, instancia Evolution `IA`, credenciales OpenAI/Evolution/Postgres/Redis, Redis de agrupación y la memoria (`UPSERT_STATE_AND_GET_HISTORY`).
1. **Normalizar Evolution IA**: hoy descarta foto sin texto, video y ubicación. Debe emitir también: `imageMessage` (con o sin caption), `videoMessage`, `locationMessage`/`liveLocationMessage` → campos nuevos `tipo_mensaje`, `lat`, `lng`, `message_id`, `evolution_message` (para bajar medios).
2. **Switch**: rutear por `tipo_mensaje` → audio | imagen | video | ubicacion | texto.
3. **Imagen**: bajar base64 con nodo Evolution (igual que `RECUPERAR AUDIO EVOLUTION TEVACEL`) → **HTTP Request OpenAI `/v1/responses` con `input_image` (data URL)** + prompt §4.2 → JSON de clasificación. Pasar el base64 a la app para guardarlo.
4. **Video**: tomar caption + marcar `hay_video=true` (análisis de video = futuro). Opcional: guardar base64 si < 10 MB.
5. **Ubicación**: saltar el agente; POST directo a la app con `ia.intencion="registro"` (o adjuntar a alerta abierta, la app decide).
6. **Agente**: reemplazar el prompt TEVACEL por §4.1; salida JSON estricta (`PARSE_AGENT_JSON` adaptado).
7. **Nuevo nodo HTTP** → `POST https://ayudaia.crm-ia.org/api/n8n/evento` con header secreto → enviar `reply` por el nodo Evolution existente.
8. **Eliminar** nodos TEVACEL: PDF, catálogo, presupuesto, alerta TEVACEL, booking/slots, FORZAR*, DETECTAR/REINICIAR PRESUPUESTO.
9. Probar con 1 número y guardar export final en `n8n/ayudaia-final.json`.

## 4. Prompts (los escribe Claude; Codex los pega tal cual)
### 4.1 Agente AYUDA IA (system)
```
Eres AYUDA IA, la central ciudadana de alertas ante emergencias por lluvias del Fenómeno El Niño en Perú.
Recibes mensajes de vecinos por WhatsApp (texto, transcripción de audio, descripción de foto/video, ubicación) y el historial de la conversación.
Tu tarea: clasificar el mensaje y devolver SOLO un JSON válido, sin texto extra:
{"intencion":"alerta|confirmacion|registro|consulta|otro",
 "alerta":{"tipo":"inundacion|huaico|sin_agua|desague|incendio|herido|derrumbe|vivienda_danada|otro","gravedad":1-5,"descripcion":"máx 20 palabras","lugar_texto":"referencia dicha por el vecino o null","vulnerables":"niños, adultos mayores, discapacidad, gestantes o null","evidencia_coherente":true|false|null},
 "confirmacion":"si|no|null",
 "respuesta_sugerida":"máx 2 frases, español peruano sencillo, cálido y directo"}
Reglas:
- "sí", "si", "ya", "confirmo", "está pasando" en respuesta a una pregunta de verificación → intencion=confirmacion, confirmacion=si. "no", "nada", "falso" → confirmacion=no.
- "hola", "registrarme" o solo ubicación → intencion=registro.
- evidencia_coherente: true si la descripción de la foto/audio coincide con el siniestro dicho; false si lo contradice; null si no hay foto/audio.
- gravedad 5 = vidas en riesgo inmediato. Si hay riesgo de vida, la respuesta_sugerida incluye "Si hay peligro inmediato llama al 116 o 106".
- Nunca inventes lugares, cifras ni ayuda que no fue confirmada. No prometas tiempos de llegada.
- Si falta ubicación en una alerta, pide compartir ubicación de WhatsApp.
```
### 4.2 Clasificador de imagen (OpenAI Responses, `input_text` + `input_image`)
```
Eres el verificador visual de AYUDA IA. Mira la imagen enviada por un vecino durante lluvias en Perú.
Devuelve SOLO JSON: {"es_siniestro":true|false,"tipo":"inundacion|huaico|sin_agua|desague|incendio|herido|derrumbe|vivienda_danada|otro|ninguno","gravedad":1-5,"personas_visibles":true|false,"descripcion":"máx 25 palabras de lo que se ve","senales_de_falsedad":"captura de pantalla, foto de internet, imagen antigua, texto superpuesto, o null"}
No identifiques personas. No inventes lo que no se ve.
```

## 5. Fases y horario (commits pequeños con hora; mensaje empieza con la fase)
| Fase | Hora | Entregable | Hecho cuando |
|---|---|---|---|
| F0 base previa | ya → 14:30 | `git init`, `app/` esqueleto, esquema, memoria/Postgres, tablero con mapa + seed simulado, Dockerfile, `BITACORA.md` | commit "F0 base previa" antes de 14:30 |
| F1 cerebro | 14:30–15:30 | `/api/n8n/evento`, credibilidad, decisión, enrutamiento, SSE, tarjetas en vivo | test con `curl` de 3 casos (§6) pasa |
| F2 canal | 15:30–16:30 | cambios n8n §3 + envíos Evolution (confirmaciones y anuncios) | un WhatsApp real aparece en el mapa |
| F3 publicación | 16:30–17:00 | despliegue en `ayudaia.crm-ia.org` | URL con HTTPS responde |
| F4 ensayo | 17:00–17:45 | prueba con ~10 personas + video de respaldo | flujo §6 completo en vivo |

## 6. Pruebas de aceptación
1. **Verdadera**: A manda audio "se inunda la entrada, hay un señor en silla de ruedas" + foto + ubicación → tarjeta con transcripción y foto, puntaje ~60 → 9 vecinos reciben pregunta → 3 SÍ → ≥ 70 → "Despachada a Defensa Civil (SIMULADO)" + anuncio a la zona.
2. **Falsa**: B manda texto "incendio en el salón" sin foto → puntaje bajo → vecinos dicen NO → "Descartada: no se gastó una brigada".
3. **Agua → dengue**: C manda "no tenemos agua desde ayer" + ubicación → despachada a EPS Grau → a los 2 min (modo demo) aparece "Riesgo de dengue (regla)" + anuncio "Tapa y lava tus recipientes".
4. Sin internet: la app en local con memoria + seed muestra el tablero.
