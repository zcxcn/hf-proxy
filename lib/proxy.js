"use strict";
var http = require('http'),
    zlib = require('zlib'),
    util = require('util'),
    StringDecoder = require('string_decoder').StringDecoder,
    console = global.console,
    hrtime = process.hrtime;
var agent = new http.Agent();
var returingHeaders
http.createServer(function(req, res) {
    var incomingHeaders = req.headers,
        outgoingHeaders = util._extend({}, incomingHeaders);
    delete outgoingHeaders["accept-encoding"];
    var outgoing = {
        host: incomingHeaders.host,
        port: 80,
        method: req.method,
        path: req.url,
        headers: outgoingHeaders,
        agent: agent
    };
    var proxyReq = http.request(outgoing);
    proxyReq.on('response', function(proxyRes) {
        returingHeaders = util._extend({}, proxyRes.headers);
        //res.writeHead(200, returingHeaders);
        proxyRes.pipe(res);
        var decoder = new StringDecoder('utf8');
        var results = '';
        proxyRes.on('data', function(chunk) {
            results += decoder.write(chunk);

            //res.writeHead(200, returingHeaders);
            //res.end('123');
        });
        proxyRes.on('end', function() {
            console.log(results)
                //res.writeHead(200, returingHeaders);
                //res.end('123');
        });
    });
    req.pipe(proxyReq);
    //proxyReq.end(); 
    // res.end('hello');
}).listen(8001);
