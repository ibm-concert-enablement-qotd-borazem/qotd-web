const utils = require('./utils.js');
const metrics = require('./metrics.js');
const loggerEngine = require('./logger.js');

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
        }
    }
    res.send('OK');
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

var _callStatusDistribution = [];
[
    { "code": 200, "weight": 9 },
    { 
        "code": 301, "weight": 1, 
        "headers": { "location": "https://example.com" },
        "payload": "Go here",
        "log": {
            "template": "Unexpected internal error: {{type}}",
            "fields": {
                "type": {
                    "type": "pickWeighted",
                    "options": [
                        { "value": "disk", "weight": 6 },
                        { "value": "memory", "weight": 4 }
                    ]            
                }
            }
        }
    }
]            

function callStatusOverride(){
    if( _callStatusDistribution.length == 0 ) return null;

    var optionsArray = [];
    for( var option of _callStatusDistribution ){

        // do checking here
        var code = option.code;
        var weight = option.weight;
        if( code >= 100 && code <= 563 && option.weight >= 0 ) {
            for(var j=0;j<weight;j++){
                optionsArray.push(option);
            }
        }
    }

    if( optionsArray.length > 0 ) {
        var len = optionsArray.length;
        var i = utils.intBetween(0,len);
        var override = optionsArray[i]; 
        if( override.code == 200 ) override = null;
        return override;
    } else {
        return null;
    }

}

exports.callStatusOverride = callStatusOverride;

exports.callStatusDistribution = _callStatusDistribution;

serviceController.get('/callDistribution', function(req,res){
    res.json(_callStatusDistribution);
});

serviceController.put('/callDistribution', function(req,res){
    if( Array.isArray( req.body ) ) {
        _callStatusDistribution = req.body;
        res.status(200).send("OK");
    } else {
        res.status(400).send("Expecting JSON array");
    }
});

serviceController.delete('/callDistribution', function(req,res){
    _callStatusDistribution =[];
    res.status(200).send("OK");
});

startService();