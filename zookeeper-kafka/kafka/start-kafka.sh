#!/bin/bash

cat /kafka/config/server.properties.template | sed \
  -e "s|{{ZOOKEEPER_CONNECTION_STRING}}|${ZOOKEEPER_CONNECTION_STRING}|g" \
  -e "s|{{ZOOKEEPER_CHROOT}}|${ZOOKEEPER_CHROOT:-}|g" \
  -e "s|{{KAFKA_BROKER_ID}}|${KAFKA_BROKER_ID:-0}|g" \
  -e "s|{{KAFKA_ADVERTISED_HOST_NAME}}|${KAFKA_ADVERTISED_HOST_NAME:-127.0.0.1}|g" \
  -e "s|{{KAFKA_PORT}}|${KAFKA_PORT:-9092}|g" \
  -e "s|{{KAFKA_ADVERTISED_PORT}}|${KAFKA_ADVERTISED_PORT:-9092}|g" \
  -e "s|{{KAFKA_DELETE_TOPIC_ENABLE}}|${KAFKA_DELETE_TOPIC_ENABLE:-false}|g" \
  -e "s|{{ZOOKEEPER_CONNECTION_TIMEOUT_MS}}|${ZOOKEEPER_CONNECTION_TIMEOUT_MS:-10000}|g" \
  -e "s|{{ZOOKEEPER_SESSION_TIMEOUT_MS}}|${ZOOKEEPER_SESSION_TIMEOUT_MS:-10000}|g" \
  -e "s|{{GROUP_MAX_SESSION_TIMEOUT_MS}}|${GROUP_MAX_SESSION_TIMEOUT_MS:-300000}|g" \
   > /kafka/config/server.properties

echo "Starting kafka"
exec /opt/kafka/bin/kafka-server-start.sh /kafka/config/server.properties
