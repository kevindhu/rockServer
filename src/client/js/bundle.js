(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
function BinaryReader(data) {
    this._offset = 0;
    this._buffer = new DataView(data);
    //console.log(data.byteLength);
}

module.exports = BinaryReader;


BinaryReader.prototype.readInt8 = function () {
    var value = this._buffer.getInt8(this._offset);
    this._offset += 1;
    return value;
};

BinaryReader.prototype.readUInt8 = function () {
    var value = this._buffer.getUint8(this._offset);
    this._offset += 1;
    return value;
};


BinaryReader.prototype.readInt16 = function () {
    var value = this._buffer.getInt16(this._offset);
    this._offset += 2;
    return value;
};

BinaryReader.prototype.readUInt16 = function () {
    var value = this._buffer.getUint16(this._offset);
    this._offset += 2;
    return value;
};



BinaryReader.prototype.readInt32 = function () {
    var value = this._buffer.getInt32(this._offset);
    this._offset += 4;
    return value;
};


BinaryReader.prototype.readUInt32 = function () {
    var value = this._buffer.getUint32(this._offset);
    this._offset += 4;
    return value;
};

BinaryReader.prototype.skipBytes = function (length) {
    this._offset += length;
};

BinaryReader.prototype.length = function () {
    return this._buffer.byteLength;
};


},{}],2:[function(require,module,exports){
var Entity = require('./entity');
var MainUI = require('./ui/MainUI');
var BinaryReader = require('./BinaryReader');

function Client() {
    this.SELF_ID = null;
    this.SELF_PLAYER = null;
    this.TRAIL = null;
    this.updates = [];

    this.currPing = 0;

    this.init();
}

Client.prototype.init = function () {
    this.initSocket();
    this.initCanvases();
    this.initLists();
    this.initViewers();
};
Client.prototype.initSocket = function () {
    this.socket = io();
    this.socket.verified = false;

    this.socket.on('initVerification', this.verify.bind(this));

    this.socket.on('updateEntities', this.handlePacket.bind(this));
    this.socket.on('updateBinary', this.handleBinary.bind(this));


    this.socket.on('chatMessage', this.mainUI);
    this.socket.on('ping', this.sendPong.bind(this));
    this.socket.on('finalPing', function (message) {
        //console.log("PING: " + message);
        this.currPing = message;
        if (this.currPing > 90000) {
            this.currPing = 10;
        }
    });


};

Client.prototype.sendPong = function (message) {
    this.socket.emit("pong123", message);
};


Client.prototype.initCanvases = function () {
    this.mainCanvas = document.getElementById("main_canvas");
    this.mainCanvas.style.border = '1px solid #000000';
    this.mainCanvas.style.visibility = "hidden";
    this.mainCtx = this.mainCanvas.getContext("2d");


    document.addEventListener("mousedown", function (event) {
        if (!this.SELF_ID) {
            return;
        }
        var x = ((event.x / this.mainCanvas.offsetWidth * 1000) - this.mainCanvas.width / 2) / this.scaleFactor;
        var y = ((event.y / this.mainCanvas.offsetHeight * 500) - this.mainCanvas.height / 2) / this.scaleFactor;


        if (Math.abs(x) + Math.abs(y) < 200) {
            this.playerClicked = true;
            this.circleConstruct = [];
            this.circleStageCount = 0;
        }
        else {
            this.clickTemp = true;
            this.clickTimer = 0;
        }
    }.bind(this));
    document.addEventListener("mouseup", function (event) {
        if (!this.SELF_ID) {
            return;
        }
        var x = ((event.x / this.mainCanvas.offsetWidth * 1000) - this.mainCanvas.width / 2) / this.scaleFactor;
        var y = ((event.y / this.mainCanvas.offsetHeight * 500) - this.mainCanvas.height / 2) / this.scaleFactor;

        this.socket.emit("shootSelf", {
            id: this.SELF_ID,
            x: x,
            y: y
        });

        this.clickTemp = false;
        this.clickTimer = 0;

    }.bind(this));


    document.addEventListener("mousemove", function (event) {
        if (!this.SELF_PLAYER) {
            return;
        }

        var x = ((event.x / this.mainCanvas.offsetWidth * 1000) -
            this.mainCanvas.width / 2) / this.scaleFactor;
        var y = ((event.y / this.mainCanvas.offsetHeight * 500) -
            this.mainCanvas.height / 2) / this.scaleFactor;

        if (square(x) + square(y) > square(this.SELF_PLAYER.range)) { //if not in range
            return;
        }

        if (!this.pre) {
            this.pre = {x: x, y: y}
        }
        else if (square(this.pre.x - x) + square(this.pre.y - y) > 80) {
            this.pre = {x: x, y: y};

            if (Math.abs(x) < 50 && Math.abs(y) < 50) {
                x = 0;
                y = 0;
            }

            this.socket.emit('move', {
                id: this.SELF_ID,
                x: x,
                y: y
            });

            this.SELF_PLAYER.setMove(x, y);
        }
    }.bind(this));
};


Client.prototype.sendCircle = function (construct) {

    var radiiNormal = function (vector) {
        if (!vector) {
            return 0;
        }
        return (vector.x * vector.x + vector.y * vector.y);
    };

    var maxRadius = Math.sqrt(Math.max(
        radiiNormal(construct[0]),
        radiiNormal(construct[1]),
        radiiNormal(construct[2]),
        radiiNormal(construct[3])));

    if (maxRadius) {
        this.socket.emit("createCircle", {
            id: this.SELF_ID,
            radius: maxRadius
        });
    }
};

Client.prototype.initLists = function () {
    this.PLAYER_LIST = {};
    this.TILE_LIST = {};
    this.ROCK_LIST = {};
    this.ASTEROID_LIST = {};
    this.ANIMATION_LIST = {};
    this.PLAYER_ARRAY = [];
};
Client.prototype.initViewers = function () {
    this.keys = [];
    this.scaleFactor = 1;
    this.mainScaleFactor = 0.5;
    this.mainUI = new MainUI(this, this.socket);
    this.mainUI.playerNamerUI.open();
};

Client.prototype.verify = function (data) {
    if (!this.socket.verified) {
        console.log("VERIFIED CLIENT");
        this.socket.emit("verify", {});
        this.socket.verified = true;
    }
};


Client.prototype.applyUpdate = function (reader) {
    var i;

    var rockLength = reader.readUInt16(); //add rocks
    for (i = 0; i < rockLength; i++) {
        rock = new Entity.Rock(reader, this);
        this.ROCK_LIST[rock.id] = rock;
    }

    var playerLength = reader.readUInt8(); //add players
    if (playerLength > 0) {
        console.log("ATTEMPTING ADD NEW PLAYER");
    }
    for (i = 0; i < playerLength; i++) {
        player = new Entity.Player(reader, this);
        if (player.id === this.SELF_ID) {
            this.SELF_PLAYER = player;
        }
        this.PLAYER_LIST[player.id] = player;

        if (this.PLAYER_ARRAY.indexOf(player.id) === -1) {
            this.PLAYER_ARRAY.push(player.id);
        }
    }

    var rock2Length = reader.readUInt16(); //update rocks
    for (i = 0; i < rock2Length; i++) {
        var id = reader.readUInt32();
        rock = this.ROCK_LIST[id];
        if (rock) {
            rock.update(reader);
        }
        else {
            console.log("MAKING NEW FAKE ROCK " + id);

            var fakeRock = new Entity.Rock(null, this);
            fakeRock.update(reader);

            this.ROCK_LIST[id] = fakeRock;

            this.socket.emit("getRock", {
                id: id
            });
        }
    }


    var player2Length = reader.readUInt8();
    //console.log("PLAYER UPDATE LENGTH: " + player2Length);
    for (i = 0; i < player2Length; i++) {
        id = reader.readUInt32();
        var player = this.PLAYER_LIST[id];
        if (player) {
            player.update(reader);
        }
        else {
            //console.log("NO PLAYER ADDED: " + id);
            var fakePlayer = new Entity.Player(null, this);
            fakePlayer.update(reader);

            this.PLAYER_LIST[id] = fakePlayer;

            this.socket.emit("getPlayer", {
                id: id
            });

            console.log("EMITTING GETPLAYER");
        }
    }

    var rock3Length = reader.readUInt16(); //delete rocks
    for (i = 0; i < rock3Length; i++) {
        id = reader.readUInt32();
        delete this.ROCK_LIST[id];

        //console.log("DELETED ROCK NORMALLY: " + id);
    }

    var player3Length = reader.readUInt8();
    for (i = 0; i < player3Length; i++) {
        id = reader.readUInt32();

        console.log("DELETING PLAYER: " + id);

        delete this.PLAYER_LIST[id];
        var index = this.PLAYER_ARRAY.indexOf(id);
        this.PLAYER_ARRAY.splice(index, 1);
    }
};


Client.prototype.handleBinary = function (data) {
    var reader = new BinaryReader(data);
    if (reader.length() < 1) {
        return;
    }
    var step = reader.readUInt32();

    if (!this.initialStep) {
        this.initialStep = step;
    }
    else if (this.initialStep === step) {
        return;
    }
    this.lastStep = step;

    //console.log("LAST STEP: " + step);

    if (!this.currStep) {
        this.currStep = step - 3;
    }


    this.updates.push({
        step: step,
        reader: reader
    });
};


Client.prototype.handlePacket = function (data) {
    var packet, i;
    for (i = 0; i < data.length; i++) {
        packet = data[i];
        switch (packet.master) {
            case "add":
                this.addEntities(packet);
                break;
        }
    }
};


Client.prototype.addEntities = function (packet) {
    var addEntity = function (packet, list, entity, array) {
        if (!packet) {
            return;
        }
        list[packet.id] = new entity(packet, this);
        if (array && array.indexOf(packet.id) === -1) {
            array.push(packet.id);
        }
    }.bind(this);

    switch (packet.class) {
        case "tileInfo":
            addEntity(packet, this.TILE_LIST, Entity.Tile);
            console.log("ADDED TILE");
            break;
        case "selfId":
            if (!this.SELF_ID) {
                this.SELF_ID = packet.selfId;
                this.mainUI.gameUI.open();
            }
            break;
        case "chatInfo":
            this.mainUI.gameUI.chatUI.addMessage(packet);
            break;
    }
};


Client.prototype.drawScene = function (data) {
    this.mainUI.updateLeaderBoard();

    var id;
    var entityList = [
        this.TILE_LIST,
        this.PLAYER_LIST,
        this.ASTEROID_LIST,
        this.ANIMATION_LIST,
        this.ROCK_LIST
    ];

    var inBounds = function (player, x, y) {
        var range = this.mainCanvas.width / (0.7 * this.scaleFactor);
        return x < (player.x + range) && x > (player.x - range)
            && y < (player.y + range) && y > (player.y - range);
    }.bind(this);

    var translateScene = function () {
        this.mainCtx.setTransform(1, 0, 0, 1, 0, 0);
        this.scaleFactor = lerp(this.scaleFactor, this.mainScaleFactor, 0.3);
        this.mainCtx.translate(this.mainCanvas.width / 2, this.mainCanvas.height / 2);
        this.mainCtx.scale(this.scaleFactor, this.scaleFactor);
        this.mainCtx.translate(-this.SELF_PLAYER.x, -this.SELF_PLAYER.y);
    }.bind(this);



    this.SELF_PLAYER.tick();


    translateScene();
    this.mainCtx.clearRect(0, 0, 50000, 50000);

    this.mainCtx.fillStyle = "#1d1f21";
    this.mainCtx.fillRect(0, 0, 50000, 50000);


    for (var i = 0; i < entityList.length; i++) {
        var list = entityList[i];
        for (id in list) {
            var entity = list[id];
            if (inBounds(this.SELF_PLAYER, entity.x, entity.y)) {
                entity.show();
            }
        }
    }
    if (this.TRAIL && !this.active) {
        this.TRAIL.show();
    }
};

Client.prototype.clientUpdate = function () {
    this.updateStep();


    if (!this.SELF_PLAYER) {
        if (this.SELF_ID) {
            this.SELF_PLAYER = this.PLAYER_LIST[this.SELF_ID];
            return;
        }
        else {
            return;
        }
    }
    this.drawScene();
};

Client.prototype.updateStep = function () {
    var stepRange = this.lastStep - this.currStep;
    var update;

    if (!stepRange) {
        //console.log("STEP RANGE TOO SMALL: SERVER TOO SLOW");
        return;
    }

    if (this.currStep < this.initialStep) {
        this.currStep += 1;
        return;
    }
    if (this.currStep > this.lastStep) {
        //console.log("STEP RANGE TOO SMALL: SERVER TOO SLOW");
        return;
    }

    while (this.lastStep - this.currStep > 5 + this.currPing / 50) {
        console.log("STEP RANGE TOO LARGE: CLIENT IS TOO SLOW FOR STEP: " + this.currStep);
        update = this.findUpdatePacket(this.currStep);
        if (!update) {
            console.log("UPDATE NOT FOUND!!!!");
            this.currStep += 1;
            return;
        }
        if (update.reader._offset > 10) {
            console.log("OFFSET IS TOO LARGE");
            this.currStep += 1;
            return;
        }

        this.applyUpdate(update.reader);
        this.currStep += 1;
    } //too slow

    update = this.findUpdatePacket(this.currStep);
    if (!update) {
        console.log("CANNOT FIND UPDATE FOR STEP: " + this.currStep);
        this.currStep += 1;
        return;
    }
    if (update.reader._offset > 10) {
        console.log("OFFSET IS TOO LARGE FOR STEP: " + this.currStep);
        console.log(this.updates[0]);
        this.currStep += 1;
        return;
    }
    this.applyUpdate(update.reader);
    this.currStep += 1;
};


Client.prototype.findUpdatePacket = function (step) {
    var length = this.updates.length;

    for (var i = length - 1; i >= 0; i--) {
        var update = this.updates[i];

        if (update.step === step) {
            this.updates.splice(0, i);
            return update;
        }
    }
    console.log('COULD NOT FIND PACKET FOR STEP: ' + step);
    console.log(this.updates[0]);
    console.log(this.updates[1]);
    console.log(this.updates[2]);


    return null;
};


Client.prototype.start = function () {
    setInterval(this.clientUpdate.bind(this), 1000 / 28);
};

function lerp(a, b, ratio) {
    return a + ratio * (b - a);
}


function square(a) {
    return a * a;
}

function vectorNormal(a) {
    return a.x * a.x + a.y * a.y;
}

module.exports = Client;
},{"./BinaryReader":1,"./entity":8,"./ui/MainUI":10}],3:[function(require,module,exports){
function Animation(animationInfo, client) {

    this.client = client;
    this.type = animationInfo.type;
    this.id = animationInfo.id;
    this.x = animationInfo.x;
    this.y = animationInfo.y;
    //this.theta = 15;
    this.timer = getRandom(10, 14);

    if (this.type === "slash") {
        this.slashId = animationInfo.slashId;
        var slash = this.client.findSlash(this.slashId);
        this.pre = slash[0];
        this.post = slash[1];
    }
}


Animation.prototype.show = function () {
    var ctx = this.client.mainCtx;
    var player = this.client.SELF_PLAYER;

    if (this.type === "slash" && player) {
        ctx.beginPath();

        ctx.strokeStyle = "rgba(242, 31, 66, 0.6)";
        ctx.lineWidth = 15;

        ctx.moveTo(player.x + this.pre.x, player.y + this.pre.y);
        ctx.lineTo(player.x + this.post.x, player.y + this.post.y);

        ctx.stroke();
        ctx.closePath();
    }
    

    if (this.type === "shardDeath") { //deprecated but could pull some good code from here
        ctx.font = 60 - this.timer + "px Arial";
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(-Math.PI / 50 * this.theta);
        ctx.textAlign = "center";
        ctx.fillStyle = "rgba(255, 168, 86, " + this.timer * 10 / 100 + ")";
        ctx.fillText(this.name, 0, 15);
        ctx.restore();

        ctx.fillStyle = "#000000";
        this.theta = lerp(this.theta, 0, 0.08);
        this.x = lerp(this.x, this.endX, 0.1);
        this.y = lerp(this.y, this.endY, 0.1);
    }


    this.timer--;
    if (this.timer <= 0) {
        delete this.client.ANIMATION_LIST[this.id];
    }
};


function getRandom(min, max) {
    return Math.random() * (max - min) + min;
}

function lerp(a, b, ratio) {
    return a + ratio * (b - a);
}

module.exports = Animation;



},{}],4:[function(require,module,exports){
function MiniMap() { //deprecated, please update
}

MiniMap.prototype.draw = function () {
    if (mapTimer <= 0 || serverMap === null) {
        var tileLength = Math.sqrt(Object.size(TILE_LIST));
        if (tileLength === 0 || !selfPlayer) {
            return;
        }
        var imgData = mainCtx.createImageData(tileLength, tileLength);
        var tile;
        var tileRGB;
        var i = 0;


        for (var id in TILE_LIST) {
            tileRGB = {};
            tile = TILE_LIST[id];
            if (tile.color && tile.alert || inBounds(selfPlayer, tile.x, tile.y)) {
                tileRGB.r = tile.color.r;
                tileRGB.g = tile.color.g;
                tileRGB.b = tile.color.b;
            }
            else {
                tileRGB.r = 0;
                tileRGB.g = 0;
                tileRGB.b = 0;
            }

            imgData.data[i] = tileRGB.r;
            imgData.data[i + 1] = tileRGB.g;
            imgData.data[i + 2] = tileRGB.b;
            imgData.data[i + 3] = 255;
            i += 4;
        }
        console.log(400 / Object.size(TILE_LIST));
        imgData = scaleImageData(imgData, Math.floor(400 / Object.size(TILE_LIST)), mainCtx);

        mMapCtx.putImageData(imgData, 0, 0);

        mMapCtxRot.rotate(90 * Math.PI / 180);
        mMapCtxRot.scale(1, -1);
        mMapCtxRot.drawImage(mMap, 0, 0);
        mMapCtxRot.scale(1, -1);
        mMapCtxRot.rotate(270 * Math.PI / 180);

        serverMap = mMapRot;
        mapTimer = 25;
    }

    else {
        mapTimer -= 1;
    }

    mainCtx.drawImage(serverMap, 800, 400);
}; //deprecated

MiniMap.prototype.scaleImageData = function (imageData, scale, mainCtx) {
    var scaled = mainCtx.createImageData(imageData.width * scale, imageData.height * scale);
    var subLine = mainCtx.createImageData(scale, 1).data;
    for (var row = 0; row < imageData.height; row++) {
        for (var col = 0; col < imageData.width; col++) {
            var sourcePixel = imageData.data.subarray(
                (row * imageData.width + col) * 4,
                (row * imageData.width + col) * 4 + 4
            );
            for (var x = 0; x < scale; x++) subLine.set(sourcePixel, x * 4)
            for (var y = 0; y < scale; y++) {
                var destRow = row * scale + y;
                var destCol = col * scale;
                scaled.data.set(subLine, (destRow * scaled.width + destCol) * 4)
            }
        }
    }

    return scaled;
};

module.exports = MiniMap;
},{}],5:[function(require,module,exports){
function Player(reader, client) {
    if (!reader) {
        console.log("MAKING NEW FAKE PLAYER");
        this.client = client;
        return; //for fake rock purposes
    }

    this.id = reader.readUInt32(); //player id
    this.x = reader.readUInt32() / 100; //real x
    this.y = reader.readUInt32() / 100; //real y

    this.radius = reader.readUInt16(); //radius

    var nameLength = reader.readUInt8();
    var name = "";

    for (var i = 0; i < nameLength; i++) {
        var char = String.fromCharCode(reader.readUInt8());
        name += char;
    }
    this.name = name;

    this.vertices = [];            //vertices
    var count = reader.readUInt8();
    for (var i = 0; i < count; i++) {
        this.vertices[i] = [];
        this.vertices[i][0] = reader.readInt16() / 1000;
        this.vertices[i][1] = reader.readInt16() / 1000;
    }

    this.health = reader.readUInt16(); //health
    this.maxHealth = reader.readUInt16(); //maxHealth

    this.theta = reader.readInt16() / 100; //theta
    this.level = reader.readUInt8(); //level


    switch (reader.readUInt8()) {    //flags
        case 1:
            this.vulnerable = true;
            break;
        case 16:
            this.shooting = true;
            break;
        case 17:
            this.vulnerable = true;
            this.shooting = true;
            break;
    }

    this.client = client;

    if (!this.client.SELF_PLAYER && this.id === this.client.SELF_ID) {
        this.client.SELF_PLAYER = this;
    }

    this.mover = {
        x: 0,
        y: 0
    };

    this.realMover = {
        x: 0,
        y: 0
    };
}


Player.prototype.update = function (reader) {
    this.updateTimer = 50;
    this.x = reader.readUInt32() / 100; //real x
    this.y = reader.readUInt32() / 100; //real y

    this.realRadius = reader.readUInt16(); //radius

    if (this.id === this.client.SELF_ID) {
        //this.client.mainScaleFactor = 50 / this.realRadius;
    }
    this.health = reader.readUInt16(); //health
    this.maxHealth = reader.readUInt16(); //maxHealth

    this.theta = reader.readInt16() / 100; //theta
    this.level = reader.readUInt8(); //level

    this.vulnerable = false;
    this.shooting = false;
    switch (reader.readUInt8()) {    //flags
        case 1:
            this.vulnerable = true;
            break;
        case 16:
            this.shooting = true;
            break;
        case 17:
            this.vulnerable = true;
            this.shooting = true;
            break;
    }

};


Player.prototype.tick = function () {
    if (this.realMover) {
        this.mover.x = lerp(this.mover.x, this.realMover.x, 0.15);
        this.mover.y = lerp(this.mover.y, this.realMover.y, 0.15);
    }
    //this.move(this.mover.x, this.mover.y);
};


Player.prototype.setMove = function (x, y) {
    this.realMover = {
        x: x,
        y: y
    };
};


Player.prototype.getTheta = function (target, origin) {
    this.theta = Math.atan2(target.y - origin.y, target.x - origin.x) % (2 * Math.PI);
};

Player.prototype.move = function (x, y) {
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

    var velBuffer = 3; //change soon

    this.x += 100 * x / normalVel / velBuffer;
    this.y += 100 * y / normalVel / velBuffer;

};


Player.prototype.show = function () {
    if (!this.radius) {
        this.radius = 1;
    }
    this.radius = lerp(this.radius, this.realRadius, 0.2);
    this.updateTimer -= 1;
    if (this.updateTimer <= 0) {
        delete this.client.PLAYER_LIST[this.id];
    }

    var ctx = this.client.mainCtx;
    var fillAlpha;
    var strokeAlpha;
    var i;


    fillAlpha = this.health / (4 * this.maxHealth);
    strokeAlpha = 1;

    ctx.font = "20px Arial";


    ctx.strokeStyle = "rgba(252, 102, 37," + strokeAlpha + ")";
    if (this.shooting) {
        ctx.fillStyle = "green";
    }
    else if (this.vulnerable) {
        ctx.fillStyle = "red";
    }
    else {
        ctx.fillStyle = "rgba(123,0,0," + fillAlpha + ")";
    }
    ctx.lineWidth = 10;


    ctx.beginPath();

    ctx.translate(this.x, this.y);
    ctx.rotate(this.theta);

    if (this.vertices) {
        var v = this.vertices;
        ctx.moveTo(v[0][0] * this.radius, v[0][1] * this.radius);
        for (i = 1; i < v.length; i++) {
            ctx.lineTo(v[i][0] * this.radius, v[i][1] * this.radius);
        }
        ctx.lineTo(v[0][0] * this.radius, v[0][1] * this.radius);
        ctx.fill();
        ctx.stroke();
    }
    else {
        ctx.fillRect(0, 0, 30, 30);
    }
    ctx.fill();
    ctx.stroke();

    ctx.rotate(2 * Math.PI - this.theta);


    if (!this.vulnerable) {
        if (this.health > this.maxHealth / 2) {
            ctx.fillStyle = "rgba(0, 255, 0, 0.3)";
        }
        else {
            ctx.fillStyle = "rgba(255, 0, 0, 0.3)";
        }

        ctx.arc(0, 0, this.radius * 2, 0, 2 * Math.PI);
        ctx.fill();
    }

    ctx.translate(-this.x, -this.y);


    ctx.closePath();


    ctx.fillStyle = "#ff9d60";
    ctx.fillText(this.name, this.x, this.y + 70);


    if (this.health && this.maxHealth && this.health > 0) { //health bar
        if (this.health > this.maxHealth) {
            console.log("PLAYER HAS TOO MUCH HEALTH: " + this.health, this.maxHealth);
        }
        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.strokeStyle = "black";
        ctx.rect(this.x - 400, this.y + 200, 800, 100);
        ctx.stroke();
        ctx.closePath();

        ctx.beginPath();
        ctx.fillStyle = "green";
        ctx.rect(this.x - 400, this.y + 200, 800 * this.health / this.maxHealth, 100);
        ctx.fill();
        ctx.closePath();
    } //display health bar


    ctx.closePath();
};


function getRandom(min, max) {
    return Math.random() * (max - min) + min;
}


function normal(x, y) {
    return Math.sqrt(x * x + y * y);
}

function lerp(a, b, ratio) {
    return a + ratio * (b - a);
}


module.exports = Player;
},{}],6:[function(require,module,exports){
function Rock(reader, client) {
    if (!reader) {
        console.log("MAKING NEW FAKE ROCK");
        this.client = client;
        return; //for fake rock purposes
    }
    var prev = reader._offset;


    this.id = reader.readUInt32();
    //console.log("NEW ROCK: " + this.id);

    this.owner = reader.readUInt32();
    this.x = reader.readUInt32() / 100;
    this.y = reader.readUInt32() / 100;

    this.vertices = [];
    var count = reader.readUInt16();
    //console.log("COUNT: " + count);
    for (var i = 0; i < count; i++) {
        this.vertices[i] = [];
        this.vertices[i][0] = reader.readInt16() / 1000;
        this.vertices[i][1] = reader.readInt16() / 1000;
    }

    this.health = reader.readInt16();
    this.maxHealth = reader.readInt16();

    this.theta = reader.readInt16() / 100;
    this.texture = reader.readUInt8();

    switch (reader.readUInt8()) {
        case 1:
            this.neutral = true;
            break;
        case 16:
            this.fast = true;
            break;
        case 17:
            this.neutral = true;
            this.fast = true;
            break;
    }
    var delta = reader._offset - prev;
    this.updates = [];
    this.updateTimer = 20;
    this.client = client;
}


Rock.prototype.update = function (reader) {
    this.owner = reader.readUInt32();

    var x = this.x;
    var y = this.y;

    this.x = reader.readUInt32() / 100;
    this.y = reader.readUInt32() / 100;

    if (this.x !== x || this.y !== y) {
        this.updateTimer = 200;
    }

    this.health = reader.readInt16();
    this.maxHealth = reader.readInt16();

    this.theta = reader.readInt16() / 100;

    this.neutral = false;
    this.fast = false;
    switch (reader.readUInt8()) { //flags
        case 1:
            this.neutral = true;
            break;
        case 16:
            this.fast = true;
            break;
        case 17:
            this.neutral = true;
            this.fast = true;
            break;
    }
};


Rock.prototype.show = function () {
    this.updateTimer -= 1;
    if (this.updateTimer <= 0) {
        console.log("DELETING ROCK VIA TIMEOUT: " + this.id);
        delete this.client.ROCK_LIST[this.id];
        return;
    }

    var ctx = this.client.mainCtx;
    var SCALE = 100;


    ctx.fillStyle = "pink"; //default color
    switch (this.texture) {
        case 1:
            ctx.fillStyle = "brown";
            break;
        case 2:
            ctx.fillStyle = "grey";
            break;
        case 3:
            ctx.fillStyle = "yellow";
            break;
        case 4:
            ctx.fillStyle = "green";
            break;
    }


    ctx.strokeStyle = !this.owner ? "blue" : "green";
    ctx.strokeStyle = this.fast ? "red" : ctx.strokeStyle;


    ctx.beginPath();

    ctx.translate(this.x, this.y);
    ctx.rotate(this.theta);

    if (this.vertices) {
        var v = this.vertices;
        ctx.moveTo(v[0][0] * SCALE, v[0][1] * SCALE);

        for (var i = 1; i < v.length; i++) {
            ctx.lineTo(v[i][0] * SCALE, v[i][1] * SCALE);
        }
        ctx.lineTo(v[0][0] * SCALE, v[0][1] * SCALE);
    }
    else {
        ctx.fillRect(0, 0, 30, 30);
    }

    ctx.fill();
    ctx.stroke();

    ctx.rotate(2 * Math.PI - this.theta);
    ctx.translate(-this.x, -this.y);

    ctx.closePath();

    if (1 === 2 && this.health && this.maxHealth && this.health > 0) { //health bar
        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.strokeStyle = "black";
        ctx.rect(this.x, this.y, 100, 20);
        ctx.stroke();
        ctx.closePath();

        ctx.beginPath();
        ctx.fillStyle = "green";
        ctx.rect(this.x, this.y, 100 * this.health / this.maxHealth, 20);
        ctx.fill();
        ctx.closePath();
    } //display health bar
};


function getRandom(min, max) {
    return Math.random() * (max - min) + min;
}

module.exports = Rock;
},{}],7:[function(require,module,exports){
function Tile(thisInfo, client) {
    this.id = thisInfo.id;
    this.x = thisInfo.x;
    this.y = thisInfo.y;
    this.length = thisInfo.length;
    this.color = thisInfo.color;
    this.topColor = {
        r: this.color.r + 10,
        g: this.color.g + 10,
        b: this.color.b + 10
    };
    this.borderColor = {
        r: this.color.r - 10,
        g: this.color.g - 10,
        b: this.color.b - 10
    };
    this.alert = thisInfo.alert;
    this.random = Math.floor(getRandom(0, 3));

    this.client = client;
}

Tile.prototype.update = function (thisInfo) {
    this.color = thisInfo.color;
    this.topColor = {
        r: this.color.r + 100,
        g: this.color.g + 100,
        b: this.color.b + 100
    };
    this.borderColor = {
        r: this.color.r - 10,
        g: this.color.g - 10,
        b: this.color.b - 10
    };
    this.alert = thisInfo.alert;
};

Tile.prototype.show = function () {
    var ctx = this.client.mainCtx;
    ctx.beginPath();

    ctx.strokeStyle = "rgb(" + this.borderColor.r + "," + this.borderColor.g + "," + this.borderColor.b + ")";
    ctx.lineWidth = 20;


    var grd = ctx.createLinearGradient(this.x + this.length * 3/4, this.y, this.x + this.length/4, this.y + this.length);
    grd.addColorStop(0, "rgb(" + this.topColor.r + "," + this.topColor.g + "," + this.topColor.b + ")");
    grd.addColorStop(1, "rgb(" + this.color.r + "," + this.color.g + "," + this.color.b + ")");
    ctx.fillStyle = grd;


    ctx.rect(this.x + 30, this.y + 30, this.length - 30, this.length - 30);

    ctx.stroke();
    ctx.fill();


};


module.exports = Tile;


function getRandom(min, max) {
    return Math.random() * (max - min) + min;
}
},{}],8:[function(require,module,exports){
module.exports = {
    Animation: require('./Animation'),
    Player: require('./Player'),
    MiniMap: require('./MiniMap'),
    Tile: require('./Tile'),
    Rock: require('./Rock')
};
},{"./Animation":3,"./MiniMap":4,"./Player":5,"./Rock":6,"./Tile":7}],9:[function(require,module,exports){
var Client = require('./Client.js');
var MainUI = require('./ui/MainUI');

var client = new Client();
client.start();



document.onkeydown = function (event) {
    client.keys[event.keyCode] = true;

    if (event.keyCode === 32) {
        console.log("SPACE");
        client.socket.emit("shootSelf", {
            id: client.SELF_ID
        });
    }
}.bind(this);

document.onkeyup = function (event) {
    if (event.keyCode === 84) {
        client.mainUI.gameUI.chatUI.textInput.click();
    }
    client.keys[event.keyCode] = false;
    client.socket.emit('keyEvent', {id: event.keyCode, state: false});
};


$(window).bind('mousewheel DOMMouseScroll', function (event) {
    if (event.ctrlKey === true) {
        event.preventDefault();
    }
    if (client.CHAT_SCROLL) {
        client.CHAT_SCROLL = false;
        return;
    }

    if(event.originalEvent.wheelDelta /120 > 0 && client.mainScaleFactor < 2) {
        client.mainScaleFactor += 0.05;
    }
    else if (client.mainScaleFactor > 0.25) {
        client.mainScaleFactor -= 0.05;
    }
});

document.addEventListener('contextmenu', function (e) { //prevent right-click context menu
    e.preventDefault();
}, false);
},{"./Client.js":2,"./ui/MainUI":10}],10:[function(require,module,exports){
document.documentElement.style.overflow = 'hidden';  // firefox, chrome
document.body.scroll = "no";

var PlayerNamerUI = require('./PlayerNamerUI');
var GameUI = require('./game/GameUI');

function MainUI(client, socket) {
    this.client = client;
    this.socket = socket;

    this.gameUI = new GameUI(this.client, this.socket, this);

    this.playerNamerUI = new PlayerNamerUI(this.client, this.socket);
}

MainUI.prototype.open = function (info) {
    var action = info.action;
    var home;
    if (action === "gameMsgPrompt") {
        this.gameUI.gameMsgPrompt.open(info.message);
    }
};


MainUI.prototype.close = function (action) {
    if (action === "gameMsgPrompt") {
        this.gameUI.gameMsgPrompt.close();
    }
};


MainUI.prototype.updateLeaderBoard = function () {
    var leaderboard = document.getElementById("leaderboard");
    var PLAYER_ARRAY = this.client.PLAYER_ARRAY;


    var playerSort = function (a, b) {
        var playerA = this.client.PLAYER_LIST[a];
        var playerB = this.client.PLAYER_LIST[b];
        return playerA.radius - playerB.radius;
    }.bind(this);

    PLAYER_ARRAY.sort(playerSort);


    leaderboard.innerHTML = "";
    for (var i = PLAYER_ARRAY.length - 1; i >= 0; i--) {
        var player = this.client.PLAYER_LIST[PLAYER_ARRAY[i]];

        if (player) {
            var entry = document.createElement('li');
            entry.appendChild(document.createTextNode(player.name + " - " + Math.floor(player.radius)));
            leaderboard.appendChild(entry);
        }
    }
};


module.exports = MainUI;
},{"./PlayerNamerUI":11,"./game/GameUI":14}],11:[function(require,module,exports){
function PlayerNamerUI (client, socket) {
    this.client = client;
    this.socket = socket;

    this.leaderboard = document.getElementById("leaderboard_container");
    this.nameBtn = document.getElementById("nameSubmit");
    this.playerNameInput = document.getElementById("playerNameInput");
    this.playerNamer = document.getElementById("player_namer");
}

PlayerNamerUI.prototype.open = function () {
    this.playerNameInput.addEventListener("keyup", function (event) {
        event.preventDefault();
        if (event.keyCode === 13) {
            this.nameBtn.click();
        }
    }.bind(this));

    this.nameBtn.addEventListener("click", function () {
        this.client.mainCanvas.style.visibility = "visible";
        this.leaderboard.style.visibility = "visible";
        this.socket.emit("newPlayer",
            {
                name: this.playerNameInput.value,
            });
        this.playerNamer.style.display = 'none';
    }.bind(this));

    this.playerNamer.style.visibility = "visible";
    this.playerNameInput.focus();
    this.leaderboard.style.visibility = "hidden";
};

module.exports = PlayerNamerUI;
},{}],12:[function(require,module,exports){
function ChatUI(parent) {
    this.parent = parent;
    this.template = document.getElementById("chat_container");
    this.textInput = document.getElementById('chat_input');
    this.chatList = document.getElementById('chat_list');


    this.textInput.addEventListener('click', function () {
        this.textInput.focus();

        this.parent.client.CHAT_OPEN = true;
        this.chatList.style.height = "80%";
        this.chatList.style.overflowY = "auto";

        this.textInput.style.background = "rgba(34, 48, 71, 1)";
    }.bind(this));
    this.textInput.addEventListener('keydown', function (e) {
        if (e.keyCode === 13) {
            this.sendMessage();
        }
    }.bind(this));


    this.template.addEventListener('mousewheel', function () {
        this.parent.client.CHAT_SCROLL = true;
    }.bind(this));

    this.template.addEventListener('mousedown', function () {
        this.parent.client.CHAT_CLICK = true;
    }.bind(this));
}

ChatUI.prototype.open = function (message) {
    this.template.style.display = "block";
    this.close();
};


ChatUI.prototype.close = function () {
    this.textInput.blur();
    this.parent.client.CHAT_OPEN = false;
    this.chatList.style.height = "30%";
    this.chatList.style.background = "rgba(182, 193, 211, 0.02)";
    this.textInput.style.background = "rgba(182, 193, 211, 0.1)";
    this.parent.client.CHAT_SCROLL = false;
    $('#chat_list').animate({scrollTop: $('#chat_list').prop("scrollHeight")}, 100);
    this.chatList.style.overflowY = "none";
};


ChatUI.prototype.addMessage = function (packet) {
    var entry = document.createElement('li');
    entry.appendChild(document.createTextNode(packet.name + " : " + packet.chatMessage));
    this.chatList.appendChild(entry);

    $('#chat_list').animate({scrollTop: $('#chat_list').prop("scrollHeight")}, 100);
};


ChatUI.prototype.sendMessage = function () {
    var socket = this.parent.socket;


    if (this.textInput.value && this.textInput.value !== "") {
        socket.emit('chatMessage', {
            id: this.parent.client.SELF_ID,
            message: this.textInput.value
        });
        this.textInput.value = "";
    }
    this.close();
};

module.exports = ChatUI;



},{}],13:[function(require,module,exports){
function GameMsgPrompt(parent) {
    this.parent = parent;
    this.template = document.getElementById("prompt_container");
    this.message = document.getElementById('game_msg_prompt');
}

GameMsgPrompt.prototype.open = function (message) {
    this.template.style.display = "block";
    this.message.innerHTML = message;
};

GameMsgPrompt.prototype.close = function () {
    this.template.style.display = "none";
};

module.exports = GameMsgPrompt;



},{}],14:[function(require,module,exports){
var GameMsgPrompt = require('./GameMsgPrompt');
var ChatUI = require('./ChatUI');

function GameUI(client, socket, parent) {
    this.client = client;
    this.socket = socket;
    this.parent = parent;
    this.gameMsgPrompt = new GameMsgPrompt(this);
    this.chatUI = new ChatUI(this);
}

GameUI.prototype.open = function () {
    console.log("OPENING GAME UI");
    this.chatUI.open();
};

module.exports =  GameUI;
},{"./ChatUI":12,"./GameMsgPrompt":13}]},{},[9])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvY2xpZW50L2pzL0JpbmFyeVJlYWRlci5qcyIsInNyYy9jbGllbnQvanMvQ2xpZW50LmpzIiwic3JjL2NsaWVudC9qcy9lbnRpdHkvQW5pbWF0aW9uLmpzIiwic3JjL2NsaWVudC9qcy9lbnRpdHkvTWluaU1hcC5qcyIsInNyYy9jbGllbnQvanMvZW50aXR5L1BsYXllci5qcyIsInNyYy9jbGllbnQvanMvZW50aXR5L1JvY2suanMiLCJzcmMvY2xpZW50L2pzL2VudGl0eS9UaWxlLmpzIiwic3JjL2NsaWVudC9qcy9lbnRpdHkvaW5kZXguanMiLCJzcmMvY2xpZW50L2pzL2luZGV4LmpzIiwic3JjL2NsaWVudC9qcy91aS9NYWluVUkuanMiLCJzcmMvY2xpZW50L2pzL3VpL1BsYXllck5hbWVyVUkuanMiLCJzcmMvY2xpZW50L2pzL3VpL2dhbWUvQ2hhdFVJLmpzIiwic3JjL2NsaWVudC9qcy91aS9nYW1lL0dhbWVNc2dQcm9tcHQuanMiLCJzcmMvY2xpZW50L2pzL3VpL2dhbWUvR2FtZVVJLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDekRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbmZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5RUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM1FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JLQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ05BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsImZ1bmN0aW9uIEJpbmFyeVJlYWRlcihkYXRhKSB7XHJcbiAgICB0aGlzLl9vZmZzZXQgPSAwO1xyXG4gICAgdGhpcy5fYnVmZmVyID0gbmV3IERhdGFWaWV3KGRhdGEpO1xyXG4gICAgLy9jb25zb2xlLmxvZyhkYXRhLmJ5dGVMZW5ndGgpO1xyXG59XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IEJpbmFyeVJlYWRlcjtcclxuXHJcblxyXG5CaW5hcnlSZWFkZXIucHJvdG90eXBlLnJlYWRJbnQ4ID0gZnVuY3Rpb24gKCkge1xyXG4gICAgdmFyIHZhbHVlID0gdGhpcy5fYnVmZmVyLmdldEludDgodGhpcy5fb2Zmc2V0KTtcclxuICAgIHRoaXMuX29mZnNldCArPSAxO1xyXG4gICAgcmV0dXJuIHZhbHVlO1xyXG59O1xyXG5cclxuQmluYXJ5UmVhZGVyLnByb3RvdHlwZS5yZWFkVUludDggPSBmdW5jdGlvbiAoKSB7XHJcbiAgICB2YXIgdmFsdWUgPSB0aGlzLl9idWZmZXIuZ2V0VWludDgodGhpcy5fb2Zmc2V0KTtcclxuICAgIHRoaXMuX29mZnNldCArPSAxO1xyXG4gICAgcmV0dXJuIHZhbHVlO1xyXG59O1xyXG5cclxuXHJcbkJpbmFyeVJlYWRlci5wcm90b3R5cGUucmVhZEludDE2ID0gZnVuY3Rpb24gKCkge1xyXG4gICAgdmFyIHZhbHVlID0gdGhpcy5fYnVmZmVyLmdldEludDE2KHRoaXMuX29mZnNldCk7XHJcbiAgICB0aGlzLl9vZmZzZXQgKz0gMjtcclxuICAgIHJldHVybiB2YWx1ZTtcclxufTtcclxuXHJcbkJpbmFyeVJlYWRlci5wcm90b3R5cGUucmVhZFVJbnQxNiA9IGZ1bmN0aW9uICgpIHtcclxuICAgIHZhciB2YWx1ZSA9IHRoaXMuX2J1ZmZlci5nZXRVaW50MTYodGhpcy5fb2Zmc2V0KTtcclxuICAgIHRoaXMuX29mZnNldCArPSAyO1xyXG4gICAgcmV0dXJuIHZhbHVlO1xyXG59O1xyXG5cclxuXHJcblxyXG5CaW5hcnlSZWFkZXIucHJvdG90eXBlLnJlYWRJbnQzMiA9IGZ1bmN0aW9uICgpIHtcclxuICAgIHZhciB2YWx1ZSA9IHRoaXMuX2J1ZmZlci5nZXRJbnQzMih0aGlzLl9vZmZzZXQpO1xyXG4gICAgdGhpcy5fb2Zmc2V0ICs9IDQ7XHJcbiAgICByZXR1cm4gdmFsdWU7XHJcbn07XHJcblxyXG5cclxuQmluYXJ5UmVhZGVyLnByb3RvdHlwZS5yZWFkVUludDMyID0gZnVuY3Rpb24gKCkge1xyXG4gICAgdmFyIHZhbHVlID0gdGhpcy5fYnVmZmVyLmdldFVpbnQzMih0aGlzLl9vZmZzZXQpO1xyXG4gICAgdGhpcy5fb2Zmc2V0ICs9IDQ7XHJcbiAgICByZXR1cm4gdmFsdWU7XHJcbn07XHJcblxyXG5CaW5hcnlSZWFkZXIucHJvdG90eXBlLnNraXBCeXRlcyA9IGZ1bmN0aW9uIChsZW5ndGgpIHtcclxuICAgIHRoaXMuX29mZnNldCArPSBsZW5ndGg7XHJcbn07XHJcblxyXG5CaW5hcnlSZWFkZXIucHJvdG90eXBlLmxlbmd0aCA9IGZ1bmN0aW9uICgpIHtcclxuICAgIHJldHVybiB0aGlzLl9idWZmZXIuYnl0ZUxlbmd0aDtcclxufTtcclxuXHJcbiIsInZhciBFbnRpdHkgPSByZXF1aXJlKCcuL2VudGl0eScpO1xyXG52YXIgTWFpblVJID0gcmVxdWlyZSgnLi91aS9NYWluVUknKTtcclxudmFyIEJpbmFyeVJlYWRlciA9IHJlcXVpcmUoJy4vQmluYXJ5UmVhZGVyJyk7XHJcblxyXG5mdW5jdGlvbiBDbGllbnQoKSB7XHJcbiAgICB0aGlzLlNFTEZfSUQgPSBudWxsO1xyXG4gICAgdGhpcy5TRUxGX1BMQVlFUiA9IG51bGw7XHJcbiAgICB0aGlzLlRSQUlMID0gbnVsbDtcclxuICAgIHRoaXMudXBkYXRlcyA9IFtdO1xyXG5cclxuICAgIHRoaXMuY3VyclBpbmcgPSAwO1xyXG5cclxuICAgIHRoaXMuaW5pdCgpO1xyXG59XHJcblxyXG5DbGllbnQucHJvdG90eXBlLmluaXQgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICB0aGlzLmluaXRTb2NrZXQoKTtcclxuICAgIHRoaXMuaW5pdENhbnZhc2VzKCk7XHJcbiAgICB0aGlzLmluaXRMaXN0cygpO1xyXG4gICAgdGhpcy5pbml0Vmlld2VycygpO1xyXG59O1xyXG5DbGllbnQucHJvdG90eXBlLmluaXRTb2NrZXQgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICB0aGlzLnNvY2tldCA9IGlvKCk7XHJcbiAgICB0aGlzLnNvY2tldC52ZXJpZmllZCA9IGZhbHNlO1xyXG5cclxuICAgIHRoaXMuc29ja2V0Lm9uKCdpbml0VmVyaWZpY2F0aW9uJywgdGhpcy52ZXJpZnkuYmluZCh0aGlzKSk7XHJcblxyXG4gICAgdGhpcy5zb2NrZXQub24oJ3VwZGF0ZUVudGl0aWVzJywgdGhpcy5oYW5kbGVQYWNrZXQuYmluZCh0aGlzKSk7XHJcbiAgICB0aGlzLnNvY2tldC5vbigndXBkYXRlQmluYXJ5JywgdGhpcy5oYW5kbGVCaW5hcnkuYmluZCh0aGlzKSk7XHJcblxyXG5cclxuICAgIHRoaXMuc29ja2V0Lm9uKCdjaGF0TWVzc2FnZScsIHRoaXMubWFpblVJKTtcclxuICAgIHRoaXMuc29ja2V0Lm9uKCdwaW5nJywgdGhpcy5zZW5kUG9uZy5iaW5kKHRoaXMpKTtcclxuICAgIHRoaXMuc29ja2V0Lm9uKCdmaW5hbFBpbmcnLCBmdW5jdGlvbiAobWVzc2FnZSkge1xyXG4gICAgICAgIC8vY29uc29sZS5sb2coXCJQSU5HOiBcIiArIG1lc3NhZ2UpO1xyXG4gICAgICAgIHRoaXMuY3VyclBpbmcgPSBtZXNzYWdlO1xyXG4gICAgICAgIGlmICh0aGlzLmN1cnJQaW5nID4gOTAwMDApIHtcclxuICAgICAgICAgICAgdGhpcy5jdXJyUGluZyA9IDEwO1xyXG4gICAgICAgIH1cclxuICAgIH0pO1xyXG5cclxuXHJcbn07XHJcblxyXG5DbGllbnQucHJvdG90eXBlLnNlbmRQb25nID0gZnVuY3Rpb24gKG1lc3NhZ2UpIHtcclxuICAgIHRoaXMuc29ja2V0LmVtaXQoXCJwb25nMTIzXCIsIG1lc3NhZ2UpO1xyXG59O1xyXG5cclxuXHJcbkNsaWVudC5wcm90b3R5cGUuaW5pdENhbnZhc2VzID0gZnVuY3Rpb24gKCkge1xyXG4gICAgdGhpcy5tYWluQ2FudmFzID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJtYWluX2NhbnZhc1wiKTtcclxuICAgIHRoaXMubWFpbkNhbnZhcy5zdHlsZS5ib3JkZXIgPSAnMXB4IHNvbGlkICMwMDAwMDAnO1xyXG4gICAgdGhpcy5tYWluQ2FudmFzLnN0eWxlLnZpc2liaWxpdHkgPSBcImhpZGRlblwiO1xyXG4gICAgdGhpcy5tYWluQ3R4ID0gdGhpcy5tYWluQ2FudmFzLmdldENvbnRleHQoXCIyZFwiKTtcclxuXHJcblxyXG4gICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcihcIm1vdXNlZG93blwiLCBmdW5jdGlvbiAoZXZlbnQpIHtcclxuICAgICAgICBpZiAoIXRoaXMuU0VMRl9JRCkge1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHZhciB4ID0gKChldmVudC54IC8gdGhpcy5tYWluQ2FudmFzLm9mZnNldFdpZHRoICogMTAwMCkgLSB0aGlzLm1haW5DYW52YXMud2lkdGggLyAyKSAvIHRoaXMuc2NhbGVGYWN0b3I7XHJcbiAgICAgICAgdmFyIHkgPSAoKGV2ZW50LnkgLyB0aGlzLm1haW5DYW52YXMub2Zmc2V0SGVpZ2h0ICogNTAwKSAtIHRoaXMubWFpbkNhbnZhcy5oZWlnaHQgLyAyKSAvIHRoaXMuc2NhbGVGYWN0b3I7XHJcblxyXG5cclxuICAgICAgICBpZiAoTWF0aC5hYnMoeCkgKyBNYXRoLmFicyh5KSA8IDIwMCkge1xyXG4gICAgICAgICAgICB0aGlzLnBsYXllckNsaWNrZWQgPSB0cnVlO1xyXG4gICAgICAgICAgICB0aGlzLmNpcmNsZUNvbnN0cnVjdCA9IFtdO1xyXG4gICAgICAgICAgICB0aGlzLmNpcmNsZVN0YWdlQ291bnQgPSAwO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgdGhpcy5jbGlja1RlbXAgPSB0cnVlO1xyXG4gICAgICAgICAgICB0aGlzLmNsaWNrVGltZXIgPSAwO1xyXG4gICAgICAgIH1cclxuICAgIH0uYmluZCh0aGlzKSk7XHJcbiAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKFwibW91c2V1cFwiLCBmdW5jdGlvbiAoZXZlbnQpIHtcclxuICAgICAgICBpZiAoIXRoaXMuU0VMRl9JRCkge1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHZhciB4ID0gKChldmVudC54IC8gdGhpcy5tYWluQ2FudmFzLm9mZnNldFdpZHRoICogMTAwMCkgLSB0aGlzLm1haW5DYW52YXMud2lkdGggLyAyKSAvIHRoaXMuc2NhbGVGYWN0b3I7XHJcbiAgICAgICAgdmFyIHkgPSAoKGV2ZW50LnkgLyB0aGlzLm1haW5DYW52YXMub2Zmc2V0SGVpZ2h0ICogNTAwKSAtIHRoaXMubWFpbkNhbnZhcy5oZWlnaHQgLyAyKSAvIHRoaXMuc2NhbGVGYWN0b3I7XHJcblxyXG4gICAgICAgIHRoaXMuc29ja2V0LmVtaXQoXCJzaG9vdFNlbGZcIiwge1xyXG4gICAgICAgICAgICBpZDogdGhpcy5TRUxGX0lELFxyXG4gICAgICAgICAgICB4OiB4LFxyXG4gICAgICAgICAgICB5OiB5XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIHRoaXMuY2xpY2tUZW1wID0gZmFsc2U7XHJcbiAgICAgICAgdGhpcy5jbGlja1RpbWVyID0gMDtcclxuXHJcbiAgICB9LmJpbmQodGhpcykpO1xyXG5cclxuXHJcbiAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKFwibW91c2Vtb3ZlXCIsIGZ1bmN0aW9uIChldmVudCkge1xyXG4gICAgICAgIGlmICghdGhpcy5TRUxGX1BMQVlFUikge1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB2YXIgeCA9ICgoZXZlbnQueCAvIHRoaXMubWFpbkNhbnZhcy5vZmZzZXRXaWR0aCAqIDEwMDApIC1cclxuICAgICAgICAgICAgdGhpcy5tYWluQ2FudmFzLndpZHRoIC8gMikgLyB0aGlzLnNjYWxlRmFjdG9yO1xyXG4gICAgICAgIHZhciB5ID0gKChldmVudC55IC8gdGhpcy5tYWluQ2FudmFzLm9mZnNldEhlaWdodCAqIDUwMCkgLVxyXG4gICAgICAgICAgICB0aGlzLm1haW5DYW52YXMuaGVpZ2h0IC8gMikgLyB0aGlzLnNjYWxlRmFjdG9yO1xyXG5cclxuICAgICAgICBpZiAoc3F1YXJlKHgpICsgc3F1YXJlKHkpID4gc3F1YXJlKHRoaXMuU0VMRl9QTEFZRVIucmFuZ2UpKSB7IC8vaWYgbm90IGluIHJhbmdlXHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmICghdGhpcy5wcmUpIHtcclxuICAgICAgICAgICAgdGhpcy5wcmUgPSB7eDogeCwgeTogeX1cclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZSBpZiAoc3F1YXJlKHRoaXMucHJlLnggLSB4KSArIHNxdWFyZSh0aGlzLnByZS55IC0geSkgPiA4MCkge1xyXG4gICAgICAgICAgICB0aGlzLnByZSA9IHt4OiB4LCB5OiB5fTtcclxuXHJcbiAgICAgICAgICAgIGlmIChNYXRoLmFicyh4KSA8IDUwICYmIE1hdGguYWJzKHkpIDwgNTApIHtcclxuICAgICAgICAgICAgICAgIHggPSAwO1xyXG4gICAgICAgICAgICAgICAgeSA9IDA7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIHRoaXMuc29ja2V0LmVtaXQoJ21vdmUnLCB7XHJcbiAgICAgICAgICAgICAgICBpZDogdGhpcy5TRUxGX0lELFxyXG4gICAgICAgICAgICAgICAgeDogeCxcclxuICAgICAgICAgICAgICAgIHk6IHlcclxuICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgICB0aGlzLlNFTEZfUExBWUVSLnNldE1vdmUoeCwgeSk7XHJcbiAgICAgICAgfVxyXG4gICAgfS5iaW5kKHRoaXMpKTtcclxufTtcclxuXHJcblxyXG5DbGllbnQucHJvdG90eXBlLnNlbmRDaXJjbGUgPSBmdW5jdGlvbiAoY29uc3RydWN0KSB7XHJcblxyXG4gICAgdmFyIHJhZGlpTm9ybWFsID0gZnVuY3Rpb24gKHZlY3Rvcikge1xyXG4gICAgICAgIGlmICghdmVjdG9yKSB7XHJcbiAgICAgICAgICAgIHJldHVybiAwO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gKHZlY3Rvci54ICogdmVjdG9yLnggKyB2ZWN0b3IueSAqIHZlY3Rvci55KTtcclxuICAgIH07XHJcblxyXG4gICAgdmFyIG1heFJhZGl1cyA9IE1hdGguc3FydChNYXRoLm1heChcclxuICAgICAgICByYWRpaU5vcm1hbChjb25zdHJ1Y3RbMF0pLFxyXG4gICAgICAgIHJhZGlpTm9ybWFsKGNvbnN0cnVjdFsxXSksXHJcbiAgICAgICAgcmFkaWlOb3JtYWwoY29uc3RydWN0WzJdKSxcclxuICAgICAgICByYWRpaU5vcm1hbChjb25zdHJ1Y3RbM10pKSk7XHJcblxyXG4gICAgaWYgKG1heFJhZGl1cykge1xyXG4gICAgICAgIHRoaXMuc29ja2V0LmVtaXQoXCJjcmVhdGVDaXJjbGVcIiwge1xyXG4gICAgICAgICAgICBpZDogdGhpcy5TRUxGX0lELFxyXG4gICAgICAgICAgICByYWRpdXM6IG1heFJhZGl1c1xyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG59O1xyXG5cclxuQ2xpZW50LnByb3RvdHlwZS5pbml0TGlzdHMgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICB0aGlzLlBMQVlFUl9MSVNUID0ge307XHJcbiAgICB0aGlzLlRJTEVfTElTVCA9IHt9O1xyXG4gICAgdGhpcy5ST0NLX0xJU1QgPSB7fTtcclxuICAgIHRoaXMuQVNURVJPSURfTElTVCA9IHt9O1xyXG4gICAgdGhpcy5BTklNQVRJT05fTElTVCA9IHt9O1xyXG4gICAgdGhpcy5QTEFZRVJfQVJSQVkgPSBbXTtcclxufTtcclxuQ2xpZW50LnByb3RvdHlwZS5pbml0Vmlld2VycyA9IGZ1bmN0aW9uICgpIHtcclxuICAgIHRoaXMua2V5cyA9IFtdO1xyXG4gICAgdGhpcy5zY2FsZUZhY3RvciA9IDE7XHJcbiAgICB0aGlzLm1haW5TY2FsZUZhY3RvciA9IDAuNTtcclxuICAgIHRoaXMubWFpblVJID0gbmV3IE1haW5VSSh0aGlzLCB0aGlzLnNvY2tldCk7XHJcbiAgICB0aGlzLm1haW5VSS5wbGF5ZXJOYW1lclVJLm9wZW4oKTtcclxufTtcclxuXHJcbkNsaWVudC5wcm90b3R5cGUudmVyaWZ5ID0gZnVuY3Rpb24gKGRhdGEpIHtcclxuICAgIGlmICghdGhpcy5zb2NrZXQudmVyaWZpZWQpIHtcclxuICAgICAgICBjb25zb2xlLmxvZyhcIlZFUklGSUVEIENMSUVOVFwiKTtcclxuICAgICAgICB0aGlzLnNvY2tldC5lbWl0KFwidmVyaWZ5XCIsIHt9KTtcclxuICAgICAgICB0aGlzLnNvY2tldC52ZXJpZmllZCA9IHRydWU7XHJcbiAgICB9XHJcbn07XHJcblxyXG5cclxuQ2xpZW50LnByb3RvdHlwZS5hcHBseVVwZGF0ZSA9IGZ1bmN0aW9uIChyZWFkZXIpIHtcclxuICAgIHZhciBpO1xyXG5cclxuICAgIHZhciByb2NrTGVuZ3RoID0gcmVhZGVyLnJlYWRVSW50MTYoKTsgLy9hZGQgcm9ja3NcclxuICAgIGZvciAoaSA9IDA7IGkgPCByb2NrTGVuZ3RoOyBpKyspIHtcclxuICAgICAgICByb2NrID0gbmV3IEVudGl0eS5Sb2NrKHJlYWRlciwgdGhpcyk7XHJcbiAgICAgICAgdGhpcy5ST0NLX0xJU1Rbcm9jay5pZF0gPSByb2NrO1xyXG4gICAgfVxyXG5cclxuICAgIHZhciBwbGF5ZXJMZW5ndGggPSByZWFkZXIucmVhZFVJbnQ4KCk7IC8vYWRkIHBsYXllcnNcclxuICAgIGlmIChwbGF5ZXJMZW5ndGggPiAwKSB7XHJcbiAgICAgICAgY29uc29sZS5sb2coXCJBVFRFTVBUSU5HIEFERCBORVcgUExBWUVSXCIpO1xyXG4gICAgfVxyXG4gICAgZm9yIChpID0gMDsgaSA8IHBsYXllckxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgcGxheWVyID0gbmV3IEVudGl0eS5QbGF5ZXIocmVhZGVyLCB0aGlzKTtcclxuICAgICAgICBpZiAocGxheWVyLmlkID09PSB0aGlzLlNFTEZfSUQpIHtcclxuICAgICAgICAgICAgdGhpcy5TRUxGX1BMQVlFUiA9IHBsYXllcjtcclxuICAgICAgICB9XHJcbiAgICAgICAgdGhpcy5QTEFZRVJfTElTVFtwbGF5ZXIuaWRdID0gcGxheWVyO1xyXG5cclxuICAgICAgICBpZiAodGhpcy5QTEFZRVJfQVJSQVkuaW5kZXhPZihwbGF5ZXIuaWQpID09PSAtMSkge1xyXG4gICAgICAgICAgICB0aGlzLlBMQVlFUl9BUlJBWS5wdXNoKHBsYXllci5pZCk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHZhciByb2NrMkxlbmd0aCA9IHJlYWRlci5yZWFkVUludDE2KCk7IC8vdXBkYXRlIHJvY2tzXHJcbiAgICBmb3IgKGkgPSAwOyBpIDwgcm9jazJMZW5ndGg7IGkrKykge1xyXG4gICAgICAgIHZhciBpZCA9IHJlYWRlci5yZWFkVUludDMyKCk7XHJcbiAgICAgICAgcm9jayA9IHRoaXMuUk9DS19MSVNUW2lkXTtcclxuICAgICAgICBpZiAocm9jaykge1xyXG4gICAgICAgICAgICByb2NrLnVwZGF0ZShyZWFkZXIpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgY29uc29sZS5sb2coXCJNQUtJTkcgTkVXIEZBS0UgUk9DSyBcIiArIGlkKTtcclxuXHJcbiAgICAgICAgICAgIHZhciBmYWtlUm9jayA9IG5ldyBFbnRpdHkuUm9jayhudWxsLCB0aGlzKTtcclxuICAgICAgICAgICAgZmFrZVJvY2sudXBkYXRlKHJlYWRlcik7XHJcblxyXG4gICAgICAgICAgICB0aGlzLlJPQ0tfTElTVFtpZF0gPSBmYWtlUm9jaztcclxuXHJcbiAgICAgICAgICAgIHRoaXMuc29ja2V0LmVtaXQoXCJnZXRSb2NrXCIsIHtcclxuICAgICAgICAgICAgICAgIGlkOiBpZFxyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG5cclxuICAgIHZhciBwbGF5ZXIyTGVuZ3RoID0gcmVhZGVyLnJlYWRVSW50OCgpO1xyXG4gICAgLy9jb25zb2xlLmxvZyhcIlBMQVlFUiBVUERBVEUgTEVOR1RIOiBcIiArIHBsYXllcjJMZW5ndGgpO1xyXG4gICAgZm9yIChpID0gMDsgaSA8IHBsYXllcjJMZW5ndGg7IGkrKykge1xyXG4gICAgICAgIGlkID0gcmVhZGVyLnJlYWRVSW50MzIoKTtcclxuICAgICAgICB2YXIgcGxheWVyID0gdGhpcy5QTEFZRVJfTElTVFtpZF07XHJcbiAgICAgICAgaWYgKHBsYXllcikge1xyXG4gICAgICAgICAgICBwbGF5ZXIudXBkYXRlKHJlYWRlcik7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICAvL2NvbnNvbGUubG9nKFwiTk8gUExBWUVSIEFEREVEOiBcIiArIGlkKTtcclxuICAgICAgICAgICAgdmFyIGZha2VQbGF5ZXIgPSBuZXcgRW50aXR5LlBsYXllcihudWxsLCB0aGlzKTtcclxuICAgICAgICAgICAgZmFrZVBsYXllci51cGRhdGUocmVhZGVyKTtcclxuXHJcbiAgICAgICAgICAgIHRoaXMuUExBWUVSX0xJU1RbaWRdID0gZmFrZVBsYXllcjtcclxuXHJcbiAgICAgICAgICAgIHRoaXMuc29ja2V0LmVtaXQoXCJnZXRQbGF5ZXJcIiwge1xyXG4gICAgICAgICAgICAgICAgaWQ6IGlkXHJcbiAgICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICAgICAgY29uc29sZS5sb2coXCJFTUlUVElORyBHRVRQTEFZRVJcIik7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHZhciByb2NrM0xlbmd0aCA9IHJlYWRlci5yZWFkVUludDE2KCk7IC8vZGVsZXRlIHJvY2tzXHJcbiAgICBmb3IgKGkgPSAwOyBpIDwgcm9jazNMZW5ndGg7IGkrKykge1xyXG4gICAgICAgIGlkID0gcmVhZGVyLnJlYWRVSW50MzIoKTtcclxuICAgICAgICBkZWxldGUgdGhpcy5ST0NLX0xJU1RbaWRdO1xyXG5cclxuICAgICAgICAvL2NvbnNvbGUubG9nKFwiREVMRVRFRCBST0NLIE5PUk1BTExZOiBcIiArIGlkKTtcclxuICAgIH1cclxuXHJcbiAgICB2YXIgcGxheWVyM0xlbmd0aCA9IHJlYWRlci5yZWFkVUludDgoKTtcclxuICAgIGZvciAoaSA9IDA7IGkgPCBwbGF5ZXIzTGVuZ3RoOyBpKyspIHtcclxuICAgICAgICBpZCA9IHJlYWRlci5yZWFkVUludDMyKCk7XHJcblxyXG4gICAgICAgIGNvbnNvbGUubG9nKFwiREVMRVRJTkcgUExBWUVSOiBcIiArIGlkKTtcclxuXHJcbiAgICAgICAgZGVsZXRlIHRoaXMuUExBWUVSX0xJU1RbaWRdO1xyXG4gICAgICAgIHZhciBpbmRleCA9IHRoaXMuUExBWUVSX0FSUkFZLmluZGV4T2YoaWQpO1xyXG4gICAgICAgIHRoaXMuUExBWUVSX0FSUkFZLnNwbGljZShpbmRleCwgMSk7XHJcbiAgICB9XHJcbn07XHJcblxyXG5cclxuQ2xpZW50LnByb3RvdHlwZS5oYW5kbGVCaW5hcnkgPSBmdW5jdGlvbiAoZGF0YSkge1xyXG4gICAgdmFyIHJlYWRlciA9IG5ldyBCaW5hcnlSZWFkZXIoZGF0YSk7XHJcbiAgICBpZiAocmVhZGVyLmxlbmd0aCgpIDwgMSkge1xyXG4gICAgICAgIHJldHVybjtcclxuICAgIH1cclxuICAgIHZhciBzdGVwID0gcmVhZGVyLnJlYWRVSW50MzIoKTtcclxuXHJcbiAgICBpZiAoIXRoaXMuaW5pdGlhbFN0ZXApIHtcclxuICAgICAgICB0aGlzLmluaXRpYWxTdGVwID0gc3RlcDtcclxuICAgIH1cclxuICAgIGVsc2UgaWYgKHRoaXMuaW5pdGlhbFN0ZXAgPT09IHN0ZXApIHtcclxuICAgICAgICByZXR1cm47XHJcbiAgICB9XHJcbiAgICB0aGlzLmxhc3RTdGVwID0gc3RlcDtcclxuXHJcbiAgICAvL2NvbnNvbGUubG9nKFwiTEFTVCBTVEVQOiBcIiArIHN0ZXApO1xyXG5cclxuICAgIGlmICghdGhpcy5jdXJyU3RlcCkge1xyXG4gICAgICAgIHRoaXMuY3VyclN0ZXAgPSBzdGVwIC0gMztcclxuICAgIH1cclxuXHJcblxyXG4gICAgdGhpcy51cGRhdGVzLnB1c2goe1xyXG4gICAgICAgIHN0ZXA6IHN0ZXAsXHJcbiAgICAgICAgcmVhZGVyOiByZWFkZXJcclxuICAgIH0pO1xyXG59O1xyXG5cclxuXHJcbkNsaWVudC5wcm90b3R5cGUuaGFuZGxlUGFja2V0ID0gZnVuY3Rpb24gKGRhdGEpIHtcclxuICAgIHZhciBwYWNrZXQsIGk7XHJcbiAgICBmb3IgKGkgPSAwOyBpIDwgZGF0YS5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgIHBhY2tldCA9IGRhdGFbaV07XHJcbiAgICAgICAgc3dpdGNoIChwYWNrZXQubWFzdGVyKSB7XHJcbiAgICAgICAgICAgIGNhc2UgXCJhZGRcIjpcclxuICAgICAgICAgICAgICAgIHRoaXMuYWRkRW50aXRpZXMocGFja2V0KTtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxufTtcclxuXHJcblxyXG5DbGllbnQucHJvdG90eXBlLmFkZEVudGl0aWVzID0gZnVuY3Rpb24gKHBhY2tldCkge1xyXG4gICAgdmFyIGFkZEVudGl0eSA9IGZ1bmN0aW9uIChwYWNrZXQsIGxpc3QsIGVudGl0eSwgYXJyYXkpIHtcclxuICAgICAgICBpZiAoIXBhY2tldCkge1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGxpc3RbcGFja2V0LmlkXSA9IG5ldyBlbnRpdHkocGFja2V0LCB0aGlzKTtcclxuICAgICAgICBpZiAoYXJyYXkgJiYgYXJyYXkuaW5kZXhPZihwYWNrZXQuaWQpID09PSAtMSkge1xyXG4gICAgICAgICAgICBhcnJheS5wdXNoKHBhY2tldC5pZCk7XHJcbiAgICAgICAgfVxyXG4gICAgfS5iaW5kKHRoaXMpO1xyXG5cclxuICAgIHN3aXRjaCAocGFja2V0LmNsYXNzKSB7XHJcbiAgICAgICAgY2FzZSBcInRpbGVJbmZvXCI6XHJcbiAgICAgICAgICAgIGFkZEVudGl0eShwYWNrZXQsIHRoaXMuVElMRV9MSVNULCBFbnRpdHkuVGlsZSk7XHJcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiQURERUQgVElMRVwiKTtcclxuICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgY2FzZSBcInNlbGZJZFwiOlxyXG4gICAgICAgICAgICBpZiAoIXRoaXMuU0VMRl9JRCkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5TRUxGX0lEID0gcGFja2V0LnNlbGZJZDtcclxuICAgICAgICAgICAgICAgIHRoaXMubWFpblVJLmdhbWVVSS5vcGVuKCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgY2FzZSBcImNoYXRJbmZvXCI6XHJcbiAgICAgICAgICAgIHRoaXMubWFpblVJLmdhbWVVSS5jaGF0VUkuYWRkTWVzc2FnZShwYWNrZXQpO1xyXG4gICAgICAgICAgICBicmVhaztcclxuICAgIH1cclxufTtcclxuXHJcblxyXG5DbGllbnQucHJvdG90eXBlLmRyYXdTY2VuZSA9IGZ1bmN0aW9uIChkYXRhKSB7XHJcbiAgICB0aGlzLm1haW5VSS51cGRhdGVMZWFkZXJCb2FyZCgpO1xyXG5cclxuICAgIHZhciBpZDtcclxuICAgIHZhciBlbnRpdHlMaXN0ID0gW1xyXG4gICAgICAgIHRoaXMuVElMRV9MSVNULFxyXG4gICAgICAgIHRoaXMuUExBWUVSX0xJU1QsXHJcbiAgICAgICAgdGhpcy5BU1RFUk9JRF9MSVNULFxyXG4gICAgICAgIHRoaXMuQU5JTUFUSU9OX0xJU1QsXHJcbiAgICAgICAgdGhpcy5ST0NLX0xJU1RcclxuICAgIF07XHJcblxyXG4gICAgdmFyIGluQm91bmRzID0gZnVuY3Rpb24gKHBsYXllciwgeCwgeSkge1xyXG4gICAgICAgIHZhciByYW5nZSA9IHRoaXMubWFpbkNhbnZhcy53aWR0aCAvICgwLjcgKiB0aGlzLnNjYWxlRmFjdG9yKTtcclxuICAgICAgICByZXR1cm4geCA8IChwbGF5ZXIueCArIHJhbmdlKSAmJiB4ID4gKHBsYXllci54IC0gcmFuZ2UpXHJcbiAgICAgICAgICAgICYmIHkgPCAocGxheWVyLnkgKyByYW5nZSkgJiYgeSA+IChwbGF5ZXIueSAtIHJhbmdlKTtcclxuICAgIH0uYmluZCh0aGlzKTtcclxuXHJcbiAgICB2YXIgdHJhbnNsYXRlU2NlbmUgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgdGhpcy5tYWluQ3R4LnNldFRyYW5zZm9ybSgxLCAwLCAwLCAxLCAwLCAwKTtcclxuICAgICAgICB0aGlzLnNjYWxlRmFjdG9yID0gbGVycCh0aGlzLnNjYWxlRmFjdG9yLCB0aGlzLm1haW5TY2FsZUZhY3RvciwgMC4zKTtcclxuICAgICAgICB0aGlzLm1haW5DdHgudHJhbnNsYXRlKHRoaXMubWFpbkNhbnZhcy53aWR0aCAvIDIsIHRoaXMubWFpbkNhbnZhcy5oZWlnaHQgLyAyKTtcclxuICAgICAgICB0aGlzLm1haW5DdHguc2NhbGUodGhpcy5zY2FsZUZhY3RvciwgdGhpcy5zY2FsZUZhY3Rvcik7XHJcbiAgICAgICAgdGhpcy5tYWluQ3R4LnRyYW5zbGF0ZSgtdGhpcy5TRUxGX1BMQVlFUi54LCAtdGhpcy5TRUxGX1BMQVlFUi55KTtcclxuICAgIH0uYmluZCh0aGlzKTtcclxuXHJcblxyXG5cclxuICAgIHRoaXMuU0VMRl9QTEFZRVIudGljaygpO1xyXG5cclxuXHJcbiAgICB0cmFuc2xhdGVTY2VuZSgpO1xyXG4gICAgdGhpcy5tYWluQ3R4LmNsZWFyUmVjdCgwLCAwLCA1MDAwMCwgNTAwMDApO1xyXG5cclxuICAgIHRoaXMubWFpbkN0eC5maWxsU3R5bGUgPSBcIiMxZDFmMjFcIjtcclxuICAgIHRoaXMubWFpbkN0eC5maWxsUmVjdCgwLCAwLCA1MDAwMCwgNTAwMDApO1xyXG5cclxuXHJcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGVudGl0eUxpc3QubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICB2YXIgbGlzdCA9IGVudGl0eUxpc3RbaV07XHJcbiAgICAgICAgZm9yIChpZCBpbiBsaXN0KSB7XHJcbiAgICAgICAgICAgIHZhciBlbnRpdHkgPSBsaXN0W2lkXTtcclxuICAgICAgICAgICAgaWYgKGluQm91bmRzKHRoaXMuU0VMRl9QTEFZRVIsIGVudGl0eS54LCBlbnRpdHkueSkpIHtcclxuICAgICAgICAgICAgICAgIGVudGl0eS5zaG93KCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICBpZiAodGhpcy5UUkFJTCAmJiAhdGhpcy5hY3RpdmUpIHtcclxuICAgICAgICB0aGlzLlRSQUlMLnNob3coKTtcclxuICAgIH1cclxufTtcclxuXHJcbkNsaWVudC5wcm90b3R5cGUuY2xpZW50VXBkYXRlID0gZnVuY3Rpb24gKCkge1xyXG4gICAgdGhpcy51cGRhdGVTdGVwKCk7XHJcblxyXG5cclxuICAgIGlmICghdGhpcy5TRUxGX1BMQVlFUikge1xyXG4gICAgICAgIGlmICh0aGlzLlNFTEZfSUQpIHtcclxuICAgICAgICAgICAgdGhpcy5TRUxGX1BMQVlFUiA9IHRoaXMuUExBWUVSX0xJU1RbdGhpcy5TRUxGX0lEXTtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuICAgIHRoaXMuZHJhd1NjZW5lKCk7XHJcbn07XHJcblxyXG5DbGllbnQucHJvdG90eXBlLnVwZGF0ZVN0ZXAgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICB2YXIgc3RlcFJhbmdlID0gdGhpcy5sYXN0U3RlcCAtIHRoaXMuY3VyclN0ZXA7XHJcbiAgICB2YXIgdXBkYXRlO1xyXG5cclxuICAgIGlmICghc3RlcFJhbmdlKSB7XHJcbiAgICAgICAgLy9jb25zb2xlLmxvZyhcIlNURVAgUkFOR0UgVE9PIFNNQUxMOiBTRVJWRVIgVE9PIFNMT1dcIik7XHJcbiAgICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG5cclxuICAgIGlmICh0aGlzLmN1cnJTdGVwIDwgdGhpcy5pbml0aWFsU3RlcCkge1xyXG4gICAgICAgIHRoaXMuY3VyclN0ZXAgKz0gMTtcclxuICAgICAgICByZXR1cm47XHJcbiAgICB9XHJcbiAgICBpZiAodGhpcy5jdXJyU3RlcCA+IHRoaXMubGFzdFN0ZXApIHtcclxuICAgICAgICAvL2NvbnNvbGUubG9nKFwiU1RFUCBSQU5HRSBUT08gU01BTEw6IFNFUlZFUiBUT08gU0xPV1wiKTtcclxuICAgICAgICByZXR1cm47XHJcbiAgICB9XHJcblxyXG4gICAgd2hpbGUgKHRoaXMubGFzdFN0ZXAgLSB0aGlzLmN1cnJTdGVwID4gNSArIHRoaXMuY3VyclBpbmcgLyA1MCkge1xyXG4gICAgICAgIGNvbnNvbGUubG9nKFwiU1RFUCBSQU5HRSBUT08gTEFSR0U6IENMSUVOVCBJUyBUT08gU0xPVyBGT1IgU1RFUDogXCIgKyB0aGlzLmN1cnJTdGVwKTtcclxuICAgICAgICB1cGRhdGUgPSB0aGlzLmZpbmRVcGRhdGVQYWNrZXQodGhpcy5jdXJyU3RlcCk7XHJcbiAgICAgICAgaWYgKCF1cGRhdGUpIHtcclxuICAgICAgICAgICAgY29uc29sZS5sb2coXCJVUERBVEUgTk9UIEZPVU5EISEhIVwiKTtcclxuICAgICAgICAgICAgdGhpcy5jdXJyU3RlcCArPSAxO1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmICh1cGRhdGUucmVhZGVyLl9vZmZzZXQgPiAxMCkge1xyXG4gICAgICAgICAgICBjb25zb2xlLmxvZyhcIk9GRlNFVCBJUyBUT08gTEFSR0VcIik7XHJcbiAgICAgICAgICAgIHRoaXMuY3VyclN0ZXAgKz0gMTtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdGhpcy5hcHBseVVwZGF0ZSh1cGRhdGUucmVhZGVyKTtcclxuICAgICAgICB0aGlzLmN1cnJTdGVwICs9IDE7XHJcbiAgICB9IC8vdG9vIHNsb3dcclxuXHJcbiAgICB1cGRhdGUgPSB0aGlzLmZpbmRVcGRhdGVQYWNrZXQodGhpcy5jdXJyU3RlcCk7XHJcbiAgICBpZiAoIXVwZGF0ZSkge1xyXG4gICAgICAgIGNvbnNvbGUubG9nKFwiQ0FOTk9UIEZJTkQgVVBEQVRFIEZPUiBTVEVQOiBcIiArIHRoaXMuY3VyclN0ZXApO1xyXG4gICAgICAgIHRoaXMuY3VyclN0ZXAgKz0gMTtcclxuICAgICAgICByZXR1cm47XHJcbiAgICB9XHJcbiAgICBpZiAodXBkYXRlLnJlYWRlci5fb2Zmc2V0ID4gMTApIHtcclxuICAgICAgICBjb25zb2xlLmxvZyhcIk9GRlNFVCBJUyBUT08gTEFSR0UgRk9SIFNURVA6IFwiICsgdGhpcy5jdXJyU3RlcCk7XHJcbiAgICAgICAgY29uc29sZS5sb2codGhpcy51cGRhdGVzWzBdKTtcclxuICAgICAgICB0aGlzLmN1cnJTdGVwICs9IDE7XHJcbiAgICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG4gICAgdGhpcy5hcHBseVVwZGF0ZSh1cGRhdGUucmVhZGVyKTtcclxuICAgIHRoaXMuY3VyclN0ZXAgKz0gMTtcclxufTtcclxuXHJcblxyXG5DbGllbnQucHJvdG90eXBlLmZpbmRVcGRhdGVQYWNrZXQgPSBmdW5jdGlvbiAoc3RlcCkge1xyXG4gICAgdmFyIGxlbmd0aCA9IHRoaXMudXBkYXRlcy5sZW5ndGg7XHJcblxyXG4gICAgZm9yICh2YXIgaSA9IGxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XHJcbiAgICAgICAgdmFyIHVwZGF0ZSA9IHRoaXMudXBkYXRlc1tpXTtcclxuXHJcbiAgICAgICAgaWYgKHVwZGF0ZS5zdGVwID09PSBzdGVwKSB7XHJcbiAgICAgICAgICAgIHRoaXMudXBkYXRlcy5zcGxpY2UoMCwgaSk7XHJcbiAgICAgICAgICAgIHJldHVybiB1cGRhdGU7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG4gICAgY29uc29sZS5sb2coJ0NPVUxEIE5PVCBGSU5EIFBBQ0tFVCBGT1IgU1RFUDogJyArIHN0ZXApO1xyXG4gICAgY29uc29sZS5sb2codGhpcy51cGRhdGVzWzBdKTtcclxuICAgIGNvbnNvbGUubG9nKHRoaXMudXBkYXRlc1sxXSk7XHJcbiAgICBjb25zb2xlLmxvZyh0aGlzLnVwZGF0ZXNbMl0pO1xyXG5cclxuXHJcbiAgICByZXR1cm4gbnVsbDtcclxufTtcclxuXHJcblxyXG5DbGllbnQucHJvdG90eXBlLnN0YXJ0ID0gZnVuY3Rpb24gKCkge1xyXG4gICAgc2V0SW50ZXJ2YWwodGhpcy5jbGllbnRVcGRhdGUuYmluZCh0aGlzKSwgMTAwMCAvIDI4KTtcclxufTtcclxuXHJcbmZ1bmN0aW9uIGxlcnAoYSwgYiwgcmF0aW8pIHtcclxuICAgIHJldHVybiBhICsgcmF0aW8gKiAoYiAtIGEpO1xyXG59XHJcblxyXG5cclxuZnVuY3Rpb24gc3F1YXJlKGEpIHtcclxuICAgIHJldHVybiBhICogYTtcclxufVxyXG5cclxuZnVuY3Rpb24gdmVjdG9yTm9ybWFsKGEpIHtcclxuICAgIHJldHVybiBhLnggKiBhLnggKyBhLnkgKiBhLnk7XHJcbn1cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gQ2xpZW50OyIsImZ1bmN0aW9uIEFuaW1hdGlvbihhbmltYXRpb25JbmZvLCBjbGllbnQpIHtcclxuXHJcbiAgICB0aGlzLmNsaWVudCA9IGNsaWVudDtcclxuICAgIHRoaXMudHlwZSA9IGFuaW1hdGlvbkluZm8udHlwZTtcclxuICAgIHRoaXMuaWQgPSBhbmltYXRpb25JbmZvLmlkO1xyXG4gICAgdGhpcy54ID0gYW5pbWF0aW9uSW5mby54O1xyXG4gICAgdGhpcy55ID0gYW5pbWF0aW9uSW5mby55O1xyXG4gICAgLy90aGlzLnRoZXRhID0gMTU7XHJcbiAgICB0aGlzLnRpbWVyID0gZ2V0UmFuZG9tKDEwLCAxNCk7XHJcblxyXG4gICAgaWYgKHRoaXMudHlwZSA9PT0gXCJzbGFzaFwiKSB7XHJcbiAgICAgICAgdGhpcy5zbGFzaElkID0gYW5pbWF0aW9uSW5mby5zbGFzaElkO1xyXG4gICAgICAgIHZhciBzbGFzaCA9IHRoaXMuY2xpZW50LmZpbmRTbGFzaCh0aGlzLnNsYXNoSWQpO1xyXG4gICAgICAgIHRoaXMucHJlID0gc2xhc2hbMF07XHJcbiAgICAgICAgdGhpcy5wb3N0ID0gc2xhc2hbMV07XHJcbiAgICB9XHJcbn1cclxuXHJcblxyXG5BbmltYXRpb24ucHJvdG90eXBlLnNob3cgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICB2YXIgY3R4ID0gdGhpcy5jbGllbnQubWFpbkN0eDtcclxuICAgIHZhciBwbGF5ZXIgPSB0aGlzLmNsaWVudC5TRUxGX1BMQVlFUjtcclxuXHJcbiAgICBpZiAodGhpcy50eXBlID09PSBcInNsYXNoXCIgJiYgcGxheWVyKSB7XHJcbiAgICAgICAgY3R4LmJlZ2luUGF0aCgpO1xyXG5cclxuICAgICAgICBjdHguc3Ryb2tlU3R5bGUgPSBcInJnYmEoMjQyLCAzMSwgNjYsIDAuNilcIjtcclxuICAgICAgICBjdHgubGluZVdpZHRoID0gMTU7XHJcblxyXG4gICAgICAgIGN0eC5tb3ZlVG8ocGxheWVyLnggKyB0aGlzLnByZS54LCBwbGF5ZXIueSArIHRoaXMucHJlLnkpO1xyXG4gICAgICAgIGN0eC5saW5lVG8ocGxheWVyLnggKyB0aGlzLnBvc3QueCwgcGxheWVyLnkgKyB0aGlzLnBvc3QueSk7XHJcblxyXG4gICAgICAgIGN0eC5zdHJva2UoKTtcclxuICAgICAgICBjdHguY2xvc2VQYXRoKCk7XHJcbiAgICB9XHJcbiAgICBcclxuXHJcbiAgICBpZiAodGhpcy50eXBlID09PSBcInNoYXJkRGVhdGhcIikgeyAvL2RlcHJlY2F0ZWQgYnV0IGNvdWxkIHB1bGwgc29tZSBnb29kIGNvZGUgZnJvbSBoZXJlXHJcbiAgICAgICAgY3R4LmZvbnQgPSA2MCAtIHRoaXMudGltZXIgKyBcInB4IEFyaWFsXCI7XHJcbiAgICAgICAgY3R4LnNhdmUoKTtcclxuICAgICAgICBjdHgudHJhbnNsYXRlKHRoaXMueCwgdGhpcy55KTtcclxuICAgICAgICBjdHgucm90YXRlKC1NYXRoLlBJIC8gNTAgKiB0aGlzLnRoZXRhKTtcclxuICAgICAgICBjdHgudGV4dEFsaWduID0gXCJjZW50ZXJcIjtcclxuICAgICAgICBjdHguZmlsbFN0eWxlID0gXCJyZ2JhKDI1NSwgMTY4LCA4NiwgXCIgKyB0aGlzLnRpbWVyICogMTAgLyAxMDAgKyBcIilcIjtcclxuICAgICAgICBjdHguZmlsbFRleHQodGhpcy5uYW1lLCAwLCAxNSk7XHJcbiAgICAgICAgY3R4LnJlc3RvcmUoKTtcclxuXHJcbiAgICAgICAgY3R4LmZpbGxTdHlsZSA9IFwiIzAwMDAwMFwiO1xyXG4gICAgICAgIHRoaXMudGhldGEgPSBsZXJwKHRoaXMudGhldGEsIDAsIDAuMDgpO1xyXG4gICAgICAgIHRoaXMueCA9IGxlcnAodGhpcy54LCB0aGlzLmVuZFgsIDAuMSk7XHJcbiAgICAgICAgdGhpcy55ID0gbGVycCh0aGlzLnksIHRoaXMuZW5kWSwgMC4xKTtcclxuICAgIH1cclxuXHJcblxyXG4gICAgdGhpcy50aW1lci0tO1xyXG4gICAgaWYgKHRoaXMudGltZXIgPD0gMCkge1xyXG4gICAgICAgIGRlbGV0ZSB0aGlzLmNsaWVudC5BTklNQVRJT05fTElTVFt0aGlzLmlkXTtcclxuICAgIH1cclxufTtcclxuXHJcblxyXG5mdW5jdGlvbiBnZXRSYW5kb20obWluLCBtYXgpIHtcclxuICAgIHJldHVybiBNYXRoLnJhbmRvbSgpICogKG1heCAtIG1pbikgKyBtaW47XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGxlcnAoYSwgYiwgcmF0aW8pIHtcclxuICAgIHJldHVybiBhICsgcmF0aW8gKiAoYiAtIGEpO1xyXG59XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IEFuaW1hdGlvbjtcclxuXHJcblxyXG4iLCJmdW5jdGlvbiBNaW5pTWFwKCkgeyAvL2RlcHJlY2F0ZWQsIHBsZWFzZSB1cGRhdGVcclxufVxyXG5cclxuTWluaU1hcC5wcm90b3R5cGUuZHJhdyA9IGZ1bmN0aW9uICgpIHtcclxuICAgIGlmIChtYXBUaW1lciA8PSAwIHx8IHNlcnZlck1hcCA9PT0gbnVsbCkge1xyXG4gICAgICAgIHZhciB0aWxlTGVuZ3RoID0gTWF0aC5zcXJ0KE9iamVjdC5zaXplKFRJTEVfTElTVCkpO1xyXG4gICAgICAgIGlmICh0aWxlTGVuZ3RoID09PSAwIHx8ICFzZWxmUGxheWVyKSB7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcbiAgICAgICAgdmFyIGltZ0RhdGEgPSBtYWluQ3R4LmNyZWF0ZUltYWdlRGF0YSh0aWxlTGVuZ3RoLCB0aWxlTGVuZ3RoKTtcclxuICAgICAgICB2YXIgdGlsZTtcclxuICAgICAgICB2YXIgdGlsZVJHQjtcclxuICAgICAgICB2YXIgaSA9IDA7XHJcblxyXG5cclxuICAgICAgICBmb3IgKHZhciBpZCBpbiBUSUxFX0xJU1QpIHtcclxuICAgICAgICAgICAgdGlsZVJHQiA9IHt9O1xyXG4gICAgICAgICAgICB0aWxlID0gVElMRV9MSVNUW2lkXTtcclxuICAgICAgICAgICAgaWYgKHRpbGUuY29sb3IgJiYgdGlsZS5hbGVydCB8fCBpbkJvdW5kcyhzZWxmUGxheWVyLCB0aWxlLngsIHRpbGUueSkpIHtcclxuICAgICAgICAgICAgICAgIHRpbGVSR0IuciA9IHRpbGUuY29sb3IucjtcclxuICAgICAgICAgICAgICAgIHRpbGVSR0IuZyA9IHRpbGUuY29sb3IuZztcclxuICAgICAgICAgICAgICAgIHRpbGVSR0IuYiA9IHRpbGUuY29sb3IuYjtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgICAgIHRpbGVSR0IuciA9IDA7XHJcbiAgICAgICAgICAgICAgICB0aWxlUkdCLmcgPSAwO1xyXG4gICAgICAgICAgICAgICAgdGlsZVJHQi5iID0gMDtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgaW1nRGF0YS5kYXRhW2ldID0gdGlsZVJHQi5yO1xyXG4gICAgICAgICAgICBpbWdEYXRhLmRhdGFbaSArIDFdID0gdGlsZVJHQi5nO1xyXG4gICAgICAgICAgICBpbWdEYXRhLmRhdGFbaSArIDJdID0gdGlsZVJHQi5iO1xyXG4gICAgICAgICAgICBpbWdEYXRhLmRhdGFbaSArIDNdID0gMjU1O1xyXG4gICAgICAgICAgICBpICs9IDQ7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGNvbnNvbGUubG9nKDQwMCAvIE9iamVjdC5zaXplKFRJTEVfTElTVCkpO1xyXG4gICAgICAgIGltZ0RhdGEgPSBzY2FsZUltYWdlRGF0YShpbWdEYXRhLCBNYXRoLmZsb29yKDQwMCAvIE9iamVjdC5zaXplKFRJTEVfTElTVCkpLCBtYWluQ3R4KTtcclxuXHJcbiAgICAgICAgbU1hcEN0eC5wdXRJbWFnZURhdGEoaW1nRGF0YSwgMCwgMCk7XHJcblxyXG4gICAgICAgIG1NYXBDdHhSb3Qucm90YXRlKDkwICogTWF0aC5QSSAvIDE4MCk7XHJcbiAgICAgICAgbU1hcEN0eFJvdC5zY2FsZSgxLCAtMSk7XHJcbiAgICAgICAgbU1hcEN0eFJvdC5kcmF3SW1hZ2UobU1hcCwgMCwgMCk7XHJcbiAgICAgICAgbU1hcEN0eFJvdC5zY2FsZSgxLCAtMSk7XHJcbiAgICAgICAgbU1hcEN0eFJvdC5yb3RhdGUoMjcwICogTWF0aC5QSSAvIDE4MCk7XHJcblxyXG4gICAgICAgIHNlcnZlck1hcCA9IG1NYXBSb3Q7XHJcbiAgICAgICAgbWFwVGltZXIgPSAyNTtcclxuICAgIH1cclxuXHJcbiAgICBlbHNlIHtcclxuICAgICAgICBtYXBUaW1lciAtPSAxO1xyXG4gICAgfVxyXG5cclxuICAgIG1haW5DdHguZHJhd0ltYWdlKHNlcnZlck1hcCwgODAwLCA0MDApO1xyXG59OyAvL2RlcHJlY2F0ZWRcclxuXHJcbk1pbmlNYXAucHJvdG90eXBlLnNjYWxlSW1hZ2VEYXRhID0gZnVuY3Rpb24gKGltYWdlRGF0YSwgc2NhbGUsIG1haW5DdHgpIHtcclxuICAgIHZhciBzY2FsZWQgPSBtYWluQ3R4LmNyZWF0ZUltYWdlRGF0YShpbWFnZURhdGEud2lkdGggKiBzY2FsZSwgaW1hZ2VEYXRhLmhlaWdodCAqIHNjYWxlKTtcclxuICAgIHZhciBzdWJMaW5lID0gbWFpbkN0eC5jcmVhdGVJbWFnZURhdGEoc2NhbGUsIDEpLmRhdGE7XHJcbiAgICBmb3IgKHZhciByb3cgPSAwOyByb3cgPCBpbWFnZURhdGEuaGVpZ2h0OyByb3crKykge1xyXG4gICAgICAgIGZvciAodmFyIGNvbCA9IDA7IGNvbCA8IGltYWdlRGF0YS53aWR0aDsgY29sKyspIHtcclxuICAgICAgICAgICAgdmFyIHNvdXJjZVBpeGVsID0gaW1hZ2VEYXRhLmRhdGEuc3ViYXJyYXkoXHJcbiAgICAgICAgICAgICAgICAocm93ICogaW1hZ2VEYXRhLndpZHRoICsgY29sKSAqIDQsXHJcbiAgICAgICAgICAgICAgICAocm93ICogaW1hZ2VEYXRhLndpZHRoICsgY29sKSAqIDQgKyA0XHJcbiAgICAgICAgICAgICk7XHJcbiAgICAgICAgICAgIGZvciAodmFyIHggPSAwOyB4IDwgc2NhbGU7IHgrKykgc3ViTGluZS5zZXQoc291cmNlUGl4ZWwsIHggKiA0KVxyXG4gICAgICAgICAgICBmb3IgKHZhciB5ID0gMDsgeSA8IHNjYWxlOyB5KyspIHtcclxuICAgICAgICAgICAgICAgIHZhciBkZXN0Um93ID0gcm93ICogc2NhbGUgKyB5O1xyXG4gICAgICAgICAgICAgICAgdmFyIGRlc3RDb2wgPSBjb2wgKiBzY2FsZTtcclxuICAgICAgICAgICAgICAgIHNjYWxlZC5kYXRhLnNldChzdWJMaW5lLCAoZGVzdFJvdyAqIHNjYWxlZC53aWR0aCArIGRlc3RDb2wpICogNClcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gc2NhbGVkO1xyXG59O1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBNaW5pTWFwOyIsImZ1bmN0aW9uIFBsYXllcihyZWFkZXIsIGNsaWVudCkge1xyXG4gICAgaWYgKCFyZWFkZXIpIHtcclxuICAgICAgICBjb25zb2xlLmxvZyhcIk1BS0lORyBORVcgRkFLRSBQTEFZRVJcIik7XHJcbiAgICAgICAgdGhpcy5jbGllbnQgPSBjbGllbnQ7XHJcbiAgICAgICAgcmV0dXJuOyAvL2ZvciBmYWtlIHJvY2sgcHVycG9zZXNcclxuICAgIH1cclxuXHJcbiAgICB0aGlzLmlkID0gcmVhZGVyLnJlYWRVSW50MzIoKTsgLy9wbGF5ZXIgaWRcclxuICAgIHRoaXMueCA9IHJlYWRlci5yZWFkVUludDMyKCkgLyAxMDA7IC8vcmVhbCB4XHJcbiAgICB0aGlzLnkgPSByZWFkZXIucmVhZFVJbnQzMigpIC8gMTAwOyAvL3JlYWwgeVxyXG5cclxuICAgIHRoaXMucmFkaXVzID0gcmVhZGVyLnJlYWRVSW50MTYoKTsgLy9yYWRpdXNcclxuXHJcbiAgICB2YXIgbmFtZUxlbmd0aCA9IHJlYWRlci5yZWFkVUludDgoKTtcclxuICAgIHZhciBuYW1lID0gXCJcIjtcclxuXHJcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IG5hbWVMZW5ndGg7IGkrKykge1xyXG4gICAgICAgIHZhciBjaGFyID0gU3RyaW5nLmZyb21DaGFyQ29kZShyZWFkZXIucmVhZFVJbnQ4KCkpO1xyXG4gICAgICAgIG5hbWUgKz0gY2hhcjtcclxuICAgIH1cclxuICAgIHRoaXMubmFtZSA9IG5hbWU7XHJcblxyXG4gICAgdGhpcy52ZXJ0aWNlcyA9IFtdOyAgICAgICAgICAgIC8vdmVydGljZXNcclxuICAgIHZhciBjb3VudCA9IHJlYWRlci5yZWFkVUludDgoKTtcclxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgY291bnQ7IGkrKykge1xyXG4gICAgICAgIHRoaXMudmVydGljZXNbaV0gPSBbXTtcclxuICAgICAgICB0aGlzLnZlcnRpY2VzW2ldWzBdID0gcmVhZGVyLnJlYWRJbnQxNigpIC8gMTAwMDtcclxuICAgICAgICB0aGlzLnZlcnRpY2VzW2ldWzFdID0gcmVhZGVyLnJlYWRJbnQxNigpIC8gMTAwMDtcclxuICAgIH1cclxuXHJcbiAgICB0aGlzLmhlYWx0aCA9IHJlYWRlci5yZWFkVUludDE2KCk7IC8vaGVhbHRoXHJcbiAgICB0aGlzLm1heEhlYWx0aCA9IHJlYWRlci5yZWFkVUludDE2KCk7IC8vbWF4SGVhbHRoXHJcblxyXG4gICAgdGhpcy50aGV0YSA9IHJlYWRlci5yZWFkSW50MTYoKSAvIDEwMDsgLy90aGV0YVxyXG4gICAgdGhpcy5sZXZlbCA9IHJlYWRlci5yZWFkVUludDgoKTsgLy9sZXZlbFxyXG5cclxuXHJcbiAgICBzd2l0Y2ggKHJlYWRlci5yZWFkVUludDgoKSkgeyAgICAvL2ZsYWdzXHJcbiAgICAgICAgY2FzZSAxOlxyXG4gICAgICAgICAgICB0aGlzLnZ1bG5lcmFibGUgPSB0cnVlO1xyXG4gICAgICAgICAgICBicmVhaztcclxuICAgICAgICBjYXNlIDE2OlxyXG4gICAgICAgICAgICB0aGlzLnNob290aW5nID0gdHJ1ZTtcclxuICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgY2FzZSAxNzpcclxuICAgICAgICAgICAgdGhpcy52dWxuZXJhYmxlID0gdHJ1ZTtcclxuICAgICAgICAgICAgdGhpcy5zaG9vdGluZyA9IHRydWU7XHJcbiAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgfVxyXG5cclxuICAgIHRoaXMuY2xpZW50ID0gY2xpZW50O1xyXG5cclxuICAgIGlmICghdGhpcy5jbGllbnQuU0VMRl9QTEFZRVIgJiYgdGhpcy5pZCA9PT0gdGhpcy5jbGllbnQuU0VMRl9JRCkge1xyXG4gICAgICAgIHRoaXMuY2xpZW50LlNFTEZfUExBWUVSID0gdGhpcztcclxuICAgIH1cclxuXHJcbiAgICB0aGlzLm1vdmVyID0ge1xyXG4gICAgICAgIHg6IDAsXHJcbiAgICAgICAgeTogMFxyXG4gICAgfTtcclxuXHJcbiAgICB0aGlzLnJlYWxNb3ZlciA9IHtcclxuICAgICAgICB4OiAwLFxyXG4gICAgICAgIHk6IDBcclxuICAgIH07XHJcbn1cclxuXHJcblxyXG5QbGF5ZXIucHJvdG90eXBlLnVwZGF0ZSA9IGZ1bmN0aW9uIChyZWFkZXIpIHtcclxuICAgIHRoaXMudXBkYXRlVGltZXIgPSA1MDtcclxuICAgIHRoaXMueCA9IHJlYWRlci5yZWFkVUludDMyKCkgLyAxMDA7IC8vcmVhbCB4XHJcbiAgICB0aGlzLnkgPSByZWFkZXIucmVhZFVJbnQzMigpIC8gMTAwOyAvL3JlYWwgeVxyXG5cclxuICAgIHRoaXMucmVhbFJhZGl1cyA9IHJlYWRlci5yZWFkVUludDE2KCk7IC8vcmFkaXVzXHJcblxyXG4gICAgaWYgKHRoaXMuaWQgPT09IHRoaXMuY2xpZW50LlNFTEZfSUQpIHtcclxuICAgICAgICAvL3RoaXMuY2xpZW50Lm1haW5TY2FsZUZhY3RvciA9IDUwIC8gdGhpcy5yZWFsUmFkaXVzO1xyXG4gICAgfVxyXG4gICAgdGhpcy5oZWFsdGggPSByZWFkZXIucmVhZFVJbnQxNigpOyAvL2hlYWx0aFxyXG4gICAgdGhpcy5tYXhIZWFsdGggPSByZWFkZXIucmVhZFVJbnQxNigpOyAvL21heEhlYWx0aFxyXG5cclxuICAgIHRoaXMudGhldGEgPSByZWFkZXIucmVhZEludDE2KCkgLyAxMDA7IC8vdGhldGFcclxuICAgIHRoaXMubGV2ZWwgPSByZWFkZXIucmVhZFVJbnQ4KCk7IC8vbGV2ZWxcclxuXHJcbiAgICB0aGlzLnZ1bG5lcmFibGUgPSBmYWxzZTtcclxuICAgIHRoaXMuc2hvb3RpbmcgPSBmYWxzZTtcclxuICAgIHN3aXRjaCAocmVhZGVyLnJlYWRVSW50OCgpKSB7ICAgIC8vZmxhZ3NcclxuICAgICAgICBjYXNlIDE6XHJcbiAgICAgICAgICAgIHRoaXMudnVsbmVyYWJsZSA9IHRydWU7XHJcbiAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgIGNhc2UgMTY6XHJcbiAgICAgICAgICAgIHRoaXMuc2hvb3RpbmcgPSB0cnVlO1xyXG4gICAgICAgICAgICBicmVhaztcclxuICAgICAgICBjYXNlIDE3OlxyXG4gICAgICAgICAgICB0aGlzLnZ1bG5lcmFibGUgPSB0cnVlO1xyXG4gICAgICAgICAgICB0aGlzLnNob290aW5nID0gdHJ1ZTtcclxuICAgICAgICAgICAgYnJlYWs7XHJcbiAgICB9XHJcblxyXG59O1xyXG5cclxuXHJcblBsYXllci5wcm90b3R5cGUudGljayA9IGZ1bmN0aW9uICgpIHtcclxuICAgIGlmICh0aGlzLnJlYWxNb3Zlcikge1xyXG4gICAgICAgIHRoaXMubW92ZXIueCA9IGxlcnAodGhpcy5tb3Zlci54LCB0aGlzLnJlYWxNb3Zlci54LCAwLjE1KTtcclxuICAgICAgICB0aGlzLm1vdmVyLnkgPSBsZXJwKHRoaXMubW92ZXIueSwgdGhpcy5yZWFsTW92ZXIueSwgMC4xNSk7XHJcbiAgICB9XHJcbiAgICAvL3RoaXMubW92ZSh0aGlzLm1vdmVyLngsIHRoaXMubW92ZXIueSk7XHJcbn07XHJcblxyXG5cclxuUGxheWVyLnByb3RvdHlwZS5zZXRNb3ZlID0gZnVuY3Rpb24gKHgsIHkpIHtcclxuICAgIHRoaXMucmVhbE1vdmVyID0ge1xyXG4gICAgICAgIHg6IHgsXHJcbiAgICAgICAgeTogeVxyXG4gICAgfTtcclxufTtcclxuXHJcblxyXG5QbGF5ZXIucHJvdG90eXBlLmdldFRoZXRhID0gZnVuY3Rpb24gKHRhcmdldCwgb3JpZ2luKSB7XHJcbiAgICB0aGlzLnRoZXRhID0gTWF0aC5hdGFuMih0YXJnZXQueSAtIG9yaWdpbi55LCB0YXJnZXQueCAtIG9yaWdpbi54KSAlICgyICogTWF0aC5QSSk7XHJcbn07XHJcblxyXG5QbGF5ZXIucHJvdG90eXBlLm1vdmUgPSBmdW5jdGlvbiAoeCwgeSkge1xyXG4gICAgdmFyIHRhcmdldCA9IHtcclxuICAgICAgICB4OiB0aGlzLnggKyB4LFxyXG4gICAgICAgIHk6IHRoaXMueSArIHlcclxuICAgIH07XHJcbiAgICB2YXIgb3JpZ2luID0ge1xyXG4gICAgICAgIHg6IHRoaXMueCxcclxuICAgICAgICB5OiB0aGlzLnlcclxuICAgIH07XHJcblxyXG4gICAgdGhpcy5nZXRUaGV0YSh0YXJnZXQsIG9yaWdpbik7XHJcblxyXG5cclxuICAgIHZhciBub3JtYWxWZWwgPSBub3JtYWwoeCwgeSk7XHJcbiAgICBpZiAobm9ybWFsVmVsIDwgMSkge1xyXG4gICAgICAgIG5vcm1hbFZlbCA9IDE7XHJcbiAgICB9XHJcblxyXG4gICAgdmFyIHZlbEJ1ZmZlciA9IDM7IC8vY2hhbmdlIHNvb25cclxuXHJcbiAgICB0aGlzLnggKz0gMTAwICogeCAvIG5vcm1hbFZlbCAvIHZlbEJ1ZmZlcjtcclxuICAgIHRoaXMueSArPSAxMDAgKiB5IC8gbm9ybWFsVmVsIC8gdmVsQnVmZmVyO1xyXG5cclxufTtcclxuXHJcblxyXG5QbGF5ZXIucHJvdG90eXBlLnNob3cgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICBpZiAoIXRoaXMucmFkaXVzKSB7XHJcbiAgICAgICAgdGhpcy5yYWRpdXMgPSAxO1xyXG4gICAgfVxyXG4gICAgdGhpcy5yYWRpdXMgPSBsZXJwKHRoaXMucmFkaXVzLCB0aGlzLnJlYWxSYWRpdXMsIDAuMik7XHJcbiAgICB0aGlzLnVwZGF0ZVRpbWVyIC09IDE7XHJcbiAgICBpZiAodGhpcy51cGRhdGVUaW1lciA8PSAwKSB7XHJcbiAgICAgICAgZGVsZXRlIHRoaXMuY2xpZW50LlBMQVlFUl9MSVNUW3RoaXMuaWRdO1xyXG4gICAgfVxyXG5cclxuICAgIHZhciBjdHggPSB0aGlzLmNsaWVudC5tYWluQ3R4O1xyXG4gICAgdmFyIGZpbGxBbHBoYTtcclxuICAgIHZhciBzdHJva2VBbHBoYTtcclxuICAgIHZhciBpO1xyXG5cclxuXHJcbiAgICBmaWxsQWxwaGEgPSB0aGlzLmhlYWx0aCAvICg0ICogdGhpcy5tYXhIZWFsdGgpO1xyXG4gICAgc3Ryb2tlQWxwaGEgPSAxO1xyXG5cclxuICAgIGN0eC5mb250ID0gXCIyMHB4IEFyaWFsXCI7XHJcblxyXG5cclxuICAgIGN0eC5zdHJva2VTdHlsZSA9IFwicmdiYSgyNTIsIDEwMiwgMzcsXCIgKyBzdHJva2VBbHBoYSArIFwiKVwiO1xyXG4gICAgaWYgKHRoaXMuc2hvb3RpbmcpIHtcclxuICAgICAgICBjdHguZmlsbFN0eWxlID0gXCJncmVlblwiO1xyXG4gICAgfVxyXG4gICAgZWxzZSBpZiAodGhpcy52dWxuZXJhYmxlKSB7XHJcbiAgICAgICAgY3R4LmZpbGxTdHlsZSA9IFwicmVkXCI7XHJcbiAgICB9XHJcbiAgICBlbHNlIHtcclxuICAgICAgICBjdHguZmlsbFN0eWxlID0gXCJyZ2JhKDEyMywwLDAsXCIgKyBmaWxsQWxwaGEgKyBcIilcIjtcclxuICAgIH1cclxuICAgIGN0eC5saW5lV2lkdGggPSAxMDtcclxuXHJcblxyXG4gICAgY3R4LmJlZ2luUGF0aCgpO1xyXG5cclxuICAgIGN0eC50cmFuc2xhdGUodGhpcy54LCB0aGlzLnkpO1xyXG4gICAgY3R4LnJvdGF0ZSh0aGlzLnRoZXRhKTtcclxuXHJcbiAgICBpZiAodGhpcy52ZXJ0aWNlcykge1xyXG4gICAgICAgIHZhciB2ID0gdGhpcy52ZXJ0aWNlcztcclxuICAgICAgICBjdHgubW92ZVRvKHZbMF1bMF0gKiB0aGlzLnJhZGl1cywgdlswXVsxXSAqIHRoaXMucmFkaXVzKTtcclxuICAgICAgICBmb3IgKGkgPSAxOyBpIDwgdi5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgICAgICBjdHgubGluZVRvKHZbaV1bMF0gKiB0aGlzLnJhZGl1cywgdltpXVsxXSAqIHRoaXMucmFkaXVzKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgY3R4LmxpbmVUbyh2WzBdWzBdICogdGhpcy5yYWRpdXMsIHZbMF1bMV0gKiB0aGlzLnJhZGl1cyk7XHJcbiAgICAgICAgY3R4LmZpbGwoKTtcclxuICAgICAgICBjdHguc3Ryb2tlKCk7XHJcbiAgICB9XHJcbiAgICBlbHNlIHtcclxuICAgICAgICBjdHguZmlsbFJlY3QoMCwgMCwgMzAsIDMwKTtcclxuICAgIH1cclxuICAgIGN0eC5maWxsKCk7XHJcbiAgICBjdHguc3Ryb2tlKCk7XHJcblxyXG4gICAgY3R4LnJvdGF0ZSgyICogTWF0aC5QSSAtIHRoaXMudGhldGEpO1xyXG5cclxuXHJcbiAgICBpZiAoIXRoaXMudnVsbmVyYWJsZSkge1xyXG4gICAgICAgIGlmICh0aGlzLmhlYWx0aCA+IHRoaXMubWF4SGVhbHRoIC8gMikge1xyXG4gICAgICAgICAgICBjdHguZmlsbFN0eWxlID0gXCJyZ2JhKDAsIDI1NSwgMCwgMC4zKVwiO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgY3R4LmZpbGxTdHlsZSA9IFwicmdiYSgyNTUsIDAsIDAsIDAuMylcIjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGN0eC5hcmMoMCwgMCwgdGhpcy5yYWRpdXMgKiAyLCAwLCAyICogTWF0aC5QSSk7XHJcbiAgICAgICAgY3R4LmZpbGwoKTtcclxuICAgIH1cclxuXHJcbiAgICBjdHgudHJhbnNsYXRlKC10aGlzLngsIC10aGlzLnkpO1xyXG5cclxuXHJcbiAgICBjdHguY2xvc2VQYXRoKCk7XHJcblxyXG5cclxuICAgIGN0eC5maWxsU3R5bGUgPSBcIiNmZjlkNjBcIjtcclxuICAgIGN0eC5maWxsVGV4dCh0aGlzLm5hbWUsIHRoaXMueCwgdGhpcy55ICsgNzApO1xyXG5cclxuXHJcbiAgICBpZiAodGhpcy5oZWFsdGggJiYgdGhpcy5tYXhIZWFsdGggJiYgdGhpcy5oZWFsdGggPiAwKSB7IC8vaGVhbHRoIGJhclxyXG4gICAgICAgIGlmICh0aGlzLmhlYWx0aCA+IHRoaXMubWF4SGVhbHRoKSB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiUExBWUVSIEhBUyBUT08gTVVDSCBIRUFMVEg6IFwiICsgdGhpcy5oZWFsdGgsIHRoaXMubWF4SGVhbHRoKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgY3R4LmxpbmVXaWR0aCA9IDEwO1xyXG4gICAgICAgIGN0eC5iZWdpblBhdGgoKTtcclxuICAgICAgICBjdHguc3Ryb2tlU3R5bGUgPSBcImJsYWNrXCI7XHJcbiAgICAgICAgY3R4LnJlY3QodGhpcy54IC0gNDAwLCB0aGlzLnkgKyAyMDAsIDgwMCwgMTAwKTtcclxuICAgICAgICBjdHguc3Ryb2tlKCk7XHJcbiAgICAgICAgY3R4LmNsb3NlUGF0aCgpO1xyXG5cclxuICAgICAgICBjdHguYmVnaW5QYXRoKCk7XHJcbiAgICAgICAgY3R4LmZpbGxTdHlsZSA9IFwiZ3JlZW5cIjtcclxuICAgICAgICBjdHgucmVjdCh0aGlzLnggLSA0MDAsIHRoaXMueSArIDIwMCwgODAwICogdGhpcy5oZWFsdGggLyB0aGlzLm1heEhlYWx0aCwgMTAwKTtcclxuICAgICAgICBjdHguZmlsbCgpO1xyXG4gICAgICAgIGN0eC5jbG9zZVBhdGgoKTtcclxuICAgIH0gLy9kaXNwbGF5IGhlYWx0aCBiYXJcclxuXHJcblxyXG4gICAgY3R4LmNsb3NlUGF0aCgpO1xyXG59O1xyXG5cclxuXHJcbmZ1bmN0aW9uIGdldFJhbmRvbShtaW4sIG1heCkge1xyXG4gICAgcmV0dXJuIE1hdGgucmFuZG9tKCkgKiAobWF4IC0gbWluKSArIG1pbjtcclxufVxyXG5cclxuXHJcbmZ1bmN0aW9uIG5vcm1hbCh4LCB5KSB7XHJcbiAgICByZXR1cm4gTWF0aC5zcXJ0KHggKiB4ICsgeSAqIHkpO1xyXG59XHJcblxyXG5mdW5jdGlvbiBsZXJwKGEsIGIsIHJhdGlvKSB7XHJcbiAgICByZXR1cm4gYSArIHJhdGlvICogKGIgLSBhKTtcclxufVxyXG5cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gUGxheWVyOyIsImZ1bmN0aW9uIFJvY2socmVhZGVyLCBjbGllbnQpIHtcclxuICAgIGlmICghcmVhZGVyKSB7XHJcbiAgICAgICAgY29uc29sZS5sb2coXCJNQUtJTkcgTkVXIEZBS0UgUk9DS1wiKTtcclxuICAgICAgICB0aGlzLmNsaWVudCA9IGNsaWVudDtcclxuICAgICAgICByZXR1cm47IC8vZm9yIGZha2Ugcm9jayBwdXJwb3Nlc1xyXG4gICAgfVxyXG4gICAgdmFyIHByZXYgPSByZWFkZXIuX29mZnNldDtcclxuXHJcblxyXG4gICAgdGhpcy5pZCA9IHJlYWRlci5yZWFkVUludDMyKCk7XHJcbiAgICAvL2NvbnNvbGUubG9nKFwiTkVXIFJPQ0s6IFwiICsgdGhpcy5pZCk7XHJcblxyXG4gICAgdGhpcy5vd25lciA9IHJlYWRlci5yZWFkVUludDMyKCk7XHJcbiAgICB0aGlzLnggPSByZWFkZXIucmVhZFVJbnQzMigpIC8gMTAwO1xyXG4gICAgdGhpcy55ID0gcmVhZGVyLnJlYWRVSW50MzIoKSAvIDEwMDtcclxuXHJcbiAgICB0aGlzLnZlcnRpY2VzID0gW107XHJcbiAgICB2YXIgY291bnQgPSByZWFkZXIucmVhZFVJbnQxNigpO1xyXG4gICAgLy9jb25zb2xlLmxvZyhcIkNPVU5UOiBcIiArIGNvdW50KTtcclxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgY291bnQ7IGkrKykge1xyXG4gICAgICAgIHRoaXMudmVydGljZXNbaV0gPSBbXTtcclxuICAgICAgICB0aGlzLnZlcnRpY2VzW2ldWzBdID0gcmVhZGVyLnJlYWRJbnQxNigpIC8gMTAwMDtcclxuICAgICAgICB0aGlzLnZlcnRpY2VzW2ldWzFdID0gcmVhZGVyLnJlYWRJbnQxNigpIC8gMTAwMDtcclxuICAgIH1cclxuXHJcbiAgICB0aGlzLmhlYWx0aCA9IHJlYWRlci5yZWFkSW50MTYoKTtcclxuICAgIHRoaXMubWF4SGVhbHRoID0gcmVhZGVyLnJlYWRJbnQxNigpO1xyXG5cclxuICAgIHRoaXMudGhldGEgPSByZWFkZXIucmVhZEludDE2KCkgLyAxMDA7XHJcbiAgICB0aGlzLnRleHR1cmUgPSByZWFkZXIucmVhZFVJbnQ4KCk7XHJcblxyXG4gICAgc3dpdGNoIChyZWFkZXIucmVhZFVJbnQ4KCkpIHtcclxuICAgICAgICBjYXNlIDE6XHJcbiAgICAgICAgICAgIHRoaXMubmV1dHJhbCA9IHRydWU7XHJcbiAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgIGNhc2UgMTY6XHJcbiAgICAgICAgICAgIHRoaXMuZmFzdCA9IHRydWU7XHJcbiAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgIGNhc2UgMTc6XHJcbiAgICAgICAgICAgIHRoaXMubmV1dHJhbCA9IHRydWU7XHJcbiAgICAgICAgICAgIHRoaXMuZmFzdCA9IHRydWU7XHJcbiAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgfVxyXG4gICAgdmFyIGRlbHRhID0gcmVhZGVyLl9vZmZzZXQgLSBwcmV2O1xyXG4gICAgdGhpcy51cGRhdGVzID0gW107XHJcbiAgICB0aGlzLnVwZGF0ZVRpbWVyID0gMjA7XHJcbiAgICB0aGlzLmNsaWVudCA9IGNsaWVudDtcclxufVxyXG5cclxuXHJcblJvY2sucHJvdG90eXBlLnVwZGF0ZSA9IGZ1bmN0aW9uIChyZWFkZXIpIHtcclxuICAgIHRoaXMub3duZXIgPSByZWFkZXIucmVhZFVJbnQzMigpO1xyXG5cclxuICAgIHZhciB4ID0gdGhpcy54O1xyXG4gICAgdmFyIHkgPSB0aGlzLnk7XHJcblxyXG4gICAgdGhpcy54ID0gcmVhZGVyLnJlYWRVSW50MzIoKSAvIDEwMDtcclxuICAgIHRoaXMueSA9IHJlYWRlci5yZWFkVUludDMyKCkgLyAxMDA7XHJcblxyXG4gICAgaWYgKHRoaXMueCAhPT0geCB8fCB0aGlzLnkgIT09IHkpIHtcclxuICAgICAgICB0aGlzLnVwZGF0ZVRpbWVyID0gMjAwO1xyXG4gICAgfVxyXG5cclxuICAgIHRoaXMuaGVhbHRoID0gcmVhZGVyLnJlYWRJbnQxNigpO1xyXG4gICAgdGhpcy5tYXhIZWFsdGggPSByZWFkZXIucmVhZEludDE2KCk7XHJcblxyXG4gICAgdGhpcy50aGV0YSA9IHJlYWRlci5yZWFkSW50MTYoKSAvIDEwMDtcclxuXHJcbiAgICB0aGlzLm5ldXRyYWwgPSBmYWxzZTtcclxuICAgIHRoaXMuZmFzdCA9IGZhbHNlO1xyXG4gICAgc3dpdGNoIChyZWFkZXIucmVhZFVJbnQ4KCkpIHsgLy9mbGFnc1xyXG4gICAgICAgIGNhc2UgMTpcclxuICAgICAgICAgICAgdGhpcy5uZXV0cmFsID0gdHJ1ZTtcclxuICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgY2FzZSAxNjpcclxuICAgICAgICAgICAgdGhpcy5mYXN0ID0gdHJ1ZTtcclxuICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgY2FzZSAxNzpcclxuICAgICAgICAgICAgdGhpcy5uZXV0cmFsID0gdHJ1ZTtcclxuICAgICAgICAgICAgdGhpcy5mYXN0ID0gdHJ1ZTtcclxuICAgICAgICAgICAgYnJlYWs7XHJcbiAgICB9XHJcbn07XHJcblxyXG5cclxuUm9jay5wcm90b3R5cGUuc2hvdyA9IGZ1bmN0aW9uICgpIHtcclxuICAgIHRoaXMudXBkYXRlVGltZXIgLT0gMTtcclxuICAgIGlmICh0aGlzLnVwZGF0ZVRpbWVyIDw9IDApIHtcclxuICAgICAgICBjb25zb2xlLmxvZyhcIkRFTEVUSU5HIFJPQ0sgVklBIFRJTUVPVVQ6IFwiICsgdGhpcy5pZCk7XHJcbiAgICAgICAgZGVsZXRlIHRoaXMuY2xpZW50LlJPQ0tfTElTVFt0aGlzLmlkXTtcclxuICAgICAgICByZXR1cm47XHJcbiAgICB9XHJcblxyXG4gICAgdmFyIGN0eCA9IHRoaXMuY2xpZW50Lm1haW5DdHg7XHJcbiAgICB2YXIgU0NBTEUgPSAxMDA7XHJcblxyXG5cclxuICAgIGN0eC5maWxsU3R5bGUgPSBcInBpbmtcIjsgLy9kZWZhdWx0IGNvbG9yXHJcbiAgICBzd2l0Y2ggKHRoaXMudGV4dHVyZSkge1xyXG4gICAgICAgIGNhc2UgMTpcclxuICAgICAgICAgICAgY3R4LmZpbGxTdHlsZSA9IFwiYnJvd25cIjtcclxuICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgY2FzZSAyOlxyXG4gICAgICAgICAgICBjdHguZmlsbFN0eWxlID0gXCJncmV5XCI7XHJcbiAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgIGNhc2UgMzpcclxuICAgICAgICAgICAgY3R4LmZpbGxTdHlsZSA9IFwieWVsbG93XCI7XHJcbiAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgIGNhc2UgNDpcclxuICAgICAgICAgICAgY3R4LmZpbGxTdHlsZSA9IFwiZ3JlZW5cIjtcclxuICAgICAgICAgICAgYnJlYWs7XHJcbiAgICB9XHJcblxyXG5cclxuICAgIGN0eC5zdHJva2VTdHlsZSA9ICF0aGlzLm93bmVyID8gXCJibHVlXCIgOiBcImdyZWVuXCI7XHJcbiAgICBjdHguc3Ryb2tlU3R5bGUgPSB0aGlzLmZhc3QgPyBcInJlZFwiIDogY3R4LnN0cm9rZVN0eWxlO1xyXG5cclxuXHJcbiAgICBjdHguYmVnaW5QYXRoKCk7XHJcblxyXG4gICAgY3R4LnRyYW5zbGF0ZSh0aGlzLngsIHRoaXMueSk7XHJcbiAgICBjdHgucm90YXRlKHRoaXMudGhldGEpO1xyXG5cclxuICAgIGlmICh0aGlzLnZlcnRpY2VzKSB7XHJcbiAgICAgICAgdmFyIHYgPSB0aGlzLnZlcnRpY2VzO1xyXG4gICAgICAgIGN0eC5tb3ZlVG8odlswXVswXSAqIFNDQUxFLCB2WzBdWzFdICogU0NBTEUpO1xyXG5cclxuICAgICAgICBmb3IgKHZhciBpID0gMTsgaSA8IHYubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICAgICAgY3R4LmxpbmVUbyh2W2ldWzBdICogU0NBTEUsIHZbaV1bMV0gKiBTQ0FMRSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGN0eC5saW5lVG8odlswXVswXSAqIFNDQUxFLCB2WzBdWzFdICogU0NBTEUpO1xyXG4gICAgfVxyXG4gICAgZWxzZSB7XHJcbiAgICAgICAgY3R4LmZpbGxSZWN0KDAsIDAsIDMwLCAzMCk7XHJcbiAgICB9XHJcblxyXG4gICAgY3R4LmZpbGwoKTtcclxuICAgIGN0eC5zdHJva2UoKTtcclxuXHJcbiAgICBjdHgucm90YXRlKDIgKiBNYXRoLlBJIC0gdGhpcy50aGV0YSk7XHJcbiAgICBjdHgudHJhbnNsYXRlKC10aGlzLngsIC10aGlzLnkpO1xyXG5cclxuICAgIGN0eC5jbG9zZVBhdGgoKTtcclxuXHJcbiAgICBpZiAoMSA9PT0gMiAmJiB0aGlzLmhlYWx0aCAmJiB0aGlzLm1heEhlYWx0aCAmJiB0aGlzLmhlYWx0aCA+IDApIHsgLy9oZWFsdGggYmFyXHJcbiAgICAgICAgY3R4LmxpbmVXaWR0aCA9IDEwO1xyXG4gICAgICAgIGN0eC5iZWdpblBhdGgoKTtcclxuICAgICAgICBjdHguc3Ryb2tlU3R5bGUgPSBcImJsYWNrXCI7XHJcbiAgICAgICAgY3R4LnJlY3QodGhpcy54LCB0aGlzLnksIDEwMCwgMjApO1xyXG4gICAgICAgIGN0eC5zdHJva2UoKTtcclxuICAgICAgICBjdHguY2xvc2VQYXRoKCk7XHJcblxyXG4gICAgICAgIGN0eC5iZWdpblBhdGgoKTtcclxuICAgICAgICBjdHguZmlsbFN0eWxlID0gXCJncmVlblwiO1xyXG4gICAgICAgIGN0eC5yZWN0KHRoaXMueCwgdGhpcy55LCAxMDAgKiB0aGlzLmhlYWx0aCAvIHRoaXMubWF4SGVhbHRoLCAyMCk7XHJcbiAgICAgICAgY3R4LmZpbGwoKTtcclxuICAgICAgICBjdHguY2xvc2VQYXRoKCk7XHJcbiAgICB9IC8vZGlzcGxheSBoZWFsdGggYmFyXHJcbn07XHJcblxyXG5cclxuZnVuY3Rpb24gZ2V0UmFuZG9tKG1pbiwgbWF4KSB7XHJcbiAgICByZXR1cm4gTWF0aC5yYW5kb20oKSAqIChtYXggLSBtaW4pICsgbWluO1xyXG59XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IFJvY2s7IiwiZnVuY3Rpb24gVGlsZSh0aGlzSW5mbywgY2xpZW50KSB7XHJcbiAgICB0aGlzLmlkID0gdGhpc0luZm8uaWQ7XHJcbiAgICB0aGlzLnggPSB0aGlzSW5mby54O1xyXG4gICAgdGhpcy55ID0gdGhpc0luZm8ueTtcclxuICAgIHRoaXMubGVuZ3RoID0gdGhpc0luZm8ubGVuZ3RoO1xyXG4gICAgdGhpcy5jb2xvciA9IHRoaXNJbmZvLmNvbG9yO1xyXG4gICAgdGhpcy50b3BDb2xvciA9IHtcclxuICAgICAgICByOiB0aGlzLmNvbG9yLnIgKyAxMCxcclxuICAgICAgICBnOiB0aGlzLmNvbG9yLmcgKyAxMCxcclxuICAgICAgICBiOiB0aGlzLmNvbG9yLmIgKyAxMFxyXG4gICAgfTtcclxuICAgIHRoaXMuYm9yZGVyQ29sb3IgPSB7XHJcbiAgICAgICAgcjogdGhpcy5jb2xvci5yIC0gMTAsXHJcbiAgICAgICAgZzogdGhpcy5jb2xvci5nIC0gMTAsXHJcbiAgICAgICAgYjogdGhpcy5jb2xvci5iIC0gMTBcclxuICAgIH07XHJcbiAgICB0aGlzLmFsZXJ0ID0gdGhpc0luZm8uYWxlcnQ7XHJcbiAgICB0aGlzLnJhbmRvbSA9IE1hdGguZmxvb3IoZ2V0UmFuZG9tKDAsIDMpKTtcclxuXHJcbiAgICB0aGlzLmNsaWVudCA9IGNsaWVudDtcclxufVxyXG5cclxuVGlsZS5wcm90b3R5cGUudXBkYXRlID0gZnVuY3Rpb24gKHRoaXNJbmZvKSB7XHJcbiAgICB0aGlzLmNvbG9yID0gdGhpc0luZm8uY29sb3I7XHJcbiAgICB0aGlzLnRvcENvbG9yID0ge1xyXG4gICAgICAgIHI6IHRoaXMuY29sb3IuciArIDEwMCxcclxuICAgICAgICBnOiB0aGlzLmNvbG9yLmcgKyAxMDAsXHJcbiAgICAgICAgYjogdGhpcy5jb2xvci5iICsgMTAwXHJcbiAgICB9O1xyXG4gICAgdGhpcy5ib3JkZXJDb2xvciA9IHtcclxuICAgICAgICByOiB0aGlzLmNvbG9yLnIgLSAxMCxcclxuICAgICAgICBnOiB0aGlzLmNvbG9yLmcgLSAxMCxcclxuICAgICAgICBiOiB0aGlzLmNvbG9yLmIgLSAxMFxyXG4gICAgfTtcclxuICAgIHRoaXMuYWxlcnQgPSB0aGlzSW5mby5hbGVydDtcclxufTtcclxuXHJcblRpbGUucHJvdG90eXBlLnNob3cgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICB2YXIgY3R4ID0gdGhpcy5jbGllbnQubWFpbkN0eDtcclxuICAgIGN0eC5iZWdpblBhdGgoKTtcclxuXHJcbiAgICBjdHguc3Ryb2tlU3R5bGUgPSBcInJnYihcIiArIHRoaXMuYm9yZGVyQ29sb3IuciArIFwiLFwiICsgdGhpcy5ib3JkZXJDb2xvci5nICsgXCIsXCIgKyB0aGlzLmJvcmRlckNvbG9yLmIgKyBcIilcIjtcclxuICAgIGN0eC5saW5lV2lkdGggPSAyMDtcclxuXHJcblxyXG4gICAgdmFyIGdyZCA9IGN0eC5jcmVhdGVMaW5lYXJHcmFkaWVudCh0aGlzLnggKyB0aGlzLmxlbmd0aCAqIDMvNCwgdGhpcy55LCB0aGlzLnggKyB0aGlzLmxlbmd0aC80LCB0aGlzLnkgKyB0aGlzLmxlbmd0aCk7XHJcbiAgICBncmQuYWRkQ29sb3JTdG9wKDAsIFwicmdiKFwiICsgdGhpcy50b3BDb2xvci5yICsgXCIsXCIgKyB0aGlzLnRvcENvbG9yLmcgKyBcIixcIiArIHRoaXMudG9wQ29sb3IuYiArIFwiKVwiKTtcclxuICAgIGdyZC5hZGRDb2xvclN0b3AoMSwgXCJyZ2IoXCIgKyB0aGlzLmNvbG9yLnIgKyBcIixcIiArIHRoaXMuY29sb3IuZyArIFwiLFwiICsgdGhpcy5jb2xvci5iICsgXCIpXCIpO1xyXG4gICAgY3R4LmZpbGxTdHlsZSA9IGdyZDtcclxuXHJcblxyXG4gICAgY3R4LnJlY3QodGhpcy54ICsgMzAsIHRoaXMueSArIDMwLCB0aGlzLmxlbmd0aCAtIDMwLCB0aGlzLmxlbmd0aCAtIDMwKTtcclxuXHJcbiAgICBjdHguc3Ryb2tlKCk7XHJcbiAgICBjdHguZmlsbCgpO1xyXG5cclxuXHJcbn07XHJcblxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBUaWxlO1xyXG5cclxuXHJcbmZ1bmN0aW9uIGdldFJhbmRvbShtaW4sIG1heCkge1xyXG4gICAgcmV0dXJuIE1hdGgucmFuZG9tKCkgKiAobWF4IC0gbWluKSArIG1pbjtcclxufSIsIm1vZHVsZS5leHBvcnRzID0ge1xyXG4gICAgQW5pbWF0aW9uOiByZXF1aXJlKCcuL0FuaW1hdGlvbicpLFxyXG4gICAgUGxheWVyOiByZXF1aXJlKCcuL1BsYXllcicpLFxyXG4gICAgTWluaU1hcDogcmVxdWlyZSgnLi9NaW5pTWFwJyksXHJcbiAgICBUaWxlOiByZXF1aXJlKCcuL1RpbGUnKSxcclxuICAgIFJvY2s6IHJlcXVpcmUoJy4vUm9jaycpXHJcbn07IiwidmFyIENsaWVudCA9IHJlcXVpcmUoJy4vQ2xpZW50LmpzJyk7XHJcbnZhciBNYWluVUkgPSByZXF1aXJlKCcuL3VpL01haW5VSScpO1xyXG5cclxudmFyIGNsaWVudCA9IG5ldyBDbGllbnQoKTtcclxuY2xpZW50LnN0YXJ0KCk7XHJcblxyXG5cclxuXHJcbmRvY3VtZW50Lm9ua2V5ZG93biA9IGZ1bmN0aW9uIChldmVudCkge1xyXG4gICAgY2xpZW50LmtleXNbZXZlbnQua2V5Q29kZV0gPSB0cnVlO1xyXG5cclxuICAgIGlmIChldmVudC5rZXlDb2RlID09PSAzMikge1xyXG4gICAgICAgIGNvbnNvbGUubG9nKFwiU1BBQ0VcIik7XHJcbiAgICAgICAgY2xpZW50LnNvY2tldC5lbWl0KFwic2hvb3RTZWxmXCIsIHtcclxuICAgICAgICAgICAgaWQ6IGNsaWVudC5TRUxGX0lEXHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcbn0uYmluZCh0aGlzKTtcclxuXHJcbmRvY3VtZW50Lm9ua2V5dXAgPSBmdW5jdGlvbiAoZXZlbnQpIHtcclxuICAgIGlmIChldmVudC5rZXlDb2RlID09PSA4NCkge1xyXG4gICAgICAgIGNsaWVudC5tYWluVUkuZ2FtZVVJLmNoYXRVSS50ZXh0SW5wdXQuY2xpY2soKTtcclxuICAgIH1cclxuICAgIGNsaWVudC5rZXlzW2V2ZW50LmtleUNvZGVdID0gZmFsc2U7XHJcbiAgICBjbGllbnQuc29ja2V0LmVtaXQoJ2tleUV2ZW50Jywge2lkOiBldmVudC5rZXlDb2RlLCBzdGF0ZTogZmFsc2V9KTtcclxufTtcclxuXHJcblxyXG4kKHdpbmRvdykuYmluZCgnbW91c2V3aGVlbCBET01Nb3VzZVNjcm9sbCcsIGZ1bmN0aW9uIChldmVudCkge1xyXG4gICAgaWYgKGV2ZW50LmN0cmxLZXkgPT09IHRydWUpIHtcclxuICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgfVxyXG4gICAgaWYgKGNsaWVudC5DSEFUX1NDUk9MTCkge1xyXG4gICAgICAgIGNsaWVudC5DSEFUX1NDUk9MTCA9IGZhbHNlO1xyXG4gICAgICAgIHJldHVybjtcclxuICAgIH1cclxuXHJcbiAgICBpZihldmVudC5vcmlnaW5hbEV2ZW50LndoZWVsRGVsdGEgLzEyMCA+IDAgJiYgY2xpZW50Lm1haW5TY2FsZUZhY3RvciA8IDIpIHtcclxuICAgICAgICBjbGllbnQubWFpblNjYWxlRmFjdG9yICs9IDAuMDU7XHJcbiAgICB9XHJcbiAgICBlbHNlIGlmIChjbGllbnQubWFpblNjYWxlRmFjdG9yID4gMC4yNSkge1xyXG4gICAgICAgIGNsaWVudC5tYWluU2NhbGVGYWN0b3IgLT0gMC4wNTtcclxuICAgIH1cclxufSk7XHJcblxyXG5kb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdjb250ZXh0bWVudScsIGZ1bmN0aW9uIChlKSB7IC8vcHJldmVudCByaWdodC1jbGljayBjb250ZXh0IG1lbnVcclxuICAgIGUucHJldmVudERlZmF1bHQoKTtcclxufSwgZmFsc2UpOyIsImRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5zdHlsZS5vdmVyZmxvdyA9ICdoaWRkZW4nOyAgLy8gZmlyZWZveCwgY2hyb21lXHJcbmRvY3VtZW50LmJvZHkuc2Nyb2xsID0gXCJub1wiO1xyXG5cclxudmFyIFBsYXllck5hbWVyVUkgPSByZXF1aXJlKCcuL1BsYXllck5hbWVyVUknKTtcclxudmFyIEdhbWVVSSA9IHJlcXVpcmUoJy4vZ2FtZS9HYW1lVUknKTtcclxuXHJcbmZ1bmN0aW9uIE1haW5VSShjbGllbnQsIHNvY2tldCkge1xyXG4gICAgdGhpcy5jbGllbnQgPSBjbGllbnQ7XHJcbiAgICB0aGlzLnNvY2tldCA9IHNvY2tldDtcclxuXHJcbiAgICB0aGlzLmdhbWVVSSA9IG5ldyBHYW1lVUkodGhpcy5jbGllbnQsIHRoaXMuc29ja2V0LCB0aGlzKTtcclxuXHJcbiAgICB0aGlzLnBsYXllck5hbWVyVUkgPSBuZXcgUGxheWVyTmFtZXJVSSh0aGlzLmNsaWVudCwgdGhpcy5zb2NrZXQpO1xyXG59XHJcblxyXG5NYWluVUkucHJvdG90eXBlLm9wZW4gPSBmdW5jdGlvbiAoaW5mbykge1xyXG4gICAgdmFyIGFjdGlvbiA9IGluZm8uYWN0aW9uO1xyXG4gICAgdmFyIGhvbWU7XHJcbiAgICBpZiAoYWN0aW9uID09PSBcImdhbWVNc2dQcm9tcHRcIikge1xyXG4gICAgICAgIHRoaXMuZ2FtZVVJLmdhbWVNc2dQcm9tcHQub3BlbihpbmZvLm1lc3NhZ2UpO1xyXG4gICAgfVxyXG59O1xyXG5cclxuXHJcbk1haW5VSS5wcm90b3R5cGUuY2xvc2UgPSBmdW5jdGlvbiAoYWN0aW9uKSB7XHJcbiAgICBpZiAoYWN0aW9uID09PSBcImdhbWVNc2dQcm9tcHRcIikge1xyXG4gICAgICAgIHRoaXMuZ2FtZVVJLmdhbWVNc2dQcm9tcHQuY2xvc2UoKTtcclxuICAgIH1cclxufTtcclxuXHJcblxyXG5NYWluVUkucHJvdG90eXBlLnVwZGF0ZUxlYWRlckJvYXJkID0gZnVuY3Rpb24gKCkge1xyXG4gICAgdmFyIGxlYWRlcmJvYXJkID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJsZWFkZXJib2FyZFwiKTtcclxuICAgIHZhciBQTEFZRVJfQVJSQVkgPSB0aGlzLmNsaWVudC5QTEFZRVJfQVJSQVk7XHJcblxyXG5cclxuICAgIHZhciBwbGF5ZXJTb3J0ID0gZnVuY3Rpb24gKGEsIGIpIHtcclxuICAgICAgICB2YXIgcGxheWVyQSA9IHRoaXMuY2xpZW50LlBMQVlFUl9MSVNUW2FdO1xyXG4gICAgICAgIHZhciBwbGF5ZXJCID0gdGhpcy5jbGllbnQuUExBWUVSX0xJU1RbYl07XHJcbiAgICAgICAgcmV0dXJuIHBsYXllckEucmFkaXVzIC0gcGxheWVyQi5yYWRpdXM7XHJcbiAgICB9LmJpbmQodGhpcyk7XHJcblxyXG4gICAgUExBWUVSX0FSUkFZLnNvcnQocGxheWVyU29ydCk7XHJcblxyXG5cclxuICAgIGxlYWRlcmJvYXJkLmlubmVySFRNTCA9IFwiXCI7XHJcbiAgICBmb3IgKHZhciBpID0gUExBWUVSX0FSUkFZLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XHJcbiAgICAgICAgdmFyIHBsYXllciA9IHRoaXMuY2xpZW50LlBMQVlFUl9MSVNUW1BMQVlFUl9BUlJBWVtpXV07XHJcblxyXG4gICAgICAgIGlmIChwbGF5ZXIpIHtcclxuICAgICAgICAgICAgdmFyIGVudHJ5ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnbGknKTtcclxuICAgICAgICAgICAgZW50cnkuYXBwZW5kQ2hpbGQoZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUocGxheWVyLm5hbWUgKyBcIiAtIFwiICsgTWF0aC5mbG9vcihwbGF5ZXIucmFkaXVzKSkpO1xyXG4gICAgICAgICAgICBsZWFkZXJib2FyZC5hcHBlbmRDaGlsZChlbnRyeSk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG59O1xyXG5cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gTWFpblVJOyIsImZ1bmN0aW9uIFBsYXllck5hbWVyVUkgKGNsaWVudCwgc29ja2V0KSB7XHJcbiAgICB0aGlzLmNsaWVudCA9IGNsaWVudDtcclxuICAgIHRoaXMuc29ja2V0ID0gc29ja2V0O1xyXG5cclxuICAgIHRoaXMubGVhZGVyYm9hcmQgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcImxlYWRlcmJvYXJkX2NvbnRhaW5lclwiKTtcclxuICAgIHRoaXMubmFtZUJ0biA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwibmFtZVN1Ym1pdFwiKTtcclxuICAgIHRoaXMucGxheWVyTmFtZUlucHV0ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJwbGF5ZXJOYW1lSW5wdXRcIik7XHJcbiAgICB0aGlzLnBsYXllck5hbWVyID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJwbGF5ZXJfbmFtZXJcIik7XHJcbn1cclxuXHJcblBsYXllck5hbWVyVUkucHJvdG90eXBlLm9wZW4gPSBmdW5jdGlvbiAoKSB7XHJcbiAgICB0aGlzLnBsYXllck5hbWVJbnB1dC5hZGRFdmVudExpc3RlbmVyKFwia2V5dXBcIiwgZnVuY3Rpb24gKGV2ZW50KSB7XHJcbiAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcclxuICAgICAgICBpZiAoZXZlbnQua2V5Q29kZSA9PT0gMTMpIHtcclxuICAgICAgICAgICAgdGhpcy5uYW1lQnRuLmNsaWNrKCk7XHJcbiAgICAgICAgfVxyXG4gICAgfS5iaW5kKHRoaXMpKTtcclxuXHJcbiAgICB0aGlzLm5hbWVCdG4uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIGZ1bmN0aW9uICgpIHtcclxuICAgICAgICB0aGlzLmNsaWVudC5tYWluQ2FudmFzLnN0eWxlLnZpc2liaWxpdHkgPSBcInZpc2libGVcIjtcclxuICAgICAgICB0aGlzLmxlYWRlcmJvYXJkLnN0eWxlLnZpc2liaWxpdHkgPSBcInZpc2libGVcIjtcclxuICAgICAgICB0aGlzLnNvY2tldC5lbWl0KFwibmV3UGxheWVyXCIsXHJcbiAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgIG5hbWU6IHRoaXMucGxheWVyTmFtZUlucHV0LnZhbHVlLFxyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB0aGlzLnBsYXllck5hbWVyLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XHJcbiAgICB9LmJpbmQodGhpcykpO1xyXG5cclxuICAgIHRoaXMucGxheWVyTmFtZXIuc3R5bGUudmlzaWJpbGl0eSA9IFwidmlzaWJsZVwiO1xyXG4gICAgdGhpcy5wbGF5ZXJOYW1lSW5wdXQuZm9jdXMoKTtcclxuICAgIHRoaXMubGVhZGVyYm9hcmQuc3R5bGUudmlzaWJpbGl0eSA9IFwiaGlkZGVuXCI7XHJcbn07XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IFBsYXllck5hbWVyVUk7IiwiZnVuY3Rpb24gQ2hhdFVJKHBhcmVudCkge1xyXG4gICAgdGhpcy5wYXJlbnQgPSBwYXJlbnQ7XHJcbiAgICB0aGlzLnRlbXBsYXRlID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJjaGF0X2NvbnRhaW5lclwiKTtcclxuICAgIHRoaXMudGV4dElucHV0ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2NoYXRfaW5wdXQnKTtcclxuICAgIHRoaXMuY2hhdExpc3QgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY2hhdF9saXN0Jyk7XHJcblxyXG5cclxuICAgIHRoaXMudGV4dElucHV0LmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHRoaXMudGV4dElucHV0LmZvY3VzKCk7XHJcblxyXG4gICAgICAgIHRoaXMucGFyZW50LmNsaWVudC5DSEFUX09QRU4gPSB0cnVlO1xyXG4gICAgICAgIHRoaXMuY2hhdExpc3Quc3R5bGUuaGVpZ2h0ID0gXCI4MCVcIjtcclxuICAgICAgICB0aGlzLmNoYXRMaXN0LnN0eWxlLm92ZXJmbG93WSA9IFwiYXV0b1wiO1xyXG5cclxuICAgICAgICB0aGlzLnRleHRJbnB1dC5zdHlsZS5iYWNrZ3JvdW5kID0gXCJyZ2JhKDM0LCA0OCwgNzEsIDEpXCI7XHJcbiAgICB9LmJpbmQodGhpcykpO1xyXG4gICAgdGhpcy50ZXh0SW5wdXQuYWRkRXZlbnRMaXN0ZW5lcigna2V5ZG93bicsIGZ1bmN0aW9uIChlKSB7XHJcbiAgICAgICAgaWYgKGUua2V5Q29kZSA9PT0gMTMpIHtcclxuICAgICAgICAgICAgdGhpcy5zZW5kTWVzc2FnZSgpO1xyXG4gICAgICAgIH1cclxuICAgIH0uYmluZCh0aGlzKSk7XHJcblxyXG5cclxuICAgIHRoaXMudGVtcGxhdGUuYWRkRXZlbnRMaXN0ZW5lcignbW91c2V3aGVlbCcsIGZ1bmN0aW9uICgpIHtcclxuICAgICAgICB0aGlzLnBhcmVudC5jbGllbnQuQ0hBVF9TQ1JPTEwgPSB0cnVlO1xyXG4gICAgfS5iaW5kKHRoaXMpKTtcclxuXHJcbiAgICB0aGlzLnRlbXBsYXRlLmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNlZG93bicsIGZ1bmN0aW9uICgpIHtcclxuICAgICAgICB0aGlzLnBhcmVudC5jbGllbnQuQ0hBVF9DTElDSyA9IHRydWU7XHJcbiAgICB9LmJpbmQodGhpcykpO1xyXG59XHJcblxyXG5DaGF0VUkucHJvdG90eXBlLm9wZW4gPSBmdW5jdGlvbiAobWVzc2FnZSkge1xyXG4gICAgdGhpcy50ZW1wbGF0ZS5zdHlsZS5kaXNwbGF5ID0gXCJibG9ja1wiO1xyXG4gICAgdGhpcy5jbG9zZSgpO1xyXG59O1xyXG5cclxuXHJcbkNoYXRVSS5wcm90b3R5cGUuY2xvc2UgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICB0aGlzLnRleHRJbnB1dC5ibHVyKCk7XHJcbiAgICB0aGlzLnBhcmVudC5jbGllbnQuQ0hBVF9PUEVOID0gZmFsc2U7XHJcbiAgICB0aGlzLmNoYXRMaXN0LnN0eWxlLmhlaWdodCA9IFwiMzAlXCI7XHJcbiAgICB0aGlzLmNoYXRMaXN0LnN0eWxlLmJhY2tncm91bmQgPSBcInJnYmEoMTgyLCAxOTMsIDIxMSwgMC4wMilcIjtcclxuICAgIHRoaXMudGV4dElucHV0LnN0eWxlLmJhY2tncm91bmQgPSBcInJnYmEoMTgyLCAxOTMsIDIxMSwgMC4xKVwiO1xyXG4gICAgdGhpcy5wYXJlbnQuY2xpZW50LkNIQVRfU0NST0xMID0gZmFsc2U7XHJcbiAgICAkKCcjY2hhdF9saXN0JykuYW5pbWF0ZSh7c2Nyb2xsVG9wOiAkKCcjY2hhdF9saXN0JykucHJvcChcInNjcm9sbEhlaWdodFwiKX0sIDEwMCk7XHJcbiAgICB0aGlzLmNoYXRMaXN0LnN0eWxlLm92ZXJmbG93WSA9IFwibm9uZVwiO1xyXG59O1xyXG5cclxuXHJcbkNoYXRVSS5wcm90b3R5cGUuYWRkTWVzc2FnZSA9IGZ1bmN0aW9uIChwYWNrZXQpIHtcclxuICAgIHZhciBlbnRyeSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2xpJyk7XHJcbiAgICBlbnRyeS5hcHBlbmRDaGlsZChkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShwYWNrZXQubmFtZSArIFwiIDogXCIgKyBwYWNrZXQuY2hhdE1lc3NhZ2UpKTtcclxuICAgIHRoaXMuY2hhdExpc3QuYXBwZW5kQ2hpbGQoZW50cnkpO1xyXG5cclxuICAgICQoJyNjaGF0X2xpc3QnKS5hbmltYXRlKHtzY3JvbGxUb3A6ICQoJyNjaGF0X2xpc3QnKS5wcm9wKFwic2Nyb2xsSGVpZ2h0XCIpfSwgMTAwKTtcclxufTtcclxuXHJcblxyXG5DaGF0VUkucHJvdG90eXBlLnNlbmRNZXNzYWdlID0gZnVuY3Rpb24gKCkge1xyXG4gICAgdmFyIHNvY2tldCA9IHRoaXMucGFyZW50LnNvY2tldDtcclxuXHJcblxyXG4gICAgaWYgKHRoaXMudGV4dElucHV0LnZhbHVlICYmIHRoaXMudGV4dElucHV0LnZhbHVlICE9PSBcIlwiKSB7XHJcbiAgICAgICAgc29ja2V0LmVtaXQoJ2NoYXRNZXNzYWdlJywge1xyXG4gICAgICAgICAgICBpZDogdGhpcy5wYXJlbnQuY2xpZW50LlNFTEZfSUQsXHJcbiAgICAgICAgICAgIG1lc3NhZ2U6IHRoaXMudGV4dElucHV0LnZhbHVlXHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgdGhpcy50ZXh0SW5wdXQudmFsdWUgPSBcIlwiO1xyXG4gICAgfVxyXG4gICAgdGhpcy5jbG9zZSgpO1xyXG59O1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBDaGF0VUk7XHJcblxyXG5cclxuIiwiZnVuY3Rpb24gR2FtZU1zZ1Byb21wdChwYXJlbnQpIHtcclxuICAgIHRoaXMucGFyZW50ID0gcGFyZW50O1xyXG4gICAgdGhpcy50ZW1wbGF0ZSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwicHJvbXB0X2NvbnRhaW5lclwiKTtcclxuICAgIHRoaXMubWVzc2FnZSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdnYW1lX21zZ19wcm9tcHQnKTtcclxufVxyXG5cclxuR2FtZU1zZ1Byb21wdC5wcm90b3R5cGUub3BlbiA9IGZ1bmN0aW9uIChtZXNzYWdlKSB7XHJcbiAgICB0aGlzLnRlbXBsYXRlLnN0eWxlLmRpc3BsYXkgPSBcImJsb2NrXCI7XHJcbiAgICB0aGlzLm1lc3NhZ2UuaW5uZXJIVE1MID0gbWVzc2FnZTtcclxufTtcclxuXHJcbkdhbWVNc2dQcm9tcHQucHJvdG90eXBlLmNsb3NlID0gZnVuY3Rpb24gKCkge1xyXG4gICAgdGhpcy50ZW1wbGF0ZS5zdHlsZS5kaXNwbGF5ID0gXCJub25lXCI7XHJcbn07XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IEdhbWVNc2dQcm9tcHQ7XHJcblxyXG5cclxuIiwidmFyIEdhbWVNc2dQcm9tcHQgPSByZXF1aXJlKCcuL0dhbWVNc2dQcm9tcHQnKTtcclxudmFyIENoYXRVSSA9IHJlcXVpcmUoJy4vQ2hhdFVJJyk7XHJcblxyXG5mdW5jdGlvbiBHYW1lVUkoY2xpZW50LCBzb2NrZXQsIHBhcmVudCkge1xyXG4gICAgdGhpcy5jbGllbnQgPSBjbGllbnQ7XHJcbiAgICB0aGlzLnNvY2tldCA9IHNvY2tldDtcclxuICAgIHRoaXMucGFyZW50ID0gcGFyZW50O1xyXG4gICAgdGhpcy5nYW1lTXNnUHJvbXB0ID0gbmV3IEdhbWVNc2dQcm9tcHQodGhpcyk7XHJcbiAgICB0aGlzLmNoYXRVSSA9IG5ldyBDaGF0VUkodGhpcyk7XHJcbn1cclxuXHJcbkdhbWVVSS5wcm90b3R5cGUub3BlbiA9IGZ1bmN0aW9uICgpIHtcclxuICAgIGNvbnNvbGUubG9nKFwiT1BFTklORyBHQU1FIFVJXCIpO1xyXG4gICAgdGhpcy5jaGF0VUkub3BlbigpO1xyXG59O1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSAgR2FtZVVJOyJdfQ==
