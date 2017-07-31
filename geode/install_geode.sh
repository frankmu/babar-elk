#!/bin/bash

git clone https://github.com/apache/incubator-geode.git
cd incubator-geode
git checkout rel/v1.1.1
./gradlew build -Dskip.tests=true -xjavadoc
ls /incubator-geode | grep -v geode-assembly | xargs rm -rf
sudo rm -rf /root/.gradle/
rm -rf /incubator-geode/geode-assembly/build/distributions/

export GEODE_HOME=$PWD/geode-assembly/build/install/apache-geode
export PATH=$PATH:$GEODE_HOME/bin
