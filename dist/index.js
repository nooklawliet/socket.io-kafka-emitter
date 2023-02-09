"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BroadcastOperator = exports.KafkaEmitter = void 0;
const msgpack = require("notepack.io");
const Debug = require("debug");
const socket_io_parser_1 = require("socket.io-parser");
const debug = new Debug('socket.io-kafka-emitter');
const UID = "emitter";
const DEFAULT_KAFKA_TOPIC = 'kafka_adapter';
var RequestType;
(function (RequestType) {
    RequestType[RequestType["SOCKETS"] = 0] = "SOCKETS";
    RequestType[RequestType["ALL_ROOMS"] = 1] = "ALL_ROOMS";
    RequestType[RequestType["REMOTE_JOIN"] = 2] = "REMOTE_JOIN";
    RequestType[RequestType["REMOTE_LEAVE"] = 3] = "REMOTE_LEAVE";
    RequestType[RequestType["REMOTE_DISCONNECT"] = 4] = "REMOTE_DISCONNECT";
    RequestType[RequestType["REMOTE_FETCH"] = 5] = "REMOTE_FETCH";
    RequestType[RequestType["SERVER_SIDE_EMIT"] = 6] = "SERVER_SIDE_EMIT";
})(RequestType || (RequestType = {}));
class KafkaEmitter {
    constructor(producer, opts, nsp = "/") {
        this.producer = producer;
        this.nsp = nsp;
        this.opts = Object.assign({
            key: "socket.io",
            parser: msgpack,
        }, opts);
        this.broadcastOptions = {
            nsp,
            // broadcastChannel: this.opts.key + "#" + nsp + "#",
            // requestChannel: this.opts.key + "-request#" + nsp + "#",
            parser: this.opts.parser,
        };
    }
    // /**
    //  * Return a new emitter for the given namespace.
    //  *
    //  * @param nsp - namespace
    //  * @public
    //  */
    // of(nsp) {
    //     return new Emitter(this.producer, this.opts, (nsp[0] !== "/" ? "/" : "") + nsp);
    // }
    /**
     * Emits to all clients.
     *
     * @return Always true
     * @public
     */
    emit(ev, ...args) {
        return new BroadcastOperator(this.producer, this.broadcastOptions).emit(ev, ...args);
    }
    /**
     * Targets a room when emitting.
     *
     * @param room
     * @return BroadcastOperator
     * @public
     */
    to(room) {
        return new BroadcastOperator(this.producer, this.broadcastOptions).to(room);
    }
}
exports.KafkaEmitter = KafkaEmitter;
class BroadcastOperator {
    constructor(producer, broadcastOptions, rooms = new Set(), exceptRooms = new Set(), flags = {}) {
        this.flags = {};
        this.producer = producer;
        this.broadcastOptions = broadcastOptions;
        this.rooms = rooms;
        this.exceptRooms = exceptRooms;
        this.flags = flags;
    }
    /**
     * Targets a room when emitting.
     *
     * @param room
     * @return a new BroadcastOperator instance
     * @public
     */
    to(room) {
        const rooms = new Set(this.rooms);
        if (Array.isArray(room)) {
            room.forEach((r) => rooms.add(r));
        }
        else {
            rooms.add(room);
        }
        return new BroadcastOperator(this.producer, this.broadcastOptions, rooms, this.exceptRooms, this.flags);
    }
    // /**
    //  * Targets a room when emitting.
    //  *
    //  * @param room
    //  * @return a new BroadcastOperator instance
    //  * @public
    //  */
    // in(room) {
    //     return this.to(room);
    // }
    // /**
    //  * Excludes a room when emitting.
    //  *
    //  * @param room
    //  * @return a new BroadcastOperator instance
    //  * @public
    //  */
    // except(room) {
    //     const exceptRooms = new Set(this.exceptRooms);
    //     if (Array.isArray(room)) {
    //         room.forEach((r) => exceptRooms.add(r));
    //     }
    //     else {
    //         exceptRooms.add(room);
    //     }
    //     return new BroadcastOperator(this.producer, this.broadcastOptions, this.rooms, exceptRooms, this.flags);
    // }
    // /**
    //  * Sets the compress flag.
    //  *
    //  * @param compress - if `true`, compresses the sending data
    //  * @return a new BroadcastOperator instance
    //  * @public
    //  */
    // compress(compress) {
    //     const flags = Object.assign({}, this.flags, { compress });
    //     return new BroadcastOperator(this.producer, this.broadcastOptions, this.rooms, this.exceptRooms, flags);
    // }
    // /**
    //  * Sets a modifier for a subsequent event emission that the event data may be lost if the client is not ready to
    //  * receive messages (because of network slowness or other issues, or because they’re connected through long polling
    //  * and is in the middle of a request-response cycle).
    //  *
    //  * @return a new BroadcastOperator instance
    //  * @public
    //  */
    // get volatile() {
    //     const flags = Object.assign({}, this.flags, { volatile: true });
    //     return new BroadcastOperator(this.producer, this.broadcastOptions, this.rooms, this.exceptRooms, flags);
    // }
    /**
     * Emits to all clients.
     *
     * @return Always true
     * @public
     */
    emit(ev, ...args) {
        // if (exports.RESERVED_EVENTS.has(ev)) {
        //     throw new Error(`"${ev}" is a reserved event name`);
        // }
        // set up packet object
        const data = [ev, ...args];
        debug('emit data:', data);
        const packet = {
            type: socket_io_parser_1.PacketType.EVENT,
            data: data,
            nsp: this.broadcastOptions.nsp,
        };
        const opts = {
            rooms: [...this.rooms],
            flags: this.flags,
            except: [...this.exceptRooms],
        };
        const msg = this.broadcastOptions.parser.encode([UID, packet, opts]);
        // let channel = this.broadcastOptions.broadcastChannel;
        // if (this.rooms && this.rooms.size === 1) {
        //     channel += this.rooms.keys().next().value + "#";
        // }
        debug('packet:', packet);
        debug('opts:', opts);
        debug('msg:', msg);
        const rooms = this.rooms;
        debug('rooms:', rooms);
        const produceMessage = {
            topic: DEFAULT_KAFKA_TOPIC,
            messages: [{
                    key: UID,
                    value: msg
                }],
        };
        debug('producer send message:', produceMessage);
        this.producer.send(produceMessage);
        return true;
    }
}
exports.BroadcastOperator = BroadcastOperator;
//# sourceMappingURL=index.js.map