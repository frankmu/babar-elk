package com.example.reader

import java.nio.file.Paths
import java.nio.file.Files
import java.nio.file.Path

import akka.stream.OverflowStrategy
import akka.stream.scaladsl.Source
import org.apache.commons.io.input.{Tailer, TailerListenerAdapter}

object FileReader {

  /**
    * Read a file continuously.
    *
    * @param path The path.
    * @param encoding The encoding.
    * @return Either an error or the source.
    */
  def readContinuously[T](path: String, encoding: String): Source[String, _] = 
    Source.queue[String](bufferSize = 1000, OverflowStrategy.fail).
      mapMaterializedValue { queue =>
        Tailer.create(Paths.get(path).toFile, new TailerListenerAdapter {
          override def handle(line: String): Unit = {
            queue.offer(line)
          }
        })
      }
}