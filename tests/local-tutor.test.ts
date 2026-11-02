import { describe,it,expect,vi } from 'vitest';
import { LlamaTutor } from '../delivery/local-tutor';
import type { TutorInput } from '../delivery/tutor-provider';
const input:TutorInput={question:'Why does light change direction?',objective:'Explain refraction',concept:'Refraction',classLevel:'JSS2',sources:[],visuals:[],history:[],observations:[]};
describe('explicit local text gateway',()=>{
  it('rejects remote endpoints and provides honest text-only capabilities',async()=>{
    expect(()=>new LlamaTutor('model','https://remote.invalid')).toThrow('loopback');
    const p=new LlamaTutor('model','http://127.0.0.1:8081');
    await expect(p.speak()).rejects.toThrow('no speech');await expect(p.transcribe()).rejects.toThrow('type');
  });
  it('never falls back after an unavailable local model or sends raw evidence identifiers',async()=>{
    const request=vi.fn<typeof fetch>().mockRejectedValue(new Error('unavailable'));
    const p=new LlamaTutor('pinned-model','http://127.0.0.1:8081',request);
    await expect(p.answer({...input,observations:[{eventId:'private-event-id',conceptId:'private-concept-id',kind:'pause',detail:'pause'}]})).rejects.toThrow('local text model is unavailable');
    expect(request).toHaveBeenCalledTimes(1);expect(request.mock.calls[0][0]).toBe('http://127.0.0.1:8081/v1/chat/completions');
    expect(request.mock.calls[0][1]?.redirect).toBe('error');
    expect(String(request.mock.calls[0][1]?.body)).not.toContain('private-event-id');
  });
});
