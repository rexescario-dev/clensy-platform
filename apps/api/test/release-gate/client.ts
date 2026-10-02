import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { classifyGraphql, classifyRest, Outcome } from './outcome';
import type { Call } from './probe';

const LOGIN_MUTATION = `
  mutation Login($input: LoginInput!) {
    login(loginInput: $input) { success }
  }
`;

// The only way the gate talks to the API: real HTTP through supertest,
// with the session cookie the login mutation sets (RFC §4.1 cookie JWT).
export class GateClient {
  constructor(private readonly app: INestApplication<App>) {}

  async login(email: string, password: string): Promise<string> {
    const response = await request(this.app.getHttpServer())
      .post('/graphql')
      .send({
        query: LOGIN_MUTATION,
        variables: { input: { email, password } },
      });
    const setCookie = response.headers['set-cookie'] as unknown as
      string[] | undefined;
    if (!setCookie || setCookie.length === 0) {
      throw new Error(
        `gate login failed for ${email}: ${JSON.stringify(response.body)}`,
      );
    }
    return setCookie[0].split(';')[0];
  }

  async execute(cookie: string | null, call: Call): Promise<Outcome> {
    const server = this.app.getHttpServer();
    if (call.kind === 'graphql') {
      let pending = request(server).post('/graphql');
      if (cookie) pending = pending.set('Cookie', cookie);
      const response = await pending.send({
        query: call.document,
        variables: call.variables,
      });
      return classifyGraphql(response.body, call.field);
    }
    const agent = request(server);
    let pending =
      call.method === 'GET'
        ? agent.get(call.path)
        : call.method === 'POST'
          ? agent.post(call.path)
          : call.method === 'PATCH'
            ? agent.patch(call.path)
            : agent.delete(call.path);
    if (cookie) pending = pending.set('Cookie', cookie);
    const response = call.body ? await pending.send(call.body) : await pending;
    return classifyRest(response.status, response.body);
  }
}
