"use strict";
var http = require('http'),
    https = require('https'),
    zlib = require('zlib'),
    util = require('util'),
    StringDecoder = require('string_decoder').StringDecoder,
    console = global.console,
    hrtime = process.hrtime;
var agent = new http.Agent();
var returingHeaders
http.createServer(function(req, res) {
    console.log(req.url)
    var incomingHeaders = req.headers,
        outgoingHeaders = util._extend({}, incomingHeaders);
    delete outgoingHeaders["accept-encoding"];
    var outgoing = {
        host: incomingHeaders.host,
        // port: 80,//443
        method: req.method,
        path: req.url,
        headers: outgoingHeaders,
        agent: agent
    };
    var proxyReq;
    // if (req.url.indexOf('https') > -1) {
    //     proxyReq = https.request(outgoing);
    //     console.log(proxyReq)
    // } else {
    proxyReq = http.request(outgoing);
    // }
    var isNeedReplace = false;
    proxyReq.on('response', function(proxyRes) {
        returingHeaders = util._extend({}, proxyRes.headers);
        //res.writeHead(200, returingHeaders);
        if (proxyRes.statusCode !== 200) {
            res.writeHead(proxyRes.statusCode, returingHeaders);
            proxyRes.pipe(res);
            //  console.log('%s %s %s [!==200, %s]', (new Date()).toGMTString(), incomingHeaders.host, incomingHeaders['x-forwarded-for'], proxyRes.statusCode);
            console.log('error url:', req.url, incomingHeaders['x-forwarded-for'], proxyRes.statusCode)
            return;
        }
        var resHeaders = proxyRes.headers || {};
        var contentType = resHeaders['content-type'];
        isNeedReplace = (contentType && contentType.indexOf('text/html') > -1 && req.url.indexOf('qunar.com') > -1)

        if (!isNeedReplace) {
            proxyRes.pipe(res);
            return
        }
        var decoder = new StringDecoder('utf8');
        var results = '';
        proxyRes.on('data', function(chunk) {
            results += decoder.write(chunk);
            //res.writeHead(200, returingHeaders);
            //res.end('123');
        });
        proxyRes.on('end', function() {
            //results = 'test';
            var buf = new Buffer(results);
            // results.replace();
            returingHeaders['content-length'] = buf.length;
            res.writeHead(proxyRes.statusCode, returingHeaders);
            res.end(buf);
        });
    });
    req.pipe(proxyReq);
    //proxyReq.end(); 
    // res.end('hello');
}).listen(8001);
