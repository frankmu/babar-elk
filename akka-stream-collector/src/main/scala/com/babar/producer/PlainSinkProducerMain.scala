package com.babar.producer

import akka.actor.ActorSystem
import akka.kafka.ProducerSettings
import akka.kafka.scaladsl.Producer
import akka.stream.ActorMaterializer
import akka.stream.scaladsl.Source
import org.apache.kafka.clients.producer.ProducerRecord
import org.apache.kafka.common.serialization.{ByteArraySerializer, StringSerializer}
import com.typesafe.config.ConfigFactory
import com.babar.reader.FileReader

object PlainSinkProducerMain extends App {

  implicit val system = ActorSystem("PlainSinkProducerMain")
  implicit val materializer = ActorMaterializer()
  private val config = ConfigFactory.load()

  val producerSettings = ProducerSettings(system, new ByteArraySerializer, new StringSerializer)
    .withBootstrapServers(config.getString("app.kafka.host") + ":" + config.getString("app.kafka.port"))

  val done = FileReader.readContinuously(config.getString("app.file.path"), "UTF-8")
    .map(_.toString)
    .map { elem =>
      println(s"PlainSinkProducer produce: ${elem}")
      new ProducerRecord[Array[Byte], String](config.getString("app.kafka.topic"), elem)
    }
    .runWith(Producer.plainSink(producerSettings))

}
