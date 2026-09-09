# CF OTel Policy

A small local logging-policy generator for Cloudflare Workers. Generate a policy, inspect the logging config and volume estimate, then try a synthetic fixture. v0.1.0 beta, MIT licensed, no runtime dependencies. Node.js 22.13+ for the CLI; Web APIs for the Worker adapter. Windows untested.

Despite the short name, this version is **not an OpenTelemetry SDK, collector or exporter**. It provides a structured-log policy and adapter. It does not ingest logs, provision resources, deploy Workers or contact an account. No sign-up or payment.

## Try the ZIP

Extract it and run inside its folder. No install step:

```sh
node cf-otel-policy.mjs generate examples/spec.json
node cf-otel-policy.mjs check examples/policy.json
node cf-otel-policy.mjs wrangler examples/policy.json
node cf-otel-policy.mjs budget examples/policy.json
node cf-otel-policy.mjs preview examples/policy.json examples/events.json
```

Commands print JSON to stdout and never edit files. `generate` adds the schema version and sorts event names; `check` lints this tool's policy, not an entire Wrangler config. `preview` treats the input array as one invocation, shows emitted/dropped counts, and uses a fixed synthetic UUID for repeatable fixtures. It does not simulate Cloudflare's random sampling. Exit 0: success; 1: invalid policy from `check`; 64: invalid/unreadable input or arguments. Error text does not echo file paths or input excerpts.

## Policy

| Field | Values |
| --- | --- |
| schemaVersion | 1 in generated policies; omit in generator input |
| events | 1–50 unique approved labels, 1–48 lowercase letters/digits/dot/underscore/hyphen, starting with a letter |
| sampleRate | Number from 0 to 1; Cloudflare head-sampling rate |
| maxEventsPerInvocation | Integer 1–100; cap per logger instance |
| dailyInvocations | Integer 0–1 billion; your estimate, not observed usage |
| correlation | `fresh-random` or `none` |

All fields are required; unknown fields are rejected. Configuration labels are trusted operator choices: do not put customer names, secrets or identities in them. The generator does not discover or verify usage.

## Use the logger

Import `createLogger` from `src/index.mjs`. Create exactly one instance inside each request handler, not at module scope. By default it calls `console.log` with a structured object. You can supply a synchronous sink as its second argument.

```js
const logger = createLogger(policy);
logger.log({ event: 'request.completed', level: 'info', status: 200, durationMs: 12 });
```

The adapter emits only `event`, `level`, `status`, `durationMs` and `correlationId`. Unknown event names become `other`; invalid typed fields become null. Levels are debug/info/warn/error; status is integer100–599; duration is integer0–86400000. Every other value is omitted: URLs, queries, headers, tokens, bodies, error text, email addresses, tool arguments and incoming correlation IDs. With fresh correlation, the adapter creates a new random UUID per instance and shares it across that instance's events. `none` emits null. It never reads a request ID, traceparent or cookie itself.

`log` returns true when sent to the sink, false when over the cap. Errors and late events can also be dropped at the cap; this is not an audit trail. Multiple instances multiply the cap. Input objects must be plain data, not getters or proxies. The example Worker returns redacted events for local inspection; it is a demonstration, not an ingest endpoint.

## Sampling and volume

The generated Wrangler fragment enables logs, sets the log head-sampling rate, requests query-string redaction, and disables automatic invocation logs and traces. **Review this change:** invocation metadata and traces will no longer be available under that fragment. Merge only into the intended configuration/environment; the tool never applies it. Do not deploy the whole policy JSON as Wrangler config.

The adapter does not sample again. Cloudflare's configured head sampling controls which invocations have logs collected. The estimate is `dailyInvocations × sampleRate × maxEventsPerInvocation`, assuming one logger per invocation at its cap. It is an expected upper bound for these adapter events under those assumptions, **not a hard cap, bill, price estimate or delivery guarantee**. Sampling varies; exceptions, other console calls, other loggers, provider metadata and other services are outside it. The unsampled maximum is also reported.

## Limits and privacy

CLI reads at most1MiB per JSON file; previews accept at most1000 event objects. Final-component symlinks and nonregular files are rejected; parent symlinks and concurrent filesystem changes are not isolated. The tool is not a filesystem sandbox.

Passing fixtures proves only those transformations. The adapter does not intercept unrelated console calls, exceptions, platform metadata, Tail Workers or traces. Numeric values, approved labels, counts, timing and random correlation relationships can remain sensitive. Review all retained data before sharing it. This is not a universal PII/secret detector or a guarantee of production privacy. No hosted service or MCP wrapper in this first version.

## Development and sources

`npm test` runs local tests; `npm run build` creates a ZIP/checksum using host `zip`. Package tests use `unzip`. Optional `npm run test:runtime` requires Miniflare, either installed or selected with `MINIFLARE_MODULE`. The local Worker fixture checks projection, caps and distinct invocation IDs; it does not prove remote sampling behavior.

Configuration checked against Wrangler4.130.0 and official docs on2026-09-09: [Workers Logs](https://developers.cloudflare.com/workers/observability/logs/workers-logs/), [Worker settings API](https://developers.cloudflare.com/api/resources/workers/subresources/scripts/subresources/settings/methods/edit/), [Workers best practices](https://developers.cloudflare.com/workers/best-practices/workers-best-practices/). Recheck provider support before deployment. Independent Valen Systems project, not affiliated with Cloudflare.
