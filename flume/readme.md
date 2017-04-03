To user Flume container, change the source command in flume/conf/flume.conf file
```
agent.sources.file.command = tail -F /path/to/log/file/in/container
```


Also change the volumes in docker-compose.yml to where the log file located:
```
volumes:
      - /path/to/log/file/in/local/instance:/path/to/log/file/in/container
```
