// A provisioning failure (E2E isolation spec §4.4 item 5). The message
// names the step, the database and the host, and never the password. This
// module imports nothing, so pg-free modules and specs can use it.

export class ProvisionError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'ProvisionError';
  }
}
