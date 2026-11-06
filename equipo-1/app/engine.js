const fs = require('fs');
const path = require('path');
const zones = require('./data/zonas_oficiales.json');
const config = (key, fallback) => Number(process.env[key]) || fallback;
const distance = (a,b,c,d) => { const r=x=>x*Math.PI/180, x=r(c-a),y=r(d-b); return 12742000*Math.asin(Math.sqrt(Math.sin(x/2)**2+Math.cos(r(a))*Math.cos(r(c))*Math.sin(y/2)**2)); };
const close = (a,b,rad) => a.lat!=null && a.lng!=null && b.lat!=null && b.lng!=null && distance(a.lat,a.lng,b.lat,b.lng)<=rad;
const next = rows => Math.max(0,...rows.map(x=>x.id||0))+1;
const now = () => new Date().toISOString();
const route = {inundacion:'Defensa Civil municipal / COE',huaico:'Defensa Civil municipal / COE',derrumbe:'Defensa Civil municipal / COE',vivienda_danada:'Defensa Civil municipal / COE',incendio:'Bomberos 116',herido:'SAMU 106',sin_agua:'EPS Grau',desague:'EPS Grau',otro:'COE'};
const record = (d,a,event,detail) => d.bitacora.push({id:next(d.bitacora),alerta_id:a?.id||null,evento:event,detalle:detail,at:now()});
function score(d,a){
 const reasons=[{señal:'Base',puntos:30,detalle:'Puntaje inicial'}]; const add=(señal,puntos,detalle)=>reasons.push({señal,puntos,detalle});
 if(a.evidencia?.coherente===true)add('Evidencia coherente',20,'Foto o audio coincide con el reporte');
 if(a.evidencia?.coherente===false)add('Evidencia contradictoria',-15,'La evidencia contradice el reporte');
 if(a.lat!=null&&a.lng!=null)add('Ubicación GPS',10,'Ubicación compartida');
 let reports=d.alertas.filter(b=>Boolean(b.simulado)===Boolean(a.simulado)&&b.id!==a.id&&b.phone!==a.phone&&b.tipo===a.tipo&&Math.abs(new Date(a.created_at)-new Date(b.created_at))<=config('DEMO_WINDOW_MIN',30)*60000&&close(a,b,config('DEMO_RADIUS_M',300))).length;
 if(reports)add('Otros reportes',Math.min(30,reports*15),`${reports} reportes cercanos`);
 if(zones.some(z=>z.fuente&&close(a,z,z.radio_m||config('DEMO_RADIUS_M',300))))add('Zona oficial',10,'Punto crítico con fuente');
 const votes=d.confirmaciones.filter(v=>v.alerta_id===a.id), yes=votes.filter(v=>v.respuesta==='si').length,no=votes.filter(v=>v.respuesta==='no').length;
 if(yes)add('Confirmaciones SÍ',Math.min(30,yes*10),`${yes} votos`); if(no)add('Confirmaciones NO',-15*no,`${no} votos`);
 let rep=Math.max(-10,Math.min(10,d.vecinos.find(v=>v.phone===a.phone)?.reputacion||0)); if(rep)add('Reputación',rep,'Historial de reportes');
 a.credibilidad=Math.max(0,Math.min(100,reasons.reduce((sum,x)=>sum+x.puntos,0))); a.razones=reasons; record(d,a,'puntaje',{credibilidad:a.credibilidad,razones:reasons}); return {yes,no};
}
function decide(d,a,override){ const old=a.estado,{no}=score(d,a); let state=override||(a.gravedad>=5?'despachada':(no>=2&&a.credibilidad<25)?'descartada':a.credibilidad<40?'pide_evidencia':a.credibilidad<70?'verificando':'despachada'); if(old==='despachada'&&!override)state=old; a.estado=state; a.updated_at=now(); if(state==='despachada')a.entidad=(route[a.tipo]||route.otro)+' (SIMULADO)'; if(old!==state){record(d,a,'estado',{anterior:old,nuevo:state,entidad:a.entidad}); const v=d.vecinos.find(x=>x.phone===a.phone);if(v&&(state==='despachada'||state==='descartada'))v.reputacion=(v.reputacion||0)+(state==='despachada'?5:-10); } return state; }
function reply(a){
 const emergency=['derrumbe','vivienda_danada','inundacion','huaico','incendio','herido'].includes(a.tipo);
 const safety=emergency?' Si hay peligro inmediato, aléjate de la zona y llama al 116 (Bomberos), 105 (Policía) o 106 (SAMU).':'';
 if(a.estado==='despachada'){const gps=a.lat==null||a.lng==null?' Comparte tu ubicación por WhatsApp para completar el reporte.':'';return `🚨 SIMULACIÓN: alerta registrada para ${a.entidad}. No se ha contactado a una central real.`+gps+safety;}
 if(a.lat==null||a.lng==null)return 'Recibimos tu reporte. 📍 Comparte tu ubicación (clip → Ubicación) para ubicar la emergencia.'+safety;
 if(a.estado==='descartada')return 'Gracias, tu reporte no pudo verificarse. Si sigue pasando, mándanos foto y ubicación.'+safety;
 if(a.estado==='pide_evidencia'){if(a.media?.length)return `Recibimos tu foto y tu ubicación. Necesitamos más datos para verificar el reporte antes de simular el aviso a ${route[a.tipo]||route.otro} (SIMULADO). No se ha avisado a una central real.`+safety;return 'Recibimos tu ubicación. Para revisar el reporte, comparte una foto o un audio.'+safety;}
 return `Recibimos tu reporte y tu ubicación. Lo revisaremos y, si se verifica, se dirigiría a ${route[a.tipo]||route.otro} (SIMULADO). No se ha avisado a una central real.`+safety;
}
function event(d,b){
 const t=now();let v=d.vecinos.find(x=>x.phone===b.phone); if(!v){v={phone:b.phone,nombre:b.nombre||'',dni:null,lat:null,lng:null,ubic_at:null,reputacion:0,created_at:t};d.vecinos.push(v);} if(b.nombre)v.nombre=b.nombre; if(Number.isFinite(b.lat)&&Number.isFinite(b.lng)){v.lat=b.lat;v.lng=b.lng;v.ubic_at=t;}
 let a=d.alertas.filter(x=>x.phone===b.phone&&!['despachada','descartada'].includes(x.estado)&&Date.now()-new Date(x.created_at)<600000).sort((x,y)=>y.id-x.id)[0];
 const intent=b.ia?.intencion;
 if(!a && b.tipo_mensaje==='location')a=d.alertas.filter(x=>x.phone===b.phone&&x.estado==='despachada'&&Date.now()-new Date(x.created_at)<600000).sort((x,y)=>y.id-x.id)[0];
 if(intent==='confirmacion'){const p=d.pedidos_confirmacion.filter(p=>p.phone===b.phone&&Date.now()-new Date(p.enviado_at)<3600000).sort((x,y)=>new Date(y.enviado_at)-new Date(x.enviado_at))[0];if(!p)return {reply:'No hay una solicitud de confirmación reciente.'}; a=d.alertas.find(x=>x.id===p.alerta_id);const answer=b.ia.confirmacion;if(!a||!['si','no'].includes(answer))return {reply:'Responde SÍ o NO.'};if(!d.confirmaciones.some(x=>x.alerta_id===a.id&&x.phone===b.phone))d.confirmaciones.push({id:next(d.confirmaciones),alerta_id:a.id,phone:b.phone,respuesta:answer,created_at:t});decide(d,a);return {reply:'Gracias por confirmar.',alerta:a,voto:true};}
 if(intent==='alerta'){const data=b.ia.alerta||{};const related=(x,y)=>x===y||x==='otro'||y==='otro'||(['derrumbe','vivienda_danada'].includes(x)&&['derrumbe','vivienda_danada'].includes(y));if(a&&data.tipo&&route[data.tipo]&&!related(a.tipo,data.tipo))a=null; if(!a){a={id:next(d.alertas),phone:b.phone,tipo:route[data.tipo]?data.tipo:'otro',gravedad:data.gravedad||1,descripcion:data.descripcion||b.texto||'',lugar_texto:data.lugar_texto||null,lat:v.lat??null,lng:v.lng??null,vulnerables:data.vulnerables||null,evidencia:{},media:[],credibilidad:0,razones:[],estado:'nueva',entidad:null,simulado:false,created_at:t,updated_at:t}; d.alertas.push(a);record(d,a,'creada',{});} else {if(data.tipo && data.tipo!=='otro' && route[data.tipo])a.tipo=data.tipo;for(const k of ['descripcion','lugar_texto','vulnerables','gravedad'])if(data[k])a[k]=data[k];} if(typeof data.evidencia_coherente==='boolean')a.evidencia={...a.evidencia,coherente:data.evidencia_coherente}; }
 if(a && Number.isFinite(b.lat)&&Number.isFinite(b.lng)){a.lat=b.lat;a.lng=b.lng;}
 if(b.media?.base64){const bytes=Buffer.from(b.media.base64,'base64');if(bytes.length>10*1024*1024)throw Error('Archivo excede 10 MB');const id=next(d.media), dir=path.join(__dirname,'data','media');fs.mkdirSync(dir,{recursive:true});const file=path.join(dir,String(id));fs.writeFileSync(file,bytes);d.media.push({id,alerta_id:a?.id||null,phone:b.phone,mime:b.media.mime||'application/octet-stream',path:file,created_at:t});if(a)a.media=[...(a.media||[]),id];}
 if(a&&(intent==='alerta'||b.tipo_mensaje==='location')){decide(d,a);return {reply:reply(a),alerta:a};}
 if(intent==='registro'||b.tipo_mensaje==='location'){if(a)return {reply:`Hola. Tengo tu reporte anterior de ${a.tipo.replace(/_/g,' ')}. ¿Hay algún cambio o necesitas reportar otra emergencia?`};return {reply:'Hola, soy AYUDA IA. Cuéntame qué ocurre o comparte tu ubicación si necesitas reportar una emergencia.'};}
 return {reply:b.ia?.respuesta_sugerida||'Cuéntame qué sucede y comparte tu ubicación si necesitas reportar una emergencia.'};
}
module.exports={event,decide,record,close,next,now,reply,route};
