FROM openjdk:8-jre-alpine

ARG FLUME_VERSION=1.7.0

RUN mkdir /opt/flume
    && wget -q "http://www.apache.org/dist/flume/$FLUME_VERSION/apache-flume-$FLUME_VERSION-bin.tar.gz" | tar zxvf - -C /opt/flume
    && rm -rf apache-flume-$FLUME_VERSION-bin.tar.gz \

COPY start-flume.sh /opt/flume/start-flume.sh
COPY config /opt/flume/config

RUN chmod a+x /opt/flume/start-flume.sh

#CMD ["/opt/flume/start-flume.sh"]
