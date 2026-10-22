"""Explicit historical QA rows for a workflow-owned emulator only; never imported by the app."""
import json,sqlite3
GOLDEN='qa-quality-golden'

def snapshot(c):
 c.row_factory=sqlite3.Row
 return {table:[dict(r)for r in c.execute('SELECT * FROM '+table+' ORDER BY '+('key'if table=='app_state'else'id'))]for table in ['measurements','experiments','app_state']}

def seed(c):
 before=snapshot(c)
 if len(before['experiments'])!=1 or len(before['measurements'])!=1 or any(r['key']=='pro_entitlement'and r['value']=='true'for r in before['app_state']):raise ValueError('Expected one actual ordinary free UI experiment and measurement')
 if any(r['id'].startswith('qa-quality-')for t in ['measurements','experiments']for r in before[t]):raise ValueError('Fixture must be fresh')
 with c:
  c.execute('INSERT INTO experiments VALUES (?,?,?,?,?,?,?,?)',(GOLDEN,'heatingCurve','0.6','0.5','',4,'2026-10-05T00:00:00.000Z','completed'))
  for day,electricity in enumerate([20,20,20,20,10,10,10,90],1):
   c.execute('INSERT INTO measurements VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',(f'qa-quality-day-{day}',f'2026-10-{day:02}T12:00:00.000Z','before'if day<=4 else'after',electricity,40,0,21,8,35,29,6.2,3))
 validate_seed(before,snapshot(c))

def validate_seed(before,after):
 assert len(before['experiments'])==len(before['measurements'])==1
 for table in ['experiments','measurements']:
  rows={r['id']:r for r in after[table]}
  assert all(rows.get(r['id'])==r for r in before[table]),'Ordinary original row changed'
 assert before['app_state']==after['app_state'],'Entitlement or old state changed'
 assert len(after['experiments'])==2 and len(after['measurements'])==9
 rows=[r for r in after['measurements']if r['id'].startswith('qa-quality-day-')]
 assert [r['electricity_kwh']for r in rows]==[20,20,20,20,10,10,10,90]
 assert all(r['outside_c']==0 and r['room_c']==21 for r in rows)
 assert not any(r['key']=='pro_entitlement'and r['value']=='true'for r in after['app_state'])

def validate_final(before,seeded,final):
 validate_seed(before,seeded)
 assert seeded['measurements']==final['measurements'] and seeded['experiments']==final['experiments'],'Native review modified raw readings or experiments'
 key='quality_review_v1:'+GOLDEN
 old={r['key']:r['value']for r in seeded['app_state']};now={r['key']:r['value']for r in final['app_state']}
 assert {k:v for k,v in now.items()if k!=key}==old,'Native review modified entitlement or unrelated state'
 r=json.loads(now[key]);assert r=={'schemaVersion':1,'experimentId':GOLDEN,'beforeStart':'2026-10-01','beforeEnd':'2026-10-04','afterStart':'2026-10-05','afterEnd':'2026-10-08','exclusions':[{'phase':'after','date':'2026-10-08','reason':'QA meter check'}]}
