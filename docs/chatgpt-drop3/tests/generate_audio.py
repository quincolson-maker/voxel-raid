"""Original synthesized game audio; no recordings or external samples.
Run with Python stdlib only. Packaged WAVs are optional replacements for the
runtime Web Audio synthesizer. Do not play both layers at full volume.
"""
import math,random,struct,wave
from pathlib import Path
out=Path(__file__).resolve().parents[1]/'audio';out.mkdir(exist_ok=True)
def make(name,duration,kind):
 rng=random.Random(8192+len(name));rate=44100;data=[];low=0
 for i in range(int(rate*duration)):
  t=i/rate;white=rng.uniform(-1,1);low+=((.09 if kind=='suppressed' else .42)*(white-low))
  if kind in ('shot','suppressed'):
   soft=kind=='suppressed';body=math.sin(2*math.pi*(110 if soft else 165)*t*math.exp(-t*5))*math.exp(-t*30)*(.32 if soft else .45)
   crack=low*math.exp(-t*(55 if soft else 30))*(.32 if soft else .64)
   mech=white*math.exp(-max(0,t-.038)*110)*.11 if t>=.038 else 0
   room=math.sin(t*1100)*math.exp(-max(0,t-.05)*16)*.055 if t>.05 else 0
   value=body+crack+mech+room
  elif kind=='reload':
   value=0
   for start,decay,vol in [(0,55,.25),(.19,90,.25),(.39,75,.18)]:
    if t>=start:value+=white*math.exp(-(t-start)*decay)*vol
  else:value=(math.sin(2*math.pi*3100*t)+.4*math.sin(2*math.pi*4700*t))*math.exp(-t*60)*.22
  data.append(int(max(-1,min(1,value))*30000))
 with wave.open(str(out/name),'wb') as w:w.setnchannels(1);w.setsampwidth(2);w.setframerate(rate);w.writeframes(struct.pack('<'+'h'*len(data),*data))
for args in [('tommy-shot.wav',.38,'shot'),('tommy-suppressed.wav',.30,'suppressed'),('tommy-reload.wav',.65,'reload'),('brass-clink.wav',.18,'clink')]:make(*args)
