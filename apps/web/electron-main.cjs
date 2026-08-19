const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');

let mainWindow;
let server;

function startLocalServer() {
  const webDir = path.join(__dirname, 'out');
  server = http.createServer((req, res) => {
    let urlPath = req.url.split('?')[0] || '/';
    let filePath = path.join(webDir, decodeURI(urlPath));
    
    // Default to index.html for root or folders
    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }
    
    // Fallback to index.html for client-side routing
    if (!fs.existsSync(filePath)) {
      filePath = path.join(webDir, 'index.html');
    }

    const extname = path.extname(filePath);
    let contentType = 'text/html';
    switch (extname) {
      case '.js': contentType = 'text/javascript'; break;
      case '.css': contentType = 'text/css'; break;
      case '.json': contentType = 'application/json'; break;
      case '.png': contentType = 'image/png'; break;
      case '.jpg': contentType = 'image/jpg'; break;
      case '.ico': contentType = 'image/x-icon'; break;
      case '.svg': contentType = 'image/svg+xml'; break;
      case '.woff': contentType = 'font/woff'; break;
      case '.woff2': contentType = 'font/woff2'; break;
      case '.ttf': contentType = 'font/ttf'; break;
    }

    fs.readFile(filePath, (error, content) => {
      if (error) {
        res.writeHead(500);
        res.end(`Error: ${error.code}`);
      } else {
        res.writeHead(200, { 
          'Content-Type': contentType,
          'Access-Control-Allow-Origin': '*' // Enable CORS locally in Electron if needed
        });
        res.end(content, 'utf-8');
      }
    });
  });

  server.listen(0, '127.0.0.1', () => {
    const port = server.address().port;
    createWindow(port);
  });
}

function createWindow(port) {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
    },
    title: "Prince Iyke Inventory",
  });

  // If packaged, load from the local web server; otherwise load the dev server
  const url = app.isPackaged 
    ? `http://127.0.0.1:${port}`
    : 'http://localhost:3000';

  mainWindow.loadURL(url);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('ready', () => {
  if (app.isPackaged) {
    startLocalServer();
  } else {
    createWindow();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
  if (server) {
    server.close();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    if (app.isPackaged) {
      startLocalServer();
    } else {
      createWindow();
    }
  }
});
