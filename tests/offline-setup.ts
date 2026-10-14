import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import dgram from 'node:dgram';
import { vi } from 'vitest';

function networkDisabled(): never {
  throw new Error('Network access is disabled in contract tests');
}

vi.stubGlobal('fetch', networkDisabled);
vi.stubGlobal('WebSocket', networkDisabled);
vi.spyOn(http, 'request').mockImplementation(networkDisabled);
vi.spyOn(http, 'get').mockImplementation(networkDisabled);
vi.spyOn(https, 'request').mockImplementation(networkDisabled);
vi.spyOn(https, 'get').mockImplementation(networkDisabled);
vi.spyOn(net.Socket.prototype, 'connect').mockImplementation(networkDisabled);
vi.spyOn(dgram.Socket.prototype, 'send').mockImplementation(networkDisabled);
