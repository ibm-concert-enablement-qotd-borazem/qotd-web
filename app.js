const express = require('express');
const fs = require('fs');
const http = require('http');
const moment = require('moment');
const promMid = require('express-prometheus-middleware');
const { v4: uuidv4 } = require('uuid');

if( process.env.ENABLE_INSTANA ) {
    require('@instana/collector')();
}

var QUOTE_SVC_HOST = 'localhost';
if( process.env.QUOTE_SVC_HOST ) {
    // override for iamge service url
    QUOTE_SVC_HOST = process.env.QUOTE_SVC_HOST;
}

var QUOTE_SVC_PORT = 3001;
if( process.env.QUOTE_SVC_PORT ) {
    // override for iamge service url
    QUOTE_SVC_PORT = parseInt(process.env.QUOTE_SVC_PORT);
}

var AUTHOR_SVC_HOST = 'localhost';
if( process.env.AUTHOR_SVC_HOST ) {
    // override for iamge service url
    AUTHOR_SVC_HOST = process.env.AUTHOR_SVC_HOST;
}

var AUTHOR_SVC_PORT = 3002;
if( process.env.AUTHOR_SVC_PORT ) {
    // override for iamge service url
    AUTHOR_SVC_PORT = parseInt(process.env.AUTHOR_SVC_PORT);
}

var RATING_SVC_HOST = 'localhost';
if( process.env.RATING_SVC_HOST ) {
    // override for iamge service url
    RATING_SVC_HOST = process.env.RATING_SVC_HOST;
}

var RATING_SVC_PORT = 3004;
if( process.env.RATING_SVC_PORT ) {
    // override for iamge service url
    RATING_SVC_PORT = parseInt(process.env.RATING_SVC_PORT);
}

var PDF_SVC_HOST = 'localhost';
if( process.env.PDF_SVC_HOST ) {
    // override for iamge service url
    PDF_SVC_HOST = process.env.PDF_SVC_HOST;
}

var PDF_SVC_PORT = 3005;
if( process.env.PDF_SVC_PORT ) {
    // override for iamge service url
    PDF_SVC_PORT = parseInt(process.env.PDF_SVC_PORT);
}
app = express();
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.set('port', process.env.PORT || 3000);

app.enable('trust proxy'); 

app.use(express.static(__dirname + '/public'));
app.use(express.urlencoded({
    extended: true
}));
app.use(express.json());
app.use(promMid({
    metricsPath: '/metrics',
    collectDefaultMetrics: true,
    requestDurationBuckets: [0.1, 0.5, 1, 1.5],
    /**
     * Can add custom labels with customLabels and transformLabels options
     */
    customLabels: ['contentType'],
    transformLabels(labels, req) {
      // eslint-disable-next-line no-param-reassign
      labels.contentType = req.headers['content-type'];
    }
}));

// require these AFTER we have defined the express app
const utils = require('./utils.js');
const metrics = require('./metrics.js');

function updateApiResponseMetric(start){
    var stop = new Date().getTime();
    var resTime = stop - start;
    metrics.recordApiResponse( resTime );
    utils.logLocal( '[' + stop + '] Api res time: ' + resTime);
}

function addRating(quote,requestToken){
    return new Promise( (resolve,reject) => {
        try{
            const options = {
                "headers": { "Accept": "application/json"} ,
                "method": 'GET',
                "hostname": RATING_SVC_HOST,
                "port": RATING_SVC_PORT,
                "path": '/ratings/'+quote.id+'?requestToken='+requestToken
            }
            
            var ratingReq = http.request(options, function( ratingRes ) {
                var rawData = [];
                ratingRes.on('data', (chunk) => {
                    rawData.push(chunk);
                });
                ratingRes.on('end', () => {
                    utils.logLocal(`Quote svc response: ${ratingRes.statusCode}`);
    
                    if( ratingRes.statusCode == 200 ) {
                        var buffer = Buffer.concat(rawData).toString();
                        var rating = JSON.parse(buffer);
                        quote.rating = rating.rating;
                        resolve(quote);
                    } else {
                        reject(ratingRes.statusCode);
                    }
                });
    
                ratingRes.on('error', error => {
                    reject(error);
                });
       
            });
    
            ratingReq.end();     
    
        } catch( err ) {
            utils.log("Problem getting daily quote.  Request token: " + requestToken);
            reject(err);
        }
    });
}

function getDailyQuote(requestToken){
    return new Promise( (resolve,reject) => {
        try{
            const options = {
                "headers": { "Accept": "application/json"} ,
                "method": 'GET',
                "hostname": QUOTE_SVC_HOST,
                "port": QUOTE_SVC_PORT,
                "path": '/daily?requestToken='+requestToken
            }
            
            var quoteReq = http.request(options, function( quoteRes ) {
                var rawData = [];
                quoteRes.on('data', (chunk) => {
                    rawData.push(chunk);
                });
                quoteRes.on('end', () => {
                    utils.logLocal(`Quote svc response: ${quoteRes.statusCode}`);
    
                    if( quoteRes.statusCode == 200 ) {
                        var buffer = Buffer.concat(rawData).toString();
                        var rating = JSON.parse(buffer);
                        resolve(rating);
                    } else {
                        reject(quoteRes.statusCode);
                    }
                });
    
                quoteRes.on('error', error => {
                    reject(error);
                });
       
            });
    
            quoteReq.end();     
    
        } catch( err ) {
            utils.log("Problem getting daily quote.  Request token: " + requestToken);
            reject(err);
        }

    });
}

function getRandomQuote(requestToken){
    return new Promise( (resolve,reject) => {
        try{
            const options = {
                "headers": { "Accept": "application/json"} ,
                "method": 'GET',
                "hostname": QUOTE_SVC_HOST,
                "port": QUOTE_SVC_PORT,
                "path": '/random?requestToken='+requestToken
            }
            
            var quoteReq = http.request(options, function( quoteRes ) {
                var rawData = [];
                quoteRes.on('data', (chunk) => {
                    rawData.push(chunk);
                });
                quoteRes.on('end', () => {
                    utils.logLocal(`Quote svc response: ${quoteRes.statusCode}`);
    
                    if( quoteRes.statusCode == 200 ) {
                        var buffer = Buffer.concat(rawData).toString();
                        var rating = JSON.parse(buffer);
                        resolve(rating);
                    } else {
                        reject(quoteRes.statusCode);
                    }
                });
    
                quoteRes.on('error', error => {
                    reject(error);
                });
       
            });
    
            quoteReq.end();     
    
        } catch( err ) {
            utils.log("Problem getting daily quote.  Request token: " + requestToken);
            reject(err);
        }

    });
}

app.get('/', function(req,res) {
    var start = new Date().getTime();        
    var requestToken = uuidv4();
    var delay = metrics.getDelay();
    utils.logLocal( '[' + start + '] Daily quote page being delayed: ' + delay + 'ms');
    utils.log('Web request: /.');

    setTimeout( function() {
        
        try{
            getDailyQuote()
            .then( (quote) => {
                addRating(quote)
                .then( (quote) => {
                    var now = new moment();
                    quote.today = now.format("dddd, MMMM Do YYYY");
                    quote.title = "Quote of the Day";
                    res.render('home', quote);
                });
            })

        } catch( err ) {
            utils.log("Problem getting daily quote.  Request token: " + requestToken);
            res.status(500).send("Problem getting daily quote.");
        }
    }, delay); 

});

app.get('/random', function(req,res) {
    var start = new Date().getTime();        
    var requestToken = uuidv4();
    var delay = metrics.getDelay();
    utils.logLocal( '[' + start + '] Random quote page being delayed: ' + delay + 'ms');
    utils.log('Web request: /random .');

    setTimeout( function() {
        
        try{
            getRandomQuote()
            .then( (quote) => {
                addRating(quote)
                .then( (quote) => {
                    quote.today = "";
                    quote.title = "Random Quote";
                    res.render('home', quote);
                });
            })

        } catch( err ) {
            utils.log("Problem getting random quote.  Request token: " + requestToken);
            res.status(500).send("Problem getting random quote.");
        }
    }, delay); 

});


app.get('/author/:id', function(req,res) {
    var id = req.params.id;
    var start = new Date().getTime();        
    var requestToken = uuidv4();
    var delay = metrics.getDelay();
    utils.logLocal( '[' + start + '] Author bio quote page being delayed: ' + delay + 'ms');
    utils.log('Author bio request: /author/'+id+' .');

    setTimeout( function() {
        try{
            const options = {
                "headers": { "Accept": "application/json"} ,
                "method": 'GET',
                "hostname": AUTHOR_SVC_HOST,
                "port": AUTHOR_SVC_PORT,
                "path": '/authors/'+id+'?requestToken='+requestToken
            }
            
            var bioReq = http.request(options, function( bioReq ) {
                var rawData = [];
                bioReq.on('data', (chunk) => {
                    rawData.push(chunk);
                });
                bioReq.on('end', () => {
                    utils.logLocal(`Quote svc response: ${bioReq.statusCode}`);

                    if( bioReq.statusCode == 200 ) {
                        var buffer = Buffer.concat(rawData).toString();
                        var bio = JSON.parse(buffer);
                        res.render('author', bio);
                        updateApiResponseMetric(start);
                        utils.log("Random quote provided. Request token: " + requestToken);
                    } else {
                        var quote = {
                            "title": "QOD Error",
                            "today": "",
                            "quote": bioReq.statusCode, // todo: get error msg
                            "author": "",
                            "genre": ""
                        };
                        utils.log(error);
                        res.render('home', quote);
                    }
                });

                bioReq.on('error', error => {
                    updateApiResponseMetric(start);
                    utils.log(error);
                    utils.logLocal(error);
                });
       
            });

            bioReq.end();     

        } catch( err ) {
            utils.log("Problem getting daily quote.  Request token: " + requestToken);
            res.status(500).send("Problem getting daily quote.");
        }
    }, delay); 
});


app.get('/images/:id',
    function (req, res) {
        var start = new Date().getTime();

        var delay = metrics.getDelay();

        var requestToken = req.query.token;
        var id = req.params.id;
        utils.log("Author image request id: " + id + " Request token: " + requestToken );
        utils.logLocal( '[' + start + '] Service being delayed: ' + delay + 'ms');

        setTimeout( function() {
            try{
                
                const options = {
                    "headers": { "Accept": "image/jpeg"} ,
                    "method": 'GET',
                    "hostname": AUTHOR_SVC_HOST,
                    "port": AUTHOR_SVC_PORT,
                    "path": '/images/'+id+'?requestToken='+requestToken
                }
                
                var imgReq = http.request(options, function( imgRes ) {
                    var rawData = [];

                    imgRes.on('data', (chunk) => {
                        rawData.push(chunk);
                    });

                    imgRes.on('end', () => {
                        utils.logLocal(`Image svc response: ${imgRes.statusCode}`);

                        if( imgRes.statusCode == 200 ) {
                            var buffer = Buffer.concat(rawData);
                            res.writeHead(200, {
                                'Content-Type': 'image/jpeg',
                                'Content-Length': buffer.length
                            });
                            res.end(Buffer.from(buffer, 'binary'));
                            updateApiResponseMetric(start);
                            utils.log("Author image provided. Request token: " + requestToken);
                        } else {
                            // assume any error will report a 404
                            utils.log("Image " + id + " not found. Request token: " + requestToken);
                            res.status(404).send("Image " + id + " not found");
                        }
                    });

                    imgRes.on('error', error => {
                        updateApiResponseMetric(start);
                        utils.log(error);
                        utils.logLocal(error);
                    });
           
                });

                imgReq.end();     

            } catch( err ) {
                utils.log("Problem getting image " + id + ". Request token: " + requestToken);
                res.status(500).send("Image " + id + " not found");
            }
        }, delay); 
    }
);

app.get('/pdf/:id',
    function (req, res) {
        var start = new Date().getTime();

        var delay = metrics.getDelay();

        var requestToken = req.query.token;
        var id = req.params.id;
        utils.log("PDF request id: " + id + " Request token: " + requestToken );
        utils.logLocal( '[' + start + '] Service being delayed: ' + delay + 'ms');

        setTimeout( function() {
            try{
                
                const options = {
                    "headers": { "Accept": "application/pdf"} ,
                    "method": 'GET',
                    "hostname": PDF_SVC_HOST,
                    "port": PDF_SVC_PORT,
                    "path": '/pdf/'+id+'?requestToken='+requestToken
                }
                
                var pdfRes = http.request(options, function( pdfRes ) {
                    var rawData = [];

                    pdfRes.on('data', (chunk) => {
                        rawData.push(chunk);
                    });

                    pdfRes.on('end', () => {
                        utils.logLocal(`Image svc response: ${pdfRes.statusCode}`);

                        if( pdfRes.statusCode == 200 ) {
                            var buffer = Buffer.concat(rawData);
                            res.writeHead(200, {
                                'Content-Type': 'application/pdf',
                                'Content-Length': buffer.length
                            });
                            res.end(Buffer.from(buffer, 'binary'));
                            updateApiResponseMetric(start);
                            utils.log("PDF image provided. Request token: " + requestToken);
                        } else {
                            // assume any error will report a 404
                            utils.log("PDF " + id + " not found. Request token: " + requestToken);
                            res.status(404).send("PDF " + id + " not found");
                        }
                    });

                    pdfRes.on('error', error => {
                        updateApiResponseMetric(start);
                        utils.log(error);
                        utils.logLocal(error);
                    });
           
                });

                pdfRes.end();     

            } catch( err ) {
                utils.log("Problem getting PDF " + id + ". Request token: " + requestToken);
                res.status(500).send("PDF " + id + " not found");
            }
        }, delay); 
    }
);

const package = require('./package.json');
const appName = package.name;
const appVersion = package.version;
const buildInfo = fs.readFileSync('build.txt');

app.listen(app.get('port'), '0.0.0.0', function () {
    console.log(`Starting ${appName} v${appVersion}, build: ${buildInfo} on port ${app.get('port')}`);
});



	