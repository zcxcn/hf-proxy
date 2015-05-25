var fs = require('fs');
exports.getContent = function(channel) {
    if (!channel) return null;
    channel.path = channel.path || 'home';

    var htmlFileName = channel.headerHtml || 'header_main.html';
    var styleFileName = channel.headerStyle || 'header_styles.html';
    var pathHtml = process.cwd() + '/prd/' + channel.path + '/' + htmlFileName;
    var pathStyle = process.cwd() + '/prd/' + channel.path + '/' + styleFileName;
    var html = fs.readFileSync(pathHtml);
    var style = fs.readFileSync(pathStyle);
    return {
        html: html,
        style: style
    }


}
