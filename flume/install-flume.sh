#!/bin/bash

export FLUME_VERSION=1.7.0
mkdir -p /tmp/flume
wget "http://www.apache.org/dist/flume/$FLUME_VERSION/apache-flume-$FLUME_VERSION-bin.tar.gz"
tar -xvzf apache-flume-$FLUME_VERSION-bin.tar.gz -C /tmp/flume --strip-components 1
rm -rf apache-flume-$FLUME_VERSION-bin.tar.gz
cp start-flume-local.sh /tmp/flume/start-flume-local.sh
cp -r flume/conf /tmp/flume
chmod a+x /tmp/flume/start-flume-local.sh
