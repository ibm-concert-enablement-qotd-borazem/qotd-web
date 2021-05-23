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

serviceController.post('/app', function(req,res){
    var action = req.body;
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

startService();