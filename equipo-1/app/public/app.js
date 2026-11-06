'use strict';
const PIURA = [-5.1945, -80.6328], SALA = [-12.0594, -77.0475];
const ICON = { inundacion:'🌊', huaico:'⛰️', sin_agua:'🚱', desague:'🕳️', incendio:'🔥', herido:'🚑', derrumbe:'🪨', vivienda_danada:'🏚️', otro:'⚠️' };
const NOMBRE = { inundacion:'Inundación', huaico:'Huaico', sin_agua:'Sin agua', desague:'Desagüe colapsado', incendio:'Incendio', herido:'Herido', derrumbe:'Derrumbe', vivienda_danada:'Vivienda dañada', otro:'Otro' };
const ESTADO = { nueva:'Nueva', pide_evidencia:'Pide evidencia', verificando:'Verificando', despachada:'Verificada y enviada', descartada:'Descartada' };
const $ = id => document.getElementById(id);
const safe = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const colorScore = v => v >= 70 ? '#1DB954' : v >= 40 ? '#FFD23F' : '#ff5d5d';
let map, layer, heat, prev = null, firstLoad = true, kprev = {};

if (window.L) {
  map = L.map('map', { zoomControl: true, attributionControl: true }).setView(PIURA, 13);
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', { maxZoom: 16, maxNativeZoom: 16, attribution: 'Esri, HERE, Garmin, © OpenStreetMap' }).addTo(map);
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, maxNativeZoom: 16 }).addTo(map);
  map.setMaxZoom(19);
  layer = L.layerGroup().addTo(map);
  setTimeout(() => map.invalidateSize(), 300);
  window.addEventListener('resize', () => map.invalidateSize());
}

function toast(kind, icon, text) {
  const t = document.createElement('div');
  t.className = 'toast ' + kind;
  t.innerHTML = `<span style="font-size:30px">${icon}</span><span>${safe(text)}</span>`;
  $('toasts').appendChild(t);
  setTimeout(() => t.remove(), 6200);
}

function setKpi(id, box, val) {
  const el = $(id);
  if (kprev[id] !== undefined && kprev[id] !== val) { $(box).classList.remove('pop'); void $(box).offsetWidth; $(box).classList.add('pop'); }
  el.textContent = val; kprev[id] = val;
}

function card(a, d, old) {
  const votes = d.confirmaciones.filter(v => v.alerta_id === a.id);
  const si = votes.filter(v => v.respuesta === 'si').length, no = votes.filter(v => v.respuesta === 'no').length;
  const score = Number(a.credibilidad) || 0, start = old ? old.score : 0;
  const foto = Array.isArray(a.media) && a.media.length ? `<img src="/media/${Number(a.media[0])}" alt="Evidencia enviada por el vecino">` : '';
  const chips = (a.razones || []).map(r => `<span class="chip ${r.puntos >= 0 ? 'pos' : 'neg'}">${r.puntos > 0 ? '+' : ''}${Number(r.puntos)} ${safe(r.señal)}</span>`).join('');
  const bit = d.bitacora.filter(x => x.alerta_id === a.id).map(x => `<p>${safe(new Date(x.at).toLocaleTimeString('es-PE'))} · ${safe(x.evento)}</p>`).join('');
  const popSi = old && si > old.si ? ' pop' : '', popNo = old && no > old.no ? ' pop' : '';
  const est = a.estado === 'descartada' ? 'Descartada · no se gastó una brigada' : (ESTADO[a.estado] || a.estado);
  return `<article class="card ${a.simulado ? 'sim' : 'real'} ${safe(a.estado)}" data-id="${a.id}">
    <div class="ctop"><div class="ctitle"><span class="ico">${ICON[a.tipo] || '⚠️'}</span>${safe(NOMBRE[a.tipo] || a.tipo)}${a.simulado ? '<span class="simtag">SIMULADO</span>' : ''}</div>
    <span class="badge b-${safe(a.estado)}">${safe(est)}</span></div>
    <div class="cbody" style="${foto ? '' : 'grid-template-columns:1fr'}">${foto}<div>
      <p class="desc">${safe(a.descripcion)}</p>
      ${a.vulnerables ? `<p class="desc" style="color:#FFD23F;margin-top:4px">👥 ${safe(a.vulnerables)}</p>` : ''}
    </div></div>
    <div class="score"><strong style="color:${colorScore(score)}" data-count="${score}" data-from="${start}">${start}</strong><span>/100 credibilidad</span></div>
    <div class="bar"><i style="width:${start}%;background:${colorScore(start)}" data-w="${score}" data-c="${colorScore(score)}"></i></div>
    <div class="chips">${chips}</div>
    <div class="votes"><div class="vote${popSi}"><small>VECINOS: SÍ</small>✅ ${si}</div><div class="vote${popNo}"><small>VECINOS: NO</small>❌ ${no}</div></div>
    <div class="meta"><span>${a.entidad ? `<span class="entity">→ ${safe(a.entidad)}</span>` : safe(a.lugar_texto || '')}</span><span>${safe(new Date(a.created_at).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }))}</span></div>
    <div class="case-actions">${a.lat != null && a.lng != null ? `<button class="case-map" type="button" data-lat="${Number(a.lat)}" data-lng="${Number(a.lng)}">Ver ubicación <span aria-hidden="true">↗</span></button>` : ''}</div>
    ${bit ? `<details><summary>Bitácora</summary>${bit}</details>` : ''}
  </article>`;
}

function animate() {
  document.querySelectorAll('.bar i[data-w]').forEach(b => requestAnimationFrame(() => { b.style.width = b.dataset.w + '%'; b.style.background = b.dataset.c; }));
  document.querySelectorAll('[data-count]').forEach(el => {
    const to = +el.dataset.count, from = +el.dataset.from; if (to === from) { el.textContent = to; return; }
    const t0 = performance.now();
    const step = t => { const p = Math.min(1, (t - t0) / 800); el.textContent = Math.round(from + (to - from) * p); if (p < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  });
}

function marker(a) {
  const col = a.estado === 'despachada' ? '#FF6B1A' : a.estado === 'verificando' ? '#FFD23F' : '#7D8BA6';
  const pop = `<b>${ICON[a.tipo] || ''} ${safe(NOMBRE[a.tipo] || a.tipo)}</b>${a.simulado ? ' · SIMULADO' : ''}<br>${safe(ESTADO[a.estado] || a.estado)} · ${Number(a.credibilidad) || 0}/100${a.entidad ? '<br>→ ' + safe(a.entidad) : ''}`;
  if (a.estado === 'verificando' && !a.simulado) return L.marker([a.lat, a.lng], { icon: L.divIcon({ className: '', html: '<div class="pulse"></div>', iconSize: [22, 22] }) }).bindPopup(pop);
  return L.circleMarker([a.lat, a.lng], { radius: a.simulado ? 7 : 11, color: '#fff', weight: a.simulado ? 1 : 2, fillColor: col, fillOpacity: a.estado === 'descartada' ? .3 : .95, dashArray: a.estado === 'descartada' ? '3' : null }).bindPopup(pop);
}

async function refresh() {
  let d;
  try { d = await (await fetch('/api/estado', { cache: 'no-store' })).json(); } catch { return; }
  if (d.wa_number && !$('qr').innerHTML && window.qrcode) {
    const href = 'https://wa.me/' + encodeURIComponent(d.wa_number) + '?text=HOLA';
    $('wa').href = href;
    const code = qrcode(0, 'M'); code.addData(href); code.make(); $('qr').innerHTML = code.createImgTag(4, 4);
  }
  const al = d.alertas || [];
  setKpi('kAlertas', 'k1', al.length);
  setKpi('kVer', 'k2', al.filter(a => a.estado === 'despachada').length);
  setKpi('kDes', 'k3', al.filter(a => a.estado === 'descartada').length);
  setKpi('kVec', 'k4', d.vecinos?.conteo ?? 0);

  const state = {};
  al.forEach(a => {
    const v = d.confirmaciones.filter(x => x.alerta_id === a.id);
    state[a.id] = { score: Number(a.credibilidad) || 0, estado: a.estado, si: v.filter(x => x.respuesta === 'si').length, no: v.filter(x => x.respuesta === 'no').length };
  });

  if (prev && !firstLoad) {
    al.filter(a => !a.simulado).forEach(a => {
      const o = prev[a.id];
      if (!o) { toast('new', ICON[a.tipo] || '⚠️', `Nueva alerta: ${NOMBRE[a.tipo] || a.tipo}`); if (map && a.lat != null) map.flyTo([a.lat, a.lng], 17, { duration: 1.2 }); return; }
      if (o.estado !== 'despachada' && a.estado === 'despachada') toast('ok', '🚨', `Verificada y enviada a ${a.entidad || 'la entidad'}`);
      if (o.estado !== 'descartada' && a.estado === 'descartada') toast('no', '🛑', 'Descartada: no se gastó una brigada');
    });
  }

  const orden = al.slice().sort((x, y) => (x.simulado - y.simulado) || (new Date(y.created_at) - new Date(x.created_at)));
  const filtro = $('filtroAlertas').value;
  const visibles = orden.filter(a => filtro === 'todas' || (filtro === 'reales' && !a.simulado) || (filtro === 'simuladas' && a.simulado) || a.estado === filtro);
  $('conteoFiltro').textContent = `${visibles.length} / ${al.length}`;
  $('feed').innerHTML = visibles.length ? visibles.map(a => card(a, d, prev && prev[a.id])).join('') : '<div class="empty">No hay alertas para este filtro.</div>';
  animate();

  if (map) {
    layer.clearLayers(); if (heat) map.removeLayer(heat);
    const pts = [];
    al.filter(a => a.lat != null && a.lng != null).forEach(a => {
      if (a.estado !== 'descartada') pts.push([a.lat, a.lng, Math.min(1, ((Number(a.credibilidad) || 0) / 100) * (a.estado === 'despachada' ? 1.5 : 1))]);
      marker(a).addTo(layer);
    });
    (d.riesgos || []).forEach(r => {
      L.circle([r.lat, r.lng], { radius: 220, color: '#7B3FE4', weight: 2, fillColor: '#7B3FE4', fillOpacity: .18 }).addTo(layer);
      L.circleMarker([r.lat, r.lng], { radius: 12, color: '#fff', weight: 2, fillColor: '#7B3FE4', fillOpacity: .95 })
        .bindPopup(`<b>🦟 Riesgo de dengue (regla)</b><br>${safe(r.etiqueta || '')}<br>→ ${safe(r.entidad || 'Diresa')}${r.simulado ? ' · SIMULADO' : ''}`).addTo(layer);
    });
    const vec = (d.vecinos && d.vecinos.puntos) || [];
    vec.forEach(v => L.circleMarker([v.lat, v.lng], { radius: 6, color: '#fff', weight: 1.5, fillColor: '#2F6BFF', fillOpacity: .95 }).bindPopup('👤 Vecino conectado').addTo(layer));
    const reales = al.filter(a => !a.simulado && a.lat != null && a.lng != null).sort((x, y) => new Date(y.created_at) - new Date(x.created_at));
    if (firstLoad) {
      if (reales.length) map.setView([reales[0].lat, reales[0].lng], 17);
      else if (vec.length) map.setView([vec[vec.length - 1].lat, vec[vec.length - 1].lng], 17);
    } else if (prev && vec.length > (prev.__vec || 0)) {
      const v = vec[vec.length - 1]; map.flyTo([v.lat, v.lng], 17, { duration: 1.2 });
      toast('new', '👤', 'Nuevo vecino conectado');
    }
    state.__vec = vec.length;
    if (prev && (d.riesgos || []).length > (prev.__riesgos || 0)) toast('risk', '🦟', 'Zona sin agua: riesgo de dengue → aviso a Salud');
    if (L.heatLayer && pts.length) heat = L.heatLayer(pts, { radius: 38, blur: 26, maxZoom: 17, minOpacity: .35, gradient: { 0.3: '#0B3D91', 0.55: '#FF6B1A', 0.8: '#FFD23F', 1: '#FFFFFF' } }).addTo(map);
  }
  state.__riesgos = (d.riesgos || []).length;
  prev = state; firstLoad = false;
}

async function verPiura() {
  if (!(prev && Object.keys(prev).length > 3)) await fetch('/api/demo/seed', { method: 'POST' });
  await refresh();
  if (map) map.flyTo(PIURA, 13, { duration: 1.2 });
}
function verSala() {
  if (!map) return;
  const pts = [];
  layer.eachLayer(l => { if (l.getLatLng && !(l.options && l.options.radius === 7)) pts.push(l.getLatLng()); });
  const reales = pts.filter(p => Math.abs(p.lat - PIURA[0]) > 0.5 || Math.abs(p.lng - PIURA[1]) > 0.5);
  if (reales.length) map.flyToBounds(L.latLngBounds(reales).pad(0.4), { maxZoom: 18, duration: 1.2 });
  else map.flyTo(SALA, 17, { duration: 1.2 });
}

async function anunciar() {
  if (!map) return alert('El mapa no está disponible');
  const texto = prompt('Texto del anuncio para los vecinos de la zona visible', '⚠️ AYUDA IA: corte de agua en tu sector. Tapa y lava tus recipientes de agua.');
  if (!texto) return;
  const radio_m = Number(prompt('Radio en metros', '300')); if (!radio_m) return;
  const c = map.getCenter();
  const r = await fetch('/api/anuncios', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ texto, lat: c.lat, lng: c.lng, radio_m }) });
  const a = await r.json();
  L.circle([c.lat, c.lng], { radius: radio_m, color: '#FF6B1A', weight: 2, dashArray: '6', fillOpacity: .08 }).addTo(layer);
  toast('new', '📣', a.simulado ? 'Anuncio registrado (SIMULADO)' : `Anuncio enviado a ${a.enviados} vecinos`);
}

setInterval(() => { $('clock').textContent = new Date().toLocaleTimeString('es-PE'); }, 1000);
refresh();
try {
  const stream = new EventSource('/api/stream');
  ['alerta_nueva', 'alerta_actualizada', 'voto', 'anuncio', 'vecino'].forEach(e => stream.addEventListener(e, refresh));
} catch {}
setInterval(refresh, 15000);

$('filtroAlertas').addEventListener('change', refresh);
$('feed').addEventListener('click', event => {
  const button = event.target.closest('.case-map');
  if (!button || !map) return;
  map.flyTo([Number(button.dataset.lat), Number(button.dataset.lng)], 17, { duration: 0.8 });
  if (window.innerWidth <= 1100) $('map').scrollIntoView({behavior:'smooth', block:'center'});
});
