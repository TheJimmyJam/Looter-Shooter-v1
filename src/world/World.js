import * as THREE from 'three';

// Shared terrain height function — must match geometry displacement exactly
export function getTerrainHeight(x, z) {
  const dist = Math.sqrt(x * x + z * z);
  if (dist < 14) return 0; // flat spawn area

  const s1 = 0.028, s2 = 0.075, s3 = 0.18;
  const h1 = Math.sin(x * s1) * Math.cos(z * s1) * 5;
  const h2 = Math.sin(x * s2 + 1.3) * Math.cos(z * s2 + 0.7) * 2.2;
  const h3 = Math.sin(x * s3 + 2.1) * Math.cos(z * s3 + 1.8) * 0.9;

  // Blend to flat near center
  const blend = Math.min(1, (dist - 14) / 10);
  return (h1 + h2 + h3) * blend;
}

export class World {
  constructor(scene) {
    this.scene = scene;
    this.size = 240;
    this.resourceNodes = [];

    this.createTerrain();
    this.createTrees(70);
    this.createRocks(45);
    this.createCrystalNodes(22);
    this.createAmbientLights();
  }

  createTerrain() {
    const segments = 80;
    const geo = new THREE.PlaneGeometry(this.size, this.size, segments, segments);
    geo.rotateX(-Math.PI / 2);

    const pos = geo.attributes.position;
    const colors = [];

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const y = getTerrainHeight(x, z);
      pos.setY(i, y);

      // Vertex color based on height
      if (y < 0.3) {
        colors.push(0.33, 0.60, 0.32); // grass
      } else if (y < 2.0) {
        colors.push(0.28, 0.52, 0.27); // mid grass
      } else if (y < 4.0) {
        colors.push(0.46, 0.40, 0.30); // rocky dirt
      } else {
        colors.push(0.55, 0.55, 0.58); // stone
      }
    }

    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.computeVertexNormals();

    const mat = new THREE.MeshLambertMaterial({
      vertexColors: true,
      flatShading: true,
    });

    this.terrainMesh = new THREE.Mesh(geo, mat);
    this.terrainMesh.receiveShadow = true;
    this.terrainMesh.name = 'terrain';
    this.scene.add(this.terrainMesh);
  }

  createTrees(count) {
    const positions = this.scatter(count, 18, this.size / 2 - 8);
    positions.forEach(p => {
      const tree = this.makeTree();
      const y = getTerrainHeight(p.x, p.z);
      tree.position.set(p.x, y, p.z);
      this.scene.add(tree);
    });
  }

  makeTree() {
    const g = new THREE.Group();
    const trunkH = 2 + Math.random() * 1.5;

    // Trunk
    const trunkGeo = new THREE.CylinderGeometry(0.22, 0.38, trunkH, 6, 1);
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x5c3a1e, flatShading: true });
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = trunkH / 2;
    trunk.castShadow = true;
    g.add(trunk);

    // Layered foliage
    const leafColors = [0x2d7a4a, 0x38a35c, 0x4dc471];
    const layers = 3;
    for (let i = 0; i < layers; i++) {
      const radius = (layers - i) * 1.1 + 0.4;
      const coneH = 2.2 + i * 0.3;
      const coneGeo = new THREE.ConeGeometry(radius, coneH, 7, 1);
      const coneMat = new THREE.MeshLambertMaterial({ color: leafColors[i], flatShading: true });
      const cone = new THREE.Mesh(coneGeo, coneMat);
      cone.position.y = trunkH + i * 1.3 + coneH / 2 - 0.4;
      cone.castShadow = true;
      g.add(cone);
    }

    g.rotation.y = Math.random() * Math.PI * 2;
    const s = 0.75 + Math.random() * 0.55;
    g.scale.set(s, s, s);
    return g;
  }

  createRocks(count) {
    const positions = this.scatter(count, 12, this.size / 2 - 6);
    positions.forEach(p => {
      const rock = this.makeRockCluster();
      const y = getTerrainHeight(p.x, p.z);
      rock.position.set(p.x, y, p.z);
      this.scene.add(rock);
    });
  }

  makeRockCluster() {
    const g = new THREE.Group();
    const count = 1 + Math.floor(Math.random() * 3);
    const shades = [0x78808a, 0x8a9096, 0x6a7078, 0x9aa0a8];

    for (let i = 0; i < count; i++) {
      const geo = new THREE.IcosahedronGeometry(0.45 + Math.random() * 0.75, 0);
      const mat = new THREE.MeshLambertMaterial({
        color: shades[Math.floor(Math.random() * shades.length)],
        flatShading: true
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set((Math.random() - 0.5) * 1.8, 0.2 + Math.random() * 0.3, (Math.random() - 0.5) * 1.8);
      mesh.rotation.set(Math.random() * 2, Math.random() * 6, Math.random() * 2);
      mesh.scale.set(1 + Math.random() * 0.3, 0.65 + Math.random() * 0.4, 1 + Math.random() * 0.3);
      mesh.castShadow = true;
      g.add(mesh);
    }
    return g;
  }

  createCrystalNodes(count) {
    const positions = this.scatter(count, 20, this.size / 2 - 10);
    const crystalPalette = [
      { color: 0x8b5cf6, emissive: 0x5b21b6 }, // violet
      { color: 0x3b82f6, emissive: 0x1d4ed8 }, // blue
      { color: 0xef4444, emissive: 0xb91c1c }, // red
      { color: 0xf59e0b, emissive: 0xb45309 }, // amber
      { color: 0x10b981, emissive: 0x065f46 }, // emerald
    ];

    positions.forEach(p => {
      const palette = crystalPalette[Math.floor(Math.random() * crystalPalette.length)];
      const node = this.makeCrystalNode(palette);
      const y = getTerrainHeight(p.x, p.z);
      node.position.set(p.x, y, p.z);
      node.userData.type = 'resource';
      node.userData.resourceType = 'crystal';
      node.userData.color = palette.color;
      node.userData.collected = false;
      this.scene.add(node);
      this.resourceNodes.push(node);
    });
  }

  makeCrystalNode({ color, emissive }) {
    const g = new THREE.Group();

    // Base boulder
    const baseGeo = new THREE.IcosahedronGeometry(0.7, 0);
    const baseMat = new THREE.MeshLambertMaterial({ color: 0x4a5568, flatShading: true });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = 0.35;
    base.scale.set(1.2, 0.8, 1.2);
    base.castShadow = true;
    g.add(base);

    // Crystal spikes
    const crystalMat = new THREE.MeshLambertMaterial({ color, flatShading: true, emissive, emissiveIntensity: 0.4 });
    const spikeCount = 3 + Math.floor(Math.random() * 4);
    for (let i = 0; i < spikeCount; i++) {
      const h = 0.5 + Math.random() * 0.8;
      const spikeGeo = new THREE.OctahedronGeometry(0.15 + Math.random() * 0.12, 0);
      const spike = new THREE.Mesh(spikeGeo, crystalMat);
      const angle = (i / spikeCount) * Math.PI * 2 + Math.random() * 0.5;
      const r = 0.2 + Math.random() * 0.3;
      spike.position.set(Math.cos(angle) * r, 0.7 + h * 0.5, Math.sin(angle) * r);
      spike.scale.set(1, 2.5 + Math.random(), 1);
      spike.rotation.set(Math.random() * 0.4 - 0.2, Math.random(), Math.random() * 0.4 - 0.2);
      g.add(spike);
    }

    // Glow point light
    const light = new THREE.PointLight(color, 0.8, 8);
    light.position.y = 1.5;
    g.add(light);

    return g;
  }

  createAmbientLights() {
    // A few colored accent lights for atmosphere
    const accents = [
      { color: 0x7c3aed, pos: [30, 5, 30] },
      { color: 0x1d4ed8, pos: [-40, 5, -20] },
      { color: 0x065f46, pos: [20, 5, -50] },
    ];
    accents.forEach(a => {
      const l = new THREE.PointLight(a.color, 0.4, 35);
      l.position.set(...a.pos);
      this.scene.add(l);
    });
  }

  // Scatter positions avoiding center and map edge
  scatter(count, minRadius, maxRadius) {
    const positions = [];
    let attempts = 0;
    while (positions.length < count && attempts < count * 15) {
      attempts++;
      const angle = Math.random() * Math.PI * 2;
      const r = minRadius + Math.random() * (maxRadius - minRadius);
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;

      let valid = true;
      for (const p of positions) {
        if (Math.hypot(p.x - x, p.z - z) < 6) { valid = false; break; }
      }
      if (valid) positions.push({ x, z });
    }
    return positions;
  }
}
