import { runAllTests } from './test-suite';

async function main() {
  console.log('🧪 Running Borderless Automated Test Suite...\n');
  const summary = await runAllTests();

  summary.results.forEach((res, i) => {
    const icon = res.passed ? '✅' : '❌';
    console.log(`${icon} [${res.category}] ${i + 1}. ${res.name} (${res.durationMs}ms)`);
    if (res.error) {
      console.error(`   Error: ${res.error}`);
    }
  });

  console.log('\n=======================================');
  console.log(`Results: ${summary.passed}/${summary.total} Passed (${summary.failed} Failed) in ${summary.durationMs}ms`);
  console.log('=======================================\n');

  if (summary.failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal test execution failure:', err);
  process.exit(1);
});
