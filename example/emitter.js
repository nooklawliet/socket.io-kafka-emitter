
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
    emitter.to('clientId').emit('message', 'hello from kafka emitter');
    
    await producer.disconnect();
}

main();