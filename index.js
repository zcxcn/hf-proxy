 var http = require('http'),
     connect = require('connect'),
     fs = require('fs'),
     httpProxy = require('http-proxy'),
     harmon = require('harmon'),
     syspath = require('path'),
     main = require('./lib/main');
 process.on('uncaughtException', function(err) {
     console.log('error:', err);
 });

 var selects = [];
 var htmlselect = {};
 var styleselect = {};
 var scriptselect = {};
 var sidebarHTMLSelect = {};
 var sidebarStyleSelect = {};

 var scriptCache = '';
 var isDebug = true;

 var baselib = syspath.join(module.filename, '../')
 var channelHash = require(baselib + 'lib/channelHash.json');
 var connect = require('connect');
 var app = connect()
     .use(function(req, res, next) {
         var pu = req._parsedUrl;
         if (pu.host.indexOf('qunar.com') > -1) {
             // if (pu.url.test(/[\.js|\.css|\.png]$/)) {
             if (/(\.js|\.css|\.png|\.jpg|\.gif|\.swf)(\?.*)?$/.test(req.url)) {
                 next();
                 return;
             }
             var index = pu.host.indexOf('.')
             var subDomain = pu.host.substr(0, index);

             //  console.log(req.url);

             var channelInfo = getChannelInfo(subDomain);
             if (!channelInfo) {
                 next();
                 return;
             }
             var content = main.getContent(channelInfo);
             if (!content) {
                 next();
                 return;
             }
             //获取嵌入脚本
             getScript(function(script) {
                 script = script.replace('{{channel.path}}', channelInfo.path);

                 if (isDebug) {
                     content.html = content.html + '<script>' + script + '</script>';
                 }
                 //替换html
                 htmlselect.query = 'div.q_header';
                 htmlselect.func = function(node) {
                         node.createWriteStream({
                             outer: false
                         }).end(content.html);
                     }
                 //替换style
                 styleselect.query = 'style[data-hfstamp]';
                 styleselect.func = function(node) {
                         node.createWriteStream({
                             outer: true
                         }).end(content.style);
                     }
                 //替换sidebarhtml
                 sidebarHTMLSelect.query = '.q_ucsidebar ul';
                 sidebarHTMLSelect.func = function(node) {
                         node.createWriteStream({
                             outer: true
                         }).end(content.sidebarHTML);
                     }
                 //替换sidebarstyle
                 sidebarStyleSelect.query = '.q_ucsidebar style';
                 sidebarStyleSelect.func = function(node) {
                     node.createWriteStream({
                         outer: true
                     }).end(content.sidebarStyle);
                 }
                 selects.push(htmlselect);
                 selects.push(styleselect);
                 selects.push(sidebarHTMLSelect);
                 selects.push(sidebarStyleSelect);
                 var func = harmon([], selects, true);
                 func(req, res, next);
             });

         } else {
             next();
         }
     })
     .use(function(req, res) {
         var protocol = req._parsedUrl.protocol;
         var host = req.headers.host;
         console.log(protocol + '//' + host)
         proxy.web(req, res, {
             target: protocol + '//' + host
         }, function(e) {
             //避免刷太快报 socket hang up
             console.log('proxy error:', e);
         });
     })
     .listen(8001);
 app.on('error', function(e) {
     console.log('connect error:', e);
 })
 var proxy = httpProxy.createProxyServer({});

 console.log(8001);

 function getScript(callback) {
     if (scriptCache) {
         callback.call(null, scriptCache)
     } else {
         fs.readFile(baselib + 'lib/script.js', function(err, chunk) {
             scriptCache = chunk.toString('utf-8');
             callback.call(null, scriptCache);
         })
     }
 }

 function getChannelInfo(subDomain) {
     for (var key in channelHash) {
         if (subDomain == key) return channelHash[key];
     }
     return null;
 }
