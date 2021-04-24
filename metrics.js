const utils = require('./utils.js');
/*

The metrics this app generates are:

quotes_api_response_duration_seconds:   the response time in seconds of an API call for application service.  Normally
                                        this value is between 0.01 and 2.0 seconds.  A value of greater than 2 seconds typically will 
                                        cause an alert.

quotes_request_duration_seconds_count:  the number of calls that have contributed to the above metric.

quotes_memory_usage_bytes:              the number of bytes memory currently being used.  This value is completely faked

quotes_memory_limit_bytes:              total amount of memory this service has.

quotes_cpu_time_ns:                     the total cpu nano-seconds consumed. This value is completely faked.


*/

// =====================================================================================
const client = require('prom-client');

// --------------------------------------------------
// quotes_request_duration_seconds_sum and quotes_request_duration_seconds_count
// are not generated from scratch.  Each update is due to an actual api request, 
// however the actual response time in seconds might be randmonly padded out.

const resDurationSecondsMetric = new client.Counter({
    name: 'quotes_request_duration_seconds_sum',
    help: 'Response time in seconds of an API call that this application provides'
});

const resDurationCountMetric = new client.Counter({
    name: 'quotes_request_duration_seconds_count',
    help: 'Number of API calls that contribute to this metric'
});

var apiResOptions = {
     "min": 1,
     "max": 20,
     "skew": 1.0
}

function getDelay(){
    // generate a delay in ms, based on current constraints
    return utils.randn_bm(apiResOptions.min, apiResOptions.max, apiResOptions.skew);
}
exports.getDelay = getDelay;

function recordApiResponse(time){
    resDurationSecondsMetric.inc();
    resDurationCountMetric.inc(time);
}
exports.recordApiResponse = recordApiResponse;

app.delete('/metric/apiRes', function(req,res) {
    // this is a reset 
    resDurationSecondsMetric.reset();
    resDurationCountMetric.reset();
    utils.logLocal("Reset quotes_request_duration_seconds_sum and quotes_request_duration_seconds_count.");
    res.status(200).send("OK");
});

app.put('/metric/apiRes', function(req,res) {
    // updte the generated delay in service response time.
    // todo: validation
    apiResOptions = req.body;
    res.status(200).end("OK");
});

app.get('/metric/apiRes', function(req,res) {
    res.json(apiResOptions);
});


// --------------------------------------------------
// quotes_memory_usage_bytes and quotes_memory_usage_bytes

const memUsageMetric = new client.Gauge({
    name: 'quotes_memory_usage_bytes',
    help: 'Current amount of memory in use (simulated)'
});

const memLimitMetric = new client.Gauge({
    name: 'quotes_memory_limit_bytes',
    help: 'Memory limit'
});

const memOptionsFactorySettings = {
    "min": 1 * 1024 * 1024,
    "max": 4 * 1024 * 1024,
    "skew": 1.0,
    "limit": 4.5 * 1024 * 1024
}
var memOptions = JSON.parse(JSON.stringify(memOptionsFactorySettings));

function genMemUsage(){
    // generate a delay in ms, based on current constraints
    var mem = utils.randn_bm(memOptions.min, memOptions.max, memOptions.skew);
    memUsageMetric.set( mem );
    memLimitMetric.set( memOptions.limit) ;
}
setInterval(genMemUsage,1000); // update every second

app.delete('/metric/mem', function(req,res) {
    memOptions = JSON.parse(JSON.stringify(memOptionsFactorySettings));
    utils.logLocal("Reset quotes_memory_usage_bytes and quotes_memory_limit_bytes.");
    res.status(200).send("OK");
});

app.put('/metric/mem', function(req,res) {
    // updte the generated delay in service response time.
    // todo: validation
    memOptions = req.body;
    res.status(200).end("OK");
});

app.get('/metric/mem', function(req,res) {
    res.json(memOptions);
});


// --------------------------------------------------
// quotes_cpu_time

const cpuMetric = new client.Counter({
    name: 'quotes_cpu_time',
    help: 'Current sum of cpu seconds (simulated)'
});

const cpuOptionsFactorySettings = {
    "min": 0.001,
    "max": 0.002,
    "skew": 1.0
}
var cpuOptions = JSON.parse(JSON.stringify(cpuOptionsFactorySettings));

function genCpuUsage(){
    // generate a delay in ms, based on current constraints
    var cpu = utils.randn_bm(cpuOptions.min, cpuOptions.max, cpuOptions.skew);
    cpuMetric.inc( cpu );
}
setInterval(genCpuUsage,1000); // update every second

app.delete('/metric/cpu', function(req,res) {
    cpuOptions = JSON.parse(JSON.stringify(cpuOptionsFactorySettings));
    utils.logLocal("Reset quotes_cpu_time.");
    res.status(200).send("OK");
});

app.put('/metric/cpu', function(req,res) {
    // updte the generated delay in service response time.
    // todo: validation
    cpuOptions = req.body;
    res.status(200).end("OK");
});

app.get('/metric/cpu', function(req,res) {
    res.json(cpuOptions);
});
