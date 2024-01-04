export function cloneDeep(value: any): any {
  if (typeof value !== "object" || value === null) {
    return value;
  }

  let clone: any;

  if (Array.isArray(value)) {
    clone = value.map(cloneDeep);
  } else {
    clone = {};
    for (let key in value) {
      if (value.hasOwnProperty(key)) {
        clone[key] = cloneDeep(value[key]);
      }
    }
  }

  return clone;
}