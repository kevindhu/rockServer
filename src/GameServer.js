var Entity = require('./entity');
var QuadNode = require('./modules/QuadNode');
var Chunk = require('./Chunk');
var B2 = require('./modules/B2');
var B2Common = require('./modules/B2Common');
var PacketHandler = require('./PacketHandler');
const entityConfig = require('./entity/entityConfig');
const Arithmetic = require('./modules/Arithmetic');
const PORT = process.env.PORT || 2000;

function GameServer() {
    this.packetHandler = new PacketHandler(this);
    this.CHUNKS = {};

    this.SOCKET_LIST = {};
    this.INIT_SOCKET_LIST = {};

    this.CONTROLLER_LIST = {};
    this.ROCK_LIST = {};
    this.TILE_LIST = {};


    this.minx = entityConfig.BORDER_WIDTH;
    this.miny = entityConfig.BORDER_WIDTH;
    this.maxx = entityConfig.WIDTH - entityConfig.BORDER_WIDTH;
    this.maxy = entityConfig.WIDTH - entityConfig.BORDER_WIDTH;

    this.tileLength = (entityConfig.WIDTH - 2 * entityConfig.BORDER_WIDTH) /
        Math.sqrt(entityConfig.TILES);
    this.startTime = Date.now();
}

/** SERVER INIT METHODS **/
GameServer.prototype.initChunks = function () {
    for (var i = 0; i < entityConfig.CHUNKS; i++) {
        this.CHUNKS[i] = new Chunk(i, this);
    }
};
GameServer.prototype.initB2 = function () {
    var gravity = new B2.b2Vec2(0, 0);
    this.box2d_world = new B2.b2World(gravity, false); //no sleep, need dynamic bodies over static bodies to work
};
GameServer.prototype.initTiles = function () {
    for (var i = 0; i < Math.sqrt(entityConfig.TILES); i++) {
        for (var j = 0; j < Math.sqrt(entityConfig.TILES); j++) {
            new Entity.Tile(entityConfig.BORDER_WIDTH + this.tileLength * i,
                entityConfig.BORDER_WIDTH + this.tileLength * j, this);
        }
    }
};
GameServer.prototype.initRocks = function () {
    var i;
    for (i = 0; i < entityConfig.ROCKS; i++) {
        this.spawnRandomRock();
    }
};
GameServer.prototype.initNewClients = function () {
    for (var id in this.INIT_SOCKET_LIST) {
        var socket = this.SOCKET_LIST[id];
        if (!socket) {
            delete this.INIT_SOCKET_LIST[id];
        }

        if (!socket.verified) { //verify new client socket
            socket.life -= 1;
            if (socket.life === 0) {
                console.log("DETECTED ROGUE CLIENT!");
                socket.disconnect();
            }
        }

        if (!socket.player) {
            return;
        }

        if (socket.timer !== 0) {
            socket.timer -= 1;
        }
        else if (socket.stage <= 8) {
            var rowLength = Math.sqrt(entityConfig.CHUNKS);
            var chunk = socket.player.chunk;
            var xIndex = socket.stage % 3 - 1;
            var yIndex = Math.floor(socket.stage / 3) - 1;

            while (!(chunk % rowLength + xIndex).between(0, rowLength - 1) ||
            !(Math.floor(chunk / rowLength) + yIndex).between(0, rowLength - 1)) {
                socket.stage++;
                if (socket.stage > 8) {
                    return;
                }
                xIndex = socket.stage % 3 - 1;
                yIndex = Math.floor(socket.stage / 3) - 1;
            }
            chunk += xIndex + rowLength * yIndex;
            this.packetHandler.sendChunkInitPackets(socket, chunk);
            socket.timer = 2;
            socket.stage++;
        }
        else {
            delete this.INIT_SOCKET_LIST[id];
        }
    }
};

GameServer.prototype.spawnRandomRock = function () {
    var x = Arithmetic.getRandomInt(entityConfig.BORDER_WIDTH, entityConfig.WIDTH - entityConfig.BORDER_WIDTH);
    var y = Arithmetic.getRandomInt(entityConfig.BORDER_WIDTH, entityConfig.WIDTH - entityConfig.BORDER_WIDTH);
    return new Entity.Rock(x, y, getRandom(0.5, 3), this);
};


/** UPDATE METHODS **/
GameServer.prototype.spawnRocks = function () {
    if (Object.size(this.ROCK_LIST) < entityConfig.ROCKS) {
        this.spawnRandomRock();
    }
};

GameServer.prototype.update = function () {
    this.timeStamp = Date.now();

    if (this.timeStamp % 50 === 0) {
        this.packetHandler.sendPing(this.timeStamp);
    }

    this.updateBox2d();
    this.initNewClients();

    this.updateControllers();
    this.updateRocks();

    this.packetHandler.sendPackets();
};
GameServer.prototype.updateControllers = function () {
    for (var id in this.CONTROLLER_LIST) {
        var controller = this.CONTROLLER_LIST[id];
        controller.update();
    }
};
GameServer.prototype.updateRocks = function () {
    var id, rock;

    this.spawnRocks();

    for (id in this.ROCK_LIST) {
        rock = this.ROCK_LIST[id];
        rock.tick();
    }
};
GameServer.prototype.updateBox2d = function () {
    this.box2d_world.Step(1 / 20, 4, 3);

    //important to clear forces, otherwise forces will keep applying
    this.box2d_world.ClearForces();
};

/** SERVER CREATION EVENTS **/
GameServer.prototype.start = function () {
    var express = require("express");
    var app = express();
    var server = require('http').Server(app);

    /** INIT PORT CONNECTION **/
    app.get('/', function (req, res) {
        res.sendFile(__dirname + '/client/index.html');
    });
    app.use('/', express.static(__dirname + '/client'));

    server.listen(PORT);
    console.log('Started Server!');

    /** INIT SERVER OBJECTS **/
    this.initChunks();
    this.initB2();
    this.setupCollisionHandler();
    this.initTiles();
    this.initRocks();

    var io = require('socket.io')(server, {});
    io.sockets.on('connection', function (socket) {
        var player;
        socket.id = Math.floor(Math.random() * 1000000);
        socket.timer = 0;
        socket.life = 100;
        socket.verified = false;
        socket.stage = 0;

        this.packetHandler.sendVerificationPackets(socket);
        this.SOCKET_LIST[socket.id] = socket;
        this.INIT_SOCKET_LIST[socket.id] = socket;

        console.log("Client #" + socket.id + " has joined the server");

        socket.on("verify", function (data) {
            if (!socket.verified) {
                console.log("Verified Client #" + socket.id);
            }
            socket.verified = true;
        }.bind(this));

        socket.on("pong123", function (data) {
            console.log("PING: " + Math.round((this.timeStamp - data) / 2));
        }.bind(this));

        socket.on('newPlayer', function (data) {
            player = this.createPlayer(socket, data);
            socket.player = player;
            this.packetHandler.addChatPackets("SERVER", player.name + " has connected!");
        }.bind(this));

        socket.on('chatMessage', function (data) {
            var player = this.CONTROLLER_LIST[data.id];

            if (player) {
                this.packetHandler.addChatPackets(player.name, data.message);
            }
        }.bind(this));

        socket.on('slash', function (data) {
            var player = this.CONTROLLER_LIST[data.id];

            if (player && 1 === 2) {
                player.addSlash({
                    x: player.x + data.x,
                    y: player.y + data.y,
                    slashId: data.slashId
                });
            }
        }.bind(this));

        socket.on('shootRock', function (data) {
            var player = this.CONTROLLER_LIST[data.id];

            if (player) {
                player.shootRock(player.x + data.x / 100, player.y + data.y / 100);
            }
        }.bind(this));

        socket.on('keyEvent', function (data) {
            if (!player) {
                return;
            }
            switch (data.id) {
                case 39:
                case 68:
                    player.pressingRight = data.state;
                    break;
                case 40:
                case 83:
                    player.pressingDown = data.state;
                    break;
                case 37:
                case 65:
                    player.pressingLeft = data.state;
                    break;
                case 38:
                case 87:
                    player.pressingUp = data.state;
                    break;
                case "hehe xd": //swirling motion
                    if (data.state) {
                        player.groupAsteroids();
                    }
                    break;
            }
        }.bind(this));

        socket.on('createCircle', function (data) {
            var radius = data.radius / 100;
            player.createCircle(radius);
        }.bind(this));

        socket.on('createDefault', function (data) {
            player.createCircle(5);
        }.bind(this));


        socket.on('disconnect', function () {
            console.log("Client #" + socket.id + " has left the server");
            if (player) {
                player.onDelete();
            }
            delete this.SOCKET_LIST[socket.id];
            delete this.INIT_SOCKET_LIST[socket.id];
        }.bind(this));
    }.bind(this));

    setInterval(this.update.bind(this), 1000 / 25);
};

GameServer.prototype.createPlayer = function (socket, info) {
    return new Entity.Player(socket.id, info.name, this);
};


GameServer.prototype.setupCollisionHandler = function () {
    B2.b2ContactListener.prototype.BeginContact = function (contact) {
        var a = contact.GetFixtureA();
        var b = contact.GetFixtureB();

        var aEntity = a.GetUserData();
        var bEntity = b.GetUserData();

        if (aEntity instanceof Entity.Rock && bEntity instanceof Entity.Player) {
            if (!aEntity.tempNeutral && b.IsSensor() && aEntity.SCALE < 3 && aEntity.owner !== bEntity) {
                bEntity.addRock(aEntity);
            }
        }
        if (aEntity instanceof Entity.Player && bEntity instanceof Entity.Rock) {
            if (!bEntity.tempNeutral && a.IsSensor() && bEntity.SCALE < 3 && bEntity.owner !== aEntity) {
                aEntity.addRock(bEntity);
            }
        }
    }.bind(this);

    B2.b2ContactListener.prototype.PreSolve = function (contact) {
        var a = contact.GetFixtureA().GetUserData();
        var b = contact.GetFixtureB().GetUserData();


        if (a.justChanged || b.justChanged) {
            a.justChanged = false;
            b.justChanged = false;
            if (a instanceof Entity.Rock && b instanceof Entity.Player) {
                if (!a.tempNeutral && a.SCALE < 1 && a.owner !== b) {
                    b.addRock(a);
                }
            }
            if (a instanceof Entity.Player && b instanceof Entity.Rock) {
                if (!b.tempNeutral && b.SCALE < 1 && b.owner !== a) {
                    a.addRock(b);
                }
            }
        }
        if (a instanceof Entity.Rock && b instanceof Entity.Rock) {

            if (a.owner && a.owner === b.owner) {
                contact.SetEnabled(false);
                return;
            }

            if (a.tempNeutral) {
                if (a.tempNeutral === b.owner || a.tempNeutral === b.tempNeutral) {
                    contact.SetEnabled(false);
                    return;
                }
                else {
                    if (b.owner) {
                        b.onDelete();
                    }
                    a.tempNeutral = null;
                    a.justChanged = true;
                }
            }
            if (b.tempNeutral) {
                if (b.tempNeutral === a.owner || a.tempNeutral === b.tempNeutral) {
                    contact.SetEnabled(false);
                    return;
                }
                else {
                    b.tempNeutral = null;
                    b.justChanged = true;
                }
            }

            var aVel = a.body.GetLinearVelocity();
            var bVel = b.body.GetLinearVelocity();
            var impact = normal(aVel.x - bVel.x,
                aVel.y - bVel.y);

            if (impact > 1) {
                a.decreaseHealth(impact / 4);
                b.decreaseHealth(impact / 4);
            }
        }
        if (a instanceof Entity.Rock && b instanceof Entity.Player) {
            contact.SetEnabled(false);
        }
        if (a instanceof Entity.Player && b instanceof Entity.Rock) {
            contact.SetEnabled(false);
        }
    }.bind(this);
};

Object.size = function (obj) {
    var size = 0, key;
    for (key in obj) {
        if (obj.hasOwnProperty(key)) size++;
    }
    return size;
};

Number.prototype.between = function (min, max) {
    return this >= min && this <= max;
};

function getRandom(min, max) {
    return Math.random() * (max - min) + min;
}
function normal(x, y) {
    return Math.sqrt(x * x + y * y);
}

module.exports = GameServer;
