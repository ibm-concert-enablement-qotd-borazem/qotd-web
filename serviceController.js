const utils = require('./utils.js');
const metrics = require('./metrics.js');
const loggerEngine = require('./logger.js');
const fs = require('fs');
const special = require('./special.js');

function startService() {
    appService = serviceController.listen(serviceController.get('port'), '0.0.0.0', function () {
        utils.log(`Starting Control plane on port ${serviceController.get('port')}`);
    });
}

function stopService() {
    appService.close();
}

function crash() {
    utils.log("Aaaaah!");
    // set up timer to crash after 3 seconds 
    setTimeout(function () {
        // process.exit(-1);  // produces simpler clear log entries than uncaught exception
        process.nextTick(function () {
            throw new Error;
        });
    }, 4000);
}

serviceController.post('/reset', function(req,res){
    metrics.resetToFactorySettings();
    loggerEngine.resetToFactorySettings();
    res.send("OK");
});

serviceController.post('/app/:action', function(req,res){
    var status = 200;
    var msg = {"msg":"OK"};

    var action = req.params.action;
    utils.logLocal(`App action: ${action}`);

    switch( action ){
        case 'crash': {
            crash();
            break;
        }
        case 'start': {
            if( !appService.listening ) startService();
            break;
        }
        case 'stop': {
            if( appService.listening ) stopService();
            break;
        }

        case 'sick': {
            _liveness.healthy = false;
            break;
        }

        case 'heal': {
            _liveness.healthy = true;
            break;
        }

        case 'reset': {
            metrics.resetToFactorySettings();
            loggerEngine.resetToFactorySettings();
            break;
        }

        case 'special': {
            try{
                msg = special.action(req.body);
            } catch( error ) {
                status = 500;
                msg = error;
            }
            break;
        }
    }
    res.status(status).json(msg);
});


var _liveness = {
    "healthy": true
}

function isHealthy(){
    return _liveness.healthy;
}
exports.isHealthy=isHealthy;

serviceController.put('/liveness', function(req,res){
	var liveness = req.body;
    if( typeof liveness.healthy == 'boolean' ){
        _liveness.healthy = liveness.healthy;
        utils.logLocal("liveness updated to " + _liveness.healthy );
        res.send("OK");
    } else {
        utils.logLocal("invalid value for liveness.healthy " + JSON.stringify(liveness) );
        res.status(400).send("invalid value for liveness.healthy " + JSON.stringify(liveness));
    }
});

serviceController.delete('/liveness', function(req,res){
	_liveness = { "healthy": true };
    utils.logLocal("Reset health to " + JSON.stringify(_liveness) );
    res.json(_liveness);
});

//-------------------------------------------------------------------------------------------------------------
// Call Distribution Overides

// global set of defined overrides
_callStatusDistribution = {};

function handleOverride(res, override, requestToken) {
    if( typeof override.headers != 'undefined' ) {
        var keys = Object.keys(override.headers);
        for( var header of keys ) {
            res.header(header, override.headers[header] );
        }
    }
    var payload = "";
    if( typeof override.payload != 'undefined' ) {
        payload = override.payload;
    } 
    res.status(override.code).send(payload);
    if( typeof override.log != undefined ) {
        var log = loggerEngine.genLog(override.log);
        utils.log(log,requestToken);
    }
}
exports.handleOverride = handleOverride;

function callStatusOverride(path){
    var keys = Object.keys(_callStatusDistribution);
    if( keys.length == 0 || typeof _callStatusDistribution[path] == 'undefined') return null;

    var callStatusDistribution = _callStatusDistribution[path];

    var optionsArray = [];
    for( var option of callStatusDistribution ){

        // do checking here
        var code = option.code;
        var weight = option.weight;
        if( code <= 563 && option.weight >= 0 ) {
            for(var j=0;j<weight;j++){
                optionsArray.push(option);
            }
        }
    }

    if( optionsArray.length > 0 ) {
        var len = optionsArray.length;
        var i = utils.intBetween(0,len);
        var override = optionsArray[i]; 
        if( override.code <= 0 ) override = null;
        return override;
    } else {
        return null;
    }

}

exports.callStatusOverride = callStatusOverride;

function validationErrors(override){

    // todo

    return null;
}

serviceController.get('/callDistribution/', function(req,res){
    if( _callStatusDistribution == null ) _callStatusDistribution = {};
    res.status(200).json(_callStatusDistribution);
});

serviceController.delete('/callDistribution', function(req,res){
    initializeCallOverrides();
    res.status(200).send("OK Call Distributions Reset");
});


serviceController.get('/callDistribution/:pathId', function(req,res){
    var pathId = req.params.pathId;
    if( typeof _callStatusDistribution[pathId] != 'undefined' ) {
        res.status(200).json(_callStatusDistribution[pathId]);
    }
    res.status(404).send("Call distribution override not found");
});

serviceController.post('/callDistribution/:pathId', function(req,res){
    var pathId = req.params.pathId;
    if( typeof _callStatusDistribution[pathId] == 'undefined' ) {
        var override = req.body;
        var errors = validationErrors( override );
        if( errors == null ) {
            _callStatusDistribution[pathId] = override;
            res.status(201).send("OK");
        } else {
            res.status(422).send("Errors in override: " + errors);
        }
    } else {
        res.status(409).send("Conflict.  Path already exists.");
    }
});

serviceController.put('/callDistribution/:pathId', function(req,res){
    var pathId = req.params.pathId;
    if( typeof _callStatusDistribution[pathId] != 'undefined' ) {
        var override = req.body;
        var errors = validationErrors( override );
        if( errors == null ) {
            _callStatusDistribution[pathId] = override;
            res.status(200).send("OK");
        } else {
            res.status(422).send("Errors in override: " + errors);
        }
    } else {
        res.status(404).send("PathId Not Found");
    }
});

serviceController.delete('/callDistribution/:pathId', function(req,res){
    var pathId = req.params.pathId;
    if( typeof _callStatusDistribution[pathId] != 'undefined' ) {
        delete _callStatusDistribution[pathId];
        res.status(204).send("OK");
    } else {
        res.status(404).send("PathId Not Found");
    }
});


function initializeCallOverrides(){

    try{
        var data = fs.readFileSync('./config/overrides.json');
        _callStatusDistribution = JSON.parse(data);
    } catch( error ) {
        utils.log("Error reading call overrides: " + error);
    }

}

exports.initializeCallOverrides = initializeCallOverrides;

startService();