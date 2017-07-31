package com.babar.producer

import akka.actor.ActorSystem
import akka.kafka.scaladsl.Producer
import akka.kafka.{ProducerMessage, ProducerSettings}
import akka.stream.ActorMaterializer
import akka.stream.scaladsl.{Sink, Source}
import org.apache.kafka.clients.producer.ProducerRecord
import org.apache.kafka.common.serialization.{ByteArraySerializer, StringSerializer}

/**
  * Created by marksu on 9/6/16.
  */
object FlowProducerMain extends App {
  implicit val system = ActorSystem("FlowProducerMain")
  implicit val materializer = ActorMaterializer()

  val producerSettings = ProducerSettings(system, new ByteArraySerializer, new StringSerializer)
    .withBootstrapServers("192.168.1.223:9092")

  val done = Source(1 to 10)
    .map { n =>
      // val partition = math.abs(n) % 2
      val partition = 0
      ProducerMessage.Message(new ProducerRecord[Array[Byte], String](
        "test", partition, null, n.toString
      ), n)
    }
    .via(Producer.flow(producerSettings))
    .map { result =>
      val record = result.message.record
      println(s"${record.topic}/${record.partition} ${result.offset}: ${record.value}" +
        s"(${result.message.passThrough})")
      result
    }
    .runWith(Sink.ignore)
}
