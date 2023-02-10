
const { Kafka, Partitioners, CompressionTypes, logLevel } = require('kafkajs');
const { KafkaEmitter } = require('../dist/index');

const kafka = new Kafka({
    clientId: "clientId",
    brokers: ['localhost:9092'],
    logLevel: logLevel.ERROR,
});
const producer = kafka.producer({ createPartitioner: Partitioners.DefaultPartitioner });

async function main() {
    await producer.connect();

    const emitter = new KafkaEmitter(producer);

    console.log('emitter emit message to client-1');
    emitter.to('client-1').emit('message', 'message to client-1');

    console.log('all client join room1');
    emitter.socketsJoin('room1');

    setTimeout(() => {
        console.log('emitter emit message to room1');
        emitter.to('room1').emit('message', 'message to all client in room1');
    }, 5000);

    setTimeout(() => {
        console.log('all client leave room1');
        emitter.socketsLeave('room1');
    }, 10000);

    setTimeout(() => {
        console.log('emitter emit message to all server');
        emitter.serverSideEmit('message', 'message from emitter');
    }, 15000);
    
    setTimeout(async () => {
        console.log('disconnect all client');
        emitter.disconnectSockets();
    }, 20000);

    setTimeout(async () => {
        await producer.disconnect();
    }, 25000);
    
}

main();