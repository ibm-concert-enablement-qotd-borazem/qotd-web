const express = require('express');
const fs = require('fs');
const http = require('http');
const moment = require('moment');
const parseUrl = require("parse-url");

if (process.env.ENABLE_INSTANA == "true") {
    require('@instana/collector')();
}

USE_REQ_TOKEN = true;
if (typeof process.env.USE_REQ_TOKEN != 'undefined') {
    USE_REQ_TOKEN = (process.env.USE_REQ_TOKEN == 'true' || process.env.USE_REQ_TOKEN == 'True');
}

QUOTE_SVC = process.env.QUOTE_SVC;
AUTHOR_SVC = process.env.AUTHOR_SVC;
RATING_SVC = process.env.RATING_SVC;
PDF_SVC = process.env.PDF_SVC;

app = express();
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.set('port', process.env.PORT || 3000);

app.enable('trust proxy');

app.use(express.static(__dirname + '/public'));
app.use(express.json());

//----------------------------------------------------------------------------------------------
// Health

var liveness = {
    "healthy": true
}

app.get('/health', function(req,res){
	if( liveness.healthy ) {
		res.status(200).send("Felling good, thank you.");
	} else {
		res.status(500).send("Not feeling too good, I am afraid.")
	}
});

app.put('/liveness', function(req,res){
    var nHealth = req.body;
	healthy = nHealth;
    utils.logLocal("Health updated to " + healthy );
    res.json(health);
});

app.delete('/liveness', function(req,res){
	health.healthy = true;
    utils.logLocal("Reset health to " + healthy );
    res.json(health);
});


//----------------------------------------------------------------------------------------------
// Main app

// require these AFTER we have defined the express app
const utils = require('./utils.js');
const metrics = require('./metrics.js');
const logger = require('./logger.js');

function newReqToken() {
    if (USE_REQ_TOKEN) {
        return utils.intBetween(100000, 999999)
    } else {
        return "";
    }
}

function updateApiResponseMetric(start) {
    var stop = new Date().getTime();
    var resTime = (stop - start) / 1000;  // convert to seconds
    metrics.recordApiResponse(resTime);
    utils.logLocal('[' + stop + '-' + start + '] Api res time: ' + resTime);
}

function addRating(quote, requestToken) {
    return new Promise((resolve, reject) => {
        utils.log('Getting rating for quote: ' + quote.id, requestToken);
        var parsedUrl = parseUrl(RATING_SVC);
        var hostname = parsedUrl.resource;
        var port = 80;
        if (parsedUrl.port != null) port = parsedUrl.port;    
        const options = {
            "headers": { "Accept": "application/json" },
            "method": 'GET',
            "hostname": hostname,
            "port": port,
            "path": '/ratings/' + quote.id + '?requestToken=' + requestToken
        }

        http.request(options, function (ratingRes) {
            var rawData = [];
            ratingRes.on('data', (chunk) => {
                rawData.push(chunk);
            });
            ratingRes.on('end', () => {
                utils.logLocal(`Rating svc response http://${options.hostname}:${options.port}${options.path}: ${ratingRes.statusCode}`);

                if (ratingRes.statusCode == 200) {
                    utils.log('Got rating for quote: ' + quote.id, requestToken);
                    var buffer = Buffer.concat(rawData).toString();
                    var rating = JSON.parse(buffer);
                    quote.rating = rating.rating;
                    resolve(quote);
                } else {
                    utils.log('Rejecting rating for quote.  Status: ' + ratingRes.statusCode, requestToken);
                    reject(ratingRes.statusCode);
                }
            });
        })
        .on('error', error => {
            utils.log('Rejecting rating for quote. ' + error, requestToken);
            reject(error);
        })
        .end();
    })
    .catch((error) => {
        utils.log(`Rejecting addRating. ${error}`, requestToken);
    });
}

function getDailyQuote(requestToken) {
    return new Promise((resolve, reject) => {

        utils.log('Getting daily quote.', requestToken);
        var parsedUrl = parseUrl(QUOTE_SVC);
        var hostname = parsedUrl.resource;
        var port = 80;
        if (parsedUrl.port != null) port = parsedUrl.port;  
        const options = {
            "headers": { "Accept": "application/json" },
            "method": 'GET',
            "hostname": hostname,
            "port": port,
            "path": '/daily?requestToken=' + requestToken
        }

        http.request(options, function (quoteRes) {
            var rawData = [];
            quoteRes.on('data', (chunk) => {
                rawData.push(chunk);
            });
            quoteRes.on('end', () => {
                utils.logLocal(`Quote svc response http://${options.hostname}:${options.port}${options.path}: ${quoteRes.statusCode}`);

                if (quoteRes.statusCode == 200) {
                    utils.log('Obtained daily quote.', requestToken);
                    var buffer = Buffer.concat(rawData).toString();
                    var quote = JSON.parse(buffer);
                    resolve(quote);
                } else {
                    reject(quoteRes.statusCode);
                }
            });
        })
        .on('error', error => {
            reject(error);
        })
        .end();
    })
    .catch((error) => {
        utils.log(`Rejecting get daily quote. Error: ${error}`, requestToken);
    });
}

function getRandomQuote(requestToken) {
    return new Promise((resolve, reject) => {
        utils.log('Getting random quote.', requestToken);
        var parsedUrl = parseUrl(QUOTE_SVC);
        var hostname = parsedUrl.resource;
        var port = 80;
        if (parsedUrl.port != null) port = parsedUrl.port;  
        const options = {
            "headers": { "Accept": "application/json" },
            "method": 'GET',
            "hostname": hostname,
            "port": port,
            "path": '/random?requestToken=' + requestToken
        }

        http.request(options, function (quoteRes) {
            var rawData = [];
            quoteRes.on('data', (chunk) => {
                rawData.push(chunk);
            });
            quoteRes.on('end', () => {
                utils.logLocal(`Quote svc response: ${quoteRes.statusCode}`);

                if (quoteRes.statusCode == 200) {
                    utils.log('Obtained random quote.', requestToken);
                    var buffer = Buffer.concat(rawData).toString();
                    var rating = JSON.parse(buffer);
                    resolve(rating);
                } else {
                    reject(quoteRes.statusCode);
                }
            });

        })
        .on('error', error => {
            reject(error);
        })
        .end();

    })
    .catch((error) => {
        utils.log(`Rejecting get random quote. Error: ${error}`, requestToken);
    });
}

app.get('/', function (req, res) {
    var start = new Date().getTime();
    var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    var requestToken = newReqToken();
    utils.log('Starting new request token: ' + requestToken + ' for IP: ' + ip);
    var delay = metrics.getDelay();
    utils.logLocal('[' + start + '] Daily quote page being delayed: ' + delay + 'ms');
    utils.log('Web request: /.', requestToken);

    setTimeout(function () {

        getDailyQuote(requestToken)
            .then((quote) => {
                var now = new moment();
                
                quote.today = now.format("dddd, MMMM Do YYYY");
                quote.title = "Quote of the Day";
                addRating(quote, requestToken)
                    .then((quote) => {
                        res.render('home', quote);
                        updateApiResponseMetric(start);
                    })
                    .catch(
                        (err) => {
                            utils.log(" Problem getting rating. Err: " + err, requestToken);
                            // send th epage anyway but with a -1 rating
                            quote.rating = -1;
                            res.render('home', quote);
                            updateApiResponseMetric(start);
                        }
                    );
            })
            .catch(
                (err) => {
                    utils.log("Internal Error.  Problem getting daily quote. Err: " + err, requestToken);
                    res.status(500).send("Problem getting daily quote.");
                    updateApiResponseMetric(start);
                }
            );

    }, delay);

});

app.get('/random', function (req, res) {
    var start = new Date().getTime();
    var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    var requestToken = newReqToken();
    utils.log('Starting new request token: ' + requestToken + ' for IP: ' + ip);
    var delay = metrics.getDelay();
    utils.logLocal('[' + start + '] Random quote page being delayed: ' + delay + 'ms');
    utils.log('Web request: /random .', requestToken);

    setTimeout(function () {

        getRandomQuote(requestToken)
            .then((quote) => {
                quote.today = "";
                quote.title = "Random Quote";
                addRating(quote, requestToken)
                    .then((quote) => {
                        res.render('home', quote);
                        updateApiResponseMetric(start);
                    })
                    .catch(
                        (err) => {
                            utils.log(" Problem getting rating. Err: " + err, requestToken);
                            // send th epage anyway but with a -1 rating
                            quote.rating = -1;
                            res.render('home', quote);
                            updateApiResponseMetric(start);
                        }
                    );
            })
            .catch(
                (err) => {
                    utils.log("Internal Error.  Problem getting random quote. Err: " + err, requestToken);
                    res.status(500).send("Problem getting random quote.");
                    updateApiResponseMetric(start);
                }
            );

    }, delay);

});

app.get('/author/:id', function (req, res) {
    var start = new Date().getTime();
    var id = req.params.id;
    var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    var requestToken = newReqToken();
    utils.log('Starting new request token: ' + requestToken + ' for IP: ' + ip);
    var delay = metrics.getDelay();
    utils.logLocal('[' + start + '] Author bio quote page being delayed: ' + delay + 'ms');
    utils.log('Author bio request: /author/' + id + ' .', requestToken);

    var parsedUrl = parseUrl(AUTHOR_SVC);
    var hostname = parsedUrl.resource;
    var port = 80;
    if (parsedUrl.port != null) port = parsedUrl.port;  
    setTimeout(function () {
        const options = {
            "headers": { "Accept": "application/json" },
            "method": 'GET',
            "hostname": hostname,
            "port": port,
            "path": '/authors/' + id + '?requestToken=' + requestToken
        }

        http.request(options, function (bioReq) {
            var rawData = [];
            bioReq.on('data', (chunk) => {
                rawData.push(chunk);
            });
            bioReq.on('end', () => {
                utils.logLocal(`Quote svc response: ${bioReq.statusCode}`);

                if (bioReq.statusCode == 200) {
                    utils.log("Author bio received.  Author id: " + id, requestToken);
                    var buffer = Buffer.concat(rawData).toString();
                    var bio = JSON.parse(buffer);
                    res.render('author', bio);
                    updateApiResponseMetric(start);
                } else {
                    var quote = {
                        "title": "QotD Error",
                        "today": "",
                        "quote": bioReq.statusCode, // todo: get error msg
                        "author": "",
                        "genre": ""
                    };
                    utils.log("Problem getting author bio. Service Status Code: " + bioReq.statusCode, requestToken);
                    res.status(500).send("Problem getting author bio.");
                    updateApiResponseMetric(start);
                }
            });
        })
        .on('error', error => {
            res.status(500).send("Problem getting author bio.");
            utils.log("Problem getting author bio.  " + error, requestToken);
            updateApiResponseMetric(start);
        })
        .end();

    }, delay);
});

app.get('/images/:id',
    function (req, res) {
        var start = new Date().getTime();
        var requestToken = newReqToken();
        var delay = metrics.getDelay();
        var id = req.params.id;
        var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
        utils.log('Starting new request token: ' + requestToken + ' for IP: ' + ip);
        utils.log("Author image request id: " + id, requestToken);
        utils.logLocal('[' + start + '] Service being delayed: ' + delay + 'ms');

        var parsedUrl = parseUrl(AUTHOR_SVC);
        var hostname = parsedUrl.resource;
        var port = 80;
        if (parsedUrl.port != null) port = parsedUrl.port;  
        setTimeout(function () {
            const options = {
                "headers": { "Accept": "image/jpeg" },
                "method": 'GET',
                "hostname": hostname,
                "port": port,
                "path": '/images/' + id + '?requestToken=' + requestToken
            }

            http.request(options, function (imgRes) {
                var rawData = [];

                imgRes.on('data', (chunk) => {
                    rawData.push(chunk);
                });

                imgRes.on('end', () => {
                    utils.logLocal(`Image svc response: ${imgRes.statusCode}`);

                    if (imgRes.statusCode == 200) {
                        var buffer = Buffer.concat(rawData);
                        res.writeHead(200, {
                            'Content-Type': 'image/jpeg',
                            'Content-Length': buffer.length
                        });
                        res.end(Buffer.from(buffer, 'binary'));
                        updateApiResponseMetric(start);
                        utils.log("Author image provided.", requestToken);
                    } else {
                        // assume any error will report a 404
                        // TOTO: If image not there use default portrait 
                        utils.log("Image " + id + " not found. Using default image.", requestToken);
                        var defImage = fs.readFileSync('./public/images/generic.png');
                        res.writeHead(200, {
                            'Content-Type': 'image/jpeg',
                            'Content-Length': defImage.length
                        });
                        res.end(Buffer.from(defImage, 'binary'));
                        updateApiResponseMetric(start);
                    }
                });
            })
                .on('error', error => {
                    utils.log("Problem getting image " + id + " Error: " + error, requestToken);
                    res.status(500).send("Image " + id + " not found");
                    updateApiResponseMetric(start);
                })
                .end();


        }, delay);
    }
);

app.get('/pdf/:id',
    function (req, res) {
        var start = new Date().getTime();
        var requestToken = newReqToken();
        var delay = metrics.getDelay();
        var id = req.params.id;
        utils.log("PDF request for quote id: " + id, requestToken);
        utils.logLocal('[' + start + '] Service being delayed: ' + delay + 'ms');

        var parsedUrl = parseUrl(PDF_SVC);
        var hostname = parsedUrl.resource;
        var port = 80;
        if (parsedUrl.port != null) port = parsedUrl.port;  
        setTimeout(function () {
            const options = {
                "headers": { "Accept": "application/pdf" },
                "method": 'GET',
                "hostname": hostname,
                "port": port,
                "path": '/pdf/' + id + '?requestToken=' + requestToken
            }

            http.request(options, function (pdfRes) {
                var rawData = [];

                pdfRes.on('data', (chunk) => {
                    rawData.push(chunk);
                });

                pdfRes.on('end', () => {
                    utils.logLocal(`Image svc response: ${pdfRes.statusCode}`);

                    if (pdfRes.statusCode == 200) {
                        utils.log("PDF received.", requestToken);
                        var buffer = Buffer.concat(rawData);
                        res.writeHead(200, {
                            'Content-Type': 'application/pdf',
                            'Content-Length': buffer.length
                        });
                        res.end(Buffer.from(buffer, 'binary'));
                        utils.log("PDF image sent.", requestToken);
                        updateApiResponseMetric(start);
                    } else {
                        // assume any error will report a 404
                        utils.log("PDF " + id + " not found.", requestToken);
                        res.status(404).send("PDF " + id + " not found");
                        updateApiResponseMetric(start);
                    }
                });
            })
                .on('error', error => {
                    utils.log("Attempt to get PDF " + id + " unsuccessful. Error: " + error, requestToken);
                    res.status(500).send("PDF " + id + " Error: " + error);
                    updateApiResponseMetric(start);
                })
                .end();

        }, delay);
    }
);


//----------------------------------------------------------------------------------------------
// Logging

app.post('/logger',
    function (req, res) {
        var logTemplate = req.body;

        if( typeof logTemplate.repeat == 'undefined' ) {
            // one time log
            var log = logger.genLog(logTemplate);
            utils.log(log);
        } else {
            logger.addLogger(logTemplate);
        }
        res.status(200).send("OK");
    }
);

app.delete('/logger/:id',
    function (req, res) {
        var id = req.params.id;
        logger.removeLogger(id);
        utils.logLocal( "DELETE Logger id: " + id  ); 
        res.status(200).send("OK");
    }
);

//----------------------------------------------------------------------------------------------
// Main App

app.get('/version',
    function (req, res) {
        console.log('/version');
        res.send(`${appName} v${appVersion}, build: ${buildInfo}.`);
    }
);

app.post('/reset', function(req,res){
    metrics.resetToFactorySettings();
    logger.resetToFactorySettings();
    res.send("OK");
});

const package = require('./package.json');
const appName = package.name;
const appVersion = package.version;
const buildInfo = fs.readFileSync('build.txt');

var service = app.listen(app.get('port'), '0.0.0.0', function () {
    console.log(`Starting ${appName} v${appVersion}, ${buildInfo} on port ${app.get('port')}`);
});

//----------------------------------------------------------------------------------------------
// Service Actions

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

function startService() {
    service = app.listen(app.get('port'), '0.0.0.0', function () {
        utils.logLocal(`Starting ${appName} v${appVersion}, ${buildInfo} on port ${app.get('port')}`);
    });
}

function getPostData(req) {
	return new Promise((resolve, reject) => {
		try {
			let body = '';
			req.on('data', (chunk) => {
				body += chunk.toString();
			});
			req.on('end', () => {
				resolve(body);
			});
		} catch (error) {
			reject(error);
		}
	});
}

const svcActionPort = ( process.env.SVC_ACTIONS_PORT || 8080 );

http.createServer(async function (req, res) {
    if (req.method == "POST") {
        var data = await getPostData(req);
        var obj = JSON.parse(data);
        utils.log(`Service action: ${obj.action}`);
        switch( obj.action ){
            case 'crash': {
                crash();
                break;
            }
            case 'start': {
                if( !service.listening ) startService();
                break;
            }
            case 'stop': {
                if( service.listening ) service.close();
                break;
            }
        }
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.write('OK');
    } else {
        utils.log(`Service action method: ${req.method}`);
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.write('Unknown request');
    }
    res.end();
}).listen(svcActionPort);
console.log(`Listening for service actions on ${svcActionPort}`);
