const http = require('http');
const url = require('url');
const fs = require('fs');

function onPath(parsedUrl, path) {
    let urlPath = parsedUrl.path;
    return urlPath.startsWith(path);
}

function fourOhfour(response) {
    response.writeHead(404);
    response.end('404 - File not found.');
}

function handleStatic(request, response) {

    const parsedUrl = url.parse(request.url);
    const path = `.${parsedUrl.path}`;

    const mimeTypes = {
        'jpeg' : 'image/jpeg',
        'html' : 'text/html',
        'css' : 'text/css',
        'js' : 'text/javascript',
        'png' : 'image/png'
    }

    const extension = path.split('.').pop();

    fs.readFile(path, (err, data) => {
        if (err) fourOhfour(response);
        response.writeHead(200, {
            'Content-Type' : mimeTypes[extension]
        });
        response.end(data);
    });
}

const port = 3000;
const server = http.createServer();



server.on('request' , (request, response) => {
    let parsedUrl = url.parse(request.url);
    let staticRequest = onPath(parsedUrl, '/static');

    if (staticRequest) {
       return handleStatic(request, response);
    }

    switch (request.method) {
        case 'GET':
            response.writeHead(303, {
                'Location' : '/static/index.html'
            });
            return response.end();
        default:
           return fourOhfour(response);
    }

});


server.listen(port, () => {
    console.log(`--- LISTENING ON PORT ${port} ---`);
});


