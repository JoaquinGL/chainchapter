import { describe, expect, it } from 'vitest';
import { DurationReader, durationFromText } from '../src/extension/DurationReader';
function node(text:string, attrs:Record<string,string>={}, children:unknown[]=[], shadowRoot:unknown=null){
  return {tagName:'DIV',textContent:text,id:'',className:attrs.class??'',children,shadowRoot,
    getAttribute:(name:string)=>attrs[name]??null,getClientRects:()=>[{}]};
}
function root(nodes:unknown[]){return {querySelectorAll:()=>nodes} as unknown as Document;}
describe('Duración visible de Disney+',()=>{
  it('suma transcurrido y restante negativo, también con signo Unicode',()=>{
    expect(durationFromText('0:20 −7:10')).toBe(450);
    expect(durationFromText('0:20 7:10 remaining')).toBe(450);
    expect(durationFromText('0:20 / 7:30')).toBe(450);
    expect(durationFromText('0:20 7:10')).toBeNull();
  });
  it('lee un reloj repartido en hijos cuando media.duration no existe',()=>{
    const parent=node('0:20 7:10',{},[node('0:20'),node('7:10',{'class':'time-remaining'})]);
    expect(new DurationReader().read(null,root([parent]))).toBe(450);
  });
  it('encuentra texto de duración total dentro de shadow DOM',()=>{
    const shadow=root([node('7:30',{'aria-label':'Duración total'})]);
    expect(new DurationReader().read(null,root([node('',{},[],shadow)]))).toBe(450);
  });
  it('no toma un restante aislado ni un porcentaje como duración',()=>{
    expect(new DurationReader().read(null,root([node('7:10',{'aria-label':'Tiempo restante'}),node('',{'role':'slider','aria-valuemax':'100'})]))).toBeNull();
  });
});
