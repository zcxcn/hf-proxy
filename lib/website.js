var http = require('http');
var fs = require('fs');
var path = require('path');
http.createServer(function(req, res) {
    var baselib = path.join(module.filename, '../')
    var str = fs.readFileSync(baselib + 'main.js', 'utf-8');
    res.end(str);
}).listen('8001')
