/**
 * `voyage consent [status|grant|revoke]` — show, grant, or revoke the consent
 * for third-party lookups; the choice is remembered under the config home
 * (VOY-F-13, §6.4). The prompt text itself comes from `packages/enrich` so
 * the listed services stay in sync with what is actually sent.
 */
import { CliError, EXIT_BAD_ARG, EXIT_OK } from '../runtime.ts';
import type { CliContext } from '../runtime.ts';
import { CONSENT_SERVICE_IDS } from './shared.ts';

export type ConsentAction = 'status' | 'grant' | 'revoke';

export interface ConsentCommandOptions {
  action?: string;
  json: boolean;
}

function resolveAction(raw: string | undefined): ConsentAction {
  const action = raw ?? 'status';
  if (action === 'status' || action === 'grant' || action === 'revoke') return action;
  throw new CliError(
    EXIT_BAD_ARG,
    `unknown consent action "${action}" (expected status, grant, or revoke)`,
  );
}

export async function runConsentCommand(opts: ConsentCommandOptions, ctx: CliContext): Promise<number> {
  const { io, deps } = ctx;
  const action = resolveAction(opts.action);
  const { enrich } = deps;

  if (action === 'grant') {
    enrich.writeConsent(ctx.home, {
      granted: true,
      services: CONSENT_SERVICE_IDS,
      grantedAt: io.now(),
    });
  } else if (action === 'revoke') {
    enrich.writeConsent(ctx.home, { granted: false, services: [], grantedAt: null });
  }
  const state = enrich.readConsent(ctx.home);

  if (opts.json) {
    io.stdout(
      `${JSON.stringify(
        { action, home: ctx.home, consent: state, notice: enrich.consentPromptText() },
        null,
        2,
      )}\n`,
    );
    return EXIT_OK;
  }

  if (action === 'grant') {
    io.stdout('Consent granted and remembered. Public hop addresses may be sent to:\n');
  } else if (action === 'revoke') {
    io.stdout('Consent revoked and remembered. Nothing will be sent to third parties;\n');
    io.stdout('enrichment now runs offline (hints and cache only).\n');
  }
  io.stdout(`${enrich.consentPromptText()}\n`);
  io.stdout(
    `Current state: ${state.granted ? `granted (${state.services.join(', ')})` : 'not granted'}\n`,
  );
  return EXIT_OK;
}
