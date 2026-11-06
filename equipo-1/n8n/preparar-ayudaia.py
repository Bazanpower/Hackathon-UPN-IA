"""Prepara una copia local del workflow; no publica ni imprime credenciales."""
import copy, json, re, uuid
from pathlib import Path

root = Path(__file__).resolve().parent.parent
source = json.loads((root/'n8n/backup-demoteva-ANTES.json').read_text(encoding='utf8'))
spec = (root/'SPEC.md').read_text(encoding='utf8')
env = dict(line.split('=', 1) for line in (root/'app/.env').read_text(encoding='utf8').splitlines() if '=' in line and not line.startswith('#'))
prompt_agent = re.search(r'### 4\.1.*?```\s*\n(.*?)\n```', spec, re.S).group(1)
prompt_image = re.search(r'### 4\.2.*?```\s*\n(.*?)\n```', spec, re.S).group(1)
original = {n['name']: n for n in source['nodes']}
def clone(name, rename=None):
    n = copy.deepcopy(original[name]); n['name'] = rename or name
    return n
def code(name, js):
    return {'parameters': {'jsCode': js}, 'id': str(uuid.uuid4()), 'name': name,
            'type': 'n8n-nodes-base.code', 'typeVersion': 2, 'position': [0, 0]}
def connect(a, b, output=0, kind='main'):
    targets = connections.setdefault(a, {}).setdefault(kind, [])
    while len(targets) <= output: targets.append([])
    targets[output].append({'node': b, 'type': kind, 'index': 0})

normal = clone('Normalizar Evolution IA (TEVACEL)', 'Normalizar Evolution IA')
normal['parameters']['jsCode'] = r'''const out=[];
for (const item of $input.all()) {
 const root=item.json??{}, payload=root.body&&typeof root.body==='object'?root.body:root;
 if(!['messages.upsert','messages_upsert'].includes(String(payload.event??'').toLowerCase()))continue;
 const data=payload.data??{}, key=data.key??{}, jid=String(key.remoteJid??'');
 if(!jid||key.fromMe===true||String(key.fromMe)==='true'||jid==='status@broadcast')continue;
 const m=data.message??{}, loc=m.locationMessage??m.liveLocationMessage;
 const type=loc?'location':m.audioMessage||m.pttMessage?'audio':m.imageMessage?'image':m.videoMessage?'video':'text';
 const text=String(m.conversation??m.extendedTextMessage?.text??m.imageMessage?.caption??m.videoMessage?.caption??'');
 if(type==='text'&&!text.trim())continue;
 out.push({json:{body:{id:String(key.id??''),audio_message_id:String(key.id??''),content:text,
 tipo_mensaje:type,lat:loc?.degreesLatitude??null,lng:loc?.degreesLongitude??null,
 evolution_message:data,message_id:String(key.id??''),
 sender:{identifier:jid,phone_number:String(jid.endsWith('@g.us')?(key.participantAlt||key.participant||''):jid).replace(/@.*$/,''),name:String(data.pushName??'Vecino')}}}});
} return out;'''
switch = clone('Switch'); rules=[]
for name in ['audio','image','video','location','text']:
    rules.append({'conditions':{'options':{'caseSensitive':True,'leftValue':'','typeValidation':'strict','version':2},'combinator':'and','conditions':[{'id':str(uuid.uuid4()),'operator':{'type':'string','operation':'equals'},'leftValue':'={{ $json.body.tipo_mensaje }}','rightValue':name}]},'renameOutput':True,'outputKey':name})
switch['parameters']={'rules':{'values':rules},'options':{}}
audio=clone('RECUPERAR AUDIO EVOLUTION TEVACEL','Recuperar audio Evolution')
audio['parameters']['messageId']="={{ $('Normalizar Evolution IA').item.json.body.message_id }}"
image=copy.deepcopy(audio); image['id']=str(uuid.uuid4());image['name']='Recuperar imagen Evolution'
classifier=clone('HTTP Request','Clasificar imagen')
classifier['parameters']['url']='https://api.openai.com/v1/responses'
classifier['parameters']['jsonBody']="={{ JSON.stringify({model:'gpt-4.1',input:[{role:'user',content:[{type:'input_text',text:"+json.dumps(prompt_image,ensure_ascii=False)+"},{type:'input_image',image_url:'data:'+($('Recuperar imagen Evolution').item.json.data.mimetype || 'image/jpeg')+';base64,'+$('Recuperar imagen Evolution').item.json.data.base64}]}]}) }}"
picture=code('Preparar descripción de imagen',r'''const j=$json; const text=j.output_text ?? j.output?.flatMap(x=>x.content??[]).find(x=>x.type==='output_text')?.text ?? '{}'; return [{json:{content:'Imagen: '+text+' Texto del vecino: '+$('Normalizar Evolution IA').item.json.body.content}}];''')
plain=code('Preparar texto y video',r'''const b=$json.body;return [{json:{content:b.tipo_mensaje==='video'?'Video (sin análisis): '+b.content:b.content}}];''')
fields=clone('Edit Fields1');fields['parameters']['assignments']['assignments']=[{'id':str(uuid.uuid4()),'name':'chat_input','type':'string','value':'={{ $json.content }}'},{'id':str(uuid.uuid4()),'name':'id','type':'string','value':"={{ $('Normalizar Evolution IA').item.json.body.sender.identifier }}"}]
fields2=clone('Edit Fields2')
fields2['parameters']['assignments']['assignments'][2]['value']="={{ $('Normalizar Evolution IA').item.json.body.id }}"
agent=clone('AI AGENT1','Agente AYUDA IA');agent['parameters']['hasOutputParser']=False
agent['parameters']['text']="={{ 'Historial: '+JSON.stringify($json.history)+'\\nMensaje: '+$('Edit Fields2').item.json.texto }}"
agent['parameters']['options']['systemMessage']=prompt_agent
parse=code('PARSE_AGENT_JSON',r'''let text=String($json.output??'').trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,''); let ia=JSON.parse(text);return [{json:{ia}}];''')
body_expr="={{ JSON.stringify($json) }}"
prepare=code('Preparar evento para la app', (root/'n8n/preparar-evento.js').read_text(encoding='utf8'))
location=code('Preparar ubicación',"return [{json:{ia:{intencion:'registro'}}}];")
http=clone('GENERAR PDF TEVACEL','Enviar evento a AYUDA IA')
http['parameters']={'method':'POST','url':'https://ayudaia.crm-ia.org/api/n8n/evento','sendHeaders':True,'headerParameters':{'parameters':[{'name':'x-ayuda-secret','value':env['N8N_SHARED_SECRET']},{'name':'Content-Type','value':'application/json'}]},'sendBody':True,'specifyBody':'json','jsonBody':body_expr,'options':{}}
sender=clone('Enviar texto','Responder por Evolution');sender['parameters']['remoteJid']="={{ $('Normalizar Evolution IA').item.json.body.sender.identifier }}";sender['parameters']['messageText']='={{ $json.reply }}'
log=clone('Execute a SQL query4','Guardar respuesta en memoria')
log['parameters']['options']['queryReplacement']="=$1 = {{ $('Edit Fields2').item.json.id }}\n$2 = {{ $('UPSERT_STATE_AND_GET_HISTORY').item.json.session_id }}\n$3 = {{ $('Edit Fields2').item.json.message_uid }}\n$4 = {{ JSON.stringify($('PARSE_AGENT_JSON').item.json.ia) }}"
keep=['Webhook1','PREPARAR AUDIO PARA TRANSCRIPCION','Transcribe a recording','Audio Content','Redis1','Wait2','Redis2','If2','UPSERT_STATE_AND_GET_HISTORY','OpenAI Chat Model4','Think1']
nodes=[clone(x) for x in keep]+[normal,switch,audio,image,classifier,picture,plain,fields,fields2,agent,parse,location,prepare,http,sender,log]
for n in nodes:
 if n['name']=='Redis1': n['parameters']['list']="={{ $json.id + ($('Normalizar Evolution IA').item.json.body.tipo_mensaje === 'image' ? ':imagen:' + $('Normalizar Evolution IA').item.json.body.message_id : '') }}"
 if n['name']=='Redis2': n['parameters']['key']="={{ $json.id + ($('Normalizar Evolution IA').item.json.body.tipo_mensaje === 'image' ? ':imagen:' + $('Normalizar Evolution IA').item.json.body.message_id : '') }}"
connections={}
for a,b in [('Webhook1',normal['name']),(normal['name'],'Switch'),('Recuperar audio Evolution','PREPARAR AUDIO PARA TRANSCRIPCION'),('PREPARAR AUDIO PARA TRANSCRIPCION','Transcribe a recording'),('Transcribe a recording','Audio Content'),('Audio Content','Edit Fields1'),('Recuperar imagen Evolution','Clasificar imagen'),('Clasificar imagen','Preparar descripción de imagen'),('Preparar descripción de imagen','Edit Fields1'),('Preparar texto y video','Edit Fields1'),('Edit Fields1','Redis1'),('Redis1','Wait2'),('Wait2','Redis2'),('Redis2','If2'),('If2','Edit Fields2'),('Edit Fields2','UPSERT_STATE_AND_GET_HISTORY'),('UPSERT_STATE_AND_GET_HISTORY','Agente AYUDA IA'),('Agente AYUDA IA','PARSE_AGENT_JSON'),('PARSE_AGENT_JSON','Preparar evento para la app'),('Preparar ubicación','Preparar evento para la app'),('Preparar evento para la app','Enviar evento a AYUDA IA'),('Enviar evento a AYUDA IA','Responder por Evolution')]:connect(a,b)
for i,name in enumerate(['Recuperar audio Evolution','Recuperar imagen Evolution','Preparar texto y video','Preparar ubicación','Preparar texto y video']):connect('Switch',name,i)
connect('PARSE_AGENT_JSON','Guardar respuesta en memoria')
connect('OpenAI Chat Model4','Agente AYUDA IA',kind='ai_languageModel');connect('Think1','Agente AYUDA IA',kind='ai_tool')
for i,n in enumerate(nodes):n['position']=[(i%7)*260,(i//7)*180]
final={k:source[k] for k in ['name','settings'] if k in source};final['name']='AYUDA IA';final['nodes']=nodes;final['connections']=connections
allowed={'executionOrder','saveManualExecutions','callerPolicy','errorWorkflow','timezone','saveDataErrorExecution','saveDataSuccessExecution','saveExecutionProgress','executionTimeout'}
final['settings']={k:v for k,v in final.get('settings',{}).items() if k in allowed}
(root/'n8n/ayudaia-final.json').write_text(json.dumps(final,ensure_ascii=False,indent=2),encoding='utf8')
print('Copia local preparada; nodos:',len(nodes))
