/** Human-style controls walkthrough in the installed Pi CLI, using an isolated local provider. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import xterm from '@xterm/headless';
import {piVersion} from '../../scripts/pi-host.mjs';

const repository=fileURLToPath(new URL('../../',import.meta.url));
const output=path.join(repository,'experiments/runs/goal-controls');
fs.mkdirSync(output,{recursive:true});
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const until=async(check,label,timeout=15000)=>{
 const deadline=Date.now()+timeout;
 while(Date.now()<deadline){if(await check())return;await delay(70);}
 throw new Error(`Timed out: ${label}`);
};
const ESC='\x1b',ENTER='\r',DOWN='\x1b[B',TAB='\t',F6='\x1b[17~';
const results=[];
async function boot(label,settings={}){
 const name=`${label}-${process.pid}-${Date.now()}`;
 const cwd=path.join(output,name);
 fs.mkdirSync(path.join(cwd,'.pi'),{recursive:true});
 fs.writeFileSync(path.join(cwd,'.pi/pi-goal-x-settings.json'),JSON.stringify(settings));
 const child=spawn(process.execPath,[path.join(repository,'experiments/continuation/terminal.mjs')],{
  cwd:repository,env:{...process.env,PI_GOAL_COMPARISON_OUTPUT:output,PI_GOAL_TERMINAL_NAME:name,PI_GOAL_TERMINAL_SOURCE:'production',PI_GOAL_TERMINAL_READY_FILE:path.join(cwd,'ready')},stdio:['ignore','pipe','pipe'],
 });
 let log='';child.stdout.on('data',data=>{log+=data;});child.stderr.on('data',data=>{log+=data;});
 let rows=32,cols=110;
 const raw=path.join(cwd,'terminal.bin'),actions=path.join(cwd,'actions.jsonl');
 const screen=async()=>{
  if(!fs.existsSync(raw))return '';
  const terminal=new xterm.Terminal({rows,cols,scrollback:5000,allowProposedApi:true});
  await new Promise(resolve=>terminal.write(fs.readFileSync(raw),resolve));
  const b=terminal.buffer.active;const lines=[];
  for(let i=b.viewportY;i<b.viewportY+rows;i++)lines.push((b.getLine(i)?.translateToString(true)??'').trimEnd());
  terminal.dispose();return lines.join('\n').trimEnd()+'\n';
 };
 const send=async text=>{fs.appendFileSync(actions,JSON.stringify({text})+'\n');await delay(160);};
 const keys=async(...list)=>{for(const text of list)await send(text);};
 const resize=async(r,c)=>{rows=r;cols=c;fs.appendFileSync(actions,JSON.stringify({resize:[r,c]})+'\n');await delay(200);};
 const settingsFile=path.join(cwd,'.pi/pi-goal-x-settings.json');
 const config=()=>JSON.parse(fs.readFileSync(settingsFile,'utf8'));
 const requests=()=>fs.existsSync(path.join(cwd,'requests.json'))?JSON.parse(fs.readFileSync(path.join(cwd,'requests.json'),'utf8')):[];
 const goals=()=>{
  const dir=path.join(cwd,'.pi/goals');if(!fs.existsSync(dir))return [];
  return fs.readdirSync(dir).filter(file=>file.startsWith('active_goal_')).map(file=>{
   const text=fs.readFileSync(path.join(dir,file),'utf8');return JSON.parse(text.slice(0,text.indexOf('\n\n# Goal Prompt')));
  });
 };
 const expect=async text=>until(async()=> (await screen()).includes(text),`screen contains ${text}`);
 const capture=async name=>{const text=await screen();fs.writeFileSync(path.join(cwd,`${name}.txt`),text);return text;};
 const stop=async()=>{
  fs.writeFileSync(path.join(cwd,'last-screen.txt'),await screen());
  if(child.exitCode===null){fs.appendFileSync(actions,JSON.stringify({stop:true})+'\n');await Promise.race([new Promise(resolve=>child.once('exit',resolve)),delay(2500)]);}
  if(child.exitCode===null)child.kill('SIGTERM');
  fs.writeFileSync(path.join(cwd,'walkthrough.log'),log);
 };
 await until(()=>fs.existsSync(actions)&&fs.existsSync(raw),'PTY ready');
 await until(()=>fs.existsSync(path.join(cwd,'ready')),'Pi session_start');
 await delay(500);
 return {cwd,keys,send,resize,screen,expect,capture,config,requests,goals,stop};
}

async function controlsWalkthrough(){
 const h=await boot('controls-ui');
 try{
  await h.send('/goal-settings\r');await h.keys(DOWN,DOWN,ENTER);await h.expect('Goal controls');
  await h.capture('01-controls-wide');
  await h.keys('Revise',ENTER,DOWN,ENTER,'/goal edit',ENTER);
  assert.deepEqual(h.config().commands['goal-tweak'],['goal-tweak','goal edit']);
  await h.capture('02-alias-saved');
  await h.send('\x12');await h.expect('Reloaded keybindings');
  await h.send('/goal edit Change the greeting\r');await h.expect('No goal is set');
  assert.equal(h.requests().length,0,'the alias reached the command handler without a model request');
  await h.send('/goal-settings controls\r');await h.keys(TAB,'Pause /',ENTER,ENTER,F6,ENTER);
  assert.deepEqual(h.config().keybindings.pause,['f6']);
  await h.keys(ENTER,ENTER,'\x1b[65;6u',ENTER);await h.expect('also assigned');
  await h.capture('03-conflict');assert.deepEqual(h.config().keybindings.pause,['f6']);
  await h.keys(ESC,ESC,'\x13');await h.expect('All projects');
  await h.keys(ENTER,ENTER,'\x1b[18~',ENTER);
  assert.deepEqual(h.config().keybindings.pause,['f6']);
  await h.keys('\x13',ENTER,DOWN,DOWN,DOWN,DOWN,DOWN,ENTER);
  assert.equal(h.config().keybindings,undefined,'inherit removes the project leaf');
  await h.capture('04-inherited-key');
  await h.keys(ENTER,ENTER,F6,ENTER);
  await h.keys(TAB,ENTER,DOWN,DOWN,ENTER);assert.equal(h.config().pauseOrder,'turn-first');
  await h.resize(20,72);await h.capture('05-pausing-narrow');
  await h.keys(TAB,'Resume',ENTER,ENTER,'\x15','work continue',ENTER);
  assert.deepEqual(h.config().commands['goal-resume'],['work continue']);
  await h.send('\x12');await h.expect('Reloaded keybindings');
  await h.send('/goal-direct Create greeting.txt containing exactly Hello from goal followed by a newline. Verify it.\r');
  await until(()=>h.requests().length===1,'first running request');await h.send(F6);
  await until(()=>h.goals()[0]?.scheduler?.phase==='interrupted','turn-only hold persisted');
  await h.expect('waiting for you');await h.capture('06-turn-stopped');
  const count=h.requests().length;await delay(6500);
  assert.equal(h.requests().length,count,'stopped turn cannot automatically restart');
  assert.equal(fs.existsSync(path.join(h.cwd,'greeting.txt')),false,'cancelled request cannot execute the write');
  assert.equal(h.goals()[0].status,'active');assert.ok(h.goals()[0].usage.activeSeconds<4,'held time is not charged');
  await h.send(F6);await until(()=>h.goals()[0]?.status==='paused','second press pauses goal');
  await h.capture('07-goal-paused');
  // Escape leaves settings without pausing/resuming the goal or writing cancelled text.
  await h.send('/goal-settings controls\r');await h.keys('Revise',ENTER,ENTER,'\x15','/discard-me');
  const before=JSON.stringify(h.config());await h.keys(ESC,ESC,ESC,ESC);
  assert.equal(JSON.stringify(h.config()),before);assert.equal(h.goals()[0].status,'paused');
  await h.send('/work continue\r');
  await until(()=>fs.existsSync(path.join(h.cwd,'greeting.txt'))&&h.goals().length===0,'custom resume reaches audited completion',20000);
  await h.capture('08-complete');
  assert.equal(fs.readFileSync(path.join(h.cwd,'greeting.txt'),'utf8'),'Hello from goal\n');
  results.push({case:'controls-ui',passed:true,sdk:piVersion,directory:path.relative(repository,h.cwd),requests:h.requests().length,checks:['settings-entry','alias','reload','record-key','conflict','scope','inherit','narrow-preview','turn-first','held-time','cancel-edit','custom-resume','audited-completion']});
 }finally{await h.stop();}
}

async function pauseWalkthrough(order,finish=false){
 const h=await boot(finish?'goal-first-finish':order,{pauseOrder:order});
 try{
  await h.send('/goal-direct Create greeting.txt containing exactly Hello from goal followed by a newline. Verify it.\r');
  await until(()=>h.requests().length===1,'visible work');await h.send(ESC);
  await until(()=>h.goals()[0]?.status==='paused',`${order} first press pauses goal`);
  await h.capture('first-press');
  if(order==='goal-first'){
   assert.ok(!(await h.screen()).includes('Operation aborted'),'first press leaves the current turn running');
   if(finish){await delay(6500);assert.equal(h.requests().length,1,'goal-first finishes one turn without another provider request');await h.capture('turn-finished');}
   else{await h.send(ESC);await h.expect('Operation aborted');await h.capture('second-press');}
  }else await h.expect('Operation aborted');
  if(!finish){await delay(6500);assert.equal(h.requests().length,1);assert.equal(fs.existsSync(path.join(h.cwd,'greeting.txt')),false);}
  assert.equal(h.goals()[0].status,'paused');
  await h.send('/goal-resume\r');await until(()=>fs.existsSync(path.join(h.cwd,'greeting.txt'))&&h.goals().length===0,'resume completes',20000);
  results.push({case:finish?'goal-first-finish':order,passed:true,sdk:piVersion,directory:path.relative(repository,h.cwd),requests:h.requests().length});
 }finally{await h.stop();}
}

async function editorWalkthrough(){
 const h=await boot('editor-controls',{keybindings:{commands:{'goal-settings':'f10'}}});
 try{
  const draft='Keep this unsent draft while changing goal controls.';
  await h.send(draft);await h.send('\x1b[21~');await h.expect('Goal settings');
  await h.keys(DOWN,DOWN,ENTER);await h.expect('Goal controls');
  await h.keys('Resume',ENTER,ENTER,'\x15','work continue',ENTER);
  await h.expect('/reload applies command changes');
  await h.keys(ESC,ESC,ESC);await h.expect(draft);await h.capture('editor-preserved');
  assert.equal(h.requests().length,0);
  assert.deepEqual(h.config().commands['goal-resume'],['work continue']);
  results.push({case:'editor-controls',passed:true,sdk:piVersion,directory:path.relative(repository,h.cwd),requests:0,checks:['command-shortcut','settings-recovery','pending-reload','unsent-editor-text']});
 }finally{await h.stop();}
}

try{
 await controlsWalkthrough();console.log(JSON.stringify(results.at(-1)));
 await editorWalkthrough();console.log(JSON.stringify(results.at(-1)));
 for(const order of ['together','goal-first']){await pauseWalkthrough(order);console.log(JSON.stringify(results.at(-1)));}
 await pauseWalkthrough('goal-first',true);console.log(JSON.stringify(results.at(-1)));
 fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({sdk:piVersion,results},null,2)+'\n');
}catch(error){fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({sdk:piVersion,results,failed:String(error.stack??error)},null,2)+'\n');throw error;}
