# Bitácora AYUDA IA

## 2026-11-06 13:54 PET — F0 base previa
- Hecho: repositorio inicializado; esqueleto, esquema SQL, almacenamiento en memoria/PostgreSQL, tablero, seed y reset simulados, Dockerfile y ejemplo de entorno. Respaldo del workflow exportado localmente y excluido de Git por contener configuración sensible.
- Pruebas: sintaxis JavaScript correcta; con Node 24 y dependencias existentes de otro proyecto, arranque local correcto, HTML 200, seed de 25 alertas simuladas y reset a cero. La prueba de PostgreSQL queda pendiente.
- Falló: instalación npm desde el registro por ECONNRESET; no hay Node 20 ni Docker disponibles en PATH. Sin caché previa de CDN, mapa sin internet no cumple aún la prueba 4.
- Falta: completar F0 con instalación reproducible, verificación de PostgreSQL y prueba sin internet; F1–F3 y pruebas de aceptación siguen pendientes.

## 2026-11-06 13:58 PET — F1 avance: motor y API
- Hecho: endpoint autenticado, registro de vecinos, fusión de alertas, conservación de medios, motor de puntuación con razones, decisión manual, bitácora y tarjetas con votos y SSE.
- Pruebas: POST de audio con ubicación produce 60 puntos y estado verificando; despacho manual indica Defensa Civil (SIMULADO). Con solicitudes de confirmación precargadas, tres SÍ producen despacho y dos NO producen descarte.
- Falló o falta: los pedidos reales, anuncios automáticos y la regla de dengue aún no están conectados; no se han pasado las pruebas completas de §6. En el caso de incendio sin foto hay contradicción: <40 pide evidencia, pero la prueba requiere votos NO y los pedidos solo se generan en 40–69. Se mantiene la regla de decisión literal y se deja constancia.

## 2026-11-06 14:01 PET — F1 integración local
- Hecho: pedidos y anuncios mediante Evolution, anuncios simulados si no está configurado, regla de dengue persistida, marcador, QR local y mapa esquemático de respaldo sin conexión. Dependencias instaladas mediante registro alternativo y archivo lock generado.
- Pruebas: Node 20.20.2, Evolution simulado por servidor HTTP local: 9 pedidos, 3 SÍ, despacho, anuncio y regla de dengue correctos. La regla se aceleró para la prueba; en la demo puede configurarse a 2 minutos.
- Falta: prueba completa con WhatsApp real, PostgreSQL y navegador sin red; la prueba de incendio sigue limitada por la contradicción indicada. El Portainer configurado corresponde al nodo 158.220.118.109 y la red Tecmastersia existe.

## 2026-11-06 14:04 PET — F2 preparación del canal
- Hecho: respaldo completo de n8n exportado antes de tocar el workflow; generador de copia local con ramas de audio, imagen, video, ubicación y texto, prompts literales de la especificación, Redis y memoria existentes. Eliminados los nodos comerciales de la copia; webhook y credenciales referenciadas conservados.
- Pruebas: 26 nodos y conexiones internas consistentes; webhook, Redis y memoria presentes; ningún nodo lleva el nombre anterior. En navegador con peticiones externas bloqueadas, seed muestra 25 tarjetas SIMULADAS y mapa esquemático local.
- Falta: validar el workflow contra n8n, publicar la aplicación y probar WhatsApp real. El workflow activo aún no se ha modificado. La memoria existente conserva su esquema histórico de base de datos para respetar la instrucción de preservarla.

## 2026-11-06 17:18 PET — F2/F3 publicación y estado
- Hecho: base aislada `ayudaia`, imagen y stack propio en Server TEC; URL HTTPS validada; workflow existente actualizado por API después del respaldo y exportación final guardada fuera de Git. La app local corre con Node 20 y memoria; la pública tiene 25 alertas simuladas. Los datos simulados ya no suman corroboración a reportes reales.
- Pruebas: HTTPS devuelve la API; seed y reset probados en la app pública con PostgreSQL; workflow recuperado por API activo con 26 nodos y memoria conservada. Prueba previa de integración local con Evolution simulado aprobada.
- Falló: resolución ambigua del alias `postgres`, corregida usando `postgres_postgres`; una operación externa agotó el tiempo, pero reset interno y seed posterior respondieron correctamente. La consulta automática del número de Evolution no respondió.
- Falta: prueba con WhatsApp real (texto, audio, foto y ubicación), comprobar el QR con el número real, validar entrega y respuestas de Evolution, ensayo con personas y video. El workflow fue actualizado pero no está validado con un mensaje real; los conectores a entidades siguen siendo SIMULADOS.

## 2026-11-06 17:20 PET — Canal Evolution
- Hecho: instancia `IA` consultada desde la red interna, estado conectado; configurados su número para el QR y la URL interna de Evolution en el stack aislado.
- Pruebas: Evolution responde HTTP 200 en red interna; web HTTPS vuelve a responder con 25 alertas simuladas y número configurado.
- Falta: el usuario debe enviar un WhatsApp real y ubicación para verificar el flujo; no se ha comprobado todavía la entrega de confirmaciones reales ni la prueba del pitch con personas.


## 2026-11-06 17:26 PET — Corrección de respuesta en WhatsApp
- Los dos mensajes de prueba procedían de un grupo y el normalizador los descartaba. Se habilitó el grupo conservando la identificación del participante.
- La petición a la app tenía una expresión inválida; se movió la preparación a un nodo de código. Se reprocesó el último mensaje recibido.
- Prueba: ejecución 1508 completada; la app devolvió respuesta y Evolution aceptó el envío. Pendiente confirmación visual del usuario y prueba de ubicación.

## 2026-11-06 17:42 PET — Respuesta contextual y evidencia visual
- La foto quedaba retenida en la agrupación; se aisló su clave de Redis y se incorporó al evento con su clasificación visual. Se corrigió la identificación de sesión de la memoria que estaba vacía.
- La aplicación reutiliza la ubicación previamente compartida y reconoce la foto recibida; explica el siguiente paso, el carácter SIMULADO y los teléfonos de emergencia.
- Pruebas: ejecución 1522 procesó la imagen y la adjuntó a una alerta; ejecución 1523 procesó la ubicación, generó la respuesta contextual y Evolution aceptó el envío. La evidencia fue clasificada como contradictoria y la alerta requiere más datos.
- Observación: durante las pruebas el workflow mostró una versión anterior de un nodo; se restauró la preparación del evento sobre el workflow vigente.

## 2026-11-06 17:52 PET — Criterios operativos y tablero
- Tablero público de criterios con simulador de mensajes y teléfonos oficiales; prompt de clasificación actualizado.
- Riesgo inmediato (gravedad 5): prioridad sin esperar votos, registro de derivación simulada y orientación a 116/105/106. Las ubicaciones posteriores se incorporan a la alerta.
- Pruebas: prioridad con y sin ubicación, integración de nueve pedidos/tres votos/dengue y tablero en navegadores de 1440 y 390 px. Tablero público responde HTTP 200.
- Los conectores a entidades no envían avisos reales; se identifican como simulados en la respuesta y el tablero. Los números locales no se presentan como los más cercanos sin una verificación geográfica.

## 2026-11-06 18:26 PET — Contexto y conversación
- Revisión de interacciones: un saludo se clasificó como inundación por mezclar mensajes y memoria anterior; respuestas de registro eran rígidas y la memoria guardaba JSON en vez de la respuesta enviada.
- Corrección: memoria por remitente; cola Redis aislada por mensaje y limpiada tras su lectura; historial de los 20 mensajes recientes; registro de la respuesta real; saludos aislados no abren una alerta; incidentes distintos no se fusionan.
- Pruebas locales: saludo, usuario diferente, ubicación, reportes distintos, consulta, confirmación sin solicitud y peligro inmediato; integración con Evolution simulado. Verificación estructural del workflow activo y HTTP de la app. Falta prueba de una conversación real nueva posterior al despliegue.
- Nota: no se migró la memoria histórica compartida del grupo a identidades individuales, porque no se puede atribuir de forma segura a cada participante.
