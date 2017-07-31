#!/bin/bash

FLUME_CONF_DIR=${FLUME_CONF_DIR:-/tmp/flume/conf}
FLUME_CONF_FILE=/tmp/flume/conf/flume.conf
FLUME_AGENT_NAME=agent
echo "Starting flume agent : ${FLUME_AGENT_NAME}"

/tmp/flume/bin/flume-ng agent \
  -c ${FLUME_CONF_DIR} \
  -f ${FLUME_CONF_FILE} \
  -n ${FLUME_AGENT_NAME} \
  -Dflume.root.logger=INFO,console

