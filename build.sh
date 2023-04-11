#!/bin/bash

podman build --platform=linux/s390x -t quay.io/jconallen_us/qotd-web-service/s390x:v5.0.0 .

podman push quay.io/jconallen_us/qotd-web-service/s390x:v5.0.0

date