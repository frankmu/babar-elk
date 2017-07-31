name := """akka-stream-collector"""

version := "1.0"

scalaVersion := "2.11.8"

val akkaVersion = "2.5.0"
val akkaStreamKafkaVersion = "0.14"
val configVersion = "1.3.1"
val commonsIoVersion = "2.5"

libraryDependencies ++= Seq(
  "com.typesafe.akka" %% "akka-actor" % akkaVersion,
  "com.typesafe.akka" %% "akka-stream-kafka" % akkaStreamKafkaVersion,
  "com.typesafe" % "config" % configVersion,
  "commons-io" % "commons-io" % commonsIoVersion)
