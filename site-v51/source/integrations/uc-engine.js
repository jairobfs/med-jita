/* MED JITA · Motor curricular auditável · Resolução CONSU 032/2026, arts. 9, 20, 31 e 45. */
(function(root){
  'use strict';
  const EPS=1e-9;
  const num=x=>{const s=String(x??'').trim().replace(',','.');return s!==''&&/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(s)&&Number.isFinite(+s)?+s:null;};
  const component=(id,label,weight,kind='score')=>({id,label,weight,kind});
  const graded=(id,label,weight)=>component(id,label,weight);
  const points=(id,label,weight)=>component(id,label,weight,'points');
  const dual=(label='Avaliação')=>[graded('b1',label+' · 1º bimestre',5),graded('b2',label+' · 2º bimestre',5)];
  const cognition=weight=>[graded('c1','Cognitiva · 1ª avaliação',weight/2),graded('c2','Cognitiva · 2ª avaliação',weight/2)];
  const transversal=()=>[graded('tut','Tutoria · prova somativa',5),graded('cab','CAB · prova somativa',4),points('form','Tutoria · média formativa das SPs',1)];
  const community=(period)=>period<=4?[...cognition(5),graded('pic','Projeto de Intervenção na Comunidade (PIC)',1),points('tp','Teste de Progresso · conceito convertido',3),points('ir','Instrumento de Reflexão (IR)',1)]:period===5?[...cognition(4),graded('semi','Desempenho em Semiologia',1),points('tp','Teste de Progresso · conceito convertido',3),points('gr','Global Rating · média do ambulatório',2)]:[...cognition(5),points('tp','Teste de Progresso · conceito convertido',3),points('gr','Global Rating · média do ambulatório',2)];
  const extension=(period)=>period<=4?community(period):[...cognition(period<=6?4:5),...(period<=6?[graded('pratica',period===5?'Desempenho em Semiologia':'Desempenho em Farmacologia Clínica',1)]:[]),points('tp','Teste de Progresso · conceito convertido',3),points('gr','Global Rating · média do ambulatório',2)];
  function professional(matrix,period){
    if(period===1)return [graded('info','Habilidades de Informação em Saúde',2),graded('interp','Habilidades Interpessoais',2),graded('pratica','Habilidades Médicas · prática',3),graded('teorica','Avaliação Teórica de Habilidades',3)];
    if(period===2)return matrix==='2023'?[graded('info','Habilidades de Informação em Saúde',2),graded('interp','Habilidades Interpessoais',2),graded('pratica','Habilidades Médicas · prática',3),graded('teorica','Avaliação Teórica de Habilidades',3)]:[graded('interp','Habilidades Interpessoais',3),graded('pratica','Habilidades Médicas · prática',3.5),graded('teorica','Avaliação Teórica de Habilidades',3.5)];
    if(period===3)return [graded('pratica','Habilidades Médicas · prática',7),graded('teorica','Avaliação Teórica de Habilidades',3)];
    if(period===4)return [graded('pratica','Habilidades Médicas · prática',5),graded('teorica','Avaliação Teórica de Habilidades',3),graded('pacientes','Pacientes simulados',2)];
    if(period>=7)return [graded('pratica','Habilidades Médicas · prática/OSCE',4),graded('teorica','Avaliação Teórica de Habilidades',4),points('desempenho','Avaliação de desempenho nas atividades',2)];
    return [graded('integral','Avaliação teórico-prática da atividade',10)];
  }
  const tpl=(id,label,article,components,extra={})=>({id,label,article,components,...extra});
  // Referência de turma: 7º período em 2026.2. Janeiro ainda integra o semestre anterior.
  // Os limites fevereiro/agosto são uma convenção de interface; o calendário oficial prevalece.
  function academicTerm(date=new Date()){
    const year=date.getFullYear(),month=date.getMonth();
    return month===0?{year:year-1,half:2}: {year,half:month<7?1:2};
  }
  const termOrdinal=term=>term.year*2+term.half-1;
  function cohortPeriod(date=new Date()){
    return Math.max(1,Math.min(12,7+termOrdinal(academicTerm(date))-termOrdinal({year:2026,half:2})));
  }
  function nextAcademicTerm(date=new Date()){
    const term=academicTerm(date);
    return term.half===1?{year:term.year,half:2}:{year:term.year+1,half:1};
  }
  const termLabel=term=>`${term.year}.${term.half}`;
  function templates(matrix,period){
    const p=Number(period),out=[];
    if(p>=9&&p<=12){
      out.push(tpl('internato','Estágio do internato','Art. 45',[graded('cognitiva','Avaliação Cognitiva / TP específico',3),points('tp','Teste de Progresso · conceito convertido',3),graded('servico','Desempenho em serviço · plano de ensino',4)],{attendance:100,notice:'Avaliação cognitiva pode ser substituída pelo TP específico quando previsto. O TP de desempenho geral (peso 3) é distinto.'}));
      out.push(tpl('eletivo','Estágio eletivo · cumprimento','Art. 45, § 1º',[],{completion:true,attendance:100,notice:'Estágio eletivo não recebe média numérica: o registro é CUMPRIDO após integralização e comprovação da carga horária.'}));
    }else if(p>=1&&p<=8){
      if(matrix==='2023'){
        out.push(tpl('uct','UC Transversal · CAB + Tutoria','Art. 9º, § 1º',transversal()));
        if(p===5||p===6){out.push(tpl('hp-cir','HP · Técnicas Cirúrgicas','Art. 9º, § 2º, I, d',[graded('integral','Avaliação de Técnicas Cirúrgicas',10)]));out.push(tpl('hp-us','HP · Ultrassonografia','Art. 9º, § 2º, I, e',[graded('integral','Avaliação de Ultrassonografia',10)]));}
        else out.push(tpl('hp','Habilidades Profissionais (HP)','Art. 9º, § 2º',professional(matrix,p)));
        out.push(tpl('iesc','Interação em Saúde na Comunidade (IESC)','Art. 9º, § 3º',community(p),{notice:p===6?'O texto do art. 9º também menciona Semiologia no 6º período, embora os pesos fixos já totalizem 10. Confira o plano de ensino se houver essa avaliação.':undefined}));
        out.push(tpl(p<=4?'ugc':'uce',p<=4?'Conhecimentos Gerais (UGC)':'Conhecimentos Específicos (UCE)',p<=4?'Art. 9º, § 4º':'Art. 9º, § 5º',dual(),{notice:'Duas avaliações com pesos iguais quando previstas. Trabalhos e seminários dependem do plano de ensino; use Modelo livre para ponderações diferentes.'}));
      }else if(matrix==='2024'){
        if(p<=4)out.push(tpl('ucf','Ciências Fundamentais (UCF)','Art. 20, § 1º',[graded('ave1','AVE · 1º bimestre',2.5),graded('ave2','AVE · 2º bimestre',2.5),graded('tbl1','AVTBL · 1º bimestre',2.5),graded('tbl2','AVTBL · 2º bimestre',2.5)],{tracks:true,reaTracks:true,reaComponents:[graded('reaave','REA · avaliação específica (AVE)',5),graded('reatbl','REA · avaliação de TBL',5)],notice:'RRA: cada trilha precisa atingir 6,00 (art. 21, § 1º). REA: AVE e TBL valem 5 pontos por trilha (art. 26); a quantidade de trilhas segue o plano de ensino.'}));
        if(p===3||p===4)out.push(tpl('ucm','Ciências Médicas (UCM)','Art. 20, § 2º',p===3?dual():[graded('ave1','AVE · 1º bimestre',2.5),graded('ave2','AVE · 2º bimestre',2.5),graded('tbl1','AVTBL · 1º bimestre',2.5),graded('tbl2','AVTBL · 2º bimestre',2.5)],{tracks:true,reaTracks:p===4,reaComponents:p===4?[graded('reaave','REA · avaliação específica (AVE)',5),graded('reatbl','REA · avaliação de TBL',5)]:undefined,notice:p===3?'Art. 21, § 1º: a aprovação exige o mínimo em todas as trilhas existentes. Configure a quantidade conforme o plano de ensino.':'RRA: cada trilha deve atingir 6,00. No REA de Ciências Médicas 2, AVE e TBL têm peso 5 por trilha (art. 26).'}));
        if(p>=5)out.push(tpl('ucm','Ciências Médicas (UCM) · CAB + Tutoria','Art. 20, § 3º',transversal()));
        if([1,2,3,5].includes(p))out.push(tpl('ude','Desenvolvimento Estruturante (UDE)','Art. 20, § 4º',dual()));
        if([4,8].includes(p))out.push(tpl('era','Estratégias de Remediação (ERA)','Art. 20, § 5º',dual()));
        if(p===5||p===6){out.push(tpl('ap-cir','AP · Técnicas Cirúrgicas','Art. 20, § 6º',[graded('integral','Avaliação teórico-prática de cirurgia',10)]));out.push(tpl('ap-us','AP · Ultrassonografia','Art. 20, § 6º',[graded('integral','Avaliação teórico-prática de ultrassonografia',10)]));}
        else out.push(tpl('ap','Atividades Profissionais (AP)','Art. 20, § 6º',professional(matrix,p)));
        out.push(tpl('aesc','Extensão em Saúde (AESC)','Art. 20, § 7º',extension(p)));
      }else{
        if(p<=4)out.push(tpl('ucf','Ciências Fundamentais (UCF)','Art. 31, § 1º',dual(),{tracks:true,notice:'Art. 32, § 1º: cada trilha existente deve alcançar nota mínima 6,00. Configure quantas trilhas há no plano de ensino; as duas avaliações somam 10 pontos por trilha.'}));
        if(p===3||p===4)out.push(tpl('ucm','Ciências Médicas (UCM)','Art. 31, § 2º',dual(),{tracks:true,notice:'Art. 32, § 1º: a aprovação depende de nota mínima em todas as trilhas. O plano de ensino pode definir trabalhos, número de trilhas e distribuição específica de avaliações.'}));
        if(p>=5)out.push(tpl('ucm','Ciências Médicas (UCM) · CAB + Tutoria','Art. 31, § 3º',transversal()));
        if([1,2,3,5].includes(p))out.push(tpl('ude','Desenvolvimento Estruturante (UDE)','Art. 31, § 4º',dual()));
        if(p===8)out.push(tpl('era','Estratégias de Remediação (ERA)','Art. 31, § 5º',dual()));
        if(p===5||p===6){out.push(tpl('ap-cir','AP · Técnicas Cirúrgicas','Art. 31, § 6º',[graded('integral','Avaliação teórico-prática de cirurgia',10)]));out.push(tpl('ap-us','AP · Ultrassonografia','Art. 31, § 6º',[graded('integral','Avaliação teórico-prática de ultrassonografia',10)]));}
        else out.push(tpl('ap','Atividades Profissionais (AP)','Art. 31, § 6º',professional(matrix,p)));
        out.push(tpl('aesc','Extensão em Saúde (AESC)','Art. 31, § 7º',extension(p)));
      }
    }
    out.push(tpl('custom','Meu módulo · fórmula do plano de ensino','Configuração manual',[graded('item1','Avaliação 1',5),graded('item2','Avaliação 2',5)],{custom:true,notice:'Preencha e valide os critérios do plano de ensino. Este modelo não é uma regra institucional pré-definida.'}));
    return out;
  }
  const findTemplate=(matrix,period,type)=>templates(matrix,period).find(t=>t.id===type)||templates(matrix,period)[0];
  function entryValue(component,entry,key){const data=entry?.grades?.[key]||{},mode=data.mode==='hits'?'hits':'score';const direct=num(data.score);let normalized=null,error='';
    if(component.kind==='points'){
      if(String(data.score??'').trim()!==''){
        if(direct===null||direct<0||direct>component.weight)error=`Informe de 0 a ${component.weight} ponto(s).`;
        else normalized=direct;
      }
    }else if(mode==='hits'){
      const h=num(data.hits),t=num(data.total);
      if(String(data.hits??'').trim()!==''){
        if(!Number.isInteger(h)||!Number.isInteger(t)||t<=0||h<0||h>t)error='Acertos e total devem ser inteiros válidos.';
        else normalized=component.weight*h/t;
      }else if(String(data.total??'').trim()!==''&&(!Number.isInteger(t)||t<=0))error='O total de questões deve ser positivo.';
    }else if(String(data.score??'').trim()!==''){
      if(direct===null||direct<0||direct>10)error='Informe nota de 0 a 10.';
      else normalized=component.weight*direct/10;
    }
    return {value:normalized,error,mode,data};
  }
  function evaluate(template,entry={},regime='rra'){
    const attendance=num(entry.attendance),required=template.attendance||75;
    if(template.completion)return {completion:true,required,attendance,attendanceValid:attendance===null||attendance<=100,complete:false};
    const items=regime==='rea'?(template.reaComponents||[graded('rea','Avaliação única do REA · notas anteriores substituídas',10)]):template.custom?(entry.customParts||template.components):template.components;
    const tracks=template.tracks&&(regime==='rra'||template.reaTracks)?Math.max(1,Math.min(8,Number(entry.tracks)||1)):1;
    if(!items.length)return {valid:false,error:'Nenhum critério cadastrado.'};
    const totalWeight=items.reduce((s,x)=>s+Number(x.weight||0),0);
    const validWeights=items.every(x=>Number.isFinite(Number(x.weight))&&Number(x.weight)>0)&&Math.abs(totalWeight-10)<EPS;
    const parts=[];for(let ti=0;ti<tracks;ti++)for(const item of items){const id=ti+':'+item.id,raw=entryValue(item,entry,id);parts.push({id,label:item.label,track:ti,weight:Number(item.weight),...raw});}
    const errors=parts.filter(x=>x.error).map(x=>x.label+': '+x.error);
    if(!validWeights)errors.unshift('Os pesos de cada trilha devem somar exatamente 10,0.');
    if(attendance!==null&&(attendance<0||attendance>100))errors.unshift('A frequência precisa estar entre 0% e 100%.');
    const known=parts.reduce((s,x)=>s+(x.value??0),0)/tracks;
    const maximum=parts.reduce((s,x)=>s+(x.value??x.weight),0)/tracks;
    const complete=parts.every(x=>x.value!==null);
    const trackScores=Array.from({length:tracks},(_,ti)=>parts.filter(x=>x.track===ti).reduce((s,x)=>s+(x.value??0),0));
    // Arts. 21/32, §1º: every individual track requires 6.00; the 5.75→6.00
    // approximation in §4º explicitly refers to the final UC mark, not each track.
    const trackMinimum=6;
    const failTrack=template.tracks&&regime==='rra'&&complete&&trackScores.some(n=>n+EPS<trackMinimum);
    const passing=errors.length===0&&complete&&known+EPS>=5.75&&!failTrack;
    const attendanceOk=attendance!==null&&attendance+EPS>=required;
    const missing=parts.filter(x=>x.value===null);
    let target=null;
    if(errors.length===0&&missing.length===1){const part=missing[0];const needed=Math.max(0,(5.75-known)*tracks,template.tracks&&regime==='rra'?trackMinimum-trackScores[part.track]:0);const otherTrackFailed=template.tracks&&regime==='rra'&&trackScores.some((score,ti)=>ti!==part.track&&score+EPS<trackMinimum);target={label:part.label,points:needed,weight:part.weight,possible:!otherTrackFailed&&needed<=part.weight+EPS,otherTrackFailed,grade:part.weight>0?needed/part.weight*10:null,track:part.track};}
    return {valid:errors.length===0,error:errors.join(' '),required,attendance,attendanceOk,attendanceValid:attendance===null||attendance<=100,parts,known,maximum,complete,passing,failTrack,trackMinimum,trackScores,target,missing:missing.length,tracks,totalWeight};
  }
  root.MED_UC_ENGINE={num,templates,findTemplate,evaluate,academicTerm,cohortPeriod,nextAcademicTerm,termLabel};
  if(typeof module!=='undefined'&&module.exports)module.exports=root.MED_UC_ENGINE;
})(typeof window==='undefined'?globalThis:window);
