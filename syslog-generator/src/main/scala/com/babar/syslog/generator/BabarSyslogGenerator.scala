package com.babar.syslog.generator

import akka.actor.{ActorSystem, Props, Actor}
import scala.concurrent.duration._
import org.slf4j.LoggerFactory
import scala.util.Random

case object Message
case class Log(message: String)

class BabarMessager extends Actor {
  val messages = Array(
      "Built UDP connection for faddr 198.207.223.240/53337 gaddr 10.0.0.187/53 laddr 192.168.0.2/53", 
      "Deny icmp src outside:Some-Cisco dst inside:10.0.0.187 (type 3, code 1) by access-group \"outside_access_in\"", 
      "connect from dialpool-210-214-5-215.maa.sify.net[210.214.5.215]",
      "A1CE861A83: reject: RCPT from unknown[218.246.34.68]: 557 Service unavailable; Client host [218.246.34.68] blocked using list.dsbl.org; http://dsbl.org/listing?ip=218.246.34.68; from= to= proto=SMTP helo=",
      "lost connection after RCPT from unknown[218.246.34.68]",
      "disconnect from unknown[218.246.34.68]",
      "connect from unknown[62.113.122.52]",
      "4EC6561A83: client=unknown[62.113.122.52]",
      "connect from host81-153-11-97.range81-153.btcentralplus.com[81.153.11.97]",
      "4EC6561A83: reject: RCPT from unknown[62.113.122.52]: 450 : Sender address rejected: Domain not found; from= to= proto=ESMTP helo=",
      "C0E5861AA4: client=host81-153-11-97.range81-153.btcentralplus.com[81.153.11.97]",
      "Teardown UDP connection for faddr 192.168.245.1/137 gaddr 10.0.0.187/2789 laddr 192.168.0.2/2789 ()")

  def receive = {
    case Message => sender ! Log(Random.shuffle(messages.toList).head)
  }
}

class BabarLogger extends Actor {
  val log = LoggerFactory.getLogger(getClass)
  def receive = {
    case Log(message) => {
      log.info(message)
    }
  }
}

object BabarSyslogGenerator extends App {
  val system = ActorSystem("babar")
  val messager = system.actorOf(Props[BabarMessager], "messager")
  val logger = system.actorOf(Props[BabarLogger])
  system.scheduler.schedule(0.seconds, 10.milliseconds, messager, Message)(system.dispatcher, logger) 
}