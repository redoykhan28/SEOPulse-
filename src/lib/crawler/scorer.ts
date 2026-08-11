import { RuleResult } from './rules';

export function calculateScore(results: Record<string, RuleResult>): number {
  let totalWeight = 0;
  let earnedWeight = 0;

  for (const key in results) {
    const result = results[key];
    totalWeight += result.weight;
    
    if (result.passed) {
      earnedWeight += result.weight;
    } else if (result.severity === 'WARNING') {
      // Partial credit for warnings
      earnedWeight += result.weight * 0.5;
    }
    // ERROR severity gets 0 earned weight for this rule
  }

  if (totalWeight === 0) return 0;
  
  // Return a score out of 100
  return Math.round((earnedWeight / totalWeight) * 100);
}
