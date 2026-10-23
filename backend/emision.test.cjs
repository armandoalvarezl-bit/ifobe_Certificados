const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
test('timeout keeps the same PDF and emission ID for a confirmed retry',async()=>{
  const nodes=[];const timers=[];const requests=[];
  const element=()=>({textContent:'',hidden:false,addEventListener(){},setAttribute(){},append(){}});
  let first=true;
  const ctx=vm.createContext({AbortController,TypeError,
    setTimeout(fn,ms){timers.push({fn,ms});return timers.length},clearTimeout(){},
    sessionStorage:{getItem:()=> 'session'},HISTORIAL_API_URL:'https://example.com/exec',
    window:{addEventListener(){}},showToast(){},
    document:{createElement(){const n=element();nodes.push(n);return n},querySelector:()=>element(),getElementById:()=>element()},
    fetch:async(url,options)=>{
      requests.push(JSON.parse(options.body));
      if(first){first=false;timers.at(-1).fn();throw Object.assign(new Error('signal is aborted without reason'),{name:'AbortError'})}
      return {ok:true,json:async()=>({ok:true,correoEnviado:true})};
    }
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../emision.js'),'utf8'),ctx);
  await ctx.enviarCopiaPDF({output:()=> 'data:application/pdf;base64,JVBERg=='},{codigo:'IFOBE-123',cedula:'001'});
  assert.equal(timers[0].ms,180000);
  assert.match(nodes[1].textContent,/agotó el tiempo/);
  assert.doesNotMatch(nodes[1].textContent,/aborted/);
  assert.equal(nodes[2].hidden,false);
  await ctx.enviarCopiaPDF({output:()=>{throw Error('pending copy must not be replaced')}},{codigo:'IFOBE-456'});
  await ctx.enviarCopiaPendiente();
  assert.deepEqual(requests[0],requests[1]);
  assert.match(nodes[1].textContent,/enviada al correo/);
  await ctx.enviarCopiaPendiente();assert.equal(requests.length,2);
});
