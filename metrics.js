const utils = require('./utils.js');
/*

The metrics this app generates are:

qotd_web_api_response_duration_seconds:   the response time in seconds of an API call for application service.  Normally
                                        this value is between 0.01 and 2.0 seconds.  A value of greater than 2 seconds typically will 
                                        cause an alert.

qotd_web_request_duration_seconds_count:  the number of calls that have contributed to the above metric.

qotd_web_memory_usage_bytes:              the number of bytes memory currently being used.  This value is completely faked

qotd_web_memory_limit_bytes:              total amount of memory this service has.

qotd_web_cpu_time_ns:                     the total cpu nano-seconds consumed. This value is completely faked.


*/

const factorySettings = require('./data/factory_settings.json');


// =====================================================================================
const client = require('prom-client');

// --------------------------------------------------
// qotd_web_request_duration_seconds_sum and qotd_web_request_duration_seconds_count
// are not generated from scratch.  Each update is due to an actual api request, 
// however the actual response time in seconds might be randmonly padded out.

const resDurationSecondsMetric = new client.Counter({
    name: 'qotd_web_request_duration_seconds_sum',
    help: 'Response time in seconds of an API call that this application provides'
});

const resDurationCountMetric = new client.Counter({
    name: 'qotd_web_request_duration_seconds_count',
    help: 'Number of API calls that contribute to this metric'
});

var apiResOptions = JSON.parse(JSON.stringify(factorySettings.api));

function getDelay() {
    var mean = apiResOptions.mean;
    var stdev = apiResOptions.stdev;
    var min = apiResOptions.min;
    var max = apiResOptions.max;
    return utils.genNormalInt(mean, stdev, min, max);
}
exports.getDelay = getDelay;

function recordApiResponse(time) {
    resDurationCountMetric.inc();
    resDurationSecondsMetric.inc(time);
}
exports.recordApiResponse = recordApiResponse;

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
// qotd_web_memory_usage_bytes and qotd_web_memory_usage_bytes

const memUsageMetric = new client.Gauge({
    name: 'qotd_web_memory_usage_bytes',
    help: 'Current amount of memory in use (simulated)'
});

const memLimitMetric = new client.Gauge({
    name: 'qotd_web_memory_limit_bytes',
    help: 'Memory limit'
});

var memOptions = JSON.parse(JSON.stringify(factorySettings.mem));

function genMemUsage() {
    var mean = memOptions.mean;
    var stdev = memOptions.stdev;
    var min = memOptions.min;
    var max = memOptions.max;
    var mem = utils.genNormalInt(mean, stdev, min, max);
    memUsageMetric.set(mem);
    memLimitMetric.set(max);
}
setInterval(genMemUsage, 1000); // update every second

app.delete('/metric/mem', function (req, res) {
    memOptions = JSON.parse(JSON.stringify(factorySettings.mem));
    utils.logLocal("DELETE /metric/mem ");
    res.status(200).send("OK");
});

var memRampInterval;

function updateMemOptions(slope, target) {
    utils.logLocal("ramping mem: " + memOptions.mean + " -> " + target  + ". Slope: " + slope);
    memOptions.mean += slope;
    if( memOptions.mean >= target ) {
        memOptions.mean = target;
        clearInterval(memRampInterval);
        memRampInterval = null;
    }
}

app.put('/metric/mem', function (req, res) {
    // todo: validation
    utils.logLocal("PUT /metric/mem " + JSON.stringify(req.body));
    var ramp = req.query.ramp;
    if( typeof ramp == 'undefined' ) {
        if( memRampInterval ) {
            clearInterval(memRampInterval);
            memRampInterval = null;
        }
        memOptions = req.body;
    } else {
        // incrementaly change the mean (up or down) over the 
        var currentMean = memOptions.mean;
        var targetMean = req.body.mean;
        var overPeriodOfTime = ramp/1000; //convert to seconds
        var slope = (targetMean - currentMean) / overPeriodOfTime;
        var period = 1000; // change every 1s - roughtly corresponds to polling period
        req.body.mean = currentMean;
        memOptions = req.body;
        memRampInterval = setInterval(updateMemOptions, period, slope, targetMean);
    }
    res.status(200).end("OK");
});

app.get('/metric/mem', function (req, res) {
    res.json(memOptions);
});


// --------------------------------------------------
// qotd_web_cpu_time

const cpuTotalMetric = new client.Counter({
    name: 'qotd_web_cpu_seconds_total',
    help: 'Current sum of cpu seconds (simulated)'
});

const cpuUserMetric = new client.Counter({
    name: 'qotd_web_cpu_user_seconds_total',
    help: 'Current sum of cpu seconds (simulated)'
});

const cpuIdleMetric = new client.Counter({
    name: 'qotd_web_cpu_idle_seconds_total',
    help: 'Current sum of idle cpu seconds (simulated)'
});

var cpuOptions = JSON.parse(JSON.stringify(factorySettings.cpu));

function genCpuUsage() {
    // generate a delay in ms, based on current constraints
    var mean = cpuOptions.mean;
    var stdev = cpuOptions.stdev;
    var min = cpuOptions.min;
    var max = cpuOptions.max;
    var cpu = utils.genNormal(mean, stdev, min, max);
    cpuUserMetric.inc(cpu);
    cpuIdleMetric.inc(1 - cpu);
    cpuTotalMetric.inc(1); // the total is user + idle (since these are only two we have just do this simple calculation)
}
setInterval(genCpuUsage, 1000); // update every second - this correlates with cpu options limit and total metric calculation above


app.delete('/metric/cpu', function (req, res) {
    utils.logLocal("DELETE /metric/cpu ");
    cpuOptions = JSON.parse(JSON.stringify(factorySettings.cpu));
    res.status(200).send("OK");
});

var cpuRampInterval;

function updateCpuOptions(slope, target) {
    utils.logLocal("ramping cpu: " + cpuOptions.mean + " -> " + target  + ". Slope: " + slope);
    cpuOptions.mean += slope;
    if( cpuOptions.mean >= target ) {
        cpuOptions.mean = target;
        clearInterval(cpuRampInterval);
        cpuRampInterval = null;
    }
}

app.put('/metric/cpu', function (req, res) {
    // todo: validation
    utils.logLocal("PUT /metric/cpu " + JSON.stringify(req.body));
    var ramp = req.query.ramp;
    if( typeof ramp == 'undefined' ) {
        if( cpuRampInterval ) {
            clearInterval(cpuRampInterval);
            cpuRampInterval = null;
        }
        cpuOptions = req.body;
    } else {
        // incrementaly change the mean (up or down) over the 
        var currentMean = cpuOptions.mean;
        var targetMean = req.body.mean;
        var overPeriodOfTime = ramp/1000; //convert to seconds
        var slope = (targetMean - currentMean) / overPeriodOfTime;
        var period = 1000; // change every 1s - roughtly corresponds to polling period
        req.body.mean = currentMean;
        cpuOptions = req.body;
        cpuRampInterval = setInterval(updateCpuOptions, period, slope, targetMean);
    }
    res.status(200).end("OK");
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

