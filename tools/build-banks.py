from pathlib import Path
import json,random,hashlib,html
ROOT=Path(__file__).resolve().parents[1]; rnd=random.Random(4102026)
CATS={
'chile':('Chile de norte a sur','🇨🇱'), 'onepiece':('One Piece','🏴‍☠️'), 'rapidos':('Rápido y Furioso','🏁'), 'simpsons':('Los Simpsons','🍩'), 'harrypotter':('Harry Potter','🪄'), 'gastronomia':('Gastronomía','🍳'), 'letras':('Completa la letra y la canción','🎤'), 'stranger':('Stranger Things · temporadas 1–4','🔦'), 'cuerpo':('Cuerpo humano','🫀'), 'tronos':('Juego de Tronos / Casa del Dragón','🐉'), 'memes':('Memes de internet y Chile','😂'), 'comerciales':('Comerciales y marcas en Chile','📺'), 'telenovelas':('Telenovelas en Chile','💘'), 'prehistoria':('Dinosaurios y prehistoria','🦕')}
# Each block has three independent attributes per entity; every attribute becomes one question.
# Distractors always come from the SAME semantic column, never from unrelated filler.
allbanks={}
for file in sorted((ROOT/'tools/banks').glob('*.json')):
 spec=json.loads(file.read_text());key=spec['id'];questions=[]
 for group in spec.get('groups',[]):
  rows=group['rows'];stems=group['stems'];pools=[sorted(set(r[j+1] for r in rows)) for j in range(len(stems))]
  for row in rows:
   if len(row)!=len(stems)+1:raise ValueError((key,'column mismatch',row))
   for j,stem in enumerate(stems):
    correct=row[j+1];excluded=group.get('excludeOptionsByRow',{}).get(row[0],{}).get(str(j),[])
    others=[x for x in pools[j] if x!=correct and x not in excluded]
    if len(others)<3:raise ValueError((key,'too few distractors',j,row))
    options=rnd.sample(others,3)+[correct];rnd.shuffle(options)
    question=stem.replace('{x}',row[0]);explain=group.get('explain',stems)[j].replace('{x}',row[0]).replace('{a}',correct) if group.get('explain') else f'{row[0]}: {correct}. '+group.get('context','')
    questions.append({'q':question,'o':options,'c':options.index(correct),'explanation':explain.strip(),'e':CATS[key][1]})
 for item in spec.get('questions',[]):
  q,correct,*others=item
  if len(others)!=3:raise ValueError((key,item))
  options=others+[correct];rnd.shuffle(options);questions.append({'q':q,'o':options,'c':options.index(correct),'explanation':correct+'. '+spec.get('context',''),'e':CATS[key][1]})
 if len(questions)<150:raise ValueError((key,'under 150',len(questions)))
 if len({q['q'] for q in questions})!=len(questions):raise ValueError((key,'duplicate questions'))
 for i,q in enumerate(questions):
  q['id']=key+'-'+hashlib.sha256(q['q'].encode()).hexdigest()[:12]
  if i%5==0:q['img']='arcade/reference/'+key+'.svg';q['imgAlt']='Ilustración de ambiente; no representa la respuesta.'
 allbanks[key]=questions
 (ROOT/'data'/f'{key}.json').write_text(json.dumps({'cat':key,'name':CATS[key][0],'emoji':CATS[key][1],'edition':'4.0','sources':spec.get('sources',[]),'questions':questions},ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:len(v) for k,v in allbanks.items()},ensure_ascii=False))
