package com.babar.producer

import akka.actor.ActorSystem
import akka.kafka.ProducerSettings
import akka.kafka.scaladsl.Producer
import akka.stream.ActorMaterializer
import akka.stream.scaladsl.Source
import org.apache.kafka.clients.producer.ProducerRecord
import org.apache.kafka.common.serialization.{ByteArraySerializer, StringSerializer}
import com.typesafe.config.ConfigFactory
import java.nio.file.Paths
import akka.util.ByteString
import akka.stream.scaladsl._

object PlainSinkProducerMain extends App {

  implicit val system = ActorSystem("PlainSinkProducerMain")
  implicit val materializer = ActorMaterializer()
  private val config = ConfigFactory.load()

  val producerSettings = ProducerSettings(system, new ByteArraySerializer, new StringSerializer)
    .withBootstrapServers(config.getString("app.kafka.host") + ":" + config.getString("app.kafka.port"))

  FileIO.fromPath(Paths.get(config.getString("app.file.path")))
    .via(Framing.delimiter(ByteString(System.lineSeparator), maximumFrameLength = 512, allowTruncation = true))
    .map(_.utf8String)
    .map { elem =>
      println(s"PlainSinkProducer produce: ${elem}")
      new ProducerRecord[Array[Byte], String](config.getString("app.kafka.topic"), elem)
    }
    .runWith(Producer.plainSink(producerSettings))

}
