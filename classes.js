export class Game{
    gameId = new String();
    running = new Boolean();
    beginn = Date.now();
    end = new Date();
    players = [{
        name: '',
        board: new Array()
            //   occupied: false,
            //   dataset: {
            //     startX: null,
            //     startY: null,
            //     orientation: null,
            //     shipSize: null,
            //     origin: null
            //   },
            //   element: null, 
            //   hasShip: false, 
            //   hit: false,
            //   coords: {
            //      x: null,
            //      y: null
            //   }
    },{
        name: '',
        board: new Array()
    }];
    shots = new Array();

    constructor(player1, player2){
        const gameId = Math.random().toString(36).substring(2, 9); // Generieren einer ID
        let running = true;
        this.players[0].name = player1;
        this.players[1].name = player2;
    }

    // registerToGame(newPlayer){      
    //     let alreadySet = false;  

    //     this.players.forEach(player => {
    //         if (player.name === '' && !alreadySet) {
    //             console.log(newPlayer + ' zum Spiel hinzugefügt.');
    //             player.name = newPlayer;
    //             // alreadySet = true;
    //             return true;
    //         }
    //     });
    //     console.log(newPlayer + ' konnte nicht hinzugefügt werden.');
    //     console.log(this.players);
    //     return false;
    // }

    setPlayerBoard(sender, board){
        console.log('Aufruf setPlayerBoard von ' + sender);
        let alreadySet = false;
        this.players.forEach(player => {
            if (player.name === sender) {
                player.board = JSON.parse(board);
                alreadySet = true;
            }
        });
        return alreadySet;
    }

    placeShot(attacker, data){
        // coord like { x: 1, y: 8 }
        let coords = JSON.parse(data); let result = null;
        this.shots.push({ timestamp: Date.now(), attacker: attacker, coords: coords });
        this.players.forEach(player => {
            if (player.name !== attacker) {
                player.board.forEach((line) => {
                    line.forEach(cell => {
                        if (parseInt(cell.coords.x) === coords.x && parseInt(cell.coords.y) === coords.y) {
                            if (!cell.hit) {
                                cell.hit = true;
                                if (cell.hasShip) result =  true;
                                else result = false;
                            }
                        }
                    });
                });
            }
        });
        return result;
    }

    shipDestroyed(attacker, data){
        let coords = JSON.parse(data); 
        let result = true;
        let currentCell = null;
        const positions=[];

        this.players.forEach(player => {
            if (player.name !== attacker) {
                player.board.forEach((line) => {
                    line.forEach(cell => {
                        if (parseInt(cell.coords.x) === coords.x && parseInt(cell.coords.y) === coords.y) currentCell = cell; 
                    });
                });
            }
        });

        for(let i=0;i<currentCell.dataset.shipSize;i++){
            let x=currentCell.dataset.startX+(currentCell.dataset.orientation?i:0);
            let y=currentCell.dataset.startY+(!currentCell.dataset.orientation?i:0);
            positions.push({x,y});
        }

        for(const pos of positions){
            this.players.forEach(player => {
                if (player.name !== attacker) {
                    player.board.forEach((line) => {
                        line.forEach(cell => {
                            if (parseInt(cell.coords.x) === pos.x && parseInt(cell.coords.y) === pos.y) 
                                if (!cell.hit) result = false;
                        });
                    });
                }
            });
        }   
        return result;
    }

    isGameFinished(){
        let resultFirst = true, resultSecond = true; 
        for (const line of this.players[0].board){
            for (const cell of line) {
                if (cell.hasShip && !cell.hit) {
                    resultFirst = false;
                    break;
                }
            }
            if (!resultFirst) break;
        }
        for (const line of this.players[1].board){
            for (const cell of line) {
                if (cell.hasShip && !cell.hit) {
                    resultSecond = false;
                    break;
                }
            }
            if (!resultSecond) break;
        }
        if (resultFirst || resultSecond) this.endGame();
        return (resultFirst || resultSecond);
    }

    isGameRunning(){ return this.running; }

    endGame(){
        if (this.running){
            this.end = Date.now();
            this.running = false;
        }
    }

    leaveGame(player) {
        this.players.forEach(element => {
            if (element.name === player) element.name = null;
        });
    }
}

export class Player{
    playerId = new String();
    playerName = new String();
    game = new String();
    ships = new Array();
    shots = new Array();

    constructor(playerName){
        const playerId = Math.random().toString(36).substring(2, 9); // Generieren einer ID
        this.playerName = playerName;
    }

    joinGame(gameId){ this.game = gameId; }
    leaveGame(){ this.game = new String(); }

    placeShip(coords, type){
        // coords like { x: 1, y: 8 }
        // type like ShipType
        this.ships.push(new Ship(coords, type));
    }
    
    placeShot(coord){
        // coord like { x: 1, y: 8 }
        this.shots.push(coord);
        gameId.isShipHit(coord);
    }
}

export class Ship{
    coords = new Array();
    type = new ShipType();
    destroyed = new Boolean();
    hits = new Array();

    constructor(coords, type){
        // coords like { x: 1, y: 8 }
        this.destroyed = false;
        this.coords = coords;
        this.type = type;
    }

    isShipHit(coord){
        this.coords.forEach(element => {
            if (element === coord) return true;
            this.hit(coord);
        });
        return false;
    }

    hit(coord){
        this.hits.push(coord);
    }

    checkShip(){
        let fields = this.type.size;
        coords.forEach(coord => {
            hits.forEach(hit => {
                if (hit === coord) {
                    fields--;
                }
            });
        });
        if (fields < 1) this.destroyed = true;
    }

    isShipDestroyed(){ return this.destroyed; }
}

export class ShipType{
    Scout = { name: 'Scout', size: 2 };
    Kreuzer = { name: 'Kreuzer', size: 3 };
    Zerstörer = { name: 'Zerstörer', size: 4 };
    Flugzeugträger = { name: 'Flugzeugträger', size: 5 };
}

export default {
    Game, 
    Player,
    Ship,
    ShipType
}