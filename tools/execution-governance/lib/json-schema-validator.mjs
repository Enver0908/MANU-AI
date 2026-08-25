import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const SUPPORTED_KEYWORDS = new Set([
  '$schema',
  '$id',
  '$ref',
  'title',
  'description',
  'type',
  'const',
  'enum',
  'required',
  'properties',
  'additionalProperties',
  'items',
  'definitions',
  'minItems',
  'minLength',
  'minimum',
  'pattern',
  'format'
]);

export function loadSchemas(schemaDir) {
  const schemas = new Map();
  if (!existsSync(schemaDir)) return schemas;
  for (const name of readdirSync(schemaDir).filter((item) => item.endsWith('.json')).sort()) {
    const file = path.join(schemaDir, name);
    const value = JSON.parse(readFileSync(file, 'utf8'));
    schemas.set(name, value);
    if (typeof value.$id === 'string') schemas.set(value.$id, value);
  }
  return schemas;
}

export function validateFileAgainstNamedSchema({ schemaDir, schemaName, targetPath }) {
  const schemas = loadSchemas(schemaDir);
  const schema = schemas.get(schemaName);
  if (!schema) {
    return { ok: false, errors: [`schema not found: ${schemaName}`] };
  }
  let value;
  try {
    value = JSON.parse(readFileSync(targetPath, 'utf8'));
  } catch (error) {
    return { ok: false, errors: [`${targetPath}: ${error.message}`] };
  }
  return validateJsonAgainstSchema(value, schema, { schemas, label: targetPath });
}

export function validateJsonAgainstSchema(value, schema, options = {}) {
  const errors = [];
  const schemas = options.schemas || new Map();
  checkUnsupportedKeywords(schema, options.schemaPath || '#', errors);
  validateNode(value, schema, {
    path: options.valuePath || '$',
    schemaPath: options.schemaPath || '#',
    schemas,
    rootSchema: schema,
    errors
  });
  return { ok: errors.length === 0, errors };
}

function checkUnsupportedKeywords(schema, schemaPath, errors) {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) return;
  for (const key of Object.keys(schema)) {
    if (!SUPPORTED_KEYWORDS.has(key)) {
      errors.push(`${schemaPath}: unsupported schema keyword ${key}`);
    }
  }
  for (const [key, child] of Object.entries(schema)) {
    if (key === 'properties' || key === 'definitions') {
      for (const [name, nested] of Object.entries(child || {})) {
        checkUnsupportedKeywords(nested, `${schemaPath}/${key}/${name}`, errors);
      }
    } else if (key === 'items') {
      checkUnsupportedKeywords(child, `${schemaPath}/items`, errors);
    }
  }
}

function validateNode(value, schema, context) {
  if (!schema || typeof schema !== 'object') return;
  if (schema.$ref) {
    const target = resolveRef(schema.$ref, context);
    if (!target) {
      context.errors.push(`${context.schemaPath}: unresolved ref ${schema.$ref}`);
      return;
    }
    validateNode(value, target.schema, {
      ...context,
      schemaPath: target.schemaPath,
      rootSchema: target.rootSchema || context.rootSchema
    });
    return;
  }

  if (Object.prototype.hasOwnProperty.call(schema, 'const') && value !== schema.const) {
    context.errors.push(`${context.path}: expected const ${JSON.stringify(schema.const)}, got ${JSON.stringify(value)}`);
  }

  if (Array.isArray(schema.enum) && !schema.enum.includes(value)) {
    context.errors.push(`${context.path}: expected one of ${schema.enum.map((item) => JSON.stringify(item)).join(', ')}, got ${JSON.stringify(value)}`);
  }

  if (schema.type !== undefined && !matchesType(value, schema.type)) {
    context.errors.push(`${context.path}: expected type ${JSON.stringify(schema.type)}, got ${typeOf(value)}`);
    return;
  }

  if (typeof value === 'string') {
    if (Number.isInteger(schema.minLength) && value.length < schema.minLength) {
      context.errors.push(`${context.path}: string shorter than minLength ${schema.minLength}`);
    }
    if (typeof schema.pattern === 'string' && !(new RegExp(schema.pattern).test(value))) {
      context.errors.push(`${context.path}: does not match pattern ${schema.pattern}`);
    }
    if (schema.format === 'date-time' && Number.isNaN(Date.parse(value))) {
      context.errors.push(`${context.path}: invalid date-time`);
    }
  }

  if (typeof value === 'number' && Number.isFinite(value) && typeof schema.minimum === 'number' && value < schema.minimum) {
    context.errors.push(`${context.path}: number below minimum ${schema.minimum}`);
  }

  if (Array.isArray(value)) {
    if (Number.isInteger(schema.minItems) && value.length < schema.minItems) {
      context.errors.push(`${context.path}: array shorter than minItems ${schema.minItems}`);
    }
    if (schema.items) {
      value.forEach((item, index) => validateNode(item, schema.items, {
        ...context,
        path: `${context.path}[${index}]`,
        schemaPath: `${context.schemaPath}/items`
      }));
    }
  }

  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const properties = schema.properties || {};
    for (const requiredKey of schema.required || []) {
      if (!Object.prototype.hasOwnProperty.call(value, requiredKey)) {
        context.errors.push(`${context.path}: missing required property ${requiredKey}`);
      }
    }
    for (const [key, childValue] of Object.entries(value)) {
      const childSchema = properties[key];
      if (!childSchema) {
        if (schema.additionalProperties === false) {
          context.errors.push(`${context.path}: additional property ${key} is not allowed`);
        }
        continue;
      }
      validateNode(childValue, childSchema, {
        ...context,
        path: `${context.path}.${key}`,
        schemaPath: `${context.schemaPath}/properties/${key}`
      });
    }
  }
}

function resolveRef(ref, context) {
  if (ref.startsWith('#/')) {
    const parts = ref.slice(2).split('/').map((item) => item.replace(/~1/g, '/').replace(/~0/g, '~'));
    let node = context.rootSchema;
    for (const part of parts) {
      node = node?.[part];
      if (!node) return null;
    }
    return { schema: node, schemaPath: ref, rootSchema: context.rootSchema };
  }
  const schema = context.schemas.get(ref) || context.schemas.get(path.basename(ref));
  if (!schema) return null;
  return { schema, schemaPath: ref, rootSchema: schema };
}

function matchesType(value, expected) {
  const options = Array.isArray(expected) ? expected : [expected];
  return options.some((item) => {
    if (item === 'array') return Array.isArray(value);
    if (item === 'object') return value !== null && typeof value === 'object' && !Array.isArray(value);
    if (item === 'integer') return Number.isInteger(value);
    if (item === 'number') return typeof value === 'number' && Number.isFinite(value);
    if (item === 'null') return value === null;
    return typeof value === item;
  });
}

function typeOf(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (Number.isInteger(value)) return 'integer';
  return typeof value;
}
