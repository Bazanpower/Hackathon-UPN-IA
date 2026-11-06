const { spawn } = require('child_process');
const http = require('http');
const assert = require('assert/strict');
const sent=[];
const mock=http.createServer((req,res)=>{let body='';req.on('data',x=>body+=x);req.on('end',()=>{sent.push(JSON.parse(body));res.writeHead(200,{'Content-Type':'application/json'});res.end('{}')})});
const port=33719, mockPort=33720, secret='integration-only';
const post=async (path,body,auth=true)=>{const r=await fetch(`http://127.0.0.1:${port}${path}`,{method:'POST',headers:{'Content-Type':'application/json',...(auth?{'x-ayuda-secret':secret}:{})},body:JSON.stringify(body)});assert.equal(r.status,200);return r.json()};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function run(){await new Promise(r=>mock.listen(mockPort,'127.0.0.1',r));const child=spawn(process.execPath,['server.js'],{cwd:require('path').join(__dirname,'..'),env:{...process.env,PORT:String(port),DATABASE_URL:'',N8N_SHARED_SECRET:secret,EVOLUTION_URL:`http://127.0.0.1:${mockPort}`,EVOLUTION_APIKEY:'fake',SIN_AGUA_MINUTOS_DENGUE_DEMO:'0.01'},stdio:'ignore'});
try{let started=false;for(let i=0;i<40;i++){try{await fetch(`http://127.0.0.1:${port}/api/estado`);started=true;break}catch{await sleep(100)}}assert.ok(started,'servidor iniciado');
for(let i=0;i<9;i++)await post('/api/n8n/evento',{phone:`neighbor${i}`,lat:-5.19,lng:-80.63,tipo_mensaje:'location',ia:{intencion:'registro'}});
await post('/api/n8n/evento',{phone:'author',lat:-5.19,lng:-80.63,tipo_mensaje:'audio',texto:'Se inunda la entrada',ia:{intencion:'alerta',alerta:{tipo:'inundacion',descripcion:'Se inunda la entrada',evidencia_coherente:true}}});
let state=await (await fetch(`http://127.0.0.1:${port}/api/estado`)).json();assert.equal(state.alertas[0].credibilidad,60);assert.equal(state.alertas[0].estado,'verificando');assert.equal(sent.length,9);
for(let i=0;i<3;i++)await post('/api/n8n/evento',{phone:`neighbor${i}`,ia:{intencion:'confirmacion',confirmacion:'si'}});
state=await (await fetch(`http://127.0.0.1:${port}/api/estado`)).json();assert.equal(state.confirmaciones.length,3);assert.equal(state.alertas[0].estado,'despachada');assert.match(state.alertas[0].entidad,/SIMULADO/);assert.ok(state.anuncios.length);
await post('/api/n8n/evento',{phone:'water',lat:-5.2,lng:-80.64,ia:{intencion:'alerta',alerta:{tipo:'sin_agua',descripcion:'Sin agua'}}});await post('/api/alertas/2/decision',{accion:'despachar'},false);await sleep(11000);state=await (await fetch(`http://127.0.0.1:${port}/api/estado`)).json();assert.equal(state.riesgos.length,1);assert.ok(state.anuncios.some(x=>x.texto==='Tapa y lava tus recipientes de agua'));
console.log('Integración: 9 pedidos, 3 votos, despacho, anuncio y dengue correctos.');
}finally{child.kill();mock.close()}}
run().catch(e=>{console.error(e);process.exitCode=1;mock.close()});
