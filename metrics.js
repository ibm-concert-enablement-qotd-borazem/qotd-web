const utils = require('./utils.js');

const factorySettings = require('./data/factory_settings.json');


// --------------------------------------------------
// Response time

var apiOptions = JSON.parse(JSON.stringify(factorySettings.api));

function getDelay() {
    var mean = apiOptions.mean;
    var stdev = apiOptions.stdev;
    var min = apiOptions.min;
    var max = apiOptions.max;
    return utils.genNormalInt(mean, stdev, min, max);
}
exports.getDelay = getDelay;

serviceController.delete('/metric/api', function (req, res) {
    apiOptions = JSON.parse(JSON.stringify(factorySettings.api));
    utils.logLocal("DELETE /metric/api ");
    res.status(200).send("OK");
});

function updateLatency(options){
    if( typeof options.mean != 'undefined' && !isNaN(options.mean) ) {
        if( options.mean > 10 && options.mean < 5000 ) {
            apiOptions.mean  = options.mean;
        }
    } else if( typeof options.stdev != 'undefined' && !isNaN(options.stdev) ) {
        if( options.stdev > 10 && options.stdev < 5000 ) {
            apiOptions.stdev  = options.stdev;
        }
    } else if( typeof options.min != 'undefined' && !isNaN(options.min) ) {
        if( options.min > 10 && options.min < 3000 ) {
            apiOptions.min  = options.min;
        }
    } else if( typeof options.max != 'undefined' && !isNaN(options.min) ) { 
        if( options.max > options.min && options.max < 10000 ) {
            apiOptions.max  = options.max;
        }
    }
}

serviceController.put('/metric/api', function (req, res) {
    utils.logLocal("PUT /metric/api " + JSON.stringify(req.body));
    if( typeof req.body.mean != 'undefined' ){
        apiOptions.mean = req.body.mean;
    }
    if( typeof req.body.stdev != 'undefined' && req.body.stdev <= apiOptions.mean ){
        apiOptions.stdev = req.body.stdev;
    }
    if( typeof req.body.min != 'undefined' && typeof req.body.max != 'undefined' ){
        if( req.body.min < req.body.max ) {
            apiOptions.min = req.body.min;
            apiOptions.max = req.body.max;
        } 
    } else if( typeof req.body.min != 'undefined' && typeof req.body.max == 'undefined' ){
        if( req.body.min < apiOptions.max ) {
            apiOptions.min = req.body.min;
        } 
    } else if( typeof req.body.min == 'undefined' && typeof req.body.max != 'undefined' ){
        if( apiOptions.min < req.body.max ) {
            apiOptions.max = req.body.max;
        } 
    }
    res.status(200).end("OK");
});

serviceController.get('/metric/api', function (req, res) {
    res.json(apiOptions);
});


// --------------------------------------------------
// Memory

var memOptions = JSON.parse(JSON.stringify(factorySettings.mem));

var memHogs = [];

function updateMemoryHogs(){
    var currentHogs = memHogs.length;
    var desiredHogs = memOptions.hogs;
    var diff = desiredHogs - currentHogs;
    if( diff >= 0  ) {
        // then add more
        utils.logLocal( "Adding mem hogs: "+ diff);
        for(var i=0; i<diff; i++ ){
            setTimeout( () => {
                allocMemoryBlock();
            }, i*2000);
        }
    } else {
        diff = -diff;
        utils.logLocal( "Removing mem hogs: "+ diff);
        if( diff >= memHogs.length ) diff = memHogs.length;
        for(var i=0; i<diff; i++ ){
            setTimeout( () => {
                memHogs.pop();
                utils.logLocal("hot dog hog ["+ memHogs.length + "], taking out garbage");    
                global.gc();
            }, i*2000);
        }
    }
}

function allocMemoryBlock(){
    const arr = []
    var blockSize = 7000 * 1024 / 8
    arr.length = blockSize;
    for (let i = 0; i < blockSize; i++) {
        arr[i] = i;
    }
    memHogs.push(arr);
    var len = memHogs.length-1;
    utils.logLocal("new hog ["+ len + "]"); 
}


serviceController.put('/metric/mem', function (req, res) {
    utils.logLocal("PUT /metric/mem " + JSON.stringify(req.body));
    if( req.body.hogs != 'undefined' && req.body.hogs >= 0 ){
        memOptions = req.body;
        updateMemoryHogs();
        res.status(200).json(memOptions);
    } else {
        utils.logLocal("Invalid number of mem hogs: " + req.body.hogs);
        res.status(400).end("Invalid number of mem hogs: " + req.body.hogs);
    }
});

serviceController.delete('/metric/mem', function (req, res) {
    utils.logLocal("DELETE /metric/mem ");
    memOptions = JSON.parse(JSON.stringify(factorySettings.mem));
    updateMemoryHogs();
    res.status(200).send("OK");
});

serviceController.get('/metric/mem', function (req, res) {
    var response = memOptions;
    response.actual = memHogs.length;
    res.json(memOptions);
});


// --------------------------------------------------
//  CPU

var cpuOptions = JSON.parse(JSON.stringify(factorySettings.cpu));

var CPU_HOG_SIZE = 50000;
if( typeof process.env.CPU_HOG_SIZE != 'undefined' ) {
    CPU_HOG_SIZE = parseInt(process.env.CPU_HOG_SIZE);
    if(CPU_HOG_SIZE<1000) CPU_HOG_SIZE = 50000;
}
var cpuHogs = [];

function cpuHogBurst(){
    var countTo = CPU_HOG_SIZE;
    var result;
    for( var i=0; i<countTo; i++){
        result = Math.random() * Math.random();
    }
    // utils.logLocal("oink");
}

function addCpuHog() {
    var cpuInterval = setInterval(cpuHogBurst,500);
    cpuHogs.push(cpuInterval);    
    utils.logLocal('Adding cpu hog [' + cpuHogs.length + ']');
};

function removeCpuHog() {
    var hog = cpuHogs.pop();
    clearInterval(hog);
    delete hog;
    utils.logLocal('Removed cpu hog [' + cpuHogs.length + ']');
};

function updateCpuHogs(){
    var currentCpuHogCount = cpuHogs.length;
    var desiredCpuHogCount = cpuOptions.hogs;
    var diff = desiredCpuHogCount - currentCpuHogCount;
    if( diff >= 0 ) {
        utils.logLocal("Adding cpu hogs: " + diff );
        for( var i=0; i<diff; i++){
            setTimeout( ()=> {
                addCpuHog();
            }, i*2000);
        }
        
    } else {
        diff = -diff;
        utils.logLocal("Removing cpu hogs: " + diff );
        for( var i=0; i<diff; i++){
            setTimeout( ()=> {
                removeCpuHog();
            }, i*2000);
        }
    }
    utils.logLocal("Current cpu hogs: " + cpuHogs.length );
}

serviceController.put('/metric/cpu', function (req, res) {
    utils.logLocal("PUT /metric/mem " + JSON.stringify(req.body));
    if( req.body.hogs != 'undefined' && req.body.hogs >= 0 ){
        cpuOptions = req.body;
        updateCpuHogs();
        res.status(200).json(cpuOptions);
    } else {
        utils.logLocal("Invalid number of cpu hogs: " + req.body.hogs);
        res.status(400).end("Invalid number of cpu hogs: " + req.body.hogs);
    }
});

serviceController.delete('/metric/cpu', function (req, res) {
    utils.logLocal("DELETE /metric/cpu ");
    cpuOptions = JSON.parse(JSON.stringify(factorySettings.cpu));
    updateCpuHogs();
    res.status(200).send("OK");
});


serviceController.get('/metric/cpu', function (req, res) {
    var response = cpuOptions;
    response.actual = cpuHogs.length;
    res.json(response);
});

function getStatus(){
    var mem = memOptions;
    mem.actual = memHogs.length;
    var cpu = cpuOptions;
    cpu.actual = cpuHogs.length;
    var status = {
        "api": apiOptions,
        "mem": mem,
        "cpu": cpu
    }
    return status;
}
// get em all
serviceController.get('/metric', function (req, res) {
    var status = getStatus();
    utils.logLocal("GET /metric " + JSON.stringify(status));
    res.json(status);
});

serviceController.put('/metric', function (req, res) {

    utils.logLocal("PUT /metric " + JSON.stringify(req.body));

    if( req.body.api != 'undefined' ){
        updateLatency(req.body.api);
    } 
    if( req.body.mem != 'undefined' ) {
        memOptions = req.body.mem;
        updateMemoryHogs();
    }
    if( req.body.cpu != 'undefined' ) {
        cpuOptions = req.body.cpu;
        updateCpuHogs();
    }

    var status = getStatus();
    res.json(status);
});

serviceController.delete('/metric', function (req, res) {
    utils.logLocal("DELETE /metric " + JSON.stringify(req.body));
    resetToFactorySettings();
    res.send("OK");
});

//----------------------------------------------------------------------------------

function resetToFactorySettings(){
    apiOptions = JSON.parse(JSON.stringify(factorySettings.api));
    memOptions = JSON.parse(JSON.stringify(factorySettings.mem));
    cpuOptions = JSON.parse(JSON.stringify(factorySettings.cpu));
    updateCpuHogs();
    updateMemoryHogs();
}
exports.resetToFactorySettings = resetToFactorySettings;



