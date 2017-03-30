#!/bin/bash

sudo apt-get install \
    apt-transport-https \
    ca-certificates \
    curl \
    software-properties-common
    
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo apt-key add -
sudo apt-key fingerprint 0EBFCD88
sudo add-apt-repository \
   "deb [arch=amd64] https://download.docker.com/linux/ubuntu \
   $(lsb_release -cs) \
   stable"
sudo apt-get update
sudo apt-get install docker-ce

# add docker user
sudo groupadd docker
sudo usermod -aG docker $USER
echo "Need to Log out and log back in to refresh group membership"
echo "After re-login, try the follow command:"
echo "docker run hello-world"
