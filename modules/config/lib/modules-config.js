module.exports = function (init) {
	const config_filename = (process.env['APP_CONF'] || (__dirname + '/../../../modules_configs') )
		+ ((typeof init !== 'undefined' && init.modules_config)
			? ('/'+init.modules_config+'.json')
			: '/modules_config.json');
    return require('./json-loader')(null, config_filename); // eslint-disable-line global-require
};
