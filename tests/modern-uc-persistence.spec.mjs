import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync('site-v51/source/index.html','utf8');
function section(start,end){
 const a=source.indexOf(start),b=source.indexOf(end,a+start.length);
 assert.ok(a>=0&&b>a,'Cannot find modern state bridge '+start);
 return source.slice(a,b);
}
const keys=section('const stateStore=','const avatarStore=');
const persist=section('const persist=','const persistHistory=');
const cache=section('function cachedProfile(id){','function bindProfile(id,remote)');
const values=new Map();
const storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,String(v))};
const bootstrap=(id,data)=> {
 const ctx={localStorage:storage,boundProfile:id,state:data,
  notifyLocalChange:()=>{},historySnapshots:[],readLocalAvatar:()=>({kind:'default'}),
  Event:class Event{}};
 vm.createContext(ctx);
 vm.runInContext(keys+persist+cache+'; globalThis.api={persist,cachedProfile,stateStore};',ctx);
 return ctx.api;
};
const uct={matrix:'2023',period:'7',type:'uct',entries:{
 '2023:7:uct':{attendance:'85',grades:{
  '0:tut':{mode:'score',score:'8'},'0:cab':{mode:'score',score:'7'},
  '0:form':{mode:'score',score:'0,8'}}}}};
const a=bootstrap('jbfs',{version:3,uc:uct});
a.persist();
assert.ok(values.has('med_jita_profile_state_jbfs'));
assert.ok(!values.has('med_jita_state_v3'),'Authenticated storage cannot leak to shared state');
const b=bootstrap('barba',{version:3,uc:{matrix:'2023',period:'7',type:'hp',entries:{}}});
b.persist();
assert.equal(a.cachedProfile('jbfs').data.uc.entries['2023:7:uct'].grades['0:tut'].score,'8');
assert.equal(b.cachedProfile('barba').data.uc.type,'hp');
assert.notEqual(a.cachedProfile('jbfs').data.uc.type,b.cachedProfile('barba').data.uc.type);
// Reload: new VM context, same browser persistent storage.
const again=bootstrap('jbfs',{version:3,uc:{entries:{}}});
const recovered=again.cachedProfile('jbfs');
assert.equal(recovered.data.uc.entries['2023:7:uct'].grades['0:form'].score,'0,8');
assert.equal(recovered.data.uc.entries['2023:7:uct'].attendance,'85');
console.log('PASS: modern V51 UCs persist through reload by profile, without writing shared user data.');
