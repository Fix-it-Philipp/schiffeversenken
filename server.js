// Server-Adresse finden
const os = require('os');

const server_ip = () => {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Wir suchen nach IPv4-Adressen, die nicht intern sind
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'IP nicht gefunden';
}

// Websocket starten
const WebSocket = require('ws');

const server = new WebSocket.Server({ port: 8080 });
const clients = new Map(); // Map für clientID -> WebSocket

server.on('connection', (ws) => {
  const clientID = generateUniqueID(); // Funktion zum Generieren einer ID
  clients.set(clientID, ws);
  console.log(`Neuer Client verbunden: ${clientID}`);
    
  ws.on('message', (message) => {
    const data = JSON.parse(message);
    console.log(`${clientID}: ${message}`);

    if (data.type === 'register') {
      let playerExist = false;
      server.clients.forEach((client) => {
        if (client === data.username) playerExist = true;
      });

      if (playerExist) {
        ws.send("Dieser Nutzername ist bereits vergeben. Bitte wähle einene anderen!");
        ws.close();
      } else {
        // Speichere die Verbindung unter dem Usernamen
        clients[data.username] = ws;
        ws.username = data.username; // Optional: direkt auf ws setzen
        ws.send(JSON.stringify(`Willkommen im Spiel! ${ws.username}`));
        console.log(`Benutzer ${data.username} verbunden`);

        sendToAll(ws, `${ws.username} hat die Lobby betreten.`);
      }    
    }
    
    if (data.type === 'message') {
      // Beispiel: Nachricht im Format { targetID: '...', message: '...' }
      if (data.targetID && clients.has(data.targetID)) {
          // Nachricht nur an den Ziel-Client schicken
          sendToOne(data.targetID, data.message);
      } else {
          // Nachricht an alle anderen Clients senden
          sendToAll(ws, `${ws.username}: ${data.message}`);  
      } 
    }
  });

  ws.on('close', () => {
    console.log(`${ws.username} getrennt`);
    sendToAll(ws, `${ws.username} hat die Lobby verlassen.`);
  });
  
});

function sendToOne(targetID, message){
  clients.get(targetID).send(message);
}

function sendToAll(ws, broadcast){
  server.clients.forEach((client) => {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
              client.send(broadcast);
          }
        });  
}

function generateUniqueID() {
  return Math.random().toString(36).substr(2, 9); // einfache ID
}

console.log(`WebSocket-Server läuft auf ws://${server_ip()}:8080/shipwar/`);