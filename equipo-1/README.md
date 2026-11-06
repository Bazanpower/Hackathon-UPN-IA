# Equipo Rocket

**Integrantes:** Jonathan Smith Bazan Amaro · Jackelin Soncco Puma

# AYUDA IA — "¡Ayuda ya!"
**Central ciudadana de alertas con IA frente al Fenómeno El Niño** · Hackathon IA+ UPN 2026 "Del Fenómeno a la Solución"

🔗 **Demo en vivo:** https://ayudaia.crm-ia.org
📱 **Canal:** WhatsApp (escanea el QR del tablero, escribe HOLA y comparte tu ubicación)

## El problema
- 3 nov 2026: emergencia en **1 380 distritos** por lluvias de El Niño 2026-2027 (DS 149-2026-PCM), incluidos 65 de Piura.
- Las centrales reciben alertas tarde, dispersas, repetidas o falsas, y gastan brigadas y cisternas en lo que no es.
- El agua que no llega mata dos veces: EPS Grau da en promedio ~12 h de agua al día; las familias almacenan agua y eso crea criaderos de dengue. En 2023 la mitad de los niños fallecidos por dengue en el Perú eran de Piura (UNICEF). En 2026 Piura suma 14 761 casos (CDC-Minsa, SE 42).

## La solución
Cualquier vecino manda su alerta por **WhatsApp** (texto, audio, foto, video o ubicación). AYUDA IA:
1. **Escucha**: transcribe audios y analiza fotos con IA (OpenAI).
2. **Ubica**: usa la ubicación de WhatsApp; identifica por número de celular (sin DNI obligatorio).
3. **Verifica**: puntaje de credibilidad 0–100 explicado (coherencia de la evidencia, reportes cercanos, zonas oficiales de riesgo, historial del número).
4. **Pregunta a los vecinos cercanos** "¿Está pasando? SÍ / NO" y recalcula en vivo.
5. **Decide y enruta**: pide evidencia, verifica o despacha a la entidad correcta (Defensa Civil, Bomberos, SAMU, EPS, Diresa — conectores **simulados** en el prototipo).
6. **Avisa por zona** y marca **riesgo de dengue** en sectores sin agua (regla explicada, no predicción).
7. **Mapa de calor en tiempo real** y bitácora de cada decisión.

No reemplaza al 116/105/106 ni al COEN: es la capa que **filtra y valida antes** para no gastar recursos.

## Arquitectura
```
WhatsApp → Evolution API → n8n (normaliza, agrupa, transcribe audio, clasifica imagen, agente IA con memoria)
        → App AYUDA IA (Node 20 + Express + PostgreSQL): credibilidad, confirmación vecinal, enrutamiento, anuncios
        → Tablero web (Leaflet + mapa de calor + SSE) en https://ayudaia.crm-ia.org
```

## Ejecutar en local
```bash
cd app
npm install
cp .env.example .env   # completar valores; sin DATABASE_URL usa almacenamiento en memoria
npm start              # http://localhost:3000
```
Datos de demostración: `POST /api/demo/seed` (alertas **SIMULADAS** en Piura). Especificación completa en `SPEC.md`; registro de trabajo en `BITACORA.md`.

## Qué es real y qué es simulado
- **Real:** entrada por WhatsApp, transcripción y análisis de imagen con IA, puntaje de credibilidad, confirmación por vecinos, mapa de calor en vivo, anuncios por WhatsApp.
- **Simulado (rotulado en pantalla):** envío a entidades (116, SAMU, EPS, Diresa), alertas de ejemplo en Piura.
- **Futuro:** cámaras municipales, SMS, convenios con centrales oficiales, sensores de ríos.

## Hecho durante el hackathon
Ver historial de commits (`F0 base previa` antes de las 14:30; F1–F4 durante el evento) y `BITACORA.md`. Se reutilizó infraestructura previa del equipo (Evolution API, n8n, servidor) y un flujo n8n base que se adaptó.

## Equipo
TecMasters IA — Adri y Juanpe.
