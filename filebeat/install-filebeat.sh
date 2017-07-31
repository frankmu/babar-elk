curl -L -O https://artifacts.elastic.co/downloads/beats/filebeat/filebeat-5.3.0-linux-x86_64.tar.gz
tar -zxvf filebeat-5.3.0-linux-x86_64.tar.gz
rm -rf filebeat-5.3.0-linux-x86_64.tar.gz
mv ./filebeat-5.3.0-linux-x86_64/filebeat.yml ./filebeat-5.3.0-linux-x86_64/filebeat.yml.sample
cp ./filebeat.yml ./filebeat-5.3.0-linux-x86_64/



