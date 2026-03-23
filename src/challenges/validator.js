export function validateChallenge(obj) {
  const errors = [];
  if (!obj || typeof obj !== 'object') return { valid: false, errors: ['Not an object'] };

  const required = ['id', 'title', 'prompt', 'language', 'tests'];
  for (const field of required) {
    if (!obj[field]) errors.push(`Missing required field: ${field}`);
  }

  if (typeof obj.id === 'string' && !/^[a-z0-9-]+$/.test(obj.id)) {
    errors.push(`Invalid id "${obj.id}": must be kebab-case (lowercase, numbers, hyphens)`);
  }

  if (obj.language && !['python', 'javascript'].includes(obj.language)) {
    errors.push(`Unsupported language: ${obj.language}`);
  }

  if (obj.difficulty && !['easy', 'medium', 'hard'].includes(obj.difficulty)) {
    errors.push(`Invalid difficulty: ${obj.difficulty}`);
  }

  if (Array.isArray(obj.tests)) {
    for (let i = 0; i < obj.tests.length; i++) {
      const t = obj.tests[i];
      if (!t.name) errors.push(`Test ${i}: missing name`);
      if (!t.run) errors.push(`Test ${i}: missing run`);
      if (!t.assert) errors.push(`Test ${i}: missing assert`);
    }
  }

  return { valid: errors.length === 0, errors };
}

export function validatePack(challenges) {
  const errors = [];
  if (!Array.isArray(challenges)) return { valid: false, errors: ['Pack must be an array of challenges'] };

  const ids = new Set();
  for (let i = 0; i < challenges.length; i++) {
    const result = validateChallenge(challenges[i]);
    if (!result.valid) {
      errors.push(`Challenge ${i} (${challenges[i]?.id || '?'}): ${result.errors.join(', ')}`);
    }
    if (challenges[i]?.id) {
      if (ids.has(challenges[i].id)) errors.push(`Duplicate challenge id: ${challenges[i].id}`);
      ids.add(challenges[i].id);
    }
  }

  return { valid: errors.length === 0, errors };
}
