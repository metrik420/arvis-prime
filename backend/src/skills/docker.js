const Docker = require('dockerode');

class DockerSkill {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.docker = new Docker({
      socketPath: process.env.DOCKER_SOCKET || '/var/run/docker.sock'
    });
  }

  async initialize() {
    try {
      // Test Docker connection
      await this.docker.ping();
      this.logger.info('Docker skill initialized successfully');
      return true;
    } catch (error) {
      this.logger.error('Failed to initialize Docker skill:', error.message);
      return false;
    }
  }

  async execute(action, args = {}) {
    try {
      switch (action) {
        case 'start_container':
          return await this.startContainer(args.name || args.id);
        case 'stop_container':
          return await this.stopContainer(args.name || args.id);
        case 'restart_container':
          return await this.restartContainer(args.name || args.id);
        case 'get_containers':
          return await this.getContainers(args.all);
        case 'get_container_logs':
          return await this.getContainerLogs(args.name || args.id, args.lines);
        case 'get_system_info':
          return await this.getSystemInfo();
        case 'prune_system':
          return await this.pruneSystem();
        default:
          throw new Error(`Unknown action: ${action}`);
      }
    } catch (error) {
      this.logger.error(`Docker action ${action} failed:`, error.message);
      throw error;
    }
  }

  async startContainer(nameOrId) {
    const container = await this.findContainer(nameOrId);
    if (!container) {
      throw new Error(`Container ${nameOrId} not found`);
    }

    const info = await container.inspect();
    if (info.State.Running) {
      return { success: true, message: `Container ${nameOrId} is already running` };
    }

    await container.start();
    return { success: true, message: `Container ${nameOrId} started successfully` };
  }

  async stopContainer(nameOrId) {
    const container = await this.findContainer(nameOrId);
    if (!container) {
      throw new Error(`Container ${nameOrId} not found`);
    }

    const info = await container.inspect();
    if (!info.State.Running) {
      return { success: true, message: `Container ${nameOrId} is already stopped` };
    }

    await container.stop();
    return { success: true, message: `Container ${nameOrId} stopped successfully` };
  }

  async restartContainer(nameOrId) {
    const container = await this.findContainer(nameOrId);
    if (!container) {
      throw new Error(`Container ${nameOrId} not found`);
    }

    await container.restart();
    return { success: true, message: `Container ${nameOrId} restarted successfully` };
  }

  async getContainers(all = false) {
    const containers = await this.docker.listContainers({ all });
    
    return {
      success: true,
      containers: containers.map(container => ({
        id: container.Id.substring(0, 12),
        name: container.Names[0].replace('/', ''),
        image: container.Image,
        state: container.State,
        status: container.Status,
        created: container.Created,
        ports: container.Ports.map(port => ({
          privatePort: port.PrivatePort,
          publicPort: port.PublicPort,
          type: port.Type
        }))
      }))
    };
  }

  async getContainerLogs(nameOrId, lines = 100) {
    const container = await this.findContainer(nameOrId);
    if (!container) {
      throw new Error(`Container ${nameOrId} not found`);
    }

    const logs = await container.logs({
      stdout: true,
      stderr: true,
      tail: lines,
      timestamps: true
    });

    return {
      success: true,
      container: nameOrId,
      logs: logs.toString().split('\n').filter(line => line.trim())
    };
  }

  async getSystemInfo() {
    const info = await this.docker.info();
    
    return {
      success: true,
      info: {
        containers: info.Containers,
        containersRunning: info.ContainersRunning,
        containersPaused: info.ContainersPaused,
        containersStopped: info.ContainersStopped,
        images: info.Images,
        serverVersion: info.ServerVersion,
        operatingSystem: info.OperatingSystem,
        architecture: info.Architecture,
        memTotal: info.MemTotal,
        cpus: info.NCPU,
        dockerRootDir: info.DockerRootDir
      }
    };
  }

  async pruneSystem() {
    const results = await Promise.all([
      this.docker.pruneContainers(),
      this.docker.pruneImages(),
      this.docker.pruneNetworks(),
      this.docker.pruneVolumes()
    ]);

    const [containers, images, networks, volumes] = results;

    return {
      success: true,
      message: 'System pruned successfully',
      details: {
        containersDeleted: containers.ContainersDeleted?.length || 0,
        spaceReclaimed: containers.SpaceReclaimed || 0,
        imagesDeleted: images.ImagesDeleted?.length || 0,
        networksDeleted: networks.NetworksDeleted?.length || 0,
        volumesDeleted: volumes.VolumesDeleted?.length || 0
      }
    };
  }

  async findContainer(nameOrId) {
    try {
      // Try to get container directly by ID
      return this.docker.getContainer(nameOrId);
    } catch (error) {
      // If not found by ID, search by name
      const containers = await this.docker.listContainers({ all: true });
      const found = containers.find(container => 
        container.Names.some(name => name.replace('/', '') === nameOrId)
      );
      
      return found ? this.docker.getContainer(found.Id) : null;
    }
  }

  async healthCheck() {
    try {
      await this.docker.ping();
      return { healthy: true, message: 'Docker connection OK' };
    } catch (error) {
      return { healthy: false, message: error.message };
    }
  }

  async shutdown() {
    this.logger.info('Docker skill shutting down');
  }
}

module.exports = DockerSkill;