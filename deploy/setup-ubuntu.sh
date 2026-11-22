#!/bin/sh
# One-time setup of a fresh Ubuntu server (e.g. Oracle Cloud Always Free VM) for GdzieAED.
#   sh deploy/setup-ubuntu.sh
# Installs Docker, opens ports 80/443 in the local firewall and adds swap on small machines.
set -e

if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker "$USER"
fi

# Oracle's Ubuntu images ship iptables rules that reject everything except SSH.
# (The cloud-side Security List must allow 80/443 as well.)
if ! sudo iptables -C INPUT -p tcp -m multiport --dports 80,443 -j ACCEPT 2>/dev/null; then
  sudo iptables -I INPUT 1 -p tcp -m multiport --dports 80,443 -j ACCEPT
  sudo iptables -I INPUT 1 -p udp --dport 443 -j ACCEPT
fi
if command -v netfilter-persistent >/dev/null 2>&1; then
  sudo netfilter-persistent save
fi

# the frontend build needs ~1.5 GB of memory; add swap on 1 GB machines
if [ "$(awk '/MemTotal/ {print $2}' /proc/meminfo)" -lt 2000000 ] && ! swapon --show | grep -q .; then
  sudo fallocate -l 2G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
fi

echo "Done. Log out and back in (docker group), then:"
echo "  cp .env.example .env && nano .env"
echo "  docker compose -f docker-compose.prod.yml -f deploy/docker-compose.https.yml up -d --build"
