import { Producer } from 'kafkajs';
export declare class KafkaEmitter {
    private nsp;
    private producer;
    private opts;
    private broadcastOptions;
    constructor(producer: Producer, opts: any, nsp?: string);
    /**
     * Emits to all clients.
     *
     * @return Always true
     * @public
     */
    emit(ev: any, ...args: any[]): boolean;
    /**
     * Targets a room when emitting.
     *
     * @param room
     * @return BroadcastOperator
     * @public
     */
    to(room: any): BroadcastOperator;
}
export declare class BroadcastOperator {
    private readonly producer;
    private readonly broadcastOptions;
    private readonly rooms;
    private readonly exceptRooms;
    private readonly flags;
    constructor(producer: any, broadcastOptions: any, rooms?: Set<unknown>, exceptRooms?: Set<unknown>, flags?: {});
    /**
     * Targets a room when emitting.
     *
     * @param room
     * @return a new BroadcastOperator instance
     * @public
     */
    to(room: any): BroadcastOperator;
    /**
     * Emits to all clients.
     *
     * @return Always true
     * @public
     */
    emit(ev: any, ...args: any[]): boolean;
}
