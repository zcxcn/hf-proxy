var channel = "{{channel.path}}";
 
if (window.addEventListener)
    window.addEventListener("DOMContentLoaded", load, false);
else
    window.attachEvent('onload', load)

function load() {
    var div = $('<div id="debughf">BETA ' + channel + '</div>');
    $('body').append(div);
    div.css({
        position: 'absolute',
        left: 40,
        top: 10,
        padding:'2px 5px',
        border: '1px solid #ccc',
        background: '#ccc',
        color: 'white',
        fongSize: '12px',
        zIndex:'999999'
    })
}
