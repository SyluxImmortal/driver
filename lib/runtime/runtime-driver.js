const _ = require('lodash');
const runtime = require('./runtime');

function EvalCodeError(message) {
    this.toString = () => message;
}

var runtimeCache = {};
var worldSize = global._worldSize;

exports.constants = require('@screeps/common/lib/constants');

exports.bufferFromBase64 = (base64) => {
    return Buffer.from(base64, 'base64');
};

exports.getWorldSize = function() {
    return worldSize;
};

exports.evalCode = function(module, globals, returnValue, timeout, scriptCachedData) {

    var options = {filename: module.name};

    var oldModule = globals.__module || {};

    globals.__module = module;

    if(!_.isUndefined(timeout) && timeout !== null && timeout !== 0 && timeout != Infinity) {
        options.timeout = timeout + 5;
        if(options.timeout < 30) {
            options.timeout = 30;
        }
    }

    // if(scriptCachedData) {
    //     options.produceCachedData = true;
    //     if(scriptCachedData.cachedData && scriptCachedData.cachedData[module.name]) {
    //         options.cachedData = scriptCachedData.cachedData[module.name];
    //     }
    // }

    try {

        if(!runtimeCache[module.user] || !runtimeCache[module.user].modules[module.name] ||
            runtimeCache[module.user].modules[module.name].timestamp != module.timestamp) {

            runtimeCache[module.user] = runtimeCache[module.user] || {};
            runtimeCache[module.user].modules = runtimeCache[module.user].modules || {};

            var code = module.code;

            if (!returnValue) {
                code = '(function __module(module,exports){ ' + module.code + "\n})(__module, __module.exports)";
            }
            var script = runtime.isolate.compileScriptSync(code, options);

            // if(scriptCachedData) {
            //     if(script.cachedDataProduced) {
            //         scriptCachedData.cachedDataProduced = scriptCachedData.cachedDataProduced || {};
            //         scriptCachedData.cachedDataProduced[module.name] = script.cachedData;
            //         //console.log('cached data produced',module.user,module.name,script.cachedData.byteLength);
            //     }
            //     if(script.cachedDataRejected) {
            //         scriptCachedData.cachedDataRejected = true;
            //         //console.log('cached data rejected',module.user,module.name);
            //     }
            //     if(script.cachedDataRejected === false) {
            //         //console.log('cached data accepted',module.user,module.name);
            //     }
            // }

            runtimeCache[module.user].modules[module.name] = {
                timestamp: module.timestamp,
                script
            };
        }

        var result = runtimeCache[module.user].modules[module.name].script.runSync(runtime.context, options);

        globals.module = oldModule;

        return result;
    }
    catch(e) {

        if(e === undefined || e.message == 'Script execution timed out.') {
            throw new EvalCodeError('Script execution timed out: CPU limit reached');
        }

        if(e.message == 'Script execution interrupted.') {
            throw new EvalCodeError('Script execution has been interrupted: CPU limit reached');
        }

        if(e instanceof EvalCodeError) throw e;

        var message = '';
        if(e.stack) {
            message = e.stack;
            message = message.replace(/</g,'&lt;');

            message = message.replace(/ *at.*?$/, '');
            message = message.replace(/_console\d+:\d+/, 'console');

            message = _.filter(message.split(/\n/), (i) => !/&lt;isolated-vm>/.test(i) && (!/ at /.test(i) || /\(/.test(i))).join("\n");

            message = message.replace(/at __module \((.*)\)/g, 'at $1');
        }
        else {
            message = e.message;
        }
        throw new EvalCodeError(message);
    }
};

exports.pathFinder = require('./path-finder');