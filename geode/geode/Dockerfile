FROM centos:7

LABEL Vendor="Apache Geode"
LABEL version=1.1.1

RUN	yum install -y wget which tar git java-1.8.0-openjdk-devel \
	&& git clone https://github.com/apache/incubator-geode.git \
	&& cd incubator-geode \
	&& git checkout rel/v1.1.1 \
	&& ./gradlew build -Dskip.tests=true -xjavadoc \
	&& ls /incubator-geode | grep -v geode-assembly | xargs rm -rf \
	&& rm -rf /root/.gradle/ \
	&& rm -rf /incubator-geode/geode-assembly/build/distributions/ \
	&& rm -rf /usr/share/locale/* \
	&& yum remove -y perl \
	&& yum clean all

ENV GEODE_HOME /incubator-geode/geode-assembly/build/install/apache-geode
ENV PATH $PATH:$GEODE_HOME/bin

VOLUME ["/data/"]
