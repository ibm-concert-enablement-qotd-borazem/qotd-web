const moment = require('moment');

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
    return optionsArray[i].value;
}

exports.pick = pick;

function pickWeighted(options){
    var optionsArray = [];
    for( const option of options ){
        var weight = option.weight;
        for(var j=0;j<weight;j++){
            optionsArray.push(option);
        }
    }
    return pick(optionsArray);
}

exports.pickWeighted = pickWeighted;

function log(msg, token){
    if( typeof token == 'undefined' || token == "") {
        console.log(msg);
    } else {
        console.log(`[${token}] ${msg}`);
    }
}

exports.log = log;

function logLocal(msg){
    if( localLogging ) {
        var ts = new moment().toISOString();
        console.log('[Log Generator] ' + ts + ' "' + msg + '"');
    }
}

exports.logLocal = logLocal;

// see: https://stackoverflow.com/questions/25582882/javascript-math-random-normal-distribution-gaussian-bell-curve/36481059#36481059
function randn_bm(min, max, skew) {
    let u = 0, v = 0;
    while(u === 0) u = Math.random(); //Converting [0,1) to (0,1)
    while(v === 0) v = Math.random();
    let num = Math.sqrt( -2.0 * Math.log( u ) ) * Math.cos( 2.0 * Math.PI * v );

    num = num / 10.0 + 0.5; // Translate to 0 -> 1
    if (num > 1 || num < 0) num = randn_bm(min, max, skew); // resample between 0 and 1 if out of range
    num = Math.pow(num, skew); // Skew
    num *= max - min; // Stretch to fill range
    num += min; // offset to min
    return num;
}

exports.randn_bm = randn_bm;


