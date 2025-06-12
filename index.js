"use strict";

// Initialisieren des Spiels
createLobby();
connectionStatus('');

//#region Konstanten und Variablen Definition
const config = await ladeConfig();
const ws_server = await config.ws;

let socket;
let user = {
    username: '',
    ready: false,
    turn: false,
    inGame: false
}
let enemyUser = {
    username: '',
    ready: false,
    turn: false
}
let gameId = '';

// Spielgrößen
const gridSize = 10;
const gridWidth = 30;
// Arrays für die Boards
let playerBoard = [];
let enemyBoard = [];

// Initialisierung der Boards
for (let y = 0; y < gridSize; y++) { playerBoard[y] = []; }
for (let y = 0; y < gridSize; y++) { enemyBoard[y] = []; }

// Grid initialisieren
let grid = new Array(gridSize);
for (let index = 0; index < grid.length; index++) {
    grid[index] = new Array(gridSize);
    enemyBoard[index] = new Array(gridSize);
}
for (let indexY = 0; indexY < gridSize; indexY++) {
    for (let indexX = 0; indexX < gridSize; indexX++) {
        grid[indexY][indexX] = {
            occupied: false,
            dataset: {
                startX: null,
                startY: null,
                orientation: null,
                shipSize: null,
                origin: null
            },
            element: null,
            hasShip: false,
            hit: false,
            coords: {
                x: indexX,
                y: indexY
            }
        }
        enemyBoard[indexY][indexX] = { element: null };
    }
}

let currentOrientation = true; // true = horizontal, false = vertikal
let currentSize = 2; // Standardgröße
const ships = [[  // bilder der verschiedenen Schiffgrößen und Ausrichtungen
    { src: null }, { src: null }, // zweimal "null" für Indexstart des Arrays bei 2 und Ende bei 5 wegen Schiffgrößen
    { src: 'small_h.png' },
    { src: 'medium_h.png' },
    { src: 'large_h.png' },
    { src: 'very_large_h.png' }
], [
    { src: null }, { src: null },
    { src: 'small_v.png' },
    { src: 'medium_v.png' },
    { src: 'large_v.png' },
    { src: 'very_large_v.png' }
]];
const images = {    // weitere bilder
    hit: 'hit.png',
    miss: 'miss.png',
    wait: 'warten_auf_spieler.png',
    turn: 'warten_auf_spielerzug.png',
    shipDestroyed: 'shipDestroyed.png'
};
//#endregion

//#region Kommunikationsfunktionen mit dem Server
// Funktion zum Laden der config.json
async function ladeConfig() {
    try {
        const response = await fetch('config.json');
        if (!response.ok) throw new Error('Netzwerkfehler beim Laden der Konfiguration');
        let config = await response.json();

        // Anzeige der geladenen Konfiguration
        console.log('Konfiguration geladen, Verbindung möglich!');
        return config;
    } catch (error) {
        console.log('Fehler beim Laden der Konfiguration.');
        console.error(error);
    }
}

// Funktion zum rendern der Lobby
function createLobby() {
    const body = document.getElementById('body');

    while (body.hasChildNodes()) body.removeChild(body.firstChild);

    const header = document.createElement('h1');
    header.textContent = 'Schiffeversenken';
    body.appendChild(header);

    const chatControls = document.createElement('div');
    chatControls.id = 'chatControls';
    chatControls.style.marginTop = '20px';
    chatControls.style.marginBottom = '20px';
    body.appendChild(chatControls);

    const chat = document.createElement('div');
    chat.id = 'chat';
    // chat.style.marginTop = 20;
    body.appendChild(chat);

    const popupOverlay = document.createElement('div');
    popupOverlay.id = 'popupOverlay';
    popupOverlay.className = 'popupOverlay';
    body.appendChild(popupOverlay);

    return true;
}

// Websocket Eventbehandlung
function connectionStatus(param) {
    const body = document.getElementById('body');

    while (body.hasChildNodes()) body.removeChild(body.firstChild);

    createLobby();

    const connectionDiv = document.getElementById('chatControls');
    while (connectionDiv.hasChildNodes()) {
        connectionDiv.removeChild(connectionDiv.firstChild);
    }

    if (param === "connected") {
        const sndBtn = document.createElement('button');
        sndBtn.id = "sendBtn"; sndBtn.textContent = "Senden";

        const input = document.createElement('input');
        input.type = "text"; input.placeholder = "Nachricht eingeben"; input.id = "messageInput";

        const discBtn = document.createElement('button');
        discBtn.id = "disconnectBtn"; discBtn.textContent = "Trennen";

        const userSelect = document.createElement('select');
        userSelect.id = "selectUser"; userSelect.placeholder = "Flüstern";

        const challengePlayer = document.createElement('button');
        challengePlayer.id = "challengePlayer"; challengePlayer.textContent = "Spieler herausfordern";
        challengePlayer.disabled = true;

        connectionDiv.appendChild(userSelect);
        connectionDiv.appendChild(input);
        connectionDiv.appendChild(sndBtn);
        connectionDiv.appendChild(challengePlayer);
        connectionDiv.appendChild(discBtn);

        discBtn.onclick = () => { if (socket && socket.readyState === WebSocket.OPEN) socket.close(); }
        sndBtn.onclick = () => { sendMessage(); };
        userSelect.onchange = () => {
            if (userSelect.value !== 'all') challengePlayer.disabled = false;
            else challengePlayer.disabled = true;
        }
        challengePlayer.onclick = () => {
            if (socket && socket.readyState === WebSocket.OPEN) {
                const messageTo = document.getElementById('selectUser');
                socket.send(JSON.stringify({
                    type: 'challenge',
                    targetID: messageTo.value,
                    message: ''
                }));
            } else {
                log('Verbindung ist nicht offen.');
            };
        };
        input.onkeyup = (button) => { if (button.key === 'Enter') sendMessage(); }

    } else {
        const input = document.createElement('input');
        input.type = "text"; input.name = "username"; input.id = "username";
        input.required = true; input.placeholder = "Username eingeben";
        const button = document.createElement('button');
        button.id = "connectBtn"; button.textContent = "Verbinden";
        connectionDiv.appendChild(input);
        connectionDiv.appendChild(button);

        document.getElementById('connectBtn').onclick = () => {
            socket = new WebSocket(ws_server);
            socket.onopen = () => {
                const username = connectionDiv.querySelector('#username').value;
                // Sende den Benutzernamen an den Server
                const message = { type: 'register', username: username, message: "Registrieren" };
                user.username = username;
                console.log("Verbunden als: " + user.username);
                socket.send(JSON.stringify(message));
                connectionStatus("connected");
                log('Verbindung hergestellt.');
            };

            socket.onmessage = (event) => {
                const data = JSON.parse(event.data);
                // console.log(data);
                switch (data.type) {
                    case 'getAllUsers':
                        if (!user.inGame) updateUserSelection(data.message);
                        break;
                    case 'whisper':
                        log(`${data.from} flüstert: ${data.message}`);
                        break;
                    case 'attack':
                        if (data.success !== null) {
                            let coords = JSON.parse(data.message);
                            attackCell(coords.x, coords.y, data.success, data.from);
                            waitingForPlayerTurn(true);
                        }
                        if (data.turn === user.username) {
                            waitingForPlayerTurn(false);
                            user.turn = true;
                        }
                        break;
                    case 'challenge':
                        switch (data.message) {
                            case 'challenged':
                                challengeInquiry(data.from).then((antwort) => {
                                    if (antwort) {
                                        if (socket && socket.readyState === WebSocket.OPEN) {
                                            socket.send(JSON.stringify({
                                                type: 'challenge',
                                                from: data.from,
                                                message: 'accepted'
                                            }));
                                        } else log('Verbindung ist nicht offen.');
                                    } else {
                                        if (socket && socket.readyState === WebSocket.OPEN) {
                                            socket.send(JSON.stringify({
                                                type: 'challenge',
                                                from: data.from,
                                                message: 'declined'
                                            }));
                                        } else log('Verbindung ist nicht offen.');
                                    }
                                });
                                break;
                            case 'prepareFight':
                                enemyUser.username = data.from;
                                user.inGame = true;
                                log(`${data.from} akzeptiert deine Herausforderung!`);
                                prepareNewGame();
                                break;
                            default:
                                break;
                        }
                        break;
                    case 'gameFinished':
                        user.turn = false;
                        user.inGame = false;
                        popup(data.message).then((antwort) => {
                            if (antwort) {
                                connectionStatus('connected');
                                socket.send(JSON.stringify({
                                    type: 'getAllUsers',
                                    message: 'getAllUsers'
                                }));
                                socket.send(JSON.stringify({
                                    type: 'reJoinAfterGame',
                                    message: ''
                                }));
                            }
                        });
                        break;
                    case 'battleMessage':
                        log(`${data.from}: ${data.message}`)
                        break;
                    case 'ready':
                        enemyUser.ready = true;
                        if (user.ready) fillFields();
                        log(`${data.from}: ${data.message}`);
                        break;
                    case 'shipDestroyed':
                        shipDestroyed(true).then((antwort) => { shipDestroyed(false); });
                        break;
                    default:
                        if (data.from != user.username) log(`${data.from}: ${data.message}`);
                        break;
                }
            };

            socket.onclose = () => {
                connectionStatus("");
                log('Verbindung geschlossen.');
            };

            socket.onerror = (error) => {
                log(`Fehler: ${error.message}`);
            };

        };
    }
}

// Logfunktion für Spielerchat
function log(message) {
    const logDiv = document.getElementById('chat');
    const p = document.createElement('p');
    p.textContent = message;
    logDiv.appendChild(p);
    logDiv.scrollTop = logDiv.scrollHeight;
}

// Nachricht an User schicken
function sendMessage() {
    const message = document.getElementById('messageInput').value;
    const targetUser = document.getElementById('selectUser').value;
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
            type: ((targetUser === 'all') ? 'message' : 'whisper'),
            targetID: targetUser,
            message: message
        }));

        log(((targetUser === 'all') ? 'An alle: ' : 'An ' + targetUser + ': ') + message);
    } else {
        log('Verbindung ist nicht offen.');
    }
    document.getElementById('messageInput').value = '';
}

// Kampfnachricht an User schicken
function sendBattleMessage() {
    const message = document.getElementById('messageInput').value;
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
            type: 'battleMessage',
            targetID: enemyUser.username,
            message: message
        }));

        log('Du: ' + message);
    } else {
        log('Verbindung ist nicht offen.');
    }
    document.getElementById('messageInput').value = '';
}

// Spielerboard an den Server schicken
function sendBoardToServer(board) {
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
            type: 'submitBoard',
            message: JSON.stringify(board)
        }));
        // console.log(board);

    } else {
        log('Verbindung ist nicht offen.');
    }
    user.ready = true;
    if (enemyUser.ready) fillFields();
}

// Nachricht an Server schicken
function sendMessageToServer(message) {
    if (!user.turn) return;
    // const message = { type: 'attack', message: message };
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
            type: 'attack',
            targetID: enemyUser.name,
            message: JSON.stringify(message)
        }));
        user.turn = false;
    } else {
        log('Verbindung ist nicht offen.');
    }
}

// Userselection updaten
async function updateUserSelection(connectedUsers) {
    const userSelect = document.getElementById('selectUser');
    while (userSelect.hasChildNodes()) {
        userSelect.removeChild(userSelect.firstChild);
    }
    const firstOption = document.createElement('option');
    firstOption.id = 'all';
    firstOption.value = 'all';
    firstOption.text = 'Alle';
    userSelect.appendChild(firstOption);

    connectedUsers.forEach(element => {
        if (element !== user.username) {
            const option = document.createElement('option');
            option.id = element;
            option.value = element;
            option.text = element;
            userSelect.appendChild(option);
        }
    });
}
//#endregion

//#region Spielfunktionen
// Spiel vorzeitig beenden funktion
function leaveGame() {
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
            type: 'challenge',
            message: 'leaveGame'
        }));
    } else {
        log('Verbindung ist nicht offen.');
    }
}

// Starte Vorbereitungen für ein neues Spiel
function prepareNewGame() {
    const body = document.getElementById('body');

    while (body.hasChildNodes()) body.removeChild(body.firstChild);

    const header = document.createElement('h1');
    header.textContent = 'Schiffeversenken';
    body.appendChild(header);

    const gameContainer = document.createElement('div');
    gameContainer.id = 'game-container'; gameContainer.className = 'game-container';

    const playerField = document.createElement('div');
    playerField.id = 'playerField'; playerField.className = 'field';

    const headerField = document.createElement('h2');
    headerField.id = 'header'; headerField.textContent = 'Dein Spielfeld';
    playerField.appendChild(headerField);

    const gridDiv = document.createElement('div');
    gridDiv.id = 'grid';
    playerField.appendChild(gridDiv);

    gameContainer.appendChild(playerField);

    const enemyField = document.createElement('div');
    enemyField.id = 'enemyField'; enemyField.className = 'field';
    enemyField.oncontextmenu = (event) => { event.preventDefault(); changeOrientation(); }

    const headerField2 = document.createElement('h2');
    headerField2.id = 'header'; headerField2.textContent = 'Platziere deine Schiffe';
    enemyField.appendChild(headerField2);

    const p = document.createElement('p');
    p.textContent = 'Rechtsklick um die Ausrichtung zu ändern';
    enemyField.appendChild(p);

    const dragElements = document.createElement('div');
    {
        dragElements.id = 'dragelements'; dragElements.className = 'dragelements';
        const shipImages = new Array();

        const ship1 = document.createElement('div');
        const ship1Image = document.createElement('img');
        ship1Image.id = 'small';
        ship1Image.src = `./images/${ships[0][2].src}`;
        ship1Image.style = '--size:2;';
        shipImages.push(ship1Image);
        ship1.appendChild(ship1Image);
        dragElements.appendChild(ship1);

        const ship2 = document.createElement('div');
        const ship2Image = document.createElement('img');
        ship2Image.id = 'medium';
        ship2Image.src = `./images/${ships[0][3].src}`;
        ship2Image.style = '--size:3;';
        shipImages.push(ship2Image);
        ship2.appendChild(ship2Image);
        dragElements.appendChild(ship2);

        const ship3 = document.createElement('div');
        const ship3Image = document.createElement('img');
        ship3Image.id = 'medium2';
        ship3Image.src = `./images/${ships[0][3].src}`;
        ship3Image.style = '--size:3;';
        shipImages.push(ship3Image);
        ship3.appendChild(ship3Image);
        dragElements.appendChild(ship3);

        const ship4 = document.createElement('div');
        const ship4Image = document.createElement('img');
        ship4Image.id = 'large';
        ship4Image.src = `./images/${ships[0][4].src}`;
        ship4Image.style = '--size:4;';
        shipImages.push(ship4Image);
        ship4.appendChild(ship4Image);
        dragElements.appendChild(ship4);

        const ship5 = document.createElement('div');
        const ship5Image = document.createElement('img');
        ship5Image.id = 'very_large';
        ship5Image.src = `./images/${ships[0][5].src}`;
        ship5Image.style = '--size:5;';
        shipImages.push(ship5Image);
        ship5.appendChild(ship5Image);

        dragElements.appendChild(ship5);

        shipImages.forEach(shipImage => {
            shipImage.className = 'ship';
            shipImage.name = 'shipsToPlace';
            shipImage.style.margin = '15px';
            shipImage.draggable = true;
            shipImage.ondragstart = (e) => { onDragStart(e); }
        });
    }
    enemyField.appendChild(dragElements);
    gameContainer.appendChild(enemyField);

    const chat = document.createElement('div');
    chat.className = 'chat';
    const chatDiv1 = document.createElement('div');
    const chatText = document.createElement('h2'); chatText.textContent = 'Chat';
    chatDiv1.appendChild(chatText);
    chat.appendChild(chatDiv1);

    const chatDiv2 = document.createElement('div');
    chatDiv2.id = 'chat'; chatDiv2.className = 'chatLog'; chatDiv2.style.overflowY = 'auto';
    chat.appendChild(chatDiv2);

    const chatDiv3 = document.createElement('div');
    chatDiv3.id = 'chatControls'; chatDiv3.className = 'chatControls';
    chat.appendChild(chatDiv3);

    gameContainer.appendChild(chat);

    body.appendChild(gameContainer);

    const controls = document.createElement('div');
    controls.className = 'controls'; controls.id = 'controls';
    body.appendChild(controls);

    const popUp = document.createElement('div');
    popUp.id = 'popupOverlay'; popUp.style.display = 'none'; popUp.style.position = 'fixed'; popUp.style.top = 0; popUp.style.left = 0;
    popUp.style.width = '100%'; popUp.style.height = '100%'; popUp.style.background = 'rgba(0,0,0,0.5)';
    popUp.style.justifyContent = 'center'; popUp.style.alignItems = 'center';
    body.appendChild(popUp);

    renderGrid();
    fillControls();
}

// Spiel starten und auf Gegener warten
function startGame() {
    const shipsToPlace = document.getElementsByName('shipsToPlace');
    let notAllShipsPlaced = false;
    shipsToPlace.forEach(element => {
        if (element.draggable) {
            notAllShipsPlaced = true;
        }
    });

    // TODO: Aktivieren!
    if (notAllShipsPlaced) {
        alert('Bitte erst alle Schiffe platzieren!');
        return;
    }

    const controls = document.getElementById('controls');
    const startBtn = document.getElementById('startBtn');
    controls.removeChild(startBtn);

    const enemyField = document.getElementById('enemyField');
    while (enemyField.hasChildNodes()) { enemyField.removeChild(enemyField.firstChild); }
    enemyField.className = 'field';
    const header = document.createElement('h2');    // <h2>Gegner</h2>
    header.textContent = 'Gegner';
    enemyField.appendChild(header);
    const image = document.createElement('img');
    image.src = './images/' + images.wait; image.height = 300; image.width = 300;
    enemyField.appendChild(image);

    playerBoard = grid;
    sendBoardToServer(grid);
}

// Nachdem alle beigetreten sind die Spielfelder befüllen
function fillFields() {
    const playerField = document.getElementById('playerField');
    while (playerField.hasChildNodes()) { playerField.removeChild(playerField.firstChild); }

    const playerHeader = document.createElement('h2');    // <h2>Player</h2>
    playerHeader.textContent = 'Dein Spielfeld';
    playerField.appendChild(playerHeader);

    const playerContainer = document.createElement('div');
    playerContainer.className = 'board';
    playerContainer.id = 'playerBoard';
    playerField.appendChild(playerContainer);

    createBoard('playerBoard', playerBoard, true);

    const enemyField = document.getElementById('enemyField');
    while (enemyField.hasChildNodes()) { enemyField.removeChild(enemyField.firstChild); }
    enemyField.className = 'field';
    const header = document.createElement('h2');    // <h2>Gegner</h2>
    header.textContent = 'Gegner';
    enemyField.appendChild(header);

    const enemyContainer = document.createElement('div');
    enemyContainer.className = 'board';
    enemyContainer.id = 'enemyBoard';
    enemyField.appendChild(enemyContainer);

    createBoard('enemyBoard', enemyBoard, false);
    popup((user.turn ? user.username : enemyUser.username) + ' beginnt das Spiel!');
    if (!user.turn) waitingForPlayerTurn(true);
}

// Buttons für die Spielkontrolle (Start, Ende, etc)
function fillControls() {
    const container = document.getElementById('controls');

    const startButton = document.createElement('button');
    startButton.id = 'startBtn';
    startButton.textContent = 'Starte Spiel';
    startButton.className = 'button';
    startButton.addEventListener('click', () => {
        startGame();
    });
    container.appendChild(startButton);

    const leftGame = document.createElement('button');
    leftGame.id = 'leaveBtn';
    leftGame.textContent = 'Spiel Verlassen';
    leftGame.className = 'button';
    leftGame.addEventListener('click', () => {
        leaveGame();
    });
    container.appendChild(leftGame);

    const chatContainer = document.getElementById('chatControls');

    const sndBtn = document.createElement('button');
    sndBtn.id = "sendBtn"; sndBtn.textContent = "Senden";
    sndBtn.addEventListener('click', () => {
        console.log('Klick');
        sendBattleMessage();
    });

    const input = document.createElement('input');
    input.type = "text"; input.placeholder = "Nachricht eingeben"; input.id = "messageInput";
    input.onkeyup = (button) => {
        if (button.key === 'Enter') sendBattleMessage();
    }

    chatContainer.appendChild(input);
    chatContainer.appendChild(sndBtn);
}

// Grid rendern
function renderGrid() {
    const container = document.getElementById('grid');
    container.innerHTML = '';

    for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.dataset.x = x;
            cell.dataset.y = y;

            if (grid[y][x].occupied) {
                cell.dataset.occupied = true;
                if (grid[y][x].dataset.startX === x && grid[y][x].dataset.startY === y) {
                    const img = document.createElement('img');
                    img.className = 'ship delete ' + (grid[y][x].dataset.orientation ? 'horizontal' : 'vertical');
                    img.src = './images/' + ships[(grid[y][x].dataset.orientation ? 0 : 1)][grid[y][x].dataset.shipSize].src;
                    img.style = `--size:${(grid[y][x].dataset.shipSize * gridWidth) - 1};`;
                    cell.appendChild(img);
                }
            }

            // Drag & Drop Events
            cell.ondragover = (e) => { e.preventDefault(); markCells(cell, currentSize, currentOrientation, false); }
            cell.ondragleave = (e) => { e.preventDefault(); markCells(cell, currentSize, currentOrientation, true); };
            cell.ondrop = (e) => {
                e.preventDefault();
                const size = parseInt(e.dataTransfer.getData('text/plain'));
                placeElement(x, y, size, currentOrientation, e.dataTransfer.getData('origin'));
            };

            // Eventhandler zum entfernen
            if (grid[y][x].occupied) cell.addEventListener('click', () => { resetShip(grid[y][x]) });

            container.appendChild(cell);
        }
    }
}

// Funktion zum Erstellen der Boards
function createBoard(containerId, boardArray, isPlayer) {
    const container = document.getElementById(containerId);

    for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.dataset.x = x;
            cell.dataset.y = y;
            // Für das Gegnerfeld nur bei Klick angreifen
            if (!isPlayer) {
                cell.addEventListener('click', () => sendMessageToServer({ x: x, y: y }));
            } else {
                cell.style.cursor = 'default';
            }

            container.appendChild(cell);

            if (isPlayer) {
                if (boardArray[y][x].occupied) {
                    cell.dataset.occupied = true;
                    if (boardArray[y][x].dataset.startX === x && boardArray[y][x].dataset.startY === y) {
                        const img = document.createElement('img');
                        img.className = 'ship ' + (boardArray[y][x].dataset.orientation ? 'horizontal' : 'vertical');
                        img.src = './images/' + ships[(boardArray[y][x].dataset.orientation ? 0 : 1)][boardArray[y][x].dataset.shipSize].src;
                        // img.style = `--size:${(boardArray[y][x].dataset.shipSize*gridWidth)-1};`;
                        img.width = (boardArray[y][x].dataset.orientation) ? (boardArray[y][x].dataset.shipSize * gridWidth) - 1 : 28;
                        img.height = (!boardArray[y][x].dataset.orientation) ? (boardArray[y][x].dataset.shipSize * gridWidth) - 1 : 28;
                        cell.appendChild(img);
                    }
                }
            }
            else {
                enemyBoard[y][x].element = cell;
                // // Zufällig Schiffe auf Gegner setzen (z.B. zufällig mit Wahrscheinlichkeit)
                // if (Math.random() < 0.2) { // ca.20% Chance auf Schiff
                //     boardArray[y][x].hasShip = true;
                // Für echtes Spiel kannst du hier mehr Logik hinzufügen.
                // }
            }
            // Speichern im DOM-Element für spätere Änderungen
            boardArray[y][x].element = cell;
        }
        // Zeilenumbruch nach jeder Zeile ist durch Grid bereits gemacht.
    }
}

// Funktion zum Angreifen des Gegners
function attackCell(x, y, hit, target) {
    let cellData;
    if (target !== user.username) cellData = playerBoard[y][x].element;
    else cellData = enemyBoard[y][x].element;

    const image = document.createElement('img'); // img
    image.width = 28;

    if (hit) {
        if (target === user.username) cellData.className += ' hit';
        image.className = 'hit';
        image.src = './images/' + images.hit;
    }
    else {
        cellData.className += ' miss';
        // image.className = 'miss';
        image.src = './images/' + images.miss;
    }

    cellData.appendChild(image);
}

// Funktion zum Setzen der Ausrichtung
function changeOrientation() {
    currentOrientation = !currentOrientation;
    //   document.getElementById('currentOrientation').textContent = (currentOrientation)?'horizontal':'vertikal';
    const ships = document.getElementsByName('shipsToPlace');
    ships.forEach(element => {
        let src = element.src;
        let image = String(src).substring((src).lastIndexOf('/') + 1);
        image = image.substring(image.length - 5).replace(!currentOrientation ? 'h' : 'v', currentOrientation ? 'h' : 'v');
        src = src.substring(0, src.length - 5) + image;
        element.src = src;
        let size = element.style.cssText; size = size.slice((size.length - 2), (size.length - 1));
        element.setAttribute((!currentOrientation ? 'height' : 'width'), 30 * size);
        element.setAttribute((currentOrientation ? 'height' : 'width'), 30);
        element.className = 'ship ' + (currentOrientation ? 'horizontal' : 'vertical') + (element.draggable ? '' : ' disabled');

    });
    document.getElementById('dragelements').style.gridTemplateColumns = (!currentOrientation ? '1fr 1fr 1fr 1fr 1fr' : '1fr 1fr');
}

// Event-Handler für Drag & Drop
function onDragStart(e) {
    currentSize = parseInt(e.srcElement.style.cssText.split(' ')[1].substring(0, 1));
    e.dataTransfer.setData('text/plain', currentSize); // Größe übertragen
    e.dataTransfer.setData('origin', e.srcElement.id);
}

// Zellen für platzierung markieren
function markCells(cell, size, orientation, demark) {
    let startX = parseInt(cell.dataset.x), startY = parseInt(cell.dataset.y);
    const cells = document.querySelectorAll('.cell');
    cells.forEach(cell => {
        for (let i = 0; i < size; i++) {
            if (parseInt(cell.dataset.x) === (orientation ? startX + i : startX) &&
                parseInt(cell.dataset.y) === (!orientation ? startY + i : startY))
                if (!demark) cell.classList.add((cell.dataset.occupied) ? 'blocked' : 'occupied');
                else if (!cell.dataset.occupied) cell.classList.remove('occupied');
                else cell.classList.remove('blocked');
        }
    });
}

// Lösche ein Schiff während des Platzierungsvorgangs
function resetShip(origin) {
    const positions = [];
    for (let i = 0; i < origin.dataset.shipSize; i++) {

        let x = origin.dataset.startX + (origin.dataset.orientation ? i : 0);
        let y = origin.dataset.startY + (!origin.dataset.orientation ? i : 0);
        positions.push({ x, y });
    }

    // Schiff wieder platzierbar machen
    document.getElementById(origin.dataset.origin).setAttribute('draggable', 'true');
    document.getElementById(origin.dataset.origin).classList.remove('disabled');

    // Deplatzierung durchführen
    for (const pos of positions) {
        grid[pos.y][pos.x].hasShip = false;
        grid[pos.y][pos.x].occupied = false;
        grid[pos.y][pos.x].dataset = {
            startX: null,
            startY: null,
            orientation: null,
            shipSize: null,
            origin: null
        };
    }
    renderGrid();
}

// Platzieren eines Schiffes durch DragDrop
function placeElement(startX, startY, size, orientation, origin) {

    // Überprüfung der Grenzen und Belegung
    const positions = [];
    for (let i = 0; i < size; i++) {
        let x = startX + (orientation ? i : 0);
        let y = startY + (!orientation ? i : 0);
        let placementNotOk = false;

        if (x < 0 || x >= gridSize || y < 0 || y >= gridSize) {
            alert('Platzierung außerhalb des Rasters!');
            placementNotOk = true;
        }

        if (grid[y][x].occupied) {
            alert('Feld bereits belegt!');
            placementNotOk = true;

        }

        if (placementNotOk) return;

        renderGrid();
        positions.push({ x, y });

    }

    document.getElementById(origin).setAttribute('draggable', 'false');
    document.getElementById(origin).classList.add('disabled');

    // Platzierung durchführen
    for (const pos of positions) {
        grid[pos.y][pos.x].hasShip = true;
        grid[pos.y][pos.x].occupied = true;
        grid[pos.y][pos.x].dataset = {
            startX: startX,
            startY: startY,
            orientation: orientation,
            shipSize: size,
            origin: origin
        };
    }

    renderGrid();

}
//#endregion

//#region Popups
// Warten auf Spieler Popup
function waitingForPlayerTurn(einschalten) {
    const overlay = document.getElementById('popupOverlay');
    while (overlay.hasChildNodes()) overlay.removeChild(overlay.firstChild);

    if (einschalten) {
        const div = document.createElement('div');
        div.style = "background: rgba(0,0,0,0); border-radius:8px; max-width:300px; max-height:200px; text-align:center; align-items:center;";

        const image = document.createElement('img');
        image.src = "./images/" + images.turn; image.width = 300; image.style.borderRadius = '8px';
        image.style.zIndex = 199;
        div.appendChild(image);
        overlay.appendChild(div);
        overlay.style.display = 'flex';
        overlay.style.top = 'calc(50% - 100px)';
        overlay.style.left = 'calc(50% - 150px)';
        overlay.style.width = '300px';
        overlay.style.height = '200px';
    } else {
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.display = 'none';
    }
}

// Schiff zerstört Popup
function shipDestroyed(einschalten) {
    return new Promise((resolve) => {
        const overlay = document.getElementById('popupOverlay');
        while (overlay.hasChildNodes()) overlay.removeChild(overlay.firstChild);

        if (einschalten) {
            const div = document.createElement('div');
            div.style = "background: rgba(0,0,0,0); border-radius:8px; max-width:300px; max-height:200px; text-align:center; align-items:center;";

            const okButton = document.createElement('button');
            okButton.id = "okButton"; okButton.textContent = 'OK';
            okButton.style.margin = "10px"; okButton.style.width = "100px";
            okButton.style.zIndex = 200;

            const image = document.createElement('img');
            image.src = "./images/" + images.shipDestroyed; image.width = 300; 
            image.style.borderRadius = '8px';
            image.style.zIndex = 199;

            div.appendChild(image);
            overlay.appendChild(div);
            overlay.style.display = 'flex';
            overlay.style.top = 'calc(50% - 100px)';
            overlay.style.left = 'calc(50% - 150px)';
            overlay.style.width = '300px';
            overlay.style.height = '200px';

            image.onclick = () => {
                resolve(true);
            };
        } else {
            overlay.style.top = '0';
            overlay.style.left = '0';
            overlay.style.width = '100%';
            overlay.style.height = '100%';
            overlay.style.display = 'none';
        }
    })
}

// Popup für Nachricht
function popup(message) {
    return new Promise((resolve) => {
        const overlay = document.getElementById('popupOverlay');
        while (overlay.hasChildNodes()) overlay.removeChild(overlay.firstChild);

        const div = document.createElement('div');
        div.style = "background:#fff; padding:20px; border-radius:8px; max-width:300px; text-align:center;";

        const okButton = document.createElement('button');
        okButton.id = "okButton"; okButton.textContent = 'OK';
        okButton.style.margin = "10px"; okButton.style.width = "100px";

        const p = document.createElement('p');
        p.textContent = `${message}`;
        div.appendChild(p);
        div.appendChild(okButton);
        overlay.appendChild(div);
        overlay.style.display = 'flex';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';

        okButton.onclick = () => {
            overlay.style.display = 'none';
            resolve(true);
        };
    });
}

// Popup für Kampfanfrage
function challengeInquiry(challenger) {
    return new Promise((resolve) => {
        const overlay = document.getElementById('popupOverlay');
        while (overlay.hasChildNodes()) overlay.removeChild(overlay.firstChild);

        const div = document.createElement('div');
        div.style = "background:#fff; padding:20px; border-radius:8px; max-width:300px; text-align:center;";

        const yesButton = document.createElement('button');
        yesButton.id = "jaButton"; yesButton.textContent = 'Ja';
        yesButton.style.margin = "10px"; yesButton.style.width = "100px";

        const noButton = document.createElement('button');
        noButton.id = "neinButton"; noButton.textContent = 'Nein';
        noButton.style.margin = "10px"; noButton.style.width = "100px";

        const p = document.createElement('p');
        p.textContent = `${challenger} fordert dich zum Schiffskampf auf! Nimmst du an?`;
        div.appendChild(p);
        div.appendChild(yesButton);
        div.appendChild(noButton);
        overlay.appendChild(div);
        overlay.style.display = 'flex';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';

        yesButton.onclick = () => {
            overlay.style.display = 'none';
            resolve(true); // Nutzer sagt Ja
        };

        noButton.onclick = () => {
            overlay.style.display = 'none';
            resolve(false); // Nutzer sagt Nein
        };
    });
}
//#endregion