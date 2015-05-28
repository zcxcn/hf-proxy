"use strict";
var http = require('http'),
    zlib = require('zlib'),
    util = require('util'),
    StringDecoder = require('string_decoder').StringDecoder,
    console = global.console,
    hrtime = process.hrtime;

var config = require('../../config'),
    agent = new http.Agent();
var monitor = require('../lib/monitor');

agent.maxSockets = config.maxSockets;

var filters = require('./filters'), L = filters.length;

var token = require('../lib/token'), token_query = require('../lib/token_dict').query;

module.exports = function (req, res) {
    var timeStart = req.timeStart = Date.now();
    var filterResult = '';
    var timeout = 3000;

    for (var i = 0; i < L; i++) {
        filterResult = filters[i](req, res);
        if (filterResult === 'whitelist') {
            break;
        } else if (filterResult === 'blacklist') {
            return;
        } else if (filterResult === 'relocation') {
            break;
        }
    }

    var queries = req.query;
    //console.log('query token ' + queries.u);
    if (req.te && !req.islist) {
        token_query(queries.u, function (found) {
            if (found) {
                // TODO: add monitor
                res.setHeader('Content-Type', 'text/javascript');
                var cb = req.query["__jscallback"] || "";
                res.end(cb + '({"ret":false,"errcode":111,"errmsg":""});');
                monitor('ban_dynamic_token_reused');
                monitor(req, 'kill_h2');

                return;
            }
            composeRequest();
        });
    } else {
        // 在切换期内，无法解析的token会走到这一步
        composeRequest();
    }

    var transform, results, returingHeaders, timeoutEventId;

    function composeRequest() {
        var incomingHeaders = req.headers,
            outgoingHeaders = util._extend({}, incomingHeaders);

        var remote = config.hostnames[incomingHeaders.host];

        delete outgoingHeaders["accept-encoding"];
        var outgoing = {
            host: config.beta && req.headers["x-beta-from"] || remote.host,
            port: remote.port,
            method: req.method,
            path: req.url + '&maskr=1',
            headers: outgoingHeaders,
            agent: agent
        };


        if ('headers' in remote) {
            util._extend(outgoingHeaders, remote.headers);
        } else {
            outgoingHeaders.host = remote.host;
        }

        transform = remote.transform || 'JSONP-JSONP';

        var proxyReq = http.request(outgoing);

        var aborted = false, hasTimeout = false;
        req.on('aborted', function () {
            aborted = true;
            proxyReq.abort();
        });
        req.on('error', function (err) {
            aborted = true;
            proxyReq.abort();
            console.error('[%s] req: %s', (new Date()).toGMTString(), err.stack);
        });

        proxyReq.on('error', function (err) {
            if (aborted) return;

            var message = hasTimeout ? "timeout" : err.stack;
            console.error('[%s] proxy req: %s', (new Date()).toString(), message);

            res.writeHead('200', {
                'Content-Length': 0,
                'X-Accel-Redirect': '/direct' + outgoing.path
            });
            res.end();

            monitor('accel_redirect'); // X-Accel-Redirect 数量
            if (!hasTimeout) monitor('proxy_request_error'); // 请求后端报错监控
        });
        proxyReq.on('response', function (proxyRes) {
            if (aborted) return;

            returingHeaders = util._extend({}, proxyRes.headers);

            delete returingHeaders['transfer-encoding'];
            returingHeaders['content-type'] = 'text/javascript; charset=utf-8';

            if (proxyRes.statusCode !== 200) {
                res.writeHead(proxyRes.statusCode, returingHeaders);
                proxyRes.pipe(res);
                console.log('%s %s %s [!==200, %s]', (new Date()).toGMTString(), incomingHeaders.host, incomingHeaders['x-forwarded-for'], proxyRes.statusCode);
                monitor('response_not_ok');
                return;
            }


            var instream;
            // 或许启用压缩，能解决内网网络瓶颈问题？
            if ('content-encoding' in returingHeaders) {
                var encoding = returingHeaders['content-encoding'];
                if (encoding === 'gzip') {
                    instream = proxyRes.pipe(zlib.createGunzip());
                } else if (encoding === 'deflate') {
                    instream = proxyRes.pipe(zlib.createInflateRaw());
                } else { // response passthrough
                    res.writeHead(200, returingHeaders);
                    proxyRes.pipe(res);
                    return;
                }
                delete returingHeaders['content-encoding'];
            } else {
                instream = proxyRes;
            }


            results = '';
            // 2015-04-15: 使用StringDecoder而不是Buffer.concat().toString()来提高性能(kyrios.li)
            var decoder = new StringDecoder('utf8');
            instream.on('data', function (data) {
                results += decoder.write(data);
            }).on('end', proxyResEnded);

            instream.on('close', function () {
                if (timeoutEventId) {
                    timeoutEventId = clearTimeout(timeoutEventId);
                }
            });
        });

        // timeout
        proxyReq.on('timeout', function () {
            hasTimeout = true;
            proxyReq.abort();
        });

        timeoutEventId = timeout && setTimeout(function () {
            proxyReq.emit('timeout');
        }, timeout);

        req.pipe(proxyReq);
    }

    function proxyResEnded() {
        if (timeoutEventId) {
            timeoutEventId = clearTimeout(timeoutEventId);
        }

        var timeRecv = Date.now();
        var renewToken = token.updateToken(req.te);
        if (results.length === 0) { // TODO: on JSON response
            res.writeHead(200, {
                'Cache-Control': 'no-cache',
                'Content-Type': 'text/javascript'
            });
            res.end(renewToken);

            monitor(req, 'proxy_total');
            monitor(req, 'backend_empty', timeRecv - timeStart); // 后端空白返回监控
            return;
        }


        var buf, body = results; // optimized
        var callback, json;

        // TODO: add ajax support
        if (transform === 'JSON-JSONP') { // transform json to jsonp
            // convert json to jsonp
            callback = queries.__jscallback || queries.cb;
            json = body;
        } else {
            // jsonp to jsonp
            // 2015-04-15: 使用indexOf而不是正则来提高性能(kyrios.li)
            var idx1 = body.indexOf('('), idx2 = body.lastIndexOf(')');
            if (idx1 !== -1 && idx2 !== -1) {
                callback = body.substr(0, idx1);
                json = body.substring(idx1 + 1, idx2);
            } else {
                console.error('[%s] %s: wrong jsonp response: %s ... %s', (new Date()).toGMTString(), req.url, body.slice(0, 20), body.slice(-20));
                res.writeHead(200, {
                    'Content-Length': 0,
                    'X-Accel-Redirect': '/direct' + req.url + "&maskr=1",
                    'Connection': 'close'
                });
                res.end();
                monitor('accel_redirect'); // X-Accel-Redirect 数量
                return;
            }
        }
        if (!req.isWhiteList) {

            var mixer_info = req.mixer;
            var mix_start = hrtime();
            json = mixer_info.mix(json, mixer_info);
            var mix_end = hrtime();

            var performance = ((mix_end[0] - mix_start[0]) * 1e9 + (mix_end[1] - mix_start[1])) / (body.length * 1.024e-6) / 1e6 | 0;
            var timeEnd = Date.now();
            console.log('%s %s %s [%d ms %d ms %d ms] %d ms/mb', (new Date()).toGMTString(), req.headers.host, req.headers['x-forwarded-for'], timeEnd - timeStart, timeRecv - timeStart, timeEnd - timeRecv, performance);
        } else {
            json = '/*whitelist hit*/' + json;
        }
        body = renewToken + callback + '(' + json + ');~function(e){e.onload=function(){e.onload=e=null};e.src="http://m.ued.qunar.com/monitor/log?code=' + (req.fake ? 'hotel_price' : 'hotel_price') + '"}(new Image())';
        buf = new Buffer(body);

        returingHeaders['content-length'] = buf.length;
        res.writeHead(200, returingHeaders);
        res.end(buf);
        monitor(req, 'proxy_total');
        monitor(req, 'proxy_spent', timeRecv - timeStart); // 请求耗时监控
        monitor(req, 'encoding_spent', timeEnd - timeRecv); // 加密耗时监控
    }
};
