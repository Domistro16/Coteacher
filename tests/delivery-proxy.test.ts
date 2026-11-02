import {afterEach,expect,it,vi} from 'vitest';
const load=vi.hoisted(()=>vi.fn(()=>({COTEACHER_DELIVERY_URL:'https://fixture.invalid'})));
vi.mock('vite',()=>({loadEnv:load}));
import {deliveryProxy} from '../apps/delivery-proxy';
afterEach(()=>{vi.unstubAllEnvs();load.mockClear();});
it('bypasses env-file loading only in explicit acceptance mode and preserves normal configuration',()=>{
  vi.stubEnv('COTEACHER_TEST_NO_ENV_FILES','true');vi.stubEnv('COTEACHER_DELIVERY_URL','http://127.0.0.1:12345');
  expect(deliveryProxy('production')['/api/v1'].target).toBe('http://127.0.0.1:12345');expect(load).not.toHaveBeenCalled();
  vi.stubEnv('COTEACHER_TEST_NO_ENV_FILES','false');deliveryProxy('production');expect(load).toHaveBeenCalledOnce();
});
