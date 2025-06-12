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
const port = process.env.PORT || 8080;

const server = new WebSocket.Server({ port: port });
const clients = new Map(); // Map für clientID -> WebSocket

console.log(`WebSocket-Server läuft auf ws://${server_ip()}:${port}/shipwar/`);
console.log(`Spiel erreichbar unter: http://${server_ip()}:5500`);

// Server-IP in json-Datei schreiben
const fs = require('fs');
const config = {
  ws: `ws://${server_ip()}:${port}/shipwar/`
}
fs.writeFile('config.json', JSON.stringify(config), (err) => {
    if (err) {
        console.error('Fehler beim Schreiben der Datei:', err);
    } else {
        console.log('Datei erfolgreich erstellt und geschrieben.');
    }
});

const challengers = new Array();

server.on('connection', (ws) => {
  const clientID = Math.random().toString(36).substring(2, 9); // Generieren einer ID
  clients.set(clientID, ws);
  console.log(`Neuer Client verbunden: ${clientID}`);

  ws.on('message', (message) => {
    const data = JSON.parse(message);

    switch (data.type){
      case 'register':
        let playerExist = false;
        server.clients.forEach((client) => {
          if (client === clients[data.username]) playerExist = true;
        });

        if (playerExist) {
          const message = { type: 'invalidUsername', from: 'Server', message: `Der Nutzername ${data.username} ist bereits vergeben. Bitte wähle einene anderen!` };
          ws.send(JSON.stringify(message));
          ws.close();
        } else {
          // Speichere die Verbindung unter dem Usernamen
          clients[data.username] = ws;
          ws.username = data.username; // Optional: direkt auf ws setzen
          sendToAll(null, JSON.stringify({ type: 'getAllUsers', from: 'Server', message: getAllUsers() }));
          ws.send(JSON.stringify({ type: '', from: 'Server', message: `Willkommen in der Lobby, ${ws.username}!` }));
          console.log(`Benutzer ${data.username} verbunden`);

          sendToAll(ws, JSON.stringify({ type: '', from: 'Server', message: `${ws.username} hat die Lobby betreten.` }));
        }
        break;
      case 'message':
        // Beispiel: Nachricht im Format { type: '...', targetID: '...', message: '...' }
        console.log(`${clientID}: ${message}`);
        if (data.message !== '') {
          // Nachricht an alle anderen Clients senden
          sendToAll(ws, JSON.stringify({ type: 'message', from: ws.username, message: data.message }));
        }
        break;
      case 'whisper':
        // Beispiel: Nachricht im Format { type: 'whisper', targetID: '...', message: '...' }
        console.log(`${clientID}: ${message}`);
        if (data.message !== '') {
          if (data.targetID && clients[data.targetID]) {
            // Nachricht nur an den Ziel-Client schicken
            sendToOne(data.targetID, JSON.stringify({ type: 'whisper', from: ws.username, message: data.message }));
          }
        }
        break;
      case 'battleMessage':
        // Beispiel: Nachricht im Format { type: 'battleMessage', targetID: '...', message: '...' }
        console.log(`${clientID}: ${message}`);
        if (data.message !== '') {
          if (data.targetID && clients[data.targetID]) {
            // Nachricht nur an den Ziel-Client schicken
            sendToOne(data.targetID, JSON.stringify({ type: 'battleMessage', from: ws.username, message: data.message }));
          }
        }
        break;
      case 'getAllUsers':
        console.log(`${clientID}: ${message}`);
        sendToOne(ws.username, JSON.stringify({ type: 'getAllUsers', message: getAllUsers() }));
        break;
      case 'attack':
        console.log(`${clientID}: ${message}`);
        playerAttack(ws.username, data.message);
        break;
      case 'submitBoard':
        // console.log(`${clientID}: ${message}`);
        submitBoard(ws.username, data.message);
        break;
      case 'challenge':
        switch (data.message) {
          case 'leaveGame': 
          {
            console.log(`${ws.username} beendet die Herausforderung vorzeitig.`);
            endGame(ws.username, null);
            const newChallengers = new Array();
            challengers.forEach(element => { if (element.player1 !== ws.username && element.player2 !== ws.username) newChallengers.push(element); });
            while(challengers.length > 0) { challengers.pop(); }
            newChallengers.forEach(element => { challengers.push(element); });
            }
            break; 
          case 'accepted':
            console.log(`${ws.username} nimmt Herausforderung von ${data.from} an.`);
            prepareNewGame(data.from, ws.username);
            sendToOne(ws.username, JSON.stringify({ type: 'challenge', from: data.from, message: 'prepareFight' }));
            sendToOne(data.from, JSON.stringify({ type: 'challenge', from: ws.username, message: 'prepareFight' }));
            break;
          case 'declined': 
          {
            console.log(`${clientID} lehnt Herausforderung von ${data.from} ab.`);
            const newChallengers = new Array();
            challengers.forEach(element => {
              if (element.player1 !== ws.username && element.player2 !== ws.username) newChallengers.push(element);
            });
            while(challengers.length > 0) { challengers.pop(); }
            newChallengers.forEach(element => {
              challengers.push(element);
            });}
            break;
          default:
            let inquiryOk = true; let playerOccupied = false;
            challengers.forEach(element => {
              if (element.player1 === ws.username || element.player2 === ws.username) inquiryOk = false;
              if (element.player1 === data.targetID || element.player2 === data.targetID) {
                inquiryOk = false;
                playerOccupied = true;
              }
            });
            if (inquiryOk) {
              console.log(`${ws.username} fordert ${data.targetID} heraus.`);
              challengers.push({ player1: ws.username, player2: data.targetID });
              sendToOne(data.targetID, JSON.stringify({ type: 'challenge', from: ws.username, message: 'challenged' }));
            } else {
              if (playerOccupied) sendToOne(ws.username, JSON.stringify({ type: '', from: 'Server', message: `${data.targetID} wurde schon herausgefordert!`}));
              else sendToOne(ws.username, JSON.stringify({ type: '', from: 'Server', message: `Du hast schon jemanden Herausgefordert.`}));
            }
            break;
        }
        break;
      case 'reJoinAfterGame':
        sendToAll(ws.username, JSON.stringify({ type: 'message', from: 'Server', message: `${ws.username} betritt die Lobby.` }));
        sendToOne(ws.username, JSON.stringify({ type: 'message', from: 'Server', message: `Willkommen zurück in der Lobby, ${ws.username}.`}));
        break;
      default:
        break;
    }
  });

  ws.on('close', () => {
    console.log(`${ws.username} getrennt`);
    if (ws.username != undefined)
      sendToAll(ws, JSON.stringify({ type: '', from: 'Server', message: `${ws.username} hat die Lobby verlassen.` }));
  });

});

function getAllUsers() {
  let users = new Array();
  server.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN && !client.isInGame) {
      users.push(client.username);
    }
  });
  return users;
}

function sendToOne(target, message) {
  console.log(target, message);
  server.clients.forEach((client) => {
    if ((client.username === target || client === target) && client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

function sendToAll(absender, broadcast) {
  server.clients.forEach((client) => { 
    if (client !== absender && client.readyState === WebSocket.OPEN && !client.isInGame) {
      client.send(broadcast);
    }
  });
}

//#region Gamemechanics
const { Game } = require('./classes');
const games = new Array();

// Spielerangriff auf ein Feld und Siegüberprüfung
function playerAttack(sender, targetField) {
  let currentGame = games.find((game) => (game.players[0].name === sender || game.players[1].name === sender));
  let targetPlayer, targetBoard, win = false;
  let message = { 
      type: 'attack',
      from: sender, 
      message: targetField,
      success: null,
      turn: sender 
    };
  let hit = null;
  let shipDestroyed = false;

  hit = currentGame.placeShot(sender, targetField);
  if (hit) shipDestroyed = currentGame.shipDestroyed(sender, targetField);

  currentGame.players.forEach(player => { 
    if (player.name !== sender) {
      targetPlayer = player.name;
      targetBoard = player.board;
    }
  })

  if (hit !== null) {
    if (hit) {
      message.success = true;
      message.turn = sender;
      win = currentGame.isGameFinished()
    }
    else {
      message.success = false;
      message.turn = targetPlayer;
    }
  }
    
  sendToOne(sender, JSON.stringify(message));

  if (message.success !== null){
    sendToOne(targetPlayer, JSON.stringify(message));
  }
  
  if (win) {
    currentGame.endGame();
    endGame(sender, targetPlayer);
    // const message = {
    //   type: 'gameFinished',
    //   from: 'Server', 
    //   message: `Das Spiel ist Beendet. ${sender} hat gewonnen!`
    // }
    // sendToOne(sender, JSON.stringify(message));
    // sendToOne(targetPlayer, JSON.stringify(message));
  } else if (shipDestroyed) {
    const message = {
      type: 'shipDestroyed'
    }
    sendToOne(sender, JSON.stringify(message));
  }
}

// Spieler übermittelt sein Board
function submitBoard(sender, playerGrid) {
  console.log((sender + ' schickt sein Board'));
  let submitted = false; let currentGame = games.find((game) => (game.players[0].name === sender || game.players[1].name === sender));
  let enemy = '';
  if (currentGame.players[0].name === sender) {
    submitted = currentGame.setPlayerBoard(sender, playerGrid);
  } else {
    enemy = currentGame.players[0].name;
  }
  if (currentGame.players[1].name === sender) {
    submitted = currentGame.setPlayerBoard(sender, playerGrid);
  } else {
    enemy = currentGame.players[1].name;
  }
  if (submitted) {
    sendToOne(currentGame.players[0].name, JSON.stringify({ type: 'attack', x: '', y: ``, success: null, turn: currentGame.players[0].name }));
    sendToOne(currentGame.players[1].name, JSON.stringify({ type: 'attack', x: '', y: ``, success: null, turn: currentGame.players[0].name }));
    sendToOne(enemy, JSON.stringify({ type: 'ready', from: 'Server', message: `${sender} hat seine Schiffe platziert.` }));
  }

  return submitted;
}

// Startet ein neues Spiel mit zwei Spielern
function prepareNewGame(player1, player2) {
  console.log(`${player1} und ${player2} starten ein neues Spiel.`);
  const game = new Game(player1, player2);
  games.push(game);
  clients[player1].isInGame = true;
  clients[player2].isInGame = true;
  sendToAll(null, JSON.stringify({ type: '', from: 'Server', message: `${player1} und ${player2} verlassen die Lobby um miteinander zu spielen.` }));
  sendToAll(null, JSON.stringify({ type: 'getAllUsers', from: 'Server', message: getAllUsers() }));
}

// Beendet ein bestehendes Spiel
function endGame(player1, player2) {
  let winner = player1;
  const message = {
      type: 'gameFinished',
      from: 'Server', 
      message: `Das Spiel ist Beendet. ${player1} hat das Spiel gewonnen!`
    }
  let currentGame = games.find((game) => (game.players[0].name === player1 || game.players[1].name === player1));
  if (player2 === null) {
    currentGame.players.forEach(player => { 
      if (player.name !== player1) {
        player2 = player.name;
      }
    })
    message.message = `Das Spiel ist Beendet. ${player1} hat das Spiel verlassen!`;
    winner = player2;
  }

  clients[player1].isInGame = false;
  clients[player2].isInGame = false;
  const newChallengers = new Array();
  challengers.forEach(element => { 
    if (element.player1 !== player1 && element.player2 !== player1) newChallengers.push(element); 
    else console.log(element, ' wird gelöscht!');
  });
  while(challengers.length > 0) { challengers.pop(); }
  newChallengers.forEach(element => { challengers.push(element); });
  sendToOne(player1, JSON.stringify(message));
  sendToOne(player2, JSON.stringify(message));
  setTimeout(() => sendToAll(null, JSON.stringify({ type: '', from: 'Server', message: `${player1} und ${player2} sind fertig mit spielen. ${(winner === player1)?player1+' hat gewonnen.':player1+' hat aufgegeben.'}`})),3000);
}
//#endregion
