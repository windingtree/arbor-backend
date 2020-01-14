const _ = require('lodash');
const log = require('log4js').getLogger('bootstrap');
log.level = 'debug';

module.exports = async (modules_config, predefinedModules) => {
    let definedModules = predefinedModules || {};
    definedModules.modules_config = modules_config;

    const initModule = async (moduleName, moduleConfig, moduleDependencies) => {
        // log.info(`Going to init module: ${moduleName}`);
        log.debug('deps:', moduleDependencies);

        const module = (implArgs, moduleProperties) => {
            let ModuleClass;
            if (moduleProperties && moduleProperties.impl) {
                ModuleClass = require(`${moduleConfig.module}/lib/${moduleProperties.impl}`);
                return ModuleClass.apply(ModuleClass, implArgs);
            }
            ModuleClass = require(`${moduleConfig.module}/lib/impl.js`);
            return ModuleClass.apply(ModuleClass, implArgs);
        };

        // log.debug(`Attempt to call constructor for module ${moduleName}`);
        const moduleImpl = await module(moduleDependencies, moduleConfig.parameters);
        // log.info(`Initialized module: ${moduleName}`);
        definedModules[moduleName] = moduleImpl;

        if (moduleConfig.parameters && moduleConfig.parameters.rest === true) {
            await module([definedModules.rest, moduleImpl], { impl: 'rest.js' });
        }

        return moduleImpl;
    };

    const initModuleAndDependencies = async (moduleName, moduleConfig) => {
        if (definedModules[moduleName]) {
            return Promise.resolve(definedModules[moduleName]);
        }

        const moduleDependencies = await _.reduce(
            moduleConfig.dependencies,
            (memo, moduleDependencyName) => memo.then(async (initializedDependencies) => {
                if (!modules_config.modules[moduleDependencyName]) {
                    if (!definedModules[moduleDependencyName]) {
                        throw new Error(`Cannot resolve dependency "${moduleDependencyName}" while initializing module: ${moduleName}`);
                    } else {
                        log.info(`Using provided initialized module '${moduleDependencyName}'`);
                    }
                }
                const initializedModule = await initModuleAndDependencies(moduleDependencyName, modules_config.modules[moduleDependencyName]);
                return (initializedDependencies || []).concat([initializedModule]);
            }),
            Promise.resolve()
        );

        return initModule(moduleName, moduleConfig, moduleDependencies);
    };

    try {
        await _.reduce(
            modules_config.modules,
            (memo, moduleConfig, moduleName) => memo.then(() => {
                if (!moduleConfig.module) throw new Error(`Not found module path for: ${moduleName}`);
                return initModuleAndDependencies(moduleName, moduleConfig);
            }),
            Promise.resolve('Start bootstrap system')
        );
        log.info('System bootstrap completed!');
        return definedModules;
    } catch (e) {
        log.fatal('Error:', e.message, e);
        throw new Error(`Bootstrap error: ${e.message}`);
    }
};
