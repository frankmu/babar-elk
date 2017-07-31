If running in locahost and logstash in listen in TCP port 5000. Try running the following command to insert data to logstash directly

```
$ nc localhost 5000 < /path/to/logfile.log
```
