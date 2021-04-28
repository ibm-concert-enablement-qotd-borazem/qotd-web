const utils = require('./utils.js');
/*

The metrics this app generates are:

qotd_web_api_response_duration_seconds:     the response time in seconds of an API call for application service.  Normally
                                            this value is between 0.01 and 2.0 seconds.  A value of greater than 2 seconds typically will 
                                            cause an alert.

qotd_web_request_duration_seconds_count:    the number of calls that have contributed to the above metric.

qotd_web_memory_usage_bytes:                the number of bytes memory currently being used.  This value is completely faked

qotd_web_memory_limit_bytes:                total amount of memory this service has.

qotd_web_cpu_time_ns:                       the total cpu nano-seconds consumed. This value is completely faked.


*/

// get factory default settings

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

function getDelay(){
    // generate a delay in ms, based on current constraints
    return utils.randn_bm(apiResOptions.min, apiResOptions.max, apiResOptions.skew);
}
exports.getDelay = getDelay;

function recordApiResponse(time){
    resDurationCountMetric.inc();
    resDurationSecondsMetric.inc(time);
}
exports.recordApiResponse = recordApiResponse;

app.delete('/metric/apiRes', function(req,res) {
    apiResOptions = JSON.parse(JSON.stringify(factorySettings.api));
    utils.logLocal("Reset qotd_web_request_duration_seconds_sum and qotd_web_request_duration_seconds_count.");
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

function genMemUsage(){
    // generate a delay in ms, based on current constraints
    var mem = utils.randn_bm(memOptions.min, memOptions.max, memOptions.skew);
    if( mem > memOptions.limit ) mem = memOptions.limit;
    memUsageMetric.set( mem );
    memLimitMetric.set( memOptions.limit) ;
}
setInterval(genMemUsage,1000); // update every second

app.delete('/metric/mem', function(req,res) {
    memOptions = JSON.parse(JSON.stringify(factorySettings.mem));
    utils.logLocal("Reset qotd_web_memory_usage_bytes and qotd_web_memory_limit_bytes.");
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

function genCpuUsage(){
    // generate a delay in ms, based on current constraints
    var cpu = utils.randn_bm(cpuOptions.min, cpuOptions.max, cpuOptions.skew);
    if( cpu > 1 ) cpu = 1;  // 100% usage
    cpuUserMetric.inc( cpu );
    cpuIdleMetric.inc( 1-cpu );
    cpuTotalMetric.inc(1); // the total is user + idle (since these are only two we have just do this simple calculation)
}
setInterval(genCpuUsage,1000); // update every second - this correlates with cpu options limit and total metric calculation above

app.delete('/metric/cpu', function(req,res) {
    cpuOptions = JSON.parse(JSON.stringify(cpuOptionsFactorySettings));
    utils.logLocal("Reset qotd_web_cpu_time.");
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
