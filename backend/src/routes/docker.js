const express = require('express');
const Docker = require('dockerode');
const router = express.Router();

// Initialize Docker client
const docker = new Docker({
  socketPath: process.env.DOCKER_SOCKET || '/var/run/docker.sock'
});

// Get all containers
router.get('/containers', async (req, res) => {
  try {
    const containers = await docker.listContainers({ all: true });
    res.json({
      success: true,
      containers: containers.map(container => ({
        id: container.Id.substring(0, 12),
        name: container.Names[0].replace('/', ''),
        image: container.Image,
        state: container.State,
        status: container.Status,
        ports: container.Ports
      }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get container details
router.get('/containers/:id', async (req, res) => {
  try {
    const container = docker.getContainer(req.params.id);
    const info = await container.inspect();
    res.json({
      success: true,
      container: info
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start container
router.post('/containers/:id/start', async (req, res) => {
  try {
    const container = docker.getContainer(req.params.id);
    await container.start();
    res.json({
      success: true,
      message: 'Container started'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Stop container
router.post('/containers/:id/stop', async (req, res) => {
  try {
    const container = docker.getContainer(req.params.id);
    await container.stop();
    res.json({
      success: true,
      message: 'Container stopped'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Restart container
router.post('/containers/:id/restart', async (req, res) => {
  try {
    const container = docker.getContainer(req.params.id);
    await container.restart();
    res.json({
      success: true,
      message: 'Container restarted'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get container logs
router.get('/containers/:id/logs', async (req, res) => {
  try {
    const container = docker.getContainer(req.params.id);
    const logs = await container.logs({
      stdout: true,
      stderr: true,
      tail: req.query.lines || 100,
      timestamps: true
    });
    
    res.json({
      success: true,
      logs: logs.toString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get images
router.get('/images', async (req, res) => {
  try {
    const images = await docker.listImages();
    res.json({
      success: true,
      images: images.map(image => ({
        id: image.Id.substring(7, 19),
        tags: image.RepoTags,
        size: image.Size,
        created: image.Created
      }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// System info
router.get('/system/info', async (req, res) => {
  try {
    const info = await docker.info();
    res.json({
      success: true,
      info: {
        containers: info.Containers,
        containersRunning: info.ContainersRunning,
        containersPaused: info.ContainersPaused,
        containersStopped: info.ContainersStopped,
        images: info.Images,
        serverVersion: info.ServerVersion,
        memTotal: info.MemTotal,
        cpus: info.NCPU
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;