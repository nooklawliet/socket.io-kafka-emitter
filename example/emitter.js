
const { Kafka, Partitioners, CompressionTypes, logLevel } = require('kafkajs');
const { KafkaEmitter } = require('../dist/index');

const kafka = new Kafka({
    clientId: "clientId",
    brokers: ['localhost:9092'],
    logLevel: logLevel.ERROR,
});
const opts = {
    topics: 'kafka_adapter'
}

async function main() {

    const producer = kafka.producer({ createPartitioner: Partitioners.DefaultPartitioner });
    await producer.connect();

    const emitter = new KafkaEmitter(producer, opts);
    // await emitter.connect();

    // console.log('emitter emit message');
    // emitter.emit('message', new Date().toUTCString());
    // emitter.to('client-1').emit('message', new Date().toUTCString());

    // emitter.socketsJoin("room1");
    setTimeout(async () => {
        // emitter.serverSideEmit("broadcast", "test");
        emitter.serverSideEmit("broadcastWithAck", "test");
        // emitter.serverSideEmit("allRooms", "test");
        // emitter.in("room1").disconnectSockets(true);
        // emitter.to('room1').emit('message', new Date().toUTCString());
        // await producer.disconnect();

        // process.exit();
    }, 1000);

    // setTimeout(() => {
        // emitter.socketsLeave("room1");
    // }, 10000);
    
    

    // emitter.to('client-1').emit('message', new Date().toUTCString() + ' - message from emitter'); // ['client-1', 'client-2']

    // setTimeout(() => {
    //     console.log('all client join room-b');
    //     emitter.socketsJoin('room-b');
    //     // emitter.in('room-a').socketsJoin('room-b');
    //     // emitter.in('client-2').disconnectSockets(true);
    // }, 1000);

    // a -> c1, c3
    // b -> c1, c2, c3

    // setTimeout(async () => {
        // emitter.serverSideEmit('message', 'emitter server-side emit');
        // console.log('emitter emit message to room-b');
        // emitter.compress(false).emit('message', 'message compress');
        // emitter.to('room-b').except('client-1').emit('message', 'expect client-1');
        // emitter.to('room-a').emit('message', 'message to all client in room-a');
        // emitter.to(['client-1', 'client-2']).emit('message', 'message to client');
        // emitter.volatile.to(['client-1', 'client-2']).emit('message', 'message to client');
        // emitter.in('room-a').disconnectSockets(true);
        // await producer.disconnect();
    // }, 5000);

    // setTimeout(async () => {
    //     console.log('all client leave room-b');
    //     emitter.socketsLeave('room-b');
    //     emitter.to('room-a').emit('message', 'message to all client in room-a');
    //     await producer.disconnect();
    // }, 10000);

    // setTimeout(() => {
    //     console.log('emitter emit message to all server');
    //     emitter.serverSideEmit('message', 'message from emitter');
    // }, 15000);
    
    // setTimeout(async () => {
    //     console.log('disconnect all client');
    //     emitter.disconnectSockets();
    // }, 20000);

    // setTimeout(async () => {
    //     await producer.disconnect();
    // }, 25000);
    
}

main();