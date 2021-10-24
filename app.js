require('dotenv').config();
if (process.env.ENABLE_INSTANA == "true") {
    require('@instana/collector')({ autoProfile: true });
}

// Instana web app token
const INSTANA_REPORTING_URL = process.env.INSTANA_REPORTING_URL;
const INSTANA_ENUM_MIN_JS_URL = process.env.INSTANA_ENUM_MIN_JS_URL;
const INSTANA_KEY = process.env.INSTANA_KEY;
var INSTANA_HEADER = "";

if (typeof INSTANA_REPORTING_URL != 'undefined' && INSTANA_REPORTING_URL != ""
    && typeof INSTANA_ENUM_MIN_JS_URL != 'undefined' && INSTANA_ENUM_MIN_JS_URL != ""
    && typeof INSTANA_KEY != 'undefined' && INSTANA_KEY != "") {

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

app.get('/health', function (req, res) {
    if (controller.isHealthy()) {
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

        http.request(options, function (response) {
            var rawData = [];
            response.on('data', (chunk) => {
                rawData.push(chunk);
            });
            response.on('end', () => {
                utils.logLocal(`Rating svc response http://${options.hostname}:${options.port}${options.path}: ${response.statusCode}`);

                if (response.statusCode == 200) {
                    utils.log('Got rating for quote: ' + quote.id, requestToken);
                    var buffer = Buffer.concat(rawData).toString();
                    var rating = JSON.parse(buffer);
                    quote.rating = rating.rating;
                    resolve(quote);
                } else {
                    utils.log('Rejecting rating for quote.  Status: ' + response.statusCode, requestToken);
                    reject(response.statusCode);
                }
            });
        })
            .on('error', error => {
                utils.log(`Error on http request: ${error}`, requestToken);
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

        http.request(options, function (response) {
            var rawData = [];
            response.on('data', (chunk) => {
                rawData.push(chunk);
            });
            response.on('end', () => {
                utils.logLocal(`Quote svc response http://${options.hostname}:${options.port}${options.path}: ${response.statusCode}`);

                if (response.statusCode == 200) {
                    utils.log('Obtained daily quote.', requestToken);
                    var buffer = Buffer.concat(rawData).toString();
                    var quote = JSON.parse(buffer);
                    resolve(quote);
                } else {
                    reject(response.statusCode);
                }
            });
        })
            .on('error', error => {
                utils.log(`Error on http request: ${error}`, requestToken);
                reject(error);
            })
            .end();
    })
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

        http.request(options, function (response) {
            var rawData = [];
            response.on('data', (chunk) => {
                rawData.push(chunk);
            });
            response.on('end', () => {
                utils.logLocal(`Quote svc response: ${response.statusCode}`);

                if (response.statusCode == 200) {
                    utils.log('Obtained random quote.', requestToken);
                    var buffer = Buffer.concat(rawData).toString();
                    var rating = JSON.parse(buffer);
                    resolve(rating);
                } else {
                    reject(response.statusCode);
                }
            });
        })
            .on('error', error => {
                utils.log(`Error on http request: ${error}`, requestToken);
                reject(error);
            })
            .end();

    })
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

        var override = controller.callStatusOverride('daily');
        if( override ) {
            controller.handleOverride(res,override,requestToken);
        } else {
            getDailyQuote(requestToken)
            .then((quote) => {
                var now = new moment();

                quote.today = now.format("dddd, MMMM Do YYYY");
                quote.title = "Quote of the Day";

                addRating(quote, requestToken)
                    .then((quote) => {
                        if (typeof ENGRAVING_SVC != 'undefined' && ENGRAVING_SVC != "") {
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
        }



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

        var override = controller.callStatusOverride('random');
        if( override ) {
            controller.handleOverride(res,override,requestToken);
        } else {
            getRandomQuote(requestToken)
                .then((quote) => {
                    quote.today = "";
                    quote.title = "Random Quote";
                    addRating(quote, requestToken)
                        .then((quote) => {
                            if (typeof ENGRAVING_SVC != 'undefined' && ENGRAVING_SVC != "") {
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
        }

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

        var override = controller.callStatusOverride('author_id');
        if( override ) {
            controller.handleOverride(res,override,requestToken);
        } else {

            const options = {
                "headers": { "Accept": "application/json" },
                "method": 'GET',
                "hostname": hostname,
                "port": port,
                "path": '/authors/' + id + '?requestToken=' + requestToken
            }

            utils.httpRequest(options)
            .then( (bio) => {
                utils.log("Author bio received.  Author id: " + id, requestToken);
                bio.INSTANA_HEADER = INSTANA_HEADER;
                res.render('author', bio);
            })
            .catch( (error) => {
                utils.log("Problem getting author bio.  " + error.message, requestToken);
                res.status(error.code).send("Problem getting author bio.");
            })
        }
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

            var override = controller.callStatusOverride('images_id');
            if( override ) {
                controller.handleOverride(res,override,requestToken);
            } else {
                const options = {
                    "headers": { "Accept": "image/jpeg" },
                    "method": 'GET',
                    "hostname": hostname,
                    "port": port,
                    "path": '/images/' + id + '?requestToken=' + requestToken
                }

                utils.httpRequest(options)
                .then( (buffer) => {
                    res.end(Buffer.from(buffer, 'binary'));
                    utils.log("Author image provided.", requestToken);
                })
                .catch( (error) => {
                    utils.log("Problem getting image " + id + " Error: " + error.message, requestToken);
                    res.status(error.code).send("Image " + id + " not found");
                });

            }
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

            var override = controller.callStatusOverride('pdf_id');
            if( override ) {
                controller.handleOverride(res,override,requestToken);
            } else {

                const options = {
                    "headers": { "Accept": "application/pdf" },
                    "method": 'GET',
                    "hostname": hostname,
                    "port": port,
                    "path": '/pdf/' + id + '?requestToken=' + requestToken
                }

                utils.httpRequest(options)
                .then( (buffer) => {
                    res.end(Buffer.from(buffer, 'binary'));
                    utils.log("Author image provided.", requestToken);
                })
                .catch( (error) => {
                    utils.log("Problem getting image " + id + " Error: " + error.message, requestToken);
                    res.status(error.code).send("Image " + id + " not found");
                });
            }

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

        setTimeout(() => {
            var override = controller.callStatusOverride('order_id');
            if( override ) {
                controller.handleOverride(res,override,requestToken);
            } else {
                order.INSTANA_HEADER = INSTANA_HEADER;
                res.render('order', order);
            }
        }, delay);
    }
);

async function getQuote(id, requestToken) {
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
    try{
        return await utils.httpRequest(options);
    } catch( error ) {
        utils.log("Problem getting quote: " + error );
    }
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

        var quote = await getQuote(id, requestToken);
        order.quote = quote.quote;
        order.author = quote.author;
        var payload = JSON.stringify(order);

        var parsedUrl = parseUrl(ENGRAVING_SVC);
        var hostname = parsedUrl.resource;
        var port = 80;
        if (parsedUrl.port != null) port = parsedUrl.port;
        var path = parsedUrl.pathname + '/order?requestToken=' + requestToken;
        setTimeout(function () {
            var override = controller.callStatusOverride('ratings_id');
            if( override ) {
                controller.handleOverride(res,override,requestToken);
            } else {
                const options = {
                    "headers": { "Content-Type": "application/json" },
                    "Content-Length": payload.length,
                    "method": 'POST',
                    "hostname": hostname,
                    "port": port,
                    "path": path
                }

                utils.httpRequest(options,payload)
                .then( (buffer) => {
                    var orderConfirmation = buffer.toString();
                    utils.logLocal(`\tGot POST respponse http://${options.hostname}:${options.port}${options.path} ${orderConfirmation}`);
                    res.status(200).send(orderConfirmation);
                })
                .catch( (error) => {
                    utils.log("Problem with Order service: " + id + " Error: " + error.message, requestToken);
                    res.status(error.code).send("Problem with Order service: " + id + " Error: " + error.message);
                });    
            }

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
const buildInfo = fs.readFileSync('build.txt').toString().trim();

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
const controller = require('./serviceController.js');

logger.intializeDefaultLoggers();
controller.initializeCallOverrides();
