name := """log-collector"""

version := "1.0"

scalaVersion := "2.11.8"

val akkaVersion = "2.4.17"
val akkaStreamKafkaVersion = "0.14"
val commonsIoVersion = "2.5"

libraryDependencies ++= Seq(
  "com.typesafe.akka" %% "akka-actor" % akkaVersion,
  "com.typesafe.akka" %% "akka-stream-kafka" % akkaStreamKafkaVersion,
  "commons-io" % "commons-io" % commonsIoVersion)