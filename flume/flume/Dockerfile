FROM openjdk:8-jre-alpine

ARG FLUME_VERSION=1.7.0

RUN apk add --no-cache wget bash tar \
    && mkdir -p /opt/flume \
    && wget "http://www.apache.org/dist/flume/$FLUME_VERSION/apache-flume-$FLUME_VERSION-bin.tar.gz" \
    && tar -xvzf apache-flume-$FLUME_VERSION-bin.tar.gz -C /opt/flume --strip-components 1 \
    && rm -rf apache-flume-$FLUME_VERSION-bin.tar.gz

COPY start-flume.sh /opt/flume/start-flume.sh
COPY conf /opt/flume/conf

RUN chmod a+x /opt/flume/start-flume.sh

CMD ["/opt/flume/start-flume.sh"]
