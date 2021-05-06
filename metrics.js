const utils = require('./utils.js');

const factorySettings = require('./data/factory_settings.json');


// --------------------------------------------------
// Response time

var apiResOptions = JSON.parse(JSON.stringify(factorySettings.api));

function getDelay() {
    var mean = apiResOptions.mean;
    var stdev = apiResOptions.stdev;
    var min = apiResOptions.min;
    var max = apiResOptions.max;
    return utils.genNormalInt(mean, stdev, min, max);
}
exports.getDelay = getDelay;

app.delete('/metric/apiRes', function (req, res) {
    apiResOptions = JSON.parse(JSON.stringify(factorySettings.api));
    utils.logLocal("DELETE /metric/apiRes ");
    res.status(200).send("OK");
});

var apiRampInterval;

function updateApiOptions(slope, target) {
    utils.logLocal("ramping api: " + apiResOptions.mean + " -> " + target  + ". Slope: " + slope);
    apiResOptions.mean += slope;
    if( apiResOptions.mean >= target ) {
        apiResOptions.mean = target;
        clearInterval(apiRampInterval);
        apiRampInterval = null;
    }
}

app.put('/metric/apiRes', function (req, res) {
    // todo: validation
    utils.logLocal("PUT /metric/apiRes " + JSON.stringify(req.body));
    var ramp = req.query.ramp;
    if( typeof ramp == 'undefined' ) {
        if( apiRampInterval ) {
            clearInterval(apiRampInterval);
            apiRampInterval = null;
        }
        apiResOptions = req.body;
    } else {
        // incrementaly change the mean (up or down) over the 
        var currentMean = apiResOptions.mean;
        var targetMean = req.body.mean;
        var overPeriodOfTime = ramp/1000; //convert to seconds
        var slope = (targetMean - currentMean) / overPeriodOfTime;
        var period = 1000; // change every 1s - roughtly corresponds to polling period
        req.body.mean = currentMean;
        apiResOptions = req.body;
        apiRampInterval = setInterval(updateApiOptions, period, slope, targetMean);
    }
    res.status(200).end("OK");
});

app.get('/metric/apiRes', function (req, res) {
    res.json(apiResOptions);
});


// --------------------------------------------------
// Memory

var memOptions = JSON.parse(JSON.stringify(factorySettings.mem));

var memoryAllocations = [];

function updateMemory(){
    var currentHogs = memoryAllocations.length;
    var desiredHogs = memOptions.hogs;
    var diff = desiredHogs - currentHogs;
    if( diff >= 0  ) {
        // then add more
        utils.logLocal( "Adding mem hogs: "+ diff);
        allocMemHog( diff );
    } else {
        diff = -diff;
        utils.logLocal( "Removing mem hogs: "+ diff);
        if( diff >= memoryAllocations.length ) diff = memoryAllocations.length;
        for(var i=0; i<diff; i++ ){
            memoryAllocations.pop();
            utils.logLocal("hot dog hog ["+ memoryAllocations.length + "]");
        }
        utils.logLocal( "Forcing garbage collection: "+ diff);
        global.gc();
    }
}

function allocMemHog(hogs) {
    return new Promise( (resolve,reject) => {
        try{
            
            for (let i = 0; i < hogs; i++) {
                const numbers = hogs * 10000 * 1024 / 8; // 1 hog ~= 10MB
                const arr = []
                arr.length = numbers; // Simulate allocation of 'size' bytes.
                for (let i = 0; i < numbers; i++) {
                    arr[i] = i;
                }
                memoryAllocations.push(arr);
                utils.logLocal("new hog ["+ memoryAllocations.length + "]");
            }
            resolve(hogs);
        }
        catch( error ) {
            reject( error );
        }
    });
};

app.put('/metric/mem', function (req, res) {
    utils.logLocal("PUT /metric/mem " + JSON.stringify(req.body));
    if( req.body.hogs != 'undefined' && req.body.hogs >= 0 ){
        memOptions = req.body;
        updateMemory();
        res.status(200).json(memOptions);
    } else {
        utils.logLocal("Invalid number of hogs: " + req.body.hogs);
        res.status(400).end("Invalid number of hogs: " + req.body.hogs);
    }
});

app.delete('/metric/mem', function (req, res) {
    utils.logLocal("DELETE /metric/mem ");
    memOptions = JSON.parse(JSON.stringify(factorySettings.mem));
    updateMemory();
    res.status(200).send("OK");
});

app.get('/metric/mem', function (req, res) {
    res.json(memOptions);
});


// --------------------------------------------------
//  CPU

var cpuOptions = JSON.parse(JSON.stringify(factorySettings.cpu));

var CPU_HOG_SIZE = 10000;
if( typeof process.env.CPU_HOG_SIZE != 'undefined' ) {
    CPU_HOG_SIZE = parseInt(process.env.CPU_HOG_SIZE);
    if(CPU_HOG_SIZE<1000) CPU_HOG_SIZE = 10000;
}
var cpuHogs = [];

function cpuHogBurst(){
    var countTo = CPU_HOG_SIZE;
    var result;
    for( var i=0; i<countTo; i++){
        result = Math.random() * Math.random();
    }
    utils.logLocal("oink");
}

function addCpuHogs(hogs) {
    for( var i=0; i<hogs; i++ ) {
        var cpuInterval = setInterval(cpuHogBurst,1000);
        cpuHogs.push(cpuInterval);    
    }
};

function removeCpuHogs(hogs) {
    for( var i=0; i<hogs; i++ ) {
        var hog = cpuHogs.pop();
        clearInterval(hog);
        delete hog;
    }
};

function updateCpuHogs(){
    var currentCpuHogCount = cpuHogs.length;
    var desiredCpuHogCount = cpuOptions.hogs;
    var diff = desiredCpuHogCount - currentCpuHogCount;
    if( diff >= 0 ) {
        utils.logLocal("Adding cpu hogs: " + diff );
        addCpuHogs(diff);
    } else {
        utils.logLocal("Adding cpu hogs: " + diff );
        removeCpuHogs(-diff);
    }
    utils.logLocal("Current cpu hogs: " + cpuHogs.length );
}

app.put('/metric/cpu', function (req, res) {
    utils.logLocal("PUT /metric/mem " + JSON.stringify(req.body));
    if( req.body.hogs != 'undefined' && req.body.hogs >= 0 ){
        cpuOptions = req.body;
        updateCpuHogs();
        res.status(200).json(cpuOptions);
    } else {
        utils.logLocal("Invalid number of hogs: " + req.body.hogs);
        res.status(400).end("Invalid number of hogs: " + req.body.hogs);
    }
});

app.delete('/metric/cpu', function (req, res) {
    utils.logLocal("DELETE /metric/cpu ");
    memOptions = JSON.parse(JSON.stringify(factorySettings.cpu));
    updateMemory();
    res.status(200).send("OK");
});

app.get('/metric/cpu', function (req, res) {
    res.json(cpuOptions);
});



function resetToFactorySettings(){
    apiResOptions = JSON.parse(JSON.stringify(factorySettings.api));
    memOptions = JSON.parse(JSON.stringify(factorySettings.mem));
    cpuOptions = JSON.parse(JSON.stringify(factorySettings.cpu));
}
exports.resetToFactorySettings = resetToFactorySettings;

// DEBUG

// var prevCpu = process.cpuUsage().user;
// function printCpu(){
//     var curCpu =  process.cpuUsage().user;
//     console.log( curCpu - prevCpu );
//     prevCpu = curCpu;
// }

// setInterval( () => { printCpu(); }, 2000 );