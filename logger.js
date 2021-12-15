const faker = require('faker');
const moment = require('moment');
const utils = require('./utils.js');
const fs = require('fs');

//----------------------------------------------------------------------------------------------
// endpoint definitions

function getLogger(id) {
    var loggers = getActiveLoggers();
    return loggers[id];
}

serviceController.post('/logger',
    function (req, res) {
        var logTemplate = req.body;

        if (typeof logTemplate.repeat == 'undefined') {
            // one time log
            var log = genLog(logTemplate);
            utils.log(log);
        } else {
            addLogger(logTemplate);
        }
        res.status(200).send("OK");
    }
);

function updateLogger(logger, updatedLogger) {
    if( typeof updatedLogger.repeat.mean != 'undefined' ) {
        logger.repeat.mean = updatedLogger.repeat.mean;
    }
    if( typeof updatedLogger.repeat.stdev != 'undefined' ) {
        logger.repeat.stdev = updatedLogger.repeat.stdev;
    } else {
        delete logger.repeat.stdev;
    }
    if( typeof updatedLogger.repeat.min != 'undefined' ) {
        logger.repeat.min = updatedLogger.repeat.min;
    } else {
        delete logger.repeat.min;
    }
    if( typeof updatedLogger.repeat.max != 'undefined' ) {
        logger.repeat.max = updatedLogger.repeat.max;
    } else {
        delete logger.repeat.max;
    }

}

serviceController.put('/logger',
    function (req, res) {
        var loggerData = req.body;
        var id = loggerData.id;
        var logger = getLogger(id);
        if( logger == null ) res.status(404).json( { "error": "logger not found "+id });
        updateLogger(logger, loggerData);
        res.status(200).send("OK");
    }
);

serviceController.put('/logger/:id',
    function (req, res) {
        var id = req.params.id;
        var loggerData = req.body;
        var did = loggerData.id;
        var logger = getLogger(id);
        if( id != did || logger == null ) res.status(404).json( { "error": "logger not found "+id });
        updateLogger(logger, loggerData);
        res.status(200).send("OK");
    }
);

serviceController.get('/logger',
    function (req, res) {
        var summary = [];
        var loggers = getActiveLoggers();
        var keys = Object.keys(loggers);
        for (var i = 0; i < keys.length; i++) {
            var key = keys[i];
            var logger = loggers[key];
            summary.push({ "id": logger.id, "name": logger.name });
        }
        res.json(summary);
    }
);


serviceController.get('/logger/:id',
    function (req, res) {
        var id = req.params.id;
        var loggers = getActiveLoggers();
        if (typeof loggers[id] == 'undefined') {
            res.status(404).send(`Logger ${id} not found.`);
        } else {
            res.json(loggers[id]);
        }
    }
);

serviceController.delete('/logger/:id',
    function (req, res) {
        var id = req.params.id;
        var loggers = getActiveLoggers();
        var log = loggers[id];
        if (typeof log == 'undefined' || log == null) {
            res.status(404).send("Not found");
        } else {
            removeLogger(log.id);
            res.send("OK");
        }
    }
);

function genValue(field) {
    var type = field.type;
    switch (type) {
        case 'pickWeighted':
            var options = field.options;
            return utils.pickWeighted(options);
        case 'pick':
            var options = field.options;
            return utils.pick(options);
        case 'normalInt':
            return utils.genNormalInt(field.mean, field.stdev, field.min, field.max);
        case 'normalFloat':
            var val = utils.genNormal(field.mean, field.stdev, field.min, field.max);
            if (typeof field.toFixed == 'undefined') {
                return val;
            } else {
                return val.toFixed(field.toFixed);
            }
        case 'randomInt':
            return utils.intBetween(field.min, field.max);
        case 'randomFloat':
            var val = utils.floatBetween(field.min, field.max);
            if (typeof field.toFixed == 'undefined') {
                return val;
            } else {
                return val.toFixed(field.toFixed);
            }
        case 'ip':
            return faker.internet.ip();
        case 'email':
            return faker.internet.email();
        case 'userName':
            return faker.internet.userName();
        case 'url':
            return faker.internet.url();
        case 'mac':
            return faker.internet.mac();
        case 'domainName':
            return faker.internet.domainName();
        case 'word':
            return faker.lorem.word();
        case 'sentence':
            return faker.lorem.sentence();
        case 'dateRecent':
            var val = faker.date.recent();
            var mt = new moment(val);
            return mt.format(field.format);
        case 'formattedTimestamp':
            var mt = new moment();
            return mt.format(field.format);
        case 'utcTimestamp':
            var mt = new moment().utc();
            return mt.format();
        case 'fileName':
            return faker.system.fileName();
        case 'fileType':
            return faker.system.fileType();
        default:
        // code block
    }
}

function replaceAll(key, value, string) {
    const field = "{{" + key + "}}";
    const replacer = new RegExp(field, 'g');
    return string.replace(replacer, value);
}

var activeLoggers = {};
var timers = {};

function stopAll() {
    for (const loggerId in activeLoggers) {
        activeLoggers[loggerId].isRunning = false;
        clearTimeout(timers[loggerId]);
    }
    return activeLoggers;
}
exports.stopAll = stopAll;

function getActiveLoggers() {
    return activeLoggers;
}
exports.getActiveLoggers = getActiveLoggers;

function addLogger(logger) {
    activeLoggers[logger.id] = logger;
    runLogger(logger.id);
}
exports.addLogger = addLogger;

function runLogger(loggerId) {
    var logger = activeLoggers[loggerId];
    if (logger) {
        var logEntry = genLog(logger);
        utils.log(logEntry);
        var repeat = logger.repeat;
        var time = utils.genNormalInt(repeat.mean, repeat.stdev, repeat.min, repeat.max);
        timers[logger.id] = setTimeout(runLogger, time, loggerId);
    }
}

function removeLogger(loggerId) {
    utils.logLocal('Removing logger');
    clearTimeout(timers[loggerId]);
    delete timers[loggerId];
    delete activeLoggers[loggerId];
}
exports.removeLogger = removeLogger;

function genLog(logger) {
    var fields = logger.fields;
    if( typeof fields == 'undefined' ) return logger.template;

    // otherwise lets make up some stuff
    var fieldNames = Object.keys(fields);
    var template = logger.template;
    for (const fieldName of fieldNames) {
        var field = fields[fieldName];
        var value = genValue(field);
        template = replaceAll(fieldName, value, template);
    }
    return template;
}
exports.genLog = genLog;

function resetToFactorySettings() {
    var keys = Object.keys(activeLoggers);
    for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        var logger = activeLoggers[key];
        removeLogger(logger.id);
    }
    intializeDefaultLoggers();
}
exports.resetToFactorySettings = resetToFactorySettings;

function intializeDefaultLoggers(){
    utils.logLocal("Initializing default loggers");
    try {
        activeLoggers = [];
        var loggerDefs = fs.readdirSync('./loggers');
        for (loggerDef of loggerDefs) {
            if( loggerDef.endsWith('.json') ) {
                var data = fs.readFileSync('./loggers/' + loggerDef);
                var def = JSON.parse(data);
                addLogger(def);
            }
        }
    } catch (error) {
        if (error.code == 'ENOENT') {
            utils.logLocal('No default loggers');
        } else {
            utils.logLocal(error.message);
        }
    }
}
exports.intializeDefaultLoggers = intializeDefaultLoggers;



