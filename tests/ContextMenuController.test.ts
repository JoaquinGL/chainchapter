import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ContextMenuController, CONTEXT_FEEDBACK_KEY } from '../src/extension/ContextMenuController';
const current='https://www.disneyplus.com/es-es/play/bluey';
const other='https://www.disneyplus.com/es-es/play/kitties';
let capture: ReturnType<typeof vi.fn>, store:ReturnType<typeof vi.fn>;
beforeEach(()=>{
  capture=vi.fn();store=vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal('chrome',{tabs:{sendMessage:capture},storage:{local:{set:store}}});
});
afterEach(()=>vi.unstubAllGlobals());
describe('Añadir desde el botón derecho',()=>{
  it('captura el episodio abierto con título y duración',async()=>{
    const add=vi.fn().mockResolvedValue(undefined);
    capture.mockResolvedValue({title:'Bluey',url:current,durationSeconds:450});
    await new ContextMenuController(add).handle({pageUrl:current},{id:7,url:current,title:'Disney+'});
    expect(add).toHaveBeenCalledWith({title:'Bluey',url:current,durationSeconds:450});
    expect(capture).toHaveBeenCalledWith(7,{type:'CAPTURE_CONTEXT',url:current},{frameId:0});
    expect(store.mock.calls[0][0][CONTEXT_FEEDBACK_KEY].error).toBe(false);
  });
  it('prioriza el enlace pulsado y no copia la duración del episodio de fondo',async()=>{
    const add=vi.fn().mockResolvedValue(undefined);
    capture.mockResolvedValue({title:'Bluey',url:current,durationSeconds:450});
    await new ContextMenuController(add).handle({linkUrl:other,pageUrl:current},{id:7,url:current,title:'Bluey'});
    expect(add).toHaveBeenCalledWith({url:other,title:'Capítulo pendiente de nombre',durationSeconds:null});
    expect(store.mock.calls[0][0][CONTEXT_FEEDBACK_KEY].error).toBe(false);
  });
  it('permite añadir un enlace directo aunque la página no responda',async()=>{
    const add=vi.fn().mockResolvedValue(undefined);capture.mockRejectedValue(new Error('Sin content script'));
    await new ContextMenuController(add).handle({pageUrl:current},{id:7,url:current,title:'Bluey'});
    expect(add).toHaveBeenCalledWith({title:'Bluey',url:current,durationSeconds:null});
  });
  it('rechaza fichas de series y comunica las restricciones de edición',async()=>{
    const add=vi.fn().mockRejectedValue(new Error('Detén la cola antes de editarla.'));
    const controller=new ContextMenuController(add);
    await controller.handle({linkUrl:'https://www.disneyplus.com/browse/entity-bluey',pageUrl:current},{id:7,url:current});
    expect(add).not.toHaveBeenCalled();
    expect(store.mock.calls[0][0][CONTEXT_FEEDBACK_KEY].error).toBe(true);
    capture.mockResolvedValue({title:'Bluey',url:current,durationSeconds:450});
    await controller.handle({pageUrl:current},{id:7,url:current});
    expect(store.mock.calls[1][0][CONTEXT_FEEDBACK_KEY].text).toContain('Detén');
  });
});
