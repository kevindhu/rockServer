const entityConfig = require('../entityConfig');
var EntityFunctions = require('../EntityFunctions');
var Queue = require('../../modules/Queue');
const PlayerSensor = require('../sensors/PlayerSensor');
var PlayerHandler = require('./PlayerHandler');
const Rock = require('../projectiles/Rock');


var B2 = require('../../modules/B2');
var B2Common = require('../../modules/B2Common');
var lerp = require('lerp');

function Player(id, name, gameServer) {
    this.gameServer = gameServer;
    this.packetHandler = gameServer.packetHandler;
    this.id = id;

    this.theta = 0;

    this.name = getName(name);
    this.type = "Player";
    this.shootMeter = 30;

    this.handler = new PlayerHandler(this, this.gameServer);

    this.x = entityConfig.WIDTH / 2;
    this.y = entityConfig.WIDTH / 2;
    this.shooting = false;
    this.mover = {
        x: 0,
        y: 0
    };

    this.chunkTimer = 0;
    this.shootTimer = 0;
    this.rocks = [];

    this.resetLevels();
    this.init();
}


Player.prototype.init = function () {
    this.initB2();
    this.gameServer.PLAYER_LIST[this.id] = this;
    this.chunk = EntityFunctions.findChunk(this.gameServer, this);
    this.gameServer.CHUNKS[this.chunk].PLAYER_LIST[this.id] = this;

    this.gameServer.packetHandler.b_addPlayerPackets(this);
};

Player.prototype.initB2 = function () {
    this.setVertices();
    this.body = B2Common.createDisk(this.gameServer.box2d_world, this, this.x, this.y, this.radius / 50, this.power);
    this.sensor = new PlayerSensor(this, this.grabRadius / 100);
};

Player.prototype.setVertices = function () {
    var sides = 3;
    var vertices = [];
    var theta = 0;
    var delta = 2 * Math.PI / sides;
    for (var i = 0; i < sides; i++) {
        theta = i * delta;
        var x = Math.cos(theta);
        var y = Math.sin(theta);
        vertices[i] = [x, y];
    }
    this.vertices = vertices;
};


Player.prototype.onDelete = function () {
    this.gameServer.box2d_world.DestroyBody(this.body);
    delete this.gameServer.PLAYER_LIST[this.id];
    delete this.gameServer.CHUNKS[this.chunk].PLAYER_LIST[this.id];
    this.packetHandler.b_deletePlayerPackets(this);
};


Player.prototype.changeChunk = function () {
    var newChunk = EntityFunctions.findChunk(this.gameServer, this);
    if (newChunk !== this.chunk) {
        delete this.gameServer.CHUNKS[this.chunk].PLAYER_LIST[this.id];
        this.chunk = newChunk;
        this.gameServer.CHUNKS[this.chunk].PLAYER_LIST[this.id] = this;
    }
};


module.exports = Player;


Player.prototype.tick = function () {
    if (this.fullReset) {
        this.deathTimer -= 1;
        if (this.deathTimer <= 0) {
            this.fullReset = false;
            this.reset();
        }
        return;
    }

    if (this.dead || overBoundary(this.body.GetPosition().x) || overBoundary(this.body.GetPosition().y)) {
        this.dead = false;
        this.onDeath();
    }
    if (this.resettingBody) {
        this.resettingBody = false;
        this.resetBody();
    }
    if (this.slowed) {
        this.slowTimer -= 1;
        if (this.slowTimer <= 0) {
            this.slowed = false;
        }
    }

    this.tickBoosting();
    this.tickStalling();
    this.tickShoot();
    this.tickVulnerable();


    this.increaseHealth(0.3);

    this.chunkTimer -= 1;
    if (this.chunkTimer <= 0) {
        this.chunkTimer = 5;
        this.updateChunk();
    }

    if (this.realMover) {
        this.mover.x = lerp(this.mover.x, this.realMover.x, 0.3);
        this.mover.y = lerp(this.mover.y, this.realMover.y, 0.3);
    }
    this.move(this.mover.x, this.mover.y);

    this.x = this.body.GetPosition().x;
    this.y = this.body.GetPosition().y;

    this.packetHandler.b_updatePlayerPackets(this);
};

Player.prototype.tickBoosting = function () {
    if (this.boosting) {
        this.boostTimer -= 1;
        if (this.boostTimer <= 0) {
            this.boosting = false;
            this.boostVelocity();
        }
    }
};
Player.prototype.tickStalling = function () {
    if (this.stalling) {
        this.stallTimer -= 1;
        if (this.stallTimer <= 0) {
            this.stalling = false;
            this.stallVelocity();
        }
    }
};
Player.prototype.tickShoot = function () {
    if (this.shooting && this.shootTimer <= 0) {
        this.shootMag += 0.5;
        if (this.shootMeter - 1 <= 0) {
            this.endShoot();
        }
        else {
            //this.stallVelocity();
            this.decreaseShootMeter(1);
        }
    }
    else {
        this.decreaseShootTimer();
        this.increaseShootMeter();
    }
};
Player.prototype.tickVulnerable = function () {
    if (this.vulnerable) {
        this.vulnerableTimer -= 1;
        if (this.vulnerableTimer <= 0) {
            this.vulnerable = false;
        }
    }
};


Player.prototype.setMove = function (x, y) {
    this.realMover = {
        x: x,
        y: y
    };
};

Player.prototype.resetLevels = function () {
    this.maxHealth = 100;
    this.health = this.maxHealth;

    this.power = 1;

    this.AREA = 3000;
    this.radius = Math.sqrt(this.AREA);
    this.lastRadius = this.radius;
    this.grabRadius = 2 * this.radius;
    this.velBuffer = this.radius / 1000;
};

Player.prototype.startDecreaseHealth = function (entity, amount) {
    this.decreaseHealth(entity, amount);
};

Player.prototype.decreaseHealth = function (entity, amount) {
    if (this.vulnerable) {
        amount *= 10;
    }
    amount *= entity.power;
    if (entity.fast) {
        amount *= 2;
    }


    this.health -= amount / 4;
    if (amount > this.maxHealth / 3) {
        this.endShoot();
    }
    if (this.health <= 0) {
        this.dead = true;
    }
};

Player.prototype.decreaseShootTimer = function () {
    if (this.shootTimer > 0) {
        this.shootTimer--;
    }
};


Player.prototype.decreaseShootMeter = function (amount) {
    if (this.shootMeter - amount >= 0) {
        this.shootMeter -= amount;
    }
    else {
        this.shootMeter = 0;
    }
};


Player.prototype.increaseShootMeter = function () {
    if (this.shootMeter < 30 && !this.shooting) {
        this.shootMeter += 0.4;
    }
};

Player.prototype.increaseHealth = function (amount) {
    if (this.health + amount < this.maxHealth) {
        this.health += amount;
    }
    else {
        this.health = this.maxHealth;
    }
};

Player.prototype.updateChunk = function () {
    var oldChunks = this.findNeighboringChunks();
    this.changeChunk();
    var newChunks = this.findNeighboringChunks();
    this.chunkAdd = this.findChunkDifference(newChunks, oldChunks);
    this.chunkDelete = this.findChunkDifference(oldChunks, newChunks);
};

Player.prototype.findChunkDifference = function (chunks1, chunks2) {
    var id;
    var delta = {};
    for (id in chunks1) {
        if (chunks2[id] === undefined) {
            delta[id] = id;
        }
    }
    return delta;
};
Player.prototype.findNeighboringChunks = function () {
    var rowLength = Math.sqrt(entityConfig.CHUNKS);
    var chunks = {};

    for (var i = 0; i < 9; i++) {
        var chunk = this.chunk;
        var xIndex = i % 3 - 1;
        var yIndex = Math.floor(i / 3) - 1;

        while (!(chunk % rowLength + xIndex).between(0, rowLength - 1) ||
        !(Math.floor(chunk / rowLength) + yIndex).between(0, rowLength - 1)) {
            i++;
            if (i > 8) {
                return chunks;
            }
            xIndex = i % 3 - 1;
            yIndex = Math.floor(i / 3) - 1;
        }
        chunk += xIndex + rowLength * yIndex;
        chunks[chunk] = chunk;
    }
    return chunks;
};


Player.prototype.getTheta = function (target, origin) {
    this.theta = Math.atan2(target.y - origin.y, target.x - origin.x) % (2 * Math.PI);
};


Player.prototype.startShoot = function () {
    if (this.shootTimer <= 0) {
        this.shootMag = 1;
        this.shooting = true;
    }
};


Player.prototype.shoot = function (x, y, mag) {
    this.shootTimer = 5;
    if (!x && !y) {
        x = this.x + this.realMover.x;
        y = this.y + this.realMover.y;
    }
    var target = {
        x: x,
        y: y
    };

    var origin = {
        x: this.x,
        y: this.y
    };


    this.getTheta(target, origin);
    var rock = new Rock(this.x, this.y, 0.6, this.gameServer, null, null, 4, null, this.id, 3);
    var v = rock.body.GetLinearVelocity();

    v.x = 0.5 * mag * Math.cos(this.theta);
    v.y = 0.5 * mag * Math.sin(this.theta);

    rock.body.SetLinearVelocity(v);
};


Player.prototype.endShoot = function () {
    if (this.shooting) {
        this.shoot(null, null, this.shootMag * 10);
        this.shooting = false;
    }
};

Player.prototype.addRock = function (rock) {
    if (!this.containsRock(rock) &&
        this.rocks.length <= this.rockMaxLength) {

        this.rocks.push(rock);
        rock.addOwner(this);
    }
};


Player.prototype.containsRock = function (rock) {
    for (var i = 0; i < this.rocks.length; i++) {
        if (this.rocks[i] === rock) {
            return true;
        }
    }
    return false;
};

Player.prototype.removeRock = function (rock) {
    var index = this.rocks.indexOf(rock);
    if (index !== -1) {
        this.rocks.splice(index, 1);
    }
};


Player.prototype.stallVelocity = function () {
    var v = this.body.GetLinearVelocity();
    v.x /= 5;
    v.y /= 5;

    this.body.SetLinearVelocity(v);
};

Player.prototype.boostVelocity = function () {
    this.vulnerable = true;
    this.vulnerableTimer = 20;
    var v = this.body.GetLinearVelocity();
    v.x *= 20;
    v.y *= 20;

    this.body.SetLinearVelocity(v);
};


Player.prototype.addRock = function (rock) {
    this.rocks.push(rock);
    rock.addOwner(this);
};

Player.prototype.consumeRock = function (rock) {
    this.AREA += square(rock.AREA * rock.power) * 100;
    this.radius = Math.sqrt(this.AREA);
    this.grabRadius = 10 * this.radius;
    this.power += rock.AREA / 10;

    this.maxHealth += rock.AREA * rock.power / 100;
    this.increaseHealth(rock.AREA * 10);
    if (this.radius - this.lastRadius > 10) {
        this.lastRadius = this.radius;
        this.resettingBody = true;
    }
    rock.dead = true;
};


Player.prototype.resetBody = function () {
    var vel = this.body.GetLinearVelocity();
    this.gameServer.box2d_world.DestroyBody(this.body);
    this.initB2();
    //vel.x *= 1;
    //vel.y *= 1;
    this.body.SetLinearVelocity(vel);
};

Player.prototype.move = function (x, y) {
    if (this.shooting) {
        //return;
    }

    var target = {
        x: this.x + x,
        y: this.y + y
    };
    var origin = {
        x: this.x,
        y: this.y
    };

    this.getTheta(target, origin);


    var normalVel = normal(x, y);
    if (normalVel < 1) {
        normalVel = 1;
    }

    var vel = this.body.GetLinearVelocity();
    //var pos = this.body.GetPosition();

    var mag = 0.4;
    if (this.shooting || this.vulnerable) {
        mag = 0.1;
    }

    var slow = this.slowed ? 10 : 1;
    vel.x = lerp(vel.x, 10 * x / normalVel / (slow * (this.velBuffer / 5 + 1.5)), mag);
    vel.y = lerp(vel.y, 10 * y / normalVel / (slow * (this.velBuffer / 5 + 1.5)), mag);

    //this.body.SetPosition(pos);

    this.body.SetLinearVelocity(vel);
};

Player.prototype.onDeath = function () {
    this.split();
    this.dropAllRocks();
    this.gameServer.box2d_world.DestroyBody(this.body);
    this.radius = 0;
    this.fullReset = true;
    this.deathTimer = 70;
};

Player.prototype.reset = function () {
    this.x = entityConfig.WIDTH / 2;
    this.y = entityConfig.WIDTH / 2;
    this.resetLevels();
    this.resetBody();
};

Player.prototype.dropAllRocks = function () {
    for (var i = this.rocks.length - 1; i >= 0; i--) {
        var rock = this.rocks[i];
        rock.removeOwner();
    }
};


Player.prototype.split = function () {
    var vertices = this.vertices;
    var count = vertices.length;

    var middleVertex = new B2.b2Vec2();
    var middle = Math.floor(count / 2);
    middleVertex.Set((vertices[middle - 1][0] + vertices[middle][0]) / 2 + getRandom(-0.2, 0.2), (vertices[middle - 1][1] + vertices[middle][1]) / 2 + getRandom(-0.2, 0.2));

    var lastVertex = new B2.b2Vec2();
    lastVertex.Set((vertices[count - 1][0] + vertices[0][0]) / 2, (vertices[count - 1][1] + vertices[0][1]) / 2);

    var vertices1 = [];
    var vertices2 = [];
    var i;

    vertices1.push([lastVertex.x, lastVertex.y]);
    for (i = 0; i < middle; i++) {
        vertices1.push([vertices[i][0], vertices[i][1]]);
    }
    vertices1.push([middleVertex.x, middleVertex.y]);


    vertices2.push([middleVertex.x, middleVertex.y]);
    for (i = middle; i < count; i++) {
        vertices2.push([vertices[i][0], vertices[i][1]]);
    }
    vertices2.push([lastVertex.x, lastVertex.y]);

    var x = Math.floor(this.body.GetPosition().x);
    var y = Math.floor(this.body.GetPosition().y);
    var bodies = B2Common.createPolygonSplit(this.gameServer.box2d_world, this.body, vertices1, vertices2);


    this.SCALE = 0.5;
    var clone1 = new Rock(x, y, this.SCALE / 2, this.gameServer, bodies[0], vertices1, 4);
    var clone2 = new Rock(x, y, this.SCALE / 2, this.gameServer, bodies[1], vertices2, 4);

    clone1.body.GetFixtureList().SetUserData(clone1);
    clone2.body.GetFixtureList().SetUserData(clone2);

    clone1.body.SetAngularVelocity(this.body.GetAngularVelocity());
    clone2.body.SetAngularVelocity(this.body.GetAngularVelocity());


    var theta = this.theta;
    var normalVel = normal(this.body.GetLinearVelocity().y, this.body.GetLinearVelocity().x);
    var v1 = clone1.body.GetLinearVelocity();
    var v2 = clone2.body.GetLinearVelocity();

    v1.x = normalVel * Math.cos(theta + 0.1);
    v1.y = normalVel * Math.sin(theta + 0.1);
    v2.x = normalVel * Math.cos(theta - 0.1);
    v2.y = normalVel * Math.sin(theta - 0.1);

    clone1.body.SetLinearVelocity(v1);
    clone2.body.SetLinearVelocity(v2);
};


function getName(name) {
    if (name === "") {
        return "unnamed friend";
    }
    return name;
}

function normal(x, y) {
    return Math.sqrt(x * x + y * y);
}

function square(x) {
    return x * x;
}

function onBoundary(coord) {
    return coord <= entityConfig.BORDER_WIDTH ||
        coord >= entityConfig.WIDTH - entityConfig.BORDER_WIDTH;
}

function overBoundary(coord) {
    return coord < entityConfig.BORDER_WIDTH - 1 ||
        coord > entityConfig.WIDTH - entityConfig.BORDER_WIDTH + 1;
}

function getRandom(min, max) {
    return Math.random() * (max - min) + min;
}

module.exports = Player;
