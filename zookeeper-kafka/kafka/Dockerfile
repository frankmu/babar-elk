FROM openjdk:8-jre-alpine

ARG KAFKA_VERSION=0.10.2.0
ARG SCALA_VERSION=2.12


RUN apk add --no-cache wget bash \
    && mkdir /opt /kafka /data\
    && wget "http://www.apache.org/dist/kafka/$KAFKA_VERSION/kafka_$SCALA_VERSION-$KAFKA_VERSION.tgz" \
    && mv kafka_$SCALA_VERSION-$KAFKA_VERSION.tgz kafka_$SCALA_VERSION-$KAFKA_VERSION.tar \
    && tar -xvf kafka_$SCALA_VERSION-$KAFKA_VERSION.tar -C /opt \
    && rm -rf kafka_$SCALA_VERSION-$KAFKA_VERSION.tgz \
    && mv /opt/kafka_$SCALA_VERSION-$KAFKA_VERSION /opt/kafka

COPY start-kafka.sh /kafka/start-kafka.sh
COPY config /kafka/config

RUN chmod a+x /kafka/start-kafka.sh

VOLUME ["/data"]

CMD ["/kafka/start-kafka.sh"]
