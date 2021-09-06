require('dotenv').config();
if (process.env.ENABLE_INSTANA == "true") {
    require('@instana/collector')({autoProfile: true});
}

// Instana web app token
const INSTANA_REPORTING_URL = process.env.INSTANA_REPORTING_URL;
const INSTANA_ENUM_MIN_JS_URL = process.env.INSTANA_ENUM_MIN_JS_URL;
const INSTANA_KEY = process.env.INSTANA_KEY;
var INSTANA_HEADER = "";

if( typeof INSTANA_REPORTING_URL != 'undefined' && INSTANA_REPORTING_URL != "" 
    && typeof INSTANA_ENUM_MIN_JS_URL != 'undefined' && INSTANA_ENUM_MIN_JS_URL != "" 
    && typeof INSTANA_KEY != 'undefined' && INSTANA_KEY != "" )  {
    
    INSTANA_HEADER = 
        `<script>\n` + 
        `  (function(s,t,a,n){s[t]||(s[t]=a,n=s[a]=function(){n.q.push(arguments)},\n` + 
        `  n.q=[],n.v=2,n.l=1*new Date)})(window,"InstanaEumObject","ineum");\n` + 
        `  ineum('reportingUrl', '${INSTANA_REPORTING_URL}');\n` + 
        `  ineum('key', '${INSTANA_KEY}');\n` + 
        `  ineum('trackSessions');\n` + 
        `</script>\n` + 
        `<script defer crossorigin="anonymous" src="${INSTANA_ENUM_MIN_JS_URL}"></script>\n`;
}

const express = require('express');
const fs = require('fs');
const http = require('http');
const moment = require('moment');
const parseUrl = require("parse-url");
const promMid = require('express-prometheus-middleware');
const faker = require('faker');
const requestIp = require('request-ip');

USE_REQ_TOKEN = true;
if (typeof process.env.USE_REQ_TOKEN != 'undefined') {
    USE_REQ_TOKEN = (process.env.USE_REQ_TOKEN == 'true' || process.env.USE_REQ_TOKEN == 'True');
}

QUOTE_SVC = process.env.QUOTE_SVC;
AUTHOR_SVC = process.env.AUTHOR_SVC;
RATING_SVC = process.env.RATING_SVC;
PDF_SVC = process.env.PDF_SVC;
ENGRAVING_SVC = process.env.ENGRAVING_SVC;

app = express();
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.set('port', 3000);

app.enable('trust proxy');

app.use(promMid());
app.use(express.static(__dirname + '/public'));
app.use(express.json());
app.use(requestIp.mw());

//----------------------------------------------------------------------------------------------
// Health

const controller = require('./serviceController.js');


app.get('/health', function(req,res){
	if( controller.isHealthy() ) {
		res.status(200).send("Felling good, thank you.");
	} else {
		res.status(500).send("Not feeling too good, I am afraid.");
	}
});


//----------------------------------------------------------------------------------------------
// Main app


function newReqToken() {
    if (USE_REQ_TOKEN) {
        return utils.intBetween(100000, 999999)
    } else {
        return "";
    }
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

function callRating(quote,requestToken){
    // call rating for no good reason
    utils.logLocal("Calling Double Rating");
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
            } else {
                utils.log('Rejecting rating for quote.  Status: ' + ratingRes.statusCode, requestToken);
            }
        });
    })
    .on('error', error => {
        utils.log('Rejecting rating for quote. ' + error, requestToken);
    })
    .end();
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

                if( DOUBLE_RATING ) {
                    callRating(quote,requestToken);
                }
                addRating(quote, requestToken)
                .then((quote) => {
                    if( typeof ENGRAVING_SVC != 'undefined' && ENGRAVING_SVC != "" ) {
                        quote.enableOrdering = true;
                    }
                    quote.INSTANA_HEADER = INSTANA_HEADER;
                    res.render('home', quote);
                })
                .catch(
                    (err) => {
                        utils.log(" Problem getting rating. Err: " + err, requestToken);
                        // send th epage anyway but with a -1 rating
                        quote.rating = -1;
                        quote.INSTANA_HEADER = INSTANA_HEADER;
                        res.render('home', quote);
                    }
                );

            })
            .catch(
                (err) => {
                    utils.log("Internal Error.  Problem getting daily quote. Err: " + err, requestToken);
                    res.status(500).send("Problem getting daily quote.");
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
                if( DOUBLE_RATING ) {
                    callRating(quote,requestToken);
                }
                addRating(quote, requestToken)
                    .then((quote) => {
                        if( typeof ENGRAVING_SVC != 'undefined' && ENGRAVING_SVC != "" ) {
                            quote.enableOrdering = true;
                        }
                        quote.INSTANA_HEADER = INSTANA_HEADER;
                        res.render('home', quote);
                    })
                    .catch(
                        (err) => {
                            utils.log(" Problem getting rating. Err: " + err, requestToken);
                            // send th epage anyway but with a -1 rating
                            quote.rating = -1;
                            quote.INSTANA_HEADER = INSTANA_HEADER;
                            res.render('home', quote);
                        }
                    );
            })
            .catch(
                (err) => {
                    utils.log("Internal Error.  Problem getting random quote. Err: " + err, requestToken);
                    res.status(500).send("Problem getting random quote.");
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
                    bio.INSTANA_HEADER = INSTANA_HEADER;
                    res.render('author', bio);
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
                }
            });
        })
        .on('error', error => {
            res.status(500).send("Problem getting author bio.");
            utils.log("Problem getting author bio.  " + error, requestToken);
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
                    }
                });
            })
                .on('error', error => {
                    utils.log("Problem getting image " + id + " Error: " + error, requestToken);
                    res.status(500).send("Image " + id + " not found");
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
        var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
        utils.log('Starting new request token: ' + requestToken + ' for IP: ' + ip);
        utils.log("PDF request id: " + id, requestToken);
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
                    } else {
                        // assume any error will report a 404
                        utils.log("PDF " + id + " not found.", requestToken);
                        res.status(404).send("PDF " + id + " not found");
                    }
                });
            })
                .on('error', error => {
                    utils.log("Attempt to get PDF " + id + " unsuccessful. Error: " + error, requestToken);
                    res.status(500).send("PDF " + id + " Error: " + error);
                })
                .end();

        }, delay);
    }
);

app.get('/order/:id',
    function (req, res) {
        var start = new Date().getTime();
        var requestToken = newReqToken();
        var delay = metrics.getDelay();
        var id = req.params.id;
        var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
        utils.log('Starting new request token: ' + requestToken + ' for IP: ' + ip);
        utils.log("GET Order request id: " + id, requestToken);
        utils.logLocal('[' + start + '] GET Order Service being delayed: ' + delay + 'ms');

        var order = {
            "id": id,
            "token": requestToken,
            "orderNo": faker.finance.account,
            "dedication": faker.lorem.slug(),
            "street": faker.address.streetAddress(),
            "city": faker.address.cityName(),
            "state": faker.address.stateAbbr()
        }
        order.zip = faker.address.zipCodeByState(order.state);

        setTimeout(()=>{
            order.INSTANA_HEADER = INSTANA_HEADER;
            res.render('order',order);
        },delay);
    }
);

async function getQuote(id,requestToken){
    var parsedUrl = parseUrl(QUOTE_SVC);
    var hostname = parsedUrl.resource;
    var port = 80;
    if (parsedUrl.port != null) port = parsedUrl.port;  
    const options = {
        "headers": { "Accept": "application/json" },
        "method": 'GET',
        "hostname": hostname,
        "port": port,
        "path": `/quotes/${id}?requestToken=${requestToken}`
    }
    return utils.httpRequest(options);
}

app.post('/order/:id',
    async function (req, res) {
        var start = new Date().getTime();
        var requestToken = req.query.requestToken;
        var delay = metrics.getDelay();
        var id = req.params.id;
        utils.log("POST Order details for quote id: " + id, requestToken);
        utils.logLocal('[' + start + '] POST Order Service being delayed: ' + delay + 'ms');

        var order = req.body;
        order.customer = faker.finance.accountName;

        var quote;
        try{
            quote = await getQuote(id,requestToken);
        } catch( error ) {
            utils.log(error,requestToken);
            res.status(500).send(error);
            return;
        }
    
        var quote = await getQuote(id,requestToken);
        order.quote = quote.quote;
        order.author = quote.author;
        var payload = JSON.stringify(order);

        var parsedUrl = parseUrl(ENGRAVING_SVC);
        var hostname = parsedUrl.resource;
        var port = 80;
        if (parsedUrl.port != null) port = parsedUrl.port;  
        var path = parsedUrl.pathname + '/order?requestToken=' + requestToken;
        setTimeout(function () {
            const options = {
                "headers": { "Content-Type": "application/json" },
                "Content-Length": payload.length,
                "method": 'POST',
                "hostname": hostname,
                "port": port,
                "path": path
            }

            var orderReq = http.request(options, function (orderRes) {
                utils.logLocal(`\tPOST http://${options.hostname}:${options.port}${options.path}`);
                utils.logLocal('\t'+payload);
                var rawData = [];
                orderRes.on('data', (chunk) => {
                    rawData.push(chunk);
                });
                orderRes.on('end', () => {
                    utils.logLocal(`\tFinished POST http://${options.hostname}:${options.port}${options.path}`);
    
                    if (orderRes.statusCode == 200) {
                        var buffer = Buffer.concat(rawData).toString();
                        utils.logLocal(`\tGot POST respponse http://${options.hostname}:${options.port}${options.path} ${buffer}`);
                        res.status(200).send("Success");
                    } else {
                        utils.logLocal(`\tGot POST status response http://${options.hostname}:${options.port}${options.path} ${orderRes.statusCode}`);
                        res.status(orderRes.statusCode).send("Problem with Order service.");
                    }
                });
            });
    
            orderReq.on('error', error => {
                utils.logLocal(`\tGot POST Error  http://${options.hostname}:${options.port}${options.path} ${error}`);
                res.status(500).send(error);
            });

            orderReq.write(payload);
            orderReq.end();
            
        }, delay);
    }

);

//----------------------------------------------------------------------------------------------
// Main App

app.get('/version',
    function (req, res) {
        utils.log('/version');
        var ip = req.clientIp;
        res.send(`${appName} v${appVersion}, build: ${buildInfo}.  Your IP: ${ip}`);
    }
);

const package = require('./package.json');
const appName = package.name;
const appVersion = package.version;
const buildInfo = fs.readFileSync('build.txt');

appService = app.listen(app.get('port'), '0.0.0.0', function () {
    console.log(`Starting ${appName} v${appVersion}, ${buildInfo} on port ${app.get('port')}`);
});

//=====================================================================================================
//=====================================================================================================
// Control plane 

serviceController = express();
serviceController.set('port', 8080)
serviceController.enable('trust proxy');
serviceController.use(express.json());


// require these AFTER we have defined the serviceController express object
const utils = require('./utils.js');
const metrics = require('./metrics.js');
const logger = require('./logger');

logger.intializeLoggers();


