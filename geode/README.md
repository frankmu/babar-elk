# Creating a cluster using multiple containers

There is a docker-compose.yml example file there with a locator and a server.  To start the cluster execute:

```
docker-compose up locator
docker-compose up server
```

Do a docker ps and identify the container ID for the locator.  Now you can use *gfsh* on this container and connect to the distributed system:

```
docker exec -it <locator_container_id> gfsh
gfsh>connect --locator=locator[10334]
Connecting to Locator at [host=locator, port=10334] ..
Connecting to Manager at [host=192.168.99.100, port=1099] ..
Successfully connected to: [host=192.168.99.100, port=1099]

gfsh>list members
    Name     | Id
    ------------ | --------------------------------------
    locator      | locator(locator:33:locator)<v0>:1351
    6e96cc0f6b72 | 172.17.1.92(6e96cc0f6b72:34)<v1>:28140
```

Type exit and now to scale the cluster you can leverage docker-compose scale command. For example:

```
docker-compose scale server=3
```

This will start 2 extra Geode server containers. You can verify this step by repeating the last GFSH step and listing the members.

# Install in Ubuntu 16.04
run install_geode.sh and use gfsh to start locator/server, create region
```
$ gfsh 
gfsh> start locator
gfsh> start server
gfsh> create region --name=hello --type=REPLICATE 
```

