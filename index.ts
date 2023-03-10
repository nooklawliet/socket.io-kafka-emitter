import * as msgpack from 'notepack.io';
import * as Debug from 'debug';
import { PacketType } from 'socket.io-parser';
import { Producer } from 'kafkajs';
import type {
    DefaultEventsMap,
    EventNames,
    EventParams,
    EventsMap,
    TypedEventBroadcaster,
} from "./typed-events";

const debug = new Debug('socket.io-kafka-emitter');
const UID = 'emitter';
const DEFAULT_KAFKA_ADAPTER_TOPIC = 'kafka_adapter';

enum RequestType {
    SOCKETS = 0,
    ALL_ROOMS = 1,
    REMOTE_JOIN = 2,
    REMOTE_LEAVE = 3,
    REMOTE_DISCONNECT = 4,
    REMOTE_FETCH = 5,
    SERVER_SIDE_EMIT = 6,
}

export interface EmitterOptions {
    /**
     * @default "kafka_adapter"
     */
    topic?: string;
}
interface Parser {
    encode: (msg: any) => any;
}
interface BroadcastOptions {
    nsp: string;
    adapterTopic: string;
    requestTopic: string;
    parser: Parser;
}
interface BroadcastFlags {
    volatile?: boolean;
    compress?: boolean;
}

export const RESERVED_EVENTS: ReadonlySet<string> = new Set(<const>[
    "connect",
    "connect_error",
    "disconnect",
    "disconnecting",
    "newListener",
    "removeListener",
]);

export class KafkaEmitter<EmitEvents extends EventsMap = DefaultEventsMap> {

    private nsp: string;
    private producer: Producer;
    private opts: any;
    private topic: string;
    private broadcastOptions: BroadcastOptions;

    constructor(producer: Producer, opts: any, nsp = "/") {
        this.nsp = nsp;
        this.producer = producer;
        this.topic = opts.topic || DEFAULT_KAFKA_ADAPTER_TOPIC;
        this.broadcastOptions = {
            nsp,
            adapterTopic: this.topic,
            requestTopic: this.topic + '_request',
            parser: msgpack,
        };
    }

    /**
     * Return a new emitter for the given namespace.
     *
     * @param nsp - namespace
     * @public
     */
    public of(nsp: string): KafkaEmitter<EmitEvents> {
        return new KafkaEmitter(this.producer, this.opts, (nsp[0] !== "/" ? "/" : "") + nsp);
    }
    /**
     * Emits to all clients.
     *
     * @return Always true
     * @public
     */
    public emit<Ev extends EventNames<EmitEvents>>(ev: Ev, ...args: EventParams<EmitEvents, Ev>): true {
        return new BroadcastOperator(this.producer, this.broadcastOptions).emit(ev, ...args);
    }
    /**
     * Targets a room when emitting.
     *
     * @param room
     * @return BroadcastOperator
     * @public
     */
    public to(room: string | string[]): BroadcastOperator<EmitEvents> {
        return new BroadcastOperator(this.producer, this.broadcastOptions).to(room);
    }
    /**
     * Targets a room when emitting.
     *
     * @param room
     * @return BroadcastOperator
     * @public
     */
    public in(room: string | string[]): BroadcastOperator<EmitEvents> {
        return new BroadcastOperator(this.producer, this.broadcastOptions).in(room);
    }
    /**
     * Excludes a room when emitting.
     *
     * @param room
     * @return BroadcastOperator
     * @public
     */
    public except(room: string | string[]): BroadcastOperator<EmitEvents> {
        return new BroadcastOperator(this.producer, this.broadcastOptions).except(room);
    }
    /**
     * Sets a modifier for a subsequent event emission that the event data may be lost if the client is not ready to
     * receive messages (because of network slowness or other issues, or because they’re connected through long polling
     * and is in the middle of a request-response cycle).
     *
     * @return BroadcastOperator
     * @public
     */
    public get volatile(): BroadcastOperator<EmitEvents> {
        return new BroadcastOperator(this.producer, this.broadcastOptions).volatile;
    }
    /**
     * Sets the compress flag.
     *
     * @param compress - if `true`, compresses the sending data
     * @return BroadcastOperator
     * @public
     */
    public compress(compress: boolean): BroadcastOperator<EmitEvents> {
        return new BroadcastOperator(this.producer, this.broadcastOptions).compress(compress);
    }
    /**
     * Makes the matching socket instances join the specified rooms
     *
     * @param rooms
     * @public
     */
    public socketsJoin(rooms: string | string[]): void {
        return new BroadcastOperator(this.producer, this.broadcastOptions).socketsJoin(rooms);
    }
    /**
     * Makes the matching socket instances leave the specified rooms
     *
     * @param rooms
     * @public
     */
    public socketsLeave(rooms: string | string[]): void {
        return new BroadcastOperator(this.producer, this.broadcastOptions).socketsLeave(rooms);
    }
    /**
     * Makes the matching socket instances disconnect
     *
     * @param close - whether to close the underlying connection
     * @public
     */
    public disconnectSockets(close: boolean = false): void {
        return new BroadcastOperator(this.producer, this.broadcastOptions).disconnectSockets(close);
    }
    /**
     * Send a packet to the Socket.IO servers in the cluster
     *
     * @param args - any number of serializable arguments
     */
    public serverSideEmit(...args: any[]): void {
        debug('server-side emit');
        const withAck = typeof args[args.length - 1] === 'function';
        if (withAck) {
            throw new Error('Acknowledgements are not supported');
        }
        const request = JSON.stringify({
            uid: UID,
            type: RequestType.SERVER_SIDE_EMIT,
            data: args,
        });
        const msg = this.broadcastOptions.parser.encode([UID, request]);
        const pMessage = {
            topic: this.broadcastOptions.requestTopic,
            messages: [{
                key: UID,
                value: msg
            }]
        }
        debug('producer send message:', pMessage);
        this.producer.send(pMessage);
    }
}

export class BroadcastOperator<EmitEvents extends EventsMap>implements TypedEventBroadcaster<EmitEvents> {

    private readonly producer: any;
    private readonly broadcastOptions: BroadcastOptions;
    private readonly rooms;
    private readonly exceptRooms;
    private readonly flags: BroadcastFlags = {};

    constructor(producer, broadcastOptions, rooms = new Set(), exceptRooms = new Set(), flags = {}) {
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
    public to(room: string | string[]): BroadcastOperator<EmitEvents> {
        const rooms = new Set(this.rooms);
        if (Array.isArray(room)) {
            room.forEach((r) => rooms.add(r));
        } else {
            rooms.add(room);
        }
        return new BroadcastOperator(this.producer, this.broadcastOptions, rooms, this.exceptRooms, this.flags);
    }
    /**
     * Targets a room when emitting.
     *
     * @param room
     * @return a new BroadcastOperator instance
     * @public
     */
    public in(room: string | string[]): BroadcastOperator<EmitEvents> {
        return this.to(room);
    }
    /**
     * Excludes a room when emitting.
     *
     * @param room
     * @return a new BroadcastOperator instance
     * @public
     */
    public except(room: string | string[]): BroadcastOperator<EmitEvents> {
        const exceptRooms = new Set(this.exceptRooms);
        if (Array.isArray(room)) {
            room.forEach((r) => exceptRooms.add(r));
        } else {
            exceptRooms.add(room);
        }
        return new BroadcastOperator(this.producer, this.broadcastOptions, this.rooms, exceptRooms, this.flags);
    }
    /**
     * Sets the compress flag.
     *
     * @param compress - if `true`, compresses the sending data
     * @return a new BroadcastOperator instance
     * @public
     */
    public compress(compress: boolean): BroadcastOperator<EmitEvents> {
        const flags = Object.assign({}, this.flags, { compress });
        return new BroadcastOperator(this.producer, this.broadcastOptions, this.rooms, this.exceptRooms, flags);
    }
    /**
     * Sets a modifier for a subsequent event emission that the event data may be lost if the client is not ready to
     * receive messages (because of network slowness or other issues, or because they’re connected through long polling
     * and is in the middle of a request-response cycle).
     *
     * @return a new BroadcastOperator instance
     * @public
     */
    public get volatile(): BroadcastOperator<EmitEvents> {
        const flags = Object.assign({}, this.flags, { volatile: true });
        return new BroadcastOperator(this.producer, this.broadcastOptions, this.rooms, this.exceptRooms, flags);
    }
    /**
     * Emits to all clients.
     *
     * @return Always true
     * @public
     */
    public emit<Ev extends EventNames<EmitEvents>>(ev: Ev,...args: EventParams<EmitEvents, Ev>): true {
        if (exports.RESERVED_EVENTS.has(ev)) {
            throw new Error(`"${ev}" is a reserved event name`);
        }
        
        const data = [ev, ...args];
        debug('emit data:', data);
        const packet = {
            type: PacketType.EVENT,
            data: data,
            nsp: this.broadcastOptions.nsp,
        };
        const opts = {
            rooms: [...this.rooms],
            flags: this.flags,
            except: [...this.exceptRooms],
        };
        const msg = this.broadcastOptions.parser.encode([UID, packet, opts]);
        // if (this.rooms && this.rooms.size === 1) {
        //     channel += this.rooms.keys().next().value + "#";
        // }
        debug('packet:', packet);
        debug('opts:', opts);
        debug('msg:', msg);

        const rooms = this.rooms;
        debug('rooms:', rooms);

        const pMessage = {
            topic: this.broadcastOptions.adapterTopic,
            messages: [{
                key: UID,
                value: msg
            }],
        }
        debug('producer send message:', pMessage);
        this.producer.send(pMessage)
        return true;
    }
    /**
     * Makes the matching socket instances join the specified rooms
     *
     * @param rooms
     * @public
     */
    public socketsJoin(rooms: string | string[]): void {
        debug('sockets join');
        const request = JSON.stringify({
            type: RequestType.REMOTE_JOIN,
            opts: {
                rooms: [...this.rooms],
                except: [...this.exceptRooms],
            },
            rooms: Array.isArray(rooms) ? rooms : [rooms],
        });
        const msg = this.broadcastOptions.parser.encode([UID, request]);
        const pMessage = {
            topic: this.broadcastOptions.requestTopic,
            messages: [{
                key: UID,
                value: msg
            }]
        }
        debug('producer send message:', pMessage);
        this.producer.send(pMessage);
    }
    /**
     * Makes the matching socket instances leave the specified rooms
     *
     * @param rooms
     * @public
     */
    public socketsLeave(rooms: string | string[]): void {
        debug('sockets leave');
        const request = JSON.stringify({
            type: RequestType.REMOTE_LEAVE,
            opts: {
                rooms: [...this.rooms],
                except: [...this.exceptRooms],
            },
            rooms: Array.isArray(rooms) ? rooms : [rooms],
        });
        const msg = this.broadcastOptions.parser.encode([UID, request]);
        const pMessage = {
            topic: this.broadcastOptions.requestTopic,
            messages: [{
                key: UID,
                value: msg
            }]
        }
        debug('producer send message:', pMessage);
        this.producer.send(pMessage);
    }
    /**
     * Makes the matching socket instances disconnect
     *
     * @param close - whether to close the underlying connection
     * @public
     */
    public disconnectSockets(close: boolean = false): void {
        debug('disconnect sockets');
        const request = JSON.stringify({
            type: RequestType.REMOTE_DISCONNECT,
            opts: {
                rooms: [...this.rooms],
                except: [...this.exceptRooms],
            },
            close,
        });
        const msg = this.broadcastOptions.parser.encode([UID, request]);
        const pMessage = {
            topic: this.broadcastOptions.requestTopic,
            messages: [{
                key: UID,
                value: msg
            }]
        }
        debug('producer send message:', pMessage);
        this.producer.send(pMessage);
    }
}