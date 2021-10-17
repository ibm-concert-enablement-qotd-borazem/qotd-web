
var localLogging = false;
if( typeof process.env.LOCAL_LOGGING != 'undefined' ){
    localLogging = ( process.env.LOCAL_LOGGING == 'true' || process.env.LOCAL_LOGGING == 'True' );
}

function intBetween(min, max) {  
    // between x and y exclusive
    return Math.floor(
      Math.random() * (max - min) + min
    )
}
exports.intBetween = intBetween;

function floatBetween(min, max) {  
    // between x and y exclusive
    Math.random() * (max - min) + min
}
exports.floatBetween = floatBetween;


function pick(optionsArray){
    var len = optionsArray.length;
    var i = intBetween(0,len);
    return optionsArray[i];
}

exports.pick = pick;

function pickWeighted(options){
    var optionsArray = [];
    for( const option of options ){
        var weight = option.weight;
        for(var j=0;j<weight;j++){
            optionsArray.push(option.value);
        }
    }
    return pick(optionsArray);
}

exports.pickWeighted = pickWeighted;

function log(msg,token){
    var record = msg;
    if( typeof token != 'undefined' && token != ''){
        record = '['+token+'] ' + record;
    }
    console.log(record);
}

exports.log = log;

function logLocal(msg){
    if( localLogging ) {
        console.log('[LOCAL] ' + msg );
    }
}

exports.logLocal = logLocal;

// see: https://stackoverflow.com/questions/25582882/javascript-math-random-normal-distribution-gaussian-bell-curve/36481059#36481059
function nextBoxMuller(){
    let u = 0, v = 0;
    while(u === 0) u = Math.random(); //Converting [0,1) to (0,1)
    while(v === 0) v = Math.random();
    let num = Math.sqrt( -2.0 * Math.log( u ) ) * Math.cos( 2.0 * Math.PI * v );
    num = num / 10.0; // Translate to 0 -> 1
    if (num > 0.5 || num < -0.5) return nextBoxMuller() // resample between 0 and 1 
    return num;   
}

// convert the normal random value from BM to one with 
// the given mean and stdev.  Also if a min and max are 
// supplied, throw out any values out side this range.
function genNormal(mean, stdev, min, max){
    if( typeof std == 'undefined' ) return mean;

    var num = nextBoxMuller() * stdev + mean;
    if( typeof min != 'undefined' && typeof max != 'undefined' ) {
        while( min >= num && num >= max ) {
            num = genNormal(mean, stdev, min, max);    
        }
    } else if( typeof min != 'undefined' ) {
        while( min >= num ) {
            num = genNormal(mean, stdev, min, max);    
        }
    } else if( typeof max != 'undefined' ) {
        while( num >= max ) {
            num = genNormal(mean, stdev, min, max);    
        }
    }
    return num;
}
exports.genNormal = genNormal;


function genNormalInt(mean, stdev, min, max){
    return Math.floor(genNormal(mean,stdev,min, max));
}
exports.genNormalInt = genNormalInt;


function replaceAll(key, value, string) {
    const field = "{{" + key + "}}";
    const replacer = new RegExp(field, 'g');
    return string.replace(replacer, value);
}

exports.replaceAll = replaceAll;


function formatTime(timeInMs) {
    if( 1000 <= timeInMs && timeInMs < 60000 ) {
        var val = timeInMs/1000;
        return val.toFixed(2) + ' sec';
    } else if( 60000 <= timeInMs && timeInMs < 60*60*1000 ) {
        var val = timeInMs/60000;
        return val.toFixed(2) + ' min';
    } else if( 60*60*1000 <= timeInMs ){
        var val = timeInMs/(60*60*1000);
        return val.toFixed(2) + ' hr';
    }
    
    return timeInMs +'ms';
}
exports.formatTime = formatTime;