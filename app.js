const express = require('express');
const fs = require('fs');
const http = require('http');
const moment = require('moment');
const promMid = require('express-prometheus-middleware');

if (process.env.ENABLE_INSTANA == "true") {
    require('@instana/collector')();
}

var USE_REQ_TOKEN = true;
if (typeof process.env.USE_REQ_TOKEN != 'undefined') {
    USE_REQ_TOKEN = (process.env.USE_REQ_TOKEN == 'true' || process.env.USE_REQ_TOKEN == 'True');
}

var QUOTE_SVC_HOST = 'localhost';
if (process.env.QUOTE_SVC_HOST) {
    // override for iamge service url
    QUOTE_SVC_HOST = process.env.QUOTE_SVC_HOST;
}

var QUOTE_SVC_PORT = 3001;
if (process.env.QUOTE_SVC_PORT) {
    // override for iamge service url
    QUOTE_SVC_PORT = parseInt(process.env.QUOTE_SVC_PORT);
}

var AUTHOR_SVC_HOST = 'localhost';
if (process.env.AUTHOR_SVC_HOST) {
    // override for iamge service url
    AUTHOR_SVC_HOST = process.env.AUTHOR_SVC_HOST;
}

var AUTHOR_SVC_PORT = 3002;
if (process.env.AUTHOR_SVC_PORT) {
    // override for iamge service url
    AUTHOR_SVC_PORT = parseInt(process.env.AUTHOR_SVC_PORT);
}

var RATING_SVC_HOST = 'localhost';
if (process.env.RATING_SVC_HOST) {
    // override for iamge service url
    RATING_SVC_HOST = process.env.RATING_SVC_HOST;
}

var RATING_SVC_PORT = 3004;
if (process.env.RATING_SVC_PORT) {
    // override for iamge service url
    RATING_SVC_PORT = parseInt(process.env.RATING_SVC_PORT);
}

var PDF_SVC_HOST = 'localhost';
if (process.env.PDF_SVC_HOST) {
    // override for iamge service url
    PDF_SVC_HOST = process.env.PDF_SVC_HOST;
}

var PDF_SVC_PORT = 3005;
if (process.env.PDF_SVC_PORT) {
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

serviceRunning = false;

// require these AFTER we have defined the express app
const utils = require('./utils.js');
const metrics = require('./metrics.js');

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
        const options = {
            "headers": { "Accept": "application/json" },
            "method": 'GET',
            "hostname": RATING_SVC_HOST,
            "port": RATING_SVC_PORT,
            "path": '/ratings/' + quote.id + '?requestToken=' + requestToken
        }

        http.request(options, function (ratingRes) {
            var rawData = [];
            ratingRes.on('data', (chunk) => {
                rawData.push(chunk);
            });
            ratingRes.on('end', () => {
                utils.logLocal(`Quote svc response: ${ratingRes.statusCode}`);

                if (ratingRes.statusCode == 200) {
                    utils.log('Got rating for quote: ' + quote.id, requestToken);
                    var buffer = Buffer.concat(rawData).toString();
                    var rating = JSON.parse(buffer);
                    quote.rating = rating.rating;
                    resolve(quote);
                } else {
                    utils.log('Rejecting rating for quote: ' + quote.id + ' Rating status code: ' + ratingRes.statusCode, requestToken);
                    reject(ratingRes.statusCode);
                }
            });


        })
            .on('error', error => {
                utils.log('Rejecting rating for quote: ' + quote.id + ' Error: ' + error, requestToken);
                reject(error);
            })
            .end();
    });
}

function getDailyQuote(requestToken) {
    return new Promise((resolve, reject) => {

        utils.log('Getting daily quote.', requestToken);

        const options = {
            "headers": { "Accept": "application/json" },
            "method": 'GET',
            "hostname": QUOTE_SVC_HOST,
            "port": QUOTE_SVC_PORT,
            "path": '/daily?requestToken=' + requestToken
        }

        http.request(options, function (quoteRes) {
            var rawData = [];
            quoteRes.on('data', (chunk) => {
                rawData.push(chunk);
            });
            quoteRes.on('end', () => {
                utils.logLocal(`Quote svc response: ${quoteRes.statusCode}`);

                if (quoteRes.statusCode == 200) {
                    utils.log('Obtained daily quote.', requestToken);
                    var buffer = Buffer.concat(rawData).toString();
                    var rating = JSON.parse(buffer);
                    resolve(rating);
                } else {
                    utils.log('Rejecting request for daily quote. Response Code: ' + quoteRes.statusCode, requestToken);
                    reject(quoteRes.statusCode);
                }
            });


        })
            .on('error', error => {
                utils.log('Rejecting request for daily quote. Error: ' + error, requestToken);
                reject(error);
            })
            .end();

    });
}

function getRandomQuote(requestToken) {
    return new Promise((resolve, reject) => {

        utils.log('Getting random quote.', requestToken);
        const options = {
            "headers": { "Accept": "application/json" },
            "method": 'GET',
            "hostname": QUOTE_SVC_HOST,
            "port": QUOTE_SVC_PORT,
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
                    utils.log('Rejecting request for random quote. Response Code: quoteRes.statusCode', requestToken);
                    reject(quoteRes.statusCode);
                }
            });

        })
            .on('error', error => {
                utils.log('Rejecting request for random quote. Error: ' + error, requestToken);
                reject(error);
            }).end();

    });
}

app.get('/', function (req, res) {
    if (!serviceRunning) {
        res.status(500).send("Not available");
        return;
    }
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
                            utils.log("Internal Error.  Problem getting rating. Err: " + err, requestToken);
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
                addRating(quote, requestToken)
                    .then((quote) => {
                        quote.today = "";
                        quote.title = "Random Quote";
                        res.render('home', quote);
                        updateApiResponseMetric(start);
                    });
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

    setTimeout(function () {
        const options = {
            "headers": { "Accept": "application/json" },
            "method": 'GET',
            "hostname": AUTHOR_SVC_HOST,
            "port": AUTHOR_SVC_PORT,
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

        setTimeout(function () {
            const options = {
                "headers": { "Accept": "image/jpeg" },
                "method": 'GET',
                "hostname": AUTHOR_SVC_HOST,
                "port": AUTHOR_SVC_PORT,
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

function getDefaultImage() {

}

app.get('/pdf/:id',
    function (req, res) {
        var start = new Date().getTime();
        var requestToken = newReqToken();
        var delay = metrics.getDelay();
        var id = req.params.id;
        utils.log("PDF request for quote id: " + id, requestToken);
        utils.logLocal('[' + start + '] Service being delayed: ' + delay + 'ms');

        setTimeout(function () {
            const options = {
                "headers": { "Accept": "application/pdf" },
                "method": 'GET',
                "hostname": PDF_SVC_HOST,
                "port": PDF_SVC_PORT,
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

// global
serviceRunning = true;

// general commands to the service (i.e. stop, crash ...)
app.put('/service', function (req, res) {
    utils.log(`Service request: ${req.body}`);
    var cmd = req.body.action;
    switch (cmd) {
        case 'STOP': {
            serviceRunning = false;
            break;
        }
        case 'START': {
            serviceRunning = true;
            break;
        }
        case 'CRASH': {
            crash();
            break;
        }
    }
    res.status(200).send('OK');
}
);

function crash() {
    utils.log("Aaaaah!");
    // set up timer to crash after 3 seconds 
    setTimeout(function () {
        // process.exit(-1);  // produces simpler clear log entries than uncaught exception
        process.nextTick(function () {
            throw new Error;
        });
    }, 3000);
}

app.get('/version',
    function (req, res) {
        console.log('/version');
        res.send(`${appName} v${appVersion}, build: ${buildInfo}.`);
    }
);

const package = require('./package.json');
const appName = package.name;
const appVersion = package.version;
const buildInfo = fs.readFileSync('build.txt');

app.listen(app.get('port'), '0.0.0.0', function () {
    console.log(`Starting ${appName} v${appVersion}, ${buildInfo} on port ${app.get('port')}`);
});



