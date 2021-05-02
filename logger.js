const faker = require('faker');
const moment = require('moment');
const utils = require('./utils.js');
const fs = require('fs');

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
            return utils.genNormalInt(field.mean,field.stdev,field.min, field.max);
        case 'normalFloat':
            return utils.genNormal(field.mean,field.stdev,field.min, field.max);
        case 'randomInt':
            return utils.intBetween(field.min, field.max);
        case 'randomFloat':
            return utils.floatBetween(field.min, field.max);
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

function stopAll(){
    for( const loggerId in activeLoggers) {
        activeLoggers[loggerId].isRunning = false;
        clearTimeout(timers[loggerId]);
    }
    return activeLoggers;
}
exports.stopAll = stopAll;

function getActiveLoggers(){
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
    if( logger ) {
        var logEntry = genLog(logger);
        utils.log(logEntry);
        var repeat = logger.repeat;
        var time = utils.genNormalInt(repeat.mean,repeat.stdev,repeat.min,repeat.max);
        timers[logger.id] = setTimeout( runLogger, time, loggerId);    
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

function resetToFactorySettings(){
    for(var i=0; i<activeLoggers.length; i++){
        var logger = activeLoggers[i];
        removeLogger(logger.id);
    }
}
exports.resetToFactorySettings = resetToFactorySettings;

