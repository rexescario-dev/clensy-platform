import { createServer } from 'node:net';

// A TCP listener that counts accepted sockets and closes each at once. Tests
// aim connections at it to prove that no connection was opened (count 0).

export interface CountingListener {
  close(): Promise<void>;
  count(): number;
  host: '127.0.0.1';
  port: number;
}

export async function startCountingListener(): Promise<CountingListener> {
  let accepted = 0;
  const server = createServer((socket) => {
    accepted += 1;
    socket.destroy();
  });
  await new Promise<void>((resolveListen, rejectListen) => {
    server.once('error', rejectListen);
    server.listen(0, '127.0.0.1', () => resolveListen());
  });
  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('counting listener has no TCP address');
  }
  return {
    close: () =>
      new Promise<void>((resolveClose) => server.close(() => resolveClose())),
    count: () => accepted,
    host: '127.0.0.1',
    port: address.port,
  };
}
