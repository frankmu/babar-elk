FROM docker.elastic.co/logstash/logstash:5.3.0

# Add your logstash plugins setup here
# Example: RUN logstash-plugin install logstash-filter-json

RUN rm -rf /usr/share/logstash/pipeline/
ADD pipeline/ /usr/share/logstash/pipeline/
ADD config/ /usr/share/logstash/config/
