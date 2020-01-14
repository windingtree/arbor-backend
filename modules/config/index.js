module.exports = (implArgs, moduleProperties) => { // [], {impl: "modules-config"}
	let ModuleClass;
	if (moduleProperties && moduleProperties.impl) {
		ModuleClass = require((__dirname + "/lib/" + moduleProperties.impl));
		return ModuleClass.apply(ModuleClass, implArgs);
	}
	ModuleClass = require((__dirname + "/lib/config.js"));
	return ModuleClass.apply(ModuleClass, implArgs);
};
