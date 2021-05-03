// Get value by path from the object
// Usage: const value = getDeepValue(obj, 'path.to.variable');
module.exports.getDeepValue = (obj, path) => path
  .split('.')
  .reduce(
    (res, prop) => {
      const arrProp = prop.match(/(\w+)\[(\d+)\]$/i);
      if (arrProp) {
        return res ? res[arrProp[1]][Number(arrProp[2])] : undefined;
      }
      return res ? res[prop] : undefined;
    },
    obj
  );
