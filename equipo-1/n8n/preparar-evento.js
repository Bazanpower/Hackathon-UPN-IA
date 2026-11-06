const b=$('Normalizar Evolution IA').item.json.body;const x={phone:b.sender.phone_number,nombre:b.sender.name,tipo_mensaje:b.tipo_mensaje,texto:b.content,lat:b.lat,lng:b.lng,ia:$json.ia};
if(b.tipo_mensaje==='audio')x.texto=$('Transcribe a recording').item.json.text;
if(b.tipo_mensaje==='image'){
 const m=$('Recuperar imagen Evolution').item.json.data;x.media={mime:m.mimetype||'image/jpeg',base64:m.base64};
 const raw=$('Clasificar imagen').item.json;let text=raw.output_text??raw.output?.flatMap(y=>y.content??[]).find(y=>y.type==='output_text')?.text??'{}';
 try{const visual=JSON.parse(String(text).trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,''));
  if(visual.es_siniestro===true&&x.ia?.intencion!=='alerta')x.ia={...x.ia,intencion:'alerta',alerta:{tipo:visual.tipo||'otro',gravedad:visual.gravedad||1,descripcion:visual.descripcion||'Posible emergencia en imagen',lugar_texto:null,vulnerables:null,evidencia_coherente:null}};
 }catch(e){}
}return [{json:x}];
