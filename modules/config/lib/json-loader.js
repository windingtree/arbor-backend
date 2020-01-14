const fs = require('fs');
const log = require('log4js').getLogger('json-loader');

const ninvoke = async (className, methodName, ...args) => {
	return new Promise((resolve, reject) => {
		className[methodName](...args, (err, data) => {
			if (err) {
				reject(err);
			} else {
				resolve(data);
			}
		});
	});
};

module.exports = function (defaultJson, filePath) {
	return ninvoke(fs, 'readFile', filePath, {'encoding': 'utf8'}).then(function (ret) {
		return JSON.parse(ret);
	}, function () {
		log.info("Cannot read '%s', using default configuration", filePath);
		if (defaultJson)
			return defaultJson;
		log.fatal("Could not find '%s'. Exiting...", filePath);
		process.exit(-1)
	}).catch(function (err) {
		log.fatal("Cannot parse content of file by path '%s' as JSON. Error: '%s'", filePath, err.message);
		process.exit(-1)
	});

};
