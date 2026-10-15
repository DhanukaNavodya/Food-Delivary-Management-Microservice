// Returns a copy of `source` containing only the listed keys that are defined.
export function pick(source = {}, keys = []) {
  return keys.reduce((result, key) => {
    if (source[key] !== undefined) result[key] = source[key];
    return result;
  }, {});
}
