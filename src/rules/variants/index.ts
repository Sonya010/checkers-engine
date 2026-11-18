import { InvalidPositionError } from '../errors.js';
import { Rules, VariantId } from '../types.js';
import { englishRules } from './english.js';
import { ukrainianRules } from './ukrainian.js';

export { englishRules, ukrainianRules };

export function getRulesById(id: VariantId | string): Rules {
  switch (id.trim().toLowerCase()) {
    case 'ukrainian':
      return ukrainianRules;
    case 'english':
      return englishRules;
    default:
      throw new InvalidPositionError(`Unsupported or unknown rules variant: ${id}`);
  }
}
