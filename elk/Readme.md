##### Known issue to run elasticsearch in docker on Linux:
[elasticsearch website](https://www.elastic.co/guide/en/elasticsearch/reference/current/docker.html#docker-cli-run-prod-mode)

##### The fix is here:
[stackoverflow](http://stackoverflow.com/questions/40352134/fail-when-start-a-new-container-with-elasticsearch-5-0)

execute this on the host machine:
```shell
sysctl -w vm.max_map_count=262144
```

To set this value permanently, update the vm.max_map_count setting in /etc/sysctl.conf.

To verify after rebooting, run
```shell
sysctl vm.max_map_count
```
