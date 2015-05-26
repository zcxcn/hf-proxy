var fs = require('fs');
exports.getContent = function(channel) {
    if (!channel) return null;
    channel.path = channel.path || 'home';
    var result = {};
    channel.headerHTML = channel.headerHTML || 'header_main.html';
    channel.headerStyle = channel.headerStyle || 'header_styles.html';

    var pathHtml = process.cwd() + '/prd/' + channel.path + '/' + channel.headerHTML;
    var pathStyle = process.cwd() + '/prd/' + channel.path + '/' + channel.headerStyle;


    result.html = fs.readFileSync(pathHtml);
    result.style = fs.readFileSync(pathStyle);
    if (channel.sidebarHTML) {
        channel.sidebarHTML = channel.sidebarHTML || 'ucsidebar.html';
        channel.sidebarStyle = channel.sidebarStyle || 'ucsidebar_styles.html';
        var pathSidebarHTML = process.cwd() + '/prd/' + channel.path + '/' + channel.sidebarHTML;
        var pathSidebarStyle = process.cwd() + '/prd/' + channel.path + '/' + channel.sidebarStyle;
        result.sidebarHTML = fs.readFileSync(pathSidebarHTML);
        result.sidebarStyle = fs.readFileSync(pathSidebarStyle);
    }
    return result
}
