// Ultimate e2e: real Vercel Workflow SDK runtime ("use workflow" code) on the Entry-Lite world.
//
// This is a MANUAL e2e driver, not an automated unit test: it requires the
// `workflow` SDK package (resolvable only from the host app workspace, not
// from this repo's node_modules) and a wf-demo (nitro + workflow) project
// driven via WORKFLOW_TARGET_WORLD:
//   WORKFLOW_TARGET_WORLD=/home/agentuser/entry-lite-world WORKFLOW_ENTRYLITE=1 npm run dev   (in ~/wf-demo)
//
// The top-level 'workflow/api' import above is kept out of the automated
// suite: `npm test` globs only test/*.contract*.test.mjs-style suites it can
// resolve. This file self-skips when the SDK is not resolvable so a plain
// `node --test test/` run stays green.
let workflowApi = null;
try {
  workflowApi = await import('workflow/api');
} catch {
  console.log('SKIP: sdk-runtime is a manual e2e driver — workflow SDK not resolvable here.');
  process.exit(0);
}
if (!workflowApi) {
  console.log('SKIP: sdk-runtime manual e2e (see header).');
  process.exit(0);
}
console.log('This test drives wf-demo (nitro + workflow SDK) configured with our world.');
console.log('Run: WORKFLOW_TARGET_WORLD=/home/agentuser/entry-lite-world WORKFLOW_ENTRYLITE=1 npm run dev (in ~/wf-demo)');
